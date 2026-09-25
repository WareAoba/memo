-- Keep every schedule and its execution history visible. Archive is no longer supported.
UPDATE schedules SET deleted_at=NULL WHERE deleted_at IS NOT NULL;
ALTER TABLE schedules DROP COLUMN deleted_at;
