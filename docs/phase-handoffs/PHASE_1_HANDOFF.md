# Phase 1 — Backend (Supabase + Cloudflare R2)

**Status: ✅ Complete** (live R2 unverified — no credentials) · Commits `514edad`, `5cd2e09`

## Database (applied to Supabase project `trikbstrswhdeucxupyc`)
- **8 migrations** (`supabase/migrations/`), 20 tables, 2 views, RLS on every table, explicit grants. The tables:
  - profiles, admins
  - categories, subcategories, collections, tags
  - products, product_tags, product_images, media
  - rate_updates
  - site_settings, site_images
  - enquiries, enquiry_items
  - product_views, saved_products
  - orders, order_items
  - activity_log
- **Pricing engine** `product_estimate()`: reproduces the design figures exactly (₹3,62,694 and ₹61,795).
- **Auto codes:**
  - Products: `GNS-<prefix>-0001`, immutable.
  - Enquiries: `GNS-ENQ-1001…`.
  - Orders: `GNS-0001…`, assigned only on confirmation.
- **Guest-safe RPCs:**
  - `create_enquiry` validates input, takes prices from the server and is rate-limited.
  - `mark_enquiry_whatsapp_opened` only works with the token returned at creation.
  - `record_product_view`.
- **Admin functions:** save product, analytics, admin list/remove (guarded), rate history, stale-media cleanup. Each checks `is_admin()`.
- **Seeds:**
  - Default taxonomy from the design.
  - 15 products and one rate row, all flagged `is_sample` and removable with a script.
  - 3 test accounts.

## Storage and AI
- **R2:** private bucket design.
  - Upload: presigned PUT bound to the exact type and size; the server then checks size, stored type and the file's magic bytes before accepting it.
  - Download: authorised signed GET that forces the image content type.
  - Object keys are always generated server-side.
- **Gemini module:** strict prompts (only the customer's questions and the admin's answers); manual fallback when no key is set.
- `.env.example` documents every variable and whether it is browser-safe or server-only.

## Verification
| Check | Result |
|---|---|
| RLS/RPC tests against the live DB (anon, customer, other customer, admin) | 34/34 |
| R2 flow against a local S3-compatible server (moto) | 4/4 |
| Supabase advisors | only intentional warnings |

## Issues found and fixed
| Issue | Fix |
|---|---|
| Admin functions created after the blanket revoke inherited public execute | Migration 0600 |
| `confirm_order` called an internal function admins can't execute | Migration 0700 |
| Trigger functions and some foreign keys flagged by the advisor | Migration 0800 |

## Not verified
Real Cloudflare R2 (no credentials; moto used instead).
