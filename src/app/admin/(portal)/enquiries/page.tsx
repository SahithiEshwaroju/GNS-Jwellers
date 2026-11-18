import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { EnquiryDetail } from "@/components/admin/EnquiryDetail";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { ENQUIRY_STATUS } from "@/lib/status";
import { geminiConfigured } from "@/lib/server-env";

export const metadata = { title: "Enquiries" };

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<{ status?: string; id?: string }> }) {
  const sp = await searchParams;
  const status = sp.status && ENQUIRY_STATUS[sp.status] ? sp.status : undefined;
  const supabase = await createClient();
  const [{ data: all }, listRes] = await Promise.all([
    supabase.from("enquiries").select("status"),
    (() => {
      let q = supabase.from("enquiries").select("id, ref, customer_name, mobile, status, created_at, source, enquiry_items(product_name, sort_order)").order("created_at", { ascending: false }).limit(200);
      if (status) q = q.eq("status", status);
      return q;
    })(),
  ]);
  const list = (listRes.data ?? []) as unknown as { id: string; ref: string; customer_name: string; mobile: string; status: string; created_at: string; source: string; enquiry_items: { product_name: string; sort_order: number }[] }[];
  const selectedId = sp.id && /^[0-9a-f-]{36}$/.test(sp.id) ? sp.id : list[0]?.id;
  const [{ data: detail }, { data: items }] = selectedId
    ? await Promise.all([
        supabase.from("enquiries").select("*").eq("id", selectedId).maybeSingle(),
        supabase.from("enquiry_items").select("product_id, product_code, product_name, estimated_price").eq("enquiry_id", selectedId).order("sort_order"),
      ])
    : [{ data: null }, { data: [] }];
  const counts = (s: string) => (all ?? []).filter((e) => e.status === s).length;
  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ status, id: sp.id, ...patch }).filter(([, v]) => v) as [string, string][]);
    const s = p.toString();
    return `/admin/enquiries${s ? `?${s}` : ""}`;
  };
  return (
    <>
      <PageHeader title="Enquiries" subtitle={<>Enquiries started from the website. &ldquo;WhatsApp opened&rdquo; means the customer launched WhatsApp — not that the message was delivered.</>} />
      <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-line" aria-label="Status">
        <Link href={link({ status: undefined, id: undefined })} aria-current={!status ? "page" : undefined} className={`whitespace-nowrap px-3 py-3 ${!status ? "border-b-2 border-burgundy font-semibold text-wine" : "text-muted"}`}>All ({all?.length ?? 0})</Link>
        {Object.entries(ENQUIRY_STATUS).map(([k, v]) => (
          <Link key={k} href={link({ status: k, id: undefined })} aria-current={status === k ? "page" : undefined} className={`whitespace-nowrap px-3 py-3 ${status === k ? "border-b-2 border-burgundy font-semibold text-wine" : "text-muted"}`}>{v.label} ({counts(k)})</Link>
        ))}
      </nav>
      {list.length ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="admin-card overflow-x-auto">
            <table className="table min-w-[560px]">
              <thead><tr><th>Ref</th><th>Customer</th><th>Product(s)</th><th>Date</th><th>Status</th></tr></thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.id} className={e.id === selectedId ? "bg-rose-tint-2" : ""}>
                    <td><Link href={link({ id: e.id })} className="font-medium text-burgundy hover:underline" aria-current={e.id === selectedId ? "true" : undefined}>{e.ref}</Link></td>
                    <td>{e.customer_name}<span className="block text-[13px] text-muted">{e.mobile}</span></td>
                    <td>{e.source === "custom" ? "Custom design" : e.enquiry_items.sort((a, b) => a.sort_order - b.sort_order).map((i) => i.product_name).join(", ")}</td>
                    <td className="text-[13px]">{formatDate(e.created_at)}</td>
                    <td><span className={`badge ${ENQUIRY_STATUS[e.status]?.badge}`}>{ENQUIRY_STATUS[e.status]?.label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {detail ? (
            <EnquiryDetail
              key={detail.id + detail.updated_at}
              enquiry={detail}
              items={(items ?? []).map((i) => ({ ...i, estimated_price: i.estimated_price === null ? null : Number(i.estimated_price) }))}
              aiReady={geminiConfigured()}
            />
          ) : null}
        </div>
      ) : (
        <div className="admin-card p-10 text-center text-muted">No enquiries {status ? "with this status" : "yet"}. Enquiries appear here when customers use &ldquo;Enquire Now&rdquo; on the website.</div>
      )}
    </>
  );
}
