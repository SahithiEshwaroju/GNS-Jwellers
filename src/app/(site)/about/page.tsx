import type { Metadata } from "next";
import { Photo } from "@/components/ui/Photo";
import { getSettings, getSiteImages } from "@/lib/data/site";
import { whatsappLink } from "@/lib/whatsapp";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "About Us" };

export default async function AboutPage() {
  const [s, images] = await Promise.all([getSettings(), getSiteImages()]);
  const wa = whatsappLink(s.whatsapp_number, `Hello ${s.shop_name}, I have a question.`);
  const values = (s.about_values ?? "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.search(/[:—–-]\s/);
    return i > 0 ? { title: l.slice(0, i).trim(), text: l.slice(i + 1).replace(/^[—–-]?\s*/, "").trim() } : { title: l, text: "" };
  });
  return (
    <>
      <section className="bg-champagne">
        <div className="wrap grid items-center gap-10 py-14 lg:grid-cols-2 lg:py-20">
          <div>
            <p className="eyebrow">About Us</p>
            <h1 className="mt-3 text-[48px] sm:text-[60px]">{s.shop_name}</h1>
            {s.about_intro ? <p className="mt-3 text-[18px] text-muted">{s.about_intro}</p> : null}
          </div>
          <div className="aspect-[16/10] overflow-hidden rounded-md">
            <Photo mediaId={images.about} alt={`${s.shop_name} shop`} label="Shop photo" tint={1} />
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-[860px] px-[18px] pt-14 md:px-8">
        {s.about_story ? (
          <section aria-labelledby="story">
            <h2 id="story" className="h-sec">Our story</h2>
            <p className="mt-4 whitespace-pre-line text-[16px] text-muted">{s.about_story}</p>
          </section>
        ) : null}
        {values.length ? (
          <section className="mt-12" aria-labelledby="values">
            <h2 id="values" className="h-sec">What we value</h2>
            <ul className="mt-5 grid gap-4 sm:grid-cols-3">
              {values.map((v) => (
                <li key={v.title} className="card bg-white p-5">
                  <h3 className="font-sans text-[17px] font-semibold text-espresso">{v.title}</h3>
                  {v.text ? <p className="mt-2 text-[15px] text-muted">{v.text}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {!s.about_story && !values.length ? <p className="card bg-white p-6 text-muted">More about the shop is coming soon.</p> : null}
        <section className="card mt-12 bg-white p-6" aria-labelledby="visit">
          <h2 id="visit" className="text-[30px]">Visit or message us</h2>
          <p className="mt-3 text-muted">
            {[s.address, s.opening_hours, s.whatsapp_number ? `WhatsApp ${s.whatsapp_number}` : null, s.phone ? `Phone ${s.phone}` : null, s.email].filter(Boolean).join(" · ") || "Contact details coming soon."}
          </p>
          {wa ? <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-wa mt-5"><Icon name="whatsapp-bubble" /> Message on WhatsApp</a> : null}
        </section>
      </div>
    </>
  );
}
