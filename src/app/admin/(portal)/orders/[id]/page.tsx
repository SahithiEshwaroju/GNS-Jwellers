import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { OrderActions } from "@/components/admin/OrderActions";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/status";

export const metadata = { title: "Order" };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: o }, { data: items }] = await Promise.all([
    supabase.from("orders").select("*, enquiries(ref)").eq("id", id).maybeSingle(),
    supabase.from("order_items").select("*").eq("order_id", id).order("sort_order"),
  ]);
  if (!o) notFound();
  const enquiry = (o as unknown as { enquiries: { ref: string } | null }).enquiries;
  const rows: [string, string][] = [
    ["Order date", formatDate(o.order_date)], ["Expected delivery", formatDate(o.expected_delivery_date)], ["Customer", o.customer_name], ["Mobile", o.mobile],
    ["Email", o.email ?? "—"], ["Location", o.location ?? "—"], ["Address", o.address ?? "—"],
    ["Quoted", o.quoted_amount === null ? "—" : formatINR(o.quoted_amount)], ["Advance", o.advance_amount === null ? "—" : formatINR(o.advance_amount)],
    ["Balance", o.quoted_amount === null ? "—" : formatINR(Number(o.quoted_amount) - Number(o.advance_amount ?? 0))],
    ["From enquiry", enquiry?.ref ?? "—"], ["Created", formatDateTime(o.created_at)],
  ];
  return (
    <>
      <Link href="/admin/orders" className="mb-3 inline-flex text-[14px] text-burgundy">← Back to orders</Link>
      {sp.created ? <p role="status" className="mb-4 rounded bg-ok-bg px-4 py-2 text-ok-ink">Order confirmed. Order number <b>{sp.created}</b>.</p> : null}
      <PageHeader title={o.order_no} subtitle={o.subject} badge={<span className={`badge ${ORDER_STATUS[o.status]?.badge}`}>{ORDER_STATUS[o.status]?.label}</span>} />
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="admin-card p-5">
          <h2 className="text-[26px]">Details</h2>
          <dl className="mt-3">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-line py-2.5 last:border-0"><dt className="text-muted">{k}</dt><dd className="whitespace-pre-line text-right">{v}</dd></div>)}</dl>
        </section>
        <div className="space-y-5">
          <section className="admin-card p-5">
            <h2 className="text-[26px]">Products</h2>
            <ul className="mt-3 divide-y divide-line">
              {(items ?? []).map((i) => (
                <li key={i.id} className="py-3">
                  <p><b>{i.quantity} × {i.product_id ? <Link href={`/admin/products/${i.product_id}`} className="text-burgundy hover:underline">{i.product_name}</Link> : i.product_name}</b>{i.product_code ? <span className="text-muted"> · {i.product_code}</span> : <span className="text-muted"> · manual entry</span>}</p>
                  {i.details ? <p className="text-[14px] text-muted">{i.details}</p> : null}
                </li>
              ))}
            </ul>
          </section>
          <OrderActions id={o.id} status={o.status} notes={o.notes ?? ""} delivery={o.expected_delivery_date} />
        </div>
      </div>
    </>
  );
}
