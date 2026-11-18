import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { ImageSlot } from "@/components/admin/ImageSlot";
import { getCategories, getCollections, getSiteImages } from "@/lib/data/site";
import { r2Configured } from "@/lib/server-env";
import type { ImageTarget } from "@/app/actions/admin";

export const metadata = { title: "Images" };

type Slot = { title: string; hint: string; target: ImageTarget; mediaId: string | null };

export default async function ImagesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: t } = await searchParams;
  const [imgs, cats, cols] = await Promise.all([getSiteImages(), getCategories(), getCollections()]);
  const s = (slot: "hero" | "story" | "custom_hero" | "custom_example_1" | "custom_example_2" | "custom_example_3" | "about" | "logo" | "share", title: string, hint: string): Slot => ({ title, hint, target: { kind: "slot", slot }, mediaId: imgs[slot] ?? null });
  const colSlots = cols.map((c): Slot => ({ title: `Collection banner · ${c.name}`, hint: "About 900 × 600 px · shared by the home banner and the Collections page", target: { kind: "collection", id: c.id }, mediaId: c.image_media_id }));
  const tabs: Record<string, { label: string; note: string; slots: Slot[] }> = {
    home: { label: "Home page", note: "Hero, story photo, one tile per category and one banner per collection. New categories and collections get a slot automatically.", slots: [
      s("hero", "Hero photograph", "Wide, about 1920 × 900 px · fades into cream on the left"),
      s("story", "Our Story / craftsmanship photo", "About 1200 × 800 px"),
      ...cats.map((c): Slot => ({ title: `Category tile · ${c.name}`, hint: "Square, about 600 × 600 px", target: { kind: "category", id: c.id }, mediaId: c.image_media_id })),
      ...colSlots,
    ] },
    collections: { label: "Collections page", note: "Collection banners are shared with the home page.", slots: colSlots },
    custom: { label: "Custom Jewellery page", note: "Workshop photo and examples of past custom work (real pieces only).", slots: [
      s("custom_hero", "Workshop photo", "About 1200 × 750 px"), s("custom_example_1", "Example 1", "Square"), s("custom_example_2", "Example 2", "Square"), s("custom_example_3", "Example 3", "Square"),
    ] },
    about: { label: "About Us page", note: "Shop or owner photo.", slots: [s("about", "Shop / owner photo", "About 1200 × 750 px")] },
    logo: { label: "Logo & sharing", note: "Optional. The lotus mark is used when no logo is uploaded.", slots: [s("logo", "Logo", "PNG with transparent background"), s("share", "Sharing image", "1200 × 630 px, shown when the site link is shared")] },
  };
  const tab = t && tabs[t] ? t : "home";
  return (
    <>
      <PageHeader title="Images" subtitle="Every photo used on the website, grouped by page. Product photos are added on each product." />
      <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-line" aria-label="Pages">
        {Object.entries(tabs).map(([k, v]) => (
          <Link key={k} href={`/admin/images${k === "home" ? "" : `?tab=${k}`}`} aria-current={tab === k ? "page" : undefined} className={`whitespace-nowrap px-3 py-3 ${tab === k ? "border-b-2 border-burgundy font-semibold text-wine" : "text-muted"}`}>
            {v.label} <span className="text-[12px] text-muted">({v.slots.filter((x) => x.mediaId).length}/{v.slots.length})</span>
          </Link>
        ))}
      </nav>
      <p className="mb-4 text-[13px] text-muted">{tabs[tab].note}</p>
      {!r2Configured() ? <p className="mb-4 rounded bg-cancel-bg px-4 py-2 text-[14px] text-cancel-ink">Photo storage (Cloudflare R2) isn&apos;t configured yet, so images can&apos;t be uploaded.</p> : null}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tabs[tab].slots.map((sl) => <ImageSlot key={JSON.stringify(sl.target)} {...sl} disabled={!r2Configured()} />)}
      </ul>
    </>
  );
}
