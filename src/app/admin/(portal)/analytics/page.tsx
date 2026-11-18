import { PageHeader } from "@/components/admin/PageHeader";
import { PeriodSelect } from "@/components/admin/PeriodSelect";
import { getAnalytics } from "@/lib/data/admin";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days: d } = await searchParams;
  const days = [7, 30, 90].includes(Number(d)) ? Number(d) : 7;
  const a = await getAnalytics(days);
  const maxCat = Math.max(1, ...a.category_views.map((c) => c.views));
  const stats: [string, number, string][] = [
    ["Product views", a.product_views, "All product pages"],
    ["Enquiry initiations", a.enquiry_initiations, "WhatsApp opened from site"],
    ["Enquiries → orders", a.enquiries_converted, "Marked “Converted to order”"],
    ["Registered customers", a.registered_customers, "Google sign-ins (for saving)"],
  ];
  return (
    <>
      <PageHeader title="Analytics" subtitle="How customers use the website." actions={<PeriodSelect value={days} />} />
      <ul className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map(([k, v, s]) => <li key={k} className="admin-card p-5"><p className="text-[14px] text-muted">{k}</p><p className="mt-2 text-[30px] font-semibold">{v.toLocaleString("en-IN")}</p><p className="text-[13px] text-muted">{s}</p></li>)}
      </ul>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="admin-card p-5" aria-labelledby="pc">
          <h2 id="pc" className="text-[28px]">Popular categories (product views)</h2>
          <ul className="mt-4 space-y-3">
            {a.category_views.map((c) => (
              <li key={c.name} className="grid grid-cols-[110px_1fr_48px] items-center gap-3 text-[14.5px]">
                <span>{c.name}</span>
                <span className="h-2.5 rounded-full bg-[#ede3d4]" aria-hidden="true"><span className="block h-2.5 rounded-full bg-burgundy" style={{ width: `${(c.views / maxCat) * 100}%` }} /></span>
                <span className="text-right text-[13px] text-muted">{c.views}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="admin-card p-5" aria-labelledby="mv">
          <h2 id="mv" className="text-[28px]">Most viewed products</h2>
          {a.top_products.length ? (
            <ol className="mt-3">
              {a.top_products.map((p, i) => (
                <li key={p.id} className="flex items-center gap-4 border-b border-line py-3 last:border-0">
                  <span className="w-5 text-[13px] text-muted">{i + 1}</span><span className="flex-1">{p.name}</span>
                  <span className="text-[13px] text-muted">{p.views} views · {p.enquiries} enquiries</span>
                </li>
              ))}
            </ol>
          ) : <p className="mt-3 text-muted">No views in this period.</p>}
        </section>
      </div>
      <p className="mt-5 rounded-md border border-line bg-card px-4 py-3 text-[13.5px] text-muted">&ldquo;Enquiry initiations&rdquo; count customers who opened WhatsApp from the website. The website can&apos;t see whether the message was sent, delivered or read — confirmed conversations are tracked by changing enquiry status.</p>
    </>
  );
}
