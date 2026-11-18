"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";

export function MobileMenu({ categories }: { categories: { name: string; slug: string }[] }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);
  const link = "block border-b border-line px-3 py-3 text-[16px]";
  return (
    <>
      <button type="button" className="grid h-11 w-11 place-items-center" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(!open)}>
        <Icon name={open ? "close-x" : "menu-hamburger"} size={22} />
      </button>
      {open ? (
        <div id="mobile-menu" className="fixed inset-x-0 bottom-0 top-16 z-50 overflow-y-auto bg-card px-5 pb-10 pt-4 shadow-[var(--shadow-panel)]">
          <form action="/jewellery" role="search" className="relative mb-2">
            <label htmlFor="m-search" className="sr-only">Search jewellery</label>
            <input id="m-search" name="q" type="search" placeholder="Search jewellery..." className="input pr-11" maxLength={80} />
            <button type="submit" className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center" aria-label="Search"><Icon name="search" /></button>
          </form>
          <nav aria-label="Mobile">
            <Link href="/" className={link}>Home</Link>
            <Link href="/collections" className={link}>Collections</Link>
            <Link href="/jewellery" className={link}>All Jewellery</Link>
            {categories.map((c) => (
              <Link key={c.slug} href={`/jewellery?category=${c.slug}`} className={`${link} pl-7`}>{c.name}</Link>
            ))}
            <Link href="/custom-jewellery" className={link}>Custom Jewellery</Link>
            <Link href="/about" className={link}>About Us</Link>
            <Link href="/saved" className={link}>Saved designs</Link>
          </nav>
        </div>
      ) : null}
    </>
  );
}
