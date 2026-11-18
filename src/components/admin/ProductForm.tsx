"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Photo } from "@/components/ui/Photo";
import { PhotoManager, type ProductPhoto } from "./PhotoManager";
import { estimatePrice, type Rates, type MakingType } from "@/lib/pricing";
import { formatINR, metalLabel } from "@/lib/format";
import { aiSuggestDescription, saveProduct } from "@/app/actions/admin";
import type { ExtractedDraft } from "@/lib/ai/prompts";

export type FormProduct = {
  id?: string; code?: string; status?: string; is_sample?: boolean;
  name: string; category_id: string; subcategory_id: string; collection_id: string; description: string; model_description: string;
  metal: "gold" | "silver"; karat: string; silver_purity: string; weight_g: string; making_type: MakingType; making_value: string;
  stone_value: string; stones_note: string; style: string; occasion: string; gender: string;
  specifications: { label: string; value: string }[]; tags: string[]; images: ProductPhoto[];
};

export const EMPTY_PRODUCT: FormProduct = {
  name: "", category_id: "", subcategory_id: "", collection_id: "", description: "", model_description: "", metal: "gold", karat: "22",
  silver_purity: "", weight_g: "", making_type: "fixed", making_value: "", stone_value: "", stones_note: "", style: "", occasion: "",
  gender: "", specifications: [], tags: [], images: [],
};

type Cat = { id: string; name: string; subcategories: { id: string; name: string }[] };

export function ProductForm({
  initial, categories, collections, rates, storageReady, aiReady,
}: {
  initial: FormProduct; categories: Cat[]; collections: { id: string; name: string }[]; rates: Rates | null; storageReady: boolean; aiReady: boolean;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [f, setF] = useState<FormProduct>(initial);
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(sp.get("saved") ? "Product saved." : null);
  const [preview, setPreview] = useState(false);
  const [suggestion, setSuggestion] = useState<{ description: string; model_description: string } | null>(null);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [aiPending, startAi] = useTransition();

  useEffect(() => {
    if (sp.get("from") !== "extract" || initial.id) return;
    try {
      const raw = sessionStorage.getItem("gns-extract-draft");
      if (!raw) return;
      const d = JSON.parse(raw) as ExtractedDraft;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from sessionStorage (external store) after mount
      setF((x) => ({
        ...x, name: d.name ?? x.name, description: d.description ?? "", model_description: d.model_description ?? "",
        metal: d.metal ?? x.metal, karat: d.karat ? String(d.karat) : x.karat, weight_g: d.weight_g ? String(d.weight_g) : "",
        stones_note: d.stones_note ?? "", style: d.style ?? "", occasion: d.occasion ?? "", tags: d.tags, specifications: d.specifications,
      }));
      sessionStorage.removeItem("gns-extract-draft");
      setSaved("Draft filled from the catalogue image. Check every field and add the actual product photo.");
    } catch {
      /* ignore */
    }
  }, [sp, initial.id]);

  const set = <K extends keyof FormProduct>(k: K, v: FormProduct[K]) => setF((x) => ({ ...x, [k]: v }));
  const cat = categories.find((c) => c.id === f.category_id);
  const price = useMemo(() => {
    const w = Number(f.weight_g);
    if (!w || w <= 0) return null;
    return estimatePrice({ metal: f.metal, karat: f.metal === "gold" ? Number(f.karat) : null, weightG: w, makingType: f.making_type, makingValue: Number(f.making_value) || 0, stoneValue: Number(f.stone_value) || 0 }, rates);
  }, [f, rates]);

  function submit(status: "draft" | "published") {
    setError(null);
    setSaved(null);
    start(async () => {
      const r = await saveProduct({
        id: f.id, name: f.name, category_id: f.category_id, subcategory_id: f.subcategory_id, collection_id: f.collection_id,
        description: f.description, model_description: f.model_description, metal: f.metal, karat: f.karat, silver_purity: f.silver_purity,
        weight_g: f.weight_g, making_type: f.making_type, making_value: f.making_value || "0", stone_value: f.stone_value || "0",
        stones_note: f.stones_note, style: f.style, occasion: f.occasion, gender: f.gender as "" | "women" | "men" | "unisex" | "kids", specifications: f.specifications.filter((s) => s.label && s.value),
        tags: f.tags, images: f.images.map(({ media_id, view_label }) => ({ media_id, view_label })), status,
      });
      if (!r.ok) {
        setError(r.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setF((x) => ({ ...x, id: r.data.id, code: r.data.code, status, images: x.images.map((i) => ({ ...i, isNew: false })) }));
      if (!f.id) router.replace(`/admin/products/${r.data.id}?saved=1`);
      else {
        setSaved(status === "published" ? "Saved and published." : "Saved as draft.");
        router.refresh();
      }
    });
  }

  function suggest() {
    setAiMsg(null);
    startAi(async () => {
      const r = await aiSuggestDescription({
        name: f.name, category: cat?.name, metal: f.metal, karat: f.metal === "gold" ? Number(f.karat) : null, weightG: Number(f.weight_g) || null,
        stonesNote: f.stones_note, style: f.style, occasion: f.occasion, ownerNotes: f.description,
      });
      if (r.ok) setSuggestion(r.data);
      else setAiMsg(r.error);
    });
  }

  const field = "grid gap-1";
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit("draft"); }} noValidate>
      {error ? <p role="alert" className="mb-4 rounded-md border border-[#efc4c4] bg-cancel-bg px-4 py-3 text-[14px] text-cancel-ink">{error}</p> : null}
      {saved ? <p role="status" className="mb-4 rounded-md bg-ok-bg px-4 py-3 text-[14px] text-ok-ink">{saved}</p> : null}
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="admin-card p-5">
            <h2 className="text-[26px]">Photos <span className="font-sans text-[14px] font-normal text-muted">(required to publish)</span></h2>
            <div className="mt-3"><PhotoManager photos={f.images} onChange={(p) => set("images", p)} storageReady={storageReady} /></div>
          </section>

          <section className="admin-card space-y-4 p-5">
            <h2 className="text-[26px]">Essentials</h2>
            <div className={field}>
              <label htmlFor="p-name" className="label">Product name <span className="text-error">*</span></label>
              <input id="p-name" className="input" value={f.name} maxLength={120} onChange={(e) => set("name", e.target.value)} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className={field}>
                <label htmlFor="p-cat" className="label">Category <span className="text-error">*</span></label>
                <select id="p-cat" className="input" value={f.category_id} onChange={(e) => setF((x) => ({ ...x, category_id: e.target.value, subcategory_id: "" }))} required>
                  <option value="">Choose…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {f.code ? <p className="hint">Code {f.code} (fixed)</p> : <p className="hint">Code is generated from the category.</p>}
              </div>
              <div className={field}>
                <label htmlFor="p-sub" className="label">Subcategory</label>
                <select id="p-sub" className="input" value={f.subcategory_id} onChange={(e) => set("subcategory_id", e.target.value)} disabled={!cat?.subcategories.length}>
                  <option value="">None</option>
                  {cat?.subcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className={field}>
                <label htmlFor="p-col" className="label">Collection</label>
                <select id="p-col" className="input" value={f.collection_id} onChange={(e) => set("collection_id", e.target.value)}>
                  <option value="">None</option>
                  {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <fieldset className={field}>
                <legend className="label">Metal <span className="text-error">*</span></legend>
                <div className="flex gap-2" role="radiogroup">
                  {(["gold", "silver"] as const).map((m) => <button key={m} type="button" role="radio" aria-checked={f.metal === m} className="pill" onClick={() => set("metal", m)}>{m === "gold" ? "Gold" : "Silver"}</button>)}
                </div>
              </fieldset>
              {f.metal === "gold" ? (
                <div className={field}>
                  <label htmlFor="p-karat" className="label">Karat <span className="text-error">*</span></label>
                  <select id="p-karat" className="input" value={f.karat} onChange={(e) => set("karat", e.target.value)}>
                    {["24", "22", "18"].map((k) => <option key={k} value={k}>{k}K</option>)}
                  </select>
                </div>
              ) : (
                <div className={field}>
                  <label htmlFor="p-purity" className="label">Silver purity</label>
                  <input id="p-purity" className="input" value={f.silver_purity} maxLength={20} placeholder="e.g. 925" onChange={(e) => set("silver_purity", e.target.value)} />
                </div>
              )}
              <div className={field}>
                <label htmlFor="p-weight" className="label">Weight (g) <span className="text-error">*</span></label>
                <input id="p-weight" className="input" inputMode="decimal" value={f.weight_g} onChange={(e) => set("weight_g", e.target.value)} placeholder="e.g. 12.4" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className={field}>
                <label htmlFor="p-mtype" className="label">Making charges</label>
                <select id="p-mtype" className="input" value={f.making_type} onChange={(e) => set("making_type", e.target.value as MakingType)}>
                  <option value="fixed">Fixed amount (₹)</option>
                  <option value="percent">% of metal value</option>
                  <option value="per_gram">₹ per gram</option>
                </select>
              </div>
              <div className={field}>
                <label htmlFor="p-mval" className="label">{f.making_type === "percent" ? "Making %" : "Making amount (₹)"}</label>
                <input id="p-mval" className="input" inputMode="decimal" value={f.making_value} onChange={(e) => set("making_value", e.target.value)} placeholder="0" />
              </div>
              <div className={field}>
                <label htmlFor="p-stone" className="label">Stone value (₹)</label>
                <input id="p-stone" className="input" inputMode="decimal" value={f.stone_value} onChange={(e) => set("stone_value", e.target.value)} placeholder="0" />
              </div>
            </div>
          </section>

          <details className="admin-card p-5" open={Boolean(f.description || f.model_description || f.style || f.tags.length || f.specifications.length)}>
            <summary className="cursor-pointer font-display text-[26px] font-bold text-wine">Optional details</summary>
            <div className="mt-4 space-y-4">
              <div className={field}>
                <div className="flex items-center justify-between">
                  <label htmlFor="p-desc" className="label">Description</label>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={suggest} disabled={aiPending || !f.name} title={aiReady ? "" : "AI isn't configured"}>
                    {aiPending ? "Thinking…" : "✦ Suggest with AI"}
                  </button>
                </div>
                <textarea id="p-desc" className="input" rows={3} maxLength={2000} value={f.description} onChange={(e) => set("description", e.target.value)} />
                {aiMsg ? <p className="hint" role="status">{aiMsg}</p> : null}
                {suggestion ? (
                  <div className="rounded-md border border-dashed border-sample-bd bg-sample-bg/50 p-4 text-[14px]" role="region" aria-label="AI suggestion">
                    <p className="font-semibold">AI suggestion — review before using</p>
                    <p className="mt-2"><b>Description:</b> {suggestion.description}</p>
                    <p className="mt-1"><b>Design:</b> {suggestion.model_description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => { setF((x) => ({ ...x, description: suggestion.description, model_description: suggestion.model_description })); setSuggestion(null); }}>Accept</button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={suggest} disabled={aiPending}>Regenerate</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSuggestion(null)}>Reject</button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className={field}>
                <label htmlFor="p-model" className="label">Model / design description</label>
                <textarea id="p-model" className="input" rows={2} maxLength={2000} value={f.model_description} onChange={(e) => set("model_description", e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className={field}><label htmlFor="p-stn" className="label">Stones</label><input id="p-stn" className="input" maxLength={200} value={f.stones_note} onChange={(e) => set("stones_note", e.target.value)} placeholder="e.g. Rubies, kemp stones" /></div>
                <div className={field}><label htmlFor="p-style" className="label">Style / theme</label><input id="p-style" className="input" maxLength={40} value={f.style} onChange={(e) => set("style", e.target.value)} placeholder="e.g. Temple, Floral, Modern" /></div>
                <div className={field}><label htmlFor="p-occ" className="label">Occasion</label><input id="p-occ" className="input" maxLength={40} value={f.occasion} onChange={(e) => set("occasion", e.target.value)} placeholder="e.g. Wedding, Daily Wear" /></div>
                <div className={field}>
                  <label htmlFor="p-gen" className="label">Gender</label>
                  <select id="p-gen" className="input" value={f.gender} onChange={(e) => set("gender", e.target.value)}>
                    <option value="">Not set</option><option value="women">Women</option><option value="men">Men</option><option value="unisex">Unisex</option><option value="kids">Kids</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="p-tags" className="label">Tags</label>
                <ul className="mb-2 flex flex-wrap gap-2">
                  {f.tags.map((t) => (
                    <li key={t} className="chip">{t}<button type="button" aria-label={`Remove tag ${t}`} onClick={() => set("tags", f.tags.filter((x) => x !== t))}><Icon name="close-x-thin" size={14} /></button></li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <input id="p-tags" className="input" maxLength={40} value={tagInput} placeholder="Type a tag and press Add"
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const t = tagInput.trim(); if (t && !f.tags.includes(t)) set("tags", [...f.tags, t]); setTagInput(""); } }} />
                  <button type="button" className="btn btn-outline" onClick={() => { const t = tagInput.trim(); if (t && !f.tags.includes(t)) set("tags", [...f.tags, t]); setTagInput(""); }}>Add</button>
                </div>
              </div>
              <div>
                <p className="label">Extra specifications</p>
                {f.specifications.map((s, i) => (
                  <div key={i} className="mb-2 flex gap-2">
                    <input className="input" aria-label={`Specification ${i + 1} name`} placeholder="e.g. Size" maxLength={40} value={s.label} onChange={(e) => set("specifications", f.specifications.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                    <input className="input" aria-label={`Specification ${i + 1} value`} placeholder="e.g. 18 inch" maxLength={120} value={s.value} onChange={(e) => set("specifications", f.specifications.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                    <button type="button" className="grid h-11 w-11 shrink-0 place-items-center text-danger" aria-label={`Remove specification ${i + 1}`} onClick={() => set("specifications", f.specifications.filter((_, j) => j !== i))}><Icon name="trash" /></button>
                  </div>
                ))}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => set("specifications", [...f.specifications, { label: "", value: "" }])}>+ Add specification</button>
              </div>
            </div>
          </details>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <section className="admin-card p-5" aria-live="polite">
            <h2 className="text-[24px]">Estimated price</h2>
            {price ? (
              <dl className="mt-3 text-[14px]">
                <div className="flex justify-between py-1"><dt className="text-muted">Metal</dt><dd>{formatINR(price.metalValue)}</dd></div>
                <div className="flex justify-between py-1"><dt className="text-muted">Making</dt><dd>{formatINR(price.makingAmount)}</dd></div>
                <div className="flex justify-between py-1"><dt className="text-muted">Stones</dt><dd>{formatINR(price.stoneAmount)}</dd></div>
                <div className="flex justify-between py-1"><dt className="text-muted">GST</dt><dd>{formatINR(price.gstAmount)}</dd></div>
                <div className="mt-2 flex justify-between rounded bg-price-bg px-3 py-2 text-[16px] font-semibold"><dt>Total</dt><dd>{formatINR(price.total)}</dd></div>
              </dl>
            ) : <p className="mt-2 text-[14px] text-muted">{rates ? "Enter the weight to see the estimate." : "Set today's rates to see estimates."}</p>}
            {!rates ? <Link href="/admin/rates" className="text-[14px] text-burgundy underline">Set rates</Link> : null}
          </section>
          <section className="admin-card space-y-3 p-5">
            <p className="text-[14px]">Status: <span className={`badge ${f.status === "published" ? "badge-ok" : "badge-draft"}`}>{f.status === "published" ? "Published" : "Draft"}</span> {f.is_sample ? <span className="badge badge-sample">Sample</span> : null}</p>
            <button type="button" className="btn btn-outline w-full" onClick={() => setPreview(true)}>Preview</button>
            <button type="submit" className="btn btn-outline w-full" disabled={pending}>{pending ? "Saving…" : f.status === "published" ? "Save & unpublish (draft)" : "Save draft"}</button>
            <button type="button" className="btn btn-primary w-full" disabled={pending} onClick={() => submit("published")}>{f.status === "published" ? "Save changes" : "Save & publish"}</button>
            {f.code && f.status === "published" ? <Link href={`/product/${f.code}`} className="block text-center text-[14px] text-burgundy underline" target="_blank">View on website</Link> : null}
          </section>
        </aside>
      </div>

      <Modal open={preview} onClose={() => setPreview(false)} title="Preview" size="lg">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="aspect-square overflow-hidden rounded-md"><Photo mediaId={f.images[0]?.media_id} alt={f.name || "Product"} label="Actual product photo" /></div>
          <div>
            <h3 className="text-[32px]">{f.name || "Product name"}</h3>
            {f.collection_id ? <p className="mt-1">From the <b>{collections.find((c) => c.id === f.collection_id)?.name}</b></p> : null}
            {f.description ? <p className="mt-3 text-muted">{f.description}</p> : null}
            <p className="mt-4 text-[30px] font-bold text-wine">{price ? formatINR(price.total) : "—"}</p>
            <p className="text-[13px] text-muted">(Approx. price{f.code ? ` · ${f.code}` : ""}) · {metalLabel(f.metal, f.metal === "gold" ? Number(f.karat) : null, f.silver_purity)} · {f.weight_g || "—"} g</p>
            {!f.images.length ? <p className="mt-4 rounded bg-note-bg p-3 text-[14px]">Add at least one actual photo before publishing.</p> : null}
          </div>
        </div>
      </Modal>
    </form>
  );
}
