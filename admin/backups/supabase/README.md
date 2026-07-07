# Supabase backups

GitHub Actions creates one encrypted backup per day in this folder.

The workflow stores only encrypted files:

```text
soloway-public-YYYY-MM-DDTHH-MM-SSZ.sql.gz.gpg
```

The backup contains the Supabase `public` schema, including CRM data such as clients, bookings, instructions, audit history, and settings. Auth users/passwords and Storage files are not stored in this repository backup.

## Required GitHub secrets

Add these secrets in GitHub repository settings:

```text
SUPABASE_DB_URL
BACKUP_ENCRYPTION_PASSPHRASE
```

Use a direct Supabase Postgres connection string for `SUPABASE_DB_URL` and keep `BACKUP_ENCRYPTION_PASSPHRASE` somewhere safe outside GitHub.

## Restore

Download a backup file, then decrypt and restore:

```bash
gpg --decrypt soloway-public-YYYY-MM-DDTHH-MM-SSZ.sql.gz.gpg | gunzip > backup.sql
psql "$SUPABASE_DB_URL" < backup.sql
```

Be careful: the SQL file includes `drop if exists` statements for objects in the `public` schema.
