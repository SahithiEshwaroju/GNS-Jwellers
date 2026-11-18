# Phase 2 — Frontend (Next.js + design system)

**Status: ✅ Complete** · Commits `4a22ab7`, `16ce7f9`

## Design system
- Tokens became a Tailwind 4 theme, using exact values from `tokens.css`.
- Fonts are self-hosted: Cormorant Garamond and DM Sans.
- The 42 supplied SVG icons became an `Icon` component. The placeholder Google "G" was replaced by the official mark.
- Shared components:
  - Accessible modal (`<dialog>`), switch toggle, photo-with-placeholder.
  - Buttons, inputs, badges, tables.

## Customer screens (15 routes)
- Home, catalogue, product page, collections and collection detail.
- Saved designs, Custom Jewellery, About, Privacy, Terms, Login.
- 404, error and loading states.
- Catalogue features: grid/list toggle, sort, "Load more", desktop filter sidebar and mobile filter sheet.
- Product page: gallery with enlarge, specifications table, price breakup, tags, similar designs.
- Header: Jewellery dropdown, search, mobile menu and account menu.

## Admin screens (14 routes)
- Login, dashboard (with SVG chart), products list, add/edit product (photos, live price, AI suggestion, preview), AI extraction.
- Taxonomy: categories, subcategories, collections, tags, and home-page category display settings.
- Rates (derived per-gram table, product preview, history), enquiries (list, detail, AI/manual reply).
- Orders (list, create with review, detail), analytics, admin access, images (per-page slots), site content.
- Shared shell: sidebar with an enquiry badge, plus a mobile admin menu.

## Responsive and accessibility
- Built for the 1440 px and 390 px design widths; no horizontal scroll from 320 px up.
- 44 px touch targets.
- Accessibility: semantic landmarks, labelled controls, a skip link, Esc to close dialogs, live regions for feedback, and no colour-only state.

## Intentional differences from the prototype
- The "Prototype / PLACEHOLDER" banners are not shipped.
- Unset shop claims (story, hallmark, contact) are hidden rather than invented.
- The hero sample photo is not used.

## Exit criteria
All screens exist with real data paths ✔ · design system applied ✔ · responsive ✔ · a11y basics ✔ · typecheck and lint clean ✔ · build passes ✔
