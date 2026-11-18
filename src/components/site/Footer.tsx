import Link from "next/link";
import { getSettings } from "@/lib/data/site";
import { whatsappLink } from "@/lib/whatsapp";

export async function Footer() {
  const s = await getSettings();
  const wa = whatsappLink(s.whatsapp_number, `Hello ${s.shop_name}, I have a question.`);
  const socials = [
    ["Instagram", s.instagram_url],
    ["YouTube", s.youtube_url],
    ["Facebook", s.facebook_url],
  ].filter(([, u]) => u) as [string, string][];
  const head = "mb-4 font-semibold text-white";
  const link = "text-white/85 hover:text-white";
  return (
    <footer className="mt-16 bg-[#3f0d0c] text-white">
      <div className="wrap grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1.2fr]">
        <div>
          <p className="font-display text-[36px] font-bold leading-none text-white">{s.shop_name}</p>
          <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-white/80">{s.tagline}</p>
          <address className="mt-5 space-y-1 text-[14px] not-italic text-white/85">
            {s.address ? <p className="whitespace-pre-line">{s.address}</p> : null}
            {s.phone ? <p>Phone: {s.phone}</p> : null}
            {s.whatsapp_number ? <p>WhatsApp: {s.whatsapp_number}</p> : null}
            {s.opening_hours ? <p>{s.opening_hours}</p> : null}
            {!s.address && !s.phone && !s.whatsapp_number ? <p className="text-white/60">Contact details coming soon.</p> : null}
          </address>
        </div>
        <nav aria-label="Shop">
          <p className={head}>Shop</p>
          <ul className="space-y-3 text-[15px]">
            <li><Link className={link} href="/jewellery">All Jewellery</Link></li>
            <li><Link className={link} href="/collections">Collections</Link></li>
            <li><Link className={link} href="/jewellery?sort=latest">New Arrivals</Link></li>
            <li><Link className={link} href="/saved">Saved designs</Link></li>
          </ul>
        </nav>
        <nav aria-label="Help">
          <p className={head}>Help</p>
          <ul className="space-y-3 text-[15px]">
            <li><Link className={link} href="/custom-jewellery">Custom Jewellery</Link></li>
            {wa ? <li><a className={link} href={wa} target="_blank" rel="noopener noreferrer">Contact on WhatsApp</a></li> : null}
            <li><Link className={link} href="/about">About Us</Link></li>
          </ul>
        </nav>
        <nav aria-label="Staff">
          <p className={head}>Staff</p>
          <Link className={link} href="/admin">Admin portal →</Link>
        </nav>
        {socials.length ? (
          <nav aria-label="Follow us">
            <p className={head}>Follow us</p>
            <ul className="space-y-3 text-[15px]">
              {socials.map(([n, u]) => (
                <li key={n}><a className={link} href={u} target="_blank" rel="noopener noreferrer">{n}</a></li>
              ))}
            </ul>
          </nav>
        ) : <div />}
      </div>
      <div className="border-t border-white/15">
        <div className="wrap flex flex-col gap-3 py-6 text-[14px] text-white/85 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {s.shop_name}. All rights reserved.</p>
          <p className="flex gap-4">
            <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
            <span aria-hidden="true">|</span>
            <Link href="/terms" className="hover:text-white">Terms of Use</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
