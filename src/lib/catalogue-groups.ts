import type { FilterGroup } from "@/components/site/Filters";
import { GENDERS, PRICE_BANDS, type Facets } from "@/lib/data/catalogue";
import type { CategoryWithSubs, CollectionWithCount } from "@/lib/data/site";

export function buildFilterGroups(f: Facets, cats: CategoryWithSubs[], cols: CollectionWithCount[], opts: { hideCollection?: boolean } = {}): FilterGroup[] {
  const dyn = (o: Record<string, number>) =>
    Object.entries(o).sort(([a], [b]) => a.localeCompare(b)).map(([v, count]) => ({ value: v, label: v, count }));
  const groups: FilterGroup[] = [
    { key: "category", label: "Category", open: true, options: cats.map((c) => ({ value: c.slug, label: c.name, count: f.category[c.slug] ?? 0 })) },
    { key: "collection", label: "Collection", open: true, options: cols.map((c) => ({ value: c.slug, label: c.name, count: f.collection[c.slug] ?? 0 })) },
    { key: "metal", label: "Metal Type", open: true, options: [["gold", "Gold"], ["silver", "Silver"]].filter(([k]) => f.metal[k]).map(([k, l]) => ({ value: k, label: l, count: f.metal[k] })) },
    { key: "karat", label: "Gold Karat", open: true, options: ["24", "22", "18"].filter((k) => f.karat[k]).map((k) => ({ value: k, label: `${k} Karat`, count: f.karat[k] })) },
    { key: "price", label: "Price", open: true, options: PRICE_BANDS.filter((b) => f.price[b.key]).map((b) => ({ value: b.key, label: b.label, count: f.price[b.key] })) },
    { key: "style", label: "Style", options: dyn(f.style) },
    { key: "occasion", label: "Occasion", options: dyn(f.occasion) },
    { key: "gender", label: "Gender", options: GENDERS.filter((g) => f.gender[g.key]).map((g) => ({ value: g.key, label: g.label, count: f.gender[g.key] })) },
  ];
  return opts.hideCollection ? groups.filter((g) => g.key !== "collection") : groups;
}
