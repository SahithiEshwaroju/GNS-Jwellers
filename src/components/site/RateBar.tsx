import { getCurrentRates } from "@/lib/data/site";
import { derivedRates } from "@/lib/pricing";
import { formatDateTime, formatINR } from "@/lib/format";

export async function RateBar() {
  const rates = await getCurrentRates();
  if (!rates) {
    return (
      <div className="border-b border-line bg-champagne py-2 text-center text-[13px] text-muted">
        Reference rates will appear here once the shop updates them.
      </div>
    );
  }
  const d = derivedRates(rates);
  return (
    <div className="border-b border-line bg-champagne">
      <p className="wrap flex flex-wrap items-center justify-center gap-x-6 gap-y-1 py-2 text-center text-[12.5px] text-muted sm:text-[13.5px]">
        <span>Reference rates · 22K gold <b className="text-wine">{formatINR(d.gold22PerG)}/g</b></span>
        <span>18K gold <b className="text-wine">{formatINR(d.gold18PerG)}/g</b></span>
        <span>Silver <b className="text-wine">{formatINR(d.silverPerG)}/g</b></span>
        <span>Updated {formatDateTime(rates.updatedAt)}</span>
      </p>
    </div>
  );
}
