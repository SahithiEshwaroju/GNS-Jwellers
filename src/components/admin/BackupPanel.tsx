"use client";
import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { exportBackup, importBackup, type BackupApi, type Progress } from "@/lib/backup/engine";
import { readBackupZip, type Manifest } from "@/lib/backup/format";
import { backupDownloadUrls, backupTablePage, presignRestoreImages, resetWebsite, restoreDatabase, verifyRestoredImages } from "@/app/actions/backup";

const GONE = "Your admin session has ended. Please sign in again.";
function must<T extends { ok: boolean }>(r: T | undefined): Extract<T, { ok: true }> {
  if (!r) throw new Error(GONE);
  if (!r.ok) throw new Error((r as unknown as { error: string }).error);
  return r as Extract<T, { ok: true }>;
}

const api: BackupApi = {
  tablePage: async (t, o) => { const r = must(await backupTablePage(t, o)); return { rows: r.rows, done: r.done }; },
  downloadUrls: async (ids) => must(await backupDownloadUrls(ids)).urls,
  presignRestore: async (items) => must(await presignRestoreImages(items)).urls,
  verifyRestore: async (items) => must(await verifyRestoredImages(items)).bad,
  restore: async (t) => (await restoreDatabase(t)) ?? { ok: false, error: GONE },
  fetch: (...a) => fetch(...a),
};

type Run = { state: "idle" | "busy" | "ok" | "fail"; phase?: string; done?: number; total?: number; message?: string };

function save(zip: Uint8Array) {
  const blob = new Blob([zip as BlobPart], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gns-jewellers-backup-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function Bar({ run }: { run: Run }) {
  if (run.state !== "busy") return null;
  const pct = run.total ? Math.round(((run.done ?? 0) / run.total) * 100) : 0;
  return (
    <div className="mt-4 fade-in" role="status" aria-live="polite">
      <p className="text-[14px]">{run.phase}{run.total && run.total > 1 ? ` — ${run.done}/${run.total}` : "…"}</p>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-champagne"><div className="h-full rounded-full bg-burgundy" style={{ width: `${Math.max(pct, 4)}%`, transition: "width .3s ease" }} /></div>
    </div>
  );
}

export function BackupPanel() {
  const [exp, setExp] = useState<Run>({ state: "idle" });
  const [imp, setImp] = useState<Run>({ state: "idle" });
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; manifest: Manifest } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [safety, setSafety] = useState(true);
  const [confirm, setConfirm] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const [rst, setRst] = useState<Run>({ state: "idle" });
  const [rstSafety, setRstSafety] = useState(true);
  const [rstConfirm, setRstConfirm] = useState("");

  const progress = (set: (r: Run) => void): Progress => (p) => set({ state: "busy", ...p });

  async function download() {
    setExp({ state: "busy", phase: "Starting", done: 0, total: 1 });
    try {
      const { zip, images } = await exportBackup(api, progress(setExp));
      save(zip);
      setExp({ state: "ok", message: `Backup downloaded — ${images} photo${images === 1 ? "" : "s"} and all website data (${(zip.length / 1048576).toFixed(1)} MB). Keep it somewhere safe: it contains customer enquiries and orders.` });
    } catch (e) {
      setExp({ state: "fail", message: e instanceof Error ? e.message : "The backup failed." });
    }
  }

  async function pick(f: File | undefined) {
    setFile(null); setFileError(null); setImp({ state: "idle" }); setConfirm("");
    if (!f) return;
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const { manifest } = readBackupZip(bytes);
      setFile({ name: f.name, bytes, manifest });
    } catch (e) {
      setFileError(e instanceof Error ? e.message : "That file could not be read.");
    }
  }

  async function restore() {
    if (!file) return;
    try {
      if (safety) {
        setImp({ state: "busy", phase: "Saving a safety backup of the current website first", done: 0, total: 1 });
        const { zip } = await exportBackup(api, progress(setImp));
        save(zip);
      }
      const counts = await importBackup(api, file.bytes, progress(setImp));
      const summary = Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k.replace(/_/g, " ")}`).join(", ");
      setImp({ state: "ok", message: `Restore complete: ${summary || "no rows"}. Reload the pages to see the restored website.` });
      setFile(null); setConfirm("");
      if (input.current) input.current.value = "";
    } catch (e) {
      setImp({ state: "fail", message: e instanceof Error ? e.message : "The restore failed." });
    }
  }

  async function reset() {
    try {
      if (rstSafety) {
        setRst({ state: "busy", phase: "Downloading a backup of everything first", done: 0, total: 1 });
        const { zip } = await exportBackup(api, progress(setRst));
        save(zip); // if this throws, nothing has been deleted
      }
      setRst({ state: "busy", phase: "Deleting all website data and photos", done: 0, total: 1 });
      const r = await resetWebsite();
      if (!r) throw new Error(GONE);
      if (!r.ok) throw new Error(r.error);
      setRst({ state: "ok", message: `The website has been reset to empty${r.photosFailed ? " — but some photos could not be removed from storage (you can delete them in Cloudflare)" : `. ${r.photosDeleted} photo${r.photosDeleted === 1 ? "" : "s"} deleted`}. Admin accounts were kept. Use "Restore" with the starter file to start again.` });
      setRstConfirm("");
    } catch (e) {
      setRst({ state: "fail", message: `${e instanceof Error ? e.message : "The reset failed."} Nothing was deleted.` });
    }
  }

  const m = file?.manifest;
  const busy = exp.state === "busy" || imp.state === "busy" || rst.state === "busy";
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="admin-card p-5">
        <h2 className="flex items-center gap-2 text-[24px]"><Icon name="download" /> Download a backup</h2>
        <p className="mt-2 text-[14px] text-muted">One ZIP file with every photo (original quality), all site text and headings, categories, products, rates, enquiries and orders. Sign-in accounts are not included.</p>
        <button type="button" className="btn btn-primary mt-4" onClick={download} disabled={busy} aria-busy={exp.state === "busy"}>
          {exp.state === "busy" ? "Preparing backup…" : "Download full backup"}
        </button>
        <Bar run={exp} />
        {exp.message ? <p className={`mt-3 text-[14px] fade-in ${exp.state === "fail" ? "text-error" : "text-ok-ink"}`} role={exp.state === "fail" ? "alert" : "status"}>{exp.message}</p> : null}
        <p className="mt-3 text-[12px] text-muted">Photos are downloaded by your browser straight from storage. If this fails, run System Check — the storage bucket needs a CORS rule that allows GET from this site.</p>
      </section>

      <section className="admin-card p-5">
        <h2 className="flex items-center gap-2 text-[24px]"><Icon name="download" className="rotate-180" /> Restore from a backup</h2>
        <p className="mt-2 text-[14px] text-muted"><strong>This replaces</strong> the current products, categories, photos, site text, rates, enquiries and orders with the backup&apos;s. Admin accounts are not changed.</p>
        <label className="mt-4 block text-[14px]" htmlFor="backup-file">Backup file (.zip)</label>
        <input ref={input} id="backup-file" type="file" accept=".zip,application/zip" className="mt-1 block w-full text-[14px]" disabled={busy} onChange={(e) => void pick(e.target.files?.[0])} />
        {fileError ? <p className="mt-2 text-[14px] text-error" role="alert">{fileError}</p> : null}
        {m && file ? (
          <div className="mt-3 rounded-lg bg-champagne p-3 text-[14px] fade-in">
            <p><strong>{file.name}</strong> — made {new Date(m.created_at).toLocaleString("en-IN")}</p>
            <p className="text-muted">{m.images} photos · {m.counts.products ?? 0} products · {m.counts.categories ?? 0} categories · {m.counts.enquiries ?? 0} enquiries · {m.counts.orders ?? 0} orders</p>
            <label className="mt-3 flex items-start gap-2"><input type="checkbox" className="mt-1" checked={safety} onChange={(e) => setSafety(e.target.checked)} disabled={busy} /> <span>Download a safety backup of the current website first (recommended)</span></label>
            <label className="mt-3 block" htmlFor="restore-confirm">Type <strong>RESTORE</strong> to confirm</label>
            <input id="restore-confirm" className="field mt-1 w-full" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" disabled={busy} />
            <button type="button" className="btn btn-primary mt-3" onClick={restore} disabled={busy || confirm !== "RESTORE"} aria-busy={imp.state === "busy"}>
              {imp.state === "busy" ? "Restoring…" : "Restore this backup"}
            </button>
          </div>
        ) : null}
        <Bar run={imp} />
        {imp.message ? <p className={`mt-3 text-[14px] fade-in ${imp.state === "fail" ? "text-error" : "text-ok-ink"}`} role={imp.state === "fail" ? "alert" : "status"}>{imp.message}</p> : null}
        <p className="mt-3 text-[12px] text-muted">Photos are uploaded first and verified; the website data is then replaced in one all-or-nothing step, so a failed restore leaves the current data untouched. The website data must fit in about 5 MB (thousands of products).</p>
      </section>
      <section className="admin-card border-danger p-5 lg:col-span-2" style={{ borderColor: "var(--color-danger)" }}>
        <h2 className="text-[24px] text-danger">Reset the whole website</h2>
        <p className="mt-2 text-[14px] text-muted"><strong>Permanently deletes</strong> every product, category, collection, tag, photo, rate, enquiry, order, saved design and site text, and empties the photo storage. Admin accounts are kept. This cannot be undone — except from a backup.</p>
        <label className="mt-3 flex items-start gap-2 text-[14px]"><input type="checkbox" className="mt-1" checked={rstSafety} onChange={(e) => setRstSafety(e.target.checked)} disabled={busy} /> <span>Download a backup to this device first (recommended). If the backup fails, nothing is deleted.</span></label>
        <label className="mt-3 block text-[14px]" htmlFor="reset-confirm">Type <strong>DELETE EVERYTHING</strong> to confirm</label>
        <input id="reset-confirm" className="field mt-1 w-full max-w-sm" value={rstConfirm} onChange={(e) => setRstConfirm(e.target.value)} autoComplete="off" disabled={busy} />
        <div><button type="button" className="btn mt-3 text-white" style={{ background: "var(--color-danger)" }} onClick={reset} disabled={busy || rstConfirm !== "DELETE EVERYTHING"} aria-busy={rst.state === "busy"}>
          {rst.state === "busy" ? "Working…" : "Reset website"}
        </button></div>
        <Bar run={rst} />
        {rst.message ? <p className={`mt-3 text-[14px] fade-in ${rst.state === "fail" ? "text-error" : "text-ok-ink"}`} role={rst.state === "fail" ? "alert" : "status"}>{rst.message}</p> : null}
      </section>
    </div>
  );
}
