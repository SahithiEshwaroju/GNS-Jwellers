import type { Metadata } from "next";
import { Icon } from "@/components/ui/Icon";
import { Photo } from "@/components/ui/Photo";
import { SectionTitle } from "@/components/site/SectionTitle";
import { CustomEnquiryForm } from "@/components/site/CustomEnquiryForm";
import { getSiteImages } from "@/lib/data/site";

export const metadata: Metadata = { title: "Custom Jewellery" };

const STEPS = [
  ["01", "Share your idea", "Send a description or reference image on WhatsApp — Pinterest, Instagram or your own photo all work."],
  ["02", "Discuss the details", "Talk through metal, karat, approximate weight, stones and size with the shop."],
  ["03", "Get a confirmed quote", "The shop confirms the price using the day's rate, making charges and GST before you decide."],
  ["04", "Crafting & delivery", "The timeline is agreed with you directly."],
];
const OPTIONS = ["Change karat (18K / 22K / 24K)", "Adjust weight", "Add or change stones", "Resize", "Modify pattern", "Gold or silver"];

export default async function CustomPage() {
  const images = await getSiteImages();
  return (
    <>
      <section className="bg-burgundy text-white">
        <div className="wrap grid items-center gap-10 py-14 lg:grid-cols-2 lg:py-20">
          <div>
            <p className="eyebrow !text-white/85">Custom Jewellery</p>
            <h1 className="mt-4 text-[44px] !text-white sm:text-[60px]">Your idea, crafted by hand</h1>
            <p className="mt-5 max-w-lg text-[17px] text-white/90">Have a design in mind — a family piece to remake, a photo you saved, or a change to one of our designs? Share it with us on WhatsApp and we&apos;ll discuss what&apos;s possible.</p>
            <a href="#custom-form" className="btn btn-light mt-7">Start a custom enquiry</a>
          </div>
          <div className="aspect-[16/10] overflow-hidden rounded-md bg-[#6a1212]">
            <Photo mediaId={images.custom_hero} alt="Workshop" label="Workshop photo" dark iconSize={48} />
          </div>
        </div>
      </section>
      <section className="wrap pt-16" aria-labelledby="how">
        <SectionTitle id="how" title="How it works" />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([n, t, d]) => (
            <li key={n} className="card bg-white p-6">
              <span className="font-display text-[40px] text-antique-gold">{n}</span>
              <h3 className="mt-2 font-sans text-[17px] font-semibold text-espresso">{t}</h3>
              <p className="mt-2 text-[15px] text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="wrap grid gap-10 pt-16 lg:grid-cols-2">
        <div>
          <h2 className="h-sec">What can be customised?</h2>
          <ul className="mt-5 flex flex-wrap gap-2">
            {OPTIONS.map((o) => <li key={o} className="rounded-full border border-line bg-white px-4 py-2 text-[14px]">{o}</li>)}
          </ul>
          {images.custom_example_1 || images.custom_example_2 || images.custom_example_3 ? (
            <>
              <ul className="mt-6 grid grid-cols-3 gap-3">
                {(["custom_example_1", "custom_example_2", "custom_example_3"] as const).map((k, i) => (
                  <li key={k} className="aspect-square overflow-hidden rounded-md"><Photo mediaId={images[k]} alt={`Past custom work ${i + 1}`} label={`Example ${i + 1}`} tint={i} iconSize={28} /></li>
                ))}
              </ul>
              <p className="mt-2 text-[13px] text-muted">Examples of past custom work</p>
            </>
          ) : null}
          <p className="mt-6 flex items-start gap-3 text-[15px] text-muted"><Icon name="info-circle" size={18} className="mt-1 shrink-0" />Prices for custom pieces are confirmed by the shop after discussing your design.</p>
        </div>
        <div id="custom-form" className="scroll-mt-24">
          <CustomEnquiryForm />
        </div>
      </section>
    </>
  );
}
