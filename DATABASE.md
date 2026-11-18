# Database

Supabase Postgres, project `gns-jewellers` (ref `trikbstrswhdeucxupyc`, ap-south-1). All tables live in `public` with RLS enabled.

## Migrations (`supabase/migrations`, apply in order)
| File | Contents |
|---|---|
| `…000100_core_schema` | profiles (+ sign-up trigger), admins, `is_admin()`, media, categories, subcategories, collections, tags, products (+ code trigger), product_tags, product_images, rate_updates (+ stamp trigger), site_settings (single row), site_images |
| `…000200_pricing_and_catalogue` | `product_estimate()` (BR-01), views `current_rates`, `catalogue_products` (security_invoker) |
| `…000300_enquiries_orders_activity` | activity_log + `log_activity()` (internal), enquiries/enquiry_items + `create_enquiry()`, `mark_enquiry_whatsapp_opened()`, product_views + `record_product_view()`, saved_products, orders/order_items + `confirm_order()`, activity triggers |
| `…000400_rls_and_grants` | explicit grants and every RLS policy |
| `…000500_admin_functions` | `admin_list_admins`, `admin_remove_admin`, `admin_rate_history`, `admin_save_product`, `admin_set_product_status`, `admin_badges`, `admin_analytics`, `admin_stale_media` |
| `…000600_tighten_function_grants` | revoke anon execute on admin functions; default privileges |
| `…000700_order_activity_trigger` | `confirm_order` without internal logging; order/enquiry status activity triggers |
| `…000800_hardening_indexes` | revoke trigger-function execute; FK indexes |

All eight are applied to the project (verified with `list_migrations`/advisors). Migrations were never rewritten after being applied; fixes were added as new files.

## Entities
- **products** — `code` (GNS-<prefix>-0001, assigned by trigger from `categories.next_seq`, immutable), metal/karat/silver_purity (check-constrained), weight, making (`fixed`/`percent`/`per_gram`), stone value, optional descriptive fields, `specifications` (jsonb array), `status` draft/published, `is_featured`, `is_sample`.
- **catalogue_products** (view) — product + taxonomy names + live price breakdown + cover image + tag names + `search_text`.
- **rate_updates** — append-only history; latest row = current rates. `created_by_email` is hidden from non-admins by column grants.
- **enquiries / enquiry_items** — reference `GNS-ENQ-<seq>` (from 1001), status (new, in_progress, replied, converted, closed), `whatsapp_opened_at`, `client_token`, admin reply. Items snapshot product code/name/price at enquiry time.
- **orders / order_items** — `order_no` `GNS-<seq>` assigned only inside `confirm_order()`; order/delivery date check; optional quoted/advance (advance ≤ quote); status confirmed/delivered/cancelled; never deleted in-app.
- **media** — one row per R2 object (key pattern-checked, type/size-checked, pending → ready after verification). Referenced by product_images, site_images, categories/collections image columns.
- **saved_products** — (user_id, product_id).
- **profiles** — created by trigger on `auth.users` insert.
- **admins** — allow-list by lower-case email.

## Key functions
| Function | Security | Callable by | Purpose |
|---|---|---|---|
| `is_admin()` | definer | anon, authenticated | caller's confirmed email ∈ admins |
| `product_estimate(...)` | invoker, immutable | anon, authenticated | BR-01 price |
| `create_enquiry(...)` | definer | anon, authenticated | validated enquiry insert, rate-limited (5 / mobile / 10 min, 60 / min global) |
| `mark_enquiry_whatsapp_opened(id, token)` | definer | anon, authenticated | sets opened time if token matches |
| `record_product_view(code)` | definer | anon, authenticated | view counter for published products |
| `confirm_order(order, items)` | invoker + admin check | authenticated | atomic order + lines + number |
| `admin_*` | see above | authenticated (internally admin-checked) | admin operations |

## Sequences
`enquiry_ref_seq` (start 1001), `order_no_seq` (start 1), `categories.next_seq` per category. Numbers are never reused; gaps can occur (e.g. after a failed transaction or deleted test data). Before go-live you may restart them (DEPLOYMENT.md §6).

## Seeds
- `supabase/seed/default_taxonomy.sql` — the design's 8 categories, subcategories, 4 collections.
- `supabase/seed/sample_data.sql` — 15 sample products + one sample rate row, all `is_sample = true` (badged "Sample" in admin). **Loaded in the current project.** Remove with `remove_sample_data.sql`.
- `supabase/scripts/remove_test_users.sql` — removes automated-test accounts and their data.

## Types
`src/lib/supabase/database.types.ts` (generated from the live schema, trimmed). Regenerate after schema changes.
