-- Adopt the existing owner in place: all foreign keys and photo paths stay intact.
CREATE TABLE auth_identities (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id),
 issuer TEXT NOT NULL,
 subject TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(issuer,subject)
);
INSERT INTO auth_identities(id,user_id,issuer,subject)
VALUES('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','urn:preset:virtual','local');
UPDATE users SET display_name='가상 계정', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE id='00000000-0000-4000-8000-000000000001' AND display_name='로컬 사용자';
