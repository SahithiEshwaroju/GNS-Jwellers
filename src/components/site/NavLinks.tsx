"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

type Cat = { name: string; slug: string };

export function NavLinks({ categories }: { categories: Cat[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) {
    setLastPath(path);
    setOpen(false);
  }
  useEffect(() => {
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  const active = (p: string) => (p === "/" ? path === "/" : path.startsWith(p));
  const cls = (on: boolean) =>
    `relative flex h-[68px] items-center px-3 text-[15px] ${on ? "text-burgundy after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-burgundy" : "text-espresso hover:text-burgundy"}`;
  return (
    <nav aria-label="Main" className="hidden items-center lg:flex">
      <Link href="/" className={cls(active("/"))} aria-current={active("/") ? "page" : undefined}>Home</Link>
      <Link href="/collections" className={cls(active("/collections"))}>Collections</Link>
      <div ref={ref} className="relative">
        <button
          type="button"
          className={cls(active("/jewellery") || active("/product"))}
          aria-expanded={open}
          aria-haspopup="true"
          onClick={() => setOpen((o) => !o)}
        >
          Jewellery <Icon name="chevron-down" size={14} className="ml-1" />
        </button>
        {open ? (
          <div className="absolute left-0 top-[calc(100%-6px)] z-50 w-60 rounded-[10px] border border-line bg-card p-3 shadow-[var(--shadow-panel)]">
            <Link href="/jewellery" className="block rounded px-3 py-2 font-display text-[19px] font-bold text-wine hover:bg-rose-tint-2">All Jewellery</Link>
            <ul>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/jewellery?category=${c.slug}`} className="block rounded px-3 py-2 hover:bg-rose-tint-2">{c.name}</Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <Link href="/custom-jewellery" className={cls(active("/custom-jewellery"))}>Custom Jewellery</Link>
      <Link href="/about" className={cls(active("/about"))}>About Us</Link>
    </nav>
  );
}
