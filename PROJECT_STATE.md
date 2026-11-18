# Project State

- **Project:** GNS Jewellers
- **Supabase project:** `gns-jewellers` (ref `trikbstrswhdeucxupyc`, ap-south-1)
- **Current phase:** Complete — handoff (status: IMPLEMENTED WITH DOCUMENTED LIMITATIONS)
- **Last verified checkpoint:** 2026-11-18 — tsc/lint clean; unit 51, integration 38, E2E 31 passing; build OK; migrations 0100–0800 applied.

## Completed
Phases 0–4 (see IMPLEMENTATION_PLAN.md, FEATURE_MATRIX.md, TEST_REPORT.md).

## Blockers (external credentials)
Google OAuth client, Cloudflare R2 bucket/keys, Gemini API key. Netlify deploy not authorised.

## Open housekeeping
- The final cleanup of test-created rows (cancelled E2E orders, test rate rows, test activity entries) awaited a Supabase confirmation and did not run. Run `supabase/scripts/remove_test_users.sql` (or just its last three statements) in the SQL editor.
- Sample data + test accounts remain in the project by design until go-live (DEPLOYMENT.md §6).

## Environment notes (this container)
Node needs `NODE_USE_ENV_PROXY=1` for outbound HTTPS; Supabase host was added to the Default environment's allowed hosts; storage tests use moto on port 5055.
