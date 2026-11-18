const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const TZ = "Asia/Kolkata";

/** ₹3,62,694 */
export function formatINR(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return `₹${inr.format(Math.round(Number(n)))}`;
}

/** 16 Nov 2026, 10:24 AM */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }).format(d);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ }).format(d);
  return `${date}, ${time}`;
}

/** 16 Nov 2026 (accepts timestamps or YYYY-MM-DD dates) */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00+05:30`) : new Date(iso);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }).format(d);
}

/** 10:24 AM / Yesterday / 14 Nov — compact activity timestamps. */
export function formatRelativeShort(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const day = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(x);
  if (day(d) === day(now)) {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ }).format(d);
  }
  const y = new Date(now.getTime() - 86_400_000);
  if (day(d) === day(y)) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: TZ }).format(d);
}

/** Today's date in India as YYYY-MM-DD. */
export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
}

export function formatWeight(g: number | null | undefined): string {
  if (g === null || g === undefined) return "—";
  return `${Number(g).toLocaleString("en-IN", { maximumFractionDigits: 3 })} g`;
}

export function metalLabel(metal: string, karat: number | null, silverPurity?: string | null): string {
  if (metal === "gold") return `${karat ?? ""}K Gold`.trim();
  return silverPurity ? `Silver ${silverPurity}` : "Silver";
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
