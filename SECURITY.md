# Security

## Authentication
- Supabase Auth with **Google OAuth (PKCE)** for customers (optional) and admins. `/auth/callback` exchanges the code and only redirects to same-site relative paths.
- Sessions live in `@supabase/ssr` cookies; `src/proxy.ts` refreshes them on each request and redirects signed-out visitors away from `/admin`.
- Server code verifies the user with `auth.getUser()` (round-trip to Auth), never trusting cookie contents alone.
- **Admin authorisation** = `is_admin()` in the database: the signed-in user's *confirmed* email must be in `admins`. Client-supplied roles are never trusted. The admin layout shows "No admin access" for other users; every admin server action calls `assertAdmin()`; RLS enforces it again at the data layer.
- **Recommended dashboard setting:** disable the Email (password) provider so Google is the only sign-in method (D-013), and enable leaked-password protection if email sign-in is ever used.

## Row Level Security (fail-closed)
All 20 tables have RLS enabled, and privileges are granted explicitly (everything else revoked).
| Data | Anonymous | Customer | Admin |
|---|---|---|---|
| Categories, subcategories, collections, tags, site content, rates (without who-updated) | read | read | read/write (rates insert-only) |
| Products, product photos/tags | published only | published only | all |
| Media rows | only when attached to published product / site slot | same | all |
| Saved designs | — | own rows only; only published products | — |
| Profiles | — | own row | all |
| Enquiries, enquiry items, product views, activity log | create via RPC only; no read | same | read/update/delete |
| Orders, order items | — | — | read/insert/update (no delete) |
| Admins | — | — | read/insert; removal via guarded function |

`SECURITY DEFINER` functions use `set search_path = ''`. Public ones (`create_enquiry`, `mark_enquiry_whatsapp_opened`, `record_product_view`, `is_admin`) validate all input; enquiry creation is rate-limited and re-reads product prices server-side. Admin definer functions check `is_admin()` first and are not executable by `anon`. Trigger and internal functions are not executable via the API.

## Secrets
- Browser receives only `NEXT_PUBLIC_SUPABASE_URL`, the publishable/anon key and the site URL.
- R2 keys and the Gemini key are read only in `server-only` modules (`src/lib/server-env.ts`, `r2.ts`, `ai/gemini.ts`). Verified: the production client bundle contains no references to them.
- No service-role key is used anywhere.
- `.env*` files are git-ignored (except `.env.example`, which has placeholders only). Test credentials live in git-ignored `.env.test.local`; test passwords were sent to the database only as bcrypt hashes.

## File storage (Cloudflare R2)
- Single **private** bucket. Object keys are generated server-side (`products/<uuid>/<random>.<ext>`), never from user filenames; key format is checked in code and by a DB constraint.
- Upload: admin-only presign endpoint (same-origin check) → presigned PUT valid 5 minutes, signed to the exact Content-Type and Content-Length → `/api/uploads/complete` verifies the object exists, size matches, stored Content-Type matches and the **file's magic bytes** are a real JPEG/PNG/WebP; otherwise the object and row are deleted.
- Download: `/api/media/<id>` looks the row up **as the visitor** (RLS decides visibility) and redirects to a 1-hour signed GET that **forces the validated image Content-Type** (so a file can't be served as HTML). Drafts' photos and catalogue-extraction uploads are admin-only; extraction images are deleted right after reading.
- Removed/replaced images are deleted from R2; stale uploads can be listed with `admin_stale_media()` / `cleanupStaleUploads`.

## Application
- All mutations are server actions or route handlers with zod validation; DB errors are mapped to safe messages (raw errors only in server logs).
- React escapes all output; the only `dangerouslySetInnerHTML` renders static SVG icons from the repository.
- Search terms are LIKE-escaped; PostgREST parameters are bound, not concatenated into SQL.
- Security headers: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`; `poweredByHeader` off; admin pages `noindex`.
- WhatsApp: the site only builds `wa.me` links; it never sends messages and never claims delivery.
- AI: prompts restrict the model to the customer's questions and the admin's answers; output is shown for review/edit and nothing is sent or published without admin approval; AI never produces product images.

## Checks performed (see TEST_REPORT.md)
- 34 RLS/RPC integration tests against the live database (anon / customer / other customer / admin; escalation attempts, cross-user access, draft visibility, column hiding, rate limiting, append-only history, immutable codes).
- E2E access-control tests (admin redirect, non-admin denial, upload endpoint 403s incl. cross-origin, media 404s, open-redirect check).
- Upload verification tests (fake image, mismatched type).
- `npm audit --omit=dev`: 0 vulnerabilities. Supabase security advisor: only the intentional items below.

## Known risks / residual items
- Advisor WARNs for intentional definer functions (public enquiry/view RPCs, `is_admin`, admin functions with internal checks) and "leaked password protection disabled" (a dashboard toggle).
- Enquiry rate limiting is per mobile number and global; a determined spammer rotating numbers could still create junk enquiries up to the global cap. Consider Cloudflare Turnstile if abuse appears.
- Product views are counted once per browser session client-side; bots can inflate counts.
- Customer contact details are stored in `enquiries`; define a retention period in your privacy policy.
- moto (used for local storage tests) does not enforce SigV4 signed headers; the same code against real R2 does. The server-side verification step guards either way.
