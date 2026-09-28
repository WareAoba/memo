-- Archiving is retired. Restore visibility without deleting definitions or snapshots.
-- Keep legacy columns/indexes for compatibility with applied migrations.
UPDATE entities SET archived=0 WHERE archived<>0;
UPDATE task_presets SET archived=0 WHERE archived<>0;
