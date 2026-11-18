# Decisions

| ID | Date | Decision | Rationale |
|---|---|---|---|
| D-001 | 2026-11-18 | Create a dedicated Supabase project `gns-jewellers` (ap-south-1) and use it for migrations and integration tests. | User choice. Mumbai region suits Indian customers. |
| D-002 | 2026-11-18 | Build all "needs confirmation" MVP features shown in the final design: customer Google sign-in, saved designs, multi-product enquiry, AI catalogue extraction, AI description assist. | User choice; final design includes them. |
| D-003 | 2026-11-18 | Orders carry optional informational `quoted_amount` and `advance_amount`; balance = quoted − advance. No payment workflow/invoices. | User choice; reconciles design columns with MVP exclusion of payment tracking. |
| D-004 | 2026-11-18 | Local git commits at milestones; no push. | User choice. |
| D-005 | 2026-11-18 | Next.js 16.4 / React 19.3 / Tailwind 4 / TypeScript 5.9 (not 7). | Current stable from create-next-app; TS 7 is a new major not yet assumed compatible with Next tooling. |
| D-006 | 2026-11-18 | Disable `cacheComponents` and `partialPrefetching`. | Almost every page reads Supabase auth cookies (header account state, saved hearts, admin). Classic dynamic rendering is simpler and lower-risk on Netlify. Can be revisited. |
| D-007 | 2026-11-18 | No service-role key in the app; guest writes via SECURITY DEFINER RPCs; admin via RLS `is_admin()`. | Smallest privileged surface; RLS enforces everything. |
| D-008 | 2026-11-18 | Price computed in SQL (`product_price`) and mirrored in TS with parity tests. | Enables DB-side price filtering/sorting; one formula. |
| D-009 | 2026-11-18 | Single private R2 bucket; public images served by authorised 302 to short-lived signed URLs. | Avoids a public bucket; still cacheable per browser. |
| D-010 | 2026-11-18 | Fonts self-hosted from `@fontsource` (Cormorant Garamond, DM Sans; OFL). | No runtime dependency on Google Fonts; licence-clean. |
| D-011 | 2026-11-18 | Gemini Flash via REST (`GEMINI_MODEL` default `gemini-2.5-flash`) with manual fallback. | MVP names Gemini; key not yet provided. |
| D-012 | 2026-11-18 | Prototype banner and "PLACEHOLDER" tags from the design are not shipped; unset content renders neutral placeholders. | They are prototype annotations, and BR-13 forbids invented claims. |
| D-013 | 2026-11-18 | Admin = confirmed-email match against `admins` table. Email/password sign-up should be disabled in the Supabase dashboard (documented). | Prevents unverified accounts impersonating an admin email. |
