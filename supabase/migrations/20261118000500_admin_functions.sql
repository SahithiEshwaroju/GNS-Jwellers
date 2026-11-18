-- Admin-only functions. Each checks is_admin() explicitly; SECURITY DEFINER only where auth.users must be read.

-- ---------------------------------------------------------------- admin access
create or replace function public.admin_list_admins()
returns table (email text, name text, created_at timestamptz, last_sign_in_at timestamptz, is_self boolean)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  return query
    select a.email, a.name, a.created_at, u.last_sign_in_at,
           a.email = (select lower(x.email) from auth.users x where x.id = auth.uid())
    from public.admins a
    left join auth.users u on lower(u.email) = a.email
    order by a.created_at;
end $$;

create or replace function public.admin_remove_admin(p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_self text := (select lower(email) from auth.users where id = auth.uid());
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if lower(p_email) = v_self then
    raise exception 'You can''t remove your own account while signed in' using errcode = 'P0001';
  end if;
  if (select count(*) from public.admins) <= 1 then
    raise exception 'There must always be at least one admin' using errcode = 'P0001';
  end if;
  delete from public.admins where email = lower(p_email);
  if not found then
    raise exception 'Admin not found' using errcode = 'P0002';
  end if;
  perform public.log_activity('admin', 'Admin access removed for ' || lower(p_email));
end $$;

-- ---------------------------------------------------------------- rates
create or replace function public.admin_rate_history(p_limit integer default 10)
returns table (id bigint, gold22_per_10g numeric, silver_per_kg numeric, gst_percent numeric,
               created_at timestamptz, created_by_email text, is_sample boolean)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  return query
    select r.id, r.gold22_per_10g, r.silver_per_kg, r.gst_percent, r.created_at, r.created_by_email, r.is_sample
    from public.rate_updates r
    order by r.created_at desc, r.id desc
    limit least(greatest(coalesce(p_limit, 10), 1), 100);
end $$;

-- ---------------------------------------------------------------- products
-- Creates or updates a product with its tags and ordered photos in one transaction.
-- Returns the object keys of photos removed from the product so the caller can delete them from R2.
create or replace function public.admin_save_product(
  p_product jsonb,
  p_tag_names text[],
  p_images jsonb,
  p_status text
)
returns table (id uuid, code text, removed_keys text[])
language plpgsql security invoker set search_path = '' as $$
#variable_conflict use_column
declare
  v_id uuid := nullif(p_product ->> 'id', '')::uuid;
  v_product public.products;
  v_removed text[];
  v_img jsonb;
  v_idx integer := 0;
  v_tag text;
  v_media_ids uuid[];
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if p_status not in ('draft', 'published') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_images, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_images, '[]'::jsonb)) > 12 then
    raise exception 'A product can have up to 12 photos' using errcode = '22023';
  end if;
  if cardinality(coalesce(p_tag_names, '{}')) > 20 then
    raise exception 'Up to 20 tags per product' using errcode = '22023';
  end if;

  if v_id is null then
    insert into public.products (name, category_id, subcategory_id, collection_id, description, model_description,
      metal, karat, silver_purity, weight_g, making_type, making_value, stone_value, stones_note,
      style, occasion, gender, specifications, status, created_by)
    values (
      btrim(p_product ->> 'name'),
      (p_product ->> 'category_id')::uuid,
      nullif(p_product ->> 'subcategory_id', '')::uuid,
      nullif(p_product ->> 'collection_id', '')::uuid,
      nullif(btrim(coalesce(p_product ->> 'description', '')), ''),
      nullif(btrim(coalesce(p_product ->> 'model_description', '')), ''),
      p_product ->> 'metal',
      nullif(p_product ->> 'karat', '')::smallint,
      nullif(btrim(coalesce(p_product ->> 'silver_purity', '')), ''),
      (p_product ->> 'weight_g')::numeric,
      coalesce(nullif(p_product ->> 'making_type', ''), 'fixed'),
      coalesce(nullif(p_product ->> 'making_value', '')::numeric, 0),
      coalesce(nullif(p_product ->> 'stone_value', '')::numeric, 0),
      nullif(btrim(coalesce(p_product ->> 'stones_note', '')), ''),
      nullif(btrim(coalesce(p_product ->> 'style', '')), ''),
      nullif(btrim(coalesce(p_product ->> 'occasion', '')), ''),
      nullif(p_product ->> 'gender', ''),
      coalesce(p_product -> 'specifications', '[]'::jsonb),
      'draft',
      auth.uid()
    )
    returning * into v_product;
  else
    update public.products set
      name = btrim(p_product ->> 'name'),
      category_id = (p_product ->> 'category_id')::uuid,
      subcategory_id = nullif(p_product ->> 'subcategory_id', '')::uuid,
      collection_id = nullif(p_product ->> 'collection_id', '')::uuid,
      description = nullif(btrim(coalesce(p_product ->> 'description', '')), ''),
      model_description = nullif(btrim(coalesce(p_product ->> 'model_description', '')), ''),
      metal = p_product ->> 'metal',
      karat = nullif(p_product ->> 'karat', '')::smallint,
      silver_purity = nullif(btrim(coalesce(p_product ->> 'silver_purity', '')), ''),
      weight_g = (p_product ->> 'weight_g')::numeric,
      making_type = coalesce(nullif(p_product ->> 'making_type', ''), 'fixed'),
      making_value = coalesce(nullif(p_product ->> 'making_value', '')::numeric, 0),
      stone_value = coalesce(nullif(p_product ->> 'stone_value', '')::numeric, 0),
      stones_note = nullif(btrim(coalesce(p_product ->> 'stones_note', '')), ''),
      style = nullif(btrim(coalesce(p_product ->> 'style', '')), ''),
      occasion = nullif(btrim(coalesce(p_product ->> 'occasion', '')), ''),
      gender = nullif(p_product ->> 'gender', ''),
      specifications = coalesce(p_product -> 'specifications', '[]'::jsonb)
    where products.id = v_id
    returning * into v_product;
    if v_product.id is null then
      raise exception 'Product not found' using errcode = 'P0002';
    end if;
  end if;

  if v_product.subcategory_id is not null and not exists (
       select 1 from public.subcategories s where s.id = v_product.subcategory_id and s.category_id = v_product.category_id) then
    raise exception 'Subcategory does not belong to the chosen category' using errcode = '22023';
  end if;

  -- tags
  delete from public.product_tags where product_id = v_product.id;
  foreach v_tag in array coalesce(p_tag_names, '{}') loop
    v_tag := btrim(v_tag);
    continue when char_length(v_tag) = 0;
    if char_length(v_tag) > 40 then
      raise exception 'Tags must be 40 characters or fewer' using errcode = '22023';
    end if;
    insert into public.tags (name) values (v_tag) on conflict do nothing;
    insert into public.product_tags (product_id, tag_id)
      select v_product.id, t.id from public.tags t where lower(t.name) = lower(v_tag)
      on conflict do nothing;
  end loop;

  -- images
  select coalesce(array_agg((e ->> 'media_id')::uuid), '{}') into v_media_ids
  from jsonb_array_elements(coalesce(p_images, '[]'::jsonb)) e;

  if exists (select 1 from unnest(v_media_ids) m
             where not exists (select 1 from public.media md
                               where md.id = m and md.purpose = 'product' and md.status = 'ready')) then
    raise exception 'A photo is still uploading or is invalid' using errcode = '22023';
  end if;
  if exists (select 1 from public.product_images pi
             where pi.media_id = any (v_media_ids) and pi.product_id <> v_product.id) then
    raise exception 'A photo belongs to another product' using errcode = '22023';
  end if;

  select coalesce(array_agg(md.object_key), '{}') into v_removed
  from public.product_images pi join public.media md on md.id = pi.media_id
  where pi.product_id = v_product.id and not (pi.media_id = any (v_media_ids));

  delete from public.media md
  using public.product_images pi
  where pi.media_id = md.id and pi.product_id = v_product.id and not (pi.media_id = any (v_media_ids));

  for v_img in select * from jsonb_array_elements(coalesce(p_images, '[]'::jsonb)) loop
    v_idx := v_idx + 1;
    insert into public.product_images (product_id, media_id, view_label, sort_order)
    values (v_product.id, (v_img ->> 'media_id')::uuid,
            coalesce(nullif(v_img ->> 'view_label', ''), 'front'), v_idx)
    on conflict (media_id) do update set view_label = excluded.view_label, sort_order = excluded.sort_order;
  end loop;

  -- publish rule (BR-03)
  if p_status = 'published' and v_idx = 0 then
    raise exception 'Add at least one actual product photo before publishing' using errcode = '22023';
  end if;
  update public.products set status = p_status where products.id = v_product.id and status <> p_status;

  return query select v_product.id, v_product.code, v_removed;
end $$;

create or replace function public.admin_set_product_status(p_id uuid, p_status text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if p_status not in ('draft', 'published') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;
  if p_status = 'published' and not exists (select 1 from public.product_images where product_id = p_id) then
    raise exception 'Add at least one actual product photo before publishing' using errcode = '22023';
  end if;
  update public.products set status = p_status where id = p_id;
  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;
end $$;

-- ---------------------------------------------------------------- dashboard & analytics
create or replace function public.admin_badges()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  return jsonb_build_object('new_enquiries', (select count(*) from public.enquiries where status = 'new'));
end $$;

create or replace function public.admin_analytics(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_since timestamptz := now() - make_interval(days => v_days);
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'days', v_days,
    'total_products', (select count(*) from public.products),
    'published_products', (select count(*) from public.products where status = 'published'),
    'registered_customers', (select count(*) from public.profiles p
                             where p.email is null or p.email not in (select email from public.admins)),
    'product_views', (select count(*) from public.product_views where viewed_at >= v_since),
    'enquiry_initiations', (select count(*) from public.enquiries where whatsapp_opened_at >= v_since),
    'enquiries_created', (select count(*) from public.enquiries where created_at >= v_since),
    'enquiries_converted', (select count(*) from public.enquiries where status = 'converted' and created_at >= v_since),
    'new_enquiries', (select count(*) from public.enquiries where status = 'new'),
    'initiations_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'count', coalesce(c.n, 0)) order by d), '[]'::jsonb)
      from generate_series((now() at time zone 'Asia/Kolkata')::date - (v_days - 1),
                           (now() at time zone 'Asia/Kolkata')::date, interval '1 day') d
      left join (select (whatsapp_opened_at at time zone 'Asia/Kolkata')::date as day, count(*) n
                 from public.enquiries where whatsapp_opened_at >= v_since group by 1) c on c.day = d::date),
    'top_products', (
      select coalesce(jsonb_agg(t order by t.views desc, t.name), '[]'::jsonb) from (
        select pr.id, pr.code, pr.name, count(v.id) as views,
               (select count(*) from public.enquiry_items ei join public.enquiries e on e.id = ei.enquiry_id
                 where ei.product_id = pr.id and e.created_at >= v_since) as enquiries,
               (select cp.estimated_price from public.catalogue_products cp where cp.id = pr.id) as estimated_price,
               (select pi.media_id from public.product_images pi where pi.product_id = pr.id
                 order by pi.sort_order limit 1) as cover_media_id
        from public.products pr
        join public.product_views v on v.product_id = pr.id and v.viewed_at >= v_since
        group by pr.id order by count(v.id) desc limit 6) t),
    'category_views', (
      select coalesce(jsonb_agg(t order by t.views desc, t.name), '[]'::jsonb) from (
        select c.name, count(v.id) as views
        from public.categories c
        left join public.products pr on pr.category_id = c.id
        left join public.product_views v on v.product_id = pr.id and v.viewed_at >= v_since
        group by c.id) t),
    'recent_activity', (
      select coalesce(jsonb_agg(a order by a.created_at desc), '[]'::jsonb) from (
        select kind, message, created_at from public.activity_log order by created_at desc limit 6) a)
  ) into v_result;
  return v_result;
end $$;

-- ---------------------------------------------------------------- maintenance
-- Media rows that never finished uploading, or product photos never attached, older than 24 h.
create or replace function public.admin_stale_media()
returns table (id uuid, object_key text)
language plpgsql stable security invoker set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  return query
    select m.id, m.object_key from public.media m
    where m.created_at < now() - interval '24 hours'
      and (m.status = 'pending'
           or (m.purpose = 'product' and not exists (select 1 from public.product_images pi where pi.media_id = m.id))
           or (m.purpose = 'extract'));
end $$;

grant execute on function public.admin_list_admins() to authenticated;
grant execute on function public.admin_remove_admin(text) to authenticated;
grant execute on function public.admin_rate_history(integer) to authenticated;
grant execute on function public.admin_save_product(jsonb, text[], jsonb, text) to authenticated;
grant execute on function public.admin_set_product_status(uuid, text) to authenticated;
grant execute on function public.admin_badges() to authenticated;
grant execute on function public.admin_analytics(integer) to authenticated;
grant execute on function public.admin_stale_media() to authenticated;
