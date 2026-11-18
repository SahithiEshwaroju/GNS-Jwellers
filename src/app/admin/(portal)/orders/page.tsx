import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatINR } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/status";

export const metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; cancelled?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  let q = supabase.from("orders").select("id, order_no, subject, customer_name, mobile, order_date, expected_delivery_date, quoted_amount, advance_amount, status, order_items(product_name, product_code, sort_order)").order("created_at", { ascending: false }).limit(500);
  if (sp.cancelled !== "1") q = q.neq("status", "cancelled");
  const { data } = await q;
  type O = NonNullable<typeof data>[number] & { order_items: { product_name: string; product_code: string | null; sort_order: number }[] };
  const term = (sp.q ?? "").trim().toLowerCase();
  const rows = ((data ?? []) as O[]).filter((o) =>
    !term || [o.order_no, o.subject, o.customer_name, o.mobile, ...o.order_items.flatMap((i) => [i.product_name, i.product_code ?? ""])].some((v) => v.toLowerCase().includes(term)),
  );
  return (
    <>
      <PageHeader title="Orders" subtitle="Internal order records — not visible to customers." actions={<Link href="/admin/orders/new" className="btn btn-primary">+ Create New Order</Link>} />
      <form className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center" role="search">
        <label htmlFor="oq" className="sr-only">Search orders</label>
        <input id="oq" name="q" defaultValue={sp.q} className="input sm:max-w-sm" placeholder="Search order no., customer, mobile, product..." maxLength={60} />
        <label className="flex items-center gap-2"><input type="checkbox" name="cancelled" value="1" defaultChecked={sp.cancelled === "1"} className="h-[18px] w-[18px] accent-burgundy" /> Show cancelled</label>
        <button className="btn btn-outline" type="submit">Apply</button>
      </form>
      {rows.length ? (
        <div className="admin-card overflow-x-auto">
          <table className="table min-w-[980px]">
            <thead><tr><th>Order no.</th><th>Subject</th><th>Customer</th><th>Product</th><th>Order date</th><th>Delivery</th><th>Quoted</th><th>Balance</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/admin/orders/${o.id}`} className="font-semibold text-burgundy hover:underline">{o.order_no}</Link></td>
                  <td>{o.subject}</td>
                  <td>{o.customer_name}<span className="block text-[13px] text-muted">{o.mobile}</span></td>
                  <td>{o.order_items.sort((a, b) => a.sort_order - b.sort_order).map((i) => `${i.product_name}${i.product_code ? ` (${i.product_code})` : ""}`).join(", ")}</td>
                  <td className="text-[13px]">{formatDate(o.order_date)}</td>
                  <td>{formatDate(o.expected_delivery_date)}</td>
                  <td>{o.quoted_amount === null ? "—" : formatINR(o.quoted_amount)}</td>
                  <td>{o.quoted_amount === null ? "—" : formatINR(Number(o.quoted_amount) - Number(o.advance_amount ?? 0))}</td>
                  <td><span className={`badge ${ORDER_STATUS[o.status]?.badge}`}>{ORDER_STATUS[o.status]?.label}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="admin-card p-10 text-center text-muted">{term ? "No orders match your search." : "No orders yet."} <Link href="/admin/orders/new" className="text-burgundy underline">Create an order</Link>.</div>}
    </>
  );
}
