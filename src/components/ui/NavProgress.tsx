"use client";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Thin progress bar at the top of the page while a link navigation is loading. */
export function NavProgress() {
  const path = usePathname();
  const search = useSearchParams().toString();
  const loc = `${path}?${search}`;
  // The location a click started from. The bar is active until the location changes (no effect needed to reset it).
  const [from, setFrom] = useState<string | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const u = new URL(a.href, window.location.href);
      if (u.origin !== window.location.origin) return;
      if (u.pathname === window.location.pathname && u.search === window.location.search) return;
      setFrom(`${window.location.pathname}?${window.location.search.replace(/^\?/, "")}`);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setFrom(null), 10_000); // fail-safe if a navigation never completes
    };
    // Capture phase: runs before Next.js's <Link> handler, which calls preventDefault() for client-side navigation.
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.clearTimeout(timer);
    };
  }, []);

  return from === loc ? <div className="nav-progress" role="progressbar" aria-label="Loading page" /> : null;
}
