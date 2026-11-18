import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Photo } from "@/components/ui/Photo";
import { PageHeader } from "@/components/admin/PageHeader";
import { LineChart } from "@/components/admin/LineChart";
import { getAnalytics } from "@/lib/data/admin";
import { getCurrentRates } from "@/lib/data/site";
import { formatDateTime, formatINR, formatRelativeShort } from "@/lib/format";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const [a, rates] = await Promise.all([getAnalytics(30), getCurrentRates()]);
  const stats: [IconName, number, string][] = [
    ["admin-products", a.total_products, "Total Products"],
    ["admin-admins", a.registered_customers, "Registered Customers"],
    ["admin-enquiries", a.enquiry_initiations, "Enquiry Initiations (30 days)"],
    ["admin-eye", a.product_views, "Product Views (30 days)"],
  ];
  return (
    <>
      <PageHeader
        title="Welcome back"
        subtitle="Here's what's happening with the website."
        actions={
          <>
            <Link href="/admin/extract" className="btn btn-outline">Import from catalogue (AI)</Link>
            <Link href="/admin/products/new" className="btn btn-primary">+ Add Product</Link>
          </>
        }
      />
      <ul className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map(([icon, n, label]) => (
          <li key={label} className="admin-card p-5">
            <Icon name={icon} size={24} className="text-wine" />
            <p className="mt-3 text-[30px] font-semibold leading-none text-espresso">{n.toLocaleString("en-IN")}</p>
            <p className="mt-2 text-[14px] text-muted">{label}</p>
          </li>
        ))}
      </ul>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="admin-card p-5" aria-labelledby="ch">
          <div className="flex items-center justify-between"><h2 id="ch" className="text-[28px]">Enquiry initiations</h2><span className="text-[13px] text-muted">Last 30 days</span></div>
          <div className="mt-3"><LineChart points={a.initiations_by_day} label="Enquiry initiations, last 30 days" /></div>
          <p className="mt-2 text-[13px] text-muted">Counts times customers opened WhatsApp from the site. Delivery of the message can&apos;t be confirmed.</p>
        </section>
        <section className="admin-card p-5" aria-labelledby="tv">
          <h2 id="tv" className="text-[28px]">Top viewed products</h2>
          {a.top_products.length ? (
            <ul className="mt-3">
              {a.top_products.slice(0, 4).map((p) => (
                <li key={p.id} className="border-b border-line last:border-0">
                  <Link href={`/admin/products/${p.id}`} className="flex items-center gap-4 py-3 hover:bg-rose-tint-2">
                    <span className="h-11 w-11 shrink-0 overflow-hidden rounded"><Photo mediaId={p.cover_media_id} alt="" label="" iconSize={18} /></span>
                    <span className="flex-1"><span className="block font-medium">{p.name}</span><span className="text-[13px] text-muted">{p.views} {p.views === 1 ? "view" : "views"} · {formatINR(p.estimated_price)}</span></span>
                    <Icon name="chevron-right" size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="mt-4 text-muted">No product views recorded in the last 30 days yet.</p>}
        </section>
        <section className="admin-card flex flex-col justify-center gap-5 bg-price-bg p-6 sm:flex-row sm:items-center" aria-label="Today's gold rate">
          <Icon name="diamond-outline" size={34} className="text-wine" />
          <div className="flex-1">
            <p className="text-[14px] text-muted">Today&apos;s gold rate (22K, per 10 g)</p>
            {rates ? (
              <>
                <p className="text-[30px] font-semibold text-espresso">{formatINR(rates.gold22Per10g)}</p>
                <p className="text-[13px] text-muted">Silver {formatINR(rates.silverPerKg)}/kg · Updated {formatDateTime(rates.updatedAt)}</p>
              </>
            ) : <p className="text-[18px] font-semibold">Not set yet — prices are hidden until you add rates.</p>}
          </div>
          <Link href="/admin/rates" className="btn btn-primary">Update rate →</Link>
        </section>
        <section className="admin-card p-5" aria-labelledby="ra">
          <h2 id="ra" className="text-[28px]">Recent activity</h2>
          {a.recent_activity.length ? (
            <ul className="mt-3">
              {a.recent_activity.map((r, i) => (
                <li key={i} className="flex justify-between gap-4 border-b border-line py-3 text-[14.5px] last:border-0">
                  <span>{r.message}</span><span className="shrink-0 text-[13px] text-muted">{formatRelativeShort(r.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-4 text-muted">Activity will appear here.</p>}
        </section>
      </div>
    </>
  );
}
