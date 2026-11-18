import type { Metadata } from "next";
import { CatalogueView } from "@/components/site/CatalogueView";
import { getFacets, parseFilters, searchCatalogue } from "@/lib/data/catalogue";
import { getCategories, getCollections, getCurrentRates, getSettings } from "@/lib/data/site";
import { getSavedIds } from "@/lib/data/saved";
import { buildFilterGroups } from "@/lib/catalogue-groups";

export const metadata: Metadata = { title: "All Jewellery" };

export default async function JewelleryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const [{ items, total }, facets, cats, cols, rates, settings, saved] = await Promise.all([
    searchCatalogue(filters), getFacets(), getCategories(), getCollections(), getCurrentRates(), getSettings(), getSavedIds(),
  ]);
  const single = filters.category.length === 1 ? cats.find((c) => c.slug === filters.category[0]) : undefined;
  const sub = single?.subcategories.find((s) => s.id === filters.subcategory);
  return (
    <CatalogueView
      title={sub?.name ?? single?.name ?? "All Jewellery"}
      subtitle={`Browse ${settings.shop_name}' ${single ? single.name.toLowerCase() : "full catalogue"}.`}
      breadcrumb={[{ href: "/", label: "Home" }, single ? { href: "/jewellery", label: "Jewellery" } : { label: "Jewellery" }, ...(single ? [{ label: single.name }] : [])]}
      groups={buildFilterGroups(facets, cats, cols)}
      filters={filters}
      items={items}
      total={total}
      saved={saved}
      ratesUpdatedAt={rates?.updatedAt ?? null}
      shopName={settings.shop_name}
      view={sp.view === "list" ? "list" : "grid"}
      searchParams={sp}
      basePath="/jewellery"
    />
  );
}
