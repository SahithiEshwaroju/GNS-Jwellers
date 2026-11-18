import { PageHeader } from "@/components/admin/PageHeader";
import { RatesForm } from "@/components/admin/RatesForm";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRates } from "@/lib/data/site";
import { formatDateTime, formatINR } from "@/lib/format";

export const metadata = { title: "Gold & Silver Rates" };

export default async function RatesPage() {
  const supabase = await createClient();
  const [rates, { data: history }, { data: products }] = await Promise.all([
    getCurrentRates(),
    supabase.rpc("admin_rate_history", { p_limit: 10 }),
    supabase.from("products").select("id, code, name, metal, karat, weight_g, making_type, making_value, stone_value").order("code"),
  ]);
  const latest = history?.[0];
  return (
    <>
      <PageHeader title="Gold & Silver Rates" subtitle="Enter today's rates. Every product price on the website recalculates from these." />
      <RatesForm
        current={rates ? { gold22: rates.gold22Per10g, silverKg: rates.silverPerKg, gst: rates.gstPercent } : null}
        lastUpdated={latest ? `Last updated ${formatDateTime(latest.created_at)}${latest.created_by_email ? ` by ${latest.created_by_email}` : ""}` : "No rates saved yet"}
        products={(products ?? []).map((p) => ({ ...p, weight_g: Number(p.weight_g), making_value: Number(p.making_value), stone_value: Number(p.stone_value) }))}
      />
      <section className="admin-card mt-5 p-5" aria-labelledby="hist">
        <h2 id="hist" className="text-[28px]">Rate history</h2>
        {history?.length ? (
          <ul className="mt-3">
            {history.map((h) => (
              <li key={h.id} className="flex flex-col justify-between gap-1 border-b border-line py-3 last:border-0 sm:flex-row">
                <span>22K {formatINR(h.gold22_per_10g)}/10 g · Silver {formatINR(h.silver_per_kg)}/kg · GST {Number(h.gst_percent)}% {h.is_sample ? <span className="badge badge-sample">Sample</span> : null}</span>
                <span className="text-[13px] text-muted">{formatDateTime(h.created_at)}{h.created_by_email ? ` · ${h.created_by_email}` : ""}</span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-muted">No history yet.</p>}
      </section>
    </>
  );
}
