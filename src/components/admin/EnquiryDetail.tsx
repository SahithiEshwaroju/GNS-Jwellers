"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import { ENQUIRY_STATUS, SOURCE_LABEL } from "@/lib/status";
import { whatsappLink } from "@/lib/whatsapp";
import { aiDraftReply, approveReply, manualReplyTemplate, setEnquiryStatus } from "@/app/actions/admin";
import type { EnquiryRow } from "@/lib/supabase/database.types";

type Item = { product_id: string | null; product_code: string; product_name: string; estimated_price: number | null };
type Mode = "view" | "ai" | "edit";

export function EnquiryDetail({ enquiry: e, items, aiReady }: { enquiry: EnquiryRow; items: Item[]; aiReady: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<Mode>("view");
  const questions = [...e.questions, ...(e.custom_question ? [e.custom_question] : [])];
  const [answers, setAnswers] = useState<string[]>(questions.map(() => ""));
  const [qi, setQi] = useState(0);
  const [note, setNote] = useState("");
  const [reply, setReply] = useState(e.admin_reply ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const custom = Object.entries((e.customisation ?? {}) as Record<string, string>).map(([k, v]) => `${k}: ${v}`).join(", ");
  const wa = whatsappLink(e.mobile, reply);

  const rows: [string, React.ReactNode][] = [
    ["Customer", e.customer_name],
    ["Mobile", <a key="m" href={`tel:${e.mobile}`} className="text-burgundy">{e.mobile}</a>],
    ["Email", e.email ?? "—"],
    ["Product(s)", items.length ? items.map((i) => <span key={i.product_code} className="block">{i.product_id ? <Link href={`/admin/products/${i.product_id}`} className="text-burgundy hover:underline">{i.product_name}</Link> : i.product_name} <span className="text-muted">({i.product_code}{i.estimated_price ? ` · ${formatINR(i.estimated_price)} at enquiry` : ""})</span></span>) : "Custom design"],
    ["Customisation", custom || "—"],
    ["Customer", e.user_id ? "Registered customer" : "Guest"],
    ["WhatsApp", e.whatsapp_opened_at ? `Opened by customer · ${formatDate(e.whatsapp_opened_at)}` : "Not opened yet"],
  ];

  return (
    <section className="admin-card self-start p-5" aria-label={`Enquiry ${e.ref}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[30px]">{e.ref}</h2>
          <p className="text-[13px] text-muted">{formatDateTime(e.created_at)} · from {SOURCE_LABEL[e.source] ?? "Website"}</p>
        </div>
        <div>
          <label htmlFor="enq-status" className="label">Status</label>
          <select id="enq-status" className="input min-w-[190px]" defaultValue={e.status} disabled={pending}
            onChange={(ev) => start(async () => { const r = await setEnquiryStatus(e.id, ev.target.value); if (!r.ok) setError(r.error); router.refresh(); })}>
            {Object.entries(ENQUIRY_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>
      <dl className="mt-4">
        {rows.map(([k, v], i) => (
          <div key={i} className="flex justify-between gap-4 border-b border-line py-2.5 text-[14.5px]"><dt className="text-muted">{k}</dt><dd className="text-right">{v}</dd></div>
        ))}
      </dl>
      <p className="eyebrow mt-5">Customer&apos;s questions</p>
      {questions.length ? <ul className="mt-2 list-disc space-y-1 pl-5">{questions.map((q, i) => <li key={i}>{q}</li>)}</ul> : <p className="mt-2 text-muted">No questions selected.</p>}
      {error ? <p role="alert" className="mt-4 rounded bg-cancel-bg px-3 py-2 text-[14px] text-cancel-ink">{error}</p> : null}

      {mode === "view" ? (
        <>
          {e.admin_reply ? (
            <div className="mt-5 rounded-md border border-line bg-white p-4">
              <p className="text-[13px] text-muted">Last approved reply{e.replied_at ? ` · ${formatDateTime(e.replied_at)}` : ""}</p>
              <p className="mt-2 whitespace-pre-wrap text-[14.5px]">{e.admin_reply}</p>
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" onClick={() => { setMode("ai"); setQi(0); setError(null); }} disabled={!questions.length}>✦ Reply with AI assistance</button>
            <button type="button" className="btn btn-outline" disabled={pending} aria-busy={pending} onClick={() => start(async () => { const r = await manualReplyTemplate(e.id); setReply(e.admin_reply ?? (r.ok ? r.data.reply : "")); setNotice(null); setMode("edit"); })}>Write reply manually</button>
            {e.status !== "converted" ? <Link href={`/admin/orders/new?enquiry=${e.id}`} className="btn btn-ghost">Create order</Link> : null}
          </div>
          {!aiReady ? <p className="hint mt-2">AI isn&apos;t configured, so the assistant builds a simple reply from your answers instead.</p> : null}
        </>
      ) : null}

      {mode === "ai" ? (
        <div className="mt-5 rounded-md border border-line bg-white p-4">
          <p className="text-[13px] text-muted">Question {qi + 1} of {questions.length} — answer from the shop&apos;s actual information. The reply will use only your answers.</p>
          <label htmlFor="ai-a" className="mt-2 block font-semibold">{questions[qi]}</label>
          <textarea id="ai-a" className="input mt-2" rows={2} maxLength={1000} value={answers[qi]} placeholder="Short answer, e.g. ₹21,720 · 12 days · Yes, available in 22K" onChange={(ev) => setAnswers(answers.map((a, i) => (i === qi ? ev.target.value : a)))} />
          <div className="mt-3 flex flex-wrap justify-between gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => (qi === 0 ? setMode("view") : setQi(qi - 1))}>{qi === 0 ? "Cancel" : "Previous"}</button>
            {qi < questions.length - 1 ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setQi(qi + 1)}>Next question</button>
            ) : (
              <div className="w-full space-y-2 sm:w-auto">
                <label htmlFor="ai-note" className="label">Anything else to mention? (optional)</label>
                <input id="ai-note" className="input" maxLength={1000} value={note} onChange={(ev) => setNote(ev.target.value)} />
                <button type="button" className="btn btn-primary btn-sm w-full" disabled={pending} aria-busy={pending}
                  onClick={() => start(async () => {
                    const r = await aiDraftReply({ enquiryId: e.id, qa: questions.map((q, i) => ({ question: q, answer: answers[i] })), extraNote: note || undefined });
                    if (!r.ok) return setError(r.error);
                    setReply(r.data.reply);
                    setNotice(r.data.usedAi ? "AI draft — review and edit before approving." : r.data.notice ?? null);
                    setMode("edit");
                  })}>
                  {pending ? "Preparing reply…" : "Prepare reply"}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {mode === "edit" ? (
        <div className="mt-5">
          {notice ? <p role="status" className="mb-2 rounded bg-note-bg px-3 py-2 text-[13.5px]">{notice}</p> : null}
          <label htmlFor="reply" className="label">Reply to {e.customer_name}</label>
          <textarea id="reply" className="input" rows={10} maxLength={4000} value={reply} onChange={(ev) => { setReply(ev.target.value); setApproved(false); }} />
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" className="btn btn-ghost" onClick={() => setMode("view")}>Cancel</button>
            {!approved ? (
              <button type="button" className="btn btn-primary" disabled={pending} aria-busy={pending || reply.trim().length < 2}
                onClick={() => start(async () => { const r = await approveReply(e.id, reply); if (!r.ok) return setError(r.error); setApproved(true); router.refresh(); })}>
                {pending ? "Saving…" : "Approve reply"}
              </button>
            ) : wa ? (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-wa"><Icon name="whatsapp-bubble" /> Open WhatsApp to {e.customer_name.split(" ")[0]}</a>
            ) : <p className="err">The customer&apos;s number can&apos;t be used for WhatsApp.</p>}
          </div>
          {approved ? <p role="status" className="mt-2 text-[13.5px] text-ok-ink">Reply approved and saved. WhatsApp opens with it prefilled — review and press Send yourself.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
