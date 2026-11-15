# InRange

A mobile-first T1D co-pilot interface for glucose awareness, meal context, check-ins, and supply tracking. It does not calculate insulin doses or provide treatment recommendations. The UI runs in demo mode without credentials; demo values are illustrative and are not personal glucose data.

## Run locally

1. Install Node.js 20+.
2. Copy `.env.example` to `.env.local` and fill in the values below.
3. Run `npm install` and `npm run dev`, then open `http://localhost:3000`.
4. In Supabase SQL editor, run [`supabase/migrations/202611150001_initial_schema.sql`](supabase/migrations/202611150001_initial_schema.sql).
5. Keep the service role key server-side only. Never prefix it with `NEXT_PUBLIC_`.

### Environment

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase project settings.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key for server routes.
- `DEXCOM_USERNAME`, `DEXCOM_PASSWORD`: Dexcom Share login. Set `DEXCOM_SERVER=us` for US or `ous` for outside US.
- `USDA_API_KEY`: free key from USDA FoodData Central. If unset, food lookup falls back to Open Food Facts.
- `CRON_SECRET`: optional random secret. When set, send `Authorization: Bearer <CRON_SECRET>` to protect the sync route.
- `PARTNER_WEBHOOK_URL`: optional HTTPS endpoint that receives saved check-ins; without it, check-ins are stored without sending a notification.

## PWA behavior

The app includes a web manifest, an install icon, and a service worker. It caches the app shell and static Next.js assets for offline loading; API responses and private health data are never cached. Use the deployed HTTPS site to install it from a mobile browser.

## Dexcom sync

`POST /api/dexcom/sync` (or `GET` for a cron caller) stores fetched readings with a unique `recorded_at` upsert. The first sync automatically fetches up to 288 readings (24 hours); subsequent calls fetch up to 12 recent readings. The dashboard reads the stored 30-day history. Dexcom Share exposes a rolling recent window, so this endpoint must be called on schedule to build longer history. This is an unofficial Share integration; verify access and terms before relying on it.

To keep collecting while the app is closed, create a cron-job.org job for your deployed URL `/api/dexcom/sync`, every 5 minutes, with method GET and (if configured) the bearer authorization header. Vercel Cron is another option; configure the schedule in `vercel.json` and protect it with the same secret. Verify the Dexcom Share terms and account availability for your region before relying on it.

## Food lookup

`GET /api/foods/search?q=...` searches USDA branded, foundation, and legacy foods when `USDA_API_KEY` is configured, then falls back to Open Food Facts search. `?barcode=...` supports UPC/EAN lookup via Open Food Facts when USDA has no exact match. Food labels and restaurant portions can differ; confirm the serving size and nutrition label. Barcode camera scanning requires a secure HTTPS origin and a browser with camera permission; the UI offers a search fallback.

## Privacy and safety

The deployed app uses Supabase email/password sign-in when its Supabase variables are configured. Create the owner account in Supabase Dashboard → Authentication → Users, then set `APP_OWNER_EMAIL` to that exact email in Vercel. There is no public sign-up form. Server routes verify the access token and allow only the configured owner email; the migration enables RLS and removes direct anon/authenticated table access. Keep the Supabase secret key server-only. The check-in endpoint stores an alert and can POST it to an HTTPS `PARTNER_WEBHOOK_URL`; configure that endpoint yourself if a notification is needed. Without it, the app only saves the check-in. Glucose and carb information are informational only; no insulin dose calculator is included.
