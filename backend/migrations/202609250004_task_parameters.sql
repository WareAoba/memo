ALTER TABLE schedule_tasks ADD COLUMN name_template_snapshot TEXT NOT NULL DEFAULT '';
ALTER TABLE schedule_tasks ADD COLUMN parameter_values TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(parameter_values));
UPDATE schedule_tasks SET name_template_snapshot = name_snapshot;
