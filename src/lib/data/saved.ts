import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import type { ProductCard } from "./catalogue";

/** IDs of products the signed-in customer has saved (empty when signed out). */
export const getSavedIds = cache(async (): Promise<Set<string>> => {
  const user = await getCurrentUser();
  if (!user) return new Set();
  const supabase = await createClient();
  const { data } = await supabase.from("saved_products").select("product_id");
  return new Set((data ?? []).map((r) => r.product_id));
});

export async function getSavedProducts(): Promise<ProductCard[]> {
  const ids = [...(await getSavedIds())];
  if (!ids.length) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("catalogue_products")
    .select("id, code, name, metal, karat, silver_purity, weight_g, estimated_price, collection_name, category_name, category_slug, cover_media_id, is_sample, description")
    .in("id", ids)
    .eq("status", "published");
  return (data ?? []) as ProductCard[];
}
