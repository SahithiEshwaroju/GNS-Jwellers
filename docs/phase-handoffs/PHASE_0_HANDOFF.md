# Phase 0 — Project Understanding, Discovery & Architecture

**Status: ✅ Complete** · Commit `514edad`

## Inputs inspected
- MVP document, PRD and Ideation document (.docx).
- Design ZIP containing:
  - `tokens.css` (exact colours, fonts, spacing);
  - 44 SVG icons with a usage map;
  - 1 hero sample photo;
  - 42 reference screenshots: customer and admin, desktop and mobile, plus interaction states.
- Finding: the ZIP's `index.html` points to `screens/*.html` and `CLAUDE_CODE_HANDOFF.md`, which were **missing**, so the screenshots became the visual authority.
- Repository: none existed, so this was a new project.

## Decisions you made (asked once)
| Topic | Decision |
|---|---|
| Supabase | Create a dedicated project `gns-jewellers` (Mumbai) |
| "Needs confirmation" features | Build all: Google sign-in, saved designs, multi-product enquiry, AI extraction, AI descriptions |
| Order money fields | Optional quoted/advance amounts, no payment tracking |
| Git | Local commits only |

## Deliverables
| File | Content |
|---|---|
| `PROJECT_SPEC.md` | 41 requirements (REQ-001…046), 13 business rules, NFRs, journeys, assumptions, non-goals |
| `FEATURE_MATRIX.md` | 30 features mapped to UI, data, auth, storage and tests |
| `ARCHITECTURE.md` | System design, boundaries, storage and AI strategy |
| `IMPLEMENTATION_PLAN.md` | Tasks T-00…T-46 with exit gates |
| `DECISIONS.md` | 13 decisions (D-001…D-013) |
| `docs/design-reference/` | Design assets copied into the repo |
| App scaffold | Next.js 16.4, React 19, TypeScript 5.9 strict, Tailwind 4 |

## Exit criteria
Inputs inspected ✔ · scope documented ✔ · requirements traceable ✔ · design inventoried ✔ · architecture documented ✔ · plan and gates defined ✔ · no blocking ambiguity ✔
