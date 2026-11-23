-- Backup / restore support (admin only).
-- admin_storage_stats(): database size + per-table sizes + tracked media totals, for System Check.
-- admin_restore_backup(p_tables): atomically REPLACES the content tables present in the payload.
--   Accounts (auth, profiles, admins, saved items, views, activity log) are never touched.
--   References to user accounts are cleared (accounts differ between projects).

create or replace function public.admin_storage_stats()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  select jsonb_build_object(
    'db_bytes', pg_database_size(current_database()),
    'tables', coalesce((select jsonb_object_agg(c.relname, pg_total_relation_size(c.oid))
                        from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'), '{}'::jsonb),
    'media_count', (select count(*) from public.media),
    'media_bytes', (select coalesce(sum(size_bytes), 0) from public.media)
  ) into v;
  return v;
end $$;

create or replace function public.admin_restore_backup(p_tables jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  del_order text[] := array['order_items','orders','enquiry_items','enquiries','rate_updates','site_images',
    'product_images','product_tags','products','tags','collections','subcategories','categories','media'];
  ins_order text[] := array['media','categories','subcategories','collections','tags','products','product_tags',
    'product_images','site_images','rate_updates','enquiries','enquiry_items','orders','order_items'];
  t text; n integer; cols text; counts jsonb := '{}'::jsonb; seq text;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  if p_tables is null or jsonb_typeof(p_tables) <> 'object' then raise exception 'Invalid backup payload'; end if;

  foreach t in array del_order loop
    if p_tables ? t then execute format('delete from public.%I', t); end if;
  end loop;

  foreach t in array ins_order loop
    if p_tables ? t then
      -- keep the original timestamps of historical rate updates (the stamp trigger would overwrite them)
      if t = 'rate_updates' then alter table public.rate_updates disable trigger rate_updates_stamp; end if;
      -- Insert only the columns present in the backup, so omitted columns take their defaults.
      select string_agg(quote_ident(k), ',') into cols
        from jsonb_object_keys(coalesce(p_tables -> t -> 0, '{}'::jsonb)) k
        where k not in ('created_by', 'uploaded_by', 'user_id', 'updated_by')
          and k in (select column_name::text from information_schema.columns where table_schema = 'public' and table_name = t);
      if cols is null then n := 0; else
        execute format(
          'insert into public.%1$I (%3$s) overriding system value select %3$s from jsonb_populate_recordset(null::public.%1$I, $1 -> %2$L)',
          t, t, cols) using p_tables;
        get diagnostics n = row_count;
      end if;
      if t = 'rate_updates' then alter table public.rate_updates enable trigger rate_updates_stamp; end if;
      counts := counts || jsonb_build_object(t, n);
      seq := case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'id')
                  then pg_get_serial_sequence('public.' || t, 'id') end;
      if seq is not null then
        execute format('select setval(%L, greatest(coalesce((select max(id) from public.%I), 0), 1))', seq, t);
      end if;
    end if;
  end loop;

  if p_tables ? 'site_settings' and jsonb_typeof(p_tables -> 'site_settings') = 'array'
     and jsonb_array_length(p_tables -> 'site_settings') > 0 then
    delete from public.site_settings;
    select string_agg(quote_ident(k), ',') into cols
      from jsonb_object_keys(p_tables -> 'site_settings' -> 0) k
      where k <> 'updated_by' and k in (select column_name::text from information_schema.columns where table_schema = 'public' and table_name = 'site_settings');
    execute format('insert into public.site_settings (%1$s) select %1$s from jsonb_populate_recordset(null::public.site_settings, jsonb_build_array((($1 -> ''site_settings'' -> 0) - ''id'') || ''{"id":1}''::jsonb))', cols) using p_tables;
    counts := counts || jsonb_build_object('site_settings', 1);
  end if;
  return counts;
end $$;

revoke all on function public.admin_storage_stats() from public, anon;
revoke all on function public.admin_restore_backup(jsonb) from public, anon;
grant execute on function public.admin_storage_stats() to authenticated;
grant execute on function public.admin_restore_backup(jsonb) to authenticated;

-- admin_reset_website(): deletes ALL website content (products, taxonomy, photos records, rates, enquiries, orders,
-- views, saved items, activity log) and restores empty site settings + numbering. Admin accounts are kept.
create or replace function public.admin_reset_website()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  delete from public.order_items; delete from public.orders;
  delete from public.enquiry_items; delete from public.enquiries;
  delete from public.rate_updates; delete from public.site_images;
  delete from public.product_images; delete from public.product_tags;
  delete from public.product_views; delete from public.saved_products;
  delete from public.products; delete from public.tags; delete from public.collections;
  delete from public.subcategories; delete from public.categories; delete from public.media;
  delete from public.site_settings; insert into public.site_settings (id) values (1);
  delete from public.activity_log;
  alter sequence public.order_no_seq restart 1;
  alter sequence public.enquiry_ref_seq restart 1001;
end $$;
revoke all on function public.admin_reset_website() from public, anon;
grant execute on function public.admin_reset_website() to authenticated;
