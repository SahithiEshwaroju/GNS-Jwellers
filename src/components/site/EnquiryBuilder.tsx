"use client";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { Photo } from "@/components/ui/Photo";
import { PREDEFINED_QUESTIONS } from "@/lib/whatsapp";
import { formatINR } from "@/lib/format";
import { previewEnquiry, submitEnquiry, markWhatsAppOpened } from "@/app/actions/public";

export type EnquiryItem = { code: string; name: string; price: number | null; coverMediaId: string | null };

type Step = 1 | 2 | 3;

export function EnquiryBuilder({
  open, onClose, items, source, customisation = {}, defaultName = "",
}: {
  open: boolean; onClose: () => void; items: EnquiryItem[]; source: "product" | "multi"; customisation?: Record<string, string>; defaultName?: string;
}) {
  const [step, setStep] = useState<Step>(1);
  const [questions, setQuestions] = useState<string[]>([]);
  const [own, setOwn] = useState("");
  const [name, setName] = useState(defaultName);
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ message: string; hasWhatsApp: boolean } | null>(null);
  const [result, setResult] = useState<{ enquiryId: string; token: string; ref: string; message: string; whatsappUrl: string | null } | null>(null);
  const [opened, setOpened] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const input = () => ({
    source, productCodes: items.map((i) => i.code), questions, customQuestion: own || undefined, customisation, name, mobile, email: email || undefined,
  });

  const close = () => {
    onClose();
    if (step === 3) {
      setStep(1); setQuestions([]); setOwn(""); setResult(null); setPreview(null); setOpened(false);
    }
  };

  const steps = ["Questions & details", "Review message", "Send on WhatsApp"];
  return (
    <Modal open={open} onClose={close} title={items.length > 1 ? "Enquire about these designs" : "Enquire about this design"}>
      <ol className="mb-5 flex flex-wrap gap-2" aria-label="Steps">
        {steps.map((s, i) => (
          <li key={s} aria-current={step === i + 1 ? "step" : undefined} className={`rounded-full px-3 py-1 text-[13px] ${step === i + 1 ? "bg-burgundy text-white" : "bg-rose-tint text-muted"}`}>
            {i + 1} · {s}
          </li>
        ))}
      </ol>

      <ul className="mb-5 space-y-2">
        {items.map((it) => (
          <li key={it.code} className="flex items-center gap-3 rounded-md border border-line bg-white p-2">
            <span className="h-14 w-14 shrink-0 overflow-hidden rounded"><Photo mediaId={it.coverMediaId} alt={it.name} label="Photo" iconSize={20} /></span>
            <span>
              <span className="block font-semibold">{it.name}</span>
              <span className="text-[14px] text-muted">{it.code} · {it.price ? `${formatINR(it.price)} (approx.)` : "Price on request"}</span>
            </span>
          </li>
        ))}
      </ul>

      {error ? <p role="alert" className="mb-4 rounded-md border border-[#efc4c4] bg-cancel-bg px-4 py-3 text-[14px] text-cancel-ink">{error}</p> : null}

      {step === 1 ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const r = await previewEnquiry(input());
              if (!r.ok) return setError(r.error);
              setPreview(r.data);
              setStep(2);
            });
          }}
          noValidate
        >
          <fieldset>
            <legend className="mb-3 font-semibold">What would you like to ask?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {PREDEFINED_QUESTIONS.map((q, i) => (
                <label key={q} htmlFor={`q${i}`} className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded border px-4 py-2 ${questions.includes(q) ? "border-burgundy bg-rose-tint-2" : "border-line bg-white"}`}>
                  <input id={`q${i}`} type="checkbox" className="h-[18px] w-[18px] shrink-0 accent-burgundy" checked={questions.includes(q)} onChange={() => setQuestions((qs) => (qs.includes(q) ? qs.filter((x) => x !== q) : [...qs, q]))} />
                  <span className="text-[15px]">{q}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label htmlFor="own-q" className="label mt-4">Your own question (optional)</label>
          <textarea id="own-q" className="input" maxLength={1000} rows={2} placeholder="e.g. Can this be made in 18K with green stones?" value={own} onChange={(e) => setOwn(e.target.value)} />

          <h3 className="mt-6 font-sans text-[16px] font-semibold text-espresso">Your details</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="enq-name" className="label">Name <span className="text-error" aria-hidden="true">*</span></label>
              <input id="enq-name" className="input" required maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="enq-mobile" className="label">Mobile number <span className="text-error" aria-hidden="true">*</span></label>
              <input id="enq-mobile" className="input" required inputMode="tel" autoComplete="tel-national" maxLength={14} placeholder="10-digit mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </div>
          </div>
          <label htmlFor="enq-email" className="label mt-4">Email (optional)</label>
          <input id="enq-email" type="email" className="input" maxLength={254} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <p className="hint mt-3">No account needed. Your details are shared only with the shop to answer this enquiry.</p>
          <div className="mt-5 flex justify-end">
            <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={pending} aria-busy={pending}>{pending ? "Preparing…" : "Review message"}</button>
          </div>
        </form>
      ) : null}

      {step === 2 && preview ? (
        <div>
          <p className="mb-2 font-semibold">This message will be prefilled in WhatsApp. You send it yourself.</p>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-white p-4 font-sans text-[14.5px]">{preview.message}</pre>
          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>Back</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending} aria-busy={pending}
              onClick={() => {
                setError(null);
                start(async () => {
                  const r = await submitEnquiry(input());
                  if (!r.ok) return setError(r.error);
                  setResult(r.data);
                  setStep(3);
                });
              }}
            >
              {pending ? "Saving…" : "Continue"}
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 && result ? (
        <div>
          <p className="text-[15px]">Your enquiry reference is <b>{result.ref}</b>.</p>
          {result.whatsappUrl ? (
            <>
              <a
                href={result.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-wa mt-4 w-full"
                onClick={() => {
                  setOpened(true);
                  void markWhatsAppOpened(result.enquiryId, result.token);
                }}
              >
                <Icon name="whatsapp-bubble" /> Open WhatsApp
              </a>
              {opened ? (
                <p role="status" className="mt-4 flex items-start gap-3 rounded-md bg-ok-bg px-4 py-3 text-[14px] text-ok-ink">
                  <Icon name="check-circle" size={20} className="shrink-0" />
                  WhatsApp opened. Please review the message and press <b>Send</b> in WhatsApp — we can&apos;t see whether it was sent.
                </p>
              ) : (
                <p className="hint mt-3">WhatsApp opens with the message ready. Nothing is sent until you press Send.</p>
              )}
            </>
          ) : (
            <div className="mt-4 rounded-md border border-line bg-note-bg p-4 text-[14px]">
              <p>The shop&apos;s WhatsApp number hasn&apos;t been set up yet. Copy your message and send it to the shop directly.</p>
              <button
                type="button"
                className="btn btn-outline btn-sm mt-3"
                onClick={async () => {
                  await navigator.clipboard.writeText(result.message).catch(() => undefined);
                  setCopied(true);
                }}
              >
                {copied ? "Copied" : "Copy message"}
              </button>
            </div>
          )}
          <div className="mt-5 text-right">
            <button type="button" className="btn btn-ghost" onClick={close}>Done</button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
