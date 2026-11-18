-- Enquiries, product views, saved designs, orders, activity log and their write functions.

-- ---------------------------------------------------------------- activity log
create table public.activity_log (
  id          bigint generated always as identity primary key,
  kind        text not null check (kind in ('rates', 'product', 'enquiry', 'order', 'admin', 'content')),
  message     text not null check (char_length(message) <= 300),
  actor       uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index activity_log_created_idx on public.activity_log (created_at desc);
alter table public.activity_log enable row level security;

create or replace function public.log_activity(p_kind text, p_message text)
returns void language sql security definer set search_path = '' as $$
  insert into public.activity_log (kind, message, actor) values (p_kind, left(p_message, 300), auth.uid());
$$;
revoke execute on function public.log_activity(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- enquiries
create sequence public.enquiry_ref_seq start 1001;

create table public.enquiries (
  id                  uuid primary key default gen_random_uuid(),
  ref                 text not null unique default ('GNS-ENQ-' || nextval('public.enquiry_ref_seq')),
  source              text not null check (source in ('product', 'multi', 'custom', 'general')),
  customer_name       text not null check (char_length(btrim(customer_name)) between 1 and 80),
  mobile              text not null check (mobile ~ '^[6-9][0-9]{9}$'),
  email               text check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  user_id             uuid references auth.users(id) on delete set null,
  questions           text[] not null default '{}' check (cardinality(questions) <= 12),
  custom_question     text check (char_length(custom_question) <= 1000),
  customisation       jsonb not null default '{}'::jsonb check (jsonb_typeof(customisation) = 'object'),
  message             text not null check (char_length(message) <= 4000),
  status              text not null default 'new'
                      check (status in ('new', 'in_progress', 'replied', 'converted', 'closed')),
  whatsapp_opened_at  timestamptz,
  client_token        uuid not null default gen_random_uuid(),
  admin_reply         text check (char_length(admin_reply) <= 4000),
  replied_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index enquiries_created_idx on public.enquiries (created_at desc);
create index enquiries_status_idx on public.enquiries (status);
create index enquiries_mobile_created_idx on public.enquiries (mobile, created_at desc);
create index enquiries_opened_idx on public.enquiries (whatsapp_opened_at) where whatsapp_opened_at is not null;
create trigger enquiries_updated before update on public.enquiries
  for each row execute function public.set_updated_at();
alter table public.enquiries enable row level security;

create table public.enquiry_items (
  id               uuid primary key default gen_random_uuid(),
  enquiry_id       uuid not null references public.enquiries(id) on delete cascade,
  product_id       uuid references public.products(id) on delete set null,
  product_code     text not null,
  product_name     text not null,
  estimated_price  numeric(14,2),
  sort_order       integer not null default 0
);
create index enquiry_items_enquiry_idx on public.enquiry_items (enquiry_id);
create index enquiry_items_product_idx on public.enquiry_items (product_id);
alter table public.enquiry_items enable row level security;

-- Normalise an Indian mobile number to 10 digits, or null when invalid.
create or replace function public.normalize_mobile(p text)
returns text language plpgsql immutable set search_path = '' as $$
declare v text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if char_length(v) = 12 and left(v, 2) = '91' then v := substr(v, 3); end if;
  if char_length(v) = 11 and left(v, 1) = '0' then v := substr(v, 2); end if;
  if v ~ '^[6-9][0-9]{9}$' then return v; end if;
  return null;
end $$;

-- Public entry point for guests and customers. Validates everything; never trusts client prices.
create or replace function public.create_enquiry(
  p_source           text,
  p_customer_name    text,
  p_mobile           text,
  p_email            text,
  p_product_codes    text[],
  p_questions        text[],
  p_custom_question  text,
  p_customisation    jsonb,
  p_message          text
)
returns table (id uuid, ref text, client_token uuid)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_mobile   text := public.normalize_mobile(p_mobile);
  v_name     text := btrim(coalesce(p_customer_name, ''));
  v_email    text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_codes    text[] := coalesce(p_product_codes, '{}');
  v_qs       text[];
  v_enquiry  public.enquiries;
  v_found    integer;
  v_q        text;
begin
  if p_source not in ('product', 'multi', 'custom', 'general') then
    raise exception 'Invalid enquiry type' using errcode = '22023';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'Please enter your name' using errcode = '22023';
  end if;
  if v_mobile is null then
    raise exception 'Please enter a valid 10-digit mobile number' using errcode = '22023';
  end if;
  if v_email is not null and (char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'Please enter a valid email address' using errcode = '22023';
  end if;
  if cardinality(v_codes) > 20 then
    raise exception 'Too many products in one enquiry' using errcode = '22023';
  end if;
  if p_source in ('product', 'multi') and cardinality(v_codes) = 0 then
    raise exception 'Choose at least one design' using errcode = '22023';
  end if;
  if p_source = 'product' and cardinality(v_codes) <> 1 then
    raise exception 'A product enquiry is about one design' using errcode = '22023';
  end if;
  if p_source = 'custom' and char_length(btrim(coalesce(p_custom_question, ''))) < 3 then
    raise exception 'Please describe your idea' using errcode = '22023';
  end if;
  if char_length(coalesce(p_custom_question, '')) > 1000 or char_length(coalesce(p_message, '')) > 4000
     or char_length(coalesce(p_message, '')) < 1 then
    raise exception 'Message is too long or empty' using errcode = '22023';
  end if;
  if p_customisation is not null and (jsonb_typeof(p_customisation) <> 'object'
     or char_length(p_customisation::text) > 1000) then
    raise exception 'Invalid customisation' using errcode = '22023';
  end if;

  v_qs := '{}';
  foreach v_q in array coalesce(p_questions, '{}') loop
    v_q := btrim(v_q);
    if char_length(v_q) between 1 and 200 then
      v_qs := v_qs || v_q;
    end if;
  end loop;
  if cardinality(v_qs) > 12 then
    raise exception 'Too many questions' using errcode = '22023';
  end if;

  -- Basic abuse protection: per-mobile and global bursts.
  if (select count(*) from public.enquiries e
        where e.mobile = v_mobile and e.created_at > now() - interval '10 minutes') >= 5
     or (select count(*) from public.enquiries e where e.created_at > now() - interval '1 minute') >= 60 then
    raise exception 'Too many enquiries — please wait a few minutes and try again' using errcode = 'P0001';
  end if;

  select count(*) into v_found
  from public.products pr where pr.code = any (v_codes) and pr.status = 'published';
  if v_found <> (select count(distinct c) from unnest(v_codes) c) then
    raise exception 'One of the selected designs is no longer available' using errcode = '22023';
  end if;

  insert into public.enquiries (source, customer_name, mobile, email, user_id, questions,
                                custom_question, customisation, message)
  values (p_source, v_name, v_mobile, v_email, auth.uid(), v_qs,
          nullif(btrim(coalesce(p_custom_question, '')), ''), coalesce(p_customisation, '{}'::jsonb),
          p_message)
  returning * into v_enquiry;

  insert into public.enquiry_items (enquiry_id, product_id, product_code, product_name, estimated_price, sort_order)
  select v_enquiry.id, cp.id, cp.code, cp.name, cp.estimated_price, array_position(v_codes, cp.code)
  from public.catalogue_products cp
  where cp.code = any (v_codes) and cp.status = 'published';

  perform public.log_activity('enquiry', 'New enquiry ' || v_enquiry.ref ||
    coalesce(' (' || (select string_agg(ei.product_name, ', ' order by ei.sort_order)
                      from public.enquiry_items ei where ei.enquiry_id = v_enquiry.id) || ')',
             case when p_source = 'custom' then ' (Custom design)' else '' end));

  return query select v_enquiry.id, v_enquiry.ref, v_enquiry.client_token;
end $$;

-- Called when the customer presses "Open WhatsApp". Requires the token returned at creation.
create or replace function public.mark_enquiry_whatsapp_opened(p_enquiry_id uuid, p_client_token uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.enquiries
     set whatsapp_opened_at = coalesce(whatsapp_opened_at, now())
   where id = p_enquiry_id and client_token = p_client_token;
  return found;
end $$;

-- ---------------------------------------------------------------- product views
create table public.product_views (
  id          bigint generated always as identity primary key,
  product_id  uuid not null references public.products(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  viewed_at   timestamptz not null default now()
);
create index product_views_product_idx on public.product_views (product_id, viewed_at desc);
create index product_views_viewed_idx on public.product_views (viewed_at desc);
alter table public.product_views enable row level security;

create or replace function public.record_product_view(p_code text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.product_views (product_id, user_id)
  select pr.id, auth.uid() from public.products pr
  where pr.code = p_code and pr.status = 'published';
end $$;

-- ---------------------------------------------------------------- saved designs
create table public.saved_products (
  user_id     uuid not null references auth.users(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index saved_products_product_idx on public.saved_products (product_id);
alter table public.saved_products enable row level security;

-- ---------------------------------------------------------------- orders (admin only)
create sequence public.order_no_seq start 1;

create table public.orders (
  id                      uuid primary key default gen_random_uuid(),
  order_no                text not null unique,
  subject                 text not null check (char_length(btrim(subject)) between 2 and 160),
  order_date              date not null,
  expected_delivery_date  date not null,
  customer_name           text not null check (char_length(btrim(customer_name)) between 1 and 80),
  mobile                  text not null check (mobile ~ '^[6-9][0-9]{9}$'),
  email                   text check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  location                text check (char_length(location) <= 120),
  address                 text check (char_length(address) <= 500),
  quoted_amount           numeric(14,2) check (quoted_amount >= 0),
  advance_amount          numeric(14,2) check (advance_amount >= 0),
  notes                   text check (char_length(notes) <= 2000),
  status                  text not null default 'confirmed' check (status in ('confirmed', 'delivered', 'cancelled')),
  enquiry_id              uuid references public.enquiries(id) on delete set null,
  created_by              uuid references auth.users(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint orders_dates check (expected_delivery_date >= order_date),
  constraint orders_advance_le_quote check (
    quoted_amount is null or advance_amount is null or advance_amount <= quoted_amount)
);
create index orders_created_idx on public.orders (created_at desc);
create index orders_enquiry_idx on public.orders (enquiry_id);
create trigger orders_updated before update on public.orders
  for each row execute function public.set_updated_at();
alter table public.orders enable row level security;

create or replace function public.protect_order_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.order_no := old.order_no;
  new.created_at := old.created_at;
  new.created_by := old.created_by;
  return new;
end $$;
create trigger orders_protect before update on public.orders
  for each row execute function public.protect_order_identity();

create table public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  product_id    uuid references public.products(id) on delete set null,
  product_code  text check (char_length(product_code) <= 40),
  product_name  text not null check (char_length(btrim(product_name)) between 1 and 160),
  details       text check (char_length(details) <= 1000),
  quantity      integer not null default 1 check (quantity between 1 and 100),
  sort_order    integer not null default 0
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);
alter table public.order_items enable row level security;

-- Confirms an order: validates, assigns the next GNS-#### number and inserts order + lines atomically.
-- SECURITY INVOKER: RLS (admin only) applies to every insert; the explicit check gives a clear error.
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

  perform public.log_activity('order', 'Order ' || v_order.order_no || ' confirmed');
  return query select v_order.id, v_order.order_no;
end $$;

-- ---------------------------------------------------------------- activity triggers
create or replace function public.log_rate_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.log_activity('rates', 'Rates updated · 22K ₹' ||
    to_char(new.gold22_per_10g, 'FM99,99,99,999') || '/10 g');
  return new;
end $$;
create trigger rate_updates_log after insert on public.rate_updates
  for each row execute function public.log_rate_update();

create or replace function public.log_product_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.status = 'published' then
    perform public.log_activity('product', new.name || ' published');
  elsif tg_op = 'INSERT' then
    perform public.log_activity('product', new.name || ' added as draft');
  elsif new.status = 'published' and old.status <> 'published' then
    perform public.log_activity('product', new.name || ' published');
  elsif new.status = 'draft' and old.status = 'published' then
    perform public.log_activity('product', new.name || ' unpublished');
  end if;
  return new;
end $$;
create trigger products_log after insert or update of status on public.products
  for each row execute function public.log_product_change();
