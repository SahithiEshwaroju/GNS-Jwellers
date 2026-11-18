"use client";
/** Polite live region for form feedback. */
export function Flash({ kind, children }: { kind: "ok" | "error" | "info"; children: React.ReactNode }) {
  const cls =
    kind === "ok" ? "border-[#bfdcc8] bg-ok-bg text-ok-ink" : kind === "error" ? "border-[#efc4c4] bg-cancel-bg text-cancel-ink" : "border-line bg-note-bg text-espresso";
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`rounded-md border px-4 py-3 text-[14px] ${cls}`}>
      {children}
    </div>
  );
}
