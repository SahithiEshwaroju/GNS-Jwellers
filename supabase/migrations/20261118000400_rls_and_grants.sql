-- Row Level Security policies and explicit privileges. Fail-closed: anything not granted here is denied.

-- Note: current_rates deliberately omits who updated the rates (admins use admin_rate_history()).

-- ---------------------------------------------------------------- privileges
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- public catalogue (anon + authenticated)
grant select on public.categories, public.subcategories, public.collections, public.tags,
                public.products, public.product_tags, public.product_images,
                public.site_settings, public.site_images, public.media
  to anon, authenticated;
grant select (id, gold22_per_10g, silver_per_kg, gst_percent, is_sample, created_at)
  on public.rate_updates to anon, authenticated;
grant select on public.current_rates, public.catalogue_products to anon, authenticated;

-- signed-in users (admin rights still enforced by RLS)
grant select on public.profiles, public.saved_products to authenticated;
grant insert, delete on public.saved_products to authenticated;
grant select, insert, update on public.admins to authenticated;
grant insert, update, delete on public.categories, public.subcategories, public.collections, public.tags,
                                public.products, public.product_tags, public.product_images,
                                public.site_images, public.media
  to authenticated;
grant update on public.site_settings to authenticated;
grant insert (gold22_per_10g, silver_per_kg, gst_percent) on public.rate_updates to authenticated;
grant select, update, delete on public.enquiries to authenticated;
grant select on public.enquiry_items, public.product_views, public.activity_log to authenticated;
grant select, insert, update on public.orders, public.order_items to authenticated;
grant usage on sequence public.order_no_seq to authenticated;

-- functions
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.product_estimate(text, smallint, numeric, text, numeric, numeric, numeric, numeric, numeric) to anon, authenticated;
grant execute on function public.normalize_mobile(text) to anon, authenticated;
grant execute on function public.create_enquiry(text, text, text, text, text[], text[], text, jsonb, text) to anon, authenticated;
grant execute on function public.mark_enquiry_whatsapp_opened(uuid, uuid) to anon, authenticated;
grant execute on function public.record_product_view(text) to anon, authenticated;
grant execute on function public.confirm_order(jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------- policies
-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

-- admins (removal only via admin_remove_admin)
create policy admins_select on public.admins for select to authenticated
  using ((select public.is_admin()));
create policy admins_insert on public.admins for insert to authenticated
  with check ((select public.is_admin()) and added_by = (select auth.uid()));
create policy admins_update on public.admins for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- taxonomy: public read, admin write
do $$
declare t text;
begin
  foreach t in array array['categories', 'subcategories', 'collections', 'tags'] loop
    execute format('create policy %1$s_select on public.%1$s for select to anon, authenticated using (true)', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end $$;

-- products: published are public; drafts admin-only
create policy products_select on public.products for select to anon, authenticated
  using (status = 'published' or (select public.is_admin()));
create policy products_insert on public.products for insert to authenticated
  with check ((select public.is_admin()));
create policy products_update on public.products for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy products_delete on public.products for delete to authenticated
  using ((select public.is_admin()));

-- product children follow product visibility
do $$
declare t text;
begin
  foreach t in array array['product_tags', 'product_images'] loop
    execute format($f$create policy %1$s_select on public.%1$s for select to anon, authenticated
      using (exists (select 1 from public.products p where p.id = product_id and p.status = 'published')
             or (select public.is_admin()))$f$, t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end $$;

-- media: readable only when attached to something public (or by admins)
create policy media_select on public.media for select to anon, authenticated
  using (
    (select public.is_admin())
    or (status = 'ready' and purpose <> 'extract' and (
         exists (select 1 from public.product_images pi join public.products p on p.id = pi.product_id
                 where pi.media_id = media.id and p.status = 'published')
      or exists (select 1 from public.site_images si where si.media_id = media.id)
      or exists (select 1 from public.categories c where c.image_media_id = media.id)
      or exists (select 1 from public.collections c where c.image_media_id = media.id)))
  );
create policy media_insert on public.media for insert to authenticated
  with check ((select public.is_admin()) and uploaded_by = (select auth.uid()));
create policy media_update on public.media for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy media_delete on public.media for delete to authenticated
  using ((select public.is_admin()));

-- rates: public read (column-restricted above), admin insert, no update/delete (history is append-only)
create policy rate_updates_select on public.rate_updates for select to anon, authenticated using (true);
create policy rate_updates_insert on public.rate_updates for insert to authenticated
  with check ((select public.is_admin()));

-- site content
create policy site_settings_select on public.site_settings for select to anon, authenticated using (true);
create policy site_settings_update on public.site_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy site_images_select on public.site_images for select to anon, authenticated using (true);
create policy site_images_insert on public.site_images for insert to authenticated
  with check ((select public.is_admin()));
create policy site_images_update on public.site_images for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy site_images_delete on public.site_images for delete to authenticated
  using ((select public.is_admin()));

-- activity log, views, enquiry items: admin read only (written by SECURITY DEFINER functions)
create policy activity_log_select on public.activity_log for select to authenticated
  using ((select public.is_admin()));
create policy product_views_select on public.product_views for select to authenticated
  using ((select public.is_admin()));
create policy enquiry_items_select on public.enquiry_items for select to authenticated
  using ((select public.is_admin()));

-- enquiries: never readable by the public; created only through create_enquiry()
create policy enquiries_select on public.enquiries for select to authenticated
  using ((select public.is_admin()));
create policy enquiries_update on public.enquiries for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy enquiries_delete on public.enquiries for delete to authenticated
  using ((select public.is_admin()));

-- saved designs: private to their owner; only published products can be saved
create policy saved_select on public.saved_products for select to authenticated
  using (user_id = (select auth.uid()));
create policy saved_insert on public.saved_products for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));
create policy saved_delete on public.saved_products for delete to authenticated
  using (user_id = (select auth.uid()));

-- orders: admin only, no delete (cancel instead)
create policy orders_select on public.orders for select to authenticated using ((select public.is_admin()));
create policy orders_insert on public.orders for insert to authenticated with check ((select public.is_admin()));
create policy orders_update on public.orders for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy order_items_select on public.order_items for select to authenticated using ((select public.is_admin()));
create policy order_items_insert on public.order_items for insert to authenticated with check ((select public.is_admin()));
create policy order_items_update on public.order_items for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
