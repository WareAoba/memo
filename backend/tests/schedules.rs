use axum::{
    body::{Body, to_bytes},
    http::Request,
};
use preset_execution_api::{app, db};
use serde_json::{Value, json};
use sqlx::SqlitePool;
use tower::ServiceExt;
#[tokio::test]
async fn schedule_colors_persist_validate_and_do_not_change_other_schedules() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("colors.sqlite3");
    let pool = db::connect(&path).await.unwrap();
    let work = create(&pool, "entities", "Color work").await;
    let (status, first) = request(&pool, "POST", "/api/schedules", body(&work, &[])).await;
    assert_eq!(status, 201);
    assert_eq!(first["color"], "none");
    let mut input = body(&work, &[]);
    input["color"] = json!("red");
    let (_, second) = request(&pool, "POST", "/api/schedules", input.clone()).await;
    assert_eq!(second["color"], "red");
    let url = format!("/api/schedules/{}", first["id"].as_str().unwrap());
    for color in [
        "red", "orange", "yellow", "green", "blue", "indigo", "violet", "none",
    ] {
        let (status, updated) = request(&pool, "PATCH", &url, json!({"color":color})).await;
        assert_eq!(status, 200);
        assert_eq!(updated["color"], color);
        assert_eq!(updated["entity_snapshot"], first["entity_snapshot"]);
    }
    for invalid in [json!("pink"), json!("#ff0000"), Value::Null, json!(42)] {
        assert_eq!(
            request(&pool, "PATCH", &url, json!({"color":invalid}))
                .await
                .0,
            400
        );
        input["color"] = invalid;
        assert_eq!(
            request(&pool, "POST", "/api/schedules", input.clone())
                .await
                .0,
            400
        );
    }
    request(&pool, "PATCH", &url, json!({"color":"blue"})).await;
    request(&pool, "PATCH", &url, json!({"notes":"keep color"})).await;
    pool.close().await;
    let pool = db::connect(&path).await.unwrap();
    assert_eq!(
        request(&pool, "GET", &url, Value::Null).await.1["color"],
        "blue"
    );
    let list = request(&pool, "GET", "/api/schedules", Value::Null).await.1;
    assert!(
        list["items"]
            .as_array()
            .unwrap()
            .iter()
            .any(|item| item["id"] == first["id"] && item["color"] == "blue")
    );
    assert_eq!(
        request(
            &pool,
            "GET",
            &format!("/api/schedules/{}", second["id"].as_str().unwrap()),
            Value::Null
        )
        .await
        .1["color"],
        "red"
    );
}
async fn request(pool: &SqlitePool, method: &str, path: &str, body: Value) -> (u16, Value) {
    let response = app(pool.clone())
        .oneshot(
            Request::builder()
                .header("host", "localhost:3000")
                .method(method)
                .uri(path)
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status().as_u16();
    let bytes = to_bytes(response.into_body(), 1_000_000).await.unwrap();
    (
        status,
        if bytes.is_empty() {
            Value::Null
        } else {
            serde_json::from_slice(&bytes).unwrap()
        },
    )
}
async fn create(pool: &SqlitePool, kind: &str, name: &str) -> String {
    let (status, value) =
        request(pool, "POST", &format!("/api/{kind}"), json!({"name":name})).await;
    assert_eq!(status, 201);
    value["id"].as_str().unwrap().to_owned()
}
fn body(work: &str, tasks: &[String]) -> Value {
    json!({"entity_id":work,"task_preset_ids":tasks,"scheduled_date":"2028-02-29","start_time":"09:00","end_time":"10:00","time_zone":"Asia/Tokyo"})
}
#[tokio::test]
async fn search_filters_before_pagination_and_uses_snapshots() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("search.sqlite3"))
        .await
        .unwrap();
    let work = create(&pool, "entities", "Original work").await;
    let task = create(&pool, "task-presets", "TaskNeedle").await;
    let mut saved = Value::Null;
    for index in 0..22 {
        let mut input = body(&work, std::slice::from_ref(&task));
        input["title"] = json!(format!("Appointment {index}"));
        input["notes"] = json!("MemoNeedle 100%_!");
        let (status, result) = request(&pool, "POST", "/api/schedules", input).await;
        assert_eq!(status, 201);
        saved = result;
    }
    request(&pool, "POST", "/api/schedules", body(&work, &[])).await;
    let uri = format!("/api/schedules/{}", saved["id"].as_str().unwrap());
    request(
        &pool,
        "PATCH",
        &format!("/api/entities/{work}"),
        json!({"name":"Renamed work"}),
    )
    .await;
    request(
        &pool,
        "PATCH",
        &format!("/api/task-presets/{task}"),
        json!({"name":"Renamed task"}),
    )
    .await;
    for query in ["TaskNeedle", "MemoNeedle", "100%25_!", "Appointment"] {
        let (status, result) = request(
            &pool,
            "GET",
            &format!("/api/schedules?q={query}&limit=20&offset=20"),
            Value::Null,
        )
        .await;
        assert_eq!(status, 200, "{result}");
        assert_eq!(result["total"], 22);
        assert_eq!(result["items"].as_array().unwrap().len(), 2);
        assert!(result["items"][0].get("tasks").is_none());
    }
    for (query, total) in [
        ("q=Original", 23),
        ("q=MemoNeedle", 22),
        ("q=Renamed", 0),
        ("q=100%25X", 0),
        ("q=MemoNeedle&date=2028-03-01", 0),
    ] {
        let (status, result) = request(
            &pool,
            "GET",
            &format!("/api/schedules?{query}"),
            Value::Null,
        )
        .await;
        assert_eq!(status, 200);
        assert_eq!(result["total"], total, "{query}");
    }
    assert_eq!(
        request(&pool, "GET", "/api/schedules?q=%00", Value::Null)
            .await
            .0,
        400
    );
    assert_eq!(
        request(
            &pool,
            "GET",
            &format!("/api/schedules?q={}", "x".repeat(201)),
            Value::Null
        )
        .await
        .0,
        400
    );
    assert!(
        request(&pool, "GET", &uri, Value::Null)
            .await
            .1
            .get("archived")
            .is_none()
    );
    assert_eq!(
        request(&pool, "PATCH", &uri, json!({"archived":true}))
            .await
            .0,
        400
    );
    for query in ["archived=true", "include_archived=true"] {
        assert_eq!(
            request(
                &pool,
                "GET",
                &format!("/api/schedules?{query}"),
                Value::Null
            )
            .await
            .0,
            400
        );
    }
}

#[tokio::test]
async fn removing_archive_preserves_schedule_snapshots_and_execution() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("migration.sqlite3"))
        .await
        .unwrap();
    let work = create(&pool, "entities", "Retained work").await;
    let task = create(&pool, "task-presets", "Retained task").await;
    let (_, saved) = request(&pool, "POST", "/api/schedules", body(&work, &[task])).await;
    let id = saved["id"].as_str().unwrap();
    let uri = format!("/api/schedules/{id}");
    let task_uri = format!(
        "/api/schedule-tasks/{}",
        saved["tasks"][0]["id"].as_str().unwrap()
    );
    let (_, before) = request(
        &pool,
        "PATCH",
        &task_uri,
        json!({"status":"completed","execution_notes":"Keep this history"}),
    )
    .await;
    // Recreate the sole removed column to exercise the pre-migration archive state.
    sqlx::raw_sql("ALTER TABLE schedules ADD COLUMN deleted_at TEXT;")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("UPDATE schedules SET deleted_at='2026-09-25T00:00:00Z' WHERE id=?")
        .bind(id)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::raw_sql(include_str!(
        "../migrations/202609250001_remove_schedule_archive.sql"
    ))
    .execute(&pool)
    .await
    .unwrap();
    assert_eq!(request(&pool, "GET", &uri, Value::Null).await.1, before);
    assert_eq!(
        request(&pool, "GET", "/api/schedules", Value::Null).await.1["total"],
        1
    );
    assert_eq!(
        request(
            &pool,
            "PATCH",
            &task_uri,
            json!({"execution_notes":"Still editable"})
        )
        .await
        .0,
        200
    );
    let columns: Vec<String> =
        sqlx::query_scalar("SELECT name FROM pragma_table_info('schedules')")
            .fetch_all(&pool)
            .await
            .unwrap();
    assert!(!columns.iter().any(|name| name == "deleted_at"));
    assert!(
        sqlx::query("PRAGMA foreign_key_check")
            .fetch_all(&pool)
            .await
            .unwrap()
            .is_empty()
    );
}
#[tokio::test]
async fn snapshots_survive_source_edits_archive_and_reconnect() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("app.sqlite3");
    let pool = db::connect(&path).await.unwrap();
    let work = create(&pool, "entities", "Original work").await;
    let (_,task)=request(&pool,"POST","/api/task-presets",json!({"name":"Original task","default_notes":"memo","items":[{"position":0,"label":"Check","item_type":"checkbox","required":true,"default_value":true},{"position":1,"label":"Text","item_type":"text","default_value":"abc"},{"position":2,"label":"Number","item_type":"number","default_value":2.5,"unit":"kg"}]})).await;
    let t = task["id"].as_str().unwrap().to_owned();
    let (status, s) = request(
        &pool,
        "POST",
        "/api/schedules",
        body(&work, &[t.clone(), t.clone()]),
    )
    .await;
    assert_eq!(status, 201, "{s}");
    assert_eq!(s["tasks"].as_array().unwrap().len(), 1);
    assert_eq!(s["tasks"][0]["items"][0]["value_boolean"], true);
    assert_eq!(s["tasks"][0]["items"][1]["value_text"], "abc");
    assert_eq!(s["tasks"][0]["items"][2]["value_number"], 2.5);
    let uri = format!("/api/schedules/{}", s["id"].as_str().unwrap());
    assert_eq!(
        request(
            &pool,
            "PATCH",
            &format!("/api/entities/{work}"),
            json!({"name":"Changed"})
        )
        .await
        .0,
        200
    );
    assert_eq!(
        request(
            &pool,
            "PATCH",
            &format!("/api/task-presets/{t}"),
            json!({"name":"New task","items":[]})
        )
        .await
        .0,
        200
    );
    let (_, new) = request(
        &pool,
        "POST",
        "/api/schedules",
        body(&work, std::slice::from_ref(&t)),
    )
    .await;
    assert_eq!(new["entity_snapshot"]["name"], "Changed");
    assert_eq!(new["tasks"][0]["name_snapshot"], "New task");
    assert_eq!(new["tasks"][0]["source_task_preset_version"], 2);
    request(
        &pool,
        "DELETE",
        &format!("/api/task-presets/{t}"),
        Value::Null,
    )
    .await;
    request(
        &pool,
        "DELETE",
        &format!("/api/entities/{work}"),
        Value::Null,
    )
    .await;
    assert_eq!(request(&pool, "GET", &uri, Value::Null).await.1, s);
    let (_, patched) = request(
        &pool,
        "PATCH",
        &uri,
        json!({"scheduled_date":"2028-03-01","notes":"changed"}),
    )
    .await;
    assert_eq!(patched["tasks"], s["tasks"]);
    assert_eq!(patched["entity_snapshot"], s["entity_snapshot"]);
    pool.close().await;
    let pool = db::connect(&path).await.unwrap();
    assert_eq!(
        request(&pool, "GET", &uri, Value::Null).await.1["tasks"],
        s["tasks"]
    );
    pool.close().await;
}
#[tokio::test]
async fn invalid_dates_times_fields_and_filters_do_not_write() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("db")).await.unwrap();
    let w = create(&pool, "entities", "W").await;
    for (key, val) in [
        ("scheduled_date", json!("2027-02-29")),
        ("scheduled_date", json!("2026-04-31")),
        ("scheduled_date", json!("0000-01-01")),
        ("scheduled_date", json!("2026-1-01")),
        ("start_time", json!("24:00")),
        ("end_time", json!("09:00")),
        ("time_zone", json!("Bad/Zone")),
        ("task_preset_ids", json!(["bad"])),
        ("user_id", json!("x")),
        ("archived", json!(false)),
        ("notes", Value::Null),
    ] {
        let mut b = body(&w, &[]);
        b[key] = val;
        assert_eq!(
            request(&pool, "POST", "/api/schedules", b).await.0,
            400,
            "{key}"
        );
    }
    assert_eq!(
        request(&pool, "GET", "/api/schedules", Value::Null).await.1["total"],
        0
    );
    let (_, s) = request(&pool, "POST", "/api/schedules", body(&w, &[])).await;
    let uri = format!("/api/schedules/{}", s["id"].as_str().unwrap());
    for patch in [
        json!({"entity_id":w}),
        json!({"task_preset_ids":[]}),
        json!({"tasks":[]}),
        json!({"start_time":null}),
        json!({"status":"completed"}),
    ] {
        assert_eq!(request(&pool, "PATCH", &uri, patch).await.0, 400);
    }
    for query in [
        "date=bad",
        "from=2028-01-01",
        "from=2028-03-01&to=2028-02-01",
        "date=2028-02-29&from=2028-01-01&to=2028-03-01",
        "limit=101",
        "offset=-1",
        "entity_id=bad",
        "user_id=x",
    ] {
        assert_eq!(
            request(
                &pool,
                "GET",
                &format!("/api/schedules?{query}"),
                Value::Null
            )
            .await
            .0,
            400
        );
    }
    assert_eq!(
        request(
            &pool,
            "GET",
            "/api/schedules?from=2028-02-01&to=2028-02-29",
            Value::Null
        )
        .await
        .1["total"],
        1
    );
    assert_eq!(
        request(&pool, "GET", "/api/schedules?date=2028-03-01", Value::Null)
            .await
            .1["total"],
        0
    );
    for method in ["GET", "PATCH"] {
        assert_eq!(
            request(&pool, method, "/api/schedules/bad", json!({}))
                .await
                .0,
            400
        );
    }
    pool.close().await;
}
#[tokio::test]
async fn failed_item_insert_rolls_back_all_rows_and_archived_sources_rejected() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("db")).await.unwrap();
    let w = create(&pool, "entities", "W").await;
    let (_, p) = request(
        &pool,
        "POST",
        "/api/task-presets",
        json!({"name":"T","items":[{"position":0,"label":"X","item_type":"text"}]}),
    )
    .await;
    let t = p["id"].as_str().unwrap().to_owned();
    sqlx::query("CREATE TRIGGER reject_item BEFORE INSERT ON schedule_task_items BEGIN SELECT RAISE(ABORT,'test'); END").execute(&pool).await.unwrap();
    assert_eq!(
        request(
            &pool,
            "POST",
            "/api/schedules",
            body(&w, std::slice::from_ref(&t))
        )
        .await
        .0,
        503
    );
    for table in [
        "schedules",
        "schedule_entity_snapshot",
        "schedule_tasks",
        "schedule_task_items",
    ] {
        let n: i64 = sqlx::query_scalar(&format!("SELECT count(*) FROM {table}"))
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(n, 0);
    }
    sqlx::query("DROP TRIGGER reject_item")
        .execute(&pool)
        .await
        .unwrap();
    request(
        &pool,
        "DELETE",
        &format!("/api/task-presets/{t}"),
        Value::Null,
    )
    .await;
    assert_eq!(
        request(&pool, "POST", "/api/schedules", body(&w, &[t]))
            .await
            .0,
        400
    );
    request(&pool, "DELETE", &format!("/api/entities/{w}"), Value::Null).await;
    assert_eq!(
        request(&pool, "POST", "/api/schedules", body(&w, &[]))
            .await
            .0,
        400
    );
    pool.close().await;
}
#[tokio::test]
async fn ownership_hidden_and_cross_owner_foreign_keys_enforced() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("db")).await.unwrap();
    let w = create(&pool, "entities", "W").await;
    let other = "00000000-0000-0000-0000-000000000002";
    sqlx::query("INSERT INTO users(id,display_name) VALUES(?,'other')")
        .bind(other)
        .execute(&pool)
        .await
        .unwrap();
    let ow = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO entities(id,user_id,name) VALUES(?,?,'Other')")
        .bind(&ow)
        .bind(other)
        .execute(&pool)
        .await
        .unwrap();
    let ot = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO task_presets(id,user_id,name) VALUES(?,?,'Other')")
        .bind(&ot)
        .bind(other)
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(
        request(&pool, "POST", "/api/schedules", body(&ow, &[]))
            .await
            .0,
        404
    );
    assert_eq!(
        request(
            &pool,
            "POST",
            "/api/schedules",
            body(&w, std::slice::from_ref(&ot))
        )
        .await
        .0,
        404
    );
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO schedules(id,user_id,entity_id,title,scheduled_date,end_date,start_time,end_time,time_zone) VALUES(?,?,?,'Other','2028-02-29','2028-02-29','09:00','10:00','Asia/Tokyo')").bind(&id).bind(other).bind(&ow).execute(&pool).await.unwrap();
    for method in ["GET", "PATCH"] {
        let (status, v) = request(
            &pool,
            method,
            &format!("/api/schedules/{id}"),
            json!({"notes":"x"}),
        )
        .await;
        assert_eq!(status, 404);
        assert_eq!(v["error"]["code"], "SCHEDULE_NOT_FOUND");
    }
    assert_eq!(
        request(&pool, "GET", "/api/schedules", Value::Null).await.1["total"],
        0
    );
    assert!(
        sqlx::query("UPDATE schedules SET entity_id=? WHERE id=?")
            .bind(&w)
            .bind(&id)
            .execute(&pool)
            .await
            .is_err()
    );
    pool.close().await;
}

#[tokio::test]
async fn multi_day_ranges_minute_precision_and_overlap_queries() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("db")).await.unwrap();
    let w = create(&pool, "entities", "W").await;
    let mut input = body(&w, &[]);
    input["scheduled_date"] = json!("2026-12-31");
    input["end_date"] = json!("2027-01-02");
    input["start_time"] = json!("23:30");
    input["end_time"] = json!("01:05");
    let (status, s) = request(&pool, "POST", "/api/schedules", input.clone()).await;
    assert_eq!(status, 201, "{s}");
    assert_eq!(s["end_date"], "2027-01-02");
    let uri = format!("/api/schedules/{}", s["id"].as_str().unwrap());
    for day in ["2026-12-31", "2027-01-01", "2027-01-02"] {
        assert_eq!(
            request(
                &pool,
                "GET",
                &format!("/api/schedules?date={day}"),
                Value::Null
            )
            .await
            .1["total"],
            1
        );
    }
    assert_eq!(
        request(&pool, "GET", "/api/schedules?date=2027-01-03", Value::Null)
            .await
            .1["total"],
        0
    );
    for (key, value) in [
        ("end_date", json!("2026-12-30")),
        ("end_date", json!("2027-02-29")),
        ("start_time", json!("23:60")),
        ("end_time", json!("24:03")),
    ] {
        let mut bad = input.clone();
        bad[key] = value;
        assert_eq!(request(&pool, "POST", "/api/schedules", bad).await.0, 400);
    }
    assert_eq!(
        request(&pool, "PATCH", &uri, json!({"end_date":"2026-12-31"}))
            .await
            .0,
        400
    );
    assert_eq!(
        request(
            &pool,
            "PATCH",
            &uri,
            json!({"end_date":"2027-01-03","end_time":"00:15"})
        )
        .await
        .0,
        200
    );
    assert_eq!(
        request(&pool, "GET", &uri, Value::Null).await.1["end_date"],
        "2027-01-03"
    );
    pool.close().await;
}
#[tokio::test]
async fn end_date_migration_preserves_existing_ids_snapshots_and_execution_values() {
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(
            SqliteConnectOptions::new()
                .in_memory(true)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    for sql in [
        include_str!("../migrations/202609240001_initialize.sql"),
        include_str!("../migrations/202609240002_entities.sql"),
        include_str!("../migrations/202609240003_task_presets.sql"),
        include_str!("../migrations/202609240004_work_task_presets.sql"),
        include_str!("../migrations/202609240005_schedules.sql"),
    ] {
        sqlx::raw_sql(sql).execute(&pool).await.unwrap();
    }
    sqlx::raw_sql("INSERT INTO entities(id,user_id,name) VALUES('w','00000000-0000-4000-8000-000000000001','W'); INSERT INTO task_presets(id,user_id,name) VALUES('p','00000000-0000-4000-8000-000000000001','P'); INSERT INTO schedules(id,user_id,entity_id,title,scheduled_date,start_time,end_time,time_zone) VALUES('s','00000000-0000-4000-8000-000000000001','w','Old','2026-09-24','09:02','10:03','Asia/Tokyo'); INSERT INTO schedule_entity_snapshot(id,schedule_id,definition) VALUES('es','s','{\"name\":\"Original\"}'); INSERT INTO schedule_tasks(id,schedule_id,user_id,source_task_preset_id,source_task_preset_version,name_snapshot,default_notes_snapshot,position,status,execution_notes) VALUES('t','s','00000000-0000-4000-8000-000000000001','p',1,'Snapshot','Notes',0,'in_progress','execution'); INSERT INTO schedule_task_items(id,schedule_task_id,source_preset_item_id,position,definition,value_text,completed) VALUES('i','t','source',0,'{\"label\":\"Original item\"}','written',1);").execute(&pool).await.unwrap();
    let mut tx = pool.begin().await.unwrap();
    sqlx::raw_sql(include_str!(
        "../migrations/202609240006_schedule_end_date.sql"
    ))
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    let row: (String, String, String, String) = sqlx::query_as(
        "SELECT scheduled_date,end_date,start_time,end_time FROM schedules WHERE id='s'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(
        row,
        (
            "2026-09-24".into(),
            "2026-09-24".into(),
            "09:02".into(),
            "10:03".into()
        )
    );
    let task: (String, String, String) = sqlx::query_as(
        "SELECT name_snapshot,status,execution_notes FROM schedule_tasks WHERE id='t'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(
        task,
        ("Snapshot".into(), "in_progress".into(), "execution".into())
    );
    let item: (String, String, bool) = sqlx::query_as(
        "SELECT definition,value_text,completed FROM schedule_task_items WHERE id='i'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(
        item,
        (
            "{\"label\":\"Original item\"}".into(),
            "written".into(),
            true
        )
    );
    let snapshot: String =
        sqlx::query_scalar("SELECT definition FROM schedule_entity_snapshot WHERE id='es'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(snapshot, "{\"name\":\"Original\"}");
    assert!(
        sqlx::query("PRAGMA foreign_key_check")
            .fetch_all(&pool)
            .await
            .unwrap()
            .is_empty()
    );
    assert!(
        sqlx::query("UPDATE schedule_tasks SET schedule_id='missing' WHERE id='t'")
            .execute(&pool)
            .await
            .is_err()
    );

    sqlx::query("UPDATE schedules SET end_date='2026-09-25',status='skipped' WHERE id='s'")
        .execute(&pool)
        .await
        .unwrap();
    let mut tx = pool.begin().await.unwrap();
    sqlx::raw_sql(include_str!("../migrations/202609240007_execution.sql"))
        .execute(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();
    let migrated: (String, String, String) =
        sqlx::query_as("SELECT id,end_date,status FROM schedules WHERE id='s'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(
        migrated,
        ("s".into(), "2026-09-25".into(), "cancelled".into())
    );
    let preserved: (String, String, bool) = sqlx::query_as(
        "SELECT definition,value_text,completed FROM schedule_task_items WHERE id='i'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(preserved, item);
    let preserved_task: (String, String, String) = sqlx::query_as(
        "SELECT name_snapshot,status,execution_notes FROM schedule_tasks WHERE id='t'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(preserved_task, task);
    assert!(
        sqlx::query("PRAGMA foreign_key_check")
            .fetch_all(&pool)
            .await
            .unwrap()
            .is_empty()
    );
    pool.close().await;
}
#[tokio::test]
async fn day_details_are_paginated_and_keep_snapshot_requirements() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("app.sqlite3")).await.unwrap();
    let work = create(&pool, "entities", "Saved work").await;
    request(
        &pool,
        "PATCH",
        &format!("/api/entities/{work}"),
        json!({"advance_contact_required":true}),
    )
    .await;
    let task = create(&pool, "task-presets", "Saved task").await;
    let mut data = body(&work, &[task]);
    data["end_date"] = json!("2028-03-02");
    let (_, saved) = request(&pool, "POST", "/api/schedules", data.clone()).await;
    request(
        &pool,
        "PATCH",
        &format!("/api/entities/{work}"),
        json!({"advance_contact_required":false,"name":"Changed"}),
    )
    .await;
    request(&pool, "POST", "/api/schedules", data).await;
    let (status, page) = request(
        &pool,
        "GET",
        "/api/schedules?date=2028-03-01&include_details=true&limit=1",
        Value::Null,
    )
    .await;
    assert_eq!(status, 200);
    assert_eq!(page["total"], 2);
    assert_eq!(page["items"].as_array().unwrap().len(), 1);
    let (_, second) = request(
        &pool,
        "GET",
        "/api/schedules?date=2028-03-01&include_details=true&limit=1&offset=1",
        Value::Null,
    )
    .await;
    let original = [&page["items"][0], &second["items"][0]]
        .into_iter()
        .find(|s| s["id"] == saved["id"])
        .unwrap();
    assert_eq!(original["entity_snapshot"]["name"], "Saved work");
    assert_eq!(
        original["entity_snapshot"]["advance_contact_required"],
        true
    );
    assert_eq!(original["tasks"][0]["status"], "pending");
    request(
        &pool,
        "DELETE",
        &format!("/api/schedules/{}", saved["id"].as_str().unwrap()),
        Value::Null,
    )
    .await;
    let (_, remaining) = request(
        &pool,
        "GET",
        "/api/schedules?date=2028-03-01&include_details=true",
        Value::Null,
    )
    .await;
    assert_eq!(remaining["total"], 1);
    let (_, empty) = request(
        &pool,
        "GET",
        "/api/schedules?date=2028-03-03&include_details=true",
        Value::Null,
    )
    .await;
    assert_eq!(empty["total"], 0);
}

#[tokio::test]
async fn batched_details_keep_schedule_task_and_item_order_and_empty_children() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("db")).await.unwrap();
    let work = create(&pool, "entities", "Batch work").await;
    let (code, preset) = request(
        &pool,
        "POST",
        "/api/task-presets",
        json!({"name":"With items","items":[
            {"position":0,"label":"First","item_type":"text","default_value":"original"},
            {"position":1,"label":"Second","item_type":"number","default_value":0}
        ]}),
    )
    .await;
    assert_eq!(code, 201);
    let a = preset["id"].as_str().unwrap().to_owned();
    let b = create(&pool, "task-presets", "No items").await;
    let mut expected = Vec::new();
    for (index, ids) in [
        vec![a.clone(), b.clone()],
        vec![b.clone(), a.clone()],
        vec![],
    ]
    .into_iter()
    .enumerate()
    {
        let mut input = body(&work, &ids);
        input["start_time"] = json!(format!("{:02}:00", index + 9));
        input["end_time"] = json!(format!("{:02}:00", index + 10));
        let (code, schedule) = request(&pool, "POST", "/api/schedules", input).await;
        assert_eq!(code, 201);
        expected.push(schedule);
    }
    // A value belongs to this execution only, even though the source preset is shared.
    let path = format!(
        "/api/schedule-task-items/{}",
        expected[1]["tasks"][1]["items"][0]["id"].as_str().unwrap()
    );
    let (code, changed) = request(&pool, "PATCH", &path, json!({"value":"second schedule"})).await;
    assert_eq!(code, 200);
    expected[1] = changed;
    let (code, page) = request(
        &pool,
        "GET",
        "/api/schedules?include_details=true&limit=100",
        Value::Null,
    )
    .await;
    assert_eq!(code, 200);
    assert_eq!(page["items"], json!(expected));
    let items = &page["items"];
    assert_eq!(items[0]["tasks"][0]["items"][0]["value_text"], "original");
    assert_eq!(
        items[1]["tasks"][1]["items"][0]["value_text"],
        "second schedule"
    );
    assert_eq!(
        items[0]["tasks"][0]["items"][1]["definition"]["label"],
        "Second"
    );
    assert_eq!(items[0]["tasks"][1]["items"], json!([]));
    assert_eq!(items[1]["tasks"][0]["items"], json!([]));
    assert_eq!(items[2]["tasks"], json!([]));
    let (_, middle) = request(
        &pool,
        "GET",
        "/api/schedules?include_details=true&limit=1&offset=1",
        Value::Null,
    )
    .await;
    assert_eq!(middle["items"], json!([expected[1]]));
    let (_, summary) = request(&pool, "GET", "/api/schedules", Value::Null).await;
    assert!(summary["items"][0].get("tasks").is_none());
}

#[tokio::test]
async fn page_revision_detects_changes_execution_and_preserves_owner_scope() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("db")).await.unwrap();
    let work = create(&pool, "entities", "Revision work").await;
    let (_,preset)=request(&pool,"POST","/api/task-presets",json!({"name":"Revision task","items":[{"label":"Check","position":0,"item_type":"checkbox"}]})).await;
    let preset = preset["id"].as_str().unwrap().to_owned();
    let (_, first) = request(&pool, "POST", "/api/schedules", body(&work, &[preset])).await;
    for _ in 0..21 {
        assert_eq!(
            request(&pool, "POST", "/api/schedules", body(&work, &[]))
                .await
                .0,
            201
        );
    }
    let query = "/api/schedules?date=2028-02-29&limit=20";
    let (_, page) = request(&pool, "GET", query, Value::Null).await;
    let revision = page["revision"].as_i64().unwrap();
    let next = format!("{query}&offset=20&revision={revision}");
    assert_eq!(
        request(&pool, "GET", &next, Value::Null).await.1["items"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    let id = first["id"].as_str().unwrap();
    let path = format!("/api/schedules/{id}");
    request(&pool, "PATCH", &path, json!({"notes":"changed"})).await;
    let (code, error) = request(&pool, "GET", &next, Value::Null).await;
    assert_eq!(code, 409);
    assert_eq!(error["error"]["code"], "SCHEDULE_LIST_CHANGED");
    for (route, changes) in [
        (path.clone(), json!({"start_time":"08:00"})),
        (
            format!(
                "/api/schedule-tasks/{}",
                first["tasks"][0]["id"].as_str().unwrap()
            ),
            json!({"execution_notes":"changed"}),
        ),
        (
            format!(
                "/api/schedule-task-items/{}",
                first["tasks"][0]["items"][0]["id"].as_str().unwrap()
            ),
            json!({"value":true}),
        ),
    ] {
        let (_, page) = request(&pool, "GET", query, Value::Null).await;
        let revision = page["revision"].as_i64().unwrap();
        assert_eq!(request(&pool, "PATCH", &route, changes).await.0, 200);
        assert_eq!(
            request(
                &pool,
                "GET",
                &format!("{query}&revision={revision}"),
                Value::Null
            )
            .await
            .0,
            409
        );
    }
    let (_, page) = request(&pool, "GET", query, Value::Null).await;
    let revision = page["revision"].as_i64().unwrap();
    assert_eq!(
        request(&pool, "PATCH", &path, json!({"start_time":"invalid"}))
            .await
            .0,
        400
    );
    assert_eq!(
        request(
            &pool,
            "GET",
            &format!("{query}&revision={revision}"),
            Value::Null
        )
        .await
        .0,
        200
    );
    let other = "00000000-0000-4000-8000-000000000099";
    sqlx::query("INSERT INTO users(id,display_name) VALUES(?,'Other')")
        .bind(other)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO schedule_revisions(user_id,revision) VALUES(?,100)")
        .bind(other)
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(
        request(
            &pool,
            "GET",
            &format!("{query}&revision={revision}"),
            Value::Null
        )
        .await
        .0,
        200
    );
}

#[tokio::test]
async fn reminders_save_validate_reschedule_and_filter() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("reminders.sqlite3"))
        .await
        .unwrap();
    let work = create(&pool, "entities", "Reminder work").await;
    let (status, saved) = request(&pool, "POST", "/api/schedules", body(&work, &[])).await;
    assert_eq!(status, 201);
    assert_eq!(saved["reminder_enabled"], false);
    assert_eq!(saved["reminder_value"], 15);
    let id = saved["id"].as_str().unwrap();
    let uri = format!("/api/schedules/{id}");
    let (status, saved) = request(
        &pool,
        "PATCH",
        &uri,
        json!({"reminder_enabled":true,"reminder_value":1,"reminder_unit":"hours"}),
    )
    .await;
    assert_eq!(status, 200);
    assert_eq!(saved["reminder_unit"], "hours");
    let times: (i64, i64) =
        sqlx::query_as("SELECT reminder_at,reminder_start_at FROM schedules WHERE id=?")
            .bind(id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(times.1 - times.0, 3600);
    assert_eq!(
        times.1,
        chrono::DateTime::parse_from_rfc3339("2028-02-29T00:00:00Z")
            .unwrap()
            .timestamp()
    );
    assert_eq!(
        request(&pool, "PATCH", &uri, json!({"start_time":"09:30"}))
            .await
            .0,
        200
    );
    let changed: i64 = sqlx::query_scalar("SELECT reminder_at FROM schedules WHERE id=?")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(changed - times.0, 1800);
    for invalid in [
        json!({"reminder_value":0}),
        json!({"reminder_value":1.5}),
        json!({"reminder_unit":"months"}),
        json!({"reminder_value":53,"reminder_unit":"weeks"}),
        json!({"scheduled_date":"2026-03-08","end_date":"2026-03-08","start_time":"02:30","end_time":"04:00","time_zone":"America/New_York"}),
    ] {
        assert_eq!(request(&pool, "PATCH", &uri, invalid).await.0, 400);
    }
    sqlx::query("UPDATE schedules SET reminder_at=unixepoch('now')-10,reminder_start_at=unixepoch('now')+3600 WHERE id=?").bind(id).execute(&pool).await.unwrap();
    assert_eq!(
        request(&pool, "GET", "/api/reminders", Value::Null)
            .await
            .1
            .as_array()
            .unwrap()
            .len(),
        1
    );
    for status in ["completed", "cancelled"] {
        sqlx::query("UPDATE schedules SET status=? WHERE id=?")
            .bind(status)
            .bind(id)
            .execute(&pool)
            .await
            .unwrap();
        assert!(
            request(&pool, "GET", "/api/reminders", Value::Null)
                .await
                .1
                .as_array()
                .unwrap()
                .is_empty()
        );
    }
    sqlx::query(
        "UPDATE schedules SET status='planned',reminder_start_at=unixepoch('now')-1 WHERE id=?",
    )
    .bind(id)
    .execute(&pool)
    .await
    .unwrap();
    assert!(
        request(&pool, "GET", "/api/reminders", Value::Null)
            .await
            .1
            .as_array()
            .unwrap()
            .is_empty()
    );
    assert_eq!(
        request(&pool, "PATCH", &uri, json!({"reminder_enabled":false}))
            .await
            .0,
        200
    );
    let due: Option<i64> = sqlx::query_scalar("SELECT reminder_at FROM schedules WHERE id=?")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(due, None);
}

#[tokio::test]
async fn unmanaged_names_are_private_reused_and_promoted_atomically() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("unmanaged.sqlite3"))
        .await
        .unwrap();
    let input = json!({"entity_name":" Loose Work ","task_preset_ids":[{"name":"Loose Task"}],"scheduled_date":"2028-02-29","start_time":"09:00","end_time":"10:00","time_zone":"Asia/Tokyo","notes":"schedule memo","task_customizations":{"name:Loose Task":{"execution_notes":"task memo"}}});
    let (status, first) = request(&pool, "POST", "/api/schedules", input.clone()).await;
    assert_eq!(status, 201, "{first}");
    let (status, second) = request(&pool, "POST", "/api/schedules", input.clone()).await;
    assert_eq!(status, 201);
    assert_eq!(first["entity_id"], second["entity_id"]);
    assert_eq!(
        first["tasks"][0]["source_task_preset_id"],
        second["tasks"][0]["source_task_preset_id"]
    );
    for url in ["/api/entities?q=Loose", "/api/task-presets?q=Loose"] {
        assert_eq!(request(&pool, "GET", url, Value::Null).await.1["total"], 0);
    }
    let suggestions = request(
        &pool,
        "GET",
        "/api/unmanaged-presets/work?q=Loose",
        Value::Null,
    )
    .await
    .1;
    assert_eq!(suggestions.as_array().unwrap().len(), 1);
    let task_id = first["tasks"][0]["id"].as_str().unwrap();
    assert_eq!(
        request(
            &pool,
            "POST",
            &format!("/api/schedule-tasks/{task_id}/complete"),
            json!({})
        )
        .await
        .0,
        200
    );
    let (status, work)=request(&pool,"POST","/api/entities",json!({"name":"loose work","custom_fields":[{"name":"Site","value":"New address"}],"general_notes":"new work details"})).await;
    assert_eq!(status, 201, "{work}");
    assert_eq!(work["id"], first["entity_id"]);
    let (status, task)=request(&pool,"POST","/api/task-presets",json!({"name":"Loose Task","default_notes":"new task details","items":[{"position":0,"label":"Check","item_type":"checkbox","default_value":true}]})).await;
    assert_eq!(status, 201, "{task}");
    assert_eq!(task["id"], first["tasks"][0]["source_task_preset_id"]);
    for original in [&first, &second] {
        let url = format!("/api/schedules/{}", original["id"].as_str().unwrap());
        let updated = request(&pool, "GET", &url, Value::Null).await.1;
        assert_eq!(
            updated["entity_snapshot"]["general_notes"],
            "new work details"
        );
        assert_eq!(
            updated["entity_snapshot"]["custom_fields"][0]["value"],
            "New address"
        );
        assert_eq!(updated["notes"], "schedule memo");
        assert_eq!(updated["tasks"][0]["id"], original["tasks"][0]["id"]);
        assert_eq!(updated["tasks"][0]["execution_notes"], "task memo");
        assert_eq!(
            updated["tasks"][0]["default_notes_snapshot"],
            "new task details"
        );
        assert_eq!(updated["tasks"][0]["items"][0]["completed"], true);
        assert_eq!(
            updated["tasks"][0]["status"],
            if original == &first {
                "completed"
            } else {
                "pending"
            }
        );
        let item_id = updated["tasks"][0]["items"][0]["id"].as_str().unwrap();
        assert_eq!(
            request(
                &pool,
                "PATCH",
                &format!("/api/schedule-task-items/{item_id}"),
                json!({"value":false})
            )
            .await
            .0,
            200
        );
    }
    assert_eq!(
        request(&pool, "GET", "/api/entities?q=Loose", Value::Null)
            .await
            .1["total"],
        1
    );
    assert_eq!(
        request(
            &pool,
            "GET",
            "/api/unmanaged-presets/work?q=Loose",
            Value::Null
        )
        .await
        .1,
        json!([])
    );
    let (_, third) = request(&pool, "POST", "/api/schedules", input).await;
    assert_ne!(third["entity_id"], work["id"]);
    assert_ne!(
        third["tasks"][0]["source_task_preset_id"],
        first["tasks"][0]["source_task_preset_id"]
    );
    assert_eq!(third["entity_snapshot"]["general_notes"], "");
    assert_eq!(third["tasks"][0]["default_notes_snapshot"], "");
    let (_, selected) = request(&pool, "POST", "/api/schedules", json!({
        "entity_id": work["id"],
        "task_preset_ids": [first["tasks"][0]["source_task_preset_id"]],
        "scheduled_date": "2028-02-29", "start_time": "09:00", "end_time": "10:00", "time_zone": "Asia/Tokyo"
    })).await;
    assert_eq!(selected["entity_id"], work["id"]);
    assert_eq!(
        selected["entity_snapshot"]["general_notes"],
        "new work details"
    );
    assert_eq!(
        selected["tasks"][0]["default_notes_snapshot"],
        "new task details"
    );
    let work_url = format!("/api/entities/{}", work["id"].as_str().unwrap());
    request(
        &pool,
        "PATCH",
        &work_url,
        json!({"general_notes":"later change"}),
    )
    .await;
    let url = format!("/api/schedules/{}", first["id"].as_str().unwrap());
    assert_eq!(
        request(&pool, "GET", &url, Value::Null).await.1["entity_snapshot"]["general_notes"],
        "new work details"
    );
    let mut failed = json!({"entity_name":"Rollback Work","task_preset_ids":[{"name":"Rollback Task"},"bad-id"],"scheduled_date":"2028-02-29","start_time":"09:00","end_time":"10:00","time_zone":"Asia/Tokyo"});
    assert_eq!(
        request(&pool, "POST", "/api/schedules", failed.clone())
            .await
            .0,
        400
    );
    for kind in ["work", "task"] {
        assert_eq!(
            request(
                &pool,
                "GET",
                &format!("/api/unmanaged-presets/{kind}?q=Rollback"),
                Value::Null
            )
            .await
            .1,
            json!([])
        );
    }
    failed["task_preset_ids"] = json!([]);
    let (_, schedule) = request(&pool, "POST", "/api/schedules", failed).await;
    let url = format!("/api/schedules/{}/tasks", schedule["id"].as_str().unwrap());
    assert_eq!(
        request(
            &pool,
            "POST",
            &url,
            json!({"task_preset_id":{"name":"Added later"}})
        )
        .await
        .0,
        200
    );
}

#[tokio::test]
async fn unmanaged_promotion_rolls_back_and_name_queries_are_indexed_and_owner_scoped() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("unmanaged-atomic.sqlite3"))
        .await
        .unwrap();
    let owner = "00000000-0000-4000-8000-000000000001";
    let other = "00000000-0000-4000-8000-000000000002";
    sqlx::query("INSERT INTO users(id,display_name) VALUES(?,'Other')")
        .bind(other)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO entities(id,user_id,name,unmanaged) VALUES('foreign',?,'Foreign secret',1)",
    )
    .bind(other)
    .execute(&pool)
    .await
    .unwrap();
    assert_eq!(
        request(
            &pool,
            "GET",
            "/api/unmanaged-presets/work?q=Foreign",
            Value::Null
        )
        .await
        .1,
        json!([])
    );
    let (_, schedule)=request(&pool,"POST","/api/schedules",json!({"entity_name":"100%_!","task_preset_ids":[{"name":"Atomic"}],"scheduled_date":"2028-02-29","start_time":"09:00","end_time":"10:00","time_zone":"Asia/Tokyo"})).await;
    let hidden = schedule["tasks"][0]["source_task_preset_id"]
        .as_str()
        .unwrap();
    assert_eq!(
        request(
            &pool,
            "GET",
            &format!("/api/task-presets/{hidden}"),
            Value::Null
        )
        .await
        .0,
        404
    );
    assert_eq!(
        request(
            &pool,
            "PATCH",
            &format!("/api/task-presets/{hidden}"),
            json!({"name":"changed"})
        )
        .await
        .0,
        404
    );
    assert_eq!(
        request(
            &pool,
            "GET",
            "/api/unmanaged-presets/work?q=100%25_!",
            Value::Null
        )
        .await
        .1
        .as_array()
        .unwrap()
        .len(),
        1
    );
    sqlx::query("CREATE TRIGGER reject_promoted_item BEFORE INSERT ON schedule_task_items BEGIN SELECT RAISE(ABORT,'test'); END").execute(&pool).await.unwrap();
    let (status,_)=request(&pool,"POST","/api/task-presets",json!({"name":"Atomic","items":[{"position":0,"label":"Required","item_type":"text","required":true}]})).await;
    assert_eq!(status, 503);
    assert_eq!(
        request(&pool, "GET", "/api/task-presets?q=Atomic", Value::Null)
            .await
            .1["total"],
        0
    );
    let uri = format!("/api/schedules/{}", schedule["id"].as_str().unwrap());
    assert_eq!(request(&pool, "GET", &uri, Value::Null).await.1, schedule);
    let suggestions = request(
        &pool,
        "GET",
        "/api/unmanaged-presets/task?q=Atomic",
        Value::Null,
    )
    .await
    .1;
    assert_eq!(suggestions[0]["id"], hidden);
    for table in ["entities", "task_presets"] {
        let plan: Vec<(i64,i64,i64,String)>=sqlx::query_as(&format!("EXPLAIN QUERY PLAN SELECT id,name FROM {table} WHERE user_id=? AND unmanaged=1 AND name LIKE ? ESCAPE '!' ORDER BY name COLLATE NOCASE,id LIMIT 10"))
            .bind(owner).bind("At%").fetch_all(&pool).await.unwrap();
        assert!(
            plan.iter().any(|row| row.3.contains("USING INDEX")
                && row.3.contains("name>?")
                && row.3.contains("name<?")),
            "{plan:?}"
        );
    }
}
#[tokio::test]
async fn completed_promoted_task_allows_metadata_edits_without_revalidating_completion() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("app.sqlite3")).await.unwrap();
    let (code, schedule) = request(&pool, "POST", "/api/schedules", json!({
        "entity_name":"history work", "task_preset_ids":[{"name":"history task"}],
        "scheduled_date":"2026-09-26", "start_time":"09:00", "end_time":"10:00", "time_zone":"Asia/Tokyo"
    })).await;
    assert_eq!(code, 201);
    let url = format!(
        "/api/schedule-tasks/{}",
        schedule["tasks"][0]["id"].as_str().unwrap()
    );
    let (code, _) = request(&pool, "PATCH", &url, json!({"status":"completed"})).await;
    assert_eq!(code, 200);
    let task_id = schedule["tasks"][0]["id"].as_str().unwrap();
    let completed: (String, String) =
        sqlx::query_as("SELECT started_at,completed_at FROM schedule_tasks WHERE id=?")
            .bind(task_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(request(&pool, "POST", "/api/task-presets", json!({
        "name":"history task", "items":[{"label":"new required", "position":0, "item_type":"checkbox", "required":true}]
    })).await.0, 201);
    for patch in [
        json!({"execution_notes":"historical memo"}),
        json!({"name":"history [count]", "parameters":{"count":"2"}}),
        json!({"parameters":{"count":"3"}}),
    ] {
        let (code, updated) = request(&pool, "PATCH", &url, patch).await;
        assert_eq!(code, 200, "{updated}");
        assert_eq!(updated["tasks"][0]["status"], "completed");
        assert_eq!(updated["tasks"][0]["execution_notes"], "historical memo");
        let timestamps: (String, String) =
            sqlx::query_as("SELECT started_at,completed_at FROM schedule_tasks WHERE id=?")
                .bind(task_id)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(timestamps, completed);
    }
    assert_eq!(
        request(&pool, "PATCH", &url, json!({"status":"pending"}))
            .await
            .0,
        200
    );
    assert_eq!(
        request(&pool, "PATCH", &url, json!({"status":"completed"}))
            .await
            .0,
        409
    );
}
