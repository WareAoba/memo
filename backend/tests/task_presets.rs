use axum::{
    body::{Body, to_bytes},
    http::Request,
};
use preset_execution_api::{app, db};
use serde_json::{Value, json};
use sqlx::SqlitePool;
use tower::ServiceExt;
const OWNER: &str = "00000000-0000-4000-8000-000000000001";
const OTHER: &str = "00000000-0000-4000-8000-000000000002";
#[tokio::test]
async fn summary_omits_definitions_and_metadata_edits_do_not_rewrite_children() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("app.sqlite3")).await.unwrap();
    let original = create(
        &pool,
        json!({"name":"A","tags":["고객, VIP","일반"],"items":[
            {"position":0,"label":"first","item_type":"text","default_value":"large body"},
            {"position":1,"label":"second","item_type":"checkbox"}
        ]}),
    )
    .await;
    create(&pool, json!({"name":"B"})).await;
    let uri = format!("/api/task-presets/{}", original["id"].as_str().unwrap());
    let list = request(&pool, "GET", "/api/task-presets", None).await;
    assert_eq!(list.0, 200);
    assert_eq!(list.1["items"][0]["item_count"], 2);
    assert_eq!(list.1["items"][0]["tags"], original["tags"]);
    assert!(list.1["items"][0].get("items").is_none());
    assert_eq!(list.1["items"][1]["item_count"], 0);
    assert_eq!(list.1["items"][1]["tags"], json!([]));
    for (index, statement) in [
        "BEFORE INSERT ON task_preset_items",
        "BEFORE UPDATE ON task_preset_items",
        "BEFORE DELETE ON task_preset_items",
        "BEFORE INSERT ON task_preset_tags",
        "BEFORE DELETE ON task_preset_tags",
    ]
    .iter()
    .enumerate()
    {
        sqlx::query(&format!("CREATE TRIGGER guard_{index} {statement} BEGIN SELECT RAISE(ABORT,'unexpected child write'); END"))
            .execute(&pool).await.unwrap();
    }
    let changed = request(
        &pool,
        "PATCH",
        &uri,
        Some(json!({"name":"renamed","items":original["items"],"tags":original["tags"]})),
    )
    .await;
    assert_eq!(changed.0, 200);
    assert_eq!(changed.1["items"], original["items"]);
    assert_eq!(changed.1["version"], 2);
    for index in 0..5 {
        sqlx::query(&format!("DROP TRIGGER guard_{index}"))
            .execute(&pool)
            .await
            .unwrap();
    }
    // An untouched sibling must not be updated or deleted during an item edit.
    let stable_id = original["items"][1]["id"].as_str().unwrap();
    for operation in ["UPDATE", "DELETE"] {
        sqlx::query(&format!("CREATE TRIGGER stable_{operation} BEFORE {operation} ON task_preset_items WHEN OLD.id='{stable_id}' BEGIN SELECT RAISE(ABORT,'untouched sibling'); END"))
            .execute(&pool).await.unwrap();
    }
    let mut items = original["items"].clone();
    items[0]["label"] = json!("edited");
    let changed = request(&pool, "PATCH", &uri, Some(json!({"items":items}))).await;
    assert_eq!(changed.0, 200);
    assert_eq!(changed.1["items"][0]["label"], "edited");
    assert_eq!(changed.1["items"][1], original["items"][1]);
    pool.close().await;
}
async fn request(pool: &SqlitePool, method: &str, path: &str, body: Option<Value>) -> (u16, Value) {
    raw(pool, method, path, body.map(|v| v.to_string()).as_deref()).await
}
async fn raw(pool: &SqlitePool, method: &str, path: &str, body: Option<&str>) -> (u16, Value) {
    let request = Request::builder()
        .header("host", "localhost:3000")
        .method(method)
        .uri(path)
        .header("content-type", "application/json")
        .body(
            body.map(|v| Body::from(v.to_owned()))
                .unwrap_or_else(Body::empty),
        )
        .unwrap();
    let response = app(pool.clone()).oneshot(request).await.unwrap();
    let status = response.status().as_u16();
    assert_eq!(response.headers()["cache-control"], "no-store");
    let bytes = to_bytes(response.into_body(), 1_000_000).await.unwrap();
    let value = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&bytes).unwrap()
    };
    (status, value)
}
async fn create(pool: &SqlitePool, body: Value) -> Value {
    let (status, value) = request(pool, "POST", "/api/task-presets", Some(body)).await;
    assert_eq!(status, 201, "{value}");
    value
}
#[tokio::test]
async fn definitions_version_order_partial_patch_archive_and_persistence() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("app.sqlite3");
    let pool = db::connect(&path).await.unwrap();
    let original = create(
        &pool,
        json!({"name":"  복습  ","default_notes":" 메모 ","tags":[" 학습 ","학습"],"items":[
 {"position":0,"label":"확인","item_type":"checkbox","required":true,"default_value":false},
 {"position":1,"label":"내용","item_type":"text","default_value":"본문"},
 {"position":2,"label":"횟수","item_type":"number","default_value":0,"unit":"회"}]}),
    )
    .await;
    assert_eq!(original["name"], "복습");
    assert_eq!(original["tags"], json!(["학습"]));
    assert_eq!(original["version"], 1);
    let uri = format!("/api/task-presets/{}", original["id"].as_str().unwrap());
    let same = request(&pool, "PATCH", &uri, Some(json!({"name":"복습"}))).await;
    assert_eq!(same, (200, original.clone()));
    let mut items = original["items"].as_array().unwrap().clone();
    items.swap(0, 2);
    for (i, item) in items.iter_mut().enumerate() {
        item["position"] = json!(i);
    }
    let changed = request(&pool, "PATCH", &uri, Some(json!({"items":items}))).await;
    assert_eq!(changed.0, 200);
    assert_eq!(changed.1["version"], 2);
    assert_eq!(changed.1["default_notes"], "메모");
    assert_eq!(changed.1["items"][0]["id"], original["items"][2]["id"]);
    assert_eq!(changed.1["items"][0]["default_value"], 0);
    let cleared = request(
        &pool,
        "PATCH",
        &uri,
        Some(json!({"items":[],"tags":[],"default_notes":""})),
    )
    .await
    .1;
    assert_eq!(cleared["version"], 3);
    assert_eq!(cleared["items"], json!([]));
    assert_eq!(request(&pool, "DELETE", &uri, None).await.0, 204);
    assert_eq!(request(&pool, "DELETE", &uri, None).await.0, 204);
    assert_eq!(request(&pool, "GET", &uri, None).await.1["version"], 4);
    assert_eq!(
        request(&pool, "GET", "/api/task-presets", None).await.1["total"],
        0
    );
    assert_eq!(
        request(&pool, "GET", "/api/task-presets?archived=true", None)
            .await
            .1["total"],
        1
    );
    let restored = request(&pool, "PATCH", &uri, Some(json!({"archived":false})))
        .await
        .1;
    assert_eq!(restored["version"], 5);
    pool.close().await;
    let pool = db::connect(&path).await.unwrap();
    assert_eq!(request(&pool, "GET", &uri, None).await.1, restored);
    pool.close().await;
}
#[tokio::test]
async fn rejects_invalid_types_positions_limits_and_unknown_fields_without_writes() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("app.sqlite3")).await.unwrap();
    let original = create(&pool, json!({"name":"original"})).await;
    let uri = format!("/api/task-presets/{}", original["id"].as_str().unwrap());
    for body in [
        json!({}),
        json!({"name":" "}),
        json!({"name":"a".repeat(201)}),
        json!({"default_notes":"a".repeat(5001)}),
        json!({"version":8}),
        json!({"user_id":OTHER}),
        json!({"description":"x"}),
        json!({"category":"x"}),
        json!({"estimated_duration":5}),
        json!({"tags":[""]}),
        json!({"items":null}),
        json!({"items":[{"position":0,"label":"x","item_type":"number","default_value":"1"}]}),
        json!({"items":[{"position":0,"label":"x","item_type":"checkbox","default_value":1}]}),
        json!({"items":[{"position":0,"label":"x","item_type":"text","default_value":false}]}),
        json!({"items":[{"position":0,"label":"x","item_type":"text","unit":"kg"}]}),
        json!({"items":[{"position":1,"label":"x","item_type":"text"}]}),
        json!({"items":[{"position":0,"label":" ","item_type":"checkbox"}]}),
        json!({"items":[{"position":0,"label":"x","item_type":"date"}]}),
        json!({"items":[{"id":OTHER,"position":0,"label":"x","item_type":"text"}]}),
        json!({"items":[{"position":0,"label":"x","item_type":"text","user_id":OTHER}]}),
        json!({"items":(0..101).map(|i|json!({"position":i,"label":"x","item_type":"checkbox"})).collect::<Vec<_>>()}),
    ] {
        let (status, value) = request(&pool, "PATCH", &uri, Some(body)).await;
        assert_eq!(status, 400, "{value}");
        assert_eq!(value["error"]["code"], "INVALID_INPUT");
    }
    for path in [
        "/api/task-presets/nope",
        "/api/task-presets?limit=0",
        "/api/task-presets?limit=101",
        "/api/task-presets?offset=-1",
        "/api/task-presets?archived=x",
        "/api/task-presets?user_id=other",
    ] {
        assert_eq!(request(&pool, "GET", path, None).await.0, 400);
    }
    assert_eq!(
        raw(&pool, "POST", "/api/task-presets", Some("{bad"))
            .await
            .0,
        400
    );
    assert_eq!(request(&pool, "GET", &uri, None).await.1, original);
    pool.close().await;
}
#[tokio::test]
async fn ownership_and_foreign_item_ids_are_rejected() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("app.sqlite3")).await.unwrap();
    sqlx::query("INSERT INTO users(id,display_name) VALUES(?,'other')")
        .bind(OTHER)
        .execute(&pool)
        .await
        .unwrap();
    let foreign = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO task_presets(id,user_id,name) VALUES(?,?,'private')")
        .bind(&foreign)
        .bind(OTHER)
        .execute(&pool)
        .await
        .unwrap();
    let uri = format!("/api/task-presets/{foreign}");
    for (method, body) in [
        ("GET", None),
        ("PATCH", Some(json!({"name":"attack"}))),
        ("DELETE", None),
    ] {
        let response = request(&pool, method, &uri, body).await;
        assert_eq!(response.0, 404);
        assert_eq!(response.1["error"]["code"], "TASK_PRESET_NOT_FOUND");
    }
    assert_eq!(
        request(&pool, "GET", "/api/task-presets", None).await.1["total"],
        0
    );
    let a=create(&pool,json!({"name":"A","tags":["shared"],"items":[{"position":0,"label":"x","item_type":"text"}]})).await;
    let b = create(&pool, json!({"name":"B"})).await;
    let b_uri = format!("/api/task-presets/{}", b["id"].as_str().unwrap());
    assert_eq!(
        request(&pool, "PATCH", &b_uri, Some(json!({"items":a["items"]})))
            .await
            .0,
        400
    );
    let mut duplicate = a["items"][0].clone();
    duplicate["position"] = json!(1);
    let a_uri = format!("/api/task-presets/{}", a["id"].as_str().unwrap());
    assert_eq!(
        request(
            &pool,
            "PATCH",
            &a_uri,
            Some(json!({"items":[a["items"][0],duplicate]}))
        )
        .await
        .0,
        400
    );
    let tag = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO tags(id,user_id,name) VALUES(?,?,'shared')")
        .bind(&tag)
        .bind(OTHER)
        .execute(&pool)
        .await
        .unwrap();
    assert!(
        sqlx::query("INSERT INTO task_preset_tags(task_preset_id,tag_id,user_id) VALUES(?,?,?)")
            .bind(a["id"].as_str().unwrap())
            .bind(&tag)
            .bind(OWNER)
            .execute(&pool)
            .await
            .is_err()
    );
    assert_eq!(request(&pool, "GET", &b_uri, None).await.1, b);
    pool.close().await;
}
#[tokio::test]
async fn database_failure_rolls_back_definitions_tags_and_version() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("app.sqlite3")).await.unwrap();
    let original=create(&pool,json!({"name":"original","tags":["old"],"items":[{"position":0,"label":"old item","item_type":"checkbox"}]})).await;
    let uri = format!("/api/task-presets/{}", original["id"].as_str().unwrap());
    sqlx::query("CREATE TRIGGER reject_links BEFORE INSERT ON task_preset_tags BEGIN SELECT RAISE(ABORT,'private database detail'); END").execute(&pool).await.unwrap();
    for (method, path) in [("POST", "/api/task-presets"), ("PATCH", uri.as_str())] {
        let (status,value)=request(&pool,method,path,Some(json!({"name":"changed","tags":["new"],"items":[{"position":0,"label":"new item","item_type":"number","default_value":2}]}))).await;
        assert_eq!(status, 503);
        assert_eq!(value["error"]["code"], "DATABASE_UNAVAILABLE");
        assert!(!value.to_string().contains("private"));
    }
    assert_eq!(request(&pool, "GET", &uri, None).await.1, original);
    assert_eq!(
        request(&pool, "GET", "/api/task-presets", None).await.1["total"],
        1
    );
    let tags: i64 = sqlx::query_scalar("SELECT count(*) FROM tags")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(tags, 1);
    pool.close().await;
}
#[tokio::test]
async fn literal_name_tag_search_pagination_and_shared_entity_tags() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("app.sqlite3")).await.unwrap();
    for name in ["A_100%", "B", "C"] {
        create(&pool, json!({"name":name,"tags":["shared"]})).await;
    }
    create(&pool, json!({"name":"D","tags":["only!tag"]})).await;
    request(
        &pool,
        "POST",
        "/api/entities",
        Some(json!({"name":"work","tags":["shared"]})),
    )
    .await;
    let page = request(&pool, "GET", "/api/task-presets?limit=2&offset=2", None)
        .await
        .1;
    assert_eq!(page["total"], 4);
    assert_eq!(page["items"][0]["name"], "C");
    assert_eq!(page["items"].as_array().unwrap().len(), 2);
    for q in ["%25", "_", "%21"] {
        assert_eq!(
            request(&pool, "GET", &format!("/api/task-presets?q={q}"), None)
                .await
                .1["total"],
            1
        );
    }
    assert_eq!(
        request(&pool, "GET", "/api/task-presets?q=shared", None)
            .await
            .1["total"],
        3
    );
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM tags")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 2);
    pool.close().await;
}
#[tokio::test]
async fn concurrent_partial_updates_preserve_both_changes_and_increment_versions() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("app.sqlite3")).await.unwrap();
    let original = create(&pool, json!({"name":"original"})).await;
    let uri = format!("/api/task-presets/{}", original["id"].as_str().unwrap());
    let (a, b) = tokio::join!(
        request(&pool, "PATCH", &uri, Some(json!({"name":"changed"}))),
        request(&pool, "PATCH", &uri, Some(json!({"default_notes":"notes"})))
    );
    assert_eq!(a.0, 200);
    assert_eq!(b.0, 200);
    let result = request(&pool, "GET", &uri, None).await.1;
    assert_eq!(result["name"], "changed");
    assert_eq!(result["default_notes"], "notes");
    assert_eq!(result["version"], 3);
    pool.close().await;
}

#[tokio::test]
async fn named_groups_filter_before_pagination_and_can_be_changed() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("groups.sqlite3"))
        .await
        .unwrap();
    let task = create(&pool, json!({"name":"A","group_name":" Study "})).await;
    create(&pool, json!({"name":"B","group_name":"Study"})).await;
    create(&pool, json!({"name":"C"})).await;
    let (_, page) = request(
        &pool,
        "GET",
        "/api/task-presets?group_name=Study&limit=1&offset=1",
        None,
    )
    .await;
    assert_eq!(page["total"], 2);
    assert_eq!(page["items"][0]["name"], "B");
    assert_eq!(page["items"][0]["group_name"], "Study");
    assert_eq!(
        request(&pool, "GET", "/api/task-groups", None).await,
        (200, json!(["Study"]))
    );
    let uri = format!("/api/task-presets/{}", task["id"].as_str().unwrap());
    assert_eq!(
        request(&pool, "PATCH", &uri, Some(json!({"group_name":""})))
            .await
            .0,
        200
    );
    assert_eq!(
        request(&pool, "GET", "/api/task-presets?group_name=", None)
            .await
            .1["total"],
        2
    );
}
