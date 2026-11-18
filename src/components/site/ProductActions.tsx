"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { EnquiryBuilder, type EnquiryItem } from "./EnquiryBuilder";
import { recordProductView } from "@/app/actions/public";

/** Customisation pills + enquiry buttons for the product page. */
export function ProductActions({ item, metal, karat }: { item: EnquiryItem; metal: "gold" | "silver"; karat: number | null }) {
  const [m, setM] = useState<"gold" | "silver">(metal);
  const [k, setK] = useState<string>(karat ? `${karat}K` : "22K");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const key = `viewed:${item.code}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* storage blocked: still count once per load */
    }
    void recordProductView(item.code);
  }, [item.code]);

  const changed: Record<string, string> = {};
  if (m !== metal) changed.Metal = m === "gold" ? "Gold" : "Silver";
  if (m === "gold" && (metal !== "gold" || `${karat}K` !== k)) changed.Karat = k;

  return (
    <>
      <div className="card mt-5 bg-white p-4 sm:p-5">
        <h2 className="font-sans text-[16px] font-semibold text-espresso">Want this design customised?</h2>
        <p className="mt-1 text-[14px] text-muted">This piece is made as listed below. Pick any changes you&apos;d like and they&apos;ll be added to your enquiry — the shop will confirm feasibility and price.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3" role="radiogroup" aria-label="Metal">
          <span className="w-14 text-[15px]">Metal</span>
          {(["gold", "silver"] as const).map((x) => (
            <button key={x} type="button" role="radio" aria-checked={m === x} className="pill" onClick={() => setM(x)}>{x === "gold" ? "Gold" : "Silver"}</button>
          ))}
        </div>
        {m === "gold" ? (
          <div className="mt-3 flex flex-wrap items-center gap-3" role="radiogroup" aria-label="Karat">
            <span className="w-14 text-[15px]">Karat</span>
            {["18K", "22K", "24K"].map((x) => (
              <button key={x} type="button" role="radio" aria-checked={k === x} className="pill" onClick={() => setK(x)}>{x}</button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><Icon name="message-square" /> Enquire Now</button>
        <button type="button" className="btn btn-outline" onClick={() => setOpen(true)}><Icon name="whatsapp-bubble" /> Enquire on WhatsApp</button>
      </div>
      <EnquiryBuilder open={open} onClose={() => setOpen(false)} items={[item]} source="product" customisation={changed} />
    </>
  );
}
