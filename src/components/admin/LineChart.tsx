import { formatDate } from "@/lib/format";

/** Small dependency-free SVG line chart (enquiry initiations per day). */
export function LineChart({ points, label }: { points: { day: string; count: number }[]; label: string }) {
  const W = 520, H = 190, P = { l: 30, r: 10, t: 10, b: 28 };
  const max = Math.max(4, ...points.map((p) => p.count));
  const step = Math.ceil(max / 3);
  const top = step * 3;
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / Math.max(1, points.length - 1);
  const y = (v: number) => P.t + (H - P.t - P.b) * (1 - v / top);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.count).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const ticks = [0, Math.floor((points.length - 1) / 4), Math.floor((points.length - 1) / 2), Math.floor((3 * (points.length - 1)) / 4), points.length - 1];
  const total = points.reduce((s, p) => s + p.count, 0);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${label}: ${total} in total`}>
        {[0, 1, 2, 3].map((k) => (
          <g key={k}>
            <line x1={P.l} x2={W - P.r} y1={y(k * step)} y2={y(k * step)} stroke="#efe6d8" />
            <text x={P.l - 8} y={y(k * step) + 3} fontSize="9" textAnchor="end" fill="#6b5550">{k * step}</text>
          </g>
        ))}
        {points.length > 1 ? (
          <>
            <path d={area} fill="#540404" opacity="0.07" />
            <path d={line} fill="none" stroke="#540404" strokeWidth="2" />
          </>
        ) : null}
        {[...new Set(ticks)].map((i) => (
          <text key={i} x={x(i)} y={H - 8} fontSize="10" textAnchor="middle" fill="#6b5550">{points[i] ? formatDate(points[i].day).replace(/ \d{4}$/, "") : ""}</text>
        ))}
      </svg>
      <figcaption className="sr-only">{points.map((p) => `${p.day}: ${p.count}`).join(", ")}</figcaption>
    </figure>
  );
}
