CREATE UNIQUE INDEX schedule_tasks_owner_id ON schedule_tasks(id,user_id);
CREATE TABLE photos (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id),
 schedule_id TEXT,
 schedule_task_id TEXT,
 filename TEXT NOT NULL CHECK(length(filename) BETWEEN 1 AND 200),
 mime_type TEXT NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp')),
 size_bytes INTEGER NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760),
 state TEXT NOT NULL CHECK(state IN ('pending','ready','deleted')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 CHECK((schedule_id IS NULL) != (schedule_task_id IS NULL)),
 FOREIGN KEY(schedule_id,user_id) REFERENCES schedules(id,user_id),
 FOREIGN KEY(schedule_task_id,user_id) REFERENCES schedule_tasks(id,user_id)
);
CREATE INDEX photos_schedule ON photos(schedule_id,user_id,state);
CREATE INDEX photos_task ON photos(schedule_task_id,user_id,state);
