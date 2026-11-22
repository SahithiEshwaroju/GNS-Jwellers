import { headers } from "next/headers";
import { PageHeader } from "@/components/admin/PageHeader";
import { DiagnosticsPanel } from "@/components/admin/DiagnosticsPanel";
import { envChecks } from "@/lib/diagnostics";

export const metadata = { title: "System Check" };

export default async function DiagnosticsPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const https = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim() === "https";
  // Presence/format only — secret values are never read into the page.
  const checks = envChecks(
    {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
      R2_BUCKET: process.env.R2_BUCKET,
      R2_ENDPOINT: process.env.R2_ENDPOINT,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      GEMINI_MODEL: process.env.GEMINI_MODEL,
      NODE_ENV: process.env.NODE_ENV,
      NETLIFY: process.env.NETLIFY,
      CONTEXT: process.env.CONTEXT,
    },
    { host, https },
  );
  return (
    <>
      <PageHeader title="System Check" subtitle="Diagnose the backend connections and keys. Secret values are never shown — only whether each one is present and working." />
      <DiagnosticsPanel initial={checks} siteOrigin={`${https ? "https" : "http"}://${host}`} />
    </>
  );
}
