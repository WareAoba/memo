-- Repair fulfilled defaults left incomplete by schedule creation. Keep execution
-- values, task/schedule states, and existing timestamps intact. The last item
-- update is the best available historical timestamp; do not invent a new event.
-- The trim character set matches Rust str::trim (Unicode White_Space).
UPDATE schedule_task_items
SET completed=1, completed_at=COALESCE(completed_at,updated_at)
WHERE completed=0 AND CASE json_extract(definition,'$.item_type')
    WHEN 'checkbox' THEN value_boolean=1
    WHEN 'text' THEN length(trim(value_text,char(
        9,10,11,12,13,32,133,160,5760,
        8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,
        8232,8233,8239,8287,12288
    )))>0
    WHEN 'number' THEN value_number BETWEEN -1.7976931348623157e308 AND 1.7976931348623157e308
    ELSE 0
END;
