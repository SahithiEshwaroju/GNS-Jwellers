"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { toggleSaved } from "@/app/actions/public";

export function SaveButton({ productId, productName, initialSaved, size = "sm" }: { productId: string; productName: string; initialSaved: boolean; size?: "sm" | "md" }) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  const dim = size === "md" ? "h-11 w-11" : "h-10 w-10";
  return (
    <span className="relative">
      <button
        type="button"
        aria-pressed={saved}
        aria-label={saved ? `Remove ${productName} from saved designs` : `Save ${productName}`}
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          start(async () => {
            const r = await toggleSaved(productId);
            if (r.ok) {
              setSaved(r.data.saved);
              setMsg(r.data.saved ? "Saved" : "Removed");
              router.refresh();
            } else if (r.needsSignIn) {
              router.push(`/saved?signin=1`);
            } else setMsg(r.error);
          });
        }}
        className={`grid ${dim} place-items-center rounded-full border border-line bg-white text-burgundy shadow-sm transition hover:border-dusty-rose`}
      >
        <Icon name={saved ? "heart-filled" : "heart-outline"} size={18} />
      </button>
      <span role="status" className="sr-only">{msg}</span>
    </span>
  );
}
