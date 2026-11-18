"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrder } from "@/app/actions/admin";

export function OrderActions({ id, status, notes, delivery }: { id: string; status: string; notes: string; delivery: string }) {
  const router = useRouter();
  const [n, setN] = useState(notes);
  const [d, setD] = useState(delivery);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (patch: Parameters<typeof updateOrder>[1], text: string) =>
    start(async () => { const r = await updateOrder(id, patch); setMsg(r.ok ? { ok: true, text } : { ok: false, text: r.error }); router.refresh(); });
  return (
    <section className="admin-card space-y-4 p-5">
      <h2 className="text-[26px]">Update</h2>
      {msg ? <p role={msg.ok ? "status" : "alert"} className={`rounded px-3 py-2 text-[14px] ${msg.ok ? "bg-ok-bg text-ok-ink" : "bg-cancel-bg text-cancel-ink"}`}>{msg.text}</p> : null}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div><label htmlFor="od" className="label">Expected delivery</label><input id="od" type="date" className="input" value={d} onChange={(e) => setD(e.target.value)} /></div>
        <button type="button" className="btn btn-outline" disabled={pending} onClick={() => run({ expected_delivery_date: d }, "Delivery date updated.")}>Save date</button>
      </div>
      <div><label htmlFor="on" className="label">Notes</label><textarea id="on" className="input" rows={3} maxLength={2000} value={n} onChange={(e) => setN(e.target.value)} /></div>
      <button type="button" className="btn btn-outline" disabled={pending} onClick={() => run({ notes: n }, "Notes saved.")}>Save notes</button>
      <div className="flex flex-wrap gap-3 border-t border-line pt-4">
        {status !== "delivered" ? <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run({ status: "delivered" }, "Marked as delivered.")}>Mark delivered</button> : null}
        {status !== "confirmed" ? <button type="button" className="btn btn-outline" disabled={pending} onClick={() => run({ status: "confirmed" }, "Marked as confirmed.")}>Mark confirmed</button> : null}
        {status !== "cancelled" ? <button type="button" className="btn btn-danger" disabled={pending} onClick={() => run({ status: "cancelled" }, "Order cancelled.")}>Cancel order</button> : null}
      </div>
    </section>
  );
}
