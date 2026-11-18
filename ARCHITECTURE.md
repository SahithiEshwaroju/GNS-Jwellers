# Architecture

## Overview
```
Browser ──► Next.js 16 (App Router, Node runtime on Netlify Functions)
             │  Server Components / Server Actions / Route Handlers
             │  proxy.ts → refreshes Supabase session cookies, guards /admin
             ├──► Supabase (Postgres + Auth + RLS)   [anon key + user JWT only]
             ├──► Cloudflare R2 (S3 API, private bucket) [server-only keys, presigned URLs]
             └──► Gemini Flash REST API              [server-only key, optional]
Browser ──► R2 (direct PUT with presigned URL; GET via 302 to signed URL)
Browser ──► wa.me (WhatsApp click-to-chat)
```
No custom backend, no service-role key in the app. Every database call runs as the visitor (anon) or the signed-in user, so RLS is the single authorisation layer for data. Privileged writes from guests go through narrow `SECURITY DEFINER` functions.

## Directory structure
```
src/
  app/
    (site)/                 customer website (header, rate bar, footer layout)
      page.tsx              home
      jewellery/            catalogue (+ ?category=&q=&… filters)
      product/[code]/       product detail
      collections/[slug]/   collections
      custom-jewellery/ about/ saved/ privacy/ terms/ login/
    admin/
      login/                admin sign-in (outside the admin shell)
      (portal)/             admin shell layout + all sections
    auth/callback/          OAuth code exchange
    auth/signout/           sign-out route
    api/media/[id]/         authorised image redirect (signed GET)
    api/uploads/            presign + finalize uploads (admin)
  components/ui/            Button, Field, Modal, Icon, Badge, Toggle, …
  components/site/          header, footer, product card, filters, enquiry builder …
  components/admin/         sidebar, tables, forms …
  lib/
    supabase/               server/browser clients, generated types
    pricing.ts              price engine (mirrors SQL `product_price`)
    format.ts               ₹ / date formatting (Asia/Kolkata)
    whatsapp.ts             message builders + wa.me links
    validation.ts           zod schemas shared by forms and server actions
    r2.ts                   S3 client, key generation, presign helpers (server-only)
    ai/gemini.ts            reply + extraction + description (server-only)
    data/                   query functions (catalogue, admin, settings)
  proxy.ts                  session refresh + /admin gate
supabase/migrations/        ordered SQL migrations
tests/unit/ tests/integration/ tests/e2e/
```

## Frontend / backend boundaries
- **Server Components** fetch data with the request-scoped Supabase client (cookies → user JWT).
- **Server Actions** perform mutations; each validates input with zod and relies on RLS (admin actions also call `requireAdmin()` for early, friendly failure — RLS is still the enforcement).
- **Client Components** only for interactivity (menus, filters sheet, enquiry builder, gallery, upload widgets, toggles). The browser Supabase client is used for Google sign-in and nothing privileged.
- `cacheComponents` is disabled (D‑006); pages that read cookies are dynamic. Public catalogue pages are dynamic but cheap (single RLS query each).

## Supabase
- Auth: Google OAuth (PKCE) via `@supabase/ssr`. `/auth/callback` exchanges the code. A trigger creates `profiles` rows on sign-up.
- `is_admin()` (SECURITY DEFINER, stable): true when `auth.uid()`'s confirmed email is in `admins`. Used in all admin RLS policies.
- Data access is described in `DATABASE.md`; policies in `SECURITY.md`.
- Price computation lives in SQL (`product_price()`), exposed through the `catalogue_products` view (`security_invoker = true`) so filters/sorts by price happen in the database. `src/lib/pricing.ts` mirrors it for admin previews; unit tests assert both agree on the design's reference figures.

## Cloudflare R2
- One private bucket. Object keys: `products/<uuid>/<random>.<ext>`, `site/<slot>/<random>.<ext>`, `extract/<user>/<random>.<ext>` — never user filenames.
- Upload: admin → `POST /api/uploads/presign` (auth + admin check, MIME allow-list, size ≤ 8 MB) → `media` row (`pending`) + presigned PUT (5 min, signed Content-Type/Length) → browser PUT → `POST /api/uploads/complete` → server `HeadObject` verifies size/type → `ready`.
- Download: `GET /api/media/<id>` → DB lookup through RLS (`media_public` policy allows anon to read only media attached to published products or site slots; admins read all) → 302 to a signed GET URL (1 h) with `Cache-Control: private, max-age=3000`. Private (extraction) media is only reachable by admins.
- Deletion: removing an image deletes the DB row and the R2 object (server-side, admin-only). Orphaned `pending` uploads older than 24 h are listed by `cleanup_stale_media()` for removal (documented maintenance task).
- SDK: AWS SDK v3 (`@aws-sdk/client-s3`) in the Node runtime — compatible with R2's S3 API (region `auto`, endpoint `https://<account>.r2.cloudflarestorage.com`).

## AI (Gemini Flash)
`src/lib/ai/gemini.ts` calls the Generative Language REST API with `GEMINI_API_KEY` (server-only). Features: reply drafting (REQ‑038), catalogue text extraction (REQ‑045), description suggestions (REQ‑046). If the key is absent or the call fails, the UI states AI is unavailable and offers the manual path. Prompts restrict the model to supplied facts (BR‑08/09).

## Environment variables
See `.env.example`. Browser-safe: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`. Server-only: `R2_*`, `GEMINI_*`.

## Error handling & logging
Server actions return `{ ok: true, data } | { ok: false, error }` with user-safe messages; raw database errors are logged server-side (`console.error`, visible in Netlify function logs) and mapped to friendly text. Route-level `error.tsx` and `not-found.tsx` per area. No secrets or personal data are logged.

## Deployment
Netlify with `@netlify/plugin-nextjs` (see `DEPLOYMENT.md`). Node runtime only (proxy.ts runs on Node in Next 16).

## Testing strategy
- Unit (Vitest): pricing, formatting, WhatsApp messages, validation, R2 key/validation helpers, Gemini prompt building (mocked fetch).
- Integration (Vitest, real Supabase project): RLS as anon/customer/admin, RPCs (enquiry creation, rate limits, order numbering, admin guards), price function parity.
- R2 integration: against a local S3-compatible server (moto) since R2 credentials are unavailable — proves presign/PUT/HEAD/GET/DELETE flow, not Cloudflare itself.
- E2E (Playwright, Chromium, desktop 1440 & mobile 390): guest browse → enquiry → WhatsApp URL; customer save; admin product/rates/enquiry/order flows; unauthorised access.
