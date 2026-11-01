# Production baseline and backup: 2026-11-01

This branch reconstructs the existing production state. It does not include the
local financial-visibility feature and is not authorization to deploy it.

## Verified production sources

- Landing: deployment `dpl_6Qw1KX55d58nCcsRBfm7GedemQxR`, built from Git commit
  `3199be2ee6236cb2ff488dd6a4886efd815d04cf`.
- Admin: deployment `dpl_6FVfC7ZDXynTYBn3vx4Y4JA9tdek`, URL
  `https://soloway-admin-5luctd9e6-andrewsndk-gmailcoms-projects.vercel.app`.
- All 117 admin runtime source/config/public files were compared with Vercel
  using SHA-1. The only missing source change relative to GitHub main was manual
  custom-time inputs in `BookingDialog.tsx`; it is restored here.
- All four production Supabase Edge Function sources match this repository.
- The missing registered production migration
  `20261004102233_ensure_subscription_purchase_before_usage.sql` was exported
  from production migration history, not newly applied to application tables.

## Supabase snapshot

The owner-requested snapshot is in private schema `backup_prod_20261101`, taken
at `2026-11-01T11:02:52.020929Z` in project `awkiifqbskmktqwlnfqx`.
`anon` and `authenticated` have no schema access.

It contains 44 table copies across public, auth, storage and migration history,
5824 rows in total, plus schema/function/trigger/index/policy/grant catalogs.
Application data includes 132 clients, 701 bookings and 21 subscriptions.
Public application tables, constraints, indexes and subscription functions were
successfully restored into an isolated local PostgreSQL verification database.
Both pricing and subscription-payment suites pass (10 tests).

This private schema is a logical snapshot in the same Supabase database, not an
independent hosted PITR backup. The encrypted off-site archive provides a
separate copy. It also includes 123 public storage objects. Six private receipt
object bodies are missing; their database records and metadata are included.
Provider-managed secrets cannot be reconstructed from these metadata exports.

## GitHub archive

The encrypted archive and checksums are in `admin/backups/production/2026-11-01/`.
It uses AES-256-GCM; the decryption key is held locally outside Git. The archive
contains database JSON exports, the public-schema recovery SQL, a Git bundle,
production Edge Functions, local Vercel metadata exports, and exported media.

Encrypted data must never be replaced with plaintext in this public repository.

## Vercel and release hold

The production domains still point to the original deployment IDs above.
No replacement production deployment was performed. Vercel's current retained
deployments remain the rollback artifacts; this does not create an independently
retained deployment. Adding backup aliases and freezing Git builds were not
performed because automatic approval review rejected those operations.

Do not merge this branch into `main` until the deployment behavior is agreed:
both Vercel projects deploy `main` automatically. The local financial-visibility
changes remain in the separate working tree and require a later explicit release.
