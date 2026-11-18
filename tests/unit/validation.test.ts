import { describe, expect, it } from "vitest";
import { enquirySchema, productSchema, orderSchema, mobileSchema, siteSettingsSchema } from "@/lib/validation";

describe("mobileSchema", () => {
  it("accepts and normalises Indian mobiles", () => {
    expect(mobileSchema.parse("+91 98765 43210")).toBe("9876543210");
    expect(mobileSchema.parse("09876543210")).toBe("9876543210");
  });
  it("rejects invalid numbers", () => {
    expect(mobileSchema.safeParse("12345").success).toBe(false);
    expect(mobileSchema.safeParse("5876543210").success).toBe(false);
  });
});

describe("enquirySchema", () => {
  const base = { source: "product" as const, productCodes: ["GNS-PD-0001"], questions: ["What is the approximate price?"], name: "Asha", mobile: "9876543210" };
  it("accepts a valid guest enquiry without email", () => {
    expect(enquirySchema.safeParse(base).success).toBe(true);
  });
  it("requires name and mobile", () => {
    expect(enquirySchema.safeParse({ ...base, name: " " }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...base, mobile: "" }).success).toBe(false);
  });
  it("requires a question", () => {
    expect(enquirySchema.safeParse({ ...base, questions: [] }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...base, questions: [], customQuestion: "Is it 22K?" }).success).toBe(true);
  });
  it("custom enquiries need an idea, not products", () => {
    expect(enquirySchema.safeParse({ source: "custom", name: "A", mobile: "9876543210", customQuestion: "A 22K ring" }).success).toBe(true);
    expect(enquirySchema.safeParse({ source: "custom", name: "A", mobile: "9876543210" }).success).toBe(false);
  });
  it("rejects malformed product codes and bad email", () => {
    expect(enquirySchema.safeParse({ ...base, productCodes: ["'; drop table"] }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...base, email: "nope" }).success).toBe(false);
  });
});

describe("productSchema (simple product entry)", () => {
  const minimal = {
    name: "Floral Ring", category_id: "6f1b0d5e-2a4c-4b7e-9a51-0c2d3e4f5a6b", metal: "gold", karat: "22",
    weight_g: "2.8", making_type: "fixed", making_value: "6500", status: "draft",
  };
  it("accepts a draft with only essentials", () => {
    expect(productSchema.safeParse(minimal).success).toBe(true);
  });
  it("blocks publishing without a photo (BR-03)", () => {
    const r = productSchema.safeParse({ ...minimal, status: "published" });
    expect(r.success).toBe(false);
  });
  it("requires a valid karat for gold and drops karat for silver", () => {
    expect(productSchema.safeParse({ ...minimal, karat: "14" }).success).toBe(false);
    const s = productSchema.parse({ ...minimal, metal: "silver", karat: "22", silver_purity: "925" });
    expect(s.karat).toBeUndefined();
  });
  it("rejects non-positive weight and >100% making", () => {
    expect(productSchema.safeParse({ ...minimal, weight_g: "0" }).success).toBe(false);
    expect(productSchema.safeParse({ ...minimal, making_type: "percent", making_value: "150" }).success).toBe(false);
  });
});

describe("orderSchema", () => {
  const order = {
    subject: "Ring resize", order_date: "2026-11-14", expected_delivery_date: "2026-11-20", customer_name: "Priya",
    mobile: "9555512345", items: [{ product_name: "Floral Bloom Ring", product_code: "GNS-RG-0001" }],
  };
  it("accepts a valid order", () => {
    expect(orderSchema.safeParse(order).success).toBe(true);
  });
  it("rejects delivery before order date, missing products and advance > quote", () => {
    expect(orderSchema.safeParse({ ...order, expected_delivery_date: "2026-11-01" }).success).toBe(false);
    expect(orderSchema.safeParse({ ...order, items: [] }).success).toBe(false);
    expect(orderSchema.safeParse({ ...order, quoted_amount: "100", advance_amount: "200" }).success).toBe(false);
  });
});

describe("siteSettingsSchema", () => {
  it("validates WhatsApp number and https social links", () => {
    const base = { shop_name: "GNS", tagline: "", hero_eyebrow: "", hero_headline: "H", hero_text: "", is_hallmarked: false };
    expect(siteSettingsSchema.safeParse({ ...base, whatsapp_number: "+91 98765 43210" }).success).toBe(true);
    expect(siteSettingsSchema.safeParse({ ...base, whatsapp_number: "abc" }).success).toBe(false);
    expect(siteSettingsSchema.safeParse({ ...base, instagram_url: "javascript:alert(1)" }).success).toBe(false);
  });
});
