import {
  BACKUP_TABLES, createBackupZip, readBackupZip, sanitizeTables, emptyTables,
  type BackupTable, type MediaRef, type Row, type Tables,
} from "./format";

// Orchestrates backup/restore against an injected API so it can run in the browser (real server actions + fetch)
// and in tests (fake API). Everything heavy happens in the browser: Netlify functions never carry the photos.
export interface BackupApi {
  tablePage(table: BackupTable, offset: number): Promise<{ rows: Row[]; done: boolean }>;
  downloadUrls(mediaIds: string[]): Promise<Record<string, string>>;
  presignRestore(items: MediaRef[]): Promise<Record<string, string>>;
  verifyRestore(items: MediaRef[]): Promise<string[]>; // returns object keys that failed verification
  restore(tables: Tables): Promise<{ ok: true; counts: Record<string, number> } | { ok: false; error: string }>;
  fetch: typeof fetch;
}
export type Progress = (p: { phase: string; done: number; total: number }) => void;

const BATCH = 50;
const CONCURRENCY = 4;

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}
const chunks = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

export async function exportBackup(api: BackupApi, onProgress: Progress = () => undefined): Promise<{ zip: Uint8Array; images: number }> {
  const raw = emptyTables();
  for (const [i, t] of BACKUP_TABLES.entries()) {
    onProgress({ phase: "Reading website data", done: i, total: BACKUP_TABLES.length });
    for (let offset = 0; ; ) {
      const page = await api.tablePage(t, offset);
      raw[t].push(...page.rows);
      offset += page.rows.length;
      if (page.done || page.rows.length === 0) break;
    }
  }
  const tables = sanitizeTables(raw);
  const media = tables.media as unknown as MediaRef[];
  const images = new Map<string, Uint8Array>();
  let done = 0;
  for (const group of chunks(media, BATCH)) {
    const urls = await api.downloadUrls(group.map((m) => m.id));
    await pool(group, CONCURRENCY, async (m) => {
      const url = urls[m.id];
      if (!url) throw new Error(`Could not get a download link for an image (${m.object_key}).`);
      let res: Response;
      try { res = await api.fetch(url); } catch {
        throw new Error("Could not download the photos from storage. Check that the R2 bucket CORS rule allows GET from this site (see System Check).");
      }
      if (!res.ok) throw new Error(`Storage refused an image download (HTTP ${res.status}: ${m.object_key}).`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length !== m.size_bytes) throw new Error(`Image ${m.object_key} downloaded with the wrong size.`);
      images.set(m.object_key, bytes);
      onProgress({ phase: "Downloading photos", done: ++done, total: media.length });
    });
  }
  onProgress({ phase: "Packing the backup file", done: 0, total: 1 });
  const zip = createBackupZip(tables, images);
  onProgress({ phase: "Packing the backup file", done: 1, total: 1 });
  return { zip, images: images.size };
}

export async function importBackup(api: BackupApi, bytes: Uint8Array, onProgress: Progress = () => undefined): Promise<Record<string, number>> {
  onProgress({ phase: "Checking the backup file", done: 0, total: 1 });
  const { tables, images } = readBackupZip(bytes);
  const media = tables.media as unknown as MediaRef[];
  let done = 0;
  for (const group of chunks(media, BATCH)) {
    const urls = await api.presignRestore(group);
    await pool(group, CONCURRENCY, async (m) => {
      const url = urls[m.object_key];
      if (!url) throw new Error(`Storage would not accept an image (${m.object_key}).`);
      let res: Response;
      try {
        res = await api.fetch(url, { method: "PUT", body: images.get(m.object_key) as BodyInit, headers: { "Content-Type": m.content_type } });
      } catch {
        throw new Error("Could not upload the photos to storage. Check that the R2 bucket CORS rule allows PUT from this site (see System Check).");
      }
      if (!res.ok) throw new Error(`Storage refused an image upload (HTTP ${res.status}: ${m.object_key}).`);
      onProgress({ phase: "Restoring photos", done: ++done, total: media.length });
    });
  }
  for (const group of chunks(media, BATCH)) {
    const bad = await api.verifyRestore(group);
    if (bad.length) throw new Error(`${bad.length} restored photo(s) failed verification, so the website data was NOT changed.`);
  }
  onProgress({ phase: "Restoring website data", done: 0, total: 1 });
  const r = await api.restore(tables);
  if (!r.ok) throw new Error(r.error);
  onProgress({ phase: "Restoring website data", done: 1, total: 1 });
  return r.counts;
}
