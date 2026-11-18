"use client";
import { useState } from "react";
import { ProductCard } from "./ProductCard";
import { EnquiryBuilder } from "./EnquiryBuilder";
import type { ProductCard as Card } from "@/lib/data/catalogue";

/** Saved designs with multi-select for a combined enquiry (REQ-016). */
export function SavedList({ items, userName }: { items: Card[]; userName: string }) {
  const [sel, setSel] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const chosen = items.filter((i) => sel.includes(i.code));
  return (
    <>
      <div className="mt-4 flex flex-col gap-3 rounded-md border border-line bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[15px]">Select designs to ask about them together in one WhatsApp message.</p>
        <div className="flex gap-2">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setSel(sel.length === items.length ? [] : items.map((i) => i.code))}>
            {sel.length === items.length ? "Clear selection" : "Select all"}
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled={!sel.length} onClick={() => setOpen(true)}>
            Enquire about {sel.length || ""} selected
          </button>
        </div>
      </div>
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {items.map((p) => (
          <li key={p.id} className="relative">
            <label className="absolute left-3 top-3 z-10 flex h-10 items-center gap-2 rounded-full bg-white/95 px-3 text-[13px] shadow-sm">
              <input type="checkbox" className="h-[18px] w-[18px] accent-burgundy" checked={sel.includes(p.code)} onChange={() => setSel((s) => (s.includes(p.code) ? s.filter((x) => x !== p.code) : [...s, p.code]))} />
              <span className="sr-only">Select {p.name}</span><span aria-hidden="true">Select</span>
            </label>
            <ProductCard p={p} saved />
          </li>
        ))}
      </ul>
      <EnquiryBuilder
        open={open}
        onClose={() => setOpen(false)}
        source={chosen.length > 1 ? "multi" : "product"}
        defaultName={userName}
        items={chosen.map((c) => ({ code: c.code, name: c.name, price: c.estimated_price === null ? null : Number(c.estimated_price), coverMediaId: c.cover_media_id }))}
      />
    </>
  );
}
