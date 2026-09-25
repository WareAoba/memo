ALTER TABLE entities ADD COLUMN custom_fields TEXT NOT NULL DEFAULT '[]';
ALTER TABLE task_presets ADD COLUMN group_name TEXT NOT NULL DEFAULT '';
CREATE TABLE work_field_names (user_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, PRIMARY KEY(user_id,name));
