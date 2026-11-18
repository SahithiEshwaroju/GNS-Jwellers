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
  // Layout and page render in parallel; for non-admins the layout shows "No admin access" and the
  // database refuses this call (42501). Return empty figures rather than throwing in that case.
  if (error?.code === "42501") return EMPTY(days);
  if (error) throw new Error(`analytics: ${error.message}`);
  return data as unknown as Analytics;
}

const EMPTY = (days: number): Analytics => ({
  days, total_products: 0, published_products: 0, registered_customers: 0, product_views: 0, enquiry_initiations: 0,
  enquiries_created: 0, enquiries_converted: 0, new_enquiries: 0, initiations_by_day: [], top_products: [], category_views: [], recent_activity: [],
});
