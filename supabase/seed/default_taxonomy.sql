-- Default categories, subcategories and collections taken from the final design.
-- Safe to run once on a fresh database; the owner can rename/delete them in Admin › Categories & Collections.
insert into public.categories (name, slug, code_prefix, sort_order) values
  ('Necklaces', 'necklaces', 'NK', 1), ('Earrings', 'earrings', 'ER', 2), ('Rings', 'rings', 'RG', 3),
  ('Bangles', 'bangles', 'BG', 4), ('Bracelets', 'bracelets', 'BR', 5), ('Pendants', 'pendants', 'PD', 6),
  ('Mangalsutras', 'mangalsutras', 'MS', 7), ('Anklets', 'anklets', 'AK', 8)
on conflict do nothing;

insert into public.subcategories (category_id, name, sort_order)
select c.id, s.name, s.ord
from (values
  ('necklaces', 'Temple Necklaces', 1), ('necklaces', 'Diamond Necklaces', 2), ('necklaces', 'Chains', 3), ('necklaces', 'Chokers', 4),
  ('earrings', 'Jhumkas', 1), ('earrings', 'Drops', 2), ('earrings', 'Studs', 3),
  ('rings', 'Gold Rings', 1), ('rings', 'Diamond Rings', 2),
  ('bangles', 'Bangles', 1), ('bangles', 'Kadas', 2),
  ('bracelets', 'Gold Bracelets', 1), ('bracelets', 'Silver Bracelets', 2),
  ('pendants', 'Diamond Pendants', 1), ('pendants', 'Gold Pendants', 2),
  ('mangalsutras', 'Mangalsutras', 1), ('anklets', 'Payals', 1)
) as s(cat, name, ord)
join public.categories c on c.slug = s.cat
on conflict do nothing;

insert into public.collections (name, slug, description, theme_color, sort_order) values
  ('Bridal Collection', 'bridal-collection', 'Grand designs for your big day.', '#540404', 1),
  ('Everyday Elegance', 'everyday-elegance', 'Lightweight, stylish and perfect for daily wear.', '#9E7972', 2),
  ('Heritage Collection', 'heritage-collection', 'Temple-inspired designs with an antique finish.', '#3F0D0C', 3),
  ('Contemporary Collection', 'contemporary-collection', 'Clean, modern forms in gold and silver.', '#7B5B52', 4)
on conflict do nothing;
