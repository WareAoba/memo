CREATE TABLE schedule_revisions (
 user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id),
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0)
);
INSERT INTO schedule_revisions(user_id,revision) SELECT id,0 FROM users;
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
