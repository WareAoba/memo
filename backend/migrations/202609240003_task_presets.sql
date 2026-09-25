CREATE TABLE task_presets (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id),
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
 default_notes TEXT NOT NULL DEFAULT '' CHECK(length(default_notes) <= 5000),
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(id,user_id)
);
CREATE INDEX task_presets_owner_list ON task_presets(user_id,archived,name,id);
CREATE TABLE task_preset_items (
 id TEXT PRIMARY KEY NOT NULL,
 task_preset_id TEXT NOT NULL REFERENCES task_presets(id),
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
CREATE TABLE task_preset_tags (
 task_preset_id TEXT NOT NULL,
 tag_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 PRIMARY KEY(task_preset_id,tag_id),
 FOREIGN KEY(task_preset_id,user_id) REFERENCES task_presets(id,user_id),
 FOREIGN KEY(tag_id,user_id) REFERENCES tags(id,user_id)
);
CREATE INDEX task_preset_tags_tag ON task_preset_tags(tag_id,user_id);
