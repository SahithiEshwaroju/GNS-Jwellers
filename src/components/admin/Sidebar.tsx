"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

const NAV: { href: string; label: string; icon: IconName; badge?: "enquiries" }[] = [
  { href: "/admin", label: "Dashboard", icon: "admin-dashboard" },
  { href: "/admin/products", label: "Products", icon: "admin-products" },
  { href: "/admin/extract", label: "AI Catalogue Extraction", icon: "admin-extract" },
  { href: "/admin/taxonomy", label: "Categories & Collections", icon: "admin-taxonomy" },
  { href: "/admin/rates", label: "Gold & Silver Rates", icon: "admin-rates" },
  { href: "/admin/enquiries", label: "Enquiries", icon: "admin-enquiries", badge: "enquiries" },
  { href: "/admin/orders", label: "Orders", icon: "admin-orders" },
  { href: "/admin/analytics", label: "Analytics", icon: "admin-analytics" },
  { href: "/admin/admins", label: "Admin Access", icon: "admin-admins" },
  { href: "/admin/images", label: "Images", icon: "admin-images" },
  { href: "/admin/content", label: "Site Content", icon: "admin-content" },
  { href: "/admin/backup", label: "Backup", icon: "download" },
  { href: "/admin/diagnostics", label: "System Check", icon: "info-circle" },
];

export function Sidebar({ email, newEnquiries, shopName }: { email: string; newEnquiries: number; shopName: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) {
    setLastPath(path);
    setOpen(false);
  }
  const active = (h: string) => (h === "/admin" ? path === "/admin" : path.startsWith(h));
  const nav = (
    <>
      <nav aria-label="Admin" className="flex-1">
        <ul className="space-y-1">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={active(n.href) ? "page" : undefined}
                className={`flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-[15px] leading-tight ${active(n.href) ? "bg-rose-tint font-semibold text-wine" : "text-white/90 hover:bg-white/10"}`}
              >
                <Icon name={n.icon} size={18} className="shrink-0" />
                <span className="flex-1">{n.label}</span>
                {n.badge && newEnquiries > 0 ? (
                  <span className="rounded-full bg-[#f3d9a8] px-2 text-[12px] font-semibold text-[#5c3a00]" aria-label={`${newEnquiries} new`}>{newEnquiries}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-6 space-y-3">
        <p className="break-all px-1 text-[13px] text-white/75">Signed in as<br />{email}</p>
        <Link href="/" className="btn w-full border-white/60 text-white hover:bg-white/10" style={{ borderWidth: 1 }}>
          <Icon name="arrow-left" size={16} /> Back to Website
        </Link>
        <form action="/auth/signout?to=admin" method="post">
          <button type="submit" className="w-full py-2 text-[14px] text-white/85 hover:text-white">Sign out</button>
        </form>
      </div>
    </>
  );
  const brand = (
    <Link href="/admin" className="flex items-center gap-3">
      <Icon name="lotus-logo" size={34} className="text-[#e8c9a0]" />
      <span>
        <span className="block font-display text-[24px] font-bold leading-none text-white">{shopName}</span>
        <span className="text-[12px] tracking-wide text-white/75">Admin Portal</span>
      </span>
    </Link>
  );
  return (
    <>
      <div className="hidden w-[231px] shrink-0 bg-[#3f0d0c] lg:block"><aside className="sticky top-0 flex h-screen flex-col overflow-y-auto px-3.5 py-6 text-white">
        <div className="mb-4 border-b border-white/15 px-2 pb-4">{brand}</div>
        {nav}
      </aside></div>
      <div className="sticky top-0 z-40 bg-[#3f0d0c] text-white lg:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          {brand}
          <button type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)} className="grid h-11 w-11 place-items-center">
            <Icon name={open ? "close-x" : "menu-hamburger"} size={22} />
          </button>
        </div>
        {open ? <div className="max-h-[calc(100vh-64px)] overflow-y-auto border-t border-white/15 px-3.5 pb-6 pt-3">{nav}</div> : null}
      </div>
    </>
  );
}
