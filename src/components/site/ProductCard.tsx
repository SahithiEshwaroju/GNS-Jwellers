import Link from "next/link";
import { Photo } from "@/components/ui/Photo";
import { tintFor } from "@/lib/tint";
import { SaveButton } from "./SaveButton";
import { formatINR, formatWeight, metalLabel } from "@/lib/format";
import type { ProductCard as Card } from "@/lib/data/catalogue";

export function ProductCard({
  p, saved, variant = "full", priceLabel = "(Approx. price)", showCollection = true,
}: {
  p: Card; saved: boolean; variant?: "full" | "compact" | "list"; priceLabel?: string; showCollection?: boolean;
}) {
  const href = `/product/${p.code}`;
  const label = `Product photo · ${p.category_name}`;
  if (variant === "list") {
    return (
      <article className="card relative flex gap-4 overflow-hidden p-3 sm:gap-6">
        <Link href={href} className="block aspect-square w-28 shrink-0 overflow-hidden rounded sm:w-40" tabIndex={-1} aria-hidden="true">
          <Photo mediaId={p.cover_media_id} alt={p.name} label="" tint={tintFor(p.code)} iconSize={32} />
        </Link>
        <div className="min-w-0 flex-1 py-1">
          <h3 className="font-sans text-[16px] font-semibold text-espresso"><Link href={href} className="hover:text-burgundy">{p.name}</Link></h3>
          {showCollection && p.collection_name ? <p className="text-[13px] text-muted">From the {p.collection_name}</p> : null}
          <p className="text-[13px] text-muted">{metalLabel(p.metal, p.karat, p.silver_purity)} · {formatWeight(p.weight_g)} (approx.)</p>
          {p.description ? <p className="mt-1 line-clamp-2 text-[14px] text-muted">{p.description}</p> : null}
          <p className="mt-2"><span className="text-[18px] font-semibold text-wine">{formatINR(p.estimated_price)}</span> <span className="text-[12.5px] text-muted">{priceLabel}</span></p>
        </div>
        <div className="flex flex-col items-end justify-between gap-2">
          <SaveButton productId={p.id} productName={p.name} initialSaved={saved} />
          <Link href={href} className="btn btn-outline btn-sm">View Details</Link>
        </div>
      </article>
    );
  }
  return (
    <article className="card relative flex flex-col overflow-hidden">
      <div className="absolute right-3 top-3 z-10">
        <SaveButton productId={p.id} productName={p.name} initialSaved={saved} />
      </div>
      <Link href={href} className="block aspect-square overflow-hidden" tabIndex={-1} aria-hidden="true">
        <Photo mediaId={p.cover_media_id} alt={p.name} label={variant === "compact" ? "Product photo" : label} tint={tintFor(p.code)} />
      </Link>
      <div className="flex flex-1 flex-col bg-white p-3 sm:p-4">
        <h3 className="font-sans text-[15px] font-semibold leading-snug text-espresso sm:text-[16px]">
          <Link href={href} className="hover:text-burgundy">{p.name}</Link>
        </h3>
        {variant === "full" ? (
          <>
            {showCollection && p.collection_name ? <p className="mt-1 hidden text-[13px] text-muted sm:block">From the {p.collection_name}</p> : null}
            <p className="mt-1 text-[12.5px] text-muted sm:text-[13px]">{metalLabel(p.metal, p.karat, p.silver_purity)} · {formatWeight(p.weight_g)} (approx.)</p>
          </>
        ) : null}
        <p className="mt-2 sm:mt-3">
          <span className="text-[17px] font-semibold text-wine sm:text-[18px]">{formatINR(p.estimated_price)}</span>{" "}
          <span className="text-[12px] text-muted">{p.estimated_price === null ? "Price on request" : priceLabel}</span>
        </p>
        {variant === "full" ? (
          <div className="mt-auto pt-4">
            <Link href={href} className="btn btn-outline btn-sm w-full sm:w-auto">View Details</Link>
          </div>
        ) : null}
      </div>
    </article>
  );
}
