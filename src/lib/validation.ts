import { z } from "zod";

export const mobileSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, "").replace(/^(91|0)(?=[6-9]\d{9}$)/, ""))
  .refine((v) => /^[6-9]\d{9}$/.test(v), "Enter a valid 10-digit mobile number");

const optionalEmail = z
  .string()
  .trim()
  .max(254)
  .optional()
  .transform((v) => (v ? v.toLowerCase() : undefined))
  .refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email address");

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .transform((v) => (v ? v : undefined));

export const enquirySchema = z
  .object({
    source: z.enum(["product", "multi", "custom", "general"]),
    productCodes: z.array(z.string().regex(/^GNS-[A-Z]{2,4}-\d{4,}$/)).max(20).default([]),
    questions: z.array(z.string().trim().min(1).max(200)).max(12).default([]),
    customQuestion: optText(1000),
    customisation: z.record(z.string().max(20), z.string().max(40)).default({}),
    name: z.string().trim().min(1, "Please enter your name").max(80),
    mobile: mobileSchema,
    email: optionalEmail,
  })
  .superRefine((v, ctx) => {
    if ((v.source === "product" || v.source === "multi") && v.productCodes.length === 0)
      ctx.addIssue({ code: "custom", message: "Choose at least one design", path: ["productCodes"] });
    if (v.source === "custom" && (v.customQuestion ?? "").length < 3)
      ctx.addIssue({ code: "custom", message: "Please describe your idea", path: ["customQuestion"] });
    if (v.source !== "custom" && v.questions.length === 0 && !v.customQuestion)
      ctx.addIssue({ code: "custom", message: "Select at least one question or write your own", path: ["questions"] });
  });
export type EnquiryInput = z.input<typeof enquirySchema>;

const money = z.coerce.number().min(0, "Must be 0 or more").max(1e8);

/** Forgiving number parsing for typed fields: "27Gm", "1,25,000", "₹ 500", "2.5 g" -> numbers. Anything else stays NaN. */
export function cleanNumber(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const t = v.trim().replace(/[,₹\s]/g, "").replace(/^rs\.?/i, "").replace(/(grams?|gms?|g)$/i, "").replace(/%$/, "");
  if (t === "") return undefined;
  return /^\d*\.?\d+$|^\d+\.$/.test(t) ? Number(t) : NaN;
}
const moneyField = (label: string) =>
  z.preprocess((v) => cleanNumber(v) ?? 0, z.number({ error: `${label}: enter a number (for example 1500)` }).min(0, `${label} must be 0 or more`).max(1e8));

export const specSchema = z.object({ label: z.string().trim().min(1).max(40), value: z.string().trim().min(1).max(120) });

export const productSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(2, "Enter a product name").max(120),
    category_id: z.string().uuid("Choose a category"),
    subcategory_id: z.string().uuid().optional().or(z.literal("")).transform((v) => v || undefined),
    collection_id: z.string().uuid().optional().or(z.literal("")).transform((v) => v || undefined),
    description: optText(2000),
    model_description: optText(2000),
    metal: z.enum(["gold", "silver"]),
    karat: z.coerce.number().int().optional(),
    silver_purity: optText(20),
    weight_g: z.preprocess(cleanNumber, z.number({ error: "Weight: enter a number in grams (for example 27)" }).positive("Enter the weight in grams").max(9999)),
    making_type: z.enum(["fixed", "percent", "per_gram"]),
    making_value: moneyField("Making charges"),
    stone_value: moneyField("Stone value"),
    stones_note: optText(200),
    style: optText(40),
    occasion: optText(40),
    gender: z.enum(["women", "men", "unisex", "kids"]).optional().or(z.literal("")).transform((v) => v || undefined),
    specifications: z.array(specSchema).max(20).default([]),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    images: z
      .array(z.object({ media_id: z.string().uuid(), view_label: z.enum(["front", "side", "worn", "detail", "other"]) }))
      .max(12)
      .default([]),
    status: z.enum(["draft", "published"]),
  })
  .superRefine((v, ctx) => {
    if (v.metal === "gold" && ![24, 22, 18].includes(v.karat ?? 0))
      ctx.addIssue({ code: "custom", message: "Choose 24K, 22K or 18K", path: ["karat"] });
    if (v.making_type === "percent" && v.making_value > 100)
      ctx.addIssue({ code: "custom", message: "Percentage must be 100 or less", path: ["making_value"] });
    if (v.status === "published" && v.images.length === 0)
      ctx.addIssue({ code: "custom", message: "Add at least one actual product photo before publishing", path: ["images"] });
  })
  .transform((v) => ({
    ...v,
    karat: v.metal === "gold" ? v.karat : undefined,
    silver_purity: v.metal === "silver" ? v.silver_purity : undefined,
  }));
export type ProductInput = z.input<typeof productSchema>;

export const ratesSchema = z.object({
  gold22_per_10g: z.coerce.number().positive("Enter the 22K rate per 10 g").max(9_999_999),
  silver_per_kg: z.coerce.number().positive("Enter the silver rate per kg").max(99_999_999),
  gst_percent: z.coerce.number().min(0).max(28, "GST must be between 0 and 28%"),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");

export const orderSchema = z
  .object({
    subject: z.string().trim().min(2, "Enter an order subject").max(160),
    order_date: isoDate,
    expected_delivery_date: isoDate,
    customer_name: z.string().trim().min(1, "Enter the customer's name").max(80),
    mobile: mobileSchema,
    email: optionalEmail,
    location: optText(120),
    address: optText(500),
    quoted_amount: z.union([money, z.literal("")]).optional().transform((v) => (v === "" ? undefined : v)),
    advance_amount: z.union([money, z.literal("")]).optional().transform((v) => (v === "" ? undefined : v)),
    notes: optText(2000),
    enquiry_id: z.string().uuid().optional().or(z.literal("")).transform((v) => v || undefined),
    items: z
      .array(
        z.object({
          product_id: z.string().uuid().optional(),
          product_code: optText(40),
          product_name: z.string().trim().min(1, "Enter the product name").max(160),
          details: optText(1000),
          quantity: z.coerce.number().int().min(1).max(100).default(1),
        }),
      )
      .min(1, "Add at least one product")
      .max(50),
  })
  .superRefine((v, ctx) => {
    if (v.expected_delivery_date < v.order_date)
      ctx.addIssue({ code: "custom", message: "Delivery date can't be before the order date", path: ["expected_delivery_date"] });
    if (v.quoted_amount !== undefined && v.advance_amount !== undefined && v.advance_amount > v.quoted_amount)
      ctx.addIssue({ code: "custom", message: "Advance can't exceed the quoted amount", path: ["advance_amount"] });
  });
export type OrderInput = z.input<typeof orderSchema>;

export const siteSettingsSchema = z.object({
  shop_name: z.string().trim().min(1).max(80),
  tagline: z.string().trim().max(80),
  whatsapp_number: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/[\s()-]/g, "") : undefined))
    .refine((v) => !v || /^\+?[0-9]{10,15}$/.test(v), "Enter digits with country code, e.g. +919876543210"),
  phone: optText(30),
  email: optionalEmail,
  address: optText(500),
  opening_hours: optText(120),
  hero_eyebrow: z.string().trim().max(60),
  hero_headline: z.string().trim().min(1).max(80),
  hero_text: z.string().trim().max(300),
  brand_story: optText(1000),
  trust_highlights: optText(300),
  is_hallmarked: z.boolean(),
  about_intro: optText(300),
  about_story: optText(4000),
  about_values: optText(2000),
  instagram_url: optText(300).refine((v) => !v || v.startsWith("https://"), "Must start with https://"),
  youtube_url: optText(300).refine((v) => !v || v.startsWith("https://"), "Must start with https://"),
  facebook_url: optText(300).refine((v) => !v || v.startsWith("https://"), "Must start with https://"),
  privacy_text: optText(20000),
  terms_text: optText(20000),
});

export const adminEmailSchema = z.object({
  name: optText(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .refine((v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email address"),
});

export function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Please check the form";
}

export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path.join(".");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}
