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
    let (status, value) = request(pool, "POST", "/api/entities", Some(body)).await;
    assert_eq!(status, 201, "{value}");
    value
}
#[tokio::test]
async fn full_crud_search_archive_restore_and_persistence() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("app.sqlite3");
    let pool = db::connect(&path).await.unwrap();
    let input = json!({"name":"  중앙 현장  ","reference_code":"REF-100","address":"서울 중구",
        "contact_name":"담당자","contact_info":"010-0000-0000","advance_contact_required":true,"notice_required":true,
        "default_work_start_time":"09:00","default_work_end_time":"17:30","access_instructions":"정문",
        "parking_info":"지하","special_notes":"계약","general_notes":"메모","tags":[" 정기 ","정기","방문"]});
    let entity = create(&pool, input.clone()).await;
    let id = entity["id"].as_str().unwrap();
    let uri = format!("/api/entities/{id}");
    uuid::Uuid::parse_str(id).unwrap();
    assert!(entity["created_at"].as_str().unwrap().ends_with('Z'));
    for (key, value) in input.as_object().unwrap() {
        if key != "name" && key != "tags" {
            assert_eq!(&entity[key], value);
        }
    }
    assert_eq!(entity["name"], "중앙 현장");
    assert_eq!(entity["tags"], json!(["방문", "정기"]));
    assert_eq!(
        request(&pool, "GET", &uri, None).await,
        (200, entity.clone())
    );
    for q in ["REF-100", "%EC%84%9C%EC%9A%B8", "%EC%A4%91%EC%95%99"] {
        let (status, list) = request(&pool, "GET", &format!("/api/entities?q={q}"), None).await;
        assert_eq!(status, 200);
        assert_eq!(list["total"], 1);
        assert_eq!(list["items"][0], entity);
    }
    let (status,changed)=request(&pool,"PATCH",&uri,Some(json!({"name":"새 이름","tags":["새 태그"],"default_work_start_time":null,"default_work_end_time":null}))).await;
    assert_eq!(status, 200);
    assert_eq!(changed["contact_info"], input["contact_info"]);
    assert_eq!(changed["tags"], json!(["새 태그"]));
    assert!(changed["default_work_start_time"].is_null());
    assert_eq!(request(&pool, "DELETE", &uri, None).await.0, 204);
    assert_eq!(request(&pool, "DELETE", &uri, None).await.0, 204);
    assert_eq!(
        request(&pool, "GET", "/api/entities", None).await.1["total"],
        0
    );
    assert_eq!(
        request(&pool, "GET", "/api/entities?archived=true", None)
            .await
            .1["total"],
        1
    );
    assert_eq!(request(&pool, "GET", &uri, None).await.1["archived"], true);
    assert_eq!(
        request(&pool, "PATCH", &uri, Some(json!({"archived":false})))
            .await
            .0,
        200
    );
    pool.close().await;
    let pool = db::connect(&path).await.unwrap();
    let stored = request(&pool, "GET", &uri, None).await.1;
    assert_eq!(stored["name"], "새 이름");
    assert_eq!(stored["tags"], json!(["새 태그"]));
    assert_eq!(stored["archived"], false);
    pool.close().await;
}
#[tokio::test]
async fn invalid_inputs_return_json_and_preserve_existing_data() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("app.sqlite3")).await.unwrap();
    let entity = create(&pool, json!({"name":"원본","tags":["원본"]})).await;
    let uri = format!("/api/entities/{}", entity["id"].as_str().unwrap());
    for body in [
        json!({}),
        json!({"name":"  "}),
        json!({"name":null}),
        json!({"name":"a".repeat(201)}),
        json!({"name":"x","user_id":OTHER}),
        json!({"name":"x","tags":[""]}),
        json!({"name":"x","tags":null}),
        json!({"name":"x","tags":["a".repeat(51)]}),
        json!({"name":"x","tags":vec!["x";21]}),
        json!({"name":"x","default_work_start_time":"09:00"}),
        json!({"name":"x","default_work_start_time":"24:00","default_work_end_time":"25:00"}),
        json!({"name":"x","default_work_start_time":"09:00","default_work_end_time":"09:00"}),
        json!({"name":"x","default_work_start_time":"17:00","default_work_end_time":"09:00"}),
        json!({"name":"x","default_work_start_time":"é:00","default_work_end_time":"19:00"}),
        json!({"name":"x","notice_required":"true"}),
        json!({"name":"x","archived":1}),
        json!({"name":"x","address":"a".repeat(501)}),
        json!({"name":"x","general_notes":"a".repeat(5001)}),
        json!({"name":"x\u{0000}"}),
        json!([]),
    ] {
        let (status, value) = request(&pool, "POST", "/api/entities", Some(body)).await;
        assert_eq!(status, 400, "{value}");
        assert_eq!(value["error"]["code"], "INVALID_INPUT");
    }
    assert_eq!(
        raw(&pool, "POST", "/api/entities", Some("{broken")).await.0,
        400
    );
    for path in [
        "/api/entities/bad-uuid",
        "/api/entities?limit=0",
        "/api/entities?limit=101",
        "/api/entities?offset=-1",
        "/api/entities?archived=maybe",
        "/api/entities?user_id=other",
    ] {
        let (status, value) = request(&pool, "GET", path, None).await;
        assert_eq!(status, 400);
        assert_eq!(value["error"]["code"], "INVALID_INPUT");
    }
    assert_eq!(
        request(
            &pool,
            "PATCH",
            &uri,
            Some(json!({"name":"changed","tags":[""]}))
        )
        .await
        .0,
        400
    );
    assert_eq!(request(&pool, "GET", &uri, None).await.1, entity);
    assert_eq!(
        request(&pool, "GET", "/api/entities", None).await.1["total"],
        1
    );
    pool.close().await;
}
#[tokio::test]
async fn ownership_is_enforced_for_reads_writes_lists_and_tag_links() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("app.sqlite3")).await.unwrap();
    sqlx::query("INSERT INTO users(id,display_name) VALUES(?, 'other')")
        .bind(OTHER)
        .execute(&pool)
        .await
        .unwrap();
    let foreign = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO entities(id,user_id,name) VALUES(?,?,'private')")
        .bind(&foreign)
        .bind(OTHER)
        .execute(&pool)
        .await
        .unwrap();
    let uri = format!("/api/entities/{foreign}");
    for (method, body) in [
        ("GET", None),
        ("PATCH", Some(json!({"name":"attack"}))),
        ("DELETE", None),
    ] {
        let (status, value) = request(&pool, method, &uri, body).await;
        assert_eq!(status, 404);
        assert_eq!(value["error"]["code"], "ENTITY_NOT_FOUND");
    }
    assert_eq!(
        request(&pool, "GET", "/api/entities", None).await.1["total"],
        0
    );
    let local = create(&pool, json!({"name":"local","tags":["common"]})).await;
    let foreign_tag = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO tags(id,user_id,name) VALUES(?,?,'common')")
        .bind(&foreign_tag)
        .bind(OTHER)
        .execute(&pool)
        .await
        .unwrap();
    let cross = sqlx::query("INSERT INTO entity_tags(entity_id,tag_id,user_id) VALUES(?,?,?)")
        .bind(local["id"].as_str().unwrap())
        .bind(&foreign_tag)
        .bind(OWNER)
        .execute(&pool)
        .await;
    assert!(cross.is_err());
    let name: String = sqlx::query_scalar("SELECT name FROM entities WHERE id=?")
        .bind(foreign)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(name, "private");
    pool.close().await;
}
#[tokio::test]
async fn write_failure_rolls_back_entity_and_tags_together() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("app.sqlite3")).await.unwrap();
    let original = create(&pool, json!({"name":"original","tags":["old"]})).await;
    sqlx::query("CREATE TRIGGER reject_links BEFORE INSERT ON entity_tags BEGIN SELECT RAISE(ABORT,'private database detail'); END").execute(&pool).await.unwrap();
    let uri = format!("/api/entities/{}", original["id"].as_str().unwrap());
    for (method, path, body) in [
        (
            "PATCH",
            uri.as_str(),
            json!({"name":"changed","tags":["new"]}),
        ),
        (
            "POST",
            "/api/entities",
            json!({"name":"new entity","tags":["new"]}),
        ),
    ] {
        let (status, value) = request(&pool, method, path, Some(body)).await;
        assert_eq!(status, 503);
        assert_eq!(value["error"]["code"], "DATABASE_UNAVAILABLE");
        assert!(!value.to_string().contains("private"));
    }
    assert_eq!(request(&pool, "GET", &uri, None).await.1, original);
    assert_eq!(
        request(&pool, "GET", "/api/entities", None).await.1["total"],
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
async fn pagination_literal_search_and_tag_reuse() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("app.sqlite3")).await.unwrap();
    for name in ["A_100%", "B", "C"] {
        create(&pool, json!({"name":name,"tags":["shared"]})).await;
    }
    let first = request(&pool, "GET", "/api/entities?limit=2", None).await.1;
    let second = request(&pool, "GET", "/api/entities?limit=2&offset=2", None)
        .await
        .1;
    assert_eq!(first["total"], 3);
    assert_eq!(first["items"].as_array().unwrap().len(), 2);
    assert_eq!(second["items"].as_array().unwrap().len(), 1);
    assert_eq!(first["items"][0]["name"], "A_100%");
    assert_eq!(second["items"][0]["name"], "C");
    for q in ["%25", "_"] {
        assert_eq!(
            request(&pool, "GET", &format!("/api/entities?q={q}"), None)
                .await
                .1["total"],
            1
        );
    }
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM tags")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 1);
    pool.close().await;
}
#[tokio::test]
async fn device_time_zone_is_validated_and_initialized_only_once() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("app.sqlite3")).await.unwrap();
    assert_eq!(
        request(
            &pool,
            "POST",
            "/api/local-user",
            Some(json!({"time_zone":"invalid"}))
        )
        .await
        .0,
        400
    );
    assert_eq!(
        request(
            &pool,
            "POST",
            "/api/local-user",
            Some(json!({"time_zone":"Asia/Tokyo","user_id":OTHER}))
        )
        .await
        .0,
        400
    );
    assert_eq!(
        request(
            &pool,
            "POST",
            "/api/local-user",
            Some(json!({"time_zone":"Asia/Tokyo"}))
        )
        .await,
        (200, json!({"time_zone":"Asia/Tokyo"}))
    );
    assert_eq!(
        request(
            &pool,
            "POST",
            "/api/local-user",
            Some(json!({"time_zone":"Europe/London"}))
        )
        .await
        .1,
        json!({"time_zone":"Asia/Tokyo"})
    );
    pool.close().await;
}

#[tokio::test]
async fn custom_information_roundtrips_and_names_survive_removal() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("custom.sqlite3");
    let pool = db::connect(&path).await.unwrap();
    let work = create(
        &pool,
        json!({"name":"Work","custom_fields":[{"name":" 담당자 ","value":"Kim"}]}),
    )
    .await;
    let uri = format!("/api/entities/{}", work["id"].as_str().unwrap());
    assert_eq!(
        work["custom_fields"],
        json!([{"name":"담당자","value":"Kim"}])
    );
    assert_eq!(
        request(&pool, "GET", "/api/work-field-names", None).await,
        (200, json!(["담당자"]))
    );
    let bad = request(
        &pool,
        "PATCH",
        &uri,
        Some(json!({"custom_fields":[{"name":"A","value":"1"},{"name":" A ","value":"2"}]})),
    )
    .await;
    assert_eq!(bad.0, 400);
    assert_eq!(
        request(&pool, "GET", &uri, None).await.1["custom_fields"],
        work["custom_fields"]
    );
    assert_eq!(
        request(&pool, "PATCH", &uri, Some(json!({"custom_fields":[]})))
            .await
            .0,
        200
    );
    pool.close().await;
    let pool = db::connect(&path).await.unwrap();
    assert_eq!(
        request(&pool, "GET", "/api/work-field-names", None).await.1,
        json!(["담당자"])
    );
}

#[tokio::test]
async fn unnamed_details_and_search_match_kind_and_content_before_pagination() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("details.sqlite3"))
        .await
        .unwrap();
    let a = create(&pool, json!({"name":"Alpha","custom_fields":[{"name":"","value":"shared needle 100%"},{"name":"","value":"second note"},{"name":"Location","value":"Seoul"}]})).await;
    create(
        &pool,
        json!({"name":"Beta","custom_fields":[{"name":"needle","value":"other"}]}),
    )
    .await;
    let (_, page) = request(
        &pool,
        "GET",
        "/api/entities?q=needle&limit=1&offset=1",
        None,
    )
    .await;
    assert_eq!(page["total"], 2);
    assert_eq!(page["items"][0]["name"], "Beta");
    for query in ["Location", "Seoul", "second", "100%25"] {
        let (status, page) = request(&pool, "GET", &format!("/api/entities?q={query}"), None).await;
        assert_eq!(status, 200);
        assert_eq!(page["total"], 1);
        assert_eq!(page["items"][0]["id"], a["id"]);
    }
    let names = request(&pool, "GET", "/api/work-field-names", None).await.1;
    assert_eq!(names, json!(["Location", "needle"]));
    let uri = format!("/api/entities/{}", a["id"].as_str().unwrap());
    assert_eq!(request(&pool, "DELETE", &uri, None).await.0, 204);
    assert_eq!(
        request(&pool, "GET", "/api/entities?q=Seoul", None).await.1["total"],
        0
    );
    assert_eq!(
        request(&pool, "GET", "/api/entities?q=Seoul&archived=true", None)
            .await
            .1["total"],
        1
    );
}

#[tokio::test]
async fn work_search_includes_notes_and_legacy_details() {
    let dir = tempfile::tempdir().unwrap();
    let pool = db::connect(&dir.path().join("notes.sqlite3"))
        .await
        .unwrap();
    let a = create(&pool, json!({"name":"Alpha","general_notes":"library 100%","special_notes":"quiet","contact_name":"Kim","contact_info":"example.test","access_instructions":"gate","parking_info":"garage"})).await;
    create(&pool, json!({"name":"Beta","general_notes":"library"})).await;
    let (_, page) = request(
        &pool,
        "GET",
        "/api/entities?q=library&limit=1&offset=1",
        None,
    )
    .await;
    assert_eq!(page["total"], 2);
    assert_eq!(page["items"][0]["name"], "Beta");
    for q in ["100%25", "quiet", "Kim", "example.test", "gate", "garage"] {
        let (status, page) = request(&pool, "GET", &format!("/api/entities?q={q}"), None).await;
        assert_eq!(status, 200);
        assert_eq!(page["total"], 1);
        assert_eq!(page["items"][0]["id"], a["id"]);
    }
}
