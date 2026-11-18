# Project State

- **Project:** GNS Jewellers — catalogue, enquiry and admin web app
- **Supabase project:** `gns-jewellers` (ref `trikbstrswhdeucxupyc`, ap-south-1)
- **Current phase:** Phase 2 — Frontend (backend verified)
- **Last verified checkpoint:** 2026-11-18 — migrations 0100–0600 applied; pricing parity on design figures; anon denied enquiries/admin RPC; admin test login + `is_admin()` true.

## Completed
- Phase 0: inputs inspected, SPEC/MATRIX/ARCHITECTURE/PLAN/DECISIONS written, Next 16 app scaffolded, design assets copied to `docs/design-reference/`.
- T-10..T-15: schema, pricing view, enquiries/orders/activity, RLS + grants, admin functions, grant tightening; default taxonomy + sample data (flagged `is_sample`).
- T-16: TS types (`src/lib/supabase/database.types.ts`).

## In progress / next
- T-17 R2 helpers + upload/media routes; T-18 Gemini; T-19 env docs. Then Phase 2 UI.

## Environment notes
- Container proxy: Node needs `NODE_USE_ENV_PROXY=1`; Supabase host allowed in Default environment.
- No Docker daemon; R2 integration tested against local moto S3 (planned).
- Test accounts (`*@gns-test.invalid`) exist in the Supabase project; credentials in git-ignored `.env.test.local`; removal script `supabase/scripts/remove_test_users.sql`.

## Blockers (external)
- Cloudflare R2 bucket/keys, Gemini API key, Google OAuth client not provided → live verification of those integrations impossible here.

## Latest test results
- (none yet beyond the manual smoke checks above)
