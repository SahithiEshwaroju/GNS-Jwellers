"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { uploadImage } from "./uploadImage";
import { aiExtractCatalogue } from "@/app/actions/admin";
import type { ExtractedDraft } from "@/lib/ai/prompts";

/** Text-only extraction (BR-09): the catalogue image is deleted after reading and never used as a product photo. */
export function ExtractTool({ ready }: { ready: boolean }) {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const cam = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExtractedDraft | null>(null);
  async function run(f: File | undefined) {
    if (!f) return;
    setError(null);
    setDraft(null);
    try {
      setStatus("Uploading…");
      const id = await uploadImage(f, "extract", (p) => setStatus(`Uploading… ${p}%`));
      setStatus("Reading the text…");
      const r = await aiExtractCatalogue(id);
      if (!r.ok) throw new Error(r.error);
      setDraft(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setStatus(null);
    }
  }
  const rows: [keyof ExtractedDraft, string][] = [["name", "Name"], ["metal", "Metal"], ["karat", "Karat"], ["weight_g", "Weight (g)"], ["stones_note", "Stones"], ["style", "Style"], ["occasion", "Occasion"], ["description", "Description"], ["model_description", "Design"]];
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="admin-card p-5">
        <div className="grid place-items-center gap-3 rounded-md border border-dashed border-dusty-rose px-6 py-12 text-center">
          <Icon name="image" size={40} className="text-burgundy" />
          <p className="text-[18px] font-semibold">Upload catalogue image</p>
          <p className="text-[13px] text-muted">JPG, PNG or WebP of one product or a catalogue page</p>
          <button type="button" className="btn btn-primary" disabled={!ready || !!status} onClick={() => file.current?.click()}>Choose image</button>
          <span className="text-[13px] text-muted">or</span>
          <button type="button" className="btn btn-outline" disabled={!ready || !!status} onClick={() => cam.current?.click()}>Capture with camera</button>
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => run(e.target.files?.[0])} aria-label="Choose catalogue image" />
          <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => run(e.target.files?.[0])} aria-label="Capture catalogue image" />
          {status ? <p role="status" className="text-[14px]">{status}</p> : null}
          {!ready ? <p className="err">AI extraction needs both Cloudflare R2 and a Gemini API key to be configured. You can add products manually meanwhile.</p> : null}
        </div>
      </section>
      <section className="admin-card p-5" aria-live="polite">
        <h2 className="text-[28px]">Extraction result</h2>
        {error ? <p role="alert" className="mt-3 rounded bg-cancel-bg px-3 py-2 text-[14px] text-cancel-ink">{error}</p> : null}
        {draft ? (
          <>
            <dl className="mt-3 text-[14.5px]">
              {rows.map(([k, l]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-line py-2"><dt className="text-muted">{l}</dt><dd className="text-right">{draft[k] === null || draft[k] === "" ? <span className="text-muted">Not found</span> : String(draft[k])}</dd></div>
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
