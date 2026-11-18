import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { CollectionBanner } from "@/components/site/CollectionBanner";
import { getCollections, getSettings } from "@/lib/data/site";

export const metadata: Metadata = { title: "Collections" };

export default async function CollectionsPage() {
  const [cols, settings] = await Promise.all([getCollections(), getSettings()]);
  return (
    <div className="wrap pb-6 pt-5">
      <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-2 text-[14px] text-muted">
        <Link href="/" className="hover:text-burgundy">Home</Link><Icon name="chevron-right" size={12} /><span aria-current="page" className="text-espresso">Collections</span>
      </nav>
      <h1 className="h-page">Our Collections</h1>
      <p className="mt-2 text-muted">Curated edits of {settings.shop_name} designs.</p>
      {cols.length ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {cols.map((c) => (
            <CollectionBanner key={c.id} c={c} showCount tall />
          ))}
        </div>
      ) : (
        <p className="card mt-8 p-10 text-center text-muted">Collections will appear here soon. <Link href="/jewellery" className="text-burgundy underline">Browse all jewellery</Link>.</p>
      )}
    </div>
  );
}
