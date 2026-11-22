"use client";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { summarize, type Check, type CheckGroup, type CheckStatus } from "@/lib/diagnostics";
import { runLiveDiagnostics } from "@/app/actions/diagnostics";
import { discardUpload, uploadImage } from "./uploadImage";

const GROUPS: CheckGroup[] = ["Environment", "Supabase", "Storage (R2)", "AI (Gemini)", "Deployment"];
const BADGE: Record<CheckStatus, { cls: string; label: string; mark: string }> = {
  ok: { cls: "badge-ok", label: "OK", mark: "✓" },
  warn: { cls: "badge-new", label: "Warning", mark: "!" },
  fail: { cls: "badge-cancel", label: "Problem", mark: "✕" },
  info: { cls: "badge-draft", label: "Info", mark: "i" },
};

// 1×1 PNG used for the browser upload test.
const TINY_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export function DiagnosticsPanel({ initial, siteOrigin }: { initial: Check[]; siteOrigin: string }) {
  const [live, setLive] = useState<Check[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [browser, setBrowser] = useState<{ state: "idle" | "running" | "ok" | "fail"; detail?: string }>({ state: "idle" });

  const all = [...initial, ...(live ?? [])];
  const sum = summarize(all);

  function runLive() {
    setError(null);
    start(async () => {
      const r = await runLiveDiagnostics(siteOrigin);
      if (r.ok) setLive(r.checks);
      else setError(r.error);
    });
  }

  async function testBrowserUpload() {
    setBrowser({ state: "running" });
    try {
      const bytes = Uint8Array.from(atob(TINY_PNG), (c) => c.charCodeAt(0));
      const file = new File([bytes], "diagnostic.png", { type: "image/png" });
      const id = await uploadImage(file, "site");
      await discardUpload(id);
      setBrowser({ state: "ok", detail: "A test image uploaded straight from this browser to storage, was verified by the server, and was deleted again. Photo uploads will work." });
    } catch (e) {
      setBrowser({ state: "fail", detail: e instanceof Error ? e.message : "The test upload failed." });
    }
  }

  return (
    <div className="space-y-5">
      <section className="admin-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between" aria-live="polite">
        <div>
          <h2 className="text-[26px]">{live ? (sum.fail ? `${sum.fail} problem${sum.fail > 1 ? "s" : ""} found` : sum.warn ? "Working, with warnings" : "Everything checked looks good") : "Configuration check"}</h2>
          <p className="text-[14px] text-muted">{sum.ok} OK · {sum.warn} warning{sum.warn === 1 ? "" : "s"} · {sum.fail} problem{sum.fail === 1 ? "" : "s"}{live ? "" : " — run the live tests to also check the connections"}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={runLive} disabled={pending} aria-busy={pending}>
          {pending ? "Testing connections…" : live ? "Run live tests again" : "Run live tests"}
        </button>
      </section>
      {error ? <p role="alert" className="rounded bg-cancel-bg px-4 py-3 text-[14px] text-cancel-ink">{error}</p> : null}

      {pending ? (
        <ul className="admin-card space-y-3 p-5" aria-label="Running tests">
          {["Database and sign-in", "Storage bucket", "Upload, download and delete test", "AI key"].map((t, i) => (
            <li key={t} className="flex items-center gap-3 text-[14.5px] text-muted" style={{ animationDelay: `${i * 120}ms` }}>
              <span className="spinner" aria-hidden="true" /> {t}…
            </li>
          ))}
        </ul>
      ) : null}

      {GROUPS.map((g) => {
        const rows = all.filter((c) => c.group === g);
        if (!rows.length) return null;
        return (
          <section key={g} className="admin-card p-5" aria-labelledby={`g-${g}`}>
            <h2 id={`g-${g}`} className="text-[24px]">{g}</h2>
            <ul className="mt-2 divide-y divide-line">
              {rows.map((c) => (
                <li key={c.id} className="fade-in flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-4">
                  <span className={`badge ${BADGE[c.status].cls} w-fit shrink-0 sm:w-24 sm:justify-center`}><span aria-hidden="true" className="mr-1">{BADGE[c.status].mark}</span>{BADGE[c.status].label}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{c.label}</p>
                    <p className="break-words text-[14px] text-muted">{c.detail}</p>
                    {c.fix ? <p className="mt-1 break-words text-[14px]"><b>Fix:</b> {c.fix}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section className="admin-card p-5" aria-labelledby="bt">
        <h2 id="bt" className="text-[24px]">Browser upload test</h2>
        <p className="mt-1 text-[14px] text-muted">Uploads a 1-pixel test image from <b>this browser</b> straight to Cloudflare R2, then removes it. This is the check that catches a missing or wrong CORS rule — the usual reason for “Upload to storage failed”. Your site address (the allowed origin) is <code className="rounded bg-rose-tint px-1">{siteOrigin}</code>.</p>
        <button type="button" className="btn btn-outline mt-3" onClick={testBrowserUpload} disabled={browser.state === "running"} aria-busy={browser.state === "running"}>
          {browser.state === "running" ? "Uploading test image…" : "Test browser upload"}
        </button>
        {browser.state === "ok" ? <p role="status" className="fade-in mt-3 flex items-start gap-2 rounded bg-ok-bg px-3 py-2 text-[14px] text-ok-ink"><Icon name="check-circle" size={18} className="mt-0.5 shrink-0" />{browser.detail}</p> : null}
        {browser.state === "fail" ? <p role="alert" className="fade-in mt-3 rounded bg-cancel-bg px-3 py-2 text-[14px] text-cancel-ink">{browser.detail}</p> : null}
      </section>
    </div>
  );
}
