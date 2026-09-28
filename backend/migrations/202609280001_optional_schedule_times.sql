-- Preserve schedules and every dependent row while allowing empty optional times.
-- Empty strings keep the existing string API compatible; end-only is invalid.

CREATE TABLE "schedules_optional" (track_id TEXT,
 id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), entity_id TEXT,
 title TEXT NOT NULL CHECK(length(title)<=200), scheduled_date TEXT NOT NULL CHECK(length(scheduled_date)=10), end_date TEXT NOT NULL CHECK(length(end_date)=10 AND end_date>=scheduled_date),
 start_time TEXT NOT NULL DEFAULT '' CHECK(start_time='' OR (start_time GLOB '[0-2][0-9]:[0-5][0-9]' AND start_time<'24:00')), end_time TEXT NOT NULL DEFAULT '' CHECK(end_time='' OR (start_time<>'' AND end_time GLOB '[0-2][0-9]:[0-5][0-9]' AND end_time<'24:00' AND (end_date>scheduled_date OR end_time>start_time))),
 time_zone TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '' CHECK(length(notes)<=5000),
 status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','in_progress','completed','cancelled')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), reminder_enabled INTEGER NOT NULL DEFAULT 0 CHECK(reminder_enabled IN (0,1)), reminder_value INTEGER NOT NULL DEFAULT 15 CHECK(reminder_value BETWEEN 1 AND 525600), reminder_unit TEXT NOT NULL DEFAULT 'minutes' CHECK(reminder_unit IN ('minutes','hours','days','weeks')), reminder_at INTEGER, reminder_start_at INTEGER, reminder_version INTEGER NOT NULL DEFAULT 1, color TEXT NOT NULL DEFAULT 'none'
CHECK (color IN ('none', 'red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet')),
 UNIQUE(id,user_id), UNIQUE(id,user_id,track_id), FOREIGN KEY(entity_id,user_id,track_id) REFERENCES "entities"(id,user_id,track_id)
, FOREIGN KEY(track_id,user_id) REFERENCES tracks(id,user_id));

INSERT INTO schedules_optional("track_id","id","user_id","entity_id","title","scheduled_date","end_date","start_time","end_time","time_zone","notes","status","created_at","updated_at","reminder_enabled","reminder_value","reminder_unit","reminder_at","reminder_start_at","reminder_version","color") SELECT "track_id","id","user_id","entity_id","title","scheduled_date","end_date","start_time","end_time","time_zone","notes","status","created_at","updated_at","reminder_enabled","reminder_value","reminder_unit","reminder_at","reminder_start_at","reminder_version","color" FROM schedules;

CREATE TABLE "schedule_entity_snapshot_optional" (
 id TEXT PRIMARY KEY NOT NULL, schedule_id TEXT NOT NULL UNIQUE REFERENCES "schedules_optional"(id),
 definition TEXT NOT NULL CHECK(json_valid(definition)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT INTO schedule_entity_snapshot_optional("id","schedule_id","definition","created_at","updated_at") SELECT "id","schedule_id","definition","created_at","updated_at" FROM schedule_entity_snapshot;

CREATE TABLE "schedule_tasks_optional" (track_id TEXT,
 id TEXT PRIMARY KEY NOT NULL, schedule_id TEXT NOT NULL, user_id TEXT NOT NULL,
 source_task_preset_id TEXT, source_task_preset_version INTEGER NOT NULL CHECK(source_task_preset_version>=1),
 name_snapshot TEXT NOT NULL, default_notes_snapshot TEXT NOT NULL,
 position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 99),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','skipped')),
 started_at TEXT, completed_at TEXT, execution_notes TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), name_template_snapshot TEXT NOT NULL DEFAULT '', parameter_values TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(parameter_values)),
 UNIQUE(schedule_id,position), FOREIGN KEY(schedule_id,user_id,track_id) REFERENCES "schedules_optional"(id,user_id,track_id),
 FOREIGN KEY(source_task_preset_id,user_id,track_id) REFERENCES "task_presets"(id,user_id,track_id)
, UNIQUE(id,user_id), UNIQUE(id,user_id,track_id), FOREIGN KEY(track_id,user_id) REFERENCES tracks(id,user_id));

INSERT INTO schedule_tasks_optional("track_id","id","schedule_id","user_id","source_task_preset_id","source_task_preset_version","name_snapshot","default_notes_snapshot","position","status","started_at","completed_at","execution_notes","created_at","updated_at","name_template_snapshot","parameter_values") SELECT "track_id","id","schedule_id","user_id","source_task_preset_id","source_task_preset_version","name_snapshot","default_notes_snapshot","position","status","started_at","completed_at","execution_notes","created_at","updated_at","name_template_snapshot","parameter_values" FROM schedule_tasks;

CREATE TABLE "schedule_task_items_optional" (
 id TEXT PRIMARY KEY NOT NULL, schedule_task_id TEXT NOT NULL REFERENCES "schedule_tasks_optional"(id),
 source_preset_item_id TEXT NOT NULL, position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 99),
 definition TEXT NOT NULL CHECK(json_valid(definition)),
 value_boolean INTEGER CHECK(value_boolean IN (0,1)), value_text TEXT, value_number REAL,
 completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)), completed_at TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(schedule_task_id,position)
);

INSERT INTO schedule_task_items_optional("id","schedule_task_id","source_preset_item_id","position","definition","value_boolean","value_text","value_number","completed","completed_at","created_at","updated_at") SELECT "id","schedule_task_id","source_preset_item_id","position","definition","value_boolean","value_text","value_number","completed","completed_at","created_at","updated_at" FROM schedule_task_items;

CREATE TABLE "photos_optional" (track_id TEXT,
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
 FOREIGN KEY(schedule_id,user_id,track_id) REFERENCES "schedules_optional"(id,user_id,track_id),
 FOREIGN KEY(schedule_task_id,user_id,track_id) REFERENCES "schedule_tasks_optional"(id,user_id,track_id)
, FOREIGN KEY(track_id,user_id) REFERENCES tracks(id,user_id));

INSERT INTO photos_optional("track_id","id","user_id","schedule_id","schedule_task_id","filename","mime_type","size_bytes","state","created_at","updated_at") SELECT "track_id","id","user_id","schedule_id","schedule_task_id","filename","mime_type","size_bytes","state","created_at","updated_at" FROM photos;

CREATE TABLE "push_deliveries_optional" (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  schedule_id TEXT NOT NULL REFERENCES "schedules_optional"(id),
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

INSERT INTO push_deliveries_optional("id","subscription_id","schedule_id","reminder_version","status","attempts","available_at","lease_until","lease_token","result_code","updated_at") SELECT "id","subscription_id","schedule_id","reminder_version","status","attempts","available_at","lease_until","lease_token","result_code","updated_at" FROM push_deliveries;

DROP TRIGGER "schedule_reminder_version";

DROP TRIGGER "schedules_default_track";

DROP TRIGGER "schedules_track_immutable";

DROP TRIGGER "schedule_tasks_default_track";

DROP TRIGGER "schedule_tasks_track_immutable";

DROP TRIGGER "photos_default_track";

DROP TRIGGER "photos_track_immutable";

DROP TRIGGER "track_revision_schedules_insert";

DROP TRIGGER "track_revision_schedules_update";

DROP TRIGGER "track_revision_schedules_delete";

DROP TRIGGER "track_revision_schedule_tasks_insert";

DROP TRIGGER "track_revision_schedule_tasks_update";

DROP TRIGGER "track_revision_schedule_tasks_delete";

DROP TRIGGER "track_revision_schedule_task_items_insert";

DROP TRIGGER "track_revision_schedule_task_items_update";

DROP TRIGGER "track_revision_schedule_task_items_delete";

DROP TRIGGER "track_revision_schedule_entity_snapshot_insert";

DROP TRIGGER "track_revision_schedule_entity_snapshot_update";

DROP TRIGGER "track_revision_schedule_entity_snapshot_delete";

DROP TABLE push_deliveries;

DROP TABLE photos;

DROP TABLE schedule_task_items;

DROP TABLE schedule_tasks;

DROP TABLE schedule_entity_snapshot;

DROP TABLE schedules;

ALTER TABLE schedules_optional RENAME TO schedules;

ALTER TABLE schedule_entity_snapshot_optional RENAME TO schedule_entity_snapshot;

ALTER TABLE schedule_tasks_optional RENAME TO schedule_tasks;

ALTER TABLE schedule_task_items_optional RENAME TO schedule_task_items;

ALTER TABLE photos_optional RENAME TO photos;

ALTER TABLE push_deliveries_optional RENAME TO push_deliveries;

CREATE INDEX schedules_owner_date ON schedules(user_id,track_id,scheduled_date,start_time,id);

CREATE INDEX schedules_owner_end_date ON schedules(user_id,track_id,end_date);

CREATE INDEX schedules_entity ON schedules(entity_id,user_id,track_id);

CREATE INDEX schedule_tasks_source ON schedule_tasks(source_task_preset_id,user_id,track_id);

CREATE INDEX photos_schedule ON photos(schedule_id,user_id,track_id,state);

CREATE INDEX photos_task ON photos(schedule_task_id,user_id,track_id,state);

CREATE INDEX schedules_reminders ON schedules(user_id, reminder_at) WHERE reminder_enabled=1;

CREATE INDEX push_ready ON push_deliveries(status,available_at,lease_until);

CREATE INDEX schedules_entity_lookup ON schedules(user_id,track_id,entity_id);

CREATE INDEX schedule_tasks_source_lookup ON schedule_tasks(user_id,track_id,source_task_preset_id);

CREATE TRIGGER schedule_reminder_version AFTER UPDATE OF reminder_enabled,reminder_value,reminder_unit,scheduled_date,start_time,time_zone ON schedules
WHEN OLD.reminder_enabled!=NEW.reminder_enabled OR OLD.reminder_value!=NEW.reminder_value OR OLD.reminder_unit!=NEW.reminder_unit OR OLD.scheduled_date!=NEW.scheduled_date OR OLD.start_time!=NEW.start_time OR OLD.time_zone!=NEW.time_zone
BEGIN
  UPDATE schedules SET reminder_version=OLD.reminder_version+1 WHERE id=NEW.id;
END;

CREATE TRIGGER schedules_default_track AFTER INSERT ON schedules WHEN NEW.track_id IS NULL BEGIN
 UPDATE schedules SET track_id=NEW.user_id WHERE id=NEW.id;
END;

CREATE TRIGGER schedules_track_immutable BEFORE UPDATE OF track_id,user_id ON schedules WHEN NEW.track_id IS NULL OR (OLD.track_id IS NOT NULL AND (NEW.track_id<>OLD.track_id OR NEW.user_id<>OLD.user_id)) BEGIN SELECT RAISE(ABORT,'Track ownership is immutable'); END;

CREATE TRIGGER schedule_tasks_default_track AFTER INSERT ON schedule_tasks WHEN NEW.track_id IS NULL BEGIN
 UPDATE schedule_tasks SET track_id=NEW.user_id WHERE id=NEW.id;
END;

CREATE TRIGGER schedule_tasks_track_immutable BEFORE UPDATE OF track_id,user_id ON schedule_tasks WHEN NEW.track_id IS NULL OR (OLD.track_id IS NOT NULL AND (NEW.track_id<>OLD.track_id OR NEW.user_id<>OLD.user_id)) BEGIN SELECT RAISE(ABORT,'Track ownership is immutable'); END;

CREATE TRIGGER photos_default_track AFTER INSERT ON photos WHEN NEW.track_id IS NULL BEGIN
 UPDATE photos SET track_id=NEW.user_id WHERE id=NEW.id;
END;

CREATE TRIGGER photos_track_immutable BEFORE UPDATE OF track_id,user_id ON photos WHEN NEW.track_id IS NULL OR (OLD.track_id IS NOT NULL AND (NEW.track_id<>OLD.track_id OR NEW.user_id<>OLD.user_id)) BEGIN SELECT RAISE(ABORT,'Track ownership is immutable'); END;

CREATE TRIGGER track_revision_schedules_insert AFTER INSERT ON schedules BEGIN UPDATE tracks SET revision=revision+1 WHERE id=NEW.track_id; END;

CREATE TRIGGER track_revision_schedules_update AFTER UPDATE ON schedules BEGIN UPDATE tracks SET revision=revision+1 WHERE id=NEW.track_id; END;

CREATE TRIGGER track_revision_schedules_delete AFTER DELETE ON schedules BEGIN UPDATE tracks SET revision=revision+1 WHERE id=OLD.track_id; END;

CREATE TRIGGER track_revision_schedule_tasks_insert AFTER INSERT ON schedule_tasks BEGIN UPDATE tracks SET revision=revision+1 WHERE id=NEW.track_id; END;

CREATE TRIGGER track_revision_schedule_tasks_update AFTER UPDATE ON schedule_tasks BEGIN UPDATE tracks SET revision=revision+1 WHERE id=NEW.track_id; END;

CREATE TRIGGER track_revision_schedule_tasks_delete AFTER DELETE ON schedule_tasks BEGIN UPDATE tracks SET revision=revision+1 WHERE id=OLD.track_id; END;

CREATE TRIGGER track_revision_schedule_task_items_insert AFTER INSERT ON schedule_task_items BEGIN UPDATE tracks SET revision=revision+1 WHERE id=(SELECT track_id FROM schedule_tasks WHERE id=NEW.schedule_task_id); END;

CREATE TRIGGER track_revision_schedule_task_items_update AFTER UPDATE ON schedule_task_items BEGIN UPDATE tracks SET revision=revision+1 WHERE id=(SELECT track_id FROM schedule_tasks WHERE id=NEW.schedule_task_id); END;

CREATE TRIGGER track_revision_schedule_task_items_delete AFTER DELETE ON schedule_task_items BEGIN UPDATE tracks SET revision=revision+1 WHERE id=(SELECT track_id FROM schedule_tasks WHERE id=OLD.schedule_task_id); END;

CREATE TRIGGER track_revision_schedule_entity_snapshot_insert AFTER INSERT ON schedule_entity_snapshot BEGIN UPDATE tracks SET revision=revision+1 WHERE id=(SELECT track_id FROM schedules WHERE id=NEW.schedule_id); END;

CREATE TRIGGER track_revision_schedule_entity_snapshot_update AFTER UPDATE ON schedule_entity_snapshot BEGIN UPDATE tracks SET revision=revision+1 WHERE id=(SELECT track_id FROM schedules WHERE id=NEW.schedule_id); END;

CREATE TRIGGER track_revision_schedule_entity_snapshot_delete AFTER DELETE ON schedule_entity_snapshot BEGIN UPDATE tracks SET revision=revision+1 WHERE id=(SELECT track_id FROM schedules WHERE id=OLD.schedule_id); END;
