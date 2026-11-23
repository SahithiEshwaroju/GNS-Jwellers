import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createBackupZip, emptyTables, type Tables } from "@/lib/backup/format";

// Builds the "starter" backup (categories, subcategories, collections, tags, site text — no products, no photos)
// from starter/source/*.json. Ids are derived from names so rebuilding always gives identical ids.
const src = (f: string) => JSON.parse(readFileSync(new URL(`./source/${f}`, import.meta.url), "utf8"));
const uuid = (s: string) => {
  const h = createHash("sha256").update(s).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const COLLECTION_COLORS = ["#540404", "#a87c3a", "#7a4a2e", "#3f0d0c", "#9e7972", "#6b5550"];

export function buildStarterTables(): Tables {
  const t = emptyTables();
  const content = src("09_site_content.json");
  const home = src("08_home_page_settings.json");
  t.site_settings = [{
    id: 1, shop_name: content.shopName, tagline: content.tagline,
    whatsapp_number: content.whatsapp || null, phone: content.phone || null, email: content.email || null,
    address: content.address || null, opening_hours: content.hours || null,
    hero_eyebrow: content.heroEyebrow, hero_headline: content.heroTitle, hero_text: content.heroText,
    brand_story: content.story || null, trust_highlights: (content.trustPoints as string[]).join(", "),
    is_hallmarked: false, about_intro: content.aboutIntro || null, about_story: content.aboutStory || null,
    about_values: content.values || null, instagram_url: content.instagram || null, youtube_url: content.youtube || null,
    facebook_url: content.facebook || null, privacy_text: content.privacy || null, terms_text: content.terms || null,
    home_category_layout: home.category_display.style, home_category_limit: home.category_display.limit,
    home_category_cols_mobile: home.category_display.mobile_columns,
  }];
  for (const c of src("02_categories.json").categories as { id: string; name: string; code_prefix: string; subcategories: string[]; sort: number; show_on_home: boolean }[]) {
    const id = uuid(`category:${c.id}`);
    t.categories.push({ id, name: c.name, slug: c.id, code_prefix: c.code_prefix, sort_order: c.sort, show_on_home: c.show_on_home, image_media_id: null, next_seq: 1 });
    c.subcategories.forEach((n, i) => t.subcategories.push({ id: uuid(`sub:${c.id}:${n}`), category_id: id, name: n, sort_order: i + 1 }));
  }
  (src("03_collections.json").collections as { id: string; name: string; description: string; sort: number; active: boolean }[]).forEach((c, i) =>
    t.collections.push({ id: uuid(`collection:${c.id}`), name: c.name, slug: c.id, description: c.description, theme_color: COLLECTION_COLORS[i % COLLECTION_COLORS.length], sort_order: c.sort, show_on_home: c.active, image_media_id: null }));
  for (const n of src("04_tags.json").tags as string[]) t.tags.push({ id: uuid(`tag:${slug(n)}`), name: n });
  return t;
}

export function buildStarterZip(now = new Date("2026-11-23T00:00:00Z")) {
  return createBackupZip(buildStarterTables(), new Map(), now);
}
