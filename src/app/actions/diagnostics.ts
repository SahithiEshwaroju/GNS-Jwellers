"use server";

import { assertAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { r2Configured, geminiConfigured } from "@/lib/server-env";
import { checkBucket, deleteObjects, headObject, presignDownload, presignUpload, readBucketCors } from "@/lib/r2";
import { pingGemini } from "@/lib/ai/gemini";
import { explainR2Error, type Check } from "@/lib/diagnostics";

const PNG_1X1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

/** Live connectivity tests for the admin System Check page. Admin-only; returns verdicts, never secret values. */
export async function runLiveDiagnostics(siteOrigin: string): Promise<{ ok: true; checks: Check[] } | { ok: false; error: string }> {
  try {
    await assertAdmin();
  } catch {
    return { ok: false, error: "Your admin session has ended. Please sign in again." };
  }
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);

  // ---- Supabase database / auth
  const supabase = await createClient();
  const t0 = Date.now();
  const { error: dbErr } = await supabase.from("site_settings").select("id").eq("id", 1).single();
  add(dbErr
    ? { id: "sb-db", group: "Supabase", label: "Database connection", status: "fail", detail: `query failed (${dbErr.code ?? "error"})`, fix: "Check NEXT_PUBLIC_SUPABASE_URL / ANON_KEY and that the Supabase project is not paused." }
    : { id: "sb-db", group: "Supabase", label: "Database connection", status: "ok", detail: `reachable · ${Date.now() - t0} ms · settings row present` });

  const { data: admin } = await supabase.rpc("is_admin");
  add({ id: "sb-admin", group: "Supabase", label: "Your account is an admin (is_admin)", status: admin === true ? "ok" : "fail", detail: admin === true ? "yes" : "no" });

  const [{ count: cats }, { count: rates }] = await Promise.all([
    supabase.from("categories").select("id", { count: "exact", head: true }),
    supabase.from("rate_updates").select("id", { count: "exact", head: true }),
  ]);
  add({ id: "sb-cats", group: "Supabase", label: "Categories", status: cats ? "ok" : "warn", detail: `${cats ?? 0} created`, fix: cats ? undefined : "Create at least one category (Categories & Collections) before adding products." });
  add({ id: "sb-rates", group: "Supabase", label: "Gold & silver rates", status: rates ? "ok" : "warn", detail: rates ? "set" : "not set — prices are hidden until you save rates", fix: rates ? undefined : "Open Gold & Silver Rates and save today's rates." });

  try {
    const r = await fetch(`${publicEnv.supabaseUrl}/auth/v1/settings`, { headers: { apikey: publicEnv.supabaseAnonKey }, signal: AbortSignal.timeout(10_000) });
    const s = (await r.json()) as { external?: Record<string, boolean> };
    const on = Object.entries(s.external ?? {}).filter(([, v]) => v).map(([k]) => k);
    add({ id: "sb-auth", group: "Supabase", label: "Sign-in providers enabled", status: on.includes("google") ? (on.includes("email") ? "warn" : "ok") : "fail", detail: on.join(", ") || "none",
      fix: !on.includes("google") ? "Enable Google in Supabase → Authentication → Providers." : on.includes("email") ? "Disable the Email provider — this app signs in with Google only." : undefined });
  } catch {
    add({ id: "sb-auth", group: "Supabase", label: "Sign-in providers enabled", status: "warn", detail: "could not read auth settings" });
  }

  // ---- R2
  if (!r2Configured()) {
    add({ id: "r2-live", group: "Storage (R2)", label: "Storage connection", status: "fail", detail: "not tested — one or more R2 variables are missing", fix: "Fix the Environment checks above first." });
  } else {
    let reachable = false;
    try {
      await checkBucket();
      reachable = true;
      add({ id: "r2-bucket", group: "Storage (R2)", label: "Bucket reachable with these credentials", status: "ok", detail: "yes" });
    } catch (e) {
      const x = explainR2Error(e);
      add({ id: "r2-bucket", group: "Storage (R2)", label: "Bucket reachable with these credentials", status: "fail", ...x });
    }
    if (reachable) {
      const key = `site/diagnostics/${crypto.randomUUID().replace(/-/g, "")}.png`;
      try {
        const putUrl = await presignUpload(key, "image/png", PNG_1X1.length);
        const put = await fetch(putUrl, { method: "PUT", body: PNG_1X1, headers: { "Content-Type": "image/png" }, signal: AbortSignal.timeout(15_000) });
        if (!put.ok) throw Object.assign(new Error(`upload returned HTTP ${put.status}`), { $metadata: { httpStatusCode: put.status } });
        const head = await headObject(key);
        const get = await fetch(await presignDownload(key, "image/png"), { signal: AbortSignal.timeout(15_000) });
        const same = get.ok && (await get.arrayBuffer()).byteLength === PNG_1X1.length;
        add({ id: "r2-roundtrip", group: "Storage (R2)", label: "Server-side write → read → delete test", status: head && same ? "ok" : "fail", detail: head && same ? "signed upload and signed download both work" : "upload succeeded but could not be read back" });
      } catch (e) {
        const x = explainR2Error(e);
        add({ id: "r2-roundtrip", group: "Storage (R2)", label: "Server-side write → read → delete test", status: "fail", ...x });
      } finally {
        await deleteObjects([key]).catch(() => undefined);
      }
      try {
        const rules = await readBucketCors();
        const allowed = rules.some((r) => (r.origins.includes("*") || r.origins.includes(siteOrigin)) && r.methods.includes("PUT"));
        add({ id: "r2-cors", group: "Storage (R2)", label: "CORS rule allows browser uploads from this site", status: allowed ? "ok" : "fail",
          detail: rules.length ? `${rules.length} rule(s); ${allowed ? `allows PUT from ${siteOrigin}` : `none allows PUT from ${siteOrigin}`}` : "no CORS rules on the bucket",
          fix: allowed ? undefined : `In Cloudflare → R2 → your bucket → Settings → CORS policy, allow origin ${siteOrigin}, methods PUT and GET, header content-type.` });
      } catch (e) {
        const name = (e as { name?: string })?.name ?? "";
        add({ id: "r2-cors", group: "Storage (R2)", label: "CORS rule allows browser uploads from this site", status: "info",
          detail: /NoSuchCORS/i.test(name) ? "the bucket has no CORS rules" : "could not read the rules (normal for an object-only token)",
          fix: /NoSuchCORS/i.test(name) ? `Add a CORS policy in Cloudflare allowing origin ${siteOrigin} (PUT, GET, header content-type).` : "Use the “Test browser upload” button below: it checks CORS from your actual browser." });
      }
    }
  }

  // ---- Gemini
  if (geminiConfigured()) {
    const g = await pingGemini();
    add({ id: "gem-live", group: "AI (Gemini)", label: "Gemini call", status: g.ok ? "ok" : "fail", detail: g.ok ? "the key and model work" : g.detail, fix: g.ok ? undefined : "Check GEMINI_API_KEY and GEMINI_MODEL in Netlify." });
  }
  return { ok: true, checks };
}
