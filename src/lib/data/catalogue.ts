import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { CatalogueProductRow } from "@/lib/supabase/database.types";

export const PAGE_SIZE = 12;

export const PRICE_BANDS = [
  { key: "u25k", label: "Under ₹25,000", min: 0, max: 25000 },
  { key: "25k-50k", label: "₹25,000 – ₹50,000", min: 25000, max: 50000 },
  { key: "50k-1l", label: "₹50,000 – ₹1,00,000", min: 50000, max: 100000 },
  { key: "1l-2l", label: "₹1,00,000 – ₹2,00,000", min: 100000, max: 200000 },
  { key: "a2l", label: "Above ₹2,00,000", min: 200000, max: null },
] as const;

export const SORTS = [
  { key: "latest", label: "Latest" },
  { key: "updated", label: "Recently updated" },
  { key: "price-asc", label: "Price: Low to High" },
  { key: "price-desc", label: "Price: High to Low" },
  { key: "name", label: "Name: A–Z" },
] as const;
export type SortKey = (typeof SORTS)[number]["key"];

export const GENDERS = [
  { key: "women", label: "Women" },
  { key: "men", label: "Men" },
  { key: "unisex", label: "Unisex" },
  { key: "kids", label: "Kids" },
] as const;

export type CatalogueFilters = {
  q?: string;
  category: string[]; // slugs
  subcategory?: string; // id
  collection: string[]; // slugs
  metal: string[];
  karat: string[];
  price: string[];
  style: string[];
  occasion: string[];
  gender: string[];
  sort: SortKey;
  show: number;
};

const list = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v : (v ?? "").split(","))
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);

export function parseFilters(sp: Record<string, string | string[] | undefined>): CatalogueFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined));
  const sort = (SORTS.find((s) => s.key === one("sort"))?.key ?? "latest") as SortKey;
  const show = Math.min(Math.max(Number.parseInt(one("show") ?? "", 10) || PAGE_SIZE, PAGE_SIZE), 240);
  return {
    q: (one("q") ?? "").trim().slice(0, 80) || undefined,
    category: list(sp.category),
    subcategory: /^[0-9a-f-]{36}$/i.test(one("sub") ?? "") ? one("sub") : undefined,
    collection: list(sp.collection),
    metal: list(sp.metal).filter((m) => m === "gold" || m === "silver"),
    karat: list(sp.karat).filter((k) => ["24", "22", "18"].includes(k)),
    price: list(sp.price).filter((p) => PRICE_BANDS.some((b) => b.key === p)),
    style: list(sp.style),
    occasion: list(sp.occasion),
    gender: list(sp.gender).filter((g) => GENDERS.some((x) => x.key === g)),
    sort,
    show,
  };
}

/** Escapes LIKE wildcards so user search text is matched literally. */
export function likeEscape(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export type ProductCard = Pick<
  CatalogueProductRow,
  | "id" | "code" | "name" | "metal" | "karat" | "silver_purity" | "weight_g" | "estimated_price"
  | "collection_name" | "category_name" | "category_slug" | "cover_media_id" | "is_sample" | "description"
>;

const CARD_COLUMNS =
  "id, code, name, metal, karat, silver_purity, weight_g, estimated_price, collection_name, category_name, category_slug, cover_media_id, is_sample, description";

export async function searchCatalogue(f: CatalogueFilters): Promise<{ items: ProductCard[]; total: number }> {
  const supabase = await createClient();
  let q = supabase.from("catalogue_products").select(CARD_COLUMNS, { count: "exact" }).eq("status", "published");
  if (f.q) for (const word of f.q.toLowerCase().split(/\s+/).slice(0, 6)) q = q.ilike("search_text", `%${likeEscape(word)}%`);
  if (f.category.length) q = q.in("category_slug", f.category);
  if (f.subcategory) q = q.eq("subcategory_id", f.subcategory);
  if (f.collection.length) q = q.in("collection_slug", f.collection);
  if (f.metal.length) q = q.in("metal", f.metal);
  if (f.karat.length) q = q.in("karat", f.karat.map(Number));
  if (f.style.length) q = q.in("style", f.style);
  if (f.occasion.length) q = q.in("occasion", f.occasion);
  if (f.gender.length) q = q.in("gender", f.gender);
  if (f.price.length) {
    const ors = PRICE_BANDS.filter((b) => f.price.includes(b.key)).map((b) =>
      b.max === null ? `estimated_price.gte.${b.min}` : `and(estimated_price.gte.${b.min},estimated_price.lt.${b.max})`,
    );
    q = q.or(ors.join(","));
  }
  switch (f.sort) {
    case "price-asc": q = q.order("estimated_price", { ascending: true, nullsFirst: false }); break;
    case "price-desc": q = q.order("estimated_price", { ascending: false, nullsFirst: false }); break;
    case "name": q = q.order("name"); break;
    case "updated": q = q.order("updated_at", { ascending: false }); break;
    default: q = q.order("published_at", { ascending: false, nullsFirst: false });
  }
  q = q.order("id").range(0, f.show - 1);
  const { data, count, error } = await q;
  if (error) throw new Error(`catalogue: ${error.message}`);
  return { items: (data ?? []) as ProductCard[], total: count ?? 0 };
}

export type Facets = {
  metal: Record<string, number>;
  karat: Record<string, number>;
  price: Record<string, number>;
  style: Record<string, number>;
  occasion: Record<string, number>;
  gender: Record<string, number>;
  collection: Record<string, number>;
  category: Record<string, number>;
};

export const getFacets = cache(async (): Promise<Facets> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("catalogue_products")
    .select("category_slug, collection_slug, metal, karat, estimated_price, style, occasion, gender")
    .eq("status", "published");
  const f: Facets = { metal: {}, karat: {}, price: {}, style: {}, occasion: {}, gender: {}, collection: {}, category: {} };
  const inc = (o: Record<string, number>, k: string | null | undefined) => {
    if (k) o[k] = (o[k] ?? 0) + 1;
  };
  for (const p of data ?? []) {
    inc(f.category, p.category_slug);
    inc(f.collection, p.collection_slug);
    inc(f.metal, p.metal);
    inc(f.karat, p.karat ? String(p.karat) : null);
    inc(f.style, p.style);
    inc(f.occasion, p.occasion);
    inc(f.gender, p.gender);
    const price = p.estimated_price === null ? null : Number(p.estimated_price);
    if (price !== null)
      inc(f.price, PRICE_BANDS.find((b) => price >= b.min && (b.max === null || price < b.max))?.key);
  }
  return f;
});

export async function getFeatured(limit = 8): Promise<ProductCard[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("catalogue_products").select(CARD_COLUMNS).eq("status", "published").eq("is_featured", true)
    .order("published_at", { ascending: false }).limit(limit);
  return (data ?? []) as ProductCard[];
}

export async function getNewArrivals(limit = 4): Promise<ProductCard[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("catalogue_products").select(CARD_COLUMNS).eq("status", "published")
    .order("published_at", { ascending: false }).limit(limit);
  return (data ?? []) as ProductCard[];
}

export type ProductDetail = CatalogueProductRow & { images: { media_id: string; view_label: string }[] };

export const getProductByCode = cache(async (code: string): Promise<ProductDetail | null> => {
  if (!/^GNS-[A-Z]{2,4}-\d{4,}$/.test(code)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("catalogue_products").select("*").eq("code", code).maybeSingle();
  if (!data) return null;
  const { data: images } = await supabase
    .from("product_images").select("media_id, view_label").eq("product_id", data.id).order("sort_order");
  return { ...(data as CatalogueProductRow), images: images ?? [] };
});

export async function getSimilar(p: ProductDetail, limit = 4): Promise<ProductCard[]> {
  const supabase = await createClient();
  const { data: sameCat } = await supabase
    .from("catalogue_products").select(CARD_COLUMNS).eq("status", "published")
    .eq("category_id", p.category_id).neq("id", p.id).limit(limit);
  let items = (sameCat ?? []) as ProductCard[];
  if (items.length < limit) {
    let q = supabase.from("catalogue_products").select(CARD_COLUMNS).eq("status", "published").neq("id", p.id);
    if (items.length) q = q.not("id", "in", `(${items.map((i) => i.id).join(",")})`);
    if (p.collection_id) q = q.eq("collection_id", p.collection_id);
    const { data } = await q.limit(limit - items.length);
    items = items.concat((data ?? []) as ProductCard[]);
  }
  if (items.length < limit) {
    let q = supabase.from("catalogue_products").select(CARD_COLUMNS).eq("status", "published").neq("id", p.id);
    if (items.length) q = q.not("id", "in", `(${items.map((i) => i.id).join(",")})`);
    const { data } = await q.order("published_at", { ascending: false }).limit(limit - items.length);
    items = items.concat((data ?? []) as ProductCard[]);
  }
  return items;
}

export async function getProductsByCodes(codes: string[]): Promise<ProductCard[]> {
  const valid = codes.filter((c) => /^GNS-[A-Z]{2,4}-\d{4,}$/.test(c)).slice(0, 20);
  if (!valid.length) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("catalogue_products").select(CARD_COLUMNS).eq("status", "published").in("code", valid);
  return (data ?? []) as ProductCard[];
}
