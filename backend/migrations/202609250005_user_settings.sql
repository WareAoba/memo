-- User settings and nullable source links for independent preset resets.
ALTER TABLE users ADD COLUMN settings_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(settings_json));
DROP TRIGGER revision_schedules_insert;
DROP TRIGGER revision_schedules_update;
DROP TRIGGER revision_schedules_delete;
DROP TRIGGER revision_schedule_tasks_insert;
DROP TRIGGER revision_schedule_tasks_update;
DROP TRIGGER revision_schedule_tasks_delete;
DROP TRIGGER revision_schedule_task_items_insert;
DROP TRIGGER revision_schedule_task_items_update;
DROP TRIGGER revision_schedule_task_items_delete;
DROP TRIGGER schedule_reminder_version;
CREATE TABLE "schedules_settings" (
 id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), entity_id TEXT,
 title TEXT NOT NULL CHECK(length(title)<=200), scheduled_date TEXT NOT NULL CHECK(length(scheduled_date)=10), end_date TEXT NOT NULL CHECK(length(end_date)=10 AND end_date>=scheduled_date),
 start_time TEXT NOT NULL CHECK(length(start_time)=5), end_time TEXT NOT NULL CHECK(length(end_time)=5 AND (end_date>scheduled_date OR end_time>start_time)),
 time_zone TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '' CHECK(length(notes)<=5000),
 status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','in_progress','completed','cancelled')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), reminder_enabled INTEGER NOT NULL DEFAULT 0 CHECK(reminder_enabled IN (0,1)), reminder_value INTEGER NOT NULL DEFAULT 15 CHECK(reminder_value BETWEEN 1 AND 525600), reminder_unit TEXT NOT NULL DEFAULT 'minutes' CHECK(reminder_unit IN ('minutes','hours','days','weeks')), reminder_at INTEGER, reminder_start_at INTEGER, reminder_version INTEGER NOT NULL DEFAULT 1,
 UNIQUE(id,user_id), FOREIGN KEY(entity_id,user_id) REFERENCES entities(id,user_id)
);
CREATE TABLE "schedule_entity_snapshot_settings" (
 id TEXT PRIMARY KEY NOT NULL, schedule_id TEXT NOT NULL UNIQUE REFERENCES "schedules_settings"(id),
 definition TEXT NOT NULL CHECK(json_valid(definition)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE "schedule_tasks_settings" (
 id TEXT PRIMARY KEY NOT NULL, schedule_id TEXT NOT NULL, user_id TEXT NOT NULL,
 source_task_preset_id TEXT, source_task_preset_version INTEGER NOT NULL CHECK(source_task_preset_version>=1),
 name_snapshot TEXT NOT NULL, default_notes_snapshot TEXT NOT NULL,
 position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 99),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','skipped')),
 started_at TEXT, completed_at TEXT, execution_notes TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), name_template_snapshot TEXT NOT NULL DEFAULT '', parameter_values TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(parameter_values)),
 UNIQUE(schedule_id,position), FOREIGN KEY(schedule_id,user_id) REFERENCES "schedules_settings"(id,user_id),
 FOREIGN KEY(source_task_preset_id,user_id) REFERENCES task_presets(id,user_id)
, UNIQUE(id,user_id));
CREATE TABLE "schedule_task_items_settings" (
 id TEXT PRIMARY KEY NOT NULL, schedule_task_id TEXT NOT NULL REFERENCES "schedule_tasks_settings"(id),
 source_preset_item_id TEXT NOT NULL, position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 99),
 definition TEXT NOT NULL CHECK(json_valid(definition)),
 value_boolean INTEGER CHECK(value_boolean IN (0,1)), value_text TEXT, value_number REAL,
 completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)), completed_at TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(schedule_task_id,position)
);
CREATE TABLE photos_settings (
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
 FOREIGN KEY(schedule_id,user_id) REFERENCES schedules_settings(id,user_id),
 FOREIGN KEY(schedule_task_id,user_id) REFERENCES schedule_tasks_settings(id,user_id)
);
CREATE TABLE push_deliveries_settings (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  schedule_id TEXT NOT NULL REFERENCES schedules_settings(id),
  reminder_version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at INTEGER NOT NULL DEFAULT (unixepoch()),
  lease_until INTEGER,
  lease_token TEXT,
  result_code TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(subscription_id,schedule_id,reminder_version)
);
INSERT INTO schedules_settings SELECT * FROM schedules;
INSERT INTO schedule_entity_snapshot_settings SELECT * FROM schedule_entity_snapshot;
INSERT INTO schedule_tasks_settings SELECT * FROM schedule_tasks;
INSERT INTO schedule_task_items_settings SELECT * FROM schedule_task_items;
INSERT INTO photos_settings SELECT * FROM photos;
INSERT INTO push_deliveries_settings SELECT * FROM push_deliveries;
DROP TABLE push_deliveries;
DROP TABLE photos;
DROP TABLE schedule_task_items;
DROP TABLE schedule_tasks;
DROP TABLE schedule_entity_snapshot;
DROP TABLE schedules;
ALTER TABLE schedules_settings RENAME TO schedules;
ALTER TABLE schedule_entity_snapshot_settings RENAME TO schedule_entity_snapshot;
ALTER TABLE schedule_tasks_settings RENAME TO schedule_tasks;
ALTER TABLE schedule_task_items_settings RENAME TO schedule_task_items;
ALTER TABLE photos_settings RENAME TO photos;
ALTER TABLE push_deliveries_settings RENAME TO push_deliveries;
CREATE INDEX schedules_owner_date ON schedules(user_id,scheduled_date,start_time,id);
CREATE INDEX schedules_owner_end_date ON schedules(user_id,end_date);
CREATE INDEX schedules_entity ON schedules(entity_id,user_id);
CREATE INDEX schedule_tasks_source ON schedule_tasks(source_task_preset_id,user_id);
CREATE UNIQUE INDEX schedule_tasks_owner_id ON schedule_tasks(id,user_id);
CREATE INDEX photos_schedule ON photos(schedule_id,user_id,state);
CREATE INDEX photos_task ON photos(schedule_task_id,user_id,state);
CREATE TRIGGER revision_schedules_insert AFTER INSERT ON schedules BEGIN
 INSERT INTO schedule_revisions(user_id,revision) VALUES(NEW.user_id,1)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER revision_schedules_update AFTER UPDATE ON schedules BEGIN
 INSERT INTO schedule_revisions(user_id,revision) VALUES(NEW.user_id,1)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER revision_schedules_delete AFTER DELETE ON schedules BEGIN
 INSERT INTO schedule_revisions(user_id,revision) VALUES(OLD.user_id,1)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER revision_schedule_tasks_insert AFTER INSERT ON schedule_tasks BEGIN
 INSERT INTO schedule_revisions(user_id,revision) VALUES(NEW.user_id,1)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER revision_schedule_tasks_update AFTER UPDATE ON schedule_tasks BEGIN
 INSERT INTO schedule_revisions(user_id,revision) VALUES(NEW.user_id,1)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER revision_schedule_tasks_delete AFTER DELETE ON schedule_tasks BEGIN
 INSERT INTO schedule_revisions(user_id,revision) VALUES(OLD.user_id,1)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER revision_schedule_task_items_insert AFTER INSERT ON schedule_task_items BEGIN
 INSERT INTO schedule_revisions(user_id,revision) VALUES((SELECT user_id FROM schedule_tasks WHERE id=NEW.schedule_task_id),1)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER revision_schedule_task_items_update AFTER UPDATE ON schedule_task_items BEGIN
 INSERT INTO schedule_revisions(user_id,revision) VALUES((SELECT user_id FROM schedule_tasks WHERE id=NEW.schedule_task_id),1)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER revision_schedule_task_items_delete AFTER DELETE ON schedule_task_items BEGIN
 INSERT INTO schedule_revisions(user_id,revision) VALUES((SELECT user_id FROM schedule_tasks WHERE id=OLD.schedule_task_id),1)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;
CREATE INDEX schedules_reminders ON schedules(user_id, reminder_at) WHERE reminder_enabled=1;
CREATE TRIGGER schedule_reminder_version AFTER UPDATE OF reminder_enabled,reminder_value,reminder_unit,scheduled_date,start_time,time_zone ON schedules
WHEN OLD.reminder_enabled!=NEW.reminder_enabled OR OLD.reminder_value!=NEW.reminder_value OR OLD.reminder_unit!=NEW.reminder_unit OR OLD.scheduled_date!=NEW.scheduled_date OR OLD.start_time!=NEW.start_time OR OLD.time_zone!=NEW.time_zone
BEGIN
  UPDATE schedules SET reminder_version=OLD.reminder_version+1 WHERE id=NEW.id;
END;
CREATE INDEX push_ready ON push_deliveries(status,available_at,lease_until);
CREATE TABLE photo_deletions (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), mime_type TEXT NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp')));
