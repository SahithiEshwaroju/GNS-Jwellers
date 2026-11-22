"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { uploadImage } from "./uploadImage";
import { aiExtractCatalogue } from "@/app/actions/admin";
import type { ExtractedDraft } from "@/lib/ai/prompts";

const HINTS = [
  "Reading the printed text",
  "Looking for the product name",
  "Finding metal, karat and weight",
  "Spotting stones and style details",
  "Preparing an editable draft",
];

type Phase = "idle" | "upload" | "analyse";

/** Text-only extraction (BR-09): the catalogue image is deleted after reading and never used as a product photo. */
export function ExtractTool({ ready }: { ready: boolean }) {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const cam = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pct, setPct] = useState(0);
  const [hint, setHint] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExtractedDraft | null>(null);
  const busy = phase !== "idle";

  // Free the local preview image when it is replaced or the page closes.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  // While the AI is analysing, rotate the status line so the screen visibly keeps working.
  useEffect(() => {
    if (phase !== "analyse") return;
    const t = window.setInterval(() => setHint((h) => (h + 1) % HINTS.length), 2200);
    return () => window.clearInterval(t);
  }, [phase]);

  async function run(f: File | undefined) {
    if (!f) return;
    setError(null);
    setDraft(null);
    setHint(0);
    setPct(0);
    setPreview(URL.createObjectURL(f));
    try {
      setPhase("upload");
      const id = await uploadImage(f, "extract", setPct);
      setPhase("analyse");
      const r = await aiExtractCatalogue(id);
      if (!r.ok) throw new Error(r.error);
      setDraft(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setPhase("idle");
      if (file.current) file.current.value = "";
      if (cam.current) cam.current.value = "";
    }
  }

  const rows: [keyof ExtractedDraft, string][] = [["name", "Name"], ["metal", "Metal"], ["karat", "Karat"], ["weight_g", "Weight (g)"], ["stones_note", "Stones"], ["style", "Style"], ["occasion", "Occasion"], ["description", "Description"], ["model_description", "Design"]];
  const steps: [Phase, string][] = [["upload", "Uploading the image"], ["analyse", "AI analysing the page"]];

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="admin-card p-5">
        {busy && preview ? (
          <div role="status" aria-live="polite">
            <div className="scan-frame bg-champagne">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview of the file just chosen */}
              <img src={preview} alt="Catalogue page being analysed" className="max-h-[360px] w-full object-contain" />
              {phase === "analyse" ? (<><span className="scan-glow" aria-hidden="true" /><span className="scan-line" aria-hidden="true" /></>) : null}
            </div>
            <ol className="mt-4 space-y-2">
              {steps.map(([p, label]) => {
                const done = phase === "analyse" && p === "upload";
                const current = phase === p;
                return (
                  <li key={p} className={`flex items-center gap-3 text-[14.5px] ${current ? "font-medium text-wine" : done ? "text-ok-ink" : "text-muted"}`}>
                    {done ? <Icon name="check-circle" size={18} /> : current ? <span className="spinner" aria-hidden="true" /> : <span className="h-4 w-4 rounded-full border border-line" aria-hidden="true" />}
                    {label}{current && p === "upload" ? ` ${pct}%` : ""}
                  </li>
                );
              })}
            </ol>
            {phase === "analyse" ? (
              <p className="fade-in mt-3 rounded-md bg-rose-tint-2 px-3 py-2 text-[14px] text-wine" key={hint}>
                ✦ <span className="dots">{HINTS[hint]}</span>
              </p>
            ) : (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ede3d4]" aria-hidden="true"><div className="h-full rounded-full bg-burgundy transition-[width] duration-300" style={{ width: `${pct}%` }} /></div>
            )}
          </div>
        ) : (
          <div className="grid place-items-center gap-3 rounded-md border border-dashed border-dusty-rose px-6 py-12 text-center">
            <Icon name="image" size={40} className="text-burgundy" />
            <p className="text-[18px] font-semibold">Upload catalogue image</p>
            <p className="text-[13px] text-muted">JPG, PNG or WebP of one product or a catalogue page</p>
            <button type="button" className="btn btn-primary" disabled={!ready} onClick={() => file.current?.click()}>Choose image</button>
            <span className="text-[13px] text-muted">or</span>
            <button type="button" className="btn btn-outline" disabled={!ready} onClick={() => cam.current?.click()}>Capture with camera</button>
            {!ready ? <p className="err">AI extraction needs both Cloudflare R2 and a Gemini API key to be configured (see Admin → System Check). You can add products manually meanwhile.</p> : null}
          </div>
        )}
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => run(e.target.files?.[0])} aria-label="Choose catalogue image" />
        <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => run(e.target.files?.[0])} aria-label="Capture catalogue image" />
      </section>

      <section className="admin-card p-5" aria-live="polite">
        <h2 className="text-[28px]">Extraction result</h2>
        {error ? <p role="alert" className="fade-in mt-3 rounded bg-cancel-bg px-3 py-2 text-[14px] text-cancel-ink">{error}</p> : null}
        {phase === "analyse" ? (
          <div className="mt-3 space-y-3" aria-hidden="true">
            {rows.map(([k]) => (<div key={k} className="flex justify-between gap-6"><span className="skeleton h-4 w-24" /><span className="skeleton h-4 w-40" /></div>))}
          </div>
        ) : draft ? (
          <>
            <dl className="mt-3 text-[14.5px]">
              {rows.map(([k, l], i) => (
                <div key={k} className="fade-in flex justify-between gap-4 border-b border-line py-2" style={{ animationDelay: `${i * 60}ms` }}>
                  <dt className="text-muted">{l}</dt>
                  <dd className="text-right">{draft[k] === null || draft[k] === "" ? <span className="text-muted">Not found</span> : String(draft[k])}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[13px] text-muted">Check every value. Nothing is saved until you review the draft and save it. You&apos;ll add the actual product photo on the next screen.</p>
            <button type="button" className="btn btn-primary mt-4" onClick={() => { sessionStorage.setItem("gns-extract-draft", JSON.stringify(draft)); router.push("/admin/products/new?from=extract"); }}>Review as product draft</button>
          </>
        ) : !error ? <p className="mt-3 text-muted">Fields appear here after an image is read.</p> : null}
      </section>
    </div>
  );
}
