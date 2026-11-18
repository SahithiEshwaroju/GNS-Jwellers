-- Pricing engine (BR-01) and the catalogue view used by the public site and admin lists.
-- src/lib/pricing.ts mirrors product_estimate(); tests assert parity.

create or replace function public.product_estimate(
  p_metal          text,
  p_karat          smallint,
  p_weight_g       numeric,
  p_making_type    text,
  p_making_value   numeric,
  p_stone_value    numeric,
  p_gold22_per_10g numeric,
  p_silver_per_kg  numeric,
  p_gst_percent    numeric
)
returns table (
  rate_per_g     numeric,
  metal_value    numeric,
  making_amount  numeric,
  stone_amount   numeric,
  gst_amount     numeric,
  total          numeric
)
language plpgsql immutable set search_path = '' as $$
declare
  v_rate   numeric;
  v_metal  numeric;
  v_making numeric;
  v_stone  numeric := round(coalesce(p_stone_value, 0));
  v_gst    numeric;
begin
  if p_gold22_per_10g is null or p_silver_per_kg is null or p_gst_percent is null then
    return; -- no rates yet: no estimate
  end if;
  if p_metal = 'gold' then
    v_rate := (p_gold22_per_10g / 10) * p_karat / 22;
  else
    v_rate := p_silver_per_kg / 1000;
  end if;
  v_metal := round(p_weight_g * v_rate);
  v_making := case p_making_type
    when 'percent'  then round(v_metal * p_making_value / 100)
    when 'per_gram' then round(p_weight_g * p_making_value)
    else round(p_making_value)
  end;
  v_gst := round((v_metal + v_making + v_stone) * p_gst_percent / 100);
  rate_per_g := v_rate;
  metal_value := v_metal;
  making_amount := v_making;
  stone_amount := v_stone;
  gst_amount := v_gst;
  total := v_metal + v_making + v_stone + v_gst;
  return next;
end $$;

create or replace view public.current_rates
with (security_invoker = true) as
select id, gold22_per_10g, silver_per_kg, gst_percent, created_at
from public.rate_updates
order by created_at desc, id desc
limit 1;

create or replace view public.catalogue_products
with (security_invoker = true) as
select
  p.id, p.code, p.name, p.category_id, p.subcategory_id, p.collection_id,
  p.description, p.model_description, p.metal, p.karat, p.silver_purity, p.weight_g,
  p.making_type, p.making_value, p.stone_value, p.stones_note, p.style, p.occasion, p.gender,
  p.specifications, p.status, p.is_featured, p.is_sample, p.published_at, p.created_at, p.updated_at,
  c.name  as category_name,
  c.slug  as category_slug,
  s.name  as subcategory_name,
  col.name as collection_name,
  col.slug as collection_slug,
  e.rate_per_g, e.metal_value, e.making_amount, e.stone_amount, e.gst_amount,
  e.total as estimated_price,
  r.created_at as rates_updated_at,
  r.gst_percent,
  (select pi.media_id from public.product_images pi
     where pi.product_id = p.id order by pi.sort_order, pi.id limit 1) as cover_media_id,
  (select count(*)::int from public.product_images pi where pi.product_id = p.id) as image_count,
  coalesce((select array_agg(t.name order by t.name) from public.product_tags pt
     join public.tags t on t.id = pt.tag_id where pt.product_id = p.id), '{}') as tag_names,
  lower(concat_ws(' ', p.name, p.code, p.description, p.model_description, c.name, s.name, col.name,
     p.style, p.occasion, p.metal,
     (select string_agg(t.name, ' ') from public.product_tags pt
        join public.tags t on t.id = pt.tag_id where pt.product_id = p.id))) as search_text
from public.products p
join public.categories c on c.id = p.category_id
left join public.subcategories s on s.id = p.subcategory_id
left join public.collections col on col.id = p.collection_id
left join lateral (select * from public.current_rates) r on true
left join lateral public.product_estimate(
  p.metal, p.karat, p.weight_g, p.making_type, p.making_value, p.stone_value,
  r.gold22_per_10g, r.silver_per_kg, r.gst_percent) e on true;
