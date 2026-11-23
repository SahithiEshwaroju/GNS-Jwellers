"use server";

import { revalidatePath } from "next/cache";
import type { Json } from "@/lib/supabase/database.types";
import { assertAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteObjects, headObject, presignDownload, presignUpload, readObjectHead } from "@/lib/r2";
import { r2Configured } from "@/lib/server-env";
import { BACKUP_TABLES, TABLE_COLUMNS, type BackupTable, type MediaRef, type Row, type Tables } from "@/lib/backup/format";
import { OBJECT_KEY_PATTERN, validateUpload, verifyUploadedObject, isAllowedType } from "@/lib/media-rules";

// Admin-only helpers for the browser-driven Backup page. Photos never pass through these functions:
// they hand out short-lived signed URLs and the browser moves the bytes directly to/from storage.
type Fail = { ok: false; error: string };
const PAGE = 500;
const MAX_BATCH = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DENIED: Fail = { ok: false, error: "Your admin session has ended. Please sign in again." };

async function admin(): Promise<boolean> {
  try { await assertAdmin(); return true; } catch { return false; }
}

export async function backupTablePage(table: string, offset: number): Promise<{ ok: true; rows: Row[]; done: boolean } | Fail> {
  if (!(await admin())) return DENIED;
  if (!(BACKUP_TABLES as readonly string[]).includes(table) || !Number.isInteger(offset) || offset < 0) return { ok: false, error: "Invalid request." };
  const t = table as BackupTable;
  const supabase = await createClient();
  let q = supabase.from(t).select(TABLE_COLUMNS[t] ?? "*");
  // Stable paging needs a deterministic order: product_tags and site_images have no `id` column.
  q = t === "product_tags" ? q.order("product_id").order("tag_id") : t === "site_images" ? q.order("slot") : q.order("id");
  const { data, error } = await q.range(offset, offset + PAGE - 1);
  if (error) return { ok: false, error: `Could not read ${t} (${error.code ?? "error"}).` };
  const rows = (data ?? []) as unknown as Row[];
  return { ok: true, rows, done: rows.length < PAGE };
}

export async function backupDownloadUrls(ids: string[]): Promise<{ ok: true; urls: Record<string, string> } | Fail> {
  if (!(await admin())) return DENIED;
  if (!r2Configured()) return { ok: false, error: "Image storage is not configured." };
  if (!Array.isArray(ids) || ids.length > MAX_BATCH || ids.some((i) => typeof i !== "string" || !UUID.test(i))) return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("media").select("id,object_key,content_type").in("id", ids).eq("status", "ready");
  if (error) return { ok: false, error: "Could not read the photo list." };
  const urls: Record<string, string> = {};
  for (const m of data ?? []) {
    if (OBJECT_KEY_PATTERN.test(m.object_key) && isAllowedType(m.content_type)) urls[m.id] = await presignDownload(m.object_key, m.content_type);
  }
  return { ok: true, urls };
}

function validItems(items: unknown): items is MediaRef[] {
  return Array.isArray(items) && items.length <= MAX_BATCH && items.every((m) =>
    m && typeof m.object_key === "string" && OBJECT_KEY_PATTERN.test(m.object_key) && !m.object_key.includes("..") &&
    typeof m.content_type === "string" && validateUpload(m.content_type, m.size_bytes) === null);
}

export async function presignRestoreImages(items: MediaRef[]): Promise<{ ok: true; urls: Record<string, string> } | Fail> {
  if (!(await admin())) return DENIED;
  if (!r2Configured()) return { ok: false, error: "Image storage is not configured." };
  if (!validItems(items)) return { ok: false, error: "The backup contains an image that is not allowed." };
  const urls: Record<string, string> = {};
  for (const m of items) if (isAllowedType(m.content_type)) urls[m.object_key] = await presignUpload(m.object_key, m.content_type, m.size_bytes);
  return { ok: true, urls };
}

export async function verifyRestoredImages(items: MediaRef[]): Promise<{ ok: true; bad: string[] } | Fail> {
  if (!(await admin())) return DENIED;
  if (!validItems(items)) return { ok: false, error: "Invalid request." };
  const bad: string[] = [];
  for (const m of items) {
    try {
      const head = await headObject(m.object_key);
      const first = head ? await readObjectHead(m.object_key) : null;
      if (verifyUploadedObject({ size: m.size_bytes, contentType: m.content_type }, head, first)) bad.push(m.object_key);
    } catch { bad.push(m.object_key); }
  }
  return { ok: true, bad };
}

export async function restoreDatabase(tables: Tables): Promise<{ ok: true; counts: Record<string, number> } | Fail> {
  if (!(await admin())) return DENIED;
  const keys = tables && typeof tables === "object" ? Object.keys(tables) : [];
  if (keys.length === 0 || keys.some((k) => !(BACKUP_TABLES as readonly string[]).includes(k)) || keys.some((k) => !Array.isArray((tables as Record<string, unknown>)[k])))
    return { ok: false, error: "The backup data is not in the expected format." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_restore_backup", { p_tables: tables as unknown as Json });
  if (error) return { ok: false, error: `The database rejected the backup, so nothing was changed. (${error.message})` };
  revalidatePath("/", "layout");
  return { ok: true, counts: (data ?? {}) as Record<string, number> };
}

/** Deletes ALL website content and its photos. Admin accounts are kept. The browser downloads a backup first by default. */
export async function resetWebsite(): Promise<{ ok: true; photosDeleted: number; photosFailed: boolean } | Fail> {
  if (!(await admin())) return DENIED;
  const supabase = await createClient();
  const { data: media, error: readErr } = await supabase.from("media").select("object_key");
  if (readErr) return { ok: false, error: "Could not read the photo list, so nothing was deleted." };
  const keys = (media ?? []).map((m) => m.object_key).filter((k) => OBJECT_KEY_PATTERN.test(k));
  const { error } = await supabase.rpc("admin_reset_website");
  if (error) return { ok: false, error: `The database refused the reset, so nothing was deleted. (${error.message})` };
  let photosFailed = false;
  if (keys.length && r2Configured()) {
    try { await deleteObjects(keys); } catch { photosFailed = true; }
  }
  revalidatePath("/", "layout");
  return { ok: true, photosDeleted: photosFailed ? 0 : keys.length, photosFailed };
}
