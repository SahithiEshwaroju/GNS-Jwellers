import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { MAX_UPLOAD_BYTES, OBJECT_KEY_PATTERN, sniffImageType } from "@/lib/media-rules";

// Pure backup file format (no server or browser APIs). A backup is a ZIP:
//   manifest.json        what / when / counts
//   data/<table>.json    one file per table (arrays of rows)
//   images/<object key>  every ready photo, byte for byte
//   README.txt           plain-language description
export const BACKUP_FORMAT = "gns-jewellers-backup";
export const BACKUP_VERSION = 1;

/** Tables in parent-first order. Accounts (auth, profiles, admins, saved items, views, activity log) are never backed up. */
export const BACKUP_TABLES = [
  "site_settings", "media", "categories", "subcategories", "collections", "tags", "products", "product_tags",
  "product_images", "site_images", "rate_updates", "enquiries", "enquiry_items", "orders", "order_items",
] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];
export type Row = Record<string, unknown>;
export type Tables = Record<BackupTable, Row[]>;

/** rate_updates hides the author columns from everyone (column-level grants); export only what is readable. */
export const TABLE_COLUMNS: Partial<Record<BackupTable, string>> = {
  rate_updates: "id,gold22_per_10g,silver_per_kg,gst_percent,is_sample,created_at",
};

export type MediaRef = { id: string; object_key: string; content_type: string; size_bytes: number };

export type Manifest = {
  format: typeof BACKUP_FORMAT;
  version: number;
  created_at: string;
  counts: Record<string, number>;
  images: number;
  image_bytes: number;
};

export const MAX_BACKUP_IMAGES = 5000;
export const MAX_TABLE_ROWS = 50_000;

export function emptyTables(): Tables {
  return Object.fromEntries(BACKUP_TABLES.map((t) => [t, []])) as unknown as Tables;
}

/** Only ready photos are backed up; rows that point at skipped (pending) photos are cleaned so the restore stays consistent. */
export function sanitizeTables(input: Tables): Tables {
  const t = JSON.parse(JSON.stringify(input)) as Tables;
  t.media = t.media.filter((m) => m.status === "ready");
  const ids = new Set(t.media.map((m) => m.id as string));
  t.product_images = t.product_images.filter((r) => ids.has(r.media_id as string));
  t.site_images = t.site_images.filter((r) => ids.has(r.media_id as string));
  for (const tbl of ["categories", "collections"] as const) {
    for (const r of t[tbl]) if (r.image_media_id && !ids.has(r.image_media_id as string)) r.image_media_id = null;
  }
  return t;
}

export function buildManifest(tables: Tables, imageBytes: number, now = new Date()): Manifest {
  return {
    format: BACKUP_FORMAT, version: BACKUP_VERSION, created_at: now.toISOString(),
    counts: Object.fromEntries(BACKUP_TABLES.map((k) => [k, tables[k].length])),
    images: tables.media.length, image_bytes: imageBytes,
  };
}

const README = `GNS Jewellers website backup
==============================
data/*.json   all website data: site text and headings (site_settings), categories, products, rates, enquiries, orders...
images/       every product and website photo, kept under its storage path
manifest.json what is inside and when it was made

Restore it from Admin -> Backup -> Restore. Do not edit the files by hand.
Customer enquiries and order details in this file are private: keep it somewhere safe.
`;

/** images: object key -> bytes. */
export function createBackupZip(tables: Tables, images: Map<string, Uint8Array>, now = new Date()): Uint8Array {
  let imageBytes = 0;
  const files: Zippable = {};
  for (const [key, bytes] of images) {
    imageBytes += bytes.length;
    files[`images/${key}`] = [bytes, { level: 0 }]; // photos are already compressed
  }
  for (const k of BACKUP_TABLES) files[`data/${k}.json`] = strToU8(JSON.stringify(tables[k]));
  files["manifest.json"] = strToU8(JSON.stringify(buildManifest(tables, imageBytes, now), null, 2));
  files["README.txt"] = strToU8(README);
  return zipSync(files);
}

export type ParsedBackup = { manifest: Manifest; tables: Tables; images: Map<string, Uint8Array> };

/** Reads and strictly validates a backup. Throws an Error with a plain message when the file is not usable. */
export function readBackupZip(bytes: Uint8Array): ParsedBackup {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, {
      filter: (f) => {
        if (f.name.endsWith("/")) return false;
        if (f.originalSize > Math.max(MAX_UPLOAD_BYTES, 40 * 1024 * 1024)) throw new Error("A file inside the backup is unreasonably large.");
        return true;
      },
    });
  } catch (e) {
    throw new Error(e instanceof Error && /unreasonably/.test(e.message) ? e.message : "This is not a valid backup file (it could not be opened as a ZIP).");
  }
  const mf = entries["manifest.json"];
  if (!mf) throw new Error("This is not a GNS Jewellers backup (manifest.json is missing).");
  let manifest: Manifest;
  try { manifest = JSON.parse(strFromU8(mf)) as Manifest; } catch { throw new Error("The backup manifest is damaged."); }
  if (manifest.format !== BACKUP_FORMAT) throw new Error("This is not a GNS Jewellers backup.");
  if (manifest.version !== BACKUP_VERSION) throw new Error(`Unsupported backup version ${String(manifest.version)}.`);

  const tables = emptyTables();
  for (const k of BACKUP_TABLES) {
    const raw = entries[`data/${k}.json`];
    if (!raw) throw new Error(`The backup is incomplete: data/${k}.json is missing.`);
    let rows: unknown;
    try { rows = JSON.parse(strFromU8(raw)); } catch { throw new Error(`data/${k}.json is damaged.`); }
    if (!Array.isArray(rows) || rows.length > MAX_TABLE_ROWS || rows.some((r) => r === null || typeof r !== "object" || Array.isArray(r)))
      throw new Error(`data/${k}.json has an invalid format.`);
    tables[k] = rows as Row[];
  }

  const images = new Map<string, Uint8Array>();
  for (const m of tables.media) {
    const key = String(m.object_key ?? "");
    if (!OBJECT_KEY_PATTERN.test(key) || key.includes("..")) throw new Error("The backup contains an invalid image path.");
    if (images.size >= MAX_BACKUP_IMAGES) throw new Error("The backup has too many images.");
    const data = entries[`images/${key}`];
    if (!data) throw new Error(`An image is missing from the backup (${key}).`);
    if (data.length > MAX_UPLOAD_BYTES || data.length !== m.size_bytes) throw new Error(`Image ${key} does not match its recorded size.`);
    if (sniffImageType(data) !== m.content_type) throw new Error(`Image ${key} is not a valid ${String(m.content_type)} file.`);
    images.set(key, data);
  }
  return { manifest, tables, images };
}
