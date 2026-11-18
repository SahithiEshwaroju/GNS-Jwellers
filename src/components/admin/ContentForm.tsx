"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Toggle } from "@/components/ui/Toggle";
import { saveSiteSettings } from "@/app/actions/admin";
import type { SiteSettingsRow } from "@/lib/supabase/database.types";

type K = "shop_name" | "tagline" | "whatsapp_number" | "phone" | "email" | "address" | "opening_hours" | "hero_eyebrow" | "hero_headline" | "hero_text" | "brand_story" | "trust_highlights" | "about_intro" | "about_story" | "about_values" | "instagram_url" | "youtube_url" | "facebook_url" | "privacy_text" | "terms_text";

export function ContentForm({ initial }: { initial: SiteSettingsRow }) {
  const router = useRouter();
  const [v, setV] = useState<Record<K, string>>(() => Object.fromEntries((["shop_name", "tagline", "whatsapp_number", "phone", "email", "address", "opening_hours", "hero_eyebrow", "hero_headline", "hero_text", "brand_story", "trust_highlights", "about_intro", "about_story", "about_values", "instagram_url", "youtube_url", "facebook_url", "privacy_text", "terms_text"] as K[]).map((k) => [k, (initial[k] as string | null) ?? ""])) as Record<K, string>);
  const [hallmarked, setHallmarked] = useState(initial.is_hallmarked);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const f = (k: K, label: string, opts: { area?: boolean; rows?: number; hint?: string; placeholder?: string; max?: number } = {}) => (
    <div>
      <label htmlFor={`c-${k}`} className="label">{label} {!v[k] ? <span className="badge badge-sample ml-1">Placeholder</span> : null}</label>
      {opts.area ? <textarea id={`c-${k}`} className="input" rows={opts.rows ?? 3} maxLength={opts.max} placeholder={opts.placeholder} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
        : <input id={`c-${k}`} className="input" maxLength={opts.max} placeholder={opts.placeholder} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />}
      {opts.hint ? <p className="hint">{opts.hint}</p> : null}
    </div>
  );
  const save = () => start(async () => {
    const r = await saveSiteSettings({ ...v, is_hallmarked: hallmarked });
    setMsg(r.ok ? { ok: true, text: "Changes saved and live on the website." } : { ok: false, text: r.error });
    if (r.ok) router.refresh();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
      <div className="mb-4 flex items-center justify-between gap-3">
        {msg ? <p role={msg.ok ? "status" : "alert"} className={`rounded px-4 py-2 text-[14px] ${msg.ok ? "bg-ok-bg text-ok-ink" : "bg-cancel-bg text-cancel-ink"}`}>{msg.text}</p> : <span />}
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <section className="admin-card space-y-4 p-5">
          <h2 className="text-[26px]">Shop &amp; contact</h2>
          {f("shop_name", "Shop name", { max: 80 })}
          {f("tagline", "Logo tagline", { max: 80 })}
          {f("whatsapp_number", "WhatsApp number (enquiries go here)", { placeholder: "+91 98XXXXXXXX", hint: "Include country code.", max: 20 })}
          {f("phone", "Phone", { max: 30 })}
          {f("email", "Email", { max: 254 })}
          {f("address", "Shop address", { area: true, max: 500 })}
          {f("opening_hours", "Opening hours", { placeholder: "e.g. Mon–Sat, 10 AM – 8 PM", max: 120 })}
        </section>
        <section className="admin-card space-y-4 p-5">
          <h2 className="text-[26px]">Home page</h2>
          {f("hero_eyebrow", "Hero small heading", { max: 60 })}
          {f("hero_headline", "Hero headline", { max: 80 })}
          {f("hero_text", "Hero text", { area: true, max: 300 })}
          {f("brand_story", "Brand story (short)", { area: true, max: 1000, hint: "Only facts the shop can confirm. The Our Story section appears once this is set." })}
          {f("trust_highlights", "Trust highlights", { placeholder: "e.g. BIS Hallmarked, Custom creations", max: 300, hint: "Comma-separated. Only claims you can back up." })}
          <label className="flex items-start gap-3 rounded border border-line bg-white p-3">
            <Toggle checked={hallmarked} onChange={setHallmarked} label="Our jewellery is hallmarked" />
            <span className="text-[14px]">Our jewellery is hallmarked<span className="block text-[12.5px] text-muted">Shows &ldquo;Certified Purity / Hallmarked&rdquo; on the website. Turn on only if true.</span></span>
          </label>
        </section>
        <section className="admin-card space-y-4 p-5">
          <h2 className="text-[26px]">About Us page</h2>
          {f("about_intro", "Introduction", { area: true, max: 300 })}
          {f("about_story", "Our story", { area: true, rows: 5, max: 4000 })}
          {f("about_values", "What we value", { area: true, rows: 4, max: 2000, hint: "One per line, e.g. “Craftsmanship: How pieces are made”" })}
        </section>
        <section className="admin-card space-y-4 p-5">
          <h2 className="text-[26px]">Links &amp; policies</h2>
          {f("instagram_url", "Instagram URL", { placeholder: "https://instagram.com/...", max: 300 })}
          {f("youtube_url", "YouTube URL", { max: 300 })}
          {f("facebook_url", "Facebook URL", { max: 300 })}
          {f("privacy_text", "Privacy Policy text", { area: true, rows: 5, max: 20000 })}
          {f("terms_text", "Terms of Use text", { area: true, rows: 5, max: 20000 })}
        </section>
        <section className="admin-card p-5">
          <h2 className="text-[26px]">Images</h2>
          <p className="mt-2 text-[13.5px] text-muted">All website photos — hero, categories, collections, Custom Jewellery and About Us — are managed page by page in the Images section.</p>
          <Link href="/admin/images" className="btn btn-outline btn-sm mt-3">Open Images →</Link>
        </section>
      </div>
    </form>
  );
}
