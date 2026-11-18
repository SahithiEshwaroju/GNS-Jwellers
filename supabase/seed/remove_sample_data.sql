-- Removes everything created by sample_data.sql. Run in the Supabase SQL editor before going live.
-- Product photos uploaded to sample products are NOT deleted from R2 by this script; delete the products
-- in the admin portal instead if you uploaded real photos to them.
delete from public.products where is_sample;
delete from public.rate_updates where is_sample;
delete from public.tags t where not exists (select 1 from public.product_tags pt where pt.tag_id = t.id)
  and t.name in ('Diamond', 'Daily Wear', 'Temple', 'Bridal', 'Lightweight');
