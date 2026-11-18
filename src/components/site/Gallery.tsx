"use client";
import { useState } from "react";
import { Photo } from "@/components/ui/Photo";
import { Modal } from "@/components/ui/Modal";

const LABEL: Record<string, string> = { front: "Front view", side: "Side view", worn: "Worn", detail: "Detail", other: "View" };

export function Gallery({ images, name, tint }: { images: { media_id: string; view_label: string }[]; name: string; tint: number }) {
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(false);
  const slots = images.length ? images : [{ media_id: "", view_label: "front" }];
  const cur = slots[i];
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row">
      {slots.length > 1 ? (
        <ul className="flex gap-3 sm:flex-col" aria-label="Photos">
          {slots.map((im, n) => (
            <li key={im.media_id || n}>
              <button
                type="button"
                onClick={() => setI(n)}
                aria-label={`Show ${LABEL[im.view_label] ?? "photo"}`}
                aria-current={n === i}
                className={`block h-[76px] w-[76px] overflow-hidden rounded-md ${n === i ? "ring-2 ring-burgundy ring-offset-2" : "border border-line"}`}
              >
                <Photo mediaId={im.media_id || null} alt="" label={LABEL[im.view_label]} tint={tint} iconSize={20} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        onClick={() => images.length && setZoom(true)}
        className="relative block aspect-square w-full flex-1 overflow-hidden rounded-md"
        aria-label={images.length ? `Enlarge photo of ${name}` : undefined}
        disabled={!images.length}
      >
        <Photo mediaId={cur.media_id || null} alt={`${name} — ${LABEL[cur.view_label] ?? "photo"}`} label={`Actual product photo · ${LABEL[cur.view_label]}`} tint={tint} eager iconSize={70} />
        {images.length ? <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-white/80 px-2 py-1 text-[13px] text-muted">Click to enlarge</span> : null}
      </button>
      <Modal open={zoom} onClose={() => setZoom(false)} title={name} size="lg">
        <div className="aspect-square w-full overflow-hidden rounded-md">
          <Photo mediaId={cur.media_id || null} alt={name} tint={tint} />
        </div>
      </Modal>
    </div>
  );
}
