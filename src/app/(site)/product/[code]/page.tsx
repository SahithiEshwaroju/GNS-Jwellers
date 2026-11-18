import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Gallery } from "@/components/site/Gallery";
import { ProductActions } from "@/components/site/ProductActions";
import { ProductCard } from "@/components/site/ProductCard";
import { SaveButton } from "@/components/site/SaveButton";
import { getProductByCode, getSimilar } from "@/lib/data/catalogue";
import { getSettings, getCurrentRates } from "@/lib/data/site";
import { getSavedIds } from "@/lib/data/saved";
import { formatDateTime, formatINR, formatWeight } from "@/lib/format";
import { tintFor } from "@/lib/tint";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProductByCode((await params).code);
  return p ? { title: p.name, description: p.description ?? undefined } : { title: "Design not found" };
}

export default async function ProductPage({ params }: Props) {
  const { code } = await params;
  const p = await getProductByCode(code);
  if (!p) notFound();
  const [settings, rates, saved, similar] = await Promise.all([getSettings(), getCurrentRates(), getSavedIds(), getSimilar(p)]);
  const specs: [string, string][] = [
    ["Product Code", p.code],
    ["Category", p.subcategory_name ? `${p.category_name} › ${p.subcategory_name}` : p.category_name],
    ["Metal", p.metal === "gold" ? "Gold" : "Silver"],
    p.metal === "gold" ? ["Karat", `${p.karat} Karat`] : ["Purity", p.silver_purity ?? "—"],
    ["Total Weight", `${formatWeight(p.weight_g)} (approx.)`],
    ["Stones", p.stones_note ?? (Number(p.stone_value) > 0 ? "Yes (value in price)" : "None")],
    ...(p.style ? ([["Theme / Style", p.style]] as [string, string][]) : []),
    ...(p.occasion ? ([["Occasion", p.occasion]] as [string, string][]) : []),
    ...(p.gender ? ([["Gender", p.gender[0].toUpperCase() + p.gender.slice(1)]] as [string, string][]) : []),
    ...((Array.isArray(p.specifications) ? p.specifications : []) as { label: string; value: string }[]).map((s) => [s.label, s.value] as [string, string]),
  ];
  const metalName = p.metal === "gold" ? `Gold (${p.karat}K)` : `Silver${p.silver_purity ? ` (${p.silver_purity})` : ""}`;
  const isDraft = p.status !== "published";
  return (
    <div className="wrap pb-6 pt-5">
      {isDraft ? <p className="mb-4 rounded-md bg-draft-bg px-4 py-2 text-[14px] text-draft-ink">Draft preview — only admins can see this page.</p> : null}
      <nav aria-label="Breadcrumb" className="mb-5 text-[14px] text-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li><Link href="/" className="hover:text-burgundy">Home</Link></li>
          <li className="flex items-center gap-2"><Icon name="chevron-right" size={12} /><Link href={`/jewellery?category=${p.category_slug}`} className="hover:text-burgundy">{p.category_name}</Link></li>
          <li className="flex items-center gap-2"><Icon name="chevron-right" size={12} /><span aria-current="page" className="text-espresso">{p.name}</span></li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        <Gallery images={p.images} name={p.name} tint={tintFor(p.code)} />
        <div>
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-[40px] sm:text-[52px]">{p.name}</h1>
            {!isDraft ? <SaveButton productId={p.id} productName={p.name} initialSaved={saved.has(p.id)} size="md" /> : null}
          </div>
          {p.collection_name ? (
            <p className="mt-2">From the <Link href={`/collections/${p.collection_slug}`} className="font-semibold text-burgundy hover:underline">{p.collection_name}</Link></p>
          ) : null}
          {p.description ? <p className="mt-4 text-[16px] text-muted">{p.description}</p> : null}
          {p.model_description ? <p className="mt-2 text-[15px] text-muted"><span className="font-medium text-espresso">Design: </span>{p.model_description}</p> : null}

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-[34px] font-bold leading-none text-wine sm:text-[36px]">{formatINR(p.estimated_price)}</p>
              <p className="mt-2 text-[14px] text-muted">({p.estimated_price === null ? "Price on request" : "Approx. price"} · {p.code})</p>
            </div>
            <div className="flex flex-1 items-start gap-3 rounded-md border border-line bg-card px-4 py-3 text-[14px] text-muted sm:max-w-[300px] sm:border-l-line max-sm:border-l-4 max-sm:border-l-antique-gold max-sm:bg-note-bg">
              <Icon name="info-circle" size={18} className="mt-0.5 shrink-0" />
              <p>Approximate price. Final price will be confirmed by the {settings.shop_name} team.{rates ? ` Rates updated ${formatDateTime(rates.updatedAt)}.` : ""}</p>
            </div>
          </div>

          {!isDraft ? (
            <ProductActions
              item={{ code: p.code, name: p.name, price: p.estimated_price === null ? null : Number(p.estimated_price), coverMediaId: p.cover_media_id }}
              metal={p.metal as "gold" | "silver"}
              karat={p.karat}
            />
          ) : null}

          <ul className="mt-6 grid grid-cols-1 gap-4 border-y border-line py-5 sm:grid-cols-3">
            <li className="flex items-start gap-3"><Icon name="message-square" size={22} className="shrink-0 text-wine" /><span><b className="block text-[15px]">Quick Enquiry</b><span className="text-[14px] text-muted">No account needed</span></span></li>
            {settings.is_hallmarked ? (
              <li className="flex items-start gap-3"><Icon name="shield" size={22} className="shrink-0 text-wine" /><span><b className="block text-[15px]">Hallmarked</b><span className="text-[14px] text-muted">Certified purity</span></span></li>
            ) : null}
            <li className="flex items-start gap-3"><Icon name="diamond-outline" size={22} className="shrink-0 text-wine" /><span><b className="block text-[15px]">Custom Designs</b><span className="text-[14px] text-muted">Make it truly yours</span></span></li>
          </ul>
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="card bg-white p-5 sm:p-6" aria-labelledby="spec-title">
          <h2 id="spec-title" className="text-[28px] sm:text-[32px]">Product Specifications</h2>
          <dl className="mt-4">
            {specs.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-line py-3 text-[15px] last:border-0">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="card bg-white p-5 sm:p-6" aria-labelledby="breakup-title">
          <h2 id="breakup-title" className="text-[28px] sm:text-[32px]">Price Breakup <span className="font-sans text-[14px] font-medium text-muted">(Approx.)</span></h2>
          {p.estimated_price !== null ? (
            <>
              <dl className="mt-4">
                <Row k={`${metalName} · ${formatWeight(p.weight_g).replace(" g", "")} g × ${formatINR(p.rate_per_g)}/g`} v={formatINR(p.metal_value)} />
                <Row k="Making charges" v={formatINR(p.making_amount)} />
                {Number(p.stone_amount) > 0 ? <Row k="Stone value" v={formatINR(p.stone_amount)} /> : null}
                <Row k={`GST (${Number(p.gst_percent)}%)`} v={formatINR(p.gst_amount)} />
              </dl>
              <div className="mt-4 flex items-center justify-between rounded-md bg-price-bg px-4 py-4">
                <span className="text-[18px] font-semibold">Estimated Price</span>
                <span className="text-[20px] font-bold text-wine">{formatINR(p.estimated_price)}</span>
              </div>
              <p className="mt-3 text-[13.5px] text-muted">
                {p.metal === "gold" ? "Gold rate is per gram for the karat shown, worked out from the shop's 22K rate per 10 g. " : "Silver rate is per gram from the shop's rate per kg. "}
                GST {Number(p.gst_percent)}% on metal + making + stones.
              </p>
            </>
          ) : (
            <p className="mt-4 text-muted">Prices will appear once the shop publishes today&apos;s rates.</p>
          )}
        </section>
      </div>

      {p.tag_names.length ? (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <h2 className="text-[28px]">Tags</h2>
          {p.tag_names.map((t) => (
            <Link key={t} href={`/jewellery?q=${encodeURIComponent(t)}`} className="rounded-full border border-line bg-white px-4 py-1.5 text-[14px] hover:border-dusty-rose">{t}</Link>
          ))}
        </div>
      ) : null}

      {similar.length ? (
        <section className="mt-14" aria-labelledby="sim-title">
          <div className="mb-6 flex items-center justify-between">
            <h2 id="sim-title" className="h-sec">Similar Designs</h2>
            <Link href={`/jewellery?category=${p.category_slug}`} className="inline-flex items-center gap-1 text-burgundy hover:underline">View All <Icon name="arrow-right" size={15} /></Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {similar.map((s) => (
              <ProductCard key={s.id} p={s} saved={saved.has(s.id)} variant="compact" priceLabel="(Approx.)" />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-3 text-[15px]">
      <dt className="text-muted">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
