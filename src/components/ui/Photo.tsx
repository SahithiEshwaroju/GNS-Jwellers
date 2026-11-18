"use client";
import { useState } from "react";
import { Icon } from "./Icon";

const TINTS = ["bg-tint-1", "bg-tint-2", "bg-tint-3", "bg-tint-4", "bg-tint-5"];

/** Real photo from storage, or the design's diamond placeholder when no photo exists / it fails to load. */
export function Photo({
  mediaId, alt, label = "Product photo", tint = 0, className = "", iconSize = 44, eager = false, dark = false,
}: {
  mediaId: string | null | undefined; alt: string; label?: string; tint?: number; className?: string;
  iconSize?: number; eager?: boolean; dark?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (mediaId && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- served through an authorised signed redirect
      <img
        src={`/api/media/${mediaId}`}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onError={() => setFailed(true)}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={`${alt} — photo coming soon`}
      className={`flex h-full w-full flex-col items-center justify-center gap-3 ${dark ? "bg-white/5 text-white/80" : `${TINTS[Math.abs(tint) % TINTS.length]} text-antique-gold`} ${className}`}
    >
      <Icon name="diamond-faceted" size={iconSize} strokeWidth={1.1} />
      {label ? (
        <span className={`px-3 text-center text-[11px] font-medium uppercase tracking-[0.18em] ${dark ? "" : "text-gold-text"}`}>{label}</span>
      ) : null}
    </div>
  );
}

