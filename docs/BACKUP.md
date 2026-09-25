# Backup and storage encryption

Phase 0 contains no user data. These are operator procedures for later production deployment,
not implemented automated backup or encryption features.

## Storage encryption boundary

Production requires an encrypted filesystem/block volume underneath /data (database, WAL/SHM,
attachments). An ordinary Docker named volume is not encrypted by Compose.
The administrator must provision and unlock the encrypted volume using the host/cloud mechanism,
keep its key outside the data and backup, and then bind-mount that path via DATA_VOLUME.
The backend runs as UID 10001; provision ownership/access for that UID.
The service cannot inspect the host block device and does not claim to verify encryption.
Do not put encryption keys in Git, Docker images, or the data directory.
The runtime server can read user content. There is no E2EE in the MVP.

## Consistent backup

1. Stop backend writes with `docker compose stop backend`. Keep it stopped until the snapshot/copy ends.
2. Copy the complete /data directory from the configured volume, including database and attachments,
   into a staging location on encrypted storage. Include SQLite WAL/SHM if present.
3. Encrypt the backup archive with an established backup tool before transferring it elsewhere.
   Use a separately managed backup key and retention policy.
4. Restart with `docker compose start backend` and verify /api/health.
5. Keep the application version, migration version and non-secret deployment configuration with the backup.

A live copy of only app.sqlite3 is not a valid WAL-mode backup strategy.
Online backup requires SQLite's backup API plus a separate attachment consistency plan;
it is not part of Phase 0.

## Restore drill

Stop the backend; preserve the current data; restore the complete matching database/attachment set
onto the encrypted volume; restore UID 10001 permissions; run SQLite PRAGMA integrity_check;
start the same compatible application version, verify health and inspect representative attachments.
Keep backup decryption credentials separate and confirm they are usable before an incident.
Do not run `docker compose down -v` unless intentionally discarding all local stored data.

Reference: https://www.sqlite.org/backup.html
