"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";

export type FilterGroup = { key: string; label: string; options: { value: string; label: string; count: number }[]; open?: boolean };

function readSelection(sp: URLSearchParams, groups: FilterGroup[]) {
  const sel: Record<string, string[]> = {};
  for (const g of groups) sel[g.key] = (sp.get(g.key) ?? "").split(",").filter(Boolean);
  return sel;
}

function FilterGroups({ groups, sel, onToggle }: { groups: FilterGroup[]; sel: Record<string, string[]>; onToggle: (k: string, v: string) => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(groups.map((g) => [g.key, g.open ?? sel[g.key]?.length > 0])));
  return (
    <>
      {groups.map((g) => (
        <fieldset key={g.key} className="border-b border-line py-4 last:border-0">
          <legend className="sr-only">{g.label}</legend>
          <button type="button" className="flex w-full items-center justify-between text-left text-[16px] font-semibold text-wine" aria-expanded={open[g.key]} onClick={() => setOpen((o) => ({ ...o, [g.key]: !o[g.key] }))}>
            {g.label} <Icon name={open[g.key] ? "chevron-up" : "chevron-down"} size={16} />
          </button>
          {open[g.key] ? (
            g.options.length ? (
              <ul className="mt-3 space-y-1">
                {g.options.map((o) => {
                  const id = `f-${g.key}-${o.value}`;
                  return (
                    <li key={o.value}>
                      <label htmlFor={id} className="flex min-h-9 cursor-pointer items-center gap-3 text-[15px]">
                        <input id={id} type="checkbox" className="h-[18px] w-[18px] accent-burgundy" checked={sel[g.key]?.includes(o.value) ?? false} onChange={() => onToggle(g.key, o.value)} />
                        <span>{o.label}</span>
                        <span className="text-[13px] text-muted">({o.count})</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-[13px] text-muted">No options yet.</p>
            )
          ) : null}
        </fieldset>
      ))}
    </>
  );
}

function hrefWith(pathname: string, sp: URLSearchParams, sel: Record<string, string[]>, groups: FilterGroup[]) {
  const next = new URLSearchParams(sp.toString());
  for (const g of groups) {
    if (sel[g.key]?.length) next.set(g.key, sel[g.key].join(","));
    else next.delete(g.key);
  }
  next.delete("show");
  next.delete("sub");
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** Desktop sidebar: applies immediately. */
export function FilterSidebar({ groups }: { groups: FilterGroup[] }) {
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();
  const sel = readSelection(new URLSearchParams(sp.toString()), groups);
  const toggle = (k: string, v: string) => {
    const cur = sel[k] ?? [];
    const nextSel = { ...sel, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
    start(() => router.push(hrefWith(pathname, new URLSearchParams(sp.toString()), nextSel, groups), { scroll: false }));
  };
  const clear = () => start(() => router.push(hrefWith(pathname, new URLSearchParams(sp.toString()), {}, groups), { scroll: false }));
  return (
    <aside className="card hidden self-start p-5 lg:block" aria-label="Filters" aria-busy={pending}>
      <div className="flex items-center justify-between border-b border-line pb-4">
        <h2 className="text-[28px]">Filters</h2>
        <button type="button" onClick={clear} className="text-[14px] text-burgundy underline">Clear All</button>
      </div>
      <FilterGroups groups={groups} sel={sel} onToggle={toggle} />
    </aside>
  );
}

/** Mobile bottom sheet: Cancel / Save. */
export function FilterSheetButton({ groups }: { groups: FilterGroup[] }) {
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  useEffect(() => {
    if (open) setDraft(readSelection(new URLSearchParams(sp.toString()), groups));
  }, [open, sp, groups]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);
  const active = Object.values(readSelection(new URLSearchParams(sp.toString()), groups)).flat().length;
  return (
    <>
      <button type="button" className="btn btn-outline btn-sm w-full lg:hidden" onClick={() => setOpen(true)} aria-haspopup="dialog">
        Filters{active ? ` (${active})` : ""}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-[rgba(43,27,23,0.55)] lg:hidden" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Filters" className="flex max-h-[88vh] w-full flex-col rounded-t-2xl bg-card">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-[28px]">Filters</h2>
              <button type="button" className="text-[14px] text-burgundy underline" onClick={() => setDraft({})}>Clear All</button>
            </div>
            <div className="overflow-y-auto px-5">
              <FilterGroups groups={groups} sel={draft} onToggle={(k, v) => setDraft((d) => ({ ...d, [k]: (d[k] ?? []).includes(v) ? d[k].filter((x) => x !== v) : [...(d[k] ?? []), v] }))} />
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-line px-5 py-4">
              <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setOpen(false);
                  router.push(hrefWith(pathname, new URLSearchParams(sp.toString()), draft, groups));
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function SortSelect({ options, value }: { options: readonly { key: string; label: string }[]; value: string }) {
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  return (
    <label className="flex items-center gap-3 whitespace-nowrap text-[14px] text-muted">
      Sort by
      <select
        className="input h-11 min-w-[170px] rounded-[22px] px-4 text-[15px] text-espresso"
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(sp.toString());
          next.set("sort", e.target.value);
          next.delete("show");
          router.push(`${pathname}?${next.toString()}`, { scroll: false });
        }}
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
