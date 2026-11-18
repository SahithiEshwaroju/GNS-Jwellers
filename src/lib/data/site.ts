import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { CategoryRow, CollectionRow, SiteSettingsRow, SubcategoryRow } from "@/lib/supabase/database.types";
import type { Rates } from "@/lib/pricing";

export const mediaUrl = (id: string | null | undefined) => (id ? `/api/media/${id}` : null);

export const getSettings = cache(async (): Promise<SiteSettingsRow> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("site_settings").select("*").eq("id", 1).single();
  if (error || !data) throw new Error(`settings: ${error?.message}`);
  return data;
});

export type CurrentRates = Rates & { updatedAt: string };

export const getCurrentRates = cache(async (): Promise<CurrentRates | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("current_rates").select("*").maybeSingle();
  if (!data) return null;
  return {
    gold22Per10g: Number(data.gold22_per_10g),
    silverPerKg: Number(data.silver_per_kg),
    gstPercent: Number(data.gst_percent),
    updatedAt: data.created_at,
  };
});

export type CategoryWithSubs = CategoryRow & { subcategories: SubcategoryRow[]; productCount: number };

export const getCategories = cache(async (): Promise<CategoryWithSubs[]> => {
  const supabase = await createClient();
  const [{ data: cats }, { data: subs }, { data: counts }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order").order("name"),
    supabase.from("subcategories").select("*").order("sort_order").order("name"),
    supabase.from("catalogue_products").select("category_id").eq("status", "published"),
  ]);
  const tally = new Map<string, number>();
  (counts ?? []).forEach((r) => tally.set(r.category_id, (tally.get(r.category_id) ?? 0) + 1));
  return (cats ?? []).map((c) => ({
    ...c,
    subcategories: (subs ?? []).filter((s) => s.category_id === c.id),
    productCount: tally.get(c.id) ?? 0,
  }));
});

export type CollectionWithCount = CollectionRow & { productCount: number };

export const getCollections = cache(async (): Promise<CollectionWithCount[]> => {
  const supabase = await createClient();
  const [{ data: cols }, { data: counts }] = await Promise.all([
    supabase.from("collections").select("*").order("sort_order").order("name"),
    supabase.from("catalogue_products").select("collection_id").eq("status", "published"),
  ]);
  const tally = new Map<string, number>();
  (counts ?? []).forEach((r) => r.collection_id && tally.set(r.collection_id, (tally.get(r.collection_id) ?? 0) + 1));
  return (cols ?? []).map((c) => ({ ...c, productCount: tally.get(c.id) ?? 0 }));
});

export const getSiteImages = cache(async (): Promise<Record<string, string>> => {
  const supabase = await createClient();
  const { data } = await supabase.from("site_images").select("slot, media_id");
  return Object.fromEntries((data ?? []).map((r) => [r.slot, r.media_id]));
});
