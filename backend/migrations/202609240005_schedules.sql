CREATE TABLE schedules (
 id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), entity_id TEXT NOT NULL,
 title TEXT NOT NULL CHECK(length(title)<=200), scheduled_date TEXT NOT NULL CHECK(length(scheduled_date)=10),
 start_time TEXT NOT NULL CHECK(length(start_time)=5), end_time TEXT NOT NULL CHECK(length(end_time)=5 AND end_time>start_time),
 time_zone TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '' CHECK(length(notes)<=5000),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','skipped')),
 deleted_at TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(id,user_id), FOREIGN KEY(entity_id,user_id) REFERENCES entities(id,user_id)
);
CREATE INDEX schedules_owner_date ON schedules(user_id,scheduled_date,start_time,id);
CREATE INDEX schedules_entity ON schedules(entity_id,user_id);
CREATE TABLE schedule_entity_snapshot (
 id TEXT PRIMARY KEY NOT NULL, schedule_id TEXT NOT NULL UNIQUE REFERENCES schedules(id),
 definition TEXT NOT NULL CHECK(json_valid(definition)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE schedule_tasks (
 id TEXT PRIMARY KEY NOT NULL, schedule_id TEXT NOT NULL, user_id TEXT NOT NULL,
 source_task_preset_id TEXT NOT NULL, source_task_preset_version INTEGER NOT NULL CHECK(source_task_preset_version>=1),
 name_snapshot TEXT NOT NULL, default_notes_snapshot TEXT NOT NULL,
 position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 99),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','skipped')),
 started_at TEXT, completed_at TEXT, execution_notes TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(schedule_id,position), FOREIGN KEY(schedule_id,user_id) REFERENCES schedules(id,user_id),
 FOREIGN KEY(source_task_preset_id,user_id) REFERENCES task_presets(id,user_id)
);
CREATE INDEX schedule_tasks_source ON schedule_tasks(source_task_preset_id,user_id);
CREATE TABLE schedule_task_items (
 id TEXT PRIMARY KEY NOT NULL, schedule_task_id TEXT NOT NULL REFERENCES schedule_tasks(id),
 source_preset_item_id TEXT NOT NULL, position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 99),
 definition TEXT NOT NULL CHECK(json_valid(definition)),
 value_boolean INTEGER CHECK(value_boolean IN (0,1)), value_text TEXT, value_number REAL,
 completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)), completed_at TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(schedule_task_id,position)
);
