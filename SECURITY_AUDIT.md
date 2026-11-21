# Production Security Audit — 2026-11-21

Scope: full repository, the live Supabase project (`trikbstrswhdeucxupyc`), the Next.js production build, and the Netlify configuration.
Method: configuration review, then attacks from outside the UI — raw PostgREST/RPC calls with an anonymous key, a valid customer token and forged tokens; direct server-action calls using IDs extracted from the browser bundle; cross-origin requests; stored/reflected XSS payloads; file-access probes against real objects in an S3-compatible store.

**Verdict: NOT SAFE TO DEPLOY *yet* — three pre-launch actions remain (all configuration/data, no code). See "Required before launch".** The application code and database authorization passed every test. Nothing CRITICAL was found.

## Findings
| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | **HIGH** (data/config) | A test administrator (`e2e-admin@gns-test.invalid`, password login) is on the `admins` list and test users exist in the production database. It had been removed before this audit; it was re-added temporarily to run admin-side attack tests. | **OPEN — needs you.** Run `supabase/scripts/pre_production_cleanup.sql` (the Supabase tool's confirmation prompt for the delete timed out, so I could not run it). |
| 2 | MEDIUM (config) | Supabase Email/password sign-up is enabled although the app only uses Google. Allows open creation of password accounts and leaves the pre-registration ("account pre-hijack") class of attack open for admins who haven't signed in yet. Email confirmation *is* required (`mailer_autoconfirm=false`) and sign-up with an admin's address was tested: no session is issued, no admin access results. | **OPEN — dashboard setting.** Authentication → Providers → Email → disable. |
| 3 | MEDIUM | Admin page code executed (and its output streamed) for signed-in non-admins; the "No admin access" screen was only a UI layer. No data leaked (RLS returned nothing) but admin UI/logic ran. | **FIXED** — `src/proxy.ts` now asks the database (`is_admin()`) before any `/admin/*` request or admin server action runs; non-admins are redirected. |
| 4 | MEDIUM | Session cookies had no `Secure` flag. | **FIXED** — set whenever `NEXT_PUBLIC_SITE_URL` is https (`proxy.ts`, `lib/supabase/server.ts`). Verified on an https build: `Secure; SameSite=Lax`. |
| 5 | MEDIUM (deploy) | Netlify secrets scanning would fail the build on the public `NEXT_PUBLIC_SUPABASE_*` values, which Next.js inlines into the browser bundle by design. | **FIXED** — `SECRETS_SCAN_OMIT_KEYS` in `netlify.toml` lists only those three public variables; scanning stays on for everything else. |
| 6 | LOW | No HSTS and no CSP. | **FIXED** — HSTS plus a CSP (`default-src 'self'`; `connect-src`/`img-src` limited to Supabase and R2; `object-src 'none'`; `base-uri`/`form-action 'self'`; `frame-ancestors 'none'`). `script-src` keeps `'unsafe-inline'` (Next.js bootstrap scripts, no nonces), so it limits where data can go but is not a full XSS barrier. Every E2E test now fails if the CSP blocks anything. |
| 7 | LOW | Admin user UUIDs (`media.uploaded_by`, `site_settings.updated_by`) and R2 object keys are readable through the public API. Keys alone grant no file access (private bucket, signed URLs). | Accepted — fixing needs column-level grants and app changes; opaque IDs. |
| 8 | LOW | Malformed percent-encoding in a dynamic URL (`/product/%E0%A4%A`) gets a bare `500 Internal Server Error` from Next.js itself. No detail leaked. | Accepted (framework behaviour). |
| 9 | LOW | Supabase session cookie is not `HttpOnly` (required by `@supabase/ssr` design); `record_product_view` and the public enquiry RPC can be spammed (enquiries are rate-limited: 5 per mobile per 10 min, 60/min global). No CAPTCHA. | Accepted; add Cloudflare Turnstile if abuse appears. |
| 10 | LOW | Advisor WARNs for `SECURITY DEFINER` functions callable by `anon`/`authenticated` (`create_enquiry`, `is_admin`, `mark_enquiry_whatsapp_opened`, `record_product_view`, and admin functions) and "leaked password protection disabled". Each is intentional and validated or admin-checked; the password warning disappears when the Email provider is disabled. | Accepted / see #2 |

## PASS (actually tested)
- **RLS**: all 20 tables enabled; policies read; no non-admin write path; 36 direct-API attack tests pass (read/modify/delete across all privileged tables, profile edits, internal functions, admin RPCs, non-public schemas `auth`/`storage`/`extensions`/`pg_catalog`, forged and unsigned JWTs, `user_metadata` role claims, email-change takeover, sign-up with an admin's email).
- **IDOR**: customer B cannot list/read/insert/delete customer A's saved designs or profile; enquiry tokens cannot be harvested; draft products, their photos, AI-extraction uploads and unattached media are invisible to anonymous and customer users and un-publishing hides photos again.
- **Authorization at the app layer**: every `/admin/*` route redirects anonymous and customer users before any page code runs; all 29 admin server actions refuse anonymous and customer callers and change nothing (database re-checked); a positive control proves the harness works; a cross-site action request with a valid admin session is rejected.
- **Storage**: media route returns identical 404 for private and non-existent files (no oracle); signed URLs force the image content type, carry a signature, and fail when the object path is tampered; upload endpoints reject SVG/HTML/oversized/invalid purposes, ignore client-supplied keys, reject cross-origin and non-admin callers.
- **XSS**: script/img/svg payloads in search, filters, enquiry fields (viewed by admin), site content, product names/descriptions/tags/styles render as inert text; `javascript:`/`data:` URLs and invalid colours are refused by database constraints.
- **Redirects**: eight open-redirect variants against `/auth/callback` never leave the site; sign-out is not triggerable cross-site.
- **Secrets**: a build with canary values for every server-side secret contains none of them anywhere in `.next` (client or server). Only the public Supabase URL and publishable key appear in the browser bundle; no JWT literals; no service-role key exists anywhere (the app never uses one). Git history and tracked files contain no secrets; `.env*` is ignored (only `.env.example` with placeholders is tracked).
- **Dependencies**: `npm audit` (prod and dev) — 0 vulnerabilities.
- **Errors/logging**: hostile URLs and parameters return generic responses; server logs contain only error messages (no secrets, tokens or request bodies); no `eval`, `document.write`, user-controlled `innerHTML`, or server-side fetches of user-supplied URLs (the only server fetch is to a fixed Gemini URL).
- **Probing**: `.env`, `.git`, source, migration, config and docs paths return 404; no source maps are served to browsers.

## Cloudflare R2 — not audited live
The Cloudflare tool could not connect from this session (proxy 403), so **the bucket's real configuration was not inspected**. The code and flow were tested only against a local S3-compatible server. Please verify in the Cloudflare dashboard: bucket **public access disabled** (no r2.dev URL, no custom public domain), API token scoped to *Object Read & Write on that one bucket only*, CORS allowing only your site origin (`PUT`, `GET`, header `content-type`), and that R2 keys exist only in Netlify's secret environment variables.
Note: two media rows already exist in the database for photos uploaded from your side, so an R2 bucket is in use.

## Required before launch
1. **Run `supabase/scripts/pre_production_cleanup.sql`** (removes the test admin/users and test orders). Confirm only the two real admins remain.
2. **Disable the Email provider** in Supabase Auth (Google only), and set the Site URL / Redirect URLs to the production domain only (remove `localhost` entries).
3. **Verify the Cloudflare R2 bucket settings** above.
Then on Netlify: set `NEXT_PUBLIC_SITE_URL` to the https URL; mark R2/Gemini variables as secrets; if Netlify's *smart detection* flags the Supabase anon key, add `SECRETS_SCAN_SMART_DETECTION_OMIT_VALUES` with that public value rather than disabling scanning.

## Tests executed (final code)
| Suite | Result |
|---|---|
| `tsc --noEmit` / ESLint | clean / clean |
| Unit (Vitest) | 51 / 51 |
| Integration (live Supabase + S3-compatible): RLS/RPC 34, storage 4, **attack 36** | 74 / 74 |
| E2E (Playwright, desktop+mobile) incl. **13 new attack tests** and a CSP-violation check on every test | 48 / 48 |
| Production build; canary-secret build; https cookie probe | pass |
| `npm audit` | 0 vulnerabilities |
Not tested: real Google login, real Cloudflare R2, real Gemini, an actual Netlify deploy/scan, Supabase dashboard-only settings (redirect allow-list, provider toggles).
Re-run the attacks with `npm run test:integration` (needs `.env.local` + `.env.test.local`) and `npm run test:e2e`; helper tools are in `scripts/`.
