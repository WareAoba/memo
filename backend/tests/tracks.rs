use axum::{
    body::{Body, to_bytes},
    http::Request,
};
use preset_execution_api::{app_with_photo_dir, db, reminder_worker};
use serde_json::{Value, json};
use sqlx::{Row, SqlitePool};
use tower::ServiceExt;

const OWNER: &str = "00000000-0000-4000-8000-000000000001";
const OTHER: &str = "00000000-0000-4000-8000-000000000002";

async fn request(
    pool: &SqlitePool,
    track: &str,
    method: &str,
    path: &str,
    body: Value,
) -> (u16, Value) {
    let response = app_with_photo_dir(
        pool.clone(),
        std::env::temp_dir().join("preset-track-test-unused"),
    )
    .oneshot(
        Request::builder()
            .method(method)
            .uri(path)
            .header("host", "localhost:3000")
            .header("content-type", "application/json")
            .header("x-track-id", track)
            .body(Body::from(body.to_string()))
            .unwrap(),
    )
    .await
    .unwrap();
    let status = response.status().as_u16();
    let bytes = to_bytes(response.into_body(), 2_000_000).await.unwrap();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}
async fn create_track(pool: &SqlitePool, name: &str) -> String {
    let (status, value) = request(pool, OWNER, "POST", "/api/tracks", json!({"name":name})).await;
    assert_eq!(status, 201, "{value}");
    value["id"].as_str().unwrap().to_owned()
}
async fn schedule(pool: &SqlitePool, track: &str) -> Value {
    let (status, value) = request(
        pool,
        track,
        "POST",
        "/api/schedules",
        json!({
            "entity_id":{"name":"Same work"},"task_preset_ids":[{"name":"Same task"}],
            "title":"Same title","scheduled_date":"2026-09-27","end_date":"2026-09-27",
            "start_time":"09:00","end_time":"10:00","time_zone":"Asia/Tokyo"
        }),
    )
    .await;
    assert_eq!(status, 201, "{value}");
    value
}

#[tokio::test]
async fn isolated_data_names_links_resets_and_global_reminders() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("tracks.db")).await.unwrap();
    let b = create_track(&pool, "Exercise").await;
    let a_schedule = schedule(&pool, OWNER).await;
    let b_schedule = schedule(&pool, &b).await;
    assert_ne!(a_schedule["entity_id"], b_schedule["entity_id"]);
    assert_ne!(
        a_schedule["tasks"][0]["source_task_preset_id"],
        b_schedule["tasks"][0]["source_task_preset_id"]
    );
    for track in [OWNER, b.as_str()] {
        for (endpoint, body) in [
            (
                "entities",
                json!({"name":"Same work","tags":["Same tag"],"custom_fields":[{"name":"Kind","value":"Value"}]}),
            ),
            (
                "task-presets",
                json!({"name":"Same task","tags":["Same tag"],"group_name":"Group","items":[]}),
            ),
        ] {
            let (status, value) =
                request(&pool, track, "POST", &format!("/api/{endpoint}"), body).await;
            assert_eq!(status, 201, "{value}");
        }
        let (status, page) = request(
            &pool,
            track,
            "GET",
            "/api/schedules?include_details=true",
            Value::Null,
        )
        .await;
        assert_eq!(status, 200);
        assert_eq!(page["total"], 1);
    }
    let wid = a_schedule["entity_id"].as_str().unwrap();
    let tid = a_schedule["tasks"][0]["source_task_preset_id"]
        .as_str()
        .unwrap();
    let sid = a_schedule["id"].as_str().unwrap();
    let task = a_schedule["tasks"][0]["id"].as_str().unwrap();
    // Legacy inserts only fill their own missing scope, even if another track uses this name.
    sqlx::query("INSERT INTO work_field_names(user_id,track_id,name) VALUES(?,?,'Legacy')")
        .bind(OWNER)
        .bind(&b)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO work_field_names(user_id,name) VALUES(?,'Legacy')")
        .bind(OWNER)
        .execute(&pool)
        .await
        .unwrap();
    let legacy_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM work_field_names WHERE name='Legacy' AND track_id IS NOT NULL",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(legacy_count, 2);
    let photo = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO photos(id,user_id,track_id,schedule_id,filename,mime_type,size_bytes,state) VALUES(?,?,?,?,'test.png','image/png',1,'ready')")
        .bind(&photo).bind(OWNER).bind(OWNER).bind(sid).execute(&pool).await.unwrap();
    let photo_list = format!("/api/photos?target_type=schedule&target_id={sid}");
    assert_eq!(
        request(&pool, OWNER, "GET", &photo_list, Value::Null)
            .await
            .1
            .as_array()
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        request(&pool, &b, "GET", &photo_list, Value::Null).await.0,
        404
    );
    for method in ["GET", "DELETE"] {
        assert_eq!(
            request(
                &pool,
                &b,
                method,
                &format!("/api/photos/{photo}"),
                Value::Null
            )
            .await
            .0,
            404
        );
    }
    for endpoint in [
        format!("entities/{wid}"),
        format!("task-presets/{tid}"),
        format!("schedules/{sid}"),
        format!("entities/{wid}/task-presets"),
    ] {
        assert_eq!(
            request(&pool, &b, "GET", &format!("/api/{endpoint}"), Value::Null)
                .await
                .0,
            404
        );
    }
    for (endpoint, method, body) in [
        (format!("entities/{wid}"), "PATCH", json!({"name":"Cross"})),
        (
            format!("task-presets/{tid}"),
            "PATCH",
            json!({"name":"Cross"}),
        ),
        (format!("schedules/{sid}"), "DELETE", Value::Null),
        (format!("schedules/{sid}/complete"), "POST", json!({})),
        (
            format!("schedule-tasks/{task}"),
            "PATCH",
            json!({"name":"Cross"}),
        ),
    ] {
        assert_eq!(
            request(&pool, &b, method, &format!("/api/{endpoint}"), body)
                .await
                .0,
            404
        );
    }
    let bwid = b_schedule["entity_id"].as_str().unwrap();
    assert_eq!(
        request(
            &pool,
            &b,
            "PUT",
            &format!("/api/entities/{bwid}/task-presets"),
            json!({"task_preset_ids":[tid]})
        )
        .await
        .0,
        404
    );
    // Database constraints also reject cross-track relationships, even without the API.
    assert!(sqlx::query("INSERT INTO work_task_presets(entity_id,task_preset_id,user_id,track_id,position) VALUES(?,?,?,?,0)").bind(bwid).bind(tid).bind(OWNER).bind(&b).execute(&pool).await.is_err());
    let before = request(&pool, OWNER, "GET", "/api/schedules", Value::Null)
        .await
        .1["revision"]
        .clone();
    request(
        &pool,
        &b,
        "PATCH",
        &format!("/api/schedules/{}", b_schedule["id"].as_str().unwrap()),
        json!({"title":"Changed B"}),
    )
    .await;
    assert_eq!(
        request(&pool, OWNER, "GET", "/api/schedules", Value::Null)
            .await
            .1["revision"],
        before
    );
    sqlx::query("UPDATE schedules SET reminder_enabled=1,reminder_at=unixepoch()-30,reminder_start_at=unixepoch()+3600").execute(&pool).await.unwrap();
    for track in [OWNER, b.as_str(), "not-a-track"] {
        let (status, reminders) = request(&pool, track, "GET", "/api/reminders", Value::Null).await;
        assert_eq!(status, 200);
        assert_eq!(reminders.as_array().unwrap().len(), 2);
    }
    // The app worker queues every track for the one account/device subscription.
    sqlx::query("INSERT INTO push_subscriptions(id,user_id,installation_id,endpoint,p256dh,auth) VALUES('device',?,'install','https://example.invalid/push','key','auth')").bind(OWNER).execute(&pool).await.unwrap();
    reminder_worker::claim(&pool).await.unwrap();
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM push_deliveries")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 2);
    for target in ["works", "tasks", "schedules"] {
        let (status, value) = request(
            &pool,
            OWNER,
            "POST",
            "/api/settings/reset",
            json!({"target":target,"confirmation":target}),
        )
        .await;
        assert_eq!(status, 204, "{value}");
    }
    assert_eq!(
        request(&pool, &b, "GET", "/api/schedules", Value::Null)
            .await
            .1["total"],
        1
    );
    assert_eq!(
        request(&pool, &b, "GET", "/api/entities", Value::Null)
            .await
            .1["total"],
        1
    );
    assert_eq!(
        request(&pool, &b, "GET", "/api/task-presets", Value::Null)
            .await
            .1["total"],
        1
    );
    assert_eq!(
        request(&pool, OWNER, "GET", "/api/work-field-names", Value::Null)
            .await
            .1,
        json!([])
    );
    assert_eq!(
        request(&pool, &b, "GET", "/api/work-field-names", Value::Null)
            .await
            .1,
        json!(["Kind", "Legacy"])
    );
    assert_eq!(
        request(&pool, &b, "GET", "/api/task-groups", Value::Null)
            .await
            .1,
        json!(["Group"])
    );
}

#[tokio::test]
async fn concurrent_limit_validation_and_foreign_tracks() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("limit.db")).await.unwrap();
    let list = request(&pool, OWNER, "GET", "/api/tracks", Value::Null)
        .await
        .1;
    assert_eq!(list["items"].as_array().unwrap().len(), 1);
    assert_eq!(list["limit"], 3);
    let b = create_track(&pool, "Second").await;
    let (one, two) = tokio::join!(
        request(&pool, OWNER, "POST", "/api/tracks", json!({"name":"Third"})),
        request(
            &pool,
            OWNER,
            "POST",
            "/api/tracks",
            json!({"name":"Fourth"})
        )
    );
    let mut statuses = [one.0, two.0];
    statuses.sort();
    assert_eq!(statuses, [201, 409]);
    assert_eq!(
        request(
            &pool,
            OWNER,
            "PATCH",
            &format!("/api/tracks/{b}"),
            json!({"name":"  Renamed  "})
        )
        .await
        .1["name"],
        "Renamed"
    );
    for name in [
        "".to_owned(),
        " ".to_owned(),
        "x".repeat(81),
        "a\nb".to_owned(),
    ] {
        assert_eq!(
            request(
                &pool,
                OWNER,
                "PATCH",
                &format!("/api/tracks/{b}"),
                json!({"name":name})
            )
            .await
            .0,
            400
        );
    }
    sqlx::query("INSERT INTO users(id,display_name) VALUES(?,'Other')")
        .bind(OTHER)
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(
        request(&pool, OTHER, "GET", "/api/entities", Value::Null)
            .await
            .0,
        404
    );
    assert_eq!(
        request(
            &pool,
            OWNER,
            "PATCH",
            &format!("/api/tracks/{OTHER}"),
            json!({"name":"No"})
        )
        .await
        .0,
        404
    );
    // Future entitlement increases require no table redesign or frontend constant change.
    sqlx::query("UPDATE users SET track_limit=4 WHERE id=?")
        .bind(OWNER)
        .execute(&pool)
        .await
        .unwrap();
    create_track(&pool, "Fourth").await;
}

#[tokio::test]
async fn track_lists_use_compound_indexes() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("plan.db")).await.unwrap();
    for sql in [
        "SELECT id FROM schedules WHERE user_id=? AND track_id=? AND scheduled_date<=? ORDER BY scheduled_date,start_time,id",
        "SELECT id FROM entities WHERE user_id=? AND track_id=? AND archived=? ORDER BY name,id",
        "SELECT id FROM task_presets WHERE user_id=? AND track_id=? AND archived=? ORDER BY name,id",
    ] {
        let rows = sqlx::query(&format!("EXPLAIN QUERY PLAN {sql}"))
            .bind(OWNER)
            .bind(OWNER)
            .bind("2026-12-31")
            .fetch_all(&pool)
            .await
            .unwrap();
        let plan = rows
            .iter()
            .map(|r| r.get::<String, _>("detail"))
            .collect::<Vec<_>>()
            .join("\n");
        assert!(
            plan.contains("SEARCH") && plan.contains("track_id=?"),
            "{plan}"
        );
        assert!(!plan.contains("USE TEMP B-TREE"), "{plan}");
    }
}
