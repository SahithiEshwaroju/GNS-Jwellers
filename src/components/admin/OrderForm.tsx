"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { formatDate, formatINR } from "@/lib/format";
import { confirmOrder, searchProductsForOrder } from "@/app/actions/admin";
import { orderSchema, firstError } from "@/lib/validation";

type Line = { product_id?: string; product_code?: string; product_name: string; details: string; quantity: number };
type Prefill = { enquiryId: string; enquiryRef: string; customer_name: string; mobile: string; email: string; items: Line[] };

export function OrderForm({ today, prefill }: { today: string; prefill?: Prefill }) {
  const router = useRouter();
  const [o, setO] = useState({
    subject: "", order_date: today, expected_delivery_date: "", customer_name: prefill?.customer_name ?? "", mobile: prefill?.mobile ?? "",
    email: prefill?.email ?? "", location: "", address: "", quoted_amount: "", advance_amount: "", notes: "",
  });
  const [items, setItems] = useState<Line[]>(prefill?.items ?? []);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; code: string; name: string; price: number | null }[] | null>(null);
  const [manual, setManual] = useState({ product_name: "", details: "" });
  const [review, setReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof o, v: string) => setO({ ...o, [k]: v });
  const payload = () => ({ ...o, enquiry_id: prefill?.enquiryId ?? "", items });

  const field = (k: keyof typeof o, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, req = false) => (
    <div>
      <label htmlFor={`o-${k}`} className="label">{label}{req ? <span className="text-error"> *</span> : null}</label>
      <input id={`o-${k}`} className="input" value={o[k]} onChange={(e) => set(k, e.target.value)} {...props} />
    </div>
  );

  if (review) {
    return (
      <div className="admin-card max-w-3xl p-6">
        <h2 className="text-[28px]">Review order</h2>
        <dl className="mt-4 grid gap-x-8 sm:grid-cols-2">
          {[["Subject", o.subject], ["Order date", formatDate(o.order_date)], ["Expected delivery", formatDate(o.expected_delivery_date)], ["Customer", o.customer_name], ["Mobile", o.mobile], ["Email", o.email || "—"], ["Location", o.location || "—"], ["Address", o.address || "—"], ["Quoted", o.quoted_amount ? formatINR(Number(o.quoted_amount)) : "—"], ["Advance", o.advance_amount ? formatINR(Number(o.advance_amount)) : "—"]].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-line py-2"><dt className="text-muted">{k}</dt><dd className="text-right">{v}</dd></div>
          ))}
        </dl>
        <h3 className="mt-5 font-sans text-[16px] font-semibold text-espresso">Products</h3>
        <ul className="mt-2 list-disc pl-5">{items.map((i, n) => <li key={n}>{i.quantity} × {i.product_name}{i.product_code ? ` (${i.product_code})` : ""}{i.details ? ` — ${i.details}` : ""}</li>)}</ul>
        {o.notes ? <p className="mt-3 text-[14px]"><b>Notes:</b> {o.notes}</p> : null}
        {error ? <p role="alert" className="mt-4 rounded bg-cancel-bg px-3 py-2 text-[14px] text-cancel-ink">{error}</p> : null}
        <div className="mt-6 flex gap-3">
          <button type="button" className="btn btn-outline" onClick={() => setReview(false)}>Edit</button>
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => start(async () => {
            const r = await confirmOrder(payload());
            if (!r.ok) return setError(r.error);
            router.push(`/admin/orders/${r.data.id}?created=${encodeURIComponent(r.data.orderNo)}`);
          })}>{pending ? "Confirming…" : "Confirm order"}</button>
        </div>
      </div>
    );
  }

  return (
    <form className="grid gap-5 xl:grid-cols-2" noValidate onSubmit={(e) => {
      e.preventDefault();
      const s = orderSchema.safeParse(payload());
      if (!s.success) return setError(firstError(s.error));
      setError(null);
      setReview(true);
    }}>
      <div className="space-y-5">
        {prefill ? <p className="rounded bg-note-bg px-4 py-2 text-[14px]">From enquiry {prefill.enquiryRef}. Confirming marks it &ldquo;Converted to order&rdquo;.</p> : null}
        {error ? <p role="alert" className="rounded bg-cancel-bg px-4 py-2 text-[14px] text-cancel-ink">{error}</p> : null}
        <section className="admin-card space-y-4 p-5">
          <h2 className="text-[26px]">Order</h2>
          {field("subject", "Order subject / title", { maxLength: 160, placeholder: "e.g. Floral ring – resize to 14" }, true)}
          <div className="grid gap-4 sm:grid-cols-2">
            {field("order_date", "Order received on", { type: "date" }, true)}
            {field("expected_delivery_date", "Expected delivery", { type: "date", min: o.order_date }, true)}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("quoted_amount", "Quoted amount (₹, optional)", { inputMode: "decimal" })}
            {field("advance_amount", "Advance received (₹, optional)", { inputMode: "decimal" })}
          </div>
          <div><label htmlFor="o-notes" className="label">Notes</label><textarea id="o-notes" className="input" rows={2} maxLength={2000} value={o.notes} onChange={(e) => set("notes", e.target.value)} /></div>
        </section>
        <section className="admin-card space-y-4 p-5">
          <h2 className="text-[26px]">Customer</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("customer_name", "Customer name", { maxLength: 80, autoComplete: "off" }, true)}
            {field("mobile", "Mobile number", { inputMode: "tel", maxLength: 14 }, true)}
            {field("email", "Email (optional)", { type: "email", maxLength: 254 })}
            {field("location", "Location", { maxLength: 120 })}
          </div>
          <div><label htmlFor="o-address" className="label">Address / delivery address</label><textarea id="o-address" className="input" rows={2} maxLength={500} value={o.address} onChange={(e) => set("address", e.target.value)} /></div>
        </section>
      </div>
      <div className="space-y-5">
        <section className="admin-card p-5">
          <h2 className="text-[26px]">Products <span className="text-error">*</span></h2>
          {items.length ? (
            <ul className="mt-3 space-y-2">
              {items.map((i, n) => (
                <li key={n} className="rounded border border-line bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p><b>{i.product_name}</b>{i.product_code ? <span className="text-muted"> · {i.product_code}</span> : <span className="text-muted"> · manual entry</span>}</p>
                    <button type="button" className="grid h-9 w-9 place-items-center text-danger" aria-label={`Remove ${i.product_name}`} onClick={() => setItems(items.filter((_, j) => j !== n))}><Icon name="trash" size={16} /></button>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_90px]">
                    <input className="input h-10 min-h-0" aria-label={`Details for ${i.product_name}`} placeholder="Details (size, karat, changes…)" maxLength={1000} value={i.details} onChange={(e) => setItems(items.map((x, j) => (j === n ? { ...x, details: e.target.value } : x)))} />
                    <input className="input h-10 min-h-0" aria-label={`Quantity for ${i.product_name}`} type="number" min={1} max={100} value={i.quantity} onChange={(e) => setItems(items.map((x, j) => (j === n ? { ...x, quantity: Number(e.target.value) || 1 } : x)))} />
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-[14px] text-muted">Add from the catalogue or enter a product manually.</p>}
          <h3 className="mt-5 font-sans text-[15px] font-semibold text-espresso">Select from catalogue</h3>
          <div className="mt-2 flex gap-2">
            <label htmlFor="o-search" className="sr-only">Search catalogue by name or product number</label>
            <input id="o-search" className="input" placeholder="Search by name or product number" value={q} maxLength={60} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); start(async () => { const r = await searchProductsForOrder(q); setResults(r.ok ? r.data : []); }); } }} />
            <button type="button" className="btn btn-outline" onClick={() => start(async () => { const r = await searchProductsForOrder(q); setResults(r.ok ? r.data : []); })}>Search</button>
          </div>
          {results ? (
            results.length ? (
              <ul className="mt-2 max-h-64 overflow-y-auto rounded border border-line bg-white">
                {results.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 last:border-0">
                    <span><b className="font-medium">{r.name}</b> <span className="text-[13px] text-muted">{r.code} · {formatINR(r.price)}</span></span>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setItems([...items, { product_id: r.id, product_code: r.code, product_name: r.name, details: "", quantity: 1 }])}>Add</button>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-[14px] text-muted">No products found.</p>
          ) : null}
          <h3 className="mt-5 font-sans text-[15px] font-semibold text-espresso">Or enter manually</h3>
          <div className="mt-2 grid gap-2">
            <label htmlFor="m-name" className="sr-only">Manual product name</label>
            <input id="m-name" className="input" placeholder="Product name, e.g. Plain silver kada" maxLength={160} value={manual.product_name} onChange={(e) => setManual({ ...manual, product_name: e.target.value })} />
            <label htmlFor="m-det" className="sr-only">Manual product details</label>
            <input id="m-det" className="input" placeholder="Details" maxLength={1000} value={manual.details} onChange={(e) => setManual({ ...manual, details: e.target.value })} />
            <button type="button" className="btn btn-outline" disabled={!manual.product_name.trim()} onClick={() => { setItems([...items, { ...manual, quantity: 1 }]); setManual({ product_name: "", details: "" }); }}>Add manual product</button>
          </div>
        </section>
        <button type="submit" className="btn btn-primary w-full">Review order</button>
      </div>
    </form>
  );
}
