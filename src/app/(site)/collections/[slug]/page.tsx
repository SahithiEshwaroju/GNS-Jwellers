import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogueView } from "@/components/site/CatalogueView";
import { getFacets, parseFilters, searchCatalogue } from "@/lib/data/catalogue";
import { getCategories, getCollections, getCurrentRates, getSettings } from "@/lib/data/site";
import { getSavedIds } from "@/lib/data/saved";
import { buildFilterGroups } from "@/lib/catalogue-groups";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = (await getCollections()).find((x) => x.slug === slug);
  return { title: c?.name ?? "Collection" };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const cols = await getCollections();
  const col = cols.find((c) => c.slug === slug);
  if (!col) notFound();
  const filters = { ...parseFilters(sp), collection: [col.slug] };
  const [{ items, total }, facets, cats, rates, settings, saved] = await Promise.all([
    searchCatalogue(filters), getFacets(), getCategories(), getCurrentRates(), getSettings(), getSavedIds(),
  ]);
  return (
    <CatalogueView
      title={col.name}
      subtitle={col.description ?? `Designs from the ${col.name}.`}
      breadcrumb={[{ href: "/", label: "Home" }, { href: "/collections", label: "Collections" }, { label: col.name }]}
      groups={buildFilterGroups(facets, cats, cols, { hideCollection: true })}
      filters={filters}
      items={items}
      total={total}
      saved={saved}
      ratesUpdatedAt={rates?.updatedAt ?? null}
      shopName={settings.shop_name}
      view={sp.view === "list" ? "list" : "grid"}
      searchParams={sp}
      basePath={`/collections/${col.slug}`}
    />
  );
}
