CREATE TABLE work_task_presets (
 entity_id TEXT NOT NULL,
 task_preset_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 99),
 PRIMARY KEY(entity_id,task_preset_id),
 UNIQUE(entity_id,position),
 FOREIGN KEY(entity_id,user_id) REFERENCES entities(id,user_id),
 FOREIGN KEY(task_preset_id,user_id) REFERENCES task_presets(id,user_id)
);
CREATE INDEX work_task_presets_task ON work_task_presets(task_preset_id,user_id);
