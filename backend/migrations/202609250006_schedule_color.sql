ALTER TABLE schedules ADD COLUMN color TEXT NOT NULL DEFAULT 'none'
CHECK (color IN ('none', 'red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'));
