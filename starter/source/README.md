# GNS Jewellers — default (seed) data

JSON files to load into the database on first setup. They're framework-neutral, so any stack can import them.

| File | Contents |
|---|---|
| 01_metals_and_karats.json | Gold/Silver, 24K/22K/18K (22K is the base rate) |
| 02_categories.json | 11 categories, each with code prefix, subcategories, order, and whether it shows on the home page |
| 03_collections.json | 6 collections (cover images empty) |
| 04_tags.json | 18 tags |
| 05_product_attributes.json | Styles, occasions, genders, sizes per category, price filter buckets, sort options |
| 06_rates_and_tax.json | GST 3%; gold and silver rates left empty for the owner to enter |
| 07_enquiry_and_order_settings.json | 7 enquiry questions, statuses, number formats |
| 08_home_page_settings.json | Category display (square tiles, 6 shown, 3 per row on phones), section counts |
| 09_site_content.json | Shop text and contact fields (blank = placeholder) |
| 10_image_slots.json | Image slots per page + recommended sizes |
| 11_admins.json | First admin (replace the email) |

Note: categories, collections and tags beyond the prototype's sample set are my suggestions. Edit or remove them freely.
