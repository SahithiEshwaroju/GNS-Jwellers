import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { ProductCard } from "./ProductCard";
import { PriceNote } from "./PriceNote";
import { FilterSheetButton, FilterSidebar, SortSelect, type FilterGroup } from "./Filters";
import { SORTS, type CatalogueFilters, type ProductCard as Card } from "@/lib/data/catalogue";

/** Shared catalogue layout for /jewellery and /collections/[slug]. */
export function CatalogueView({
  title, subtitle, breadcrumb, groups, filters, items, total, saved, ratesUpdatedAt, shopName, view, searchParams, basePath,
}: {
  title: string; subtitle: string; breadcrumb: { href?: string; label: string }[]; groups: FilterGroup[]; filters: CatalogueFilters;
  items: Card[]; total: number; saved: Set<string>; ratesUpdatedAt: string | null; shopName: string; view: "grid" | "list";
  searchParams: Record<string, string | string[] | undefined>; basePath: string;
}) {
  const qs = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string") p.set(k, v);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    const s = p.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <div className="wrap pb-6 pt-5">
      <nav aria-label="Breadcrumb" className="mb-5 text-[14px] text-muted">
        <ol className="flex flex-wrap items-center gap-2">
          {breadcrumb.map((b, i) => (
            <li key={b.label} className="flex items-center gap-2">
              {i > 0 ? <Icon name="chevron-right" size={12} /> : null}
              {b.href ? <Link href={b.href} className="hover:text-burgundy">{b.label}</Link> : <span aria-current="page" className="text-espresso">{b.label}</span>}
            </li>
          ))}
        </ol>
      </nav>
      <div className="grid gap-8 lg:grid-cols-[250px_1fr]">
        <FilterSidebar groups={groups} />
        <div className="min-w-0">
          <div className="mb-5 lg:hidden"><FilterSheetButton groups={groups} /></div>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="h-page">{title}</h1>
              <p className="mt-1 text-muted">{subtitle}</p>
            </div>
            <p className="text-muted" aria-live="polite">{total} {total === 1 ? "Product" : "Products"}</p>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex overflow-hidden rounded border border-line" role="group" aria-label="Layout">
              <Link href={qs({ view: null })} aria-label="Grid view" aria-current={view === "grid" ? "true" : undefined} className={`grid h-11 w-11 place-items-center ${view === "grid" ? "bg-burgundy text-white" : "bg-white"}`}><Icon name="grid-view" /></Link>
              <Link href={qs({ view: "list" })} aria-label="List view" aria-current={view === "list" ? "true" : undefined} className={`grid h-11 w-11 place-items-center ${view === "list" ? "bg-burgundy text-white" : "bg-white"}`}><Icon name="list-view" /></Link>
            </div>
            <SortSelect options={SORTS} value={filters.sort} />
          </div>
          <div className="mt-4"><PriceNote updatedAt={ratesUpdatedAt} shopName={shopName} /></div>
          {filters.q ? <p className="mt-4 text-[15px]">Results for “<b>{filters.q}</b>” · <Link href={qs({ q: null, show: null })} className="text-burgundy underline">clear search</Link></p> : null}
          {items.length ? (
            <div className={`mt-5 grid gap-3 sm:gap-5 ${view === "list" ? "grid-cols-1" : "grid-cols-2 xl:grid-cols-3"}`}>
              {items.map((p) => (
                <ProductCard key={p.id} p={p} saved={saved.has(p.id)} variant={view === "list" ? "list" : "full"} />
              ))}
            </div>
          ) : (
            <div className="card mt-6 px-6 py-14 text-center">
              <Icon name="diamond-outline" size={36} className="mx-auto text-antique-gold" />
              <h2 className="mt-3 text-[28px]">No designs found</h2>
              <p className="mt-2 text-muted">Try removing a filter or searching for another name or code.</p>
              <Link href={basePath} className="btn btn-outline mt-5">Clear filters</Link>
            </div>
          )}
          {items.length < total ? (
            <div className="mt-8 text-center">
              <p className="text-[14px] text-muted">Showing {items.length} of {total}</p>
              <Link href={qs({ show: String(filters.show + 12) })} scroll={false} className="btn btn-outline mt-3">Load more designs</Link>
            </div>
          ) : items.length ? (
            <p className="mt-8 text-center text-[14px] text-muted">Showing {items.length} of {total}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
