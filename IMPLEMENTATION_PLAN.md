# Implementation Plan

Status: ☐ todo · ◐ in progress · ✔ done (verified) · ⛔ blocked

## Phase 0 — Discovery & architecture
| T | REQ | Task | Verify | Status |
|---|---|---|---|---|
| T-00 | all | Inspect inputs, write SPEC/MATRIX/ARCH/PLAN/DECISIONS/STATE, scaffold Next app, copy design assets | docs exist, app builds | ✔ |

## Phase 1 — Backend
| T | Deps | Task | Files | Verify | Status |
|---|---|---|---|---|---|
| T-10 | T-00 | Core schema: profiles, admins, is_admin, taxonomy, products, media, images, tags, rates, settings | `supabase/migrations/0001_*.sql` | migration applies | ☐ |
| T-11 | T-10 | Pricing SQL + `catalogue_products` view + facets | `0002_*` | parity test | ☐ |
| T-12 | T-10 | Enquiries, views, saved, orders, activity + RPCs | `0003_*` | integration tests | ☐ |
| T-13 | T-10..12 | RLS policies for all tables | `0004_*` | RLS tests, advisors | ☐ |
| T-14 | T-13 | Admin RPCs: dashboard/analytics/admins/delete guards | `0005_*` | integration tests | ☐ |
| T-15 | T-13 | Seed taxonomy + sample products (dev/test only, clearly marked) | `supabase/seed.sql` | site shows data | ☐ |
| T-16 | T-10 | Generated TS types | `src/lib/supabase/database.types.ts` | tsc | ☐ |
| T-17 | – | R2 helpers + upload/download routes | `src/lib/r2.ts`, `api/uploads`, `api/media` | unit + moto integration | ☐ |
| T-18 | – | Gemini module | `src/lib/ai/gemini.ts` | unit (mocked) | ☐ |
| T-19 | – | `.env.example`, gitignore | | review | ☐ |

## Phase 2 — Frontend
| T | Task | Status |
|---|---|---|
| T-20 | Tokens → Tailwind theme, fonts, icons component, UI primitives | ☐ |
| T-21 | Site shell: header (nav, Jewellery dropdown, search, saved, account), rate bar, mobile menu, footer | ☐ |
| T-22 | Home, Collections, Catalogue (filters/sort/grid-list/load more, mobile sheet), Product page, Saved, Custom, About, Privacy/Terms, Login | ☐ |
| T-23 | Enquiry builder modal (3 steps) | ☐ |
| T-24 | Admin shell (sidebar, mobile menu) + login | ☐ |
| T-25 | Admin: dashboard, products list/form, extraction, taxonomy, rates, enquiries (+AI/manual reply), orders (list/new/detail), analytics, admins, images, content | ☐ |
| T-26 | Loading/error/not-found/empty states | ☐ |

## Phase 3 — Integration
| T | Task | Status |
|---|---|---|
| T-30 | Wire auth (Google, callback, proxy guard, sign-out) | ☐ |
| T-31 | Wire all server actions/queries; remove sample data from prod paths | ☐ |
| T-32 | Wire uploads/images end-to-end | ☐ |
| T-33 | Shortcut sweep (TODO/mock/dead buttons) | ☐ |

## Phase 4 — Testing & hardening
| T | Task | Status |
|---|---|---|
| T-40 | Unit tests | ☐ |
| T-41 | Integration tests vs Supabase (RLS/RPC) | ☐ |
| T-42 | R2 flow vs moto S3 | ☐ |
| T-43 | Playwright E2E desktop + mobile | ☐ |
| T-44 | Lint, typecheck, build, npm audit, Supabase advisors | ☐ |
| T-45 | Visual comparison with reference screenshots | ☐ |
| T-46 | Docs: README, DATABASE, SECURITY, TEST_REPORT, DEPLOYMENT, HANDOFF | ☐ |

## Phase exit gates
- **P1:** migrations applied to Supabase; RLS on all tables; advisors show no security errors; integration tests (RLS allow/deny, RPCs) pass; R2 presign/complete flow passes against moto; env documented.
- **P2:** every screen in the design exists and renders with real data paths; `tsc` + lint clean; build passes.
- **P3:** every mutation goes through server actions/RPC to Supabase; no sample data in app code; E2E journeys pass against the live project.
- **P4:** all suites run and recorded; security review done; docs complete; honest status.
