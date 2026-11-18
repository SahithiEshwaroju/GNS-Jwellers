# GNS Jewellers — Project Specification

Sources: `MVP_Document_GNS_Jewellerys_1.docx` (MVP), `Build_Theory_PRD_GNS_Jewellers_1.docx` (PRD), `GNS_Jwells_Completed_Ideation_Document_1.docx` (Ideation), `GNS_Jewellers_Final_Design.zip` (Design). Copies of the design reference screenshots, tokens and icons live in `docs/design-reference/`.

Authority order: user instructions → explicit requirements/business rules → MVP → Design → engineering defaults. Scope decisions confirmed by the user on 2026‑11‑18 are recorded in `DECISIONS.md` (D‑001…D‑004).

## 1. Project overview
GNS Jewellers is a digital jewellery catalogue and enquiry website for a single jewellery shop. Customers browse real product photographs, see approximate prices calculated from the shop's current gold/silver rates, and start structured enquiries that open WhatsApp with a prefilled message. The shop owner manages products, taxonomy, rates, site content, enquiries (with AI‑assisted or manual replies) and an internal order register through an admin portal.

Core outcome (PRD §9.1): discover actual jewellery products, understand approximate prices, and initiate an enquiry through WhatsApp — while the owner maintains the catalogue with minimal effort.

## 2. Users and roles
| Role | Who | Can |
|---|---|---|
| Guest | Anonymous visitor | Browse, search, filter, view products, start enquiries (product, multi‑product, custom). |
| Customer | Signed in with Google (optional) | Everything a guest can, plus save designs, view/remove saved designs, enquire about several saved designs at once. |
| Admin | Shop owner / authorised staff whose Google email is on the admin allow‑list | Full admin portal. All admins have equal access (design: "All admins have the same full access"). |

Customers never see orders, order history or tracking (MVP "Customer‑Side Restriction").

## 3. Functional requirements
Priority: **M** = Mandatory, **I** = Important, **O** = Optional, **X** = Out of scope.

### Customer website
| ID | Requirement | Pri |
|---|---|---|
| REQ-001 | Home page: hero (headline/text editable), reference‑rate bar, Shop by Category tiles, collection banners, Featured Designs, New Arrivals, Our Story, trust highlights, footer. | M |
| REQ-002 | Catalogue of **published** products only, with real photographs (placeholder graphic if none). Grid/list toggle, "Load more" pagination. | M |
| REQ-003 | Categories and subcategories; selecting one shows its products. Jewellery dropdown/mobile menu lists categories. | M |
| REQ-004 | Search by product name, code and keywords (description, tags, category). Header search on every page. | M |
| REQ-005 | Filters: category, collection, metal, gold karat, price band, style, occasion, gender. Sort: latest (recently updated), price low→high, price high→low, name. Mobile filter sheet with Cancel/Save. | M |
| REQ-006 | Product details: photo gallery (with view labels, enlarge), name, collection, description, model description, approx. price + code, disclaimer with rate timestamp, specifications table, price breakup, tags, similar designs. | M |
| REQ-007 | Featured products shown on home page; owner toggles featured. | M |
| REQ-008 | Approximate price = metal value + making charges + stone value + GST%, from current rates (see BR-01). | M |
| REQ-009 | Approximate‑price disclaimer and rate freshness ("Rates updated …") wherever a price appears. | M |
| REQ-010 | Smart Enquiry Builder (3 steps: questions & details → review message → send on WhatsApp). Seven predefined questions (MVP list), optional own question, customisation choices (metal/karat), name + 10‑digit mobile required, email optional. | M |
| REQ-011 | Guest enquiries without an account. | M |
| REQ-012 | WhatsApp click‑to‑chat: `https://wa.me/<shop number>?text=<message>` with product name, code, approx price, product page link, questions, customer details. Customer sends manually. | M |
| REQ-013 | Enquiry records stored server‑side with a reference (GNS‑ENQ‑####); "WhatsApp opened" time recorded when the customer launches WhatsApp. No claim of delivery. | M |
| REQ-014 | Optional Google sign‑in for customers. Browsing and enquiry never require it. | I |
| REQ-015 | Saved designs: save/unsave from cards and product page (heart), saved list page, sign‑in prompt when signed out. | I |
| REQ-016 | Multi‑product enquiry: select several saved designs and enquire about them in one message. | I |
| REQ-017 | Collections page and collection detail (products in a collection). | I |
| REQ-018 | Custom Jewellery page: how it works, what can be customised, "Tell us what you have in mind" form → preview WhatsApp message → record enquiry → open WhatsApp. | I |
| REQ-019 | About Us page from Site Content (intro, story, values, contact, WhatsApp button). | I |
| REQ-020 | Privacy Policy and Terms pages from Site Content. | I |
| REQ-021 | Related/similar designs on product page (same category, then same collection). | I |
| REQ-022 | Product views recorded (for dashboard/analytics). | M |

### Admin portal
| ID | Requirement | Pri |
|---|---|---|
| REQ-030 | Admin authentication with Google; only allow‑listed emails gain access; sign out; "Back to Website". | M |
| REQ-031 | Dashboard: total products, registered customers, enquiry initiations (30 d), product views (30 d), enquiry‑initiation chart (30 d), top viewed products, today's gold rate card with "Update rate", recent activity, quick actions (Add product, Import from catalogue). | M |
| REQ-032 | Product management: list with tabs All/Published/Drafts/Featured, search by name/code, category filter, pagination; publish/unpublish; feature toggle; edit; delete (with confirmation). | M |
| REQ-033 | Simple product entry: required = at least one photo (to publish), name, category, metal, karat/purity, weight, making charge; optional = subcategory, collection, description, model description, stones, style, occasion, gender, specifications, tags. Save as draft or publish; preview before publishing. Product code auto‑generated from category prefix (GNS‑NK‑0001). | M |
| REQ-034 | Product photographs uploaded by the owner to Cloudflare R2 (JPEG/PNG/WebP, ≤ 8 MB), ordered, labelled (front/side/worn/detail), removable. AI never generates or substitutes photos. | M |
| REQ-035 | Categories (with code prefix, home‑page order & visibility, layout settings), subcategories, collections (name, description, colour, image, order), tags — create, rename, delete (blocked when in use), reflected across site. | M |
| REQ-036 | Gold & Silver Rates: 22K per 10 g, silver per kg, GST %; derived 24K/18K/silver per gram; product preview; rate history; last‑updated by/at. | M |
| REQ-037 | Enquiries: tabs by status (New, In progress, Replied, Converted to order, Closed), list + detail (customer, mobile, email, products, customisation, WhatsApp opened, questions), status change. | M |
| REQ-038 | AI‑assisted reply: asks the admin one question per customer question, collects answers, generates a professional reply (Gemini Flash) from only the questions + admin answers; admin edits/approves; opens WhatsApp to the customer's number; admin sends manually. | I |
| REQ-039 | Manual reply: write/edit reply without AI; same WhatsApp handoff. Works when AI is unavailable. | M |
| REQ-040 | Orders (admin only): list with search (order no., customer, mobile, product), show cancelled toggle; create order (subject, order date, expected delivery, customer name*, mobile*, email, location, address, products from catalogue search or manual entry, optional quoted amount/advance); review then confirm; unique order number GNS‑#### generated on confirmation; order detail; cancel/mark delivered. | M |
| REQ-041 | Analytics: period selector (7/30/90 d), product views, enquiry initiations, enquiries→orders, registered customers, popular categories by views, most viewed products with enquiry counts. | I |
| REQ-042 | Admin Access: add admin (name, Google email), list with added date and last sign‑in, remove (cannot remove self, at least one admin must remain). | I |
| REQ-043 | Images: site image slots grouped by page (hero, story, category tiles, collection banners, custom‑jewellery images, about photo, logo/share image) with upload/replace/remove; placeholders shown when empty. | I |
| REQ-044 | Site Content: shop name, tagline, WhatsApp number, phone, email, address, hours, hero headline/text, brand story, trust highlights, about intro/story/values, social links, privacy/terms text. | M |
| REQ-045 | AI Catalogue Extraction (beta): upload/capture a catalogue image (private), AI extracts text into an editable draft; owner reviews, attaches a real photo and saves as draft product. | O |
| REQ-046 | AI description assistance: suggest description/model description from owner‑entered facts; preview/edit/accept/reject/regenerate; never auto‑published. | O |

## 4. Non‑functional requirements
| ID | Requirement |
|---|---|
| NFR-01 | Responsive: designed for 1440 px desktop and 390 px mobile; works 320 px–1920 px; no horizontal scroll. |
| NFR-02 | Accessibility: semantic HTML, labelled controls, keyboard navigation, visible focus, dialogs trap focus/close on Esc, 44 px touch targets, WCAG AA contrast (tokens chosen for AA). |
| NFR-03 | Security: RLS on every table, least privilege, no secrets in the browser, server‑side validation, private R2 bucket, signed URLs. |
| NFR-04 | Performance: server‑rendered public pages, images lazy‑loaded, catalogue paginated (12 per load). |
| NFR-05 | Deployable to Netlify with `@netlify/plugin-nextjs`. |
| NFR-06 | Indian locale: ₹ with Indian digit grouping (₹3,62,694), dates "16 Nov 2026, 10:24 AM" in Asia/Kolkata. |

## 5. Main user journeys
1. **Guest enquiry** (MVP Flow 1): home → catalogue/search/filter → product → Enquire Now → questions + details → review → record enquiry → WhatsApp opens → customer sends.
2. **Registered customer** (Flow 2): Google sign‑in → save designs → Saved designs → select several → combined enquiry → WhatsApp.
3. **Custom design enquiry**: Custom Jewellery → idea + name + mobile → preview → record → WhatsApp.
4. **Admin product** (Flow B): sign in → Products → Add → photos, name, pricing inputs → preview → publish → visible in catalogue.
5. **Rates** (Flow C): Rates → enter 22K/10 g, silver/kg, GST → save → all prices recalculate.
6. **Enquiry reply** (Flow D): Enquiries → select → AI assist (Q‑by‑Q answers → generated reply) or manual → edit/approve → WhatsApp to customer → status Replied.
7. **Order** (Flow E): Orders → Create → details + products (catalogue or manual) → review → confirm → GNS‑#### assigned → listed.

## 6. Feature inventory
See `FEATURE_MATRIX.md` (F‑01…F‑30) — the source of truth for completeness.

## 7. Business rules
| ID | Rule |
|---|---|
| BR-01 | Gold per gram by karat = (22K per 10 g ÷ 10) × karat ÷ 22, rounded to the rupee for display. Silver per gram = silver per kg ÷ 1000. Metal value = round(weight × per‑gram rate). Making: fixed ₹, % of metal value, or ₹ per gram. GST = round(GST% × (metal + making + stones)). Estimate = metal + making + stones + GST. (Verified against design figures: Heritage Temple Necklace 28.34 g 22K → ₹3,62,694; Classic Diamond Pendant 3.9 g 18K → ₹61,795.) |
| BR-02 | Prices are always labelled approximate; final price confirmed by the shop. |
| BR-03 | Only published products are visible to non‑admins; drafts are admin‑only. A product needs ≥ 1 photo to be published. |
| BR-04 | Product codes: `GNS-<category prefix>-<4‑digit sequence>`, unique, never reused, assigned at creation. Changing a product's category does not change its code. |
| BR-05 | Enquiry reference `GNS-ENQ-<n>` starting at 1001. An enquiry is counted as an "initiation" only when WhatsApp was opened. The system never claims message delivery. |
| BR-06 | Mobile numbers: 10‑digit Indian mobile (starts 6–9) for customers; shop WhatsApp number stored with country code. |
| BR-07 | Order number `GNS-<4‑digit sequence>` generated only on confirmation; unique; never reused. Order date ≤ expected delivery date. Customer name and mobile required; at least one product line. |
| BR-08 | AI must use only the customer's submitted questions and the admin's answers; it must not invent prices, availability, charges or timelines; admin approval required before WhatsApp opens; nothing is sent automatically. |
| BR-09 | AI never creates or substitutes product photographs. Extraction produces text only; owner attaches a real photo. |
| BR-10 | Categories/collections/tags in use by products cannot be deleted (owner must reassign first); subcategories in use cannot be deleted. |
| BR-11 | An admin cannot remove themself; at least one admin must remain. |
| BR-12 | Saving designs requires sign‑in; saved designs are private to the customer. |
| BR-13 | Placeholder content (unset Site Content) shows neutral placeholders on the public site — never invented claims. |

## 8. Data requirements
Entities: profiles, admins, categories, subcategories, collections, tags, products, product_tags, product_images, media, rate_updates, site_settings, site_images, enquiries, enquiry_items, product_views, saved_products, orders, order_items, activity_log. Details in `DATABASE.md`.

## 9. Security & access control
- Supabase Auth (Google OAuth). Admin = authenticated user with a confirmed email present in `admins` (checked in the database by `is_admin()`), never a client claim.
- RLS on every table; fail‑closed. Public read limited to published catalogue data, rates, site content.
- Guest writes (enquiries, views, WhatsApp‑opened) only through validated `SECURITY DEFINER` functions with input checks and basic rate limiting; enquiry rows are not readable by the public.
- R2 credentials server‑only; uploads via short‑lived presigned PUT restricted to content type/length; downloads via authorised signed URLs.
- Gemini API key server‑only.

## 10. Design references
`docs/design-reference/` — `tokens.css`, `icons/` (44 SVGs with `index.json` usage map), `hero-sample.jpg` (mockup sample — must be replaced by the shop's own photo), `reference-screenshots/` (42 desktop/mobile screens and states). The ZIP's `index.html` refers to `screens/*.html` and `CLAUDE_CODE_HANDOFF.md`, which were **not** in the archive; screenshots are the visual authority.

Design notes: prototype banner ("Prototype · sample data") and "PLACEHOLDER" tags are prototype artefacts; production shows real Site Content and hides unset items (BR‑13). The Google "G" icon is a placeholder — production uses the official Google mark.

## 11. Technical constraints
Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS 4, Supabase (Postgres, Auth, RLS), Cloudflare R2 (S3 API), Gemini Flash (REST), Netlify. No other backend/database.

## 12. Non‑goals (out of scope, X)
Online payment/checkout; ecommerce order processing; customer order history/tracking/links; AI‑generated product photos; accounting/tax; inventory/ERP; delivery/logistics; automatic WhatsApp sending or delivery confirmation; mandatory registration; Android app (ideation only); appointment booking; customer notifications; invoices.

## 13. Assumptions
- A‑01 Making charges in the design are fixed rupee amounts; percentage and per‑gram modes are also supported because shops commonly use them.
- A‑02 GST default 3 % (design sample), editable.
- A‑03 Rates entered manually; no external live‑rate feed (MVP "can be manual").
- A‑04 Style, occasion and gender are simple optional product attributes with fixed option lists (editable later).
- A‑05 The customer "Customise" pills on the product page (metal/karat) only add preferences to the enquiry; they do not change displayed price.
- A‑06 Enquiry status set: new, in_progress, replied, converted, closed.
- A‑07 Order statuses: confirmed, delivered, cancelled.
- A‑08 Product photos are public content (served via authorised signed redirects); catalogue‑extraction uploads are private.
- A‑09 The first admin is bootstrapped by one SQL insert (documented in DEPLOYMENT.md); further admins are added in the portal.
- A‑10 Data region Mumbai (ap‑south‑1).

## 14. Unresolved questions (non‑blocking)
- Q‑01 Real shop content (address, WhatsApp number, story, hallmark claims) — owner enters in Site Content.
- Q‑02 Google OAuth client and Cloudflare R2 bucket/keys and Gemini key must be provisioned by the owner (see DEPLOYMENT.md).

## 15. Acceptance criteria
From PRD §08 plus: each REQ in `FEATURE_MATRIX.md` lists its acceptance criteria and the test(s) that verify it. Overall: a guest can find a product, see an approximate price with disclaimer, and open WhatsApp with a correct message while an enquiry record appears in admin; an admin can add/publish a product with a photo, change rates and see prices change, reply to an enquiry, and create a numbered order; non‑admins cannot read or modify admin data.
