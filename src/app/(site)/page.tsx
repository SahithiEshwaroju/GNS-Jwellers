import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Photo } from "@/components/ui/Photo";
import { ProductCard } from "@/components/site/ProductCard";
import { SectionTitle } from "@/components/site/SectionTitle";
import { getCategories, getCollections, getSettings, getSiteImages } from "@/lib/data/site";
import { getFeatured, getNewArrivals } from "@/lib/data/catalogue";
import { getSavedIds } from "@/lib/data/saved";
import { CollectionBanner } from "@/components/site/CollectionBanner";

export default async function HomePage() {
  const [settings, categories, collections, images, featured, arrivals, saved] = await Promise.all([
    getSettings(), getCategories(), getCollections(), getSiteImages(), getFeatured(8), getNewArrivals(4), getSavedIds(),
  ]);
  const homeCats = categories.filter((c) => c.show_on_home);
  const shownCats = homeCats.slice(0, settings.home_category_limit);
  const homeCols = collections.filter((c) => c.show_on_home).slice(0, 2);
  const highlights = (settings.trust_highlights ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4);
  const highlightIcons: IconName[] = ["diamond-outline", "check-circle", "lotus-logo", "shield-check"];
  const mobileCols = settings.home_category_cols_mobile === 2 ? "grid-cols-2" : "grid-cols-3";
  const round = settings.home_category_layout === "round";

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-champagne" aria-labelledby="hero-title">
        <div className="absolute inset-0 lg:left-[30%]">
          {images.hero ? (
            <Photo mediaId={images.hero} alt="" label="" eager className="object-[70%_center]" />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_70%_40%,#efe1cc_0,#f3ebdd_45%,#f3ebdd_100%)]" aria-hidden="true">
              <Icon name="lotus-logo" size={420} className="absolute right-[6%] top-1/2 hidden -translate-y-1/2 text-[#e6d5bb] lg:block" strokeWidth={0.6} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-champagne via-champagne/85 to-transparent lg:from-champagne lg:via-champagne/55 lg:via-18% lg:to-transparent lg:to-45%" />
        </div>
        <div className="wrap relative py-14 sm:py-20 lg:py-24">
          <div className="max-w-xl">
            <p className="eyebrow">{settings.hero_eyebrow}</p>
            <h1 id="hero-title" className="mt-4 text-[44px] sm:text-[clamp(44px,6vw,76px)]">{settings.hero_headline}</h1>
            <p className="mt-5 max-w-md text-[16px] text-muted sm:text-[17px]">{settings.hero_text}</p>
            <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row">
              <Link href="/collections" className="btn btn-primary">Explore Collections <Icon name="arrow-right" size={16} /></Link>
              <Link href="/custom-jewellery" className="btn btn-outline">Custom Design</Link>
            </div>
            {highlights.length ? (
              <ul className="mt-8 space-y-3">
                {highlights.map((h, i) => (
                  <li key={h} className="flex items-center gap-3 text-[15px] font-medium text-espresso sm:text-[17px] sm:font-normal sm:text-muted">
                    <Icon name={highlightIcons[i % highlightIcons.length]} size={20} className="text-gold-text" /> {h}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </section>

      {/* Shop by category */}
      {shownCats.length ? (
        <section className="wrap pt-14 sm:pt-20" aria-labelledby="cat-title">
          <SectionTitle id="cat-title" title="Shop by Category" />
          <ul className={`mx-auto grid max-w-[930px] gap-3 sm:gap-4 ${mobileCols} sm:grid-cols-3 lg:grid-cols-6`}>
            {shownCats.map((c, i) => (
              <li key={c.id}>
                <Link href={`/jewellery?category=${c.slug}`} className="group block text-center">
                  <span className={`block aspect-square overflow-hidden ${round ? "rounded-full" : "rounded-md"} transition group-hover:ring-2 group-hover:ring-dusty-rose`}>
                    <Photo mediaId={c.image_media_id} alt={c.name} label="Photo" tint={i} iconSize={34} />
                  </span>
                  <span className="mt-2 block text-[15px] font-medium text-espresso">{c.name}</span>
                  <span className="block text-[12.5px] text-muted">{c.productCount} {c.productCount === 1 ? "design" : "designs"}</span>
                </Link>
              </li>
            ))}
          </ul>
          {categories.length ? (
            <div className="mt-8 text-center">
              <Link href="/jewellery" className="btn btn-outline btn-sm">View all categories ({categories.length})</Link>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Collections */}
      {homeCols.length ? (
        <section className="wrap pt-14 sm:pt-16" aria-label="Collections">
          <div className="grid gap-5 md:grid-cols-2">
            {homeCols.map((c) => (
              <CollectionBanner key={c.id} c={c} />
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link href="/collections" className="btn btn-outline btn-sm">View all collections</Link>
          </div>
        </section>
      ) : null}

      {/* Featured */}
      {featured.length ? (
        <section className="wrap pt-16 sm:pt-20" aria-labelledby="feat-title">
          <SectionTitle id="feat-title" title="Featured Designs" subtitle={`Hand-picked by the ${settings.shop_name} team`} />
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {featured.map((p) => (
              <ProductCard key={p.id} p={p} saved={saved.has(p.id)} />
            ))}
          </div>
        </section>
      ) : null}

      {/* New arrivals */}
      {arrivals.length ? (
        <section className="wrap pt-16 sm:pt-20" aria-labelledby="new-title">
          <SectionTitle id="new-title" title="New Arrivals" subtitle="Fresh designs, recently added to the catalogue" />
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {arrivals.map((p) => (
              <ProductCard key={p.id} p={p} saved={saved.has(p.id)} showCollection={false} priceLabel="(Est.)" />
            ))}
          </div>
        </section>
      ) : null}

      {/* Our story — only shown once the owner has written it (no invented claims) */}
      {settings.brand_story ? (
        <section className="wrap grid items-center gap-8 pt-16 sm:pt-20 lg:grid-cols-2 lg:gap-12" aria-labelledby="story-title">
          <div className="aspect-[16/9] overflow-hidden rounded-md">
            <Photo mediaId={images.story} alt={`${settings.shop_name} craftsmanship`} label="Craftsmanship photo" tint={3} />
          </div>
          <div>
            <p className="eyebrow">Our Story</p>
            <h2 id="story-title" className="mt-3 text-[34px] sm:text-[40px]">{settings.shop_name}</h2>
            <p className="mt-4 whitespace-pre-line text-[16px] text-muted">{settings.brand_story}</p>
            <Link href="/about" className="btn btn-outline mt-6">Know More</Link>
          </div>
        </section>
      ) : null}

      {/* Highlights */}
      <section className="wrap pt-14" aria-label="Why shop with us">
        <ul className="grid grid-cols-2 gap-6 border-t border-line pt-10 lg:grid-cols-4">
          {settings.is_hallmarked ? (
            <Highlight icon="shield-check" title="Certified Purity" text="Hallmarked jewellery" />
          ) : null}
          <Highlight icon="diamond-outline" title="Curated Designs" text="Traditional & modern" />
          <Highlight icon="custom-tools" title="Custom Creations" text="Discuss your own design" href="/custom-jewellery" />
          <Highlight icon="headset" title="Personal Assistance" text="Talk to us on WhatsApp" />
        </ul>
      </section>
    </>
  );
}

function Highlight({ icon, title, text, href }: { icon: IconName; title: string; text: string; href?: string }) {
  const body = (
    <>
      <Icon name={icon} size={26} className="shrink-0 text-burgundy" />
      <span>
        <span className="block font-semibold text-espresso">{title}</span>
        <span className="block text-[14px] text-muted">{text}</span>
      </span>
    </>
  );
  return <li>{href ? <Link href={href} className="flex flex-col gap-2 sm:flex-row sm:gap-4">{body}</Link> : <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">{body}</div>}</li>;
}
