"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin, AuthError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteObjects, readObject } from "@/lib/r2";
import { r2Configured } from "@/lib/server-env";
import {
  productSchema, ratesSchema, orderSchema, siteSettingsSchema, adminEmailSchema, firstError,
  type ProductInput, type OrderInput,
} from "@/lib/validation";
import { slugify } from "@/lib/format";
import { draftReply, extractCatalogue, suggestDescription } from "@/lib/ai/gemini";
import { composeManualReply, type QA } from "@/lib/ai/prompts";
import type { ExtractedDraft, DescribeFacts } from "@/lib/ai/prompts";
import type { Json } from "@/lib/supabase/database.types";

export type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const fail = (error: string): Result<never> => ({ ok: false, error });

/** Maps database errors to safe messages; validation errors raised by our SQL are shown as-is. */
function dbError(e: { code?: string; message?: string } | null, fallback: string): Result<never> {
  if (!e) return fail(fallback);
  if (e.code === "22023" || e.code === "P0001" || e.code === "P0002") return fail(e.message ?? fallback);
  if (e.code === "23505") return fail("That name or code is already in use.");
  if (e.code === "23503") return fail("This item is still used elsewhere (for example by products), so it can't be removed.");
  if (e.code === "23514") return fail("Some values are outside the allowed range.");
  if (e.code === "42501") return fail("You don't have permission to do that.");
  console.error("[admin action]", e.code, e.message);
  return fail(fallback);
}

async function guard<T>(fn: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    await assertAdmin();
    return await fn();
  } catch (e) {
    if (e instanceof AuthError) return fail("Your admin session has ended. Please sign in again.");
    console.error("[admin action]", e instanceof Error ? e.message : e);
    return fail("Something went wrong. Please try again.");
  }
}

const uuid = z.string().uuid();

async function removeFromStorage(keys: string[]) {
  if (!keys.length || !r2Configured()) return;
  try {
    await deleteObjects(keys);
  } catch (e) {
    console.error("[r2 delete]", e instanceof Error ? e.message : e); // orphan listed later by admin_stale_media()
  }
}

function revalidateCatalogue() {
  revalidatePath("/", "layout");
}

// ------------------------------------------------------------------ products
export async function saveProduct(input: ProductInput): Promise<Result<{ id: string; code: string }>> {
  return guard(async () => {
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const v = parsed.data;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_save_product", {
      p_product: {
        id: v.id ?? "", name: v.name, category_id: v.category_id, subcategory_id: v.subcategory_id ?? "",
        collection_id: v.collection_id ?? "", description: v.description ?? "", model_description: v.model_description ?? "",
        metal: v.metal, karat: v.karat ? String(v.karat) : "", silver_purity: v.silver_purity ?? "", weight_g: String(v.weight_g),
        making_type: v.making_type, making_value: String(v.making_value), stone_value: String(v.stone_value),
        stones_note: v.stones_note ?? "", style: v.style ?? "", occasion: v.occasion ?? "", gender: v.gender ?? "",
        specifications: v.specifications as unknown as Json,
      },
      p_tag_names: v.tags,
      p_images: v.images as unknown as Json,
      p_status: v.status,
    });
    if (error || !data?.[0]) return dbError(error, "Couldn't save the product.");
    await removeFromStorage(data[0].removed_keys ?? []);
    revalidateCatalogue();
    return ok({ id: data[0].id, code: data[0].code });
  });
}

export async function setProductStatus(id: string, status: "draft" | "published"): Promise<Result> {
  return guard(async () => {
    if (!uuid.safeParse(id).success) return fail("Invalid product");
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_set_product_status", { p_id: id, p_status: status });
    if (error) return dbError(error, "Couldn't change the status.");
    revalidateCatalogue();
    return ok(null);
  });
}

export async function setProductFeatured(id: string, featured: boolean): Promise<Result> {
  return guard(async () => {
    if (!uuid.safeParse(id).success) return fail("Invalid product");
    const supabase = await createClient();
    const { error } = await supabase.from("products").update({ is_featured: featured }).eq("id", id);
    if (error) return dbError(error, "Couldn't update featured.");
    revalidateCatalogue();
    return ok(null);
  });
}

export async function deleteProduct(id: string): Promise<Result> {
  return guard(async () => {
    if (!uuid.safeParse(id).success) return fail("Invalid product");
    const supabase = await createClient();
    const { data: imgs } = await supabase.from("product_images").select("media_id").eq("product_id", id);
    const mediaIds = (imgs ?? []).map((i) => i.media_id);
    const { data: media } = mediaIds.length
      ? await supabase.from("media").select("object_key").in("id", mediaIds)
      : { data: [] as { object_key: string }[] };
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return dbError(error, "Couldn't delete the product.");
    if (mediaIds.length) await supabase.from("media").delete().in("id", mediaIds);
    await removeFromStorage((media ?? []).map((m) => m.object_key));
    revalidateCatalogue();
    return ok(null);
  });
}

export async function aiSuggestDescription(facts: DescribeFacts): Promise<Result<{ description: string; model_description: string }>> {
  return guard(async () => {
    const f = z.object({ name: z.string().min(2).max(120), metal: z.string().max(10) }).passthrough().safeParse(facts);
    if (!f.success) return fail("Enter the product name and metal first.");
    const r = await suggestDescription(facts);
    return r.ok ? ok(r.data) : fail(r.message);
  });
}

export async function aiExtractCatalogue(mediaId: string): Promise<Result<ExtractedDraft>> {
  return guard(async () => {
    if (!uuid.safeParse(mediaId).success) return fail("Invalid image");
    const supabase = await createClient();
    const { data: m } = await supabase.from("media").select("object_key, content_type, status, purpose").eq("id", mediaId).maybeSingle();
    if (!m || m.status !== "ready" || m.purpose !== "extract") return fail("Upload the catalogue image first.");
    const bytes = await readObject(m.object_key);
    const r = await extractCatalogue(bytes, m.content_type);
    // The catalogue page image is only needed for extraction; never kept or published.
    await supabase.from("media").delete().eq("id", mediaId);
    await removeFromStorage([m.object_key]);
    return r.ok ? ok(r.data) : fail(r.message);
  });
}

// ------------------------------------------------------------------ taxonomy
const nameSchema = z.string().trim().min(1, "Enter a name").max(60);

export async function addCategory(name: string, prefix: string): Promise<Result> {
  return guard(async () => {
    const n = nameSchema.safeParse(name);
    const p = z.string().trim().toUpperCase().regex(/^[A-Z]{2,4}$/, "Code prefix must be 2–4 letters").safeParse(prefix);
    if (!n.success) return fail(firstError(n.error));
    if (!p.success) return fail(firstError(p.error));
    const supabase = await createClient();
    const { count } = await supabase.from("categories").select("id", { count: "exact", head: true });
    const { error } = await supabase.from("categories").insert({ name: n.data, slug: slugify(n.data) || p.data.toLowerCase(), code_prefix: p.data, sort_order: (count ?? 0) + 1 });
    if (error) return dbError(error, "Couldn't add the category.");
    revalidateCatalogue();
    return ok(null);
  });
}

export async function renameCategory(id: string, name: string): Promise<Result> {
  return guard(async () => {
    const n = nameSchema.safeParse(name);
    if (!uuid.safeParse(id).success || !n.success) return fail("Enter a valid name");
    const supabase = await createClient();
    const { error } = await supabase.from("categories").update({ name: n.data, slug: slugify(n.data) }).eq("id", id);
    if (error) return dbError(error, "Couldn't rename the category.");
    revalidateCatalogue();
    return ok(null);
  });
}

export async function deleteCategory(id: string): Promise<Result> {
  return guard(async () => {
    if (!uuid.safeParse(id).success) return fail("Invalid category");
    const supabase = await createClient();
    const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("category_id", id);
    if (count) return fail(`This category has ${count} product(s). Move or delete them first.`);
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return dbError(error, "Couldn't delete the category.");
    revalidateCatalogue();
    return ok(null);
  });
}

export async function saveHomeCategories(input: {
  order: { id: string; show_on_home: boolean }[]; layout: string; limit: number; colsMobile: number;
}): Promise<Result> {
  return guard(async () => {
    const s = z.object({
      order: z.array(z.object({ id: uuid, show_on_home: z.boolean() })).max(100),
      layout: z.enum(["square", "round", "list"]),
      limit: z.number().int().min(2).max(24),
      colsMobile: z.union([z.literal(2), z.literal(3)]),
    }).safeParse(input);
    if (!s.success) return fail("Invalid home page settings");
    const supabase = await createClient();
    for (const [i, c] of s.data.order.entries()) {
      const { error } = await supabase.from("categories").update({ sort_order: i + 1, show_on_home: c.show_on_home }).eq("id", c.id);
      if (error) return dbError(error, "Couldn't save the order.");
    }
    const { error } = await supabase.from("site_settings").update({
      home_category_layout: s.data.layout, home_category_limit: s.data.limit, home_category_cols_mobile: s.data.colsMobile,
    }).eq("id", 1);
    if (error) return dbError(error, "Couldn't save the layout.");
    revalidateCatalogue();
    return ok(null);
  });
}

export async function addSubcategory(categoryId: string, name: string): Promise<Result> {
  return guard(async () => {
    const n = nameSchema.safeParse(name);
    if (!uuid.safeParse(categoryId).success || !n.success) return fail("Enter a subcategory name");
    const supabase = await createClient();
    const { count } = await supabase.from("subcategories").select("id", { count: "exact", head: true }).eq("category_id", categoryId);
    const { error } = await supabase.from("subcategories").insert({ category_id: categoryId, name: n.data, sort_order: (count ?? 0) + 1 });
    if (error) return dbError(error, "Couldn't add the subcategory.");
    revalidateCatalogue();
    return ok(null);
  });
}

export async function deleteSubcategory(id: string): Promise<Result> {
  return guard(async () => {
    if (!uuid.safeParse(id).success) return fail("Invalid subcategory");
    const supabase = await createClient();
    const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("subcategory_id", id);
    if (count) return fail(`${count} product(s) use this subcategory. Change them first.`);
    const { error } = await supabase.from("subcategories").delete().eq("id", id);
    if (error) return dbError(error, "Couldn't delete the subcategory.");
    revalidateCatalogue();
    return ok(null);
  });
}

const collectionSchema = z.object({
  id: uuid.optional(),
  name: nameSchema,
  description: z.string().trim().max(300).optional(),
  theme_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Choose a colour"),
  show_on_home: z.boolean(),
});

export async function saveCollection(input: z.input<typeof collectionSchema>): Promise<Result> {
  return guard(async () => {
    const s = collectionSchema.safeParse(input);
    if (!s.success) return fail(firstError(s.error));
    const supabase = await createClient();
    const row = { name: s.data.name, slug: slugify(s.data.name), description: s.data.description || null, theme_color: s.data.theme_color, show_on_home: s.data.show_on_home };
    if (s.data.id) {
      const { error } = await supabase.from("collections").update(row).eq("id", s.data.id);
      if (error) return dbError(error, "Couldn't save the collection.");
    } else {
      const { count } = await supabase.from("collections").select("id", { count: "exact", head: true });
      const { error } = await supabase.from("collections").insert({ ...row, sort_order: (count ?? 0) + 1 });
      if (error) return dbError(error, "Couldn't add the collection.");
    }
    revalidateCatalogue();
    return ok(null);
  });
}

export async function moveCollection(id: string, dir: -1 | 1): Promise<Result> {
  return guard(async () => {
    const supabase = await createClient();
    const { data } = await supabase.from("collections").select("id, sort_order").order("sort_order").order("name");
    const list = data ?? [];
    const i = list.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return ok(null);
    [list[i], list[j]] = [list[j], list[i]];
    for (const [n, c] of list.entries()) await supabase.from("collections").update({ sort_order: n + 1 }).eq("id", c.id);
    revalidateCatalogue();
    return ok(null);
  });
}

export async function deleteCollection(id: string): Promise<Result> {
  return guard(async () => {
    if (!uuid.safeParse(id).success) return fail("Invalid collection");
    const supabase = await createClient();
    const { error } = await supabase.from("collections").delete().eq("id", id);
    if (error) return dbError(error, "Couldn't delete the collection.");
    revalidateCatalogue();
    return ok(null);
  });
}

export async function saveTag(id: string | null, name: string): Promise<Result> {
  return guard(async () => {
    const n = z.string().trim().min(1).max(40).safeParse(name);
    if (!n.success) return fail("Enter a tag name");
    const supabase = await createClient();
    const { error } = id
      ? await supabase.from("tags").update({ name: n.data }).eq("id", id)
      : await supabase.from("tags").insert({ name: n.data });
    if (error) return dbError(error, "Couldn't save the tag.");
    revalidateCatalogue();
    return ok(null);
  });
}

export async function deleteTag(id: string): Promise<Result> {
  return guard(async () => {
    if (!uuid.safeParse(id).success) return fail("Invalid tag");
    const supabase = await createClient();
    const { error } = await supabase.from("tags").delete().eq("id", id);
    if (error) return dbError(error, "Couldn't delete the tag.");
    revalidateCatalogue();
    return ok(null);
  });
}

// ------------------------------------------------------------------ rates
export async function saveRates(input: { gold22_per_10g: string; silver_per_kg: string; gst_percent: string }): Promise<Result> {
  return guard(async () => {
    const s = ratesSchema.safeParse(input);
    if (!s.success) return fail(firstError(s.error));
    const supabase = await createClient();
    const { error } = await supabase.from("rate_updates").insert(s.data);
    if (error) return dbError(error, "Couldn't save the rates.");
    revalidateCatalogue();
    return ok(null);
  });
}

// ------------------------------------------------------------------ enquiries
const STATUSES = ["new", "in_progress", "replied", "converted", "closed"] as const;

export async function setEnquiryStatus(id: string, status: string): Promise<Result> {
  return guard(async () => {
    if (!uuid.safeParse(id).success || !STATUSES.includes(status as (typeof STATUSES)[number])) return fail("Invalid status");
    const supabase = await createClient();
    const { error } = await supabase.from("enquiries").update({ status }).eq("id", id);
    if (error) return dbError(error, "Couldn't update the status.");
    revalidatePath("/admin", "layout");
    return ok(null);
  });
}

const replyCtxSchema = z.object({
  enquiryId: uuid,
  qa: z.array(z.object({ question: z.string().max(1000), answer: z.string().max(1000) })).max(20),
  extraNote: z.string().max(1000).optional(),
});

async function replyContext(enquiryId: string, qa: QA[], extraNote?: string) {
  const supabase = await createClient();
  const [{ data: e }, { data: items }, { data: s }] = await Promise.all([
    supabase.from("enquiries").select("customer_name").eq("id", enquiryId).single(),
    supabase.from("enquiry_items").select("product_name, product_code").eq("enquiry_id", enquiryId).order("sort_order"),
    supabase.from("site_settings").select("shop_name").eq("id", 1).single(),
  ]);
  if (!e) return null;
  return {
    shopName: s?.shop_name ?? "GNS Jewellers",
    customerName: e.customer_name,
    products: (items ?? []).map((i) => ({ name: i.product_name, code: i.product_code })),
    qa,
    extraNote,
  };
}

/** AI-assisted reply drafted only from the customer's questions and the admin's answers (BR-08). */
export async function aiDraftReply(input: z.input<typeof replyCtxSchema>): Promise<Result<{ reply: string; usedAi: boolean; notice?: string }>> {
  return guard<{ reply: string; usedAi: boolean; notice?: string }>(async () => {
    const s = replyCtxSchema.safeParse(input);
    if (!s.success) return fail("Invalid answers");
    const ctx = await replyContext(s.data.enquiryId, s.data.qa, s.data.extraNote);
    if (!ctx) return fail("Enquiry not found");
    const r = await draftReply(ctx);
    if (r.ok) return ok({ reply: r.data, usedAi: true });
    return ok({ reply: composeManualReply(ctx), usedAi: false, notice: r.message });
  });
}

export async function manualReplyTemplate(enquiryId: string): Promise<Result<{ reply: string }>> {
  return guard(async () => {
    if (!uuid.safeParse(enquiryId).success) return fail("Invalid enquiry");
    const ctx = await replyContext(enquiryId, []);
    if (!ctx) return fail("Enquiry not found");
    return ok({ reply: composeManualReply(ctx) });
  });
}

/** Admin approved the reply: store it and mark replied. WhatsApp is opened by the browser; the admin sends manually. */
export async function approveReply(enquiryId: string, reply: string): Promise<Result> {
  return guard(async () => {
    const r = z.string().trim().min(2, "Write a reply first").max(4000).safeParse(reply);
    if (!uuid.safeParse(enquiryId).success) return fail("Invalid enquiry");
    if (!r.success) return fail(firstError(r.error));
    const supabase = await createClient();
    const { data: cur } = await supabase.from("enquiries").select("status").eq("id", enquiryId).single();
    const status = cur && ["converted", "closed"].includes(cur.status) ? cur.status : "replied";
    const { error } = await supabase.from("enquiries").update({ admin_reply: r.data, replied_at: new Date().toISOString(), status }).eq("id", enquiryId);
    if (error) return dbError(error, "Couldn't save the reply.");
    revalidatePath("/admin", "layout");
    return ok(null);
  });
}

// ------------------------------------------------------------------ orders
export async function confirmOrder(input: OrderInput): Promise<Result<{ id: string; orderNo: string }>> {
  return guard(async () => {
    const s = orderSchema.safeParse(input);
    if (!s.success) return fail(firstError(s.error));
    const { items, ...order } = s.data;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("confirm_order", {
      p_order: { ...order, quoted_amount: order.quoted_amount ?? "", advance_amount: order.advance_amount ?? "" } as unknown as Json,
      p_items: items as unknown as Json,
    });
    if (error || !data?.[0]) return dbError(error, "Couldn't confirm the order.");
    revalidatePath("/admin", "layout");
    return ok({ id: data[0].id, orderNo: data[0].order_no });
  });
}

export async function updateOrder(id: string, patch: { status?: string; notes?: string; expected_delivery_date?: string }): Promise<Result> {
  return guard(async () => {
    const s = z.object({
      status: z.enum(["confirmed", "delivered", "cancelled"]).optional(),
      notes: z.string().trim().max(2000).optional(),
      expected_delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).safeParse(patch);
    if (!uuid.safeParse(id).success || !s.success) return fail("Invalid update");
    const supabase = await createClient();
    const { error } = await supabase.from("orders").update({ ...s.data, notes: s.data.notes === "" ? null : s.data.notes }).eq("id", id);
    if (error) return dbError(error, "Couldn't update the order.");
    revalidatePath("/admin", "layout");
    return ok(null);
  });
}

export async function searchProductsForOrder(q: string): Promise<Result<{ id: string; code: string; name: string; price: number | null; metal: string; karat: number | null }[]>> {
  return guard(async () => {
    const term = q.trim().slice(0, 60).replace(/[\\%_]/g, (c) => `\\${c}`);
    const supabase = await createClient();
    let query = supabase.from("catalogue_products").select("id, code, name, estimated_price, metal, karat").order("name").limit(12);
    if (term) query = query.or(`name.ilike.%${term.replace(/[,()]/g, " ")}%,code.ilike.%${term.replace(/[,()]/g, " ")}%`);
    const { data, error } = await query;
    if (error) return dbError(error, "Search failed");
    return ok((data ?? []).map((p) => ({ id: p.id, code: p.code, name: p.name, price: p.estimated_price === null ? null : Number(p.estimated_price), metal: p.metal, karat: p.karat })));
  });
}

// ------------------------------------------------------------------ admins
export async function addAdmin(input: { name?: string; email: string }): Promise<Result> {
  return guard(async () => {
    const s = adminEmailSchema.safeParse(input);
    if (!s.success) return fail(firstError(s.error));
    const user = await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("admins").insert({ email: s.data.email, name: s.data.name ?? null, added_by: user.id });
    if (error) return error.code === "23505" ? fail("That email already has admin access.") : dbError(error, "Couldn't add the admin.");
    revalidatePath("/admin/admins");
    return ok(null);
  });
}

export async function removeAdmin(email: string): Promise<Result> {
  return guard(async () => {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_remove_admin", { p_email: email });
    if (error) return dbError(error, "Couldn't remove the admin.");
    revalidatePath("/admin/admins");
    return ok(null);
  });
}

// ------------------------------------------------------------------ site content & images
export async function saveSiteSettings(input: z.input<typeof siteSettingsSchema>): Promise<Result> {
  return guard(async () => {
    const s = siteSettingsSchema.safeParse(input);
    if (!s.success) return fail(firstError(s.error));
    const user = await assertAdmin();
    const supabase = await createClient();
    const v = s.data;
    const nul = (x: string | undefined) => (x === undefined || x === "" ? null : x);
    const { error } = await supabase.from("site_settings").update({
      shop_name: v.shop_name, tagline: v.tagline, whatsapp_number: nul(v.whatsapp_number), phone: nul(v.phone), email: nul(v.email),
      address: nul(v.address), opening_hours: nul(v.opening_hours), hero_eyebrow: v.hero_eyebrow, hero_headline: v.hero_headline,
      hero_text: v.hero_text, brand_story: nul(v.brand_story), trust_highlights: nul(v.trust_highlights), is_hallmarked: v.is_hallmarked,
      about_intro: nul(v.about_intro), about_story: nul(v.about_story), about_values: nul(v.about_values),
      instagram_url: nul(v.instagram_url), youtube_url: nul(v.youtube_url), facebook_url: nul(v.facebook_url),
      privacy_text: nul(v.privacy_text), terms_text: nul(v.terms_text), updated_by: user.id,
    }).eq("id", 1);
    if (error) return dbError(error, "Couldn't save the content.");
    revalidateCatalogue();
    return ok(null);
  });
}

const SLOTS = ["hero", "story", "custom_hero", "custom_example_1", "custom_example_2", "custom_example_3", "about", "logo", "share"] as const;
const imageTarget = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("slot"), slot: z.enum(SLOTS) }),
  z.object({ kind: z.literal("category"), id: uuid }),
  z.object({ kind: z.literal("collection"), id: uuid }),
]);
export type ImageTarget = z.infer<typeof imageTarget>;

/** Attaches an uploaded image to a site slot / category tile / collection banner, deleting the one it replaces. */
export async function setSiteImage(target: ImageTarget, mediaId: string | null): Promise<Result> {
  return guard(async () => {
    const t = imageTarget.safeParse(target);
    if (!t.success || (mediaId !== null && !uuid.safeParse(mediaId).success)) return fail("Invalid image");
    const supabase = await createClient();
    if (mediaId) {
      const { data: m } = await supabase.from("media").select("purpose, status").eq("id", mediaId).single();
      if (!m || m.purpose !== "site" || m.status !== "ready") return fail("The upload hasn't finished.");
    }
    let previous: string | null = null;
    if (t.data.kind === "slot") {
      const { data } = await supabase.from("site_images").select("media_id").eq("slot", t.data.slot).maybeSingle();
      previous = data?.media_id ?? null;
      const { error } = mediaId
        ? await supabase.from("site_images").upsert({ slot: t.data.slot, media_id: mediaId, updated_at: new Date().toISOString() })
        : await supabase.from("site_images").delete().eq("slot", t.data.slot);
      if (error) return dbError(error, "Couldn't save the image.");
    } else {
      const table = t.data.kind === "category" ? "categories" : "collections";
      const { data } = await supabase.from(table).select("image_media_id").eq("id", t.data.id).single();
      previous = data?.image_media_id ?? null;
      const { error } = await supabase.from(table).update({ image_media_id: mediaId }).eq("id", t.data.id);
      if (error) return dbError(error, "Couldn't save the image.");
    }
    if (previous && previous !== mediaId) {
      const { data: old } = await supabase.from("media").delete().eq("id", previous).select("object_key");
      await removeFromStorage((old ?? []).map((o) => o.object_key));
    }
    revalidateCatalogue();
    return ok(null);
  });
}

export async function cleanupStaleUploads(): Promise<Result<{ removed: number }>> {
  return guard(async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_stale_media");
    if (error) return dbError(error, "Couldn't list old uploads.");
    const rows = data ?? [];
    if (!rows.length) return ok({ removed: 0 });
    await supabase.from("media").delete().in("id", rows.map((r) => r.id));
    await removeFromStorage(rows.map((r) => r.object_key));
    return ok({ removed: rows.length });
  });
}
