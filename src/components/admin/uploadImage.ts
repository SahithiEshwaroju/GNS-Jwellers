"use client";
import { validateUpload, type UploadPurpose } from "@/lib/media-rules";

/** presign → direct PUT to storage (with progress) → server verification. Returns the media id. */
export async function uploadImage(file: File, purpose: UploadPurpose, onProgress?: (pct: number) => void): Promise<string> {
  const problem = validateUpload(file.type, file.size);
  if (problem) throw new Error(problem);
  const pres = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purpose, contentType: file.type, size: file.size }),
  });
  const p = (await pres.json().catch(() => ({}))) as { ok?: boolean; error?: string; mediaId?: string; uploadUrl?: string };
  if (!pres.ok || !p.mediaId || !p.uploadUrl) throw new Error(p.error ?? "Couldn't start the upload.");
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", p.uploadUrl!);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Storage refused the upload (HTTP ${xhr.status}). Check the R2 API token permissions and the bucket name — see Admin → System Check.`)));
    xhr.onerror = () => reject(new Error("The browser could not reach storage. Your internet is usually fine — this is most often a missing or wrong CORS rule on the Cloudflare R2 bucket for this site, or a wrong R2 account ID. Open Admin → System Check to find out which."));
    xhr.send(file);
  });
  const done = await fetch("/api/uploads/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaId: p.mediaId }) });
  const d = (await done.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!done.ok || !d.ok) throw new Error(d.error ?? "The upload couldn't be verified.");
  return p.mediaId;
}

export async function discardUpload(mediaId: string): Promise<void> {
  await fetch("/api/uploads/discard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaId }) }).catch(() => undefined);
}
