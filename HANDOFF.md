# Handoff — GNS Jewellers

**Overall status: IMPLEMENTED WITH DOCUMENTED LIMITATIONS.** All mandatory features are built and verified against the live Supabase database. Three integrations can't be verified live until you supply credentials: Google OAuth, Cloudflare R2 and Gemini.

## What was built
- **Customer website** (matches `docs/design-reference`, desktop and mobile):
  - Pages: home, catalogue with filters, sort, search, grid/list and load more, and product page with gallery, spec table and price breakup.
  - Enquiry: the 3-step Smart Enquiry Builder records the enquiry and prepares the WhatsApp message (the customer sends it themselves). Custom-design enquiries work the same way.
  - Accounts: saved designs with optional Google sign-in, and multi-design enquiries from the saved list.
  - Other pages: collections, About, Privacy/Terms, plus 404, error and loading states.
- **Admin portal**: dashboard, products, AI catalogue extraction, categories/collections/tags, rates, enquiries, orders, analytics, admin access, images and site content.
  - Products: add/edit with real-photo upload, publish rules, feature and delete; prices are previewed live.
  - Enquiries: status tabs, plus AI-assisted or manual replies. A reply must be approved before WhatsApp opens to the customer.
  - Orders: a review step before confirming. Numbers (GNS-0001…) are generated only when you confirm. Orders can be created from the catalogue, by manual entry, or from an enquiry.
  - Images and site content: per-page image slots and editable text, with no invented claims on the public site.
- **Backend**: 8 SQL migrations, RLS on all 20 tables, validated RPCs, a pricing engine whose SQL and TypeScript versions agree on test data, and an R2 storage flow with server-side verification.

## Architecture
Next.js 16 (App Router, TS strict, Tailwind 4) + Supabase (Postgres/Auth/RLS) + Cloudflare R2 + optional Gemini.
- No service-role key: every query runs as the visitor or signed-in user, so RLS is the single enforcement layer.
- Guest writes go through validated database functions.
- Details: ARCHITECTURE.md, DATABASE.md, DECISIONS.md.

## Verification (TEST_REPORT.md)
| Check | Result |
|---|---|
| Typecheck | 0 errors |
| Lint | 0 errors, 0 warnings |
| Unit tests | 51 passed |
| Integration tests | 38 passed: 34 RLS/RPC against the live DB, 4 storage |
| E2E (Playwright, desktop + mobile) | 31 passed |
| Production build | succeeds |
| `npm audit` | 0 vulnerabilities |
| Supabase advisors | only intentional warnings (SECURITY.md) |

## Known limitations / unverified
1. **Google sign-in**: implemented but untested live; there is no OAuth client yet. Tests sign in with password-based test accounts instead.
2. **Cloudflare R2**: verified against a local S3-compatible server (moto), not Cloudflare. Until R2 env vars are set, photo upload is disabled and placeholders show.
3. **Gemini**: never called live (no key). Without a key, the reply assistant builds the reply from the admin's answers without AI; extraction and description suggestions are disabled.
4. **Netlify**: config is prepared but not deployed. The Netlify function timeout may need raising for AI extraction.
5. **Design fidelity**: compared visually with the 42 reference screenshots; not pixel-diffed.
   - Intentional differences: the prototype banner and "PLACEHOLDER" tags are removed, and unset content (story, contact, hallmark claims) is hidden instead of shown as placeholder text.
   - The design kit's hero sample photo is not used (it's a mockup sample).
6. The live project currently contains **sample data** and **test accounts**. Remove both before launch (DEPLOYMENT.md §6). Sequences have advanced because of tests; restarting them is optional.

## Your next steps
1. Configure Google OAuth, then add the owner's email to `admins` (DEPLOYMENT.md §2–3).
2. Create the R2 bucket, token and CORS policy, and the optional Gemini key (§4–5).
3. Fill Site Content (WhatsApp number!), rates and real photos; run the remove-sample/test-user scripts (§6).
4. Push to GitHub and connect Netlify with the env vars (§7).

## Run locally
```bash
npm install
```
```bash
cp .env.example .env.local
```
```bash
npm run dev
```
