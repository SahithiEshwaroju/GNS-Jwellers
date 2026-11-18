"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { addAdmin, removeAdmin } from "@/app/actions/admin";
import { formatDate, formatRelativeShort } from "@/lib/format";

type A = { email: string; name: string | null; created_at: string; last_sign_in_at: string | null; is_self: boolean };

export function AdminsManager({ admins }: { admins: A[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState<A | null>(null);
  const [pending, start] = useTransition();
  const onlyOne = admins.length <= 1;
  return (
    <>
      <form className="admin-card grid gap-3 p-5 sm:grid-cols-[1fr_1.3fr_auto] sm:items-end" noValidate
        onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await addAdmin({ name, email }); setMsg(r.ok ? { ok: true, text: `${email} can now sign in to the admin portal.` } : { ok: false, text: r.error }); if (r.ok) { setName(""); setEmail(""); } router.refresh(); }); }}>
        <div><label htmlFor="an" className="label">Name</label><input id="an" className="input" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label htmlFor="ae" className="label">Google email address <span className="text-error">*</span></label><input id="ae" type="email" className="input" maxLength={254} placeholder="name@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <button type="submit" className="btn btn-primary" disabled={pending}>Add admin</button>
      </form>
      {msg ? <p role={msg.ok ? "status" : "alert"} className={`mt-3 rounded px-4 py-2 text-[14px] ${msg.ok ? "bg-ok-bg text-ok-ink" : "bg-cancel-bg text-cancel-ink"}`}>{msg.text}</p> : null}
      <div className="admin-card mt-5 overflow-x-auto">
        <table className="table min-w-[640px]">
          <thead><tr><th>Name</th><th>Google email</th><th>Added</th><th>Last sign-in</th><th className="text-right">Access</th></tr></thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.email}>
                <td>{a.name ?? "—"} {a.is_self ? <span className="badge badge-ok ml-1">You</span> : null}</td>
                <td>{a.email}</td>
                <td className="text-[13px]">{formatDate(a.created_at)}</td>
                <td className="text-[13px]">{a.last_sign_in_at ? formatRelativeShort(a.last_sign_in_at) : "Never"}</td>
                <td className="text-right"><button type="button" className="btn btn-danger btn-sm" disabled={a.is_self || onlyOne || pending} onClick={() => setConfirm(a)} title={a.is_self ? "You can't remove yourself" : undefined}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[13px] text-muted">You can&apos;t remove your own account while signed in, and there must always be at least one admin.</p>
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Remove admin access?" size="sm"
        footer={<div className="flex justify-end gap-3"><button type="button" className="btn btn-outline" onClick={() => setConfirm(null)}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => { const a = confirm!; setConfirm(null); start(async () => { const r = await removeAdmin(a.email); setMsg(r.ok ? { ok: true, text: `Removed ${a.email}.` } : { ok: false, text: r.error }); router.refresh(); }); }}>Remove</button></div>}>
        <p><b>{confirm?.email}</b> will no longer be able to open the admin portal.</p>
      </Modal>
    </>
  );
}
