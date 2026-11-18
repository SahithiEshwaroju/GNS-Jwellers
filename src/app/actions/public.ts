"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/data/site";
import { getProductsByCodes } from "@/lib/data/catalogue";
import { enquirySchema, firstError, type EnquiryInput } from "@/lib/validation";
import { buildEnquiryMessage, whatsappLink } from "@/lib/whatsapp";
import { publicEnv } from "@/lib/env";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function prepare(input: EnquiryInput) {
  const parsed = enquirySchema.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error) } as const;
  const v = parsed.data;
  const [settings, products] = await Promise.all([getSettings(), getProductsByCodes(v.productCodes)]);
  if (v.source !== "custom" && products.length !== new Set(v.productCodes).size) {
    return { error: "One of the selected designs is no longer available." } as const;
  }
  const ordered = v.productCodes.map((c) => products.find((p) => p.code === c)!).filter(Boolean);
  const msgInput = {
    shopName: settings.shop_name,
    source: v.source,
    products: ordered.map((p) => ({
      code: p.code, name: p.name, estimatedPrice: p.estimated_price === null ? null : Number(p.estimated_price),
      url: `${publicEnv.siteUrl}/product/${p.code}`,
    })),
    questions: v.questions,
    customQuestion: v.customQuestion,
    customisation: v.customisation,
    name: v.name,
    mobile: v.mobile,
    email: v.email,
  };
  return { v, settings, msgInput } as const;
}

/** Step 2 of the enquiry builder: the exact message the customer will send. Nothing is stored. */
export async function previewEnquiry(input: EnquiryInput): Promise<ActionResult<{ message: string; hasWhatsApp: boolean }>> {
  const p = await prepare(input);
  if ("error" in p) return { ok: false, error: p.error! };
  return { ok: true, data: { message: buildEnquiryMessage(p.msgInput), hasWhatsApp: Boolean(p.settings.whatsapp_number) } };
}

/** Step 3: records the enquiry and returns the WhatsApp link (customer still sends manually). */
export async function submitEnquiry(
  input: EnquiryInput,
): Promise<ActionResult<{ enquiryId: string; token: string; ref: string; message: string; whatsappUrl: string | null }>> {
  const p = await prepare(input);
  if ("error" in p) return { ok: false, error: p.error! };
  const { v, settings, msgInput } = p;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_enquiry", {
    p_source: v.source,
    p_customer_name: v.name,
    p_mobile: v.mobile,
    p_email: v.email ?? null,
    p_product_codes: v.productCodes,
    p_questions: v.questions,
    p_custom_question: v.customQuestion ?? null,
    p_customisation: v.customisation,
    p_message: buildEnquiryMessage(msgInput),
  });
  if (error || !data?.[0]) {
    const known = error?.code === "22023" || error?.code === "P0001";
    if (!known) console.error("[submitEnquiry]", error?.message);
    return { ok: false, error: known ? error!.message : "We couldn't record your enquiry. Please try again." };
  }
  const row = data[0];
  const message = buildEnquiryMessage({ ...msgInput, ref: row.ref });
  return {
    ok: true,
    data: { enquiryId: row.id, token: row.client_token, ref: row.ref, message, whatsappUrl: whatsappLink(settings.whatsapp_number, message) },
  };
}

export async function markWhatsAppOpened(enquiryId: string, token: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(enquiryId) || !/^[0-9a-f-]{36}$/i.test(token)) return;
  const supabase = await createClient();
  await supabase.rpc("mark_enquiry_whatsapp_opened", { p_enquiry_id: enquiryId, p_client_token: token });
}

export async function recordProductView(code: string): Promise<void> {
  if (!/^GNS-[A-Z]{2,4}-\d{4,}$/.test(code)) return;
  const supabase = await createClient();
  await supabase.rpc("record_product_view", { p_code: code });
}

export async function toggleSaved(productId: string): Promise<ActionResult<{ saved: boolean }> & { needsSignIn?: boolean }> {
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return { ok: false, error: "Invalid design" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to save designs", needsSignIn: true };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("saved_products").select("product_id").eq("product_id", productId).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("saved_products").delete().eq("product_id", productId).eq("user_id", user.id);
    if (error) return { ok: false, error: "Couldn't update saved designs" };
    revalidatePath("/saved");
    return { ok: true, data: { saved: false } };
  }
  const { error } = await supabase.from("saved_products").insert({ user_id: user.id, product_id: productId });
  if (error) return { ok: false, error: "Couldn't save this design" };
  revalidatePath("/saved");
  return { ok: true, data: { saved: true } };
}
