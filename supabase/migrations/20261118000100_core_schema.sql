-- GNS Jewellers — core schema: users/admins, media, taxonomy, products, rates, site content.
-- RLS is enabled here for every table; policies live in a later migration (fail-closed until then).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- helpers
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    lower(new.email),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 120),
    left(new.raw_user_meta_data ->> 'avatar_url', 500)
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- admins
create table public.admins (
  email       text primary key
              check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  name        text check (char_length(name) <= 100),
  added_by    uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.admins enable row level security;

-- True when the caller is signed in with a confirmed email that is on the admin allow-list.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from auth.users u
    join public.admins a on a.email = lower(u.email)
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
  );
$$;

-- ---------------------------------------------------------------- media (R2 objects)
create table public.media (
  id            uuid primary key default gen_random_uuid(),
  object_key    text not null unique
                check (object_key ~ '^(products|site|extract)/[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)*\.(jpg|png|webp)$'),
  purpose       text not null check (purpose in ('product', 'site', 'extract')),
  content_type  text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes    integer not null check (size_bytes > 0 and size_bytes <= 8388608),
  status        text not null default 'pending' check (status in ('pending', 'ready')),
  alt_text      text check (char_length(alt_text) <= 200),
  uploaded_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);
alter table public.media enable row level security;

-- ---------------------------------------------------------------- taxonomy
create table public.categories (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(btrim(name)) between 1 and 60),
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  code_prefix     text not null unique check (code_prefix ~ '^[A-Z]{2,4}$'),
  sort_order      integer not null default 0,
  show_on_home    boolean not null default true,
  image_media_id  uuid references public.media(id) on delete set null,
  next_seq        integer not null default 1 check (next_seq >= 1),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index categories_name_ci on public.categories (lower(name));
create trigger categories_updated before update on public.categories
  for each row execute function public.set_updated_at();
alter table public.categories enable row level security;

create table public.subcategories (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.categories(id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 60),
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);
create unique index subcategories_name_ci on public.subcategories (category_id, lower(name));
alter table public.subcategories enable row level security;

create table public.collections (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(btrim(name)) between 1 and 60),
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description     text check (char_length(description) <= 300),
  theme_color     text not null default '#540404' check (theme_color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order      integer not null default 0,
  show_on_home    boolean not null default true,
  image_media_id  uuid references public.media(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index collections_name_ci on public.collections (lower(name));
create trigger collections_updated before update on public.collections
  for each row execute function public.set_updated_at();
alter table public.collections enable row level security;

create table public.tags (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  created_at  timestamptz not null default now()
);
create unique index tags_name_ci on public.tags (lower(name));
alter table public.tags enable row level security;

-- ---------------------------------------------------------------- products
create table public.products (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,
  name               text not null check (char_length(btrim(name)) between 2 and 120),
  category_id        uuid not null references public.categories(id) on delete restrict,
  subcategory_id     uuid references public.subcategories(id) on delete restrict,
  collection_id      uuid references public.collections(id) on delete set null,
  description        text check (char_length(description) <= 2000),
  model_description  text check (char_length(model_description) <= 2000),
  metal              text not null check (metal in ('gold', 'silver')),
  karat              smallint,
  silver_purity      text check (char_length(silver_purity) <= 20),
  weight_g           numeric(10,3) not null check (weight_g > 0 and weight_g < 10000),
  making_type        text not null default 'fixed' check (making_type in ('fixed', 'percent', 'per_gram')),
  making_value       numeric(12,2) not null default 0 check (making_value >= 0),
  stone_value        numeric(12,2) not null default 0 check (stone_value >= 0),
  stones_note        text check (char_length(stones_note) <= 200),
  style              text check (char_length(style) <= 40),
  occasion           text check (char_length(occasion) <= 40),
  gender             text check (gender in ('women', 'men', 'unisex', 'kids')),
  specifications     jsonb not null default '[]'::jsonb check (jsonb_typeof(specifications) = 'array'),
  status             text not null default 'draft' check (status in ('draft', 'published')),
  is_featured        boolean not null default false,
  is_sample          boolean not null default false,
  published_at       timestamptz,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint products_karat_matches_metal check (
    (metal = 'gold' and karat in (24, 22, 18) and silver_purity is null)
    or (metal = 'silver' and karat is null)
  ),
  constraint products_percent_making check (making_type <> 'percent' or making_value <= 100)
);
create index products_category_idx on public.products (category_id);
create index products_collection_idx on public.products (collection_id);
create index products_subcategory_idx on public.products (subcategory_id);
create index products_status_published_idx on public.products (status, published_at desc);
alter table public.products enable row level security;

-- Codes are assigned by the database: GNS-<prefix>-<0001>, never reused, never edited.
create or replace function public.assign_product_code()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_prefix text;
  v_seq    integer;
begin
  if tg_op = 'INSERT' then
    if new.code is null or new.code = '' then
      update public.categories
        set next_seq = next_seq + 1
        where id = new.category_id
        returning code_prefix, next_seq - 1 into v_prefix, v_seq;
      if v_prefix is null then
        raise exception 'Unknown category' using errcode = '23503';
      end if;
      new.code := 'GNS-' || v_prefix || '-' || lpad(v_seq::text, 4, '0');
    end if;
    if new.status = 'published' and new.published_at is null then
      new.published_at := now();
    end if;
  else
    new.code := old.code;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    if new.status = 'published' and old.status <> 'published' then
      new.published_at := now();
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;

create trigger products_code before insert or update on public.products
  for each row execute function public.assign_product_code();

create table public.product_tags (
  product_id  uuid not null references public.products(id) on delete cascade,
  tag_id      uuid not null references public.tags(id) on delete cascade,
  primary key (product_id, tag_id)
);
create index product_tags_tag_idx on public.product_tags (tag_id);
alter table public.product_tags enable row level security;

create table public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  media_id    uuid not null unique references public.media(id) on delete cascade,
  view_label  text not null default 'front' check (view_label in ('front', 'side', 'worn', 'detail', 'other')),
  sort_order  integer not null default 0
);
create index product_images_product_idx on public.product_images (product_id, sort_order);
alter table public.product_images enable row level security;

-- ---------------------------------------------------------------- rates
create table public.rate_updates (
  id                bigint generated always as identity primary key,
  gold22_per_10g    numeric(12,2) not null check (gold22_per_10g > 0 and gold22_per_10g < 10000000),
  silver_per_kg     numeric(12,2) not null check (silver_per_kg > 0 and silver_per_kg < 100000000),
  gst_percent       numeric(5,2) not null default 3 check (gst_percent >= 0 and gst_percent <= 28),
  is_sample         boolean not null default false,
  created_by        uuid references auth.users(id) on delete set null,
  created_by_email  text,
  created_at        timestamptz not null default now()
);
create index rate_updates_created_idx on public.rate_updates (created_at desc);
alter table public.rate_updates enable row level security;

create or replace function public.stamp_rate_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.created_at := now();
  new.created_by := auth.uid();
  new.created_by_email := (select lower(email) from auth.users where id = auth.uid());
  return new;
end $$;
create trigger rate_updates_stamp before insert on public.rate_updates
  for each row execute function public.stamp_rate_update();

-- ---------------------------------------------------------------- site content
create table public.site_settings (
  id                         integer primary key default 1 check (id = 1),
  shop_name                  text not null default 'GNS Jewellers' check (char_length(shop_name) between 1 and 80),
  tagline                    text not null default 'GOLD · SILVER · WORKSHOP' check (char_length(tagline) <= 80),
  whatsapp_number            text check (whatsapp_number ~ '^\+?[0-9]{10,15}$'),
  phone                      text check (char_length(phone) <= 30),
  email                      text check (char_length(email) <= 254),
  address                    text check (char_length(address) <= 500),
  opening_hours              text check (char_length(opening_hours) <= 120),
  hero_eyebrow               text not null default 'Timeless Jewellery' check (char_length(hero_eyebrow) <= 60),
  hero_headline              text not null default 'Tradition in Every Design' check (char_length(hero_headline) <= 80),
  hero_text                  text not null default 'Discover a curated collection of gold, diamond and silver jewellery, crafted for life''s special moments.' check (char_length(hero_text) <= 300),
  brand_story                text check (char_length(brand_story) <= 1000),
  trust_highlights           text check (char_length(trust_highlights) <= 300),
  is_hallmarked              boolean not null default false,
  about_intro                text check (char_length(about_intro) <= 300),
  about_story                text check (char_length(about_story) <= 4000),
  about_values               text check (char_length(about_values) <= 2000),
  instagram_url              text check (instagram_url ~ '^https://'),
  youtube_url                text check (youtube_url ~ '^https://'),
  facebook_url               text check (facebook_url ~ '^https://'),
  privacy_text               text check (char_length(privacy_text) <= 20000),
  terms_text                 text check (char_length(terms_text) <= 20000),
  home_category_layout       text not null default 'square' check (home_category_layout in ('square', 'round', 'list')),
  home_category_limit        integer not null default 6 check (home_category_limit between 2 and 24),
  home_category_cols_mobile  integer not null default 3 check (home_category_cols_mobile in (2, 3)),
  updated_by                 uuid references auth.users(id) on delete set null,
  updated_at                 timestamptz not null default now()
);
create trigger site_settings_updated before update on public.site_settings
  for each row execute function public.set_updated_at();
alter table public.site_settings enable row level security;
insert into public.site_settings (id) values (1);

create table public.site_images (
  slot        text primary key check (slot in (
                'hero', 'story', 'custom_hero', 'custom_example_1', 'custom_example_2',
                'custom_example_3', 'about', 'logo', 'share')),
  media_id    uuid not null references public.media(id) on delete cascade,
  updated_at  timestamptz not null default now()
);
alter table public.site_images enable row level security;
