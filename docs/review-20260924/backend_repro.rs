use axum::{
    body::{Body, to_bytes},
    http::Request,
};
use preset_execution_api::{app_with_photo_dir, cleanup_photos, db};
use serde_json::{Value, json};
use sqlx::SqlitePool;
use std::path::Path;
use tower::ServiceExt;
const OWNER: &str = "00000000-0000-4000-8000-000000000001";
const OTHER: &str = "00000000-0000-4000-8000-000000000002";
fn png() -> Vec<u8> {
    vec![
        137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 4,
        0, 0, 0, 181, 28, 12, 2, 0, 0, 0, 11, 73, 68, 65, 84, 120, 218, 99, 252, 255, 31, 0, 3, 3,
        2, 0, 239, 191, 105, 153, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ]
}
async fn raw(
    pool: &SqlitePool,
    root: &Path,
    method: &str,
    path: &str,
    mime: &str,
    body: Vec<u8>,
) -> (u16, Vec<u8>) {
    let response = app_with_photo_dir(pool.clone(), root.into())
        .oneshot(
            Request::builder()
                .method(method)
                .uri(path)
                .header("content-type", mime)
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();
    let code = response.status().as_u16();
    if method == "GET" && path.starts_with("/api/photos/") && code == 200 {
        assert_eq!(response.headers()["x-content-type-options"], "nosniff");
        assert_eq!(response.headers()["cache-control"], "no-store");
    }
    (
        code,
        to_bytes(response.into_body(), 12 * 1024 * 1024)
            .await
            .unwrap()
            .to_vec(),
    )
}
async fn json_req(
    pool: &SqlitePool,
    root: &Path,
    method: &str,
    path: &str,
    body: Value,
) -> (u16, Value) {
    let (code, bytes) = raw(
        pool,
        root,
        method,
        path,
        "application/json",
        body.to_string().into_bytes(),
    )
    .await;
    (
        code,
        if bytes.is_empty() {
            Value::Null
        } else {
            serde_json::from_slice(&bytes).unwrap()
        },
    )
}
async fn fixture(pool: &SqlitePool, root: &Path) -> Value {
    let (_, work) = json_req(pool, root, "POST", "/api/entities", json!({"name":"Work"})).await;
    let (_, task) = json_req(
        pool,
        root,
        "POST",
        "/api/task-presets",
        json!({"name":"Task"}),
    )
    .await;
    let (code,s)=json_req(pool,root,"POST","/api/schedules",json!({"entity_id":work["id"],"task_preset_ids":[task["id"]],"scheduled_date":"2026-09-24","start_time":"09:00","end_time":"10:00","time_zone":"Asia/Tokyo"})).await;
    assert_eq!(code, 201);
    s
}
fn uri(kind: &str, id: &str) -> String {
    format!("/api/photos?target_type={kind}&target_id={id}&filename=photo.png")
}
async fn upload(pool: &SqlitePool, root: &Path, kind: &str, id: &str) -> Value {
    let (code, bytes) = raw(pool, root, "POST", &uri(kind, id), "image/png", png()).await;
    assert_eq!(code, 201);
    serde_json::from_slice(&bytes).unwrap()
}
#[tokio::test]
async fn review_five_byte_jpeg_is_not_a_photo() {
 let dir=tempfile::tempdir().unwrap();let pool=db::connect(&dir.path().join("db")).await.unwrap();let root=dir.path().join("photos");let s=fixture(&pool,&root).await;
 let (status,_) = raw(&pool,&root,"POST",&uri("schedule",s["id"].as_str().unwrap()),"image/jpeg",vec![255,216,255,255,217]).await;
 assert_eq!(status,400,"A five-byte marker sequence cannot be decoded as a photograph");
}
#[tokio::test]
async fn review_stale_metadata_edit_must_not_restore_archived_schedule() {
 let dir=tempfile::tempdir().unwrap();let pool=db::connect(&dir.path().join("db")).await.unwrap();let root=dir.path().join("photos");let s=fixture(&pool,&root).await;
 let path=format!("/api/schedules/{}",s["id"].as_str().unwrap());
 json_req(&pool,&root,"DELETE",&path,Value::Null).await;
 // ScheduleEditor includes initial archived:false when the user edits only notes.
 let (_,saved)=json_req(&pool,&root,"PATCH",&path,json!({"notes":"new notes","archived":s["archived"]})).await;
 assert_eq!(saved["archived"],true,"Editing notes in a stale tab must not restore an archived schedule");
}
#[tokio::test]
async fn review_failed_delete_must_not_hide_photo_and_block_cleanup() {
 let dir=tempfile::tempdir().unwrap();let pool=db::connect(&dir.path().join("db")).await.unwrap();let root=dir.path().join("photos");let s=fixture(&pool,&root).await;let id=s["id"].as_str().unwrap();let p=upload(&pool,&root,"schedule",id).await;
 let path=root.join(OWNER).join(format!("{}.png",p["id"].as_str().unwrap()));std::fs::remove_file(&path).unwrap();std::fs::create_dir(&path).unwrap();
 let status=raw(&pool,&root,"DELETE",&format!("/api/photos/{}",p["id"].as_str().unwrap()),"",vec![]).await.0;
 let (_,list)=json_req(&pool,&root,"GET",&uri("schedule",id),Value::Null).await;
 let cleanup_failed=cleanup_photos(&pool,&root).await.is_err();
 println!("REVIEW delete: status={status}, visible={}, startup_cleanup_failed={cleanup_failed}",list.as_array().unwrap().len());
 assert!(!cleanup_failed,"An unremovable pending file prevents main from binding the server");
}
