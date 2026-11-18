-- Functions created after the blanket revoke inherited default EXECUTE for PUBLIC/anon.
-- Admin functions are for signed-in users only (each also checks is_admin() internally).
revoke execute on function public.admin_list_admins() from public, anon;
revoke execute on function public.admin_remove_admin(text) from public, anon;
revoke execute on function public.admin_rate_history(integer) from public, anon;
revoke execute on function public.admin_save_product(jsonb, text[], jsonb, text) from public, anon;
revoke execute on function public.admin_set_product_status(uuid, text) from public, anon;
revoke execute on function public.admin_badges() from public, anon;
revoke execute on function public.admin_analytics(integer) from public, anon;
revoke execute on function public.admin_stale_media() from public, anon;

-- Future functions in public are not executable by anyone until explicitly granted.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
