"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Photo } from "@/components/ui/Photo";
import { uploadImage, discardUpload } from "./uploadImage";
import { setSiteImage, type ImageTarget } from "@/app/actions/admin";

export function ImageSlot({ title, hint, target, mediaId, disabled }: { title: string; hint: string; target: ImageTarget; mediaId: string | null; disabled?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  async function onFile(f: File | undefined) {
    if (!f) return;
    setError(null);
    try {
      const id = await uploadImage(f, "site", (p) => setStatus(`Uploading… ${p}%`));
      setStatus("Saving…");
      const r = await setSiteImage(target, id);
      if (!r.ok) {
        await discardUpload(id);
        throw new Error(r.error);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setStatus(null);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <li className="admin-card flex flex-col p-4">
      <div className="aspect-[16/10] overflow-hidden rounded bg-champagne">
        {mediaId ? <Photo mediaId={mediaId} alt={title} label="" /> : <div className="grid h-full place-items-center text-center text-[13px] text-muted">Not uploaded — placeholder shown</div>}
      </div>
      <p className="mt-3 font-medium">{title} {!mediaId ? <span className="badge badge-sample">Placeholder</span> : null}</p>
      <p className="text-[13px] text-muted">{hint}</p>
      {status ? <p role="status" className="mt-2 text-[13px]">{status}</p> : null}
      {error ? <p role="alert" className="err">{error}</p> : null}
      <div className="mt-auto flex gap-2 pt-3">
        <button type="button" className="btn btn-outline btn-sm" disabled={disabled || !!status} onClick={() => input.current?.click()}>{mediaId ? "Replace" : "Upload"}</button>
        {mediaId ? <button type="button" className="btn btn-ghost btn-sm" disabled={pending} aria-busy={pending} onClick={() => start(async () => { const r = await setSiteImage(target, null); if (!r.ok) setError(r.error); router.refresh(); })}>Remove</button> : null}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => onFile(e.target.files?.[0])} aria-label={`Upload ${title}`} />
    </li>
  );
}
