import { PageHeader } from "@/components/admin/PageHeader";
import { TaxonomyManager } from "@/components/admin/TaxonomyManager";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getSettings } from "@/lib/data/site";

export const metadata = { title: "Categories & Collections" };

export default async function TaxonomyPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const supabase = await createClient();
  const [cats, settings, { data: cols }, { data: tags }, { data: prods }, { data: pt }] = await Promise.all([
    getCategories(), getSettings(),
    supabase.from("collections").select("*").order("sort_order").order("name"),
    supabase.from("tags").select("id, name").order("name"),
    supabase.from("products").select("category_id, collection_id"),
    supabase.from("product_tags").select("tag_id"),
  ]);
  const count = (key: "category_id" | "collection_id", id: string) => (prods ?? []).filter((p) => p[key] === id).length;
  return (
    <>
      <PageHeader title="Categories & Collections" subtitle="Changes appear across the website's menus and filters." />
      <TaxonomyManager
        tab={tab === "collections" || tab === "tags" ? tab : "categories"}
        categories={cats.map((c) => ({ id: c.id, name: c.name, code_prefix: c.code_prefix, show_on_home: c.show_on_home, products: count("category_id", c.id), subcategories: c.subcategories.map((s) => ({ id: s.id, name: s.name })) }))}
        home={{ layout: settings.home_category_layout, limit: settings.home_category_limit, colsMobile: settings.home_category_cols_mobile }}
        collections={(cols ?? []).map((c) => ({ id: c.id, name: c.name, description: c.description ?? "", theme_color: c.theme_color, show_on_home: c.show_on_home, products: count("collection_id", c.id) }))}
        tags={(tags ?? []).map((t) => ({ ...t, products: (pt ?? []).filter((x) => x.tag_id === t.id).length }))}
      />
    </>
  );
}
