"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Toggle";
import { Modal } from "@/components/ui/Modal";
import {
  addCategory, addSubcategory, deleteCategory, deleteCollection, deleteSubcategory, deleteTag, moveCollection,
  renameCategory, saveCollection, saveHomeCategories, saveTag,
} from "@/app/actions/admin";

type Cat = { id: string; name: string; code_prefix: string; show_on_home: boolean; products: number; subcategories: { id: string; name: string }[] };
type Col = { id: string; name: string; description: string; theme_color: string; show_on_home: boolean; products: number };
type Tag = { id: string; name: string; products: number };

export function TaxonomyManager({ tab, categories, home, collections, tags }: {
  tab: "categories" | "collections" | "tags"; categories: Cat[]; home: { layout: string; limit: number; colsMobile: number }; collections: Col[]; tags: Tag[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error ?? "Failed" });
      if (r.ok) after?.();
      router.refresh();
    });
  const tabs = [["categories", "Categories"], ["collections", "Collections"], ["tags", "Tags"]] as const;
  return (
    <>
      <nav className="mb-5 flex gap-1 border-b border-line" aria-label="Sections">
        {tabs.map(([k, l]) => (
          <Link key={k} href={`/admin/taxonomy${k === "categories" ? "" : `?tab=${k}`}`} aria-current={tab === k ? "page" : undefined}
            className={`px-3 py-3 text-[15px] ${tab === k ? "border-b-2 border-burgundy font-semibold text-wine" : "text-muted"}`}>{l}</Link>
        ))}
      </nav>
      {msg ? <p role={msg.ok ? "status" : "alert"} className={`mb-4 rounded px-4 py-2 text-[14px] ${msg.ok ? "bg-ok-bg text-ok-ink" : "bg-cancel-bg text-cancel-ink"}`}>{msg.text}</p> : null}
      {tab === "categories" ? <Categories categories={categories} home={home} run={run} pending={pending} /> : null}
      {tab === "collections" ? <Collections collections={collections} run={run} pending={pending} /> : null}
      {tab === "tags" ? <Tags tags={tags} run={run} pending={pending} /> : null}
    </>
  );
}

type Run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText: string, after?: () => void) => void;

function Categories({ categories, home, run, pending }: { categories: Cat[]; home: { layout: string; limit: number; colsMobile: number }; run: Run; pending: boolean }) {
  const [order, setOrder] = useState(categories.map((c) => ({ id: c.id, name: c.name, show_on_home: c.show_on_home })));
  const [layout, setLayout] = useState(home.layout);
  const [limit, setLimit] = useState(home.limit);
  const [cols, setCols] = useState(home.colsMobile);
  const [newName, setNewName] = useState("");
  const [newPrefix, setNewPrefix] = useState("");
  const [subInput, setSubInput] = useState<Record<string, string>>({});
  const [rename, setRename] = useState<Cat | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [del, setDel] = useState<Cat | null>(null);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const n = [...order];
    [n[i], n[j]] = [n[j], n[i]];
    setOrder(n);
  };
  const shown = order.filter((o) => o.show_on_home);
  return (
    <div className="space-y-5">
      <section className="admin-card p-5" aria-labelledby="hp">
        <h2 id="hp" className="text-[28px]">Home page display</h2>
        <p className="text-[13.5px] text-muted">Choose which categories appear in &ldquo;Shop by Category&rdquo; on the home page, in what order, and how the list looks.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div><label htmlFor="t-layout" className="label">Layout style</label>
            <select id="t-layout" className="input" value={layout} onChange={(e) => setLayout(e.target.value)}><option value="square">Square photo tiles</option><option value="round">Round photo tiles</option></select></div>
          <div><label htmlFor="t-limit" className="label">Show before &ldquo;View all&rdquo;</label>
            <select id="t-limit" className="input" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>{[2, 3, 4, 6, 8, 10, 12].map((n) => <option key={n} value={n}>{n} categories</option>)}</select></div>
          <div><label htmlFor="t-cols" className="label">Tiles per row on phones</label>
            <select id="t-cols" className="input" value={cols} onChange={(e) => setCols(Number(e.target.value))}><option value={2}>2</option><option value={3}>3</option></select></div>
        </div>
        <p className="eyebrow mt-5">Order &amp; visibility</p>
        <ol className="mt-2">
          {order.map((o, i) => (
            <li key={o.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-rose-tint text-[13px]">{i + 1}</span>
              <span className="flex-1"><b className="font-medium">{o.name}</b> <span className="text-[13px] text-muted">· {!o.show_on_home ? "hidden on home page" : shown.indexOf(o) < limit ? "shown on home page" : "shown after “View all”"}</span></span>
              <button type="button" className="grid h-10 w-10 place-items-center" aria-label={`Move ${o.name} up`} onClick={() => move(i, -1)} disabled={i === 0}><Icon name="chevron-up" size={16} /></button>
              <button type="button" className="grid h-10 w-10 place-items-center" aria-label={`Move ${o.name} down`} onClick={() => move(i, 1)} disabled={i === order.length - 1}><Icon name="chevron-down" size={16} /></button>
              <Toggle checked={o.show_on_home} label={`Show ${o.name} on home page`} onChange={(v) => setOrder(order.map((x) => (x.id === o.id ? { ...x, show_on_home: v } : x)))} />
            </li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button type="button" className="btn btn-primary" disabled={pending} aria-busy={pending} onClick={() => run(() => saveHomeCategories({ order: order.map(({ id, show_on_home }) => ({ id, show_on_home })), layout, limit, colsMobile: cols }), "Home page categories saved.")}>Save home page categories</button>
          <span className="text-[13px] text-muted">{shown.length} of {order.length} categories shown on the home page</span>
        </div>
      </section>

      <form className="admin-card grid gap-3 p-5 sm:grid-cols-[1fr_160px_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); run(() => addCategory(newName, newPrefix), `Category “${newName}” added.`, () => { setNewName(""); setNewPrefix(""); }); }}>
        <div><label htmlFor="nc" className="label">New category</label><input id="nc" className="input" maxLength={60} placeholder="e.g. Nose Pins" value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
        <div><label htmlFor="ncp" className="label">Code prefix</label><input id="ncp" className="input uppercase" maxLength={4} placeholder="e.g. NP" value={newPrefix} onChange={(e) => setNewPrefix(e.target.value.toUpperCase())} /></div>
        <button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>Add category</button>
      </form>

      {categories.map((c) => (
        <section key={c.id} className="admin-card p-5" aria-label={c.name}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p><b className="text-[17px]">{c.name}</b> <span className="text-[13px] text-muted">Code prefix GNS-{c.code_prefix} · {c.products} {c.products === 1 ? "product" : "products"}</span></p>
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setRename(c); setRenameVal(c.name); }}>Rename</button>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => setDel(c)}>Delete</button>
            </div>
          </div>
          <ul className="mt-3 flex flex-wrap items-center gap-2">
            {c.subcategories.map((s) => (
              <li key={s.id} className="chip">{s.name}
                <button type="button" aria-label={`Remove subcategory ${s.name}`} disabled={pending} onClick={() => run(() => deleteSubcategory(s.id), `Removed ${s.name}.`)}><Icon name="close-x-thin" size={14} /></button>
              </li>
            ))}
            <li>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => addSubcategory(c.id, subInput[c.id] ?? ""), "Subcategory added.", () => setSubInput({ ...subInput, [c.id]: "" })); }}>
                <label className="sr-only" htmlFor={`sub-${c.id}`}>Add subcategory to {c.name}</label>
                <input id={`sub-${c.id}`} className="input h-9 min-h-0 w-44 py-1" placeholder="Add subcategory" maxLength={60} value={subInput[c.id] ?? ""} onChange={(e) => setSubInput({ ...subInput, [c.id]: e.target.value })} />
                <button className="btn btn-outline btn-sm" type="submit">Add</button>
              </form>
            </li>
          </ul>
        </section>
      ))}

      <Modal open={!!rename} onClose={() => setRename(null)} title="Rename category" size="sm"
        footer={<div className="flex justify-end gap-3"><button type="button" className="btn btn-outline" onClick={() => setRename(null)}>Cancel</button><button type="button" className="btn btn-primary" onClick={() => { const c = rename!; setRename(null); run(() => renameCategory(c.id, renameVal), "Category renamed."); }}>Save</button></div>}>
        <label htmlFor="rn" className="label">Name</label><input id="rn" className="input" maxLength={60} value={renameVal} onChange={(e) => setRenameVal(e.target.value)} />
        <p className="hint">The code prefix (GNS-{rename?.code_prefix}) stays the same so existing product codes don&apos;t change.</p>
      </Modal>
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete category?" size="sm"
        footer={<div className="flex justify-end gap-3"><button type="button" className="btn btn-outline" onClick={() => setDel(null)}>Cancel</button><button type="button" className="btn btn-primary" onClick={() => { const c = del!; setDel(null); run(() => deleteCategory(c.id), "Category deleted."); }}>Delete</button></div>}>
        <p>{del?.products ? <>This category still has <b>{del.products}</b> product(s). Move or delete them first.</> : <>Delete <b>{del?.name}</b> and its subcategories?</>}</p>
      </Modal>
    </div>
  );
}

function Collections({ collections, run, pending }: { collections: Col[]; run: Run; pending: boolean }) {
  const blank = { name: "", description: "", theme_color: "#540404", show_on_home: true };
  const [edit, setEdit] = useState<(Partial<Col> & typeof blank) | null>(null);
  const [del, setDel] = useState<Col | null>(null);
  return (
    <div className="space-y-4">
      <button type="button" className="btn btn-primary" onClick={() => setEdit(blank)}>+ New collection</button>
      <ul className="space-y-3">
        {collections.map((c, i) => (
          <li key={c.id} className="admin-card flex flex-wrap items-center gap-4 p-4">
            <span className="h-10 w-10 shrink-0 rounded" style={{ background: c.theme_color }} aria-hidden="true" />
            <span className="min-w-0 flex-1"><b className="block">{c.name}</b><span className="text-[13px] text-muted">{c.products} products · {c.show_on_home ? "on home page" : "not on home page"}</span></span>
            <button type="button" className="grid h-10 w-10 place-items-center" aria-label={`Move ${c.name} up`} disabled={i === 0 || pending} onClick={() => run(() => moveCollection(c.id, -1), "Order saved.")}><Icon name="chevron-up" size={16} /></button>
            <button type="button" className="grid h-10 w-10 place-items-center" aria-label={`Move ${c.name} down`} disabled={i === collections.length - 1 || pending} onClick={() => run(() => moveCollection(c.id, 1), "Order saved.")}><Icon name="chevron-down" size={16} /></button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...c })}>Edit</button>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => setDel(c)}>Delete</button>
          </li>
        ))}
      </ul>
      {!collections.length ? <p className="text-muted">No collections yet.</p> : null}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit collection" : "New collection"}
        footer={<div className="flex justify-end gap-3"><button type="button" className="btn btn-outline" onClick={() => setEdit(null)}>Cancel</button><button type="button" className="btn btn-primary" disabled={pending} aria-busy={pending} onClick={() => { const e = edit!; run(() => saveCollection({ id: e.id, name: e.name, description: e.description, theme_color: e.theme_color, show_on_home: e.show_on_home }), "Collection saved.", () => setEdit(null)); }}>Save</button></div>}>
        {edit ? (
          <div className="space-y-4">
            <div><label htmlFor="cn" className="label">Name</label><input id="cn" className="input" maxLength={60} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div><label htmlFor="cd" className="label">Short description</label><input id="cd" className="input" maxLength={300} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
            <div className="flex items-end gap-4">
              <div><label htmlFor="cc" className="label">Banner colour</label><input id="cc" type="color" className="h-11 w-20 rounded border border-line" value={edit.theme_color} onChange={(e) => setEdit({ ...edit, theme_color: e.target.value })} /></div>
              <label className="flex items-center gap-3 pb-2"><Toggle checked={edit.show_on_home} label="Show on home page" onChange={(v) => setEdit({ ...edit, show_on_home: v })} /> Show on home page</label>
            </div>
            <p className="hint">Banner photos are managed in Admin › Images.</p>
          </div>
        ) : null}
      </Modal>
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete collection?" size="sm"
        footer={<div className="flex justify-end gap-3"><button type="button" className="btn btn-outline" onClick={() => setDel(null)}>Cancel</button><button type="button" className="btn btn-primary" onClick={() => { const c = del!; setDel(null); run(() => deleteCollection(c.id), "Collection deleted."); }}>Delete</button></div>}>
        <p>Delete <b>{del?.name}</b>? {del?.products ? `Its ${del.products} product(s) stay in the catalogue but will no longer belong to a collection.` : ""}</p>
      </Modal>
    </div>
  );
}

function Tags({ tags, run, pending }: { tags: Tag[]; run: Run; pending: boolean }) {
  const [name, setName] = useState("");
  const [edit, setEdit] = useState<Record<string, string>>({});
  return (
    <div className="space-y-4">
      <form className="admin-card flex gap-3 p-5" onSubmit={(e) => { e.preventDefault(); run(() => saveTag(null, name), `Tag “${name}” added.`, () => setName("")); }}>
        <label htmlFor="nt" className="sr-only">New tag</label>
        <input id="nt" className="input" maxLength={40} placeholder="New tag, e.g. Lightweight" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn btn-primary" disabled={pending} aria-busy={pending}>Add tag</button>
      </form>
      <ul className="admin-card divide-y divide-line">
        {tags.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-3 p-4">
            {edit[t.id] !== undefined ? (
              <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); run(() => saveTag(t.id, edit[t.id]), "Tag renamed.", () => { const n = { ...edit }; delete n[t.id]; setEdit(n); }); }}>
                <label className="sr-only" htmlFor={`tg-${t.id}`}>Tag name</label>
                <input id={`tg-${t.id}`} className="input" maxLength={40} value={edit[t.id]} onChange={(e) => setEdit({ ...edit, [t.id]: e.target.value })} />
                <button type="submit" className="btn btn-primary btn-sm">Save</button>
              </form>
            ) : (
              <span className="flex-1"><b className="font-medium">{t.name}</b> <span className="text-[13px] text-muted">· {t.products} products</span></span>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...edit, [t.id]: t.name })}>Rename</button>
            <button type="button" className="btn btn-danger btn-sm" disabled={pending} aria-busy={pending} onClick={() => run(() => deleteTag(t.id), `Tag “${t.name}” removed from all products.`)}>Delete</button>
          </li>
        ))}
        {!tags.length ? <li className="p-4 text-muted">No tags yet.</li> : null}
      </ul>
    </div>
  );
}
