-- Preserve IDs and photo paths; default track ID equals its account ID.
ALTER TABLE users ADD COLUMN track_limit INTEGER NOT NULL DEFAULT 3 CHECK(track_limit>=1);
CREATE TABLE tracks (
 id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL REFERENCES users(id),
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 80),
 revision INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(id,user_id)
);
CREATE INDEX tracks_owner ON tracks(user_id,created_at,id);
INSERT INTO tracks(id,user_id,name) SELECT id,id,'My Track' FROM users;
CREATE TRIGGER account_default_track AFTER INSERT ON users BEGIN
 INSERT INTO tracks(id,user_id,name) VALUES(NEW.id,NEW.id,'My Track');
END;
DROP TRIGGER "revision_schedules_insert";
DROP TRIGGER "revision_schedules_update";
DROP TRIGGER "revision_schedules_delete";
DROP TRIGGER "revision_schedule_tasks_insert";
DROP TRIGGER "revision_schedule_tasks_update";
DROP TRIGGER "revision_schedule_tasks_delete";
DROP TRIGGER "revision_schedule_task_items_insert";
DROP TRIGGER "revision_schedule_task_items_update";
DROP TRIGGER "revision_schedule_task_items_delete";
DROP TRIGGER "schedule_reminder_version";
CREATE TABLE "entities_tracks" (track_id TEXT,
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id),
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
 reference_code TEXT NOT NULL DEFAULT '' CHECK(length(reference_code) <= 100),
 address TEXT NOT NULL DEFAULT '' CHECK(length(address) <= 500),
 contact_name TEXT NOT NULL DEFAULT '' CHECK(length(contact_name) <= 200),
 contact_info TEXT NOT NULL DEFAULT '' CHECK(length(contact_info) <= 500),
 advance_contact_required INTEGER NOT NULL DEFAULT 0 CHECK(advance_contact_required IN (0,1)),
 notice_required INTEGER NOT NULL DEFAULT 0 CHECK(notice_required IN (0,1)),
 default_work_start_time TEXT,
 default_work_end_time TEXT,
 access_instructions TEXT NOT NULL DEFAULT '' CHECK(length(access_instructions) <= 5000),
 parking_info TEXT NOT NULL DEFAULT '' CHECK(length(parking_info) <= 5000),
 special_notes TEXT NOT NULL DEFAULT '' CHECK(length(special_notes) <= 5000),
 general_notes TEXT NOT NULL DEFAULT '' CHECK(length(general_notes) <= 5000),
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), custom_fields TEXT NOT NULL DEFAULT '[]', unmanaged INTEGER NOT NULL DEFAULT 0 CHECK(unmanaged IN (0,1)),
 UNIQUE(id,user_id), UNIQUE(id,user_id,track_id),
 CHECK((default_work_start_time IS NULL AND default_work_end_time IS NULL) OR
 (default_work_start_time IS NOT NULL AND default_work_end_time IS NOT NULL AND
 default_work_start_time GLOB '[0-2][0-9]:[0-5][0-9]' AND default_work_start_time < '24:00' AND
 default_work_end_time GLOB '[0-2][0-9]:[0-5][0-9]' AND default_work_end_time < '24:00' AND
 default_work_start_time < default_work_end_time))
, FOREIGN KEY(track_id,user_id) REFERENCES tracks(id,user_id));
INSERT INTO entities_tracks(id,user_id,name,reference_code,address,contact_name,contact_info,advance_contact_required,notice_required,default_work_start_time,default_work_end_time,access_instructions,parking_info,special_notes,general_notes,archived,created_at,updated_at,custom_fields,unmanaged,track_id) SELECT id,user_id,name,reference_code,address,contact_name,contact_info,advance_contact_required,notice_required,default_work_start_time,default_work_end_time,access_instructions,parking_info,special_notes,general_notes,archived,created_at,updated_at,custom_fields,unmanaged,user_id FROM entities;
CREATE TABLE "tags_tracks" (track_id TEXT,
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id),
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 50),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(user_id,track_id,name),
 UNIQUE(id,user_id), UNIQUE(id,user_id,track_id)
, FOREIGN KEY(track_id,user_id) REFERENCES tracks(id,user_id));
INSERT INTO tags_tracks(id,user_id,name,created_at,updated_at,track_id) SELECT id,user_id,name,created_at,updated_at,user_id FROM tags;
CREATE TABLE "task_presets_tracks" (track_id TEXT,
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id),
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
 default_notes TEXT NOT NULL DEFAULT '' CHECK(length(default_notes) <= 5000),
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), group_name TEXT NOT NULL DEFAULT '', unmanaged INTEGER NOT NULL DEFAULT 0 CHECK(unmanaged IN (0,1)),
 UNIQUE(id,user_id), UNIQUE(id,user_id,track_id)
, FOREIGN KEY(track_id,user_id) REFERENCES tracks(id,user_id));
INSERT INTO task_presets_tracks(id,user_id,name,default_notes,archived,version,created_at,updated_at,group_name,unmanaged,track_id) SELECT id,user_id,name,default_notes,archived,version,created_at,updated_at,group_name,unmanaged,user_id FROM task_presets;
CREATE TABLE "work_field_names_tracks" (track_id TEXT,user_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, PRIMARY KEY(user_id,track_id,name), FOREIGN KEY(track_id,user_id) REFERENCES tracks(id,user_id));
INSERT INTO work_field_names_tracks(user_id,name,track_id) SELECT user_id,name,user_id FROM work_field_names;
CREATE TABLE "entity_tags_tracks" (track_id TEXT,
 entity_id TEXT NOT NULL,
 tag_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 PRIMARY KEY(entity_id, tag_id),
 FOREIGN KEY(entity_id,user_id,track_id) REFERENCES "entities_tracks"(id,user_id,track_id),
 FOREIGN KEY(tag_id,user_id,track_id) REFERENCES "tags_tracks"(id,user_id,track_id)
, FOREIGN KEY(track_id,user_id) REFERENCES tracks(id,user_id));
INSERT INTO entity_tags_tracks(entity_id,tag_id,user_id,track_id) SELECT entity_id,tag_id,user_id,user_id FROM entity_tags;
CREATE TABLE "task_preset_tags_tracks" (track_id TEXT,
 task_preset_id TEXT NOT NULL,
 tag_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 PRIMARY KEY(task_preset_id,tag_id),
 FOREIGN KEY(task_preset_id,user_id,track_id) REFERENCES "task_presets_tracks"(id,user_id,track_id),
 FOREIGN KEY(tag_id,user_id,track_id) REFERENCES "tags_tracks"(id,user_id,track_id)
, FOREIGN KEY(track_id,user_id) REFERENCES tracks(id,user_id));
INSERT INTO task_preset_tags_tracks(task_preset_id,tag_id,user_id,track_id) SELECT task_preset_id,tag_id,user_id,user_id FROM task_preset_tags;
CREATE TABLE "task_preset_items_tracks" (
 id TEXT PRIMARY KEY NOT NULL,
 task_preset_id TEXT NOT NULL REFERENCES "task_presets_tracks"(id),
 position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 99),
 label TEXT NOT NULL CHECK(length(trim(label)) BETWEEN 1 AND 200),
 item_type TEXT NOT NULL CHECK(item_type IN ('checkbox','text','number')),
 required INTEGER NOT NULL DEFAULT 0 CHECK(required IN (0,1)),
 default_value TEXT NOT NULL DEFAULT 'null' CHECK(json_valid(default_value)),
 unit TEXT NOT NULL DEFAULT '' CHECK(length(unit) <= 50),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(task_preset_id,position),
 CHECK(unit = '' OR item_type = 'number'),
 CHECK(json_type(default_value) = 'null' OR
   (item_type='checkbox' AND json_type(default_value) IN ('true','false')) OR
   (item_type='text' AND json_type(default_value)='text' AND length(json_extract(default_value,'$')) <= 5000) OR
   (item_type='number' AND json_type(default_value) IN ('integer','real')))
);
INSERT INTO task_preset_items_tracks(id,task_preset_id,position,label,item_type,required,default_value,unit,created_at,updated_at) SELECT id,task_preset_id,position,label,item_type,required,default_value,unit,created_at,updated_at FROM task_preset_items;
CREATE TABLE "work_task_presets_tracks" (track_id TEXT,
 entity_id TEXT NOT NULL,
 task_preset_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 99),
 PRIMARY KEY(entity_id,task_preset_id),
 UNIQUE(entity_id,position),
 FOREIGN KEY(entity_id,user_id,track_id) REFERENCES "entities_tracks"(id,user_id,track_id),
 FOREIGN KEY(task_preset_id,user_id,track_id) REFERENCES "task_presets_tracks"(id,user_id,track_id)
, FOREIGN KEY(track_id,user_id) REFERENCES tracks(id,user_id));
INSERT INTO work_task_presets_tracks(entity_id,task_preset_id,user_id,position,track_id) SELECT entity_id,task_preset_id,user_id,position,user_id FROM work_task_presets;
CREATE TABLE "schedules_tracks" (track_id TEXT,
 id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), entity_id TEXT,
 title TEXT NOT NULL CHECK(length(title)<=200), scheduled_date TEXT NOT NULL CHECK(length(scheduled_date)=10), end_date TEXT NOT NULL CHECK(length(end_date)=10 AND end_date>=scheduled_date),
 start_time TEXT NOT NULL CHECK(length(start_time)=5), end_time TEXT NOT NULL CHECK(length(end_time)=5 AND (end_date>scheduled_date OR end_time>start_time)),
 time_zone TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '' CHECK(length(notes)<=5000),
 status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','in_progress','completed','cancelled')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), reminder_enabled INTEGER NOT NULL DEFAULT 0 CHECK(reminder_enabled IN (0,1)), reminder_value INTEGER NOT NULL DEFAULT 15 CHECK(reminder_value BETWEEN 1 AND 525600), reminder_unit TEXT NOT NULL DEFAULT 'minutes' CHECK(reminder_unit IN ('minutes','hours','days','weeks')), reminder_at INTEGER, reminder_start_at INTEGER, reminder_version INTEGER NOT NULL DEFAULT 1, color TEXT NOT NULL DEFAULT 'none'
CHECK (color IN ('none', 'red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet')),
 UNIQUE(id,user_id), UNIQUE(id,user_id,track_id), FOREIGN KEY(entity_id,user_id,track_id) REFERENCES "entities_tracks"(id,user_id,track_id)
, FOREIGN KEY(track_id,user_id) REFERENCES tracks(id,user_id));
INSERT INTO schedules_tracks(id,user_id,entity_id,title,scheduled_date,end_date,start_time,end_time,time_zone,notes,status,created_at,updated_at,reminder_enabled,reminder_value,reminder_unit,reminder_at,reminder_start_at,reminder_version,color,track_id) SELECT id,user_id,entity_id,title,scheduled_date,end_date,start_time,end_time,time_zone,notes,status,created_at,updated_at,reminder_enabled,reminder_value,reminder_unit,reminder_at,reminder_start_at,reminder_version,color,user_id FROM schedules;
CREATE TABLE "schedule_entity_snapshot_tracks" (
 id TEXT PRIMARY KEY NOT NULL, schedule_id TEXT NOT NULL UNIQUE REFERENCES "schedules_tracks"(id),
 definition TEXT NOT NULL CHECK(json_valid(definition)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO schedule_entity_snapshot_tracks(id,schedule_id,definition,created_at,updated_at) SELECT id,schedule_id,definition,created_at,updated_at FROM schedule_entity_snapshot;
CREATE TABLE "schedule_tasks_tracks" (track_id TEXT,
 id TEXT PRIMARY KEY NOT NULL, schedule_id TEXT NOT NULL, user_id TEXT NOT NULL,
 source_task_preset_id TEXT, source_task_preset_version INTEGER NOT NULL CHECK(source_task_preset_version>=1),
 name_snapshot TEXT NOT NULL, default_notes_snapshot TEXT NOT NULL,
 position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 99),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','skipped')),
 started_at TEXT, completed_at TEXT, execution_notes TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), name_template_snapshot TEXT NOT NULL DEFAULT '', parameter_values TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(parameter_values)),
 UNIQUE(schedule_id,position), FOREIGN KEY(schedule_id,user_id,track_id) REFERENCES "schedules_tracks"(id,user_id,track_id),
 FOREIGN KEY(source_task_preset_id,user_id,track_id) REFERENCES "task_presets_tracks"(id,user_id,track_id)
, UNIQUE(id,user_id), UNIQUE(id,user_id,track_id), FOREIGN KEY(track_id,user_id) REFERENCES tracks(id,user_id));
INSERT INTO schedule_tasks_tracks(id,schedule_id,user_id,source_task_preset_id,source_task_preset_version,name_snapshot,default_notes_snapshot,position,status,started_at,completed_at,execution_notes,created_at,updated_at,name_template_snapshot,parameter_values,track_id) SELECT id,schedule_id,user_id,source_task_preset_id,source_task_preset_version,name_snapshot,default_notes_snapshot,position,status,started_at,completed_at,execution_notes,created_at,updated_at,name_template_snapshot,parameter_values,user_id FROM schedule_tasks;
CREATE TABLE "schedule_task_items_tracks" (
 id TEXT PRIMARY KEY NOT NULL, schedule_task_id TEXT NOT NULL REFERENCES "schedule_tasks_tracks"(id),
 source_preset_item_id TEXT NOT NULL, position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 99),
 definition TEXT NOT NULL CHECK(json_valid(definition)),
 value_boolean INTEGER CHECK(value_boolean IN (0,1)), value_text TEXT, value_number REAL,
 completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)), completed_at TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(schedule_task_id,position)
);
INSERT INTO schedule_task_items_tracks(id,schedule_task_id,source_preset_item_id,position,definition,value_boolean,value_text,value_number,completed,completed_at,created_at,updated_at) SELECT id,schedule_task_id,source_preset_item_id,position,definition,value_boolean,value_text,value_number,completed,completed_at,created_at,updated_at FROM schedule_task_items;
CREATE TABLE "photos_tracks" (track_id TEXT,
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
 FOREIGN KEY(schedule_id,user_id,track_id) REFERENCES "schedules_tracks"(id,user_id,track_id),
 FOREIGN KEY(schedule_task_id,user_id,track_id) REFERENCES "schedule_tasks_tracks"(id,user_id,track_id)
, FOREIGN KEY(track_id,user_id) REFERENCES tracks(id,user_id));
INSERT INTO photos_tracks(id,user_id,schedule_id,schedule_task_id,filename,mime_type,size_bytes,state,created_at,updated_at,track_id) SELECT id,user_id,schedule_id,schedule_task_id,filename,mime_type,size_bytes,state,created_at,updated_at,user_id FROM photos;
CREATE TABLE "push_deliveries_tracks" (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  schedule_id TEXT NOT NULL REFERENCES "schedules_tracks"(id),
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
INSERT INTO push_deliveries_tracks(id,subscription_id,schedule_id,reminder_version,status,attempts,available_at,lease_until,lease_token,result_code,updated_at) SELECT id,subscription_id,schedule_id,reminder_version,status,attempts,available_at,lease_until,lease_token,result_code,updated_at FROM push_deliveries;
DROP TABLE push_deliveries;
DROP TABLE photos;
DROP TABLE schedule_task_items;
DROP TABLE schedule_tasks;
DROP TABLE schedule_entity_snapshot;
DROP TABLE schedules;
DROP TABLE work_task_presets;
DROP TABLE task_preset_items;
DROP TABLE task_preset_tags;
DROP TABLE entity_tags;
DROP TABLE work_field_names;
DROP TABLE task_presets;
DROP TABLE tags;
DROP TABLE entities;
ALTER TABLE entities_tracks RENAME TO entities;
ALTER TABLE tags_tracks RENAME TO tags;
ALTER TABLE task_presets_tracks RENAME TO task_presets;
ALTER TABLE work_field_names_tracks RENAME TO work_field_names;
ALTER TABLE entity_tags_tracks RENAME TO entity_tags;
ALTER TABLE task_preset_tags_tracks RENAME TO task_preset_tags;
ALTER TABLE task_preset_items_tracks RENAME TO task_preset_items;
ALTER TABLE work_task_presets_tracks RENAME TO work_task_presets;
ALTER TABLE schedules_tracks RENAME TO schedules;
ALTER TABLE schedule_entity_snapshot_tracks RENAME TO schedule_entity_snapshot;
ALTER TABLE schedule_tasks_tracks RENAME TO schedule_tasks;
ALTER TABLE schedule_task_items_tracks RENAME TO schedule_task_items;
ALTER TABLE photos_tracks RENAME TO photos;
ALTER TABLE push_deliveries_tracks RENAME TO push_deliveries;
CREATE INDEX entities_owner_list ON entities(user_id,track_id, archived, name, id);
CREATE INDEX entity_tags_tag ON entity_tags(tag_id, user_id,track_id);
CREATE INDEX task_presets_owner_list ON task_presets(user_id,track_id,archived,name,id);
CREATE INDEX task_preset_tags_tag ON task_preset_tags(tag_id,user_id,track_id);
CREATE INDEX work_task_presets_task ON work_task_presets(task_preset_id,user_id,track_id);
CREATE INDEX schedules_owner_date ON schedules(user_id,track_id,scheduled_date,start_time,id);
CREATE INDEX schedules_owner_end_date ON schedules(user_id,track_id,end_date);
CREATE INDEX schedules_entity ON schedules(entity_id,user_id,track_id);
CREATE INDEX schedule_tasks_source ON schedule_tasks(source_task_preset_id,user_id,track_id);
CREATE INDEX photos_schedule ON photos(schedule_id,user_id,track_id,state);
CREATE INDEX photos_task ON photos(schedule_task_id,user_id,track_id,state);
CREATE INDEX schedules_reminders ON schedules(user_id, reminder_at) WHERE reminder_enabled=1;
CREATE INDEX push_ready ON push_deliveries(status,available_at,lease_until);
CREATE INDEX entities_name_lookup ON entities(user_id,track_id,unmanaged,name COLLATE NOCASE);
CREATE INDEX task_presets_name_lookup ON task_presets(user_id,track_id,unmanaged,name COLLATE NOCASE);
CREATE UNIQUE INDEX entities_unmanaged_name ON entities(user_id,track_id,name COLLATE NOCASE) WHERE unmanaged=1;
CREATE UNIQUE INDEX tasks_unmanaged_name ON task_presets(user_id,track_id,name COLLATE NOCASE) WHERE unmanaged=1;
CREATE INDEX schedules_entity_lookup ON schedules(user_id,track_id,entity_id);
CREATE INDEX schedule_tasks_source_lookup ON schedule_tasks(user_id,track_id,source_task_preset_id);









CREATE TRIGGER schedule_reminder_version AFTER UPDATE OF reminder_enabled,reminder_value,reminder_unit,scheduled_date,start_time,time_zone ON schedules
WHEN OLD.reminder_enabled!=NEW.reminder_enabled OR OLD.reminder_value!=NEW.reminder_value OR OLD.reminder_unit!=NEW.reminder_unit OR OLD.scheduled_date!=NEW.scheduled_date OR OLD.start_time!=NEW.start_time OR OLD.time_zone!=NEW.time_zone
BEGIN
  UPDATE schedules SET reminder_version=OLD.reminder_version+1 WHERE id=NEW.id;
END;
CREATE TRIGGER entities_default_track AFTER INSERT ON entities WHEN NEW.track_id IS NULL BEGIN
 UPDATE entities SET track_id=NEW.user_id WHERE id=NEW.id;
END;
CREATE TRIGGER entities_track_immutable BEFORE UPDATE OF track_id,user_id ON entities WHEN NEW.track_id IS NULL OR (OLD.track_id IS NOT NULL AND (NEW.track_id<>OLD.track_id OR NEW.user_id<>OLD.user_id)) BEGIN SELECT RAISE(ABORT,'Track ownership is immutable'); END;
CREATE TRIGGER tags_default_track AFTER INSERT ON tags WHEN NEW.track_id IS NULL BEGIN
 UPDATE tags SET track_id=NEW.user_id WHERE id=NEW.id;
END;
CREATE TRIGGER tags_track_immutable BEFORE UPDATE OF track_id,user_id ON tags WHEN NEW.track_id IS NULL OR (OLD.track_id IS NOT NULL AND (NEW.track_id<>OLD.track_id OR NEW.user_id<>OLD.user_id)) BEGIN SELECT RAISE(ABORT,'Track ownership is immutable'); END;
CREATE TRIGGER task_presets_default_track AFTER INSERT ON task_presets WHEN NEW.track_id IS NULL BEGIN
 UPDATE task_presets SET track_id=NEW.user_id WHERE id=NEW.id;
END;
CREATE TRIGGER task_presets_track_immutable BEFORE UPDATE OF track_id,user_id ON task_presets WHEN NEW.track_id IS NULL OR (OLD.track_id IS NOT NULL AND (NEW.track_id<>OLD.track_id OR NEW.user_id<>OLD.user_id)) BEGIN SELECT RAISE(ABORT,'Track ownership is immutable'); END;
CREATE TRIGGER work_field_names_default_track AFTER INSERT ON work_field_names WHEN NEW.track_id IS NULL BEGIN
 UPDATE work_field_names SET track_id=NEW.user_id WHERE user_id=NEW.user_id AND name=NEW.name AND track_id IS NULL;
END;
CREATE TRIGGER work_field_names_track_immutable BEFORE UPDATE OF track_id,user_id ON work_field_names WHEN NEW.track_id IS NULL OR (OLD.track_id IS NOT NULL AND (NEW.track_id<>OLD.track_id OR NEW.user_id<>OLD.user_id)) BEGIN SELECT RAISE(ABORT,'Track ownership is immutable'); END;
CREATE TRIGGER entity_tags_default_track AFTER INSERT ON entity_tags WHEN NEW.track_id IS NULL BEGIN
 UPDATE entity_tags SET track_id=NEW.user_id WHERE entity_id=NEW.entity_id AND tag_id=NEW.tag_id;
END;
CREATE TRIGGER entity_tags_track_immutable BEFORE UPDATE OF track_id,user_id ON entity_tags WHEN NEW.track_id IS NULL OR (OLD.track_id IS NOT NULL AND (NEW.track_id<>OLD.track_id OR NEW.user_id<>OLD.user_id)) BEGIN SELECT RAISE(ABORT,'Track ownership is immutable'); END;
CREATE TRIGGER task_preset_tags_default_track AFTER INSERT ON task_preset_tags WHEN NEW.track_id IS NULL BEGIN
 UPDATE task_preset_tags SET track_id=NEW.user_id WHERE task_preset_id=NEW.task_preset_id AND tag_id=NEW.tag_id;
END;
CREATE TRIGGER task_preset_tags_track_immutable BEFORE UPDATE OF track_id,user_id ON task_preset_tags WHEN NEW.track_id IS NULL OR (OLD.track_id IS NOT NULL AND (NEW.track_id<>OLD.track_id OR NEW.user_id<>OLD.user_id)) BEGIN SELECT RAISE(ABORT,'Track ownership is immutable'); END;
CREATE TRIGGER work_task_presets_default_track AFTER INSERT ON work_task_presets WHEN NEW.track_id IS NULL BEGIN
 UPDATE work_task_presets SET track_id=NEW.user_id WHERE entity_id=NEW.entity_id AND task_preset_id=NEW.task_preset_id;
END;
CREATE TRIGGER work_task_presets_track_immutable BEFORE UPDATE OF track_id,user_id ON work_task_presets WHEN NEW.track_id IS NULL OR (OLD.track_id IS NOT NULL AND (NEW.track_id<>OLD.track_id OR NEW.user_id<>OLD.user_id)) BEGIN SELECT RAISE(ABORT,'Track ownership is immutable'); END;
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

DROP TABLE schedule_revisions;
