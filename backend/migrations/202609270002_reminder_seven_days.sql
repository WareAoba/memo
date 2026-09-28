-- Preserve reminders while moving legacy week/long offsets into the seven-day limit.
UPDATE schedules SET
  reminder_value = CASE reminder_unit
    WHEN 'weeks' THEN 7
    WHEN 'days' THEN MIN(reminder_value, 7)
    WHEN 'hours' THEN MIN(reminder_value, 168)
    ELSE MIN(reminder_value, 10080) END,
  reminder_unit = CASE WHEN reminder_unit = 'weeks' THEN 'days' ELSE reminder_unit END,
  reminder_at = CASE WHEN reminder_enabled = 1 THEN reminder_start_at - 604800 ELSE NULL END,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE reminder_unit = 'weeks'
   OR (reminder_unit = 'days' AND reminder_value > 7)
   OR (reminder_unit = 'hours' AND reminder_value > 168)
   OR (reminder_unit = 'minutes' AND reminder_value > 10080);
