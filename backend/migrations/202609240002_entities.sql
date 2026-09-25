CREATE TABLE users (
 id TEXT PRIMARY KEY NOT NULL,
 email TEXT,
 display_name TEXT NOT NULL,
 time_zone TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO users(id, display_name) VALUES ('00000000-0000-4000-8000-000000000001', '로컬 사용자');
CREATE TABLE entities (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id),
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
 reference_code TEXT NOT NULL DEFAULT '' CHECK(length(reference_code) <= 100),
 address TEXT NOT NULL DEFAULT '' CHECK(length(address) <= 500),
 contact_name TEXT NOT NULL DEFAULT '' CHECK(length(contact_name) <= 200),
 contact_info TEXT NOT NULL DEFAULT '' CHECK(length(contact_info) <= 500),
 advance_contact_required INTEGER NOT NULL DEFAULT 0 CHECK(advance_contact_required IN (0,1)),
 notice_required INTEGER NOT NULL DEFAULT 0 CHECK(notice_required IN (0,1)),
 default_work_start_time TEXT,
 default_work_end_time TEXT,
 access_instructions TEXT NOT NULL DEFAULT '' CHECK(length(access_instructions) <= 5000),
 parking_info TEXT NOT NULL DEFAULT '' CHECK(length(parking_info) <= 5000),
 special_notes TEXT NOT NULL DEFAULT '' CHECK(length(special_notes) <= 5000),
 general_notes TEXT NOT NULL DEFAULT '' CHECK(length(general_notes) <= 5000),
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(id, user_id),
 CHECK((default_work_start_time IS NULL AND default_work_end_time IS NULL) OR
 (default_work_start_time IS NOT NULL AND default_work_end_time IS NOT NULL AND
 default_work_start_time GLOB '[0-2][0-9]:[0-5][0-9]' AND default_work_start_time < '24:00' AND
 default_work_end_time GLOB '[0-2][0-9]:[0-5][0-9]' AND default_work_end_time < '24:00' AND
 default_work_start_time < default_work_end_time))
);
CREATE INDEX entities_owner_list ON entities(user_id, archived, name, id);
CREATE TABLE tags (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id),
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 50),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(user_id, name),
 UNIQUE(id, user_id)
);
CREATE TABLE entity_tags (
 entity_id TEXT NOT NULL,
 tag_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 PRIMARY KEY(entity_id, tag_id),
 FOREIGN KEY(entity_id, user_id) REFERENCES entities(id, user_id),
 FOREIGN KEY(tag_id, user_id) REFERENCES tags(id, user_id)
);
CREATE INDEX entity_tags_tag ON entity_tags(tag_id, user_id);