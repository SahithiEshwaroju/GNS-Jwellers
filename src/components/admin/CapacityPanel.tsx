import type { Usage } from "@/lib/capacity";

function fmt(b: number) {
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}

export function CapacityPanel({ items }: { items: Usage[] }) {
  return (
    <section className="admin-card p-5" aria-labelledby="cap-h">
      <h2 id="cap-h" className="text-[24px]">Storage &amp; database space</h2>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        {items.map((u) => {
          const pct = u.used === null ? 0 : Math.min(100, (u.used / u.limit) * 100);
          const tone = pct >= 90 ? "var(--color-danger)" : pct >= 75 ? "var(--color-antique-gold)" : "var(--color-whatsapp)";
          return (
            <div key={u.label}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[18px]">{u.label}</h3>
                {u.used !== null ? <span className="text-[14px] text-muted">{pct.toFixed(pct < 10 ? 1 : 0)}% used</span> : null}
              </div>
              {u.error ? (
                <p className="mt-2 text-[14px] text-error">{u.error}</p>
              ) : (
                <>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-champagne" role="progressbar" aria-label={`${u.label} used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
                    <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 0.5)}%`, background: tone, transition: "width .6s ease" }} />
                  </div>
                  <p className="mt-2 text-[15px]"><strong>{fmt(u.used ?? 0)}</strong> used · <strong>{fmt(Math.max(0, u.limit - (u.used ?? 0)))}</strong> left of {fmt(u.limit)}</p>
                  {u.detail ? <p className="text-[13px] text-muted">{u.detail}</p> : null}
                  {u.note ? <p className="mt-1 text-[12px] text-muted">{u.note}</p> : null}
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
