# Production recovery archives

This public Git repository stores only authenticated ciphertext and non-sensitive
manifests. The AES-256-GCM key is never committed.

The 2026-11-01 key is held on the owner's computer at:
`/Users/andrii/Downloads/pastel-montessori-dreams-main/.local-stage/production-20261101/decryption-key.local`.

To authenticate and decrypt an archive, run:

```sh
node admin/backups/production/decrypt-backup.mjs \
  admin/backups/production/2026-11-01/soloway-production-20261101.tar.gz.aes256gcm \
  /path/to/decryption-key.local \
  /private/path/recovered-production.tar.gz
```

The output path must not already exist. Extract only into a private directory;
the decrypted archive includes customer records and authentication table copies.
Never publish the output or commit it to Git.

`restore-public.sql` recreates the application's public tables and business
triggers in an empty database. It was tested in an isolated PostgreSQL database.
The full JSON exports also include auth/storage metadata and schema catalogs;
they require a compatible Supabase target and a reviewed recovery procedure.
They must not be automatically imported into the active production database.

The archive includes 123 public storage object bodies. Six private receipt file
bodies and provider-managed secret values were not exported. This is not a full
provider-native project backup or point-in-time recovery service.

See `docs/production-baseline-2026-11-01.md` for the exact source deployment IDs,
verification scope and the outstanding release hold.
