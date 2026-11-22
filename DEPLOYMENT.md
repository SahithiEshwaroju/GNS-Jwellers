# Deployment (Netlify) — preparation only

Nothing has been deployed. Follow these steps when you are ready.

## 1. Supabase
The project `gns-jewellers` (ref `trikbstrswhdeucxupyc`, Mumbai) already has all migrations applied, the default taxonomy, **sample data**, and **three test accounts** (`*@gns-test.invalid`, password sign-in, one of them an admin).

For a different/new Supabase project, run every file in `supabase/migrations` in filename order (SQL editor or `supabase db push`), then optionally `supabase/seed/default_taxonomy.sql`.

## 2. Google sign-in
1. Google Cloud Console → APIs & Services → Credentials → *Create OAuth client ID* (Web application).
2. Authorised redirect URI: `https://trikbstrswhdeucxupyc.supabase.co/auth/v1/callback`.
3. Supabase Dashboard → Authentication → Sign In / Providers → **Google**: enable, paste client ID and secret.
4. Authentication → URL Configuration: **Site URL** = your Netlify URL; **Redirect URLs** add `https://<your-domain>/auth/callback` (and `http://localhost:3000/auth/callback` for development).
5. Recommended: disable the **Email** provider (Google only) — see SECURITY.md.

## 3. First admin
In the SQL editor (use the shop owner's Google email, lower-case):
```sql
insert into public.admins (email, name) values ('owner@gmail.com', 'Shop Owner');
```
Further admins are added in Admin › Admin Access.

## 4. Cloudflare R2
1. Cloudflare Dashboard → R2 → Create bucket (e.g. `gns-jewellers-media`). Keep it **private** (no public access, no r2.dev URL).
2. R2 → Manage API tokens → *Create API token* with **Object Read & Write**, restricted to that bucket. Note the Access Key ID, Secret Access Key and your Account ID.
3. Bucket → Settings → **CORS policy** (needed for direct browser uploads):
```json
[{ "AllowedOrigins": ["https://<your-domain>", "http://localhost:3000"], "AllowedMethods": ["PUT", "GET"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
```

## 5. Gemini (optional)
Google AI Studio → API keys → create a key. Without it, AI reply/extraction/description features show "AI isn't set up" and manual paths work.

## 6. Before going live
- [ ] Run `supabase/seed/remove_sample_data.sql` (removes sample products and the sample rate) and enter real rates in Admin › Gold & Silver Rates.
- [ ] Run `supabase/scripts/remove_test_users.sql` (removes test accounts). Re-create them only in a non-production project if you want to re-run automated tests.
- [ ] Optional: restart numbering once no real orders/enquiries exist: `alter sequence public.order_no_seq restart 1; alter sequence public.enquiry_ref_seq restart 1001;`
- [ ] Fill Admin › Site Content (WhatsApp number with country code, address, story, policies) — the WhatsApp button needs the number.
- [ ] Upload real photos (Admin › Images, and per product). Do not use the design kit's `hero-sample.jpg` (mockup sample).
- [ ] Enable leaked-password protection / disable email provider in Supabase Auth.
- [ ] Add a privacy policy covering stored enquiry contact details.

## 7. Netlify
1. Push the repository to GitHub and *Add new site → Import from Git* in Netlify.
2. Build settings come from `netlify.toml` (`npm run build`, Next.js runtime via `@netlify/plugin-nextjs`, Node 22).
3. Site configuration → Environment variables:

| Variable | Scope | Required | Source |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | build + runtime | yes | Supabase › Settings › API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | build + runtime | yes | Supabase › API keys (publishable) |
| `NEXT_PUBLIC_SITE_URL` | build + runtime | yes | your site URL, no trailing slash |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | runtime (functions) | yes for photos | Cloudflare R2 |
| `GEMINI_API_KEY` | runtime | optional | Google AI Studio |
| `GEMINI_MODEL` | runtime | optional | defaults to `gemini-2.5-flash` |

Mark R2/Gemini values as secret. Never prefix them with `NEXT_PUBLIC_`.
4. Deploy, then sign in at `/admin` with the owner's Google account.

### Compatibility notes
- Next.js 16 with `proxy.ts` (Node runtime) — supported by the OpenNext-based Netlify runtime (`@netlify/plugin-nextjs` 5.x). Not verified by an actual Netlify deploy from this environment.
- All pages are dynamic server-rendered (`cacheComponents` off). Images are served via `/api/media/<id>` redirects, not the Next image optimiser.
- Uploads go browser → R2 directly, so Netlify's function body-size limit does not apply. AI calls run inside a server function and abort after 20 s. Netlify synchronous functions default to a 10 s timeout (can be raised to 26 s via Netlify support/plan settings); ask Netlify to raise it if AI extraction of large catalogue images times out. Manual paths always remain available.

## Rollback
- Netlify keeps previous deploys: *Deploys → (older deploy) → Publish deploy*.
- Database migrations are additive; to roll back a future migration, write a new reverse migration rather than editing applied files. Take a backup (Supabase › Database › Backups) before running migrations on production data.

## Branch workflow (default branch + initial branch)
| Branch | Purpose | Netlify |
|---|---|---|
| `main` (GitHub default) | Production. Only ever updated by merging `initial` after it has been tested. | Production branch → https://gns-jwellers.netlify.app |
| `initial` | Where new work is pushed and tested first. | Branch deploy → https://initial--gns-jwellers.netlify.app |

Release: open a pull request `initial` → `main` on GitHub (or merge locally and push) → Netlify redeploys production automatically.

One-time Netlify setup: **Site configuration → Build & deploy → Branches and deploy contexts** → Production branch `main`; Branch deploys → *Let me add individual branches* → add `initial`.
For the `initial` deploy to work, three things must also know its address (https://initial--gns-jwellers.netlify.app):
1. Netlify variable `NEXT_PUBLIC_SITE_URL` scoped to **Branch deploys** = that address (Production keeps the main address).
2. Supabase → Authentication → URL Configuration → Redirect URLs: add `https://initial--gns-jwellers.netlify.app/auth/callback`.
3. Cloudflare R2 CORS: add that origin.
Note: both deployments use the **same Supabase database and R2 bucket**, so anything created while testing `initial` is real data. Use a separate Supabase project and bucket if you need isolation.

## Backup & restore (Admin → Backup)

- **Download:** one ZIP (photos byte-for-byte under `images/`, all tables as `data/*.json`, `manifest.json`). The browser reads data through admin-only server actions and downloads photos directly from R2 with signed URLs.
- **Restore:** photos are uploaded to R2 and verified first; then the DB function `admin_restore_backup` replaces the content tables atomically. Accounts (auth, profiles, admins, saved items, views, activity log) are never touched; references to user accounts are cleared.
- **Requires R2 CORS** to allow `GET` and `PUT` from the site origin (same rule as photo uploads).
- **Limits:** website data must fit ~5 MB per restore (`serverActions.bodySizeLimit`, Netlify caps requests near 6 MB); the whole ZIP is built in browser memory.
- **System Check** now shows database and R2 usage. Allowances default to 500 MB / 10 GB; set `DB_LIMIT_MB` / `STORAGE_LIMIT_GB` in Netlify if your plans differ (not secrets; add them to `SECRETS_SCAN_OMIT_KEYS` if the scan flags them).
- Migration `20261122000100_backup_restore.sql` is applied to the live project.
