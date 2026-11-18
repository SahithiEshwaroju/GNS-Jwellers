"use client";
import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Photo } from "@/components/ui/Photo";
import { uploadImage, discardUpload } from "./uploadImage";

export type ProductPhoto = { media_id: string; view_label: "front" | "side" | "worn" | "detail" | "other"; isNew?: boolean };
const LABELS = [["front", "Front view"], ["side", "Side view"], ["worn", "Worn"], ["detail", "Detail"], ["other", "Other"]] as const;

/** Real product photographs only (REQ-034, BR-09). Upload, label, reorder, remove. */
export function PhotoManager({ photos, onChange, storageReady }: { photos: ProductPhoto[]; onChange: (p: ProductPhoto[]) => void; storageReady: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ name: string; pct: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files).slice(0, 12 - photos.length);
    let next = [...photos];
    for (const f of list) {
      setBusy((b) => [...b, { name: f.name, pct: 0 }]);
      try {
        const id = await uploadImage(f, "product", (pct) => setBusy((b) => b.map((x) => (x.name === f.name ? { ...x, pct } : x))));
        next = [...next, { media_id: id, view_label: next.length === 0 ? "front" : "other", isNew: true }];
        onChange(next);
      } catch (e) {
        setError(`${f.name}: ${e instanceof Error ? e.message : "Upload failed"}`);
      } finally {
        setBusy((b) => b.filter((x) => x.name !== f.name));
      }
    }
    if (input.current) input.current.value = "";
  }
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= photos.length) return;
    const n = [...photos];
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {photos.map((p, i) => (
          <li key={p.media_id} className="rounded-md border border-line bg-white p-2">
            <div className="aspect-square overflow-hidden rounded"><Photo mediaId={p.media_id} alt={`Photo ${i + 1}`} label="" iconSize={22} /></div>
            <label className="sr-only" htmlFor={`vl-${p.media_id}`}>View for photo {i + 1}</label>
            <select id={`vl-${p.media_id}`} className="input mt-2 h-9 min-h-0 py-1 text-[13px]" value={p.view_label}
              onChange={(e) => onChange(photos.map((x) => (x.media_id === p.media_id ? { ...x, view_label: e.target.value as ProductPhoto["view_label"] } : x)))}>
              {LABELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <div className="mt-1 flex justify-between">
              <span className="flex">
                <button type="button" className="grid h-9 w-9 place-items-center" aria-label="Move earlier" onClick={() => move(i, -1)} disabled={i === 0}><Icon name="arrow-left" size={15} /></button>
                <button type="button" className="grid h-9 w-9 place-items-center" aria-label="Move later" onClick={() => move(i, 1)} disabled={i === photos.length - 1}><Icon name="arrow-right" size={15} /></button>
              </span>
              <button type="button" className="grid h-9 w-9 place-items-center text-danger" aria-label={`Remove photo ${i + 1}`}
                onClick={() => { if (p.isNew) void discardUpload(p.media_id); onChange(photos.filter((x) => x.media_id !== p.media_id)); }}>
                <Icon name="close-x" size={16} />
              </button>
            </div>
            {i === 0 ? <p className="text-center text-[12px] text-muted">Cover photo</p> : null}
          </li>
        ))}
        {busy.map((b) => (
          <li key={b.name} className="grid aspect-square place-items-center rounded-md border border-dashed border-line bg-white text-[13px] text-muted" role="status">Uploading… {b.pct}%</li>
        ))}
        {photos.length + busy.length < 12 ? (
          <li>
            <button type="button" disabled={!storageReady} onClick={() => input.current?.click()}
              className="grid aspect-square w-full place-items-center rounded-md border border-dashed border-dusty-rose bg-white text-burgundy hover:bg-rose-tint-2 disabled:cursor-not-allowed disabled:opacity-60">
              <span className="flex flex-col items-center gap-2 text-[14px]"><Icon name="plus" size={22} />Add photo</span>
            </button>
          </li>
        ) : null}
      </ul>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => onFiles(e.target.files)} aria-label="Choose product photos" />
      <p className="hint mt-2">Upload the shop&apos;s actual product photographs (JPG, PNG or WebP, up to 8 MB each). AI-generated product images are not allowed.</p>
      {!storageReady ? <p className="err">Photo storage (Cloudflare R2) isn&apos;t configured yet, so photos can&apos;t be uploaded. You can still save drafts.</p> : null}
      {error ? <p className="err" role="alert">{error}</p> : null}
    </div>
  );
}
