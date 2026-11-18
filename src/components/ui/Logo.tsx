import Link from "next/link";
import { Icon } from "./Icon";

export function Logo({ name, tagline, light = false, href = "/" }: { name: string; tagline: string; light?: boolean; href?: string }) {
  return (
    <Link href={href} className="inline-flex flex-col items-center leading-none" aria-label={`${name} — home`}>
      <Icon name="lotus-logo" size={30} className={light ? "text-white" : "text-burgundy"} />
      <span className={`font-display text-[24px] font-bold sm:text-[27px] ${light ? "text-white" : "text-wine"}`}>{name}</span>
      <span className={`mt-1 text-[9.5px] tracking-[0.3em] uppercase ${light ? "text-white/80" : "text-muted"}`}>{tagline}</span>
    </Link>
  );
}
