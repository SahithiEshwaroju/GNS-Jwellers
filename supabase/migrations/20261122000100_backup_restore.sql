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
  t text; n integer; counts jsonb := '{}'::jsonb; seq text;
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
      execute format(
        'insert into public.%1$I overriding system value select * from jsonb_populate_recordset(null::public.%1$I, '
        || '(select coalesce(jsonb_agg(e - ''created_by'' - ''uploaded_by'' - ''user_id'' - ''updated_by''), ''[]''::jsonb) '
        || 'from jsonb_array_elements($1 -> %2$L) e))', t, t) using p_tables;
      get diagnostics n = row_count;
      if t = 'rate_updates' then alter table public.rate_updates enable trigger rate_updates_stamp; end if;
      counts := counts || jsonb_build_object(t, n);
      seq := pg_get_serial_sequence('public.' || t, 'id');
      if seq is not null then
        execute format('select setval(%L, greatest(coalesce((select max(id) from public.%I), 0), 1))', seq, t);
      end if;
    end if;
  end loop;

  if p_tables ? 'site_settings' and jsonb_typeof(p_tables -> 'site_settings') = 'array'
     and jsonb_array_length(p_tables -> 'site_settings') > 0 then
    delete from public.site_settings;
    insert into public.site_settings overriding system value
      select * from jsonb_populate_recordset(null::public.site_settings,
        (select jsonb_agg((e - 'updated_by') || '{"id":1}'::jsonb) from jsonb_array_elements(p_tables -> 'site_settings') e limit 1));
    counts := counts || jsonb_build_object('site_settings', 1);
  end if;
  return counts;
end $$;

revoke all on function public.admin_storage_stats() from public, anon;
revoke all on function public.admin_restore_backup(jsonb) from public, anon;
grant execute on function public.admin_storage_stats() to authenticated;
grant execute on function public.admin_restore_backup(jsonb) to authenticated;
