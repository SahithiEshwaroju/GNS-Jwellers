"use client";
import { useRouter } from "next/navigation";
export function PeriodSelect({ value }: { value: number }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2"><span className="sr-only">Period</span>
      <select className="input min-w-[170px]" value={value} onChange={(e) => router.push(`/admin/analytics?days=${e.target.value}`)}>
        <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
      </select>
    </label>
  );
}
