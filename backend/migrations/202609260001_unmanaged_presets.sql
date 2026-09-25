ALTER TABLE entities ADD COLUMN unmanaged INTEGER NOT NULL DEFAULT 0 CHECK(unmanaged IN (0,1));
ALTER TABLE task_presets ADD COLUMN unmanaged INTEGER NOT NULL DEFAULT 0 CHECK(unmanaged IN (0,1));
CREATE INDEX entities_name_lookup ON entities(user_id,unmanaged,name COLLATE NOCASE);
CREATE INDEX task_presets_name_lookup ON task_presets(user_id,unmanaged,name COLLATE NOCASE);
CREATE UNIQUE INDEX entities_unmanaged_name ON entities(user_id,name COLLATE NOCASE) WHERE unmanaged=1;
CREATE UNIQUE INDEX tasks_unmanaged_name ON task_presets(user_id,name COLLATE NOCASE) WHERE unmanaged=1;
CREATE INDEX schedules_entity_lookup ON schedules(user_id,entity_id);
CREATE INDEX schedule_tasks_source_lookup ON schedule_tasks(user_id,source_task_preset_id);
