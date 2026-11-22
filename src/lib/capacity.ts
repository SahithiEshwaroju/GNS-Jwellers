import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bucketUsage } from "@/lib/r2";
import { r2Configured } from "@/lib/server-env";

export type Usage = { label: string; used: number | null; limit: number; detail: string; note?: string; error?: string };

const MB = 1024 * 1024, GB = 1024 * MB;
const num = (v: string | undefined, d: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };

/** Database + photo storage usage for System Check. Limits are the plan allowances (override with DB_LIMIT_MB / STORAGE_LIMIT_GB). */
export async function loadCapacity(supabase: SupabaseClient): Promise<Usage[]> {
  const dbLimit = num(process.env.DB_LIMIT_MB, 500) * MB;
  const stLimit = num(process.env.STORAGE_LIMIT_GB, 10) * GB;
  const out: Usage[] = [];

  const { data, error } = await supabase.rpc("admin_storage_stats");
  if (error || !data) out.push({ label: "Database", used: null, limit: dbLimit, detail: "", error: "Could not read database size." });
  else {
    const tables = Object.entries((data.tables ?? {}) as Record<string, number>).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([n, b]) => `${n} ${(b / MB).toFixed(1)} MB`).join(" · ");
    out.push({ label: "Database", used: Number(data.db_bytes), limit: dbLimit, detail: `Largest tables: ${tables}`,
      note: "Includes Supabase's built-in system data. Plan limit defaults to the Free plan (500 MB); set DB_LIMIT_MB if yours differs." });
  }

  if (!r2Configured()) out.push({ label: "Photo storage (R2)", used: null, limit: stLimit, detail: "", error: "Storage is not configured." });
  else {
    try {
      const u = await bucketUsage();
      out.push({ label: "Photo storage (R2)", used: u.bytes, limit: stLimit,
        detail: `${u.objects.toLocaleString("en-IN")} file${u.objects === 1 ? "" : "s"}${u.complete ? "" : " (counted partially)"}${data ? ` · ${Number(data.media_count)} photo records` : ""}`,
        note: "Cloudflare does not report your plan allowance to the app. The limit defaults to the 10 GB free tier; set STORAGE_LIMIT_GB if yours differs." });
    } catch {
      out.push({ label: "Photo storage (R2)", used: null, limit: stLimit, detail: "", error: "Could not list the bucket (the access token may not allow listing)." });
    }
  }
  return out;
}
