-- Trigger functions are never meant to be called through the API.
revoke execute on function public.log_order_insert() from public, anon, authenticated;
revoke execute on function public.log_order_status() from public, anon, authenticated;
revoke execute on function public.log_enquiry_status() from public, anon, authenticated;
revoke execute on function public.log_rate_update() from public, anon, authenticated;
revoke execute on function public.log_product_change() from public, anon, authenticated;
revoke execute on function public.assign_product_code() from public, anon, authenticated;
revoke execute on function public.stamp_rate_update() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.protect_order_identity() from public, anon, authenticated;

-- Foreign keys used by RLS (media visibility) and admin lookups.
create index if not exists site_images_media_idx on public.site_images (media_id);
create index if not exists categories_image_media_idx on public.categories (image_media_id);
create index if not exists collections_image_media_idx on public.collections (image_media_id);
create index if not exists enquiries_user_idx on public.enquiries (user_id);
create index if not exists product_views_user_idx on public.product_views (user_id);
create index if not exists media_uploaded_by_idx on public.media (uploaded_by);
