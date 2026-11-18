"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

/** Accessible modal built on <dialog>: focus trap, Esc to close, background inert. */
export function Modal({
  open, onClose, title, children, size = "md", footer,
}: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; size?: "sm" | "md" | "lg"; footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const width = size === "sm" ? "sm:max-w-md" : size === "lg" ? "sm:max-w-3xl" : "sm:max-w-[640px]";
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="modal-title"
      className={`m-0 mt-auto max-h-[92vh] w-full max-w-none rounded-t-2xl bg-card p-0 text-espresso shadow-[var(--shadow-modal)] backdrop:bg-[rgba(43,27,23,0.55)] sm:m-auto sm:rounded-lg ${width}`}
    >
      {open ? (
        <div className="flex max-h-[92vh] flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <h2 id="modal-title" className="text-[26px] sm:text-[30px]">{title}</h2>
            <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full hover:bg-rose-tint" aria-label="Close">
              <Icon name="close-x" size={20} />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {footer ? <div className="border-t border-line px-5 py-4 sm:px-6">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}
