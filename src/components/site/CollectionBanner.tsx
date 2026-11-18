import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Photo } from "@/components/ui/Photo";
import type { CollectionWithCount } from "@/lib/data/site";

export function CollectionBanner({ c, showCount = false, tall = false }: { c: CollectionWithCount; showCount?: boolean; tall?: boolean }) {
  return (
    <Link
      href={`/collections/${c.slug}`}
      className={`group grid overflow-hidden rounded-md text-white md:grid-cols-2 ${tall ? "md:min-h-[300px]" : "md:min-h-[230px]"}`}
      style={{ backgroundColor: c.theme_color }}
    >
      <div className="order-2 flex flex-col justify-center p-6 md:order-1 md:p-9">
        <h2 className="font-display text-[34px] font-bold leading-[1.05] text-white sm:text-[40px]">{c.name}</h2>
        {c.description ? <p className="mt-2 text-[15px] text-white/90">{c.description}</p> : null}
        <span className="mt-5 inline-flex items-center gap-2 text-[15px] font-medium group-hover:underline">
          {showCount ? `${c.productCount} ${c.productCount === 1 ? "design" : "designs"} · ` : ""}Explore{showCount ? "" : " Now"} <Icon name="arrow-right" size={16} />
        </span>
      </div>
      <div className="order-1 aspect-[16/9] bg-black/10 md:order-2 md:aspect-auto">
        <Photo mediaId={c.image_media_id} alt={c.name} label="" dark iconSize={40} />
      </div>
    </Link>
  );
}
