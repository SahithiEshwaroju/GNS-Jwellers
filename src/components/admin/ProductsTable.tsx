"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Photo } from "@/components/ui/Photo";
import { Toggle } from "@/components/ui/Toggle";
import { Modal } from "@/components/ui/Modal";
import { formatINR, metalLabel } from "@/lib/format";
import { deleteProduct, setProductFeatured, setProductStatus } from "@/app/actions/admin";

type Row = {
  id: string; code: string; name: string; category_name: string; metal: string; karat: number | null; silver_purity: string | null;
  estimated_price: number | null; status: string; is_featured: boolean; is_sample: boolean; cover_media_id: string | null; image_count: number;
};

export function ProductsTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [confirm, setConfirm] = useState<Row | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { kind: "ok", text: okText } : { kind: "error", text: r.error ?? "Failed" });
      router.refresh();
    });
  if (!rows.length) return <div className="admin-card p-10 text-center text-muted">No products match. <Link href="/admin/products/new" className="text-burgundy underline">Add a product</Link>.</div>;
  return (
    <>
      {msg ? <p role={msg.kind === "error" ? "alert" : "status"} className={`mb-3 rounded px-4 py-2 text-[14px] ${msg.kind === "ok" ? "bg-ok-bg text-ok-ink" : "bg-cancel-bg text-cancel-ink"}`}>{msg.text}</p> : null}
      <div className="admin-card overflow-x-auto" aria-busy={pending}>
        <table className="table min-w-[860px]">
          <thead><tr><th>Product</th><th>Category</th><th>Price (est.)</th><th>Status</th><th>Featured</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <span className="h-11 w-11 shrink-0 overflow-hidden rounded"><Photo mediaId={r.cover_media_id} alt="" label="" iconSize={18} /></span>
                    <span>
                      <Link href={`/admin/products/${r.id}`} className="font-medium hover:text-burgundy">{r.name}</Link>
                      <span className="block text-[13px] text-muted">{r.code} · {metalLabel(r.metal, r.karat, r.silver_purity)}{r.image_count ? "" : " · no photo"}</span>
                    </span>
                    {r.is_sample ? <span className="badge badge-sample">Sample</span> : null}
                  </div>
                </td>
                <td>{r.category_name}</td>
                <td>{formatINR(r.estimated_price)}</td>
                <td><span className={`badge ${r.status === "published" ? "badge-ok" : "badge-draft"}`}>{r.status === "published" ? "Published" : "Draft"}</span></td>
                <td><Toggle checked={r.is_featured} label={`Feature ${r.name}`} disabled={pending} onChange={(v) => run(() => setProductFeatured(r.id, v), v ? `${r.name} is featured` : `${r.name} is no longer featured`)} /></td>
                <td>
                  <div className="flex items-center justify-end gap-1">
                    <button type="button" className="btn btn-ghost btn-sm" disabled={pending}
                      onClick={() => run(() => setProductStatus(r.id, r.status === "published" ? "draft" : "published"), r.status === "published" ? `${r.name} unpublished` : `${r.name} published`)}>
                      {r.status === "published" ? "Unpublish" : "Publish"}
                    </button>
                    <Link href={`/admin/products/${r.id}`} className="grid h-10 w-10 place-items-center rounded hover:bg-rose-tint" aria-label={`Edit ${r.name}`}><Icon name="edit-pencil" /></Link>
                    <button type="button" className="grid h-10 w-10 place-items-center rounded text-danger hover:bg-cancel-bg" aria-label={`Delete ${r.name}`} onClick={() => setConfirm(r)}><Icon name="trash" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Delete product?" size="sm"
        footer={<div className="flex justify-end gap-3"><button type="button" className="btn btn-outline" onClick={() => setConfirm(null)}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => { const c = confirm!; setConfirm(null); run(() => deleteProduct(c.id), `${c.name} deleted`); }}>Delete</button></div>}>
        <p>This permanently removes <b>{confirm?.name}</b> ({confirm?.code}) and its photos. Saved designs and enquiry history keep the product name. This can&apos;t be undone.</p>
      </Modal>
    </>
  );
}
