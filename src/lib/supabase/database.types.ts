// Generated from the live schema (Supabase MCP generate_typescript_types, 2026-11-18) and trimmed to the
// parts this app uses. Regenerate after schema changes:
//   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Tbl<R, I = Partial<R>> = { Row: R; Insert: I; Update: Partial<I>; Relationships: [] };

export type ActivityRow = { actor: string | null; created_at: string; id: number; kind: string; message: string };
export type AdminRow = { added_by: string | null; created_at: string; email: string; name: string | null };
export type CategoryRow = {
  code_prefix: string; created_at: string; id: string; image_media_id: string | null; name: string;
  next_seq: number; show_on_home: boolean; slug: string; sort_order: number; updated_at: string;
};
export type CollectionRow = {
  created_at: string; description: string | null; id: string; image_media_id: string | null; name: string;
  show_on_home: boolean; slug: string; sort_order: number; theme_color: string; updated_at: string;
};
export type EnquiryRow = {
  admin_reply: string | null; client_token: string; created_at: string; custom_question: string | null;
  customer_name: string; customisation: Json; email: string | null; id: string; message: string; mobile: string;
  questions: string[]; ref: string; replied_at: string | null; source: string; status: string; updated_at: string;
  user_id: string | null; whatsapp_opened_at: string | null;
};
export type EnquiryItemRow = {
  enquiry_id: string; estimated_price: number | null; id: string; product_code: string; product_id: string | null;
  product_name: string; sort_order: number;
};
export type MediaRow = {
  alt_text: string | null; content_type: string; created_at: string; id: string; object_key: string; purpose: string;
  size_bytes: number; status: string; uploaded_by: string | null;
};
export type OrderItemRow = {
  details: string | null; id: string; order_id: string; product_code: string | null; product_id: string | null;
  product_name: string; quantity: number; sort_order: number;
};
export type OrderRow = {
  address: string | null; advance_amount: number | null; created_at: string; created_by: string | null;
  customer_name: string; email: string | null; enquiry_id: string | null; expected_delivery_date: string; id: string;
  location: string | null; mobile: string; notes: string | null; order_date: string; order_no: string;
  quoted_amount: number | null; status: string; subject: string; updated_at: string;
};
export type ProductImageRow = { id: string; media_id: string; product_id: string; sort_order: number; view_label: string };
export type ProductTagRow = { product_id: string; tag_id: string };
export type ProductViewRow = { id: number; product_id: string; user_id: string | null; viewed_at: string };
export type ProductRow = {
  category_id: string; code: string; collection_id: string | null; created_at: string; created_by: string | null;
  description: string | null; gender: string | null; id: string; is_featured: boolean; is_sample: boolean;
  karat: number | null; making_type: string; making_value: number; metal: string; model_description: string | null;
  name: string; occasion: string | null; published_at: string | null; silver_purity: string | null;
  specifications: Json; status: string; stone_value: number; stones_note: string | null; style: string | null;
  subcategory_id: string | null; updated_at: string; weight_g: number;
};
export type ProfileRow = { avatar_url: string | null; created_at: string; email: string | null; full_name: string | null; id: string };
export type RateRow = {
  created_at: string; created_by: string | null; created_by_email: string | null; gold22_per_10g: number;
  gst_percent: number; id: number; is_sample: boolean; silver_per_kg: number;
};
export type SavedRow = { created_at: string; product_id: string; user_id: string };
export type SiteImageRow = { media_id: string; slot: string; updated_at: string };
export type SiteSettingsRow = {
  about_intro: string | null; about_story: string | null; about_values: string | null; address: string | null;
  brand_story: string | null; email: string | null; facebook_url: string | null; hero_eyebrow: string;
  hero_headline: string; hero_text: string; home_category_cols_mobile: number; home_category_layout: string;
  home_category_limit: number; id: number; instagram_url: string | null; is_hallmarked: boolean;
  opening_hours: string | null; phone: string | null; privacy_text: string | null; shop_name: string; tagline: string;
  terms_text: string | null; trust_highlights: string | null; updated_at: string; updated_by: string | null;
  whatsapp_number: string | null; youtube_url: string | null;
};
export type SubcategoryRow = { category_id: string; created_at: string; id: string; name: string; sort_order: number };
export type TagRow = { created_at: string; id: string; name: string };

export type CatalogueProductRow = {
  category_id: string; category_name: string; category_slug: string; code: string; collection_id: string | null;
  collection_name: string | null; collection_slug: string | null; cover_media_id: string | null; created_at: string;
  description: string | null; estimated_price: number | null; gender: string | null; gst_amount: number | null;
  gst_percent: number | null; id: string; image_count: number; is_featured: boolean; is_sample: boolean;
  karat: number | null; making_amount: number | null; making_type: string; making_value: number; metal: string;
  metal_value: number | null; model_description: string | null; name: string; occasion: string | null;
  published_at: string | null; rate_per_g: number | null; rates_updated_at: string | null; search_text: string;
  silver_purity: string | null; specifications: Json; status: string; stone_amount: number | null;
  stone_value: number; stones_note: string | null; style: string | null; subcategory_id: string | null;
  subcategory_name: string | null; tag_names: string[]; updated_at: string; weight_g: number;
};
export type CurrentRatesRow = {
  created_at: string; gold22_per_10g: number; gst_percent: number; id: number; silver_per_kg: number;
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      activity_log: Tbl<ActivityRow>;
      admins: Tbl<AdminRow, Partial<AdminRow> & { email: string }>;
      categories: Tbl<CategoryRow, Partial<CategoryRow> & { name: string; slug: string; code_prefix: string }>;
      collections: Tbl<CollectionRow, Partial<CollectionRow> & { name: string; slug: string }>;
      enquiries: Tbl<EnquiryRow>;
      enquiry_items: Tbl<EnquiryItemRow>;
      media: Tbl<MediaRow, Partial<MediaRow> & { object_key: string; purpose: string; content_type: string; size_bytes: number }>;
      order_items: Tbl<OrderItemRow>;
      orders: Tbl<OrderRow>;
      product_images: Tbl<ProductImageRow, Partial<ProductImageRow> & { media_id: string; product_id: string }>;
      product_tags: Tbl<ProductTagRow, ProductTagRow>;
      product_views: Tbl<ProductViewRow>;
      products: Tbl<ProductRow>;
      profiles: Tbl<ProfileRow>;
      rate_updates: Tbl<RateRow, { gold22_per_10g: number; silver_per_kg: number; gst_percent?: number }>;
      saved_products: Tbl<SavedRow, { product_id: string; user_id: string; created_at?: string }>;
      site_images: Tbl<SiteImageRow, { media_id: string; slot: string; updated_at?: string }>;
      site_settings: Tbl<SiteSettingsRow>;
      subcategories: Tbl<SubcategoryRow, Partial<SubcategoryRow> & { category_id: string; name: string }>;
      tags: Tbl<TagRow, Partial<TagRow> & { name: string }>;
    };
    Views: {
      catalogue_products: { Row: CatalogueProductRow; Relationships: [] };
      current_rates: { Row: CurrentRatesRow; Relationships: [] };
    };
    Functions: {
      admin_analytics: { Args: { p_days?: number }; Returns: Json };
      admin_badges: { Args: never; Returns: Json };
      admin_list_admins: {
        Args: never;
        Returns: { created_at: string; email: string; is_self: boolean; last_sign_in_at: string | null; name: string | null }[];
      };
      admin_rate_history: {
        Args: { p_limit?: number };
        Returns: { created_at: string; created_by_email: string | null; gold22_per_10g: number; gst_percent: number; id: number; is_sample: boolean; silver_per_kg: number }[];
      };
      admin_remove_admin: { Args: { p_email: string }; Returns: undefined };
      admin_save_product: {
        Args: { p_images: Json; p_product: Json; p_status: string; p_tag_names: string[] };
        Returns: { code: string; id: string; removed_keys: string[] }[];
      };
      admin_set_product_status: { Args: { p_id: string; p_status: string }; Returns: undefined };
      admin_restore_backup: { Args: { p_tables: Json }; Returns: Json };
      admin_storage_stats: { Args: never; Returns: Json };
      admin_stale_media: { Args: never; Returns: { id: string; object_key: string }[] };
      confirm_order: { Args: { p_items: Json; p_order: Json }; Returns: { id: string; order_no: string }[] };
      create_enquiry: {
        Args: {
          p_custom_question: string | null; p_customer_name: string; p_customisation: Json; p_email: string | null;
          p_message: string; p_mobile: string; p_product_codes: string[]; p_questions: string[]; p_source: string;
        };
        Returns: { client_token: string; id: string; ref: string }[];
      };
      is_admin: { Args: never; Returns: boolean };
      mark_enquiry_whatsapp_opened: { Args: { p_client_token: string; p_enquiry_id: string }; Returns: boolean };
      normalize_mobile: { Args: { p: string }; Returns: string | null };
      record_product_view: { Args: { p_code: string }; Returns: undefined };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
