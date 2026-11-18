import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProductsTable } from "@/components/admin/ProductsTable";
import { createClient } from "@/lib/supabase/server";
import { likeEscape } from "@/lib/data/catalogue";

export const metadata = { title: "Products" };
const PER_PAGE = 20;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; cat?: string; page?: string }> }) {
  const sp = await searchParams;
  const tab = ["published", "drafts", "featured"].includes(sp.tab ?? "") ? sp.tab! : "all";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const supabase = await createClient();
  const [counts, { data: cats }] = await Promise.all([
    supabase.from("products").select("status, is_featured"),
    supabase.from("categories").select("id, name").order("sort_order"),
  ]);
  const rows = counts.data ?? [];
  const tabs = [
    ["all", `All (${rows.length})`],
    ["published", `Published (${rows.filter((r) => r.status === "published").length})`],
    ["drafts", `Drafts (${rows.filter((r) => r.status === "draft").length})`],
    ["featured", `Featured (${rows.filter((r) => r.is_featured).length})`],
  ];
  let q = supabase
    .from("catalogue_products")
    .select("id, code, name, category_name, metal, karat, silver_purity, estimated_price, status, is_featured, is_sample, cover_media_id, image_count", { count: "exact" });
  if (tab === "published") q = q.eq("status", "published");
  if (tab === "drafts") q = q.eq("status", "draft");
  if (tab === "featured") q = q.eq("is_featured", true);
  if (sp.q) q = q.or(`name.ilike.%${likeEscape(sp.q).replace(/[,()]/g, " ")}%,code.ilike.%${likeEscape(sp.q).replace(/[,()]/g, " ")}%`);
  if (sp.cat && /^[0-9a-f-]{36}$/.test(sp.cat)) q = q.eq("category_id", sp.cat);
  const { data, count } = await q.order("code").range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  const pages = Math.max(1, Math.ceil((count ?? 0) / PER_PAGE));
  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/products?${p.toString()}`;
  };
  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Manage your jewellery catalogue"
        actions={<><Link href="/admin/extract" className="btn btn-outline">Import from catalogue (AI)</Link><Link href="/admin/products/new" className="btn btn-primary">+ Add Product</Link></>}
      />
      <nav aria-label="Product filters" className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map(([k, label]) => (
          <Link key={k} href={link({ tab: k === "all" ? undefined : k, page: undefined })} aria-current={tab === k ? "page" : undefined}
            className={`whitespace-nowrap px-3 py-3 text-[15px] ${tab === k ? "border-b-2 border-burgundy font-semibold text-wine" : "text-muted hover:text-wine"}`}>{label}</Link>
        ))}
      </nav>
      <form className="mb-5 flex flex-col gap-3 sm:flex-row" role="search">
        {tab !== "all" ? <input type="hidden" name="tab" value={tab} /> : null}
        <label className="sr-only" htmlFor="pq">Search products</label>
        <input id="pq" name="q" defaultValue={sp.q} className="input sm:max-w-xs" placeholder="Search by name or code..." maxLength={60} />
        <label className="sr-only" htmlFor="pc">Category</label>
        <select id="pc" name="cat" defaultValue={sp.cat ?? ""} className="input sm:max-w-[220px]">
          <option value="">All categories</option>
          {(cats ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn btn-outline" type="submit">Apply</button>
      </form>
      <ProductsTable rows={(data ?? []).map((r) => ({ ...r, estimated_price: r.estimated_price === null ? null : Number(r.estimated_price) }))} />
      <div className="mt-4 flex items-center justify-between text-[13px] text-muted">
        <span>Showing {(count ?? 0) === 0 ? 0 : (page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, count ?? 0)} of {count ?? 0} products</span>
        {pages > 1 ? (
          <nav aria-label="Pages" className="flex gap-2">
            {Array.from({ length: pages }).map((_, i) => (
              <Link key={i} href={link({ page: String(i + 1) })} aria-current={page === i + 1 ? "page" : undefined}
                className={`grid h-9 w-9 place-items-center rounded border ${page === i + 1 ? "border-burgundy bg-burgundy text-white" : "border-line bg-white"}`}>{i + 1}</Link>
            ))}
          </nav>
        ) : null}
      </div>
    </>
  );
}
