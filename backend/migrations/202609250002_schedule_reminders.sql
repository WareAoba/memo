ALTER TABLE schedules ADD COLUMN reminder_enabled INTEGER NOT NULL DEFAULT 0 CHECK(reminder_enabled IN (0,1));
ALTER TABLE schedules ADD COLUMN reminder_value INTEGER NOT NULL DEFAULT 15 CHECK(reminder_value BETWEEN 1 AND 525600);
ALTER TABLE schedules ADD COLUMN reminder_unit TEXT NOT NULL DEFAULT 'minutes' CHECK(reminder_unit IN ('minutes','hours','days','weeks'));
ALTER TABLE schedules ADD COLUMN reminder_at INTEGER;
ALTER TABLE schedules ADD COLUMN reminder_start_at INTEGER;
CREATE INDEX schedules_reminders ON schedules(user_id, reminder_at) WHERE reminder_enabled=1;
