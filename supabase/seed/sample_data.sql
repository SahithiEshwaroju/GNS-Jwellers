-- SAMPLE DATA for development/preview only. Every row is flagged is_sample = true and is shown with a
-- "Sample" badge in the admin portal. Remove with remove_sample_data.sql before going live.
insert into public.rate_updates (gold22_per_10g, silver_per_kg, gst_percent, is_sample)
values (115000, 145000, 3, true);

insert into public.products (name, category_id, subcategory_id, collection_id, description, model_description,
  metal, karat, silver_purity, weight_g, making_type, making_value, stone_value, stones_note, style, occasion,
  gender, specifications, status, is_featured, is_sample)
select s.name, c.id, sc.id, col.id, s.descr, s.model, s.metal, s.karat, s.purity, s.weight, 'fixed', s.making,
       s.stone, s.stones_note, s.style, s.occasion, s.gender, '[]'::jsonb, 'published', s.featured, true
from (values
  ('Heritage Temple Necklace','necklaces','Temple Necklaces','heritage-collection','A temple-style necklace with Lakshmi motifs and an antique finish.','Broad collar profile with drop pendant.','gold',22::smallint,null,28.34,21720,4500,'Kemp stones','Temple','Wedding','women',true),
  ('Floral Diamond Necklace','necklaces','Diamond Necklaces','bridal-collection','Floral diamond necklace for bridal wear.','Floral links with a centre cluster.','gold',18::smallint,null,18.6,18500,34000,'Diamonds','Floral','Wedding','women',true),
  ('Classic Gold Necklace','necklaces','Chains','everyday-elegance','A light classic gold necklace for daily wear.',null,'gold',22::smallint,null,12.4,6800,0,null,'Classic','Daily Wear','women',false),
  ('Lakshmi Coin Necklace','necklaces','Temple Necklaces','heritage-collection','Traditional coin necklace (kasu mala).',null,'gold',22::smallint,null,23.5,21350,0,null,'Temple','Festive','women',false),
  ('Pearl Choker Necklace','necklaces','Chokers','bridal-collection','Choker with pearl drops.',null,'gold',22::smallint,null,32.5,27500,6000,'Pearls','Traditional','Wedding','women',true),
  ('Floral Bloom Ring','rings','Gold Rings','everyday-elegance','Floral ring with a polished finish.',null,'gold',22::smallint,null,2.8,6500,0,null,'Floral','Daily Wear','women',false),
  ('Solitaire Promise Ring','rings','Diamond Rings','contemporary-collection','Solitaire ring in 18K gold.',null,'gold',18::smallint,null,3.2,9200,38000,'Solitaire diamond','Modern','Engagement','unisex',false),
  ('Ruby Teardrop Earrings','earrings','Drops','everyday-elegance','Teardrop earrings with ruby accents.',null,'gold',18::smallint,null,4.1,6400,4290,'Rubies','Modern','Party','women',false),
  ('Temple Jhumkas','earrings','Jhumkas','heritage-collection','Classic temple jhumkas.',null,'gold',22::smallint,null,9.6,11600,500,null,'Temple','Festive','women',true),
  ('Classic Diamond Pendant','pendants','Diamond Pendants','everyday-elegance','A floral diamond pendant (chain sold separately).',null,'gold',18::smallint,null,3.9,4800,18500,'Diamonds','Floral','Daily Wear','women',false),
  ('Leaf Vine Bangle','bangles','Bangles','everyday-elegance','Bangle with a leaf vine pattern.',null,'gold',22::smallint,null,12.6,8900,0,null,'Floral','Daily Wear','women',false),
  ('Bridal Kada Pair','bangles','Kadas','bridal-collection','A pair of broad bridal kadas.',null,'gold',22::smallint,null,38.2,30500,0,null,'Traditional','Wedding','women',false),
  ('Twisted Rope Bracelet','bracelets','Gold Bracelets','contemporary-collection','Twisted rope bracelet.',null,'gold',22::smallint,null,8.4,7400,0,null,'Modern','Daily Wear','unisex',false),
  ('Black Bead Mangalsutra','mangalsutras','Mangalsutras','bridal-collection','Black bead mangalsutra with gold vati.',null,'gold',22::smallint,null,10.2,9800,0,null,'Traditional','Wedding','women',false),
  ('Silver Payal Anklets','anklets','Payals','everyday-elegance','Pair of silver payals with bells.',null,'silver',null,'925',42,1800,0,null,'Traditional','Daily Wear','women',false)
) as s(name, cat, sub, coll, descr, model, metal, karat, purity, weight, making, stone, stones_note, style, occasion, gender, featured)
join public.categories c on c.slug = s.cat
left join public.subcategories sc on sc.category_id = c.id and sc.name = s.sub
left join public.collections col on col.slug = s.coll;

insert into public.tags (name) values ('Diamond'), ('Daily Wear'), ('Temple'), ('Bridal'), ('Lightweight')
on conflict do nothing;
insert into public.product_tags (product_id, tag_id)
select p.id, t.id from public.products p join public.tags t on
  (t.name = 'Diamond' and p.name ilike '%diamond%') or (t.name = 'Daily Wear' and p.occasion = 'Daily Wear')
  or (t.name = 'Temple' and p.style = 'Temple') or (t.name = 'Bridal' and p.occasion = 'Wedding')
where p.is_sample
on conflict do nothing;
