# Phase 3 — Backend–Frontend Integration

**Status: ✅ Complete** (Google / R2 / Gemini not verified live) · Commits `4a22ab7`, `16ce7f9`

## Wiring
- **Auth:**
  - `@supabase/ssr` cookies, with session refresh and an `/admin` gate in `proxy.ts`.
  - Google OAuth via PKCE, with a safe redirect in `/auth/callback`; sign-out route.
  - Admin access is decided in the database (`is_admin()`).
- **Data:** every list, form and dashboard reads and writes through server actions or RPCs as the signed-in user, so RLS applies everywhere. There is no mock data in production code paths.
- **Enquiry flow** (works end to end):
  1. Preview the message, built on the server.
  2. Record it via `create_enquiry`.
  3. Open the `wa.me` link.
  4. The opened time is recorded with the enquiry's token.
  5. It appears in the admin list.
  6. The admin replies (AI or manual), approves, and WhatsApp opens to the customer.
  7. "Create order" links the order back to the enquiry and marks it converted.
- **Uploads:** browser → presign → direct PUT with a progress bar → server verification → attached to the product or site slot. Replaced or removed images are deleted from storage.
- **Pricing:** changing the rates recalculates every price on the site immediately; this is checked in E2E.

## Shortcut sweep
- No TODO/FIXME/mock code left in production paths.
- No dead buttons.
- Sample data is confined to the database and flagged `is_sample`.

## Not verified live
| Integration | What was tested instead |
|---|---|
| Google sign-in | Tests sign in with password test accounts, using real Supabase sessions |
| Cloudflare R2 | moto |
| Gemini | The no-key fallback path |
