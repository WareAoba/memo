ALTER TABLE schedules ADD COLUMN reminder_version INTEGER NOT NULL DEFAULT 1;
CREATE TRIGGER schedule_reminder_version AFTER UPDATE OF reminder_enabled,reminder_value,reminder_unit,scheduled_date,start_time,time_zone ON schedules
WHEN OLD.reminder_enabled!=NEW.reminder_enabled OR OLD.reminder_value!=NEW.reminder_value OR OLD.reminder_unit!=NEW.reminder_unit OR OLD.scheduled_date!=NEW.scheduled_date OR OLD.start_time!=NEW.start_time OR OLD.time_zone!=NEW.time_zone
BEGIN
  UPDATE schedules SET reminder_version=OLD.reminder_version+1 WHERE id=NEW.id;
END;

CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  installation_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  visible_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id,installation_id)
);
CREATE TABLE push_deliveries (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  schedule_id TEXT NOT NULL REFERENCES schedules(id),
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
CREATE INDEX push_ready ON push_deliveries(status,available_at,lease_until);
CREATE INDEX push_owner ON push_subscriptions(user_id,installation_id);

CREATE TABLE push_presence (
  subscription_id TEXT NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  tab_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY(subscription_id,tab_id)
);
