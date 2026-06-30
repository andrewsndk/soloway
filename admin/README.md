# Soloway Admin (CRM)

Admin panel for Soloway landing, served at `/soloadmin` on the main site.

Source: https://github.com/andrewsndk/kidspace-booking-buddy

## Local development

```bash
cd admin
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:8080/soloadmin

## Deployment

This app is deployed as a separate Vercel project (`soloway-admin`).
The main `soloway` project proxies `/soloadmin/*` to it via `vercel.json` rewrites.

Required env vars on Vercel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Set the Supabase auth redirect URL to `https://soloway.mom/soloadmin/dashboard`.
