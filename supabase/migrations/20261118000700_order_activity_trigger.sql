-- confirm_order() is SECURITY INVOKER and must not call the internal log_activity(); log via trigger instead.
create or replace function public.confirm_order(p_order jsonb, p_items jsonb)
returns table (id uuid, order_no text)
language plpgsql security invoker set search_path = '' as $$
#variable_conflict use_column
declare
  v_order public.orders;
  v_mobile text := public.normalize_mobile(p_order ->> 'mobile');
  v_item jsonb;
  v_idx integer := 0;
  v_product public.products;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if v_mobile is null then
    raise exception 'Enter a valid 10-digit mobile number' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one product to the order' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Too many order lines' using errcode = '22023';
  end if;

  insert into public.orders (order_no, subject, order_date, expected_delivery_date, customer_name, mobile,
                             email, location, address, quoted_amount, advance_amount, notes, enquiry_id, created_by)
  values (
    'GNS-' || lpad(nextval('public.order_no_seq')::text, 4, '0'),
    btrim(p_order ->> 'subject'),
    (p_order ->> 'order_date')::date,
    (p_order ->> 'expected_delivery_date')::date,
    btrim(p_order ->> 'customer_name'),
    v_mobile,
    nullif(lower(btrim(coalesce(p_order ->> 'email', ''))), ''),
    nullif(btrim(coalesce(p_order ->> 'location', '')), ''),
    nullif(btrim(coalesce(p_order ->> 'address', '')), ''),
    nullif(p_order ->> 'quoted_amount', '')::numeric,
    nullif(p_order ->> 'advance_amount', '')::numeric,
    nullif(btrim(coalesce(p_order ->> 'notes', '')), ''),
    nullif(p_order ->> 'enquiry_id', '')::uuid,
    auth.uid()
  )
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_idx := v_idx + 1;
    v_product := null;
    if nullif(v_item ->> 'product_id', '') is not null then
      select * into v_product from public.products pr where pr.id = (v_item ->> 'product_id')::uuid;
      if v_product.id is null then
        raise exception 'A selected catalogue product no longer exists' using errcode = '22023';
      end if;
    end if;
    insert into public.order_items (order_id, product_id, product_code, product_name, details, quantity, sort_order)
    values (
      v_order.id,
      v_product.id,
      coalesce(v_product.code, nullif(btrim(coalesce(v_item ->> 'product_code', '')), '')),
      coalesce(nullif(btrim(coalesce(v_item ->> 'product_name', '')), ''), v_product.name),
      nullif(btrim(coalesce(v_item ->> 'details', '')), ''),
      coalesce(nullif(v_item ->> 'quantity', '')::integer, 1),
      v_idx
    );
  end loop;

  if v_order.enquiry_id is not null then
    update public.enquiries set status = 'converted' where enquiries.id = v_order.enquiry_id;
  end if;

  return query select v_order.id, v_order.order_no;
end $$;

create or replace function public.log_order_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.log_activity('order', 'Order ' || new.order_no || ' confirmed');
  return new;
end $$;
create trigger orders_log after insert on public.orders
  for each row execute function public.log_order_insert();

create or replace function public.log_order_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> old.status then
    perform public.log_activity('order', 'Order ' || new.order_no || ' marked ' || new.status);
  end if;
  return new;
end $$;
create trigger orders_status_log after update of status on public.orders
  for each row execute function public.log_order_status();

-- Admin-side enquiry status changes appear in recent activity too.
create or replace function public.log_enquiry_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> old.status then
    perform public.log_activity('enquiry', 'Enquiry ' || new.ref || ' marked ' || replace(new.status, '_', ' '));
  end if;
  return new;
end $$;
create trigger enquiries_status_log after update of status on public.enquiries
  for each row execute function public.log_enquiry_status();
