import Link from "next/link";
import { Icon } from "./Icon";

export function Logo({ name, tagline, light = false, href = "/" }: { name: string; tagline: string; light?: boolean; href?: string }) {
  return (
    <Link href={href} className="inline-flex flex-col items-center leading-none" aria-label={`${name} — home`}>
      <Icon name="lotus-logo" size={30} className={`h-[20px] w-[28px] lg:h-[24px] lg:w-[34px] ${light ? "text-white" : "text-burgundy"}`} />
      <span className={`font-display text-[23px] font-bold leading-[1.05] lg:text-[27px] ${light ? "text-white" : "text-wine"}`}>{name}</span>
      <span className={`mt-0.5 text-[9px] tracking-[0.3em] uppercase ${light ? "text-white/80" : "text-muted"}`}>{tagline}</span>
    </Link>
  );
}
