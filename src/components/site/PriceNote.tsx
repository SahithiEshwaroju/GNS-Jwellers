import { Icon } from "@/components/ui/Icon";
import { formatDateTime } from "@/lib/format";

export function PriceNote({ updatedAt, shopName, compact = false }: { updatedAt: string | null; shopName: string; compact?: boolean }) {
  return (
    <div className={`flex items-start gap-3 rounded-md border border-line ${compact ? "border-l-4 border-l-antique-gold bg-note-bg" : "bg-card"} px-4 py-3 text-[13.5px] text-muted sm:text-[14px]`}>
      <Icon name="info-circle" size={18} className="mt-0.5 shrink-0 text-muted" />
      <p>
        {updatedAt ? <>Approximate prices based on reference rates updated {formatDateTime(updatedAt)}. </> : <>Prices are approximate. </>}
        Final price will be confirmed by the {shopName} team.
      </p>
    </div>
  );
}
