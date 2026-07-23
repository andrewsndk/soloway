# Staging environment

The staging environment is isolated from production and is intended for
verification before release.

## Addresses

- Landing: `https://soloway-staging.vercel.app`
- Admin: `https://soloway-admin-staging.vercel.app/soloadmin`
- Supabase project: `fgfeelndhesccbddjwgw` (`Soloway Staging`)

Vercel SSO protects Preview deployments. Team members must sign in to Vercel
before opening the staging addresses.

## Data isolation

- Staging uses a separate Supabase project.
- Production clients and bookings are not copied to staging.
- Database migrations and Edge Functions are deployed independently.
- Telegram and AI provider secrets are not copied from production.

The local Supabase CLI remains linked to the production project
`awkiifqbskmktqwlnfqx`. Always check the target project before a database push:

```bash
cat supabase/.temp/project-ref
```

## Release flow

1. Create a feature branch from `staging`.
2. Open a pull request into `staging`.
3. Run tests and verify the change in staging.
4. Merge the verified commit into `main`.
5. Deploy `main` to production.

The `staging` and `main` branches currently share the same application commit.
Environment variables select the correct Supabase project.

## Vercel configuration

The `staging` Git branch has branch-specific landing variables in Vercel. The
admin project has no Git integration, so its Preview variables are reserved for
staging. Deploy admin before landing because `vercel.staging.json` proxies the
admin routes to the stable admin staging alias.
