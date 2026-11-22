"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { derivedRates, estimatePrice, type MakingType } from "@/lib/pricing";
import { formatINR, formatWeight } from "@/lib/format";
import { saveRates } from "@/app/actions/admin";

type P = { id: string; code: string; name: string; metal: string; karat: number | null; weight_g: number; making_type: string; making_value: number; stone_value: number };

export function RatesForm({ current, lastUpdated, products }: { current: { gold22: number; silverKg: number; gst: number } | null; lastUpdated: string; products: P[] }) {
  const router = useRouter();
  const [gold, setGold] = useState(current ? String(current.gold22) : "");
  const [silver, setSilver] = useState(current ? String(current.silverKg) : "");
  const [gst, setGst] = useState(current ? String(current.gst) : "3");
  const [pid, setPid] = useState(products[0]?.id ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const rates = useMemo(() => (Number(gold) > 0 && Number(silver) > 0 && gst !== "" ? { gold22Per10g: Number(gold), silverPerKg: Number(silver), gstPercent: Number(gst) } : null), [gold, silver, gst]);
  const d = rates ? derivedRates(rates) : null;
  const p = products.find((x) => x.id === pid);
  const est = useMemo(() => (p && rates ? estimatePrice({ metal: p.metal as "gold" | "silver", karat: p.karat, weightG: p.weight_g, makingType: p.making_type as MakingType, makingValue: p.making_value, stoneValue: p.stone_value }, rates) : null), [p, rates]);
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="space-y-5">
        <form className="admin-card p-5" onSubmit={(e) => { e.preventDefault(); setMsg(null); start(async () => { const r = await saveRates({ gold22_per_10g: gold, silver_per_kg: silver, gst_percent: gst }); setMsg(r.ok ? { ok: true, text: "Rates saved. Website prices updated." } : { ok: false, text: r.error }); if (r.ok) router.refresh(); }); }} noValidate>
          <h2 className="text-[28px]">Today&apos;s rates</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="r-gold" className="label">22K gold — price per 10 g (₹) <span className="text-error">*</span></label><input id="r-gold" className="input" inputMode="decimal" value={gold} onChange={(e) => setGold(e.target.value)} /></div>
            <div><label htmlFor="r-silver" className="label">Silver — price per 1 kg (₹) <span className="text-error">*</span></label><input id="r-silver" className="input" inputMode="decimal" value={silver} onChange={(e) => setSilver(e.target.value)} /></div>
          </div>
          <div className="mt-4 max-w-[220px]"><label htmlFor="r-gst" className="label">GST (%)</label><input id="r-gst" className="input" inputMode="decimal" value={gst} onChange={(e) => setGst(e.target.value)} /><p className="hint">Applied to metal + making + stones</p></div>
          <button type="submit" className="btn btn-primary mt-4" disabled={pending} aria-busy={pending}>{pending ? "Saving…" : "Save & update prices"}</button>
          <p className="hint mt-2">{lastUpdated}</p>
          {msg ? <p role={msg.ok ? "status" : "alert"} className={`mt-3 rounded px-3 py-2 text-[14px] ${msg.ok ? "bg-ok-bg text-ok-ink" : "bg-cancel-bg text-cancel-ink"}`}>{msg.text}</p> : null}
        </form>
        <section className="admin-card p-5" aria-labelledby="calc">
          <h2 id="calc" className="text-[28px]">Calculated by the system</h2>
          <p className="mt-1 text-[13px] text-muted">From the 22K rate: 24K = ×24/22, 18K = ×18/22. Silver is used as entered for all silver items.</p>
          {d ? (
            <dl className="mt-3">
              {[["24K gold per gram", d.gold24PerG], ["22K gold per gram", d.gold22PerG], ["18K gold per gram", d.gold18PerG], ["24K gold per 10 g", d.gold24Per10g], ["Silver per gram", d.silverPerG]].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-line py-2.5 last:border-0"><dt className="text-muted">{k}</dt><dd className="font-medium">{formatINR(v as number)}</dd></div>
              ))}
            </dl>
          ) : <p className="mt-3 text-muted">Enter rates to see the per-gram values.</p>}
        </section>
      </div>
      <section className="admin-card self-start p-5" aria-labelledby="prev">
        <h2 id="prev" className="text-[28px]">Preview a product</h2>
        <label htmlFor="r-prod" className="sr-only">Product</label>
        <select id="r-prod" className="input mt-3" value={pid} onChange={(e) => setPid(e.target.value)}>
          {products.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.code}</option>)}
        </select>
        {p && est ? (
          <>
            <dl className="mt-3 text-[15px]">
              <div className="flex justify-between border-b border-line py-2.5"><dt className="text-muted">{p.metal === "gold" ? `Gold ${p.karat}K` : "Silver"} · {formatWeight(p.weight_g)} × {formatINR(est.ratePerG)}</dt><dd>{formatINR(est.metalValue)}</dd></div>
              <div className="flex justify-between border-b border-line py-2.5"><dt className="text-muted">Making charges</dt><dd>{formatINR(est.makingAmount)}</dd></div>
              <div className="flex justify-between border-b border-line py-2.5"><dt className="text-muted">Stone value</dt><dd>{formatINR(est.stoneAmount)}</dd></div>
              <div className="flex justify-between py-2.5"><dt className="text-muted">GST ({gst}%)</dt><dd>{formatINR(est.gstAmount)}</dd></div>
            </dl>
            <div className="mt-3 rounded-md bg-price-bg p-4"><p className="text-[13px] text-muted">Estimated price with the rates above</p><p className="text-[30px] font-semibold">{formatINR(est.total)}</p></div>
          </>
        ) : <p className="mt-3 text-muted">{products.length ? "Enter valid rates to preview." : "Add a product to preview prices."}</p>}
      </section>
    </div>
  );
}
