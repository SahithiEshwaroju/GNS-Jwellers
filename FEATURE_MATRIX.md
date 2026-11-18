# Feature Matrix

Status legend: ☐ not started · ◐ implemented, not verified · ✔ implemented & verified · ⛔ blocked (external).
Test IDs refer to files under `tests/` (U = unit, I = integration, E = e2e). Statuses below are final for this delivery (2026-11-18). ⛔ = needs external credentials (Google OAuth client, Cloudflare R2, Gemini key); ◐ = implemented, verified only partially for that reason.

| F | REQ | Role | Workflow | UI | Data / functions | Authorisation | Storage | Acceptance | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| F-01 | 001,007 | Guest | Home page | `(site)/page.tsx` | settings, categories, collections, `catalogue_products` (featured/new) | public read published | site images | Hero/categories/collections/featured/new arrivals render from DB; featured toggle reflects | E guest || ✔ |
| F-02 | 002,003,005 | Guest | Browse catalogue, filter, sort, load more | `(site)/jewellery` | `catalogue_products`, facet counts | public read published | product images | Filters/sort change results correctly; drafts never shown | I catalogue, E guest || ✔ |
| F-03 | 004 | Guest | Search | header search → `/jewellery?q=` | `search_text` ILIKE on name/code/desc/tags/category | public | – | Known product found by name, code, tag | I catalogue, E guest || ✔ |
| F-04 | 006,021 | Guest | Product details | `(site)/product/[code]` | product, images, tags, similar | public; drafts 404 for non-admin | images | All fields, breakup equals BR-01 | U pricing, E guest || ✔ |
| F-05 | 008,009,036 | All | Price calc & disclaimer | rate bar, cards, breakup | `product_price()`, `current_rates` | public read rates; admin write | – | Changing rates changes estimates; disclaimer shown | U pricing, I pricing parity, E admin rates || ✔ |
| F-06 | 010,011,012,013 | Guest | Smart enquiry → WhatsApp | EnquiryModal | `create_enquiry()`, `mark_enquiry_whatsapp_opened()` | RPC only; enquiries unreadable by public | – | Message correct; record stored; opened timestamp set | U whatsapp, I enquiry RPC, E guest || ✔ |
| F-07 | 014 | Customer | Google sign-in | header account, `/login`, `/auth/callback` | auth, profiles trigger | own profile | – | Sign-in/out works; browsing without it | E (session injected) ; Google ⛔ until OAuth configured || ◐ Google ⛔ |
| F-08 | 015,016 | Customer | Save / saved list / multi-enquiry | heart, `/saved` | `saved_products` | own rows only | – | Save persists; other users can't read; multi-enquiry message lists all | I RLS, E customer || ✔ |
| F-09 | 017 | Guest | Collections | `/collections`, `/collections/[slug]` | collections + counts | public | banners | Lists collections & products | E guest || ✔ |
| F-10 | 018 | Guest | Custom jewellery enquiry | `/custom-jewellery` | `create_enquiry(source=custom)` | RPC | site images | Record + WhatsApp message | E guest || ✔ |
| F-11 | 019,020 | Guest | About, privacy, terms | pages | site_settings | public | about photo | Content from Site Content; placeholders when unset | E guest || ✔ |
| F-12 | 022 | Guest | Product view tracking | product page | `record_product_view()` | RPC; views readable by admin only | – | View counts increase | I || ✔ |
| F-13 | 030 | Admin | Admin sign-in/guard | `/admin/login`, proxy, shell | `is_admin()` | allow-list | – | Non-admin redirected/denied; admin enters | I RLS, E admin || ✔ (Google ⛔) |
| F-14 | 031 | Admin | Dashboard | `/admin` | `admin_dashboard_stats()` | admin | – | Real counts from DB | I, E admin || ✔ |
| F-15 | 032,033 | Admin | Product list & CRUD | `/admin/products`, `/new`, `/[id]` | products, product_tags, `next_product_code` | admin write | – | Create draft with essentials; publish/unpublish/feature/delete | I RLS, E admin || ✔ |
| F-16 | 034 | Admin | Product photos | upload widget | media, product_images | admin | R2 presign/complete/delete | Valid image uploads; invalid type/size rejected; served via signed URL | U r2, I r2(moto), E admin || ✔ (moto) / R2 ⛔ |
| F-17 | 035 | Admin | Categories/subcats/collections/tags | `/admin/taxonomy` | taxonomy tables, delete guards | admin | category/collection images | New items appear on site; in-use deletion blocked | I, E admin || ✔ |
| F-18 | 036 | Admin | Rates | `/admin/rates` | rate_updates, history | admin | – | Save → history + prices change | I, E admin || ✔ |
| F-19 | 037 | Admin | Enquiry management | `/admin/enquiries` | enquiries, items | admin | – | List/tabs/detail/status | I, E admin || ✔ |
| F-20 | 038 | Admin | AI reply | enquiry detail | `/lib/ai/gemini` | admin server action | – | Q-by-Q → reply; edit; WhatsApp link | U gemini(mocked); live ⛔ no key || ◐ live AI ⛔ |
| F-21 | 039 | Admin | Manual reply | enquiry detail | enquiries.admin_reply | admin | – | Reply saved; WhatsApp link to customer | E admin || ✔ |
| F-22 | 040 | Admin | Orders | `/admin/orders`, `/new`, `/[id]` | orders, items, `confirm_order()` | admin only | – | Number generated on confirm; unique; list/search/detail/cancel | I, E admin || ✔ |
| F-23 | 041 | Admin | Analytics | `/admin/analytics` | `admin_analytics()` | admin | – | Period changes numbers | I || ✔ |
| F-24 | 042 | Admin | Admin access | `/admin/admins` | admins, `admin_list_admins()`, guards | admin | – | Add/remove; self & last guarded | I || ✔ |
| F-25 | 043 | Admin | Site images | `/admin/images` | site_images, categories/collections image | admin | R2 | Upload replaces placeholder on site | E admin || ◐ (UI built; upload path shared with F-16) |
| F-26 | 044 | Admin | Site content | `/admin/content` | site_settings | admin write, public read | – | Saved text appears on site | E admin || ✔ |
| F-27 | 045 | Admin | AI catalogue extraction | `/admin/extract` | media(private), Gemini | admin | R2 private | Draft fields editable; real photo required | U (mocked); live ⛔ || ◐ live AI ⛔ |
| F-28 | 046 | Admin | AI description assist | product form | Gemini | admin | – | Suggest/accept/reject/regenerate | U (mocked); live ⛔ || ◐ live AI ⛔ |
| F-29 | NFR-01/02 | All | Responsive & a11y | all | – | – | – | 390/1440 layouts, keyboard, labels | E mobile+desktop || ✔ |
| F-30 | NFR-03 | All | Security | all | RLS everywhere | – | – | Advisors clean; denial tests pass | I RLS, advisors || ✔ |
