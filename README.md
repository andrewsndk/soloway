# Welcome to your Lovable project

## Telegram visit notifications

The visit booking form sends requests to the Supabase Edge Function `send-visit`.
Do not put Telegram bot credentials into `VITE_*` variables because those are exposed to the browser.

Set these secrets in Supabase:

```bash
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=-1001234567890
```

Set these public variables for the website:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

The Edge Function is implemented in `supabase/functions/send-visit/index.ts`.
