# GNS Jewellers

Digital jewellery catalogue and WhatsApp enquiry platform for GNS Jewellers, with an admin portal for products, pricing, enquiries and internal orders.

- **Customers** browse real product photos, filter/search, see approximate prices calculated from the shop's daily rates, save designs (optional Google sign-in) and send structured enquiries via WhatsApp.
- **Admins** (allow-listed Google accounts) manage products, categories/collections/tags, gold & silver rates, site content and images, reply to enquiries (AI-assisted or manually), and record orders.

| Doc | Purpose |
|---|---|
| [PROJECT_SPEC.md](PROJECT_SPEC.md) | Requirements, business rules, assumptions |
| [FEATURE_MATRIX.md](FEATURE_MATRIX.md) | Requirement → implementation → test status |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design |
| [DATABASE.md](DATABASE.md) | Schema, functions, migrations |
| [SECURITY.md](SECURITY.md) | Auth, RLS, storage security, checks performed |
| [TEST_REPORT.md](TEST_REPORT.md) | What was tested and the results |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Netlify / Supabase / R2 / Google / Gemini setup |
| [HANDOFF.md](HANDOFF.md) | Final status and next steps |
| [DECISIONS.md](DECISIONS.md), [PROJECT_STATE.md](PROJECT_STATE.md), [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Decision log and progress |

## Stack
Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · Supabase (Postgres, Auth, RLS) · Cloudflare R2 (S3 API) · Gemini Flash (optional) · Netlify.

## Prerequisites
Node.js 22+, npm 10+, a Supabase project with the migrations applied (see DEPLOYMENT.md).

## Local development
```bash
npm install
```
```bash
cp .env.example .env.local   # then fill in the values
```
```bash
npm run dev                  # http://localhost:3000
```
The admin portal is at `/admin` (Google sign-in; your email must be in the `admins` table — see DEPLOYMENT.md §3).

## Commands
| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (strict) |
| `npm test` | Unit tests (Vitest) |
| `npm run test:integration` | RLS/RPC tests against Supabase + R2 tests against an S3-compatible endpoint (needs `.env.test.local`, see TEST_REPORT.md) |
| `npm run test:e2e` | Playwright end-to-end tests (builds must exist: run `npm run build` first) |

## Project layout
```
src/app/(site)        customer website          src/app/admin        admin portal
src/app/actions       server actions            src/app/api          uploads + media routes
src/components        UI (ui/, site/, admin/)   src/lib              pricing, validation, data access, R2, AI
supabase/migrations   ordered SQL migrations    supabase/seed        default taxonomy + removable sample data
tests/                unit, integration, e2e    docs/design-reference  supplied design system
```
