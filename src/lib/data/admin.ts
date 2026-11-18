import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Analytics = {
  days: number;
  total_products: number;
  published_products: number;
  registered_customers: number;
  product_views: number;
  enquiry_initiations: number;
  enquiries_created: number;
  enquiries_converted: number;
  new_enquiries: number;
  initiations_by_day: { day: string; count: number }[];
  top_products: { id: string; code: string; name: string; views: number; enquiries: number; estimated_price: number | null; cover_media_id: string | null }[];
  category_views: { name: string; views: number }[];
  recent_activity: { kind: string; message: string; created_at: string }[];
};

export async function getAnalytics(days: number): Promise<Analytics> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_analytics", { p_days: days });
  if (error) throw new Error(`analytics: ${error.message}`);
  return data as unknown as Analytics;
}
