"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { GoogleSignInButton } from "./GoogleSignInButton";

export function AccountMenu({ user, isAdmin }: { user: { name: string | null; email: string | null } | null; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
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
  return (
    <div ref={ref} className="relative">
      <button type="button" className="grid h-11 w-11 place-items-center hover:text-burgundy" aria-label="Account" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="user" size={20} />
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-72 rounded-[10px] border border-line bg-card p-4 shadow-[var(--shadow-panel)]">
          {user ? (
            <>
              <p className="text-[13px] text-muted">Signed in as</p>
              <p className="truncate font-medium">{user.name ?? user.email}</p>
              {user.name ? <p className="truncate text-[13px] text-muted">{user.email}</p> : null}
              <div className="mt-3 flex flex-col gap-1">
                <Link href="/saved" className="rounded px-2 py-2 hover:bg-rose-tint-2">Saved designs</Link>
                {isAdmin ? <Link href="/admin" className="rounded px-2 py-2 hover:bg-rose-tint-2">Admin portal</Link> : null}
                <form action="/auth/signout" method="post">
                  <button type="submit" className="w-full rounded px-2 py-2 text-left text-burgundy hover:bg-rose-tint-2">Sign out</button>
                </form>
              </div>
            </>
          ) : (
            <>
              <p className="font-display text-[22px] font-bold text-wine">Your account</p>
              <p className="mb-3 text-[13.5px] text-muted">Sign in to save designs. Browsing and enquiries never need an account.</p>
              <GoogleSignInButton next="/saved" className="w-full" />
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
