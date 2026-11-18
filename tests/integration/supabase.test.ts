/** Real authorisation tests against the Supabase project (RLS + RPCs). Requires network access and test accounts. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, hasSupabase, randomMobile, signedIn } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type C = SupabaseClient<Database>;
const d = hasSupabase ? describe : describe.skip;

d("Supabase RLS and RPCs", () => {
  let anon: C, customer: C, other: C, admin: C;
  let publishedCode: string, publishedId: string, categoryId: string;
  let draftId: string, draftCode: string;
  const createdEnquiryIds: string[] = [];

  const enquiry = (over: Partial<Database["public"]["Functions"]["create_enquiry"]["Args"]> = {}) => ({
    p_source: "product", p_customer_name: "E2E Guest", p_mobile: randomMobile(), p_email: null,
    p_product_codes: [publishedCode], p_questions: ["What is the approximate price?"], p_custom_question: null,
    p_customisation: {}, p_message: "Hello", ...over,
  });

  beforeAll(async () => {
    anon = anonClient();
    [customer, other, admin] = await Promise.all([signedIn("CUSTOMER"), signedIn("OTHER"), signedIn("ADMIN")]);
    const { data } = await anon.from("catalogue_products").select("id, code, category_id").limit(1).single();
    publishedCode = data!.code; publishedId = data!.id; categoryId = data!.category_id;
    const { data: saved, error } = await admin.rpc("admin_save_product", {
      p_product: { name: "E2E Draft Ring", category_id: categoryId, metal: "gold", karat: "22", weight_g: "1.5", making_type: "fixed", making_value: "100" },
      p_tag_names: ["E2E"], p_images: [], p_status: "draft",
    });
    if (error) throw error;
    draftId = saved![0].id; draftCode = saved![0].code;
  });

  afterAll(async () => {
    if (createdEnquiryIds.length) await admin.from("enquiries").delete().in("id", createdEnquiryIds);
    if (draftId) await admin.from("products").delete().eq("id", draftId);
    await admin.from("tags").delete().eq("name", "E2E");
  });

  describe("anonymous visitor", () => {
    it("reads published products with computed prices", async () => {
      const { data, error } = await anon.from("catalogue_products").select("code, estimated_price, status");
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
      expect(data!.every((p) => p.status === "published")).toBe(true);
      expect(data!.find((p) => p.code === "GNS-NK-0001")?.estimated_price).toBeDefined();
    });
    it("cannot see draft products", async () => {
      const { data } = await anon.from("products").select("id").eq("id", draftId);
      expect(data).toEqual([]);
    });
    it.each(["enquiries", "enquiry_items", "orders", "order_items", "product_views", "activity_log", "profiles", "admins", "saved_products"] as const)(
      "cannot read %s",
      async (table) => {
        const { data, error } = await anon.from(table).select("*").limit(1);
        expect(error !== null || (data ?? []).length === 0).toBe(true);
      },
    );
    it("cannot write catalogue, rates or settings", async () => {
      expect((await anon.from("categories").insert({ name: "Hack", slug: "hack", code_prefix: "HK" })).error).not.toBeNull();
      expect((await anon.from("rate_updates").insert({ gold22_per_10g: 1, silver_per_kg: 1 })).error).not.toBeNull();
      const upd = await anon.from("site_settings").update({ shop_name: "Hacked" }).eq("id", 1).select();
      expect(upd.error !== null || (upd.data ?? []).length === 0).toBe(true);
      const del = await anon.from("products").delete().eq("id", publishedId).select();
      expect(del.error !== null || (del.data ?? []).length === 0).toBe(true);
    });
    it("cannot read who updated the rates", async () => {
      const { error } = await anon.from("rate_updates").select("created_by_email").limit(1);
      expect(error).not.toBeNull();
    });
    it("cannot call admin functions", async () => {
      for (const fn of ["admin_analytics", "admin_list_admins", "admin_badges", "admin_stale_media"] as const) {
        expect((await anon.rpc(fn)).error, fn).not.toBeNull();
      }
      expect((await anon.rpc("confirm_order", { p_order: {}, p_items: [] })).error).not.toBeNull();
    });
    it("is not an admin", async () => {
      expect((await anon.rpc("is_admin")).data).toBe(false);
    });
  });

  describe("guest enquiries (create_enquiry)", () => {
    it("creates an enquiry with a reference and server-side product snapshot", async () => {
      const { data, error } = await anon.rpc("create_enquiry", enquiry());
      expect(error).toBeNull();
      expect(data![0].ref).toMatch(/^GNS-ENQ-\d+$/);
      createdEnquiryIds.push(data![0].id);
      const items = await admin.from("enquiry_items").select("product_code, estimated_price").eq("enquiry_id", data![0].id);
      expect(items.data![0].product_code).toBe(publishedCode);
      expect(items.data![0].estimated_price).not.toBeNull();
    });
    it("records WhatsApp opened only with the right token", async () => {
      const { data } = await anon.rpc("create_enquiry", enquiry());
      createdEnquiryIds.push(data![0].id);
      expect((await anon.rpc("mark_enquiry_whatsapp_opened", { p_enquiry_id: data![0].id, p_client_token: crypto.randomUUID() })).data).toBe(false);
      expect((await anon.rpc("mark_enquiry_whatsapp_opened", { p_enquiry_id: data![0].id, p_client_token: data![0].client_token })).data).toBe(true);
      const row = await admin.from("enquiries").select("whatsapp_opened_at").eq("id", data![0].id).single();
      expect(row.data!.whatsapp_opened_at).not.toBeNull();
    });
    it("rejects invalid mobile, missing name, drafts and unknown products", async () => {
      expect((await anon.rpc("create_enquiry", enquiry({ p_mobile: "12345" }))).error?.message).toMatch(/mobile/);
      expect((await anon.rpc("create_enquiry", enquiry({ p_customer_name: "  " }))).error?.message).toMatch(/name/);
      expect((await anon.rpc("create_enquiry", enquiry({ p_product_codes: [draftCode] }))).error?.message).toMatch(/no longer available/);
      expect((await anon.rpc("create_enquiry", enquiry({ p_product_codes: ["GNS-XX-9999"] }))).error).not.toBeNull();
      expect((await anon.rpc("create_enquiry", enquiry({ p_source: "admin" }))).error).not.toBeNull();
    });
    it("rate-limits bursts from one mobile", async () => {
      const mobile = randomMobile();
      let lastError: string | undefined;
      for (let i = 0; i < 6; i++) {
        const r = await anon.rpc("create_enquiry", enquiry({ p_mobile: mobile }));
        if (r.data) createdEnquiryIds.push(r.data[0].id);
        lastError = r.error?.message;
      }
      expect(lastError).toMatch(/Too many enquiries/);
    });
    it("accepts custom-design enquiries without products", async () => {
      const r = await anon.rpc("create_enquiry", enquiry({ p_source: "custom", p_product_codes: [], p_questions: [], p_custom_question: "22K temple necklace ~25 g" }));
      expect(r.error).toBeNull();
      createdEnquiryIds.push(r.data![0].id);
    });
    it("records product views for published products only", async () => {
      expect((await anon.rpc("record_product_view", { p_code: publishedCode })).error).toBeNull();
    });
  });

  describe("signed-in customer", () => {
    it("is not an admin and cannot escalate", async () => {
      expect((await customer.rpc("is_admin")).data).toBe(false);
      expect((await customer.from("admins").insert({ email: process.env.TEST_CUSTOMER_EMAIL! })).error).not.toBeNull();
      expect((await customer.rpc("admin_analytics")).error?.message).toMatch(/Not authorised/);
      expect((await customer.rpc("confirm_order", { p_order: {}, p_items: [] })).error?.message).toMatch(/Not authorised/);
    });
    it("saves and removes published designs; drafts cannot be saved", async () => {
      const { data: u } = await customer.auth.getUser();
      await customer.from("saved_products").delete().eq("product_id", publishedId);
      expect((await customer.from("saved_products").insert({ user_id: u.user!.id, product_id: publishedId })).error).toBeNull();
      expect((await customer.from("saved_products").insert({ user_id: u.user!.id, product_id: draftId })).error).not.toBeNull();
      const mine = await customer.from("saved_products").select("product_id");
      expect(mine.data!.map((r) => r.product_id)).toContain(publishedId);
      // another customer can't see or delete them, nor save on someone else's behalf
      expect((await other.from("saved_products").select("*").eq("user_id", u.user!.id)).data).toEqual([]);
      expect((await other.from("saved_products").insert({ user_id: u.user!.id, product_id: publishedId })).error).not.toBeNull();
      const del = await other.from("saved_products").delete().eq("user_id", u.user!.id).select();
      expect(del.data ?? []).toEqual([]);
      expect((await customer.from("saved_products").delete().eq("product_id", publishedId)).error).toBeNull();
    });
    it("cannot read enquiries, orders or other profiles", async () => {
      expect((await customer.from("enquiries").select("id")).data ?? []).toEqual([]);
      expect((await customer.from("orders").select("id")).data ?? []).toEqual([]);
      const profiles = await customer.from("profiles").select("email");
      expect(profiles.data!.every((p) => p.email === process.env.TEST_CUSTOMER_EMAIL)).toBe(true);
    });
    it("cannot modify products", async () => {
      const r = await customer.from("products").update({ name: "Hacked" }).eq("id", publishedId).select();
      expect(r.error !== null || (r.data ?? []).length === 0).toBe(true);
    });
  });

  describe("admin", () => {
    it("sees drafts and full enquiry data", async () => {
      expect((await admin.from("products").select("id").eq("id", draftId)).data).toHaveLength(1);
      expect((await admin.from("enquiries").select("id, mobile").limit(1)).error).toBeNull();
    });
    it("product codes are generated and immutable", async () => {
      expect(draftCode).toMatch(/^GNS-[A-Z]{2,4}-\d{4}$/);
      await admin.from("products").update({ code: "GNS-HACK-0001" }).eq("id", draftId);
      expect((await admin.from("products").select("code").eq("id", draftId).single()).data!.code).toBe(draftCode);
    });
    it("cannot publish a product without a photo (BR-03)", async () => {
      expect((await admin.rpc("admin_set_product_status", { p_id: draftId, p_status: "published" })).error?.message).toMatch(/photo/);
    });
    it("confirms orders with unique sequential numbers", async () => {
      const order = { subject: "E2E test order", order_date: "2026-11-18", expected_delivery_date: "2026-11-25", customer_name: "E2E Customer", mobile: "9876543210" };
      const a = await admin.rpc("confirm_order", { p_order: order, p_items: [{ product_id: publishedId }] });
      const b = await admin.rpc("confirm_order", { p_order: order, p_items: [{ product_name: "Manual kada", details: "Plain silver" }] });
      expect(a.error).toBeNull();
      expect(b.error).toBeNull();
      expect(a.data![0].order_no).toMatch(/^GNS-\d{4,}$/);
      expect(a.data![0].order_no).not.toBe(b.data![0].order_no);
      const items = await admin.from("order_items").select("product_code, product_name").eq("order_id", a.data![0].id);
      expect(items.data![0].product_code).toBe(publishedCode);
      await admin.from("orders").update({ status: "cancelled" }).in("id", [a.data![0].id, b.data![0].id]);
    });
    it("rejects invalid orders", async () => {
      const bad = { subject: "E2E bad", order_date: "2026-11-18", expected_delivery_date: "2026-11-01", customer_name: "E2E", mobile: "9876543210" };
      expect((await admin.rpc("confirm_order", { p_order: bad, p_items: [{ product_name: "x" }] })).error).not.toBeNull();
      expect((await admin.rpc("confirm_order", { p_order: { ...bad, expected_delivery_date: "2026-11-30" }, p_items: [] })).error?.message).toMatch(/at least one product/);
    });
    it("cannot remove own admin access", async () => {
      expect((await admin.rpc("admin_remove_admin", { p_email: process.env.TEST_ADMIN_EMAIL! })).error?.message).toMatch(/own account/);
    });
    it("gets analytics", async () => {
      const { data, error } = await admin.rpc("admin_analytics", { p_days: 30 });
      expect(error).toBeNull();
      expect(data).toMatchObject({ days: 30 });
      expect(Array.isArray((data as { initiations_by_day: unknown[] }).initiations_by_day)).toBe(true);
    });
    it("rate changes recalculate catalogue prices", async () => {
      const before = (await admin.from("current_rates").select("*").single()).data!;
      const price = async () => (await anon.from("catalogue_products").select("estimated_price").eq("code", "GNS-NK-0001").single()).data!.estimated_price!;
      const p1 = await price();
      expect((await admin.from("rate_updates").insert({ gold22_per_10g: Number(before.gold22_per_10g) + 1000, silver_per_kg: before.silver_per_kg, gst_percent: before.gst_percent })).error).toBeNull();
      const p2 = await price();
      expect(p2).toBeGreaterThan(p1);
      await admin.from("rate_updates").insert({ gold22_per_10g: before.gold22_per_10g, silver_per_kg: before.silver_per_kg, gst_percent: before.gst_percent });
      expect(await price()).toBe(p1);
      const hist = await admin.rpc("admin_rate_history", { p_limit: 2 });
      expect(hist.data![0].created_by_email).toBe(process.env.TEST_ADMIN_EMAIL);
    });
    it("rate history is append-only", async () => {
      const r = await admin.from("rate_updates").delete().gt("id", 0).select();
      expect(r.error !== null || (r.data ?? []).length === 0).toBe(true);
    });
  });
});
