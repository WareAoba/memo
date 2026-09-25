use axum::{
    body::{Body, to_bytes},
    http::Request,
};
use preset_execution_api::{app, db};
use serde_json::{Value, json};
use sqlx::SqlitePool;
use tower::ServiceExt;
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
async fn fixture(pool: &SqlitePool) -> Value {
    let w = create(pool, "entities", "Work").await;
    let (status,p) = request(pool,"POST","/api/task-presets",json!({"name":"Task","items":[{"position":0,"label":"Check","item_type":"checkbox","required":true},{"position":1,"label":"Text","item_type":"text","required":true},{"position":2,"label":"Number","item_type":"number","required":true,"unit":"kg"}]})).await;
    assert_eq!(status, 201);
    request(
        pool,
        "POST",
        "/api/schedules",
        body(&w, &[p["id"].as_str().unwrap().into()]),
    )
    .await
    .1
}
fn task_path(s: &Value) -> String {
    format!(
        "/api/schedule-tasks/{}",
        s["tasks"][0]["id"].as_str().unwrap()
    )
}
fn item_path(s: &Value, index: usize) -> String {
    format!(
        "/api/schedule-task-items/{}",
        s["tasks"][0]["items"][index]["id"].as_str().unwrap()
    )
}
fn schedule_path(s: &Value) -> String {
    format!("/api/schedules/{}", s["id"].as_str().unwrap())
}

#[tokio::test]
async fn parameterized_tasks_and_memos_are_independent_persistent_snapshots() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("app.sqlite3");
    let pool = db::connect(&path).await.unwrap();
    let work = create(&pool, "entities", "언어 공부").await;
    let preset = create(&pool, "task-presets", "단어 [n=5]개 외우기 · [n]개 복습").await;
    let mut customized = body(&work, std::slice::from_ref(&preset));
    customized["notes"] = json!("오늘의 워크 메모");
    customized["task_customizations"] =
        json!({ preset.clone(): {"parameters":{"n":"10"}, "execution_notes":"어려운 단어 위주"} });
    let (code, first) = request(&pool, "POST", "/api/schedules", customized).await;
    assert_eq!(code, 201);
    assert_eq!(
        first["tasks"][0]["name_snapshot"],
        "단어 10개 외우기 · 10개 복습"
    );
    assert_eq!(first["tasks"][0]["parameter_values"], json!({"n":"10"}));
    let (code, second) = request(
        &pool,
        "POST",
        "/api/schedules",
        body(&work, std::slice::from_ref(&preset)),
    )
    .await;
    assert_eq!(code, 201);
    assert_eq!(
        second["tasks"][0]["name_snapshot"],
        "단어 5개 외우기 · 5개 복습"
    );
    let (code, changed) = request(
        &pool,
        "PATCH",
        &task_path(&first),
        json!({"parameters":{"n":"20"},"execution_notes":"완료 후 기록"}),
    )
    .await;
    assert_eq!(code, 200);
    assert_eq!(
        changed["tasks"][0]["name_snapshot"],
        "단어 20개 외우기 · 20개 복습"
    );
    assert_eq!(changed["notes"], "오늘의 워크 메모");
    assert_eq!(
        request(
            &pool,
            "PATCH",
            &task_path(&first),
            json!({"status":"completed"})
        )
        .await
        .0,
        200
    );
    assert_eq!(
        request(
            &pool,
            "PATCH",
            &task_path(&first),
            json!({"execution_notes":"완료한 뒤에도 수정"})
        )
        .await
        .0,
        200
    );
    let source = request(
        &pool,
        "GET",
        &format!("/api/task-presets/{preset}"),
        Value::Null,
    )
    .await
    .1;
    assert_eq!(source["name"], "단어 [n=5]개 외우기 · [n]개 복습");
    assert_eq!(source["default_notes"], "");
    let untouched = request(&pool, "GET", &schedule_path(&second), Value::Null)
        .await
        .1;
    assert_eq!(
        untouched["tasks"][0]["name_snapshot"],
        "단어 5개 외우기 · 5개 복습"
    );
    assert_eq!(untouched["tasks"][0]["execution_notes"], "");
    pool.close().await;
    let pool = db::connect(&path).await.unwrap();
    let persisted = request(&pool, "GET", &schedule_path(&first), Value::Null)
        .await
        .1;
    assert_eq!(persisted["tasks"][0]["parameter_values"]["n"], "20");
    assert_eq!(
        persisted["tasks"][0]["execution_notes"],
        "완료한 뒤에도 수정"
    );
    let (code, added) = request(
        &pool,
        "POST",
        &format!("{}/tasks", schedule_path(&second)),
        json!({"task_preset_id":preset,"parameters":{"n":"7"},"execution_notes":"추가한 과제"}),
    )
    .await;
    assert_eq!(code, 200);
    assert_eq!(
        added["tasks"][1]["name_snapshot"],
        "단어 7개 외우기 · 7개 복습"
    );
    pool.close().await;
}

#[tokio::test]
async fn invalid_parameters_roll_back_creation_and_edits() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("app.sqlite3")).await.unwrap();
    let work = create(&pool, "entities", "학습").await;
    let preset = create(&pool, "task-presets", "[과목] [n]개").await;
    for parameters in [
        json!({}),
        json!({"과목":"영어","n":""}),
        json!({"과목":"영어","n":10}),
        json!({"과목":"영어","n":"10","extra":"x"}),
        json!({"과목":"영어","n":"x".repeat(81)}),
    ] {
        let mut value = body(&work, std::slice::from_ref(&preset));
        value["task_customizations"] = json!({preset.clone():{"parameters":parameters}});
        assert_eq!(request(&pool, "POST", "/api/schedules", value).await.0, 400);
    }
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM schedules")
            .fetch_one(&pool)
            .await
            .unwrap(),
        0
    );
    let mut value = body(&work, std::slice::from_ref(&preset));
    value["task_customizations"] = json!({preset.clone():{"parameters":{"과목":"영어","n":"10"}}});
    let (code, schedule) = request(&pool, "POST", "/api/schedules", value).await;
    assert_eq!(code, 201);
    assert_eq!(
        request(
            &pool,
            "PATCH",
            &task_path(&schedule),
            json!({"parameters":{"n":""},"execution_notes":"should not save"})
        )
        .await
        .0,
        400
    );
    let saved = request(&pool, "GET", &schedule_path(&schedule), Value::Null)
        .await
        .1;
    assert_eq!(saved["tasks"][0]["name_snapshot"], "영어 10개");
    assert_eq!(saved["tasks"][0]["execution_notes"], "");
    pool.close().await;
}
async fn fill(pool: &SqlitePool, s: &Value) {
    for (i, v) in [json!(true), json!("record"), json!(0)]
        .into_iter()
        .enumerate()
    {
        assert_eq!(
            request(pool, "PATCH", &item_path(s, i), json!({"value":v}))
                .await
                .0,
            200
        );
    }
}

async fn default_fixture(pool: &SqlitePool) -> Value {
    let work = create(pool, "entities", "Defaults").await;
    let cases = [
        ("checkbox", json!(true), true),
        ("checkbox", json!(false), false),
        ("checkbox", Value::Null, false),
        ("text", json!("record"), true),
        ("text", json!(" \t\n\u{a0}\u{3000}"), false),
        ("text", json!(""), false),
        ("text", Value::Null, false),
        ("number", json!(0), true),
        ("number", json!(-2.5), true),
        ("number", Value::Null, false),
    ];
    let items: Vec<Value> = cases.into_iter().enumerate().map(|(position, (kind, value, satisfied))| {
        json!({"position":position,"label":format!("Item {position}"),"item_type":kind,"default_value":value,"required":satisfied})
    }).collect();
    let (code, preset) = request(
        pool,
        "POST",
        "/api/task-presets",
        json!({"name":"Defaults","items":items}),
    )
    .await;
    assert_eq!(code, 201);
    let (code, schedule) = request(
        pool,
        "POST",
        "/api/schedules",
        body(&work, &[preset["id"].as_str().unwrap().into()]),
    )
    .await;
    assert_eq!(code, 201);
    schedule
}

#[tokio::test]
async fn defaults_initialize_item_completion_without_starting_tasks() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("db");
    let pool = db::connect(&path).await.unwrap();
    let schedule = default_fixture(&pool).await;
    assert_eq!(schedule["status"], "planned");
    assert_eq!(schedule["tasks"][0]["status"], "pending");
    for (index, expected) in [
        true, false, false, true, false, false, false, true, true, false,
    ]
    .into_iter()
    .enumerate()
    {
        let item = &schedule["tasks"][0]["items"][index];
        assert_eq!(item["completed"], expected, "item {index}");
        let stamps: (Option<String>, String) =
            sqlx::query_as("SELECT completed_at,created_at FROM schedule_task_items WHERE id=?")
                .bind(item["id"].as_str())
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(stamps.0, expected.then_some(stamps.1));
    }
    let started: Option<String> =
        sqlx::query_scalar("SELECT started_at FROM schedule_tasks WHERE id=?")
            .bind(schedule["tasks"][0]["id"].as_str())
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(started.is_none());
    let (code, done) = request(
        &pool,
        "PATCH",
        &task_path(&schedule),
        json!({"status":"completed"}),
    )
    .await;
    assert_eq!(code, 200);
    assert_eq!(done["tasks"][0]["items"], schedule["tasks"][0]["items"]);
    pool.close().await;
    let pool = db::connect(&path).await.unwrap();
    assert_eq!(
        request(&pool, "GET", &schedule_path(&schedule), Value::Null)
            .await
            .1,
        done
    );
}

#[tokio::test]
async fn completion_repair_preserves_values_states_and_existing_timestamps() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("db")).await.unwrap();
    let schedule = default_fixture(&pool).await;
    request(
        &pool,
        "PATCH",
        &task_path(&schedule),
        json!({"status":"completed"}),
    )
    .await;
    // Simulate records created by the old code, including an already recorded completion.
    sqlx::query("UPDATE schedule_task_items SET completed=0,completed_at=NULL,updated_at='2026-09-20T12:00:00.000Z' WHERE position<>0")
        .execute(&pool).await.unwrap();
    let (_, before) = request(&pool, "GET", &schedule_path(&schedule), Value::Null).await;
    let preserved: Option<String> =
        sqlx::query_scalar("SELECT completed_at FROM schedule_task_items WHERE position=0")
            .fetch_one(&pool)
            .await
            .unwrap();
    let migration = include_str!("../migrations/202609240008_item_default_completion.sql");
    sqlx::raw_sql(migration).execute(&pool).await.unwrap();
    let (_, after) = request(&pool, "GET", &schedule_path(&schedule), Value::Null).await;
    let mut expected = before;
    for index in [3, 7, 8] {
        expected["tasks"][0]["items"][index]["completed"] = json!(true);
    }
    assert_eq!(after, expected);
    let stamps: Vec<(i64, Option<String>)> =
        sqlx::query_as("SELECT position,completed_at FROM schedule_task_items ORDER BY position")
            .fetch_all(&pool)
            .await
            .unwrap();
    for (position, stamp) in &stamps {
        let expected = if *position == 0 {
            preserved.clone()
        } else if [3, 7, 8].contains(position) {
            Some("2026-09-20T12:00:00.000Z".into())
        } else {
            None
        };
        assert_eq!(*stamp, expected);
    }
    sqlx::raw_sql(migration).execute(&pool).await.unwrap();
    let again: Vec<(i64, Option<String>)> =
        sqlx::query_as("SELECT position,completed_at FROM schedule_task_items ORDER BY position")
            .fetch_all(&pool)
            .await
            .unwrap();
    assert_eq!(stamps, again);
}
#[tokio::test]
async fn required_fields_completion_reopen_and_timestamps_are_persistent() {
    let dir = tempfile::tempdir().unwrap();
    let dbpath = dir.path().join("db");
    let pool = db::connect(&dbpath).await.unwrap();
    let s = fixture(&pool).await;
    let t = task_path(&s);
    assert_eq!(s["status"], "planned");
    let (code, error) = request(&pool, "POST", &format!("{t}/complete"), json!({})).await;
    assert_eq!(code, 409);
    assert_eq!(error["error"]["code"], "REQUIREMENTS_INCOMPLETE");
    assert_eq!(
        request(&pool, "POST", &format!("{t}/start"), json!({}))
            .await
            .1["status"],
        "in_progress"
    );
    fill(&pool, &s).await;
    let (code, done) = request(&pool, "POST", &format!("{t}/complete"), json!({})).await;
    assert_eq!(code, 200);
    assert_eq!(done["status"], "completed");
    let stamp: String = sqlx::query_scalar("SELECT completed_at FROM schedule_tasks WHERE id=?")
        .bind(s["tasks"][0]["id"].as_str())
        .fetch_one(&pool)
        .await
        .unwrap();
    request(&pool, "POST", &format!("{t}/complete"), json!({})).await;
    let again: String = sqlx::query_scalar("SELECT completed_at FROM schedule_tasks WHERE id=?")
        .bind(s["tasks"][0]["id"].as_str())
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(stamp, again);
    let (_, opened) = request(&pool, "PATCH", &item_path(&s, 1), json!({"value":"  "})).await;
    assert_eq!(opened["status"], "in_progress");
    assert_eq!(opened["tasks"][0]["status"], "in_progress");
    let cleared: Option<String> =
        sqlx::query_scalar("SELECT completed_at FROM schedule_tasks WHERE id=?")
            .bind(s["tasks"][0]["id"].as_str())
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(cleared.is_none());
    assert_eq!(
        request(&pool, "PATCH", &t, json!({"status":"completed"}))
            .await
            .0,
        409
    );
    fill(&pool, &s).await;
    request(
        &pool,
        "PATCH",
        &t,
        json!({"status":"completed","execution_notes":"kept"}),
    )
    .await;
    let (_, undo) = request(&pool, "PATCH", &t, json!({"status":"pending"})).await;
    assert_eq!(undo["tasks"][0]["execution_notes"], "kept");
    assert_eq!(undo["tasks"][0]["items"][2]["value_number"], 0.0);
    pool.close().await;
    let pool = db::connect(&dbpath).await.unwrap();
    let (_, loaded) = request(&pool, "GET", &schedule_path(&s), Value::Null).await;
    assert_eq!(loaded["tasks"][0]["status"], "pending");
    assert_eq!(loaded["tasks"][0]["execution_notes"], "kept");
    assert_eq!(
        loaded["tasks"][0]["items"][0]["definition"],
        s["tasks"][0]["items"][0]["definition"]
    );
}
#[tokio::test]
async fn skip_cancel_resume_and_empty_schedule_rules() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("db")).await.unwrap();
    let s = fixture(&pool).await;
    let status = format!("{}/status", schedule_path(&s));
    assert_eq!(
        request(&pool, "PATCH", &status, json!({"status":"completed"}))
            .await
            .0,
        409
    );
    assert_eq!(
        request(&pool, "PATCH", &task_path(&s), json!({"status":"skipped"}))
            .await
            .1["status"],
        "completed"
    );
    request(&pool, "PATCH", &status, json!({"status":"cancelled"})).await;
    assert_eq!(
        request(&pool, "PATCH", &task_path(&s), json!({"status":"pending"}))
            .await
            .0,
        409
    );
    assert_eq!(
        request(&pool, "PATCH", &item_path(&s, 0), json!({"value":true}))
            .await
            .0,
        409
    );
    assert_eq!(
        request(&pool, "PATCH", &status, json!({"status":"completed"}))
            .await
            .0,
        409
    );
    assert_eq!(
        request(&pool, "PATCH", &status, json!({"status":"planned"}))
            .await
            .1["status"],
        "completed"
    );
    assert_eq!(
        request(&pool, "PATCH", &item_path(&s, 0), json!({"value":true}))
            .await
            .1["tasks"][0]["status"],
        "in_progress"
    );
    assert_eq!(
        request(
            &pool,
            "PATCH",
            &task_path(&s),
            json!({"execution_notes":"allowed"})
        )
        .await
        .0,
        200
    );
    let w = create(&pool, "entities", "Empty").await;
    let (_, empty) = request(&pool, "POST", "/api/schedules", body(&w, &[])).await;
    assert_eq!(
        request(
            &pool,
            "PATCH",
            &format!("{}/status", schedule_path(&empty)),
            json!({"status":"completed"})
        )
        .await
        .1["status"],
        "completed"
    );
}
#[tokio::test]
async fn invalid_types_definitions_and_failed_writes_do_not_change_records() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("db")).await.unwrap();
    let s = fixture(&pool).await;
    for (i, v) in [
        (0, json!("true")),
        (1, json!(false)),
        (2, json!("12")),
        (1, json!("x".repeat(5001))),
    ] {
        assert_eq!(
            request(&pool, "PATCH", &item_path(&s, i), json!({"value":v}))
                .await
                .0,
            400
        );
    }
    for invalid in [
        json!({"status":"x"}),
        json!({"name_snapshot":"overwrite"}),
        json!({"execution_notes":null}),
        json!({"execution_notes":"x".repeat(5001)}),
        json!({"user_id":"x"}),
    ] {
        assert_eq!(
            request(&pool, "PATCH", &task_path(&s), invalid).await.0,
            400
        );
    }
    assert_eq!(
        request(
            &pool,
            "PATCH",
            &item_path(&s, 0),
            json!({"value":true,"definition":{}})
        )
        .await
        .0,
        400
    );
    assert_eq!(
        request(
            &pool,
            "PATCH",
            "/api/schedule-tasks/bad",
            json!({"status":"completed"})
        )
        .await
        .0,
        400
    );
    assert_eq!(
        request(
            &pool,
            "POST",
            &format!("{}/complete", task_path(&s)),
            json!({"status":"skipped"})
        )
        .await
        .0,
        400
    );
    sqlx::raw_sql("CREATE TRIGGER reject_execution BEFORE UPDATE ON schedules BEGIN SELECT RAISE(ABORT,'test failure'); END;").execute(&pool).await.unwrap();
    assert_eq!(
        request(&pool, "PATCH", &item_path(&s, 0), json!({"value":true}))
            .await
            .0,
        503
    );
    let (_, after) = request(&pool, "GET", &schedule_path(&s), Value::Null).await;
    assert_eq!(after, s);
}
#[tokio::test]
async fn foreign_execution_ids_are_hidden_and_concurrent_writes_merge() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("db")).await.unwrap();
    let s = fixture(&pool).await;
    let p1 = item_path(&s, 0);
    let p2 = item_path(&s, 1);
    let (a, b) = tokio::join!(
        request(&pool, "PATCH", &p1, json!({"value":true})),
        request(&pool, "PATCH", &p2, json!({"value":"parallel"}))
    );
    assert_eq!(a.0, 200);
    assert_eq!(b.0, 200);
    let (_, after) = request(&pool, "GET", &schedule_path(&s), Value::Null).await;
    assert_eq!(after["tasks"][0]["items"][0]["value_boolean"], true);
    assert_eq!(after["tasks"][0]["items"][1]["value_text"], "parallel");
    // A separate owner's full schedule graph exercises actual ownership joins.
    let other = "00000000-0000-0000-0000-000000000002";
    sqlx::query("INSERT INTO users(id,display_name) VALUES(?,'Other')")
        .bind(other)
        .execute(&pool)
        .await
        .unwrap();
    let w = uuid::Uuid::new_v4().to_string();
    let p = uuid::Uuid::new_v4().to_string();
    let sch = uuid::Uuid::new_v4().to_string();
    let t = uuid::Uuid::new_v4().to_string();
    let i = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO entities(id,user_id,name) VALUES(?,?,'Other')")
        .bind(&w)
        .bind(other)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO task_presets(id,user_id,name) VALUES(?,?,'Other')")
        .bind(&p)
        .bind(other)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO schedules(id,user_id,entity_id,title,scheduled_date,end_date,start_time,end_time,time_zone) VALUES(?,?,?,'Other','2026-09-24','2026-09-24','09:00','10:00','Asia/Tokyo')").bind(&sch).bind(other).bind(&w).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO schedule_tasks(id,schedule_id,user_id,source_task_preset_id,source_task_preset_version,name_snapshot,default_notes_snapshot,position) VALUES(?,?,?,?,1,'Other','',0)").bind(&t).bind(&sch).bind(other).bind(&p).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO schedule_task_items(id,schedule_task_id,source_preset_item_id,position,definition) VALUES(?,?,?,0,'{}')").bind(&i).bind(&t).bind(&p).execute(&pool).await.unwrap();
    for path in [
        format!("/api/schedules/{sch}"),
        format!("/api/schedule-tasks/{t}"),
    ] {
        assert_eq!(request(&pool, "DELETE", &path, json!({})).await.0, 404);
    }
    assert_eq!(
        request(
            &pool,
            "POST",
            &format!("/api/schedules/{sch}/reopen"),
            json!({})
        )
        .await
        .0,
        404
    );
    for (path, body) in [
        (
            format!("/api/schedule-tasks/{t}"),
            json!({"status":"completed"}),
        ),
        (
            format!("/api/schedule-task-items/{i}"),
            json!({"value":true}),
        ),
        (
            format!("/api/schedules/{sch}/status"),
            json!({"status":"completed"}),
        ),
    ] {
        assert_eq!(request(&pool, "PATCH", &path, body).await.0, 404);
    }
}
#[tokio::test]
async fn execution_uses_original_definitions_and_does_not_change_other_schedules() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("db")).await.unwrap();
    let first = fixture(&pool).await;
    let source = first["tasks"][0]["source_task_preset_id"].as_str().unwrap();
    let (_, second) = request(
        &pool,
        "POST",
        "/api/schedules",
        body(first["entity_id"].as_str().unwrap(), &[source.into()]),
    )
    .await;
    request(
        &pool,
        "PATCH",
        &format!("/api/task-presets/{source}"),
        json!({"items":[]}),
    )
    .await;
    assert_eq!(
        request(
            &pool,
            "PATCH",
            &task_path(&first),
            json!({"status":"completed","execution_notes":"must roll back"})
        )
        .await
        .0,
        409
    );
    assert_eq!(
        request(&pool, "GET", &schedule_path(&first), Value::Null)
            .await
            .1["tasks"][0]["execution_notes"],
        ""
    );
    fill(&pool, &first).await;
    assert_eq!(
        request(
            &pool,
            "PATCH",
            &task_path(&first),
            json!({"status":"completed"})
        )
        .await
        .0,
        200
    );
    assert_eq!(
        request(&pool, "GET", &schedule_path(&second), Value::Null)
            .await
            .1,
        second
    );
    let (_, cleared) = request(&pool, "PATCH", &item_path(&first, 2), json!({"value":null})).await;
    assert_eq!(cleared["tasks"][0]["items"][2]["value_number"], Value::Null);
    assert_eq!(cleared["tasks"][0]["items"][2]["completed"], false);
    assert_eq!(cleared["tasks"][0]["status"], "in_progress");
}
#[tokio::test]
async fn work_completion_is_atomic_and_keeps_required_inputs() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("db")).await.unwrap();
    let s = fixture(&pool).await;
    let preset = create(&pool, "task-presets", "Extra").await;
    let add = format!("{}/tasks", schedule_path(&s));
    let complete = format!("{}/complete", schedule_path(&s));
    let (code, before) = request(&pool, "POST", &add, json!({"task_preset_id":preset})).await;
    assert_eq!(code, 200);
    assert_eq!(before["tasks"].as_array().unwrap().len(), 2);
    assert_eq!(request(&pool, "POST", &complete, json!({})).await.0, 409);
    assert_eq!(
        request(&pool, "GET", &schedule_path(&s), Value::Null)
            .await
            .1,
        before
    );
    fill(&pool, &s).await;
    let (code, done) = request(&pool, "POST", &complete, json!({})).await;
    assert_eq!(code, 200);
    assert_eq!(done["status"], "completed");
    assert!(
        done["tasks"]
            .as_array()
            .unwrap()
            .iter()
            .all(|t| t["status"] == "completed")
    );
    assert_eq!(done["tasks"][0]["items"][2]["value_number"], 0.0);
    let (code, added) = request(&pool, "POST", &add, json!({"task_preset_id":preset})).await;
    assert_eq!(code, 200);
    assert_eq!(added["status"], "in_progress");
    assert_eq!(added["tasks"][0], done["tasks"][0]);
    assert_eq!(added["tasks"][2]["status"], "pending");
    assert_eq!(
        request(&pool, "POST", &complete, json!({"force":true}))
            .await
            .0,
        400
    );
    let (_, cancelled) = request(
        &pool,
        "PATCH",
        &format!("{}/status", schedule_path(&s)),
        json!({"status":"cancelled"}),
    )
    .await;
    assert_eq!(
        request(&pool, "POST", &add, json!({"task_preset_id":preset}))
            .await
            .0,
        409
    );
    assert_eq!(request(&pool, "POST", &complete, json!({})).await.0, 409);
    assert_eq!(
        request(&pool, "GET", &schedule_path(&s), Value::Null)
            .await
            .1,
        cancelled
    );
}

#[tokio::test]
async fn task_edits_are_local_and_new_writes_roll_back() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("db")).await.unwrap();
    let s = fixture(&pool).await;
    let preset = s["tasks"][0]["source_task_preset_id"].as_str().unwrap();
    let (code, edited) = request(
        &pool,
        "PATCH",
        &task_path(&s),
        json!({"name":"Today only", "execution_notes":"Local note"}),
    )
    .await;
    assert_eq!(code, 200);
    assert_eq!(edited["tasks"][0]["name_snapshot"], "Today only");
    assert_eq!(edited["tasks"][0]["items"], s["tasks"][0]["items"]);
    assert_eq!(
        request(
            &pool,
            "GET",
            &format!("/api/task-presets/{preset}"),
            Value::Null
        )
        .await
        .1["name"],
        "Task"
    );
    for name in [json!(null), json!(" "), json!("x".repeat(201))] {
        assert_eq!(
            request(&pool, "PATCH", &task_path(&s), json!({"name":name}))
                .await
                .0,
            400
        );
    }
    fill(&pool, &s).await;
    let before = request(&pool, "GET", &schedule_path(&s), Value::Null)
        .await
        .1;
    sqlx::raw_sql("CREATE TRIGGER reject_today BEFORE UPDATE ON schedules BEGIN SELECT RAISE(ABORT,'test'); END;").execute(&pool).await.unwrap();
    assert_eq!(
        request(
            &pool,
            "POST",
            &format!("{}/complete", schedule_path(&s)),
            json!({})
        )
        .await
        .0,
        503
    );
    assert_eq!(
        request(
            &pool,
            "POST",
            &format!("{}/tasks", schedule_path(&s)),
            json!({"task_preset_id":preset})
        )
        .await
        .0,
        503
    );
    assert_eq!(
        request(&pool, "GET", &schedule_path(&s), Value::Null)
            .await
            .1,
        before
    );
    sqlx::raw_sql("DROP TRIGGER reject_today;")
        .execute(&pool)
        .await
        .unwrap();
    let other = "00000000-0000-0000-0000-000000000002";
    sqlx::query("INSERT INTO users(id,display_name) VALUES(?,'Other')")
        .bind(other)
        .execute(&pool)
        .await
        .unwrap();
    let foreign = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO task_presets(id,user_id,name) VALUES(?,?,'Foreign')")
        .bind(&foreign)
        .bind(other)
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(
        request(
            &pool,
            "POST",
            &format!("{}/tasks", schedule_path(&s)),
            json!({"task_preset_id":foreign})
        )
        .await
        .0,
        404
    );
    assert_eq!(
        request(
            &pool,
            "POST",
            &format!("/api/schedules/{foreign}/complete"),
            json!({})
        )
        .await
        .0,
        404
    );
}

#[tokio::test]
async fn reopen_and_delete_preserve_sources_and_isolate_other_schedules() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("delete.sqlite3"))
        .await
        .unwrap();
    let work = create(&pool, "entities", "Work").await;
    let preset = create(&pool, "task-presets", "Task").await;
    let another = create(&pool, "task-presets", "Another task").await;
    let (_, first) = request(
        &pool,
        "POST",
        "/api/schedules",
        body(&work, &[preset.clone(), another]),
    )
    .await;
    let (_, second) = request(
        &pool,
        "POST",
        "/api/schedules",
        body(&work, std::slice::from_ref(&preset)),
    )
    .await;
    let path = schedule_path(&first);
    assert_eq!(
        request(&pool, "POST", &format!("{path}/complete"), json!({}))
            .await
            .0,
        200
    );
    let (_, reopened) = request(&pool, "POST", &format!("{path}/reopen"), json!({})).await;
    assert_ne!(reopened["status"], "completed");
    assert!(
        reopened["tasks"]
            .as_array()
            .unwrap()
            .iter()
            .all(|task| task["status"] == "pending")
    );
    let (code, remaining) = request(&pool, "DELETE", &task_path(&first), json!({})).await;
    assert_eq!(code, 200);
    assert_eq!(remaining["tasks"].as_array().unwrap().len(), 1);
    assert_eq!(
        request(&pool, "DELETE", &task_path(&first), json!({}))
            .await
            .0,
        404
    );
    assert_eq!(
        request(
            &pool,
            "POST",
            &format!("{path}/tasks"),
            json!({"task_preset_id":preset})
        )
        .await
        .0,
        200
    );
    assert_eq!(request(&pool, "DELETE", &path, json!({})).await.0, 204);
    assert_eq!(request(&pool, "GET", &path, json!({})).await.0, 404);
    assert_eq!(
        request(&pool, "GET", &schedule_path(&second), json!({}))
            .await
            .1,
        second
    );
    assert_eq!(
        request(
            &pool,
            "GET",
            &format!("/api/task-presets/{preset}"),
            json!({})
        )
        .await
        .0,
        200
    );
    assert_eq!(
        request(&pool, "GET", &format!("/api/entities/{work}"), json!({}))
            .await
            .0,
        200
    );
    let orphan_count:i64=sqlx::query_scalar("SELECT count(*) FROM schedule_task_items WHERE schedule_task_id NOT IN (SELECT id FROM schedule_tasks)").fetch_one(&pool).await.unwrap();
    assert_eq!(orphan_count, 0);
}

#[tokio::test]
async fn midnight_end_is_rejected_but_legacy_notes_can_still_be_edited() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("midnight.sqlite3"))
        .await
        .unwrap();
    let work = create(&pool, "entities", "Clock").await;
    let mut input = body(&work, &[]);
    input["end_date"] = json!("2028-03-01");
    input["end_time"] = json!("00:00");
    assert_eq!(
        request(&pool, "POST", "/api/schedules", input.clone())
            .await
            .0,
        400
    );
    input["end_time"] = json!("00:05");
    let (_, schedule) = request(&pool, "POST", "/api/schedules", input).await;
    let path = schedule_path(&schedule);
    assert_eq!(
        request(&pool, "PATCH", &path, json!({"end_time":"00:00"}))
            .await
            .0,
        400
    );
    sqlx::query("UPDATE schedules SET end_time='00:00' WHERE id=?")
        .bind(schedule["id"].as_str().unwrap())
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(
        request(&pool, "PATCH", &path, json!({"notes":"preserved"}))
            .await
            .0,
        200
    );
}

#[tokio::test]
async fn schedule_deletion_is_atomic_and_cleans_task_photos() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("photos.sqlite3"))
        .await
        .unwrap();
    let schedule = fixture(&pool).await;
    let id = schedule["id"].as_str().unwrap();
    let task = schedule["tasks"][0]["id"].as_str().unwrap();
    let owner: String = sqlx::query_scalar("SELECT user_id FROM schedules WHERE id=?")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    let root = dir.path().join("photos");
    std::fs::create_dir_all(root.join(&owner)).unwrap();
    for (schedule_id, task_id) in [(Some(id), None), (None, Some(task))] {
        let photo = uuid::Uuid::new_v4().to_string();
        sqlx::query("INSERT INTO photos(id,user_id,schedule_id,schedule_task_id,filename,mime_type,size_bytes,state) VALUES(?,?,?,?,'test.png','image/png',1,'ready')")
            .bind(&photo).bind(&owner).bind(schedule_id).bind(task_id).execute(&pool).await.unwrap();
        std::fs::write(root.join(&owner).join(format!("{photo}.png")), [1u8]).unwrap();
    }
    sqlx::query("CREATE TRIGGER reject_delete BEFORE DELETE ON schedules BEGIN SELECT RAISE(ABORT,'test failure'); END").execute(&pool).await.unwrap();
    assert_eq!(
        request(&pool, "DELETE", &schedule_path(&schedule), json!({}))
            .await
            .0,
        503
    );
    assert_eq!(
        request(&pool, "GET", &schedule_path(&schedule), json!({}))
            .await
            .1,
        schedule
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM photos")
            .fetch_one(&pool)
            .await
            .unwrap(),
        2
    );
    sqlx::query("DROP TRIGGER reject_delete")
        .execute(&pool)
        .await
        .unwrap();
    let response = preset_execution_api::app_with_photo_dir(pool.clone(), root.clone())
        .oneshot(
            Request::builder()
                .header("host", "localhost:3000")
                .method("DELETE")
                .uri(schedule_path(&schedule))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status().as_u16(), 204);
    assert_eq!(std::fs::read_dir(root.join(owner)).unwrap().count(), 0);
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM photos")
            .fetch_one(&pool)
            .await
            .unwrap(),
        0
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM schedule_task_items")
            .fetch_one(&pool)
            .await
            .unwrap(),
        0
    );
}
