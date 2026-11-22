// Pure helpers for the admin "System Check" page. Never contains or returns secret values — only presence,
// length and format verdicts — so it is safe to import from both server and client code.

export type CheckStatus = "ok" | "warn" | "fail" | "info";
export type CheckGroup = "Environment" | "Supabase" | "Storage (R2)" | "AI (Gemini)" | "Deployment";
export type Check = { id: string; group: CheckGroup; label: string; status: CheckStatus; detail: string; fix?: string };

export type Origin = { host: string; https: boolean };
type Env = Record<string, string | undefined>;

const has = (v: string | undefined) => typeof v === "string" && v.trim().length > 0;
const len = (v: string | undefined) => (has(v) ? `set (${v!.trim().length} characters)` : "missing");

function jwtRole(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return (JSON.parse(json) as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}

/** Static checks on the environment variables. `env` is injected so this can be unit-tested. */
export function envChecks(env: Env, origin: Origin): Check[] {
  const out: Check[] = [];
  const add = (c: Omit<Check, "group"> & { group?: CheckGroup }) => out.push({ group: "Environment", ...c });

  // Supabase URL
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!has(url)) add({ id: "sb-url", label: "NEXT_PUBLIC_SUPABASE_URL", status: "fail", detail: "missing", fix: "Add it in Netlify → Site configuration → Environment variables, then redeploy." });
  else if (!/^https:\/\/[a-z0-9]{10,}\.supabase\.co$/.test(url!)) add({ id: "sb-url", label: "NEXT_PUBLIC_SUPABASE_URL", status: "warn", detail: `set, but the format looks unusual (${url})`, fix: "It should look like https://<project-ref>.supabase.co with no trailing slash or path." });
  else add({ id: "sb-url", label: "NEXT_PUBLIC_SUPABASE_URL", status: "ok", detail: url! });

  // Supabase anon key — must be the PUBLIC key, never a secret/service-role key
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!has(key)) add({ id: "sb-key", label: "NEXT_PUBLIC_SUPABASE_ANON_KEY", status: "fail", detail: "missing", fix: "Add the publishable key (starts sb_publishable_) from Supabase → Settings → API Keys." });
  else if (key!.startsWith("sb_secret_") || jwtRole(key!) === "service_role")
    add({ id: "sb-key", label: "NEXT_PUBLIC_SUPABASE_ANON_KEY", status: "fail", detail: "this looks like a SECRET (service-role) key in a public variable", fix: "Remove it immediately, rotate the key in Supabase, and use the publishable key instead. Anything NEXT_PUBLIC_ is sent to every visitor." });
  else if (key!.startsWith("sb_publishable_") || key!.startsWith("eyJ")) add({ id: "sb-key", label: "NEXT_PUBLIC_SUPABASE_ANON_KEY", status: "ok", detail: `${key!.startsWith("sb_publishable_") ? "publishable key" : "legacy anon key"} · ${len(key)}` });
  else add({ id: "sb-key", label: "NEXT_PUBLIC_SUPABASE_ANON_KEY", status: "warn", detail: `set (${key!.length} characters) but the format is not recognised` });

  // Site URL
  const site = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!has(site)) add({ id: "site-url", label: "NEXT_PUBLIC_SITE_URL", status: "fail", detail: "missing", fix: "Set it to your exact https site address and redeploy. It builds the product links inside WhatsApp messages." });
  else {
    let host = "";
    try { host = new URL(site!).host; } catch { /* handled below */ }
    if (!host) add({ id: "site-url", label: "NEXT_PUBLIC_SITE_URL", status: "fail", detail: `not a valid URL (${site})` });
    else if (!site!.startsWith("https://")) add({ id: "site-url", label: "NEXT_PUBLIC_SITE_URL", status: origin.https ? "fail" : "warn", detail: `${site} — not https`, fix: "Use https. Without it session cookies are not marked Secure." });
    else if (site!.endsWith("/")) add({ id: "site-url", label: "NEXT_PUBLIC_SITE_URL", status: "warn", detail: `${site} — has a trailing slash`, fix: "Remove the trailing slash and redeploy." });
    else if (host !== origin.host) add({ id: "site-url", label: "NEXT_PUBLIC_SITE_URL", status: "warn", detail: `${site}, but you are visiting ${origin.host}`, fix: "They should match (unless you use a custom domain as the main address). Update the variable and redeploy; also update Supabase Site URL and R2 CORS." });
    else add({ id: "site-url", label: "NEXT_PUBLIC_SITE_URL", status: "ok", detail: site! });
  }

  // R2
  const r2Missing = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"].filter((k) => !has(env[k]));
  for (const k of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) {
    const id = `r2-${k.toLowerCase()}`;
    if (!has(env[k])) add({ id, group: "Storage (R2)", label: k, status: "fail", detail: "missing", fix: "Add it in Netlify environment variables (secret keys: tick “Contains secret values”) and redeploy." });
    else if (k === "R2_ACCOUNT_ID" && !/^[a-f0-9]{32}$/i.test(env[k]!.trim())) add({ id, group: "Storage (R2)", label: k, status: "warn", detail: `${len(env[k])} — a Cloudflare account ID is normally 32 hex characters`, fix: "Copy the Account ID from the R2 overview page in Cloudflare." });
    else add({ id, group: "Storage (R2)", label: k, status: "ok", detail: k === "R2_BUCKET" ? env[k]!.trim() : len(env[k]) });
  }
  if (has(env.R2_ENDPOINT)) add({ id: "r2-endpoint", group: "Storage (R2)", label: "R2_ENDPOINT", status: "warn", detail: "set — uploads go to this custom address instead of Cloudflare R2", fix: "Delete R2_ENDPOINT in Netlify unless you are deliberately testing against a local S3 server." });
  if (r2Missing.length === 0 && !has(env.R2_ENDPOINT)) add({ id: "r2-host", group: "Storage (R2)", label: "Upload host", status: "info", detail: `https://${env.R2_ACCOUNT_ID!.trim()}.r2.cloudflarestorage.com` });

  // Gemini
  add({ id: "gem-key", group: "AI (Gemini)", label: "GEMINI_API_KEY", status: has(env.GEMINI_API_KEY) ? "ok" : "info", detail: has(env.GEMINI_API_KEY) ? len(env.GEMINI_API_KEY) : "not set — AI features are off; manual entry still works" });
  add({ id: "gem-model", group: "AI (Gemini)", label: "GEMINI_MODEL", status: "info", detail: has(env.GEMINI_MODEL) ? env.GEMINI_MODEL!.trim() : "default (gemini-2.5-flash)" });

  // Deployment
  add({ id: "dep-node", group: "Deployment", label: "Runtime", status: "info", detail: `Node ${env.NODE_VERSION_ACTUAL ?? process.version} · NODE_ENV=${env.NODE_ENV ?? "?"}` });
  add({ id: "dep-netlify", group: "Deployment", label: "Hosting", status: "info", detail: has(env.NETLIFY) ? `Netlify (${env.CONTEXT ?? "unknown context"})` : "not running on Netlify" });
  add({ id: "dep-https", group: "Deployment", label: "This page is served over", status: origin.https ? "ok" : "warn", detail: `${origin.https ? "https" : "http"}://${origin.host}`, fix: origin.https ? undefined : "Production should be https." });
  return out;
}

/** Turns a raw S3/R2 SDK error into a plain-language cause and fix. */
export function explainR2Error(e: unknown): { detail: string; fix: string } {
  const err = e as { name?: string; Code?: string; code?: string; message?: string; $metadata?: { httpStatusCode?: number } };
  const name = err?.name ?? err?.Code ?? err?.code ?? "Error";
  const status = err?.$metadata?.httpStatusCode;
  const base = `${name}${status ? ` (HTTP ${status})` : ""}`;
  if (/InvalidAccessKeyId/i.test(name)) return { detail: `${base}: the Access Key ID is not recognised`, fix: "Check R2_ACCESS_KEY_ID — copy it again from the R2 API token page." };
  if (/SignatureDoesNotMatch/i.test(name)) return { detail: `${base}: the secret key does not match the Access Key ID`, fix: "Check R2_SECRET_ACCESS_KEY (re-create the API token if you lost it) and that R2_ACCOUNT_ID is right." };
  if (/NoSuchBucket|NotFound/i.test(name) && status === 404) return { detail: `${base}: bucket not found`, fix: "R2_BUCKET must be the exact bucket name, and the token must belong to the same account." };
  if (/AccessDenied|Forbidden/i.test(name) || status === 403) return { detail: `${base}: the token is not allowed to do this`, fix: "Give the R2 API token “Object Read & Write” on this bucket." };
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(`${name} ${err?.message}`)) return { detail: `${base}: the storage host could not be found`, fix: "R2_ACCOUNT_ID is probably wrong (the address is https://<account-id>.r2.cloudflarestorage.com)." };
  if (/ECONNREFUSED|ETIMEDOUT|fetch failed/i.test(`${name} ${err?.message}`)) return { detail: `${base}: could not connect to storage`, fix: "Check R2_ACCOUNT_ID and that R2_ENDPOINT is not set to a local address." };
  return { detail: `${base}${err?.message ? `: ${err.message.slice(0, 160)}` : ""}`, fix: "Check all four R2 variables and the token permissions." };
}

export function summarize(checks: Check[]): { fail: number; warn: number; ok: number } {
  return { fail: checks.filter((c) => c.status === "fail").length, warn: checks.filter((c) => c.status === "warn").length, ok: checks.filter((c) => c.status === "ok").length };
}
