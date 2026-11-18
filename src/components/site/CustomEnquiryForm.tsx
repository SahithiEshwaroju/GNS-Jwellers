"use client";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { previewEnquiry, submitEnquiry, markWhatsAppOpened } from "@/app/actions/public";

export function CustomEnquiryForm() {
  const [idea, setIdea] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<{ enquiryId: string; token: string; ref: string; whatsappUrl: string | null; message: string } | null>(null);
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = () => ({ source: "custom" as const, customQuestion: idea, name, mobile, productCodes: [], questions: [] });

  return (
    <div className="card bg-white p-6">
      <h2 className="text-[30px]">Tell us what you have in mind</h2>
      {error ? <p role="alert" className="mt-4 rounded-md bg-cancel-bg px-4 py-3 text-[14px] text-cancel-ink">{error}</p> : null}
      {!preview ? (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const r = await previewEnquiry(input());
              if (!r.ok) return setError(r.error);
              setPreview(r.data.message);
            });
          }}
        >
          <label htmlFor="idea" className="label mt-4">Your idea <span className="text-error" aria-hidden="true">*</span></label>
          <textarea id="idea" className="input" required rows={4} maxLength={1000} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="e.g. A 22K temple necklace like the photo I'll send, around 25 g, with red stones" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="c-name" className="label">Name <span className="text-error" aria-hidden="true">*</span></label>
              <input id="c-name" className="input" required maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="c-mobile" className="label">Mobile number <span className="text-error" aria-hidden="true">*</span></label>
              <input id="c-mobile" className="input" required inputMode="tel" maxLength={14} autoComplete="tel-national" placeholder="10-digit mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </div>
          </div>
          <p className="hint mt-3">You can attach your reference images inside WhatsApp after it opens.</p>
          <button type="submit" className="btn btn-primary mt-4 w-full" disabled={pending}>{pending ? "Preparing…" : "Preview WhatsApp message"}</button>
        </form>
      ) : !result ? (
        <div className="mt-4">
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-ivory p-4 font-sans text-[14.5px]">{preview}</pre>
          <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button type="button" className="btn btn-outline" onClick={() => setPreview(null)}>Edit</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await submitEnquiry(input());
                  if (!r.ok) return setError(r.error);
                  setResult(r.data);
                })
              }
            >
              {pending ? "Saving…" : "Continue"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <p>Your enquiry reference is <b>{result.ref}</b>.</p>
          {result.whatsappUrl ? (
            <a href={result.whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn-wa mt-4 w-full" onClick={() => { setOpened(true); void markWhatsAppOpened(result.enquiryId, result.token); }}>
              <Icon name="whatsapp-bubble" /> Open WhatsApp
            </a>
          ) : (
            <p className="mt-4 rounded-md bg-note-bg p-4 text-[14px]">The shop&apos;s WhatsApp number hasn&apos;t been set up yet. Please contact the shop directly and mention reference {result.ref}.</p>
          )}
          {opened ? <p role="status" className="mt-4 rounded-md bg-ok-bg px-4 py-3 text-[14px] text-ok-ink">WhatsApp opened. Attach your reference images and press Send — we can&apos;t see whether it was sent.</p> : null}
        </div>
      )}
    </div>
  );
}
