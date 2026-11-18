# Test Report — 2026-11-18

## Environment
- Linux container, Node 22.23.5, npm 10.9; Next.js 16.4.6 production build (`next start`) for E2E.
- **Database:** live Supabase project `gns-jewellers` (ap-south-1) with all migrations, default taxonomy and sample data; test accounts `e2e-admin`, `e2e-customer`, `e2e-other` @gns-test.invalid (password sign-in, used because Google OAuth can't be automated).
- **Storage:** Cloudflare R2 credentials were **not available**. Storage tests ran against **moto** (local S3-compatible server) using the same AWS SDK code paths. This proves the presign/upload/verify/sign/delete flow, not Cloudflare itself.
- **AI:** no Gemini key. AI code was tested with pure prompt/sanitiser unit tests and the no-key fallback path in E2E; no live Gemini call was made.
- Browser: Chromium (Playwright 1.63.0), desktop 1440×900 and Pixel 7 emulation.

## Commands and results (final run)
| Command | Result |
|---|---|
| `npm run typecheck` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors, 0 warnings |
| `npm test` (Vitest unit) | ✅ **51 passed** (6 files) |
| `npm run test:integration` with `NODE_USE_ENV_PROXY=1` and moto `R2_*` env | ✅ **38 passed** (34 Supabase RLS/RPC + 4 R2) |
| `npm run build` | ✅ success, 35 routes |
| `npm run test:e2e` with moto `R2_*` env | ✅ **31 passed** (desktop 24, mobile 7) — 2.3 min |
| `npm audit --omit=dev` | ✅ 0 vulnerabilities |
| Supabase security advisor | ⚠️ intentional WARNs only (see SECURITY.md) |

## Coverage highlights
- **Unit:** pricing (design figures ₹3,62,694 / ₹61,795, silver, %/per-gram making, no-rates, rounding, TS↔SQL parity on 7 products), derived rate table, INR/IST formatting, WhatsApp message + links, zod schemas (enquiry, product incl. BR-03, order dates/amounts, settings URL safety), upload rules + magic-byte sniffing + key safety, AI prompt rules and output sanitising.
- **Integration (Supabase):** anon cannot read 9 private tables, write catalogue/rates/settings, see rate authors or call admin functions; enquiry RPC validation, server-side price snapshot, token-gated WhatsApp-opened, rate limiting, custom enquiries, view recording; customer cannot escalate, saves only published products, cannot read/modify others' saved items, enquiries, orders or profiles; admin sees drafts, codes are generated and immutable, publish without photo blocked, order numbers unique, invalid orders rejected, self-removal blocked, analytics shape, rate change recalculates catalogue price, rate history append-only.
- **Integration (storage):** presigned PUT → HEAD → magic bytes → signed GET → delete; mismatched type and HTML-disguised-as-image rejected by verification; signed downloads force image content type; path traversal keys refused.
- **E2E:** home, catalogue filter/sort/search/empty/load-more, product page breakup, full 3-step enquiry with validation, WhatsApp link + opened record, custom enquiry, save-requires-sign-in, 404 for unknown product, collections/about; signed-in save → saved list → multi-product enquiry recorded as registered → unsave; admin dashboard, rates change reflected on site and restored, full product lifecycle with real upload (fake image rejected, draft hidden from public, photo served through authorised route), feature/delete, category add/delete reflected in filters, AI-assisted reply via no-key fallback → approve → WhatsApp link to customer → order from enquiry (catalogue + manual line, quote/advance → balance) → enquiry converted → cancel, site content edit visible on home, admin add/remove with self-protection, analytics/extract/images pages; access control (redirect, non-admin denial, 403 uploads incl. cross-origin, media 404, open-redirect); mobile: no horizontal overflow on 7 pages, menu, filter sheet, admin menu.

## Defects found and fixed during testing
| # | Defect | Fix |
|---|---|---|
| 1 | `confirm_order` (invoker) called internal `log_activity` → 42501 for admins | migration 0700: logging via definer trigger |
| 2 | New definer/trigger functions inherited PUBLIC execute | migrations 0600/0800 revoke + default privileges |
| 3 | `tintFor` exported from a client module was called on the server | moved to `lib/tint.ts` |
| 4 | Root `loading.tsx` made unknown products return 200 (soft 404) | loading UI scoped to catalogue; 404s verified |
| 5 | Duplicate checkbox ids between desktop sidebar and mobile filter sheet broke label association | per-instance ids (`useId`) |
| 6 | Filter checkboxes didn't tick until navigation completed | optimistic selection state |
| 7 | Uploaded objects with a mismatched stored Content-Type could pass | completion check also compares Content-Type; signed GET forces type |
| 8 | Non-admin visiting `/admin` logged a server error (page rendered in parallel with layout) | analytics loader returns empty data on 42501 |
| 9 | setState-in-effect lint errors (menus, sheet) | React "reset on change" pattern |
| 10 | Playwright version mismatch with preinstalled browser | pinned @playwright/test 1.63.0 |
| 11 | Gemini timeout (30 s) exceeded Netlify function limits | 20 s |

## Not run / limitations
- **Google OAuth sign-in** (no OAuth client configured) — sessions were injected via real password sign-in of test users.
- **Cloudflare R2** live (no credentials) — moto used.
- **Gemini** live (no key) — fallback path tested; real model quality unverified.
- **Netlify deploy** — not performed (not authorised); build verified locally.
- Pixel-perfect comparison was not performed; screens were compared visually with `docs/design-reference/reference-screenshots` at 1440 and 390 px (layout, typography, colours, components match; differences are listed in HANDOFF.md).
- Screen-reader testing with real assistive technology was not performed; semantics, labels and focus handling were checked in code and via role-based Playwright locators.

## Running the suites yourself
```bash
pip install "moto[server]" && moto_server -p 5055
```
```bash
R2_ENDPOINT=http://127.0.0.1:5055 R2_ACCESS_KEY_ID=test R2_SECRET_ACCESS_KEY=test R2_BUCKET=gns-test R2_ACCOUNT_ID=local npm run test:integration
```
```bash
npm run build && R2_ENDPOINT=http://127.0.0.1:5055 R2_ACCESS_KEY_ID=test R2_SECRET_ACCESS_KEY=test R2_BUCKET=gns-test R2_ACCOUNT_ID=local npm run test:e2e
```
Integration/E2E need `.env.local` and `.env.test.local` (test account emails/passwords; see `supabase/scripts` for creating/removing test users). In this container Node also needed `NODE_USE_ENV_PROXY=1` because of the network proxy. Tests clean up the data they create; cancelled test orders can be removed with `supabase/scripts/remove_test_users.sql`.
