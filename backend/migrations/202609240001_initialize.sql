-- Infrastructure only. Domain tables arrive with their implementation phases.
CREATE TABLE app_metadata (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO app_metadata (id, name, value)
VALUES ('cf1638d4-0c78-4ff5-9513-45279e5d6a20', 'schema_generation', '1');
