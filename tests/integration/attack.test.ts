/**
 * Attacker-perspective tests against the live Supabase project. Nothing here uses the UI: requests go straight
 * to PostgREST / Auth / RPC with a normal customer's token, an anonymous key, and forged tokens.
 * Requires network access and the test accounts (see TEST_REPORT.md).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { anonClient, hasSupabase, randomMobile, signedIn } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type C = SupabaseClient<Database>;
const d = hasSupabase ? describe : describe.skip;
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Raw PostgREST request, exactly as an attacker would send it with curl. */
async function rest(method: string, path: string, token: string | null, body?: unknown, extra: Record<string, string> = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${token ?? KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
}

const rows = (r: { json: unknown }) => (Array.isArray(r.json) ? r.json : []);
const denied = (r: { status: number; json: unknown }) => r.status >= 400 || rows(r).length === 0;

d("Attack: valid customer account, direct API access (no UI)", () => {
  let admin: C, customer: C, other: C;
  let ctoken = "", otoken = "", cuid = "", ouid = "";
  let productId = "", productCode = "";

  beforeAll(async () => {
    [admin, customer, other] = await Promise.all([signedIn("ADMIN"), signedIn("CUSTOMER"), signedIn("OTHER")]);
    ctoken = (await customer.auth.getSession()).data.session!.access_token;
    otoken = (await other.auth.getSession()).data.session!.access_token;
    cuid = (await customer.auth.getUser()).data.user!.id;
    ouid = (await other.auth.getUser()).data.user!.id;
    const p = (await anonClient().from("catalogue_products").select("id, code").limit(1).single()).data!;
    productId = p.id; productCode = p.code;
  });

  describe("privileged tables are invisible and immutable", () => {
    it.each(["admins", "orders", "order_items", "enquiries", "enquiry_items", "activity_log", "product_views"])("cannot read %s", async (t) => {
      const r = await rest("GET", `${t}?select=*`, ctoken);
      expect(denied(r), `${t}: ${r.status} ${r.text.slice(0, 120)}`).toBe(true);
    });

    it("cannot add itself to admins (privilege escalation)", async () => {
      const email = process.env.TEST_CUSTOMER_EMAIL!;
      const r = await rest("POST", "admins", ctoken, { email, name: "pwn", added_by: cuid });
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect((await admin.from("admins").select("email").eq("email", email)).data).toEqual([]);
      expect((await customer.rpc("is_admin")).data).toBe(false);
    });

    it("cannot modify or delete catalogue rows, settings, rates, taxonomy, images or media", async () => {
      const before = (await admin.from("products").select("is_featured, name").eq("id", productId).single()).data!;
      expect(denied(await rest("PATCH", `products?id=eq.${productId}`, ctoken, { is_featured: true, name: "HACKED" }))).toBe(true);
      expect(denied(await rest("DELETE", `products?id=eq.${productId}`, ctoken))).toBe(true);
      expect(denied(await rest("PATCH", "site_settings?id=eq.1", ctoken, { shop_name: "HACKED", whatsapp_number: "+919999999999" }))).toBe(true);
      expect((await rest("POST", "rate_updates", ctoken, { gold22_per_10g: 1, silver_per_kg: 1 })).status).toBeGreaterThanOrEqual(400);
      expect((await rest("POST", "categories", ctoken, { name: "x", slug: "x", code_prefix: "XX" })).status).toBeGreaterThanOrEqual(400);
      expect((await rest("POST", "site_images", ctoken, { slot: "hero", media_id: crypto.randomUUID() })).status).toBeGreaterThanOrEqual(400);
      expect((await rest("POST", "media", ctoken, { object_key: "products/x/y.png", purpose: "product", content_type: "image/png", size_bytes: 10, uploaded_by: cuid })).status).toBeGreaterThanOrEqual(400);
      expect(denied(await rest("PATCH", "orders?status=eq.confirmed", ctoken, { status: "cancelled" }))).toBe(true);
      expect(denied(await rest("PATCH", "enquiries?status=eq.new", ctoken, { status: "closed" }))).toBe(true);
      const after = (await admin.from("products").select("is_featured, name").eq("id", productId).single()).data!;
      expect(after).toEqual(before);
      expect((await admin.from("site_settings").select("shop_name").eq("id", 1).single()).data!.shop_name).not.toBe("HACKED");
    });

    it("cannot edit its own profile row or others' (no write grants)", async () => {
      expect(denied(await rest("PATCH", `profiles?id=eq.${cuid}`, ctoken, { email: "dubbakasathwik@gmail.com" }))).toBe(true);
      expect(denied(await rest("PATCH", `profiles?id=eq.${ouid}`, ctoken, { full_name: "x" }))).toBe(true);
    });
  });

  describe("cannot reach non-public schemas or internal functions", () => {
    it.each(["auth", "storage", "extensions", "pg_catalog"])("schema %s is not exposed through the API", async (schema) => {
      const r = await rest("GET", "users?select=*", ctoken, undefined, { "Accept-Profile": schema });
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(r.text).not.toMatch(/@gns-test|encrypted_password/);
    });
    it("auth.users is not reachable via public API", async () => {
      expect((await rest("GET", "users?select=email", ctoken)).status).toBeGreaterThanOrEqual(400);
    });
    it.each(["log_activity", "handle_new_user", "stamp_rate_update", "assign_product_code"])("internal function %s is not callable", async (fn) => {
      const r = await rest("POST", `rpc/${fn}`, ctoken, { p_kind: "order", p_message: "forged" });
      expect(r.status).toBeGreaterThanOrEqual(400);
    });
    it("admin RPCs refuse a non-admin", async () => {
      for (const fn of ["admin_analytics", "admin_list_admins", "admin_stale_media", "admin_badges", "admin_rate_history"]) {
        expect((await rest("POST", `rpc/${fn}`, ctoken, {})).status, fn).toBeGreaterThanOrEqual(400);
      }
      expect((await rest("POST", "rpc/admin_remove_admin", ctoken, { p_email: process.env.TEST_ADMIN_EMAIL })).status).toBeGreaterThanOrEqual(400);
      expect((await rest("POST", "rpc/admin_set_product_status", ctoken, { p_id: productId, p_status: "draft" })).status).toBeGreaterThanOrEqual(400);
      expect((await admin.from("admins").select("email").eq("email", process.env.TEST_ADMIN_EMAIL!)).data).toHaveLength(1);
    });
  });

  describe("cross-user data access (IDOR)", () => {
    it("customer B cannot list, read, insert for, or delete customer A's saved designs", async () => {
      await customer.from("saved_products").delete().eq("product_id", productId);
      expect((await customer.from("saved_products").insert({ user_id: cuid, product_id: productId })).error).toBeNull();
      const list = await rest("GET", "saved_products?select=*", otoken);
      expect(rows(list).filter((x: { user_id: string }) => x.user_id === cuid)).toEqual([]);
      expect(rows(await rest("GET", `saved_products?user_id=eq.${cuid}`, otoken))).toEqual([]);
      expect(denied(await rest("DELETE", `saved_products?user_id=eq.${cuid}`, otoken))).toBe(true);
      expect((await rest("POST", "saved_products", otoken, { user_id: cuid, product_id: productId })).status).toBeGreaterThanOrEqual(400);
      expect((await customer.from("saved_products").select("product_id").eq("product_id", productId)).data).toHaveLength(1);
      await customer.from("saved_products").delete().eq("product_id", productId);
    });
    it("a user sees only their own profile", async () => {
      const mine = rows(await rest("GET", "profiles?select=id,email", otoken)) as { id: string }[];
      expect(mine.every((p) => p.id === ouid)).toBe(true);
      expect(rows(await rest("GET", `profiles?id=eq.${cuid}`, otoken))).toEqual([]);
    });
    it("enquiry reference/token cannot be harvested; WhatsApp-opened needs the secret token", async () => {
      const mobile = randomMobile();
      const mk = await anonClient().rpc("create_enquiry", {
        p_source: "product", p_customer_name: "E2E Idor", p_mobile: mobile, p_email: null, p_product_codes: [productCode],
        p_questions: ["What is the approximate price?"], p_custom_question: null, p_customisation: {}, p_message: "hi",
      });
      const e = mk.data![0];
      try {
        expect(rows(await rest("GET", `enquiries?id=eq.${e.id}&select=client_token`, otoken))).toEqual([]);
        expect(rows(await rest("GET", `enquiries?id=eq.${e.id}&select=client_token`, null))).toEqual([]);
        for (const bad of [crypto.randomUUID(), "00000000-0000-0000-0000-000000000000"]) {
          expect((await other.rpc("mark_enquiry_whatsapp_opened", { p_enquiry_id: e.id, p_client_token: bad })).data).toBe(false);
        }
        expect((await rest("POST", "rpc/mark_enquiry_whatsapp_opened", otoken, { p_enquiry_id: e.id, p_client_token: null })).json).not.toBe(true);
        expect((await admin.from("enquiries").select("whatsapp_opened_at").eq("id", e.id).single()).data!.whatsapp_opened_at).toBeNull();
      } finally {
        await admin.from("enquiries").delete().eq("id", e.id);
      }
    });
  });

  describe("identity and role tampering", () => {
    it("forged / unsigned / wrong-secret JWTs are rejected", async () => {
      const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
      const claims = { iss: "supabase", role: "service_role", sub: cuid, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 };
      for (const tok of [`${b64({ alg: "none", typ: "JWT" })}.${b64(claims)}.`, `${b64({ alg: "HS256", typ: "JWT" })}.${b64(claims)}.forgedsignature`]) {
        const r = await rest("GET", "orders?select=*", tok);
        expect(r.status, r.text.slice(0, 100)).toBeGreaterThanOrEqual(400);
        expect(rows(r)).toEqual([]);
      }
    });
    it("editing own user_metadata (role/is_admin claims) grants nothing", async () => {
      const u = createClient<Database>(URL_, KEY, { auth: { persistSession: false } });
      await u.auth.signInWithPassword({ email: process.env.TEST_OTHER_EMAIL!, password: process.env.TEST_OTHER_PASSWORD! });
      const upd = await u.auth.updateUser({ data: { role: "admin", is_admin: true, admin: true, user_role: "service_role" } });
      expect(upd.error).toBeNull();
      await u.auth.refreshSession();
      expect((await u.rpc("is_admin")).data).toBe(false);
      expect((await u.rpc("admin_analytics", { p_days: 7 })).error).not.toBeNull();
      expect(rows(await rest("GET", "orders?select=id", (await u.auth.getSession()).data.session!.access_token))).toEqual([]);
      await u.auth.updateUser({ data: { role: null, is_admin: null, admin: null, user_role: null } });
    });
    it("changing the account email requires confirmation, so an admin's address cannot be claimed instantly", async () => {
      const u = createClient<Database>(URL_, KEY, { auth: { persistSession: false } });
      await u.auth.signInWithPassword({ email: process.env.TEST_OTHER_EMAIL!, password: process.env.TEST_OTHER_PASSWORD! });
      const r = await u.auth.updateUser({ email: "e2e-other-renamed@gns-test.invalid" });
      if (!r.error) expect(r.data.user.email).toBe(process.env.TEST_OTHER_EMAIL); // still the old, confirmed address
      await u.auth.refreshSession();
      expect((await u.auth.getUser()).data.user!.email).toBe(process.env.TEST_OTHER_EMAIL);
      expect((await u.rpc("is_admin")).data).toBe(false);
    });
    it("self-sign-up with an admin's email cannot produce a confirmed (admin-capable) account", async () => {
      const probe = createClient<Database>(URL_, KEY, { auth: { persistSession: false } });
      // Uses the e2e admin's own invalid-domain address: sign-up must not return a live session.
      const r = await probe.auth.signUp({ email: process.env.TEST_ADMIN_EMAIL!, password: "Attack-Password-123!" });
      expect(r.data.session, "sign-up must not yield a session for an existing/unconfirmed address").toBeNull();
      const fresh = createClient<Database>(URL_, KEY, { auth: { persistSession: false } });
      const login = await fresh.auth.signInWithPassword({ email: process.env.TEST_ADMIN_EMAIL!, password: "Attack-Password-123!" });
      expect(login.data.session).toBeNull();
    });
  });

  describe("input attacks on public RPCs", () => {
    const base = (over: Partial<Database["public"]["Functions"]["create_enquiry"]["Args"]> = {}) => ({
      p_source: "product", p_customer_name: "E2E Fuzz", p_mobile: randomMobile(), p_email: null, p_product_codes: [productCode],
      p_questions: ["What is the approximate price?"], p_custom_question: null, p_customisation: {}, p_message: "hi", ...over,
    });
    const created: string[] = [];
    afterAll(async () => { if (created.length) await admin.from("enquiries").delete().in("id", created); });

    it("SQL-injection style payloads are stored inertly or rejected, never executed", async () => {
      const payloads = ["'; drop table enquiries; --", "x' or '1'='1", "\"; select pg_sleep(5); --", "${7*7}", "{{7*7}}"];
      for (const p of payloads) {
        const r = await anonClient().rpc("create_enquiry", base({ p_customer_name: `E2E ${p}`.slice(0, 80), p_custom_question: p, p_message: p }));
        if (r.data) created.push(r.data[0].id);
        else expect(r.error!.message).not.toMatch(/syntax|relation|pg_|permission denied/i);
      }
      expect((await admin.from("enquiries").select("id", { count: "exact", head: true })).error).toBeNull();
      const stored = (await admin.from("enquiries").select("custom_question").in("id", created)).data!;
      expect(stored.map((s) => s.custom_question)).toContain("${7*7}");
    });
    it("hostile product codes / arrays do not leak errors or other products", async () => {
      for (const codes of [["' OR 1=1 --"], [productCode, productCode, productCode], Array(50).fill(productCode), ["GNS-XX-0001"]]) {
        const r = await anonClient().rpc("create_enquiry", base({ p_product_codes: codes }));
        if (r.data) { created.push(r.data[0].id); continue; }
        expect(r.error!.message).not.toMatch(/relation|syntax|pg_catalog|column/i);
      }
    });
    it("oversized and control-character input is refused with safe messages", async () => {
      for (const over of [{ p_message: "x".repeat(5000) }, { p_custom_question: "y".repeat(1001) }, { p_customer_name: "z".repeat(81) }, { p_customer_name: "bad\u0000name" }, { p_questions: Array(20).fill("q") }]) {
        const r = await anonClient().rpc("create_enquiry", base(over as never));
        expect(r.data).toBeNull();
        expect(r.error!.message).not.toMatch(/relation|syntax|pg_|stack|at /i);
      }
    });
    it("cannot override server-controlled fields (status, refs, tokens, prices)", async () => {
      const r = await anonClient().rpc("create_enquiry", base({ p_customisation: { status: "converted", ref: "GNS-ENQ-1", client_token: "x" } }));
      created.push(r.data![0].id);
      const row = (await admin.from("enquiries").select("status, ref, whatsapp_opened_at, admin_reply").eq("id", r.data![0].id).single()).data!;
      expect(row.status).toBe("new");
      expect(row.ref).not.toBe("GNS-ENQ-1");
      expect(row.whatsapp_opened_at).toBeNull();
      expect(row.admin_reply).toBeNull();
    });
  });

  describe("private/draft content never leaks to non-admins", () => {
    const keys: string[] = [];
    let draftId = "", pubId = "", pubCode = "";
    const mediaIds: Record<string, string> = {};

    beforeAll(async () => {
      const uid = (await admin.auth.getUser()).data.user!.id;
      const catId = (await admin.from("categories").select("id").limit(1).single()).data!.id;
      for (const [name, purpose] of [["draft", "product"], ["pub", "product"], ["extract", "extract"], ["site", "site"]] as const) {
        const key = `${purpose === "product" ? "products" : purpose}/atk${Date.now()}${name}/f${name}.png`;
        const { data, error } = await admin.from("media").insert({ object_key: key, purpose, content_type: "image/png", size_bytes: 100, status: "ready", uploaded_by: uid }).select("id").single();
        if (error) throw error;
        mediaIds[name] = data!.id; keys.push(key);
      }
      const mk = async (name: string, media: string, status: "draft" | "published") => {
        const r = await admin.rpc("admin_save_product", {
          p_product: { name, category_id: catId, metal: "gold", karat: "22", weight_g: "1", making_type: "fixed", making_value: "1" },
          p_tag_names: [], p_images: [{ media_id: media, view_label: "front" }], p_status: status,
        });
        if (r.error) throw r.error;
        return r.data![0];
      };
      const dr = await mk("E2E Atk Draft", mediaIds.draft, "draft");
      const pb = await mk("E2E Atk Pub", mediaIds.pub, "published");
      draftId = dr.id; pubId = pb.id; pubCode = pb.code;
    });
    afterAll(async () => {
      await admin.from("products").delete().in("id", [draftId, pubId].filter(Boolean));
      await admin.from("media").delete().in("id", Object.values(mediaIds));
    });

    for (const who of ["anon", "customer"] as const) {
      it(`${who}: cannot see draft product, its photos, or extraction/unattached media; can see published`, async () => {
        const tok = who === "anon" ? null : ctoken;
        expect(rows(await rest("GET", `products?id=eq.${draftId}`, tok))).toEqual([]);
        expect(rows(await rest("GET", `catalogue_products?id=eq.${draftId}`, tok))).toEqual([]);
        expect(rows(await rest("GET", `product_images?product_id=eq.${draftId}`, tok))).toEqual([]);
        expect(rows(await rest("GET", `media?id=eq.${mediaIds.draft}`, tok))).toEqual([]);
        expect(rows(await rest("GET", `media?id=eq.${mediaIds.extract}`, tok))).toEqual([]);
        expect(rows(await rest("GET", `media?id=eq.${mediaIds.site}`, tok))).toEqual([]); // site media only visible once attached to a slot
        expect(rows(await rest("GET", `media?id=eq.${mediaIds.pub}`, tok))).toHaveLength(1);
        expect(rows(await rest("GET", `products?id=eq.${pubId}`, tok))).toHaveLength(1);
      });
    }
    it("unpublishing hides the product's photo again", async () => {
      expect((await admin.rpc("admin_set_product_status", { p_id: pubId, p_status: "draft" })).error).toBeNull();
      expect(rows(await rest("GET", `media?id=eq.${mediaIds.pub}`, null))).toEqual([]);
      expect(rows(await rest("GET", `catalogue_products?code=eq.${pubCode}`, null))).toEqual([]);
      expect((await rest("POST", "rpc/record_product_view", null, { p_code: pubCode })).status).toBeLessThan(500);
      const views = await admin.from("product_views").select("id", { count: "exact", head: true }).eq("product_id", pubId);
      expect(views.count).toBe(0); // views of unpublished products are not recorded
    });
    it("rate authorship and admin identity columns are hidden from the public API", async () => {
      expect((await rest("GET", "rate_updates?select=created_by_email", null)).status).toBeGreaterThanOrEqual(400);
      expect((await rest("GET", "rate_updates?select=created_by", null)).status).toBeGreaterThanOrEqual(400);
      expect((await rest("GET", "current_rates?select=*", null)).status).toBe(200);
    });
    it("javascript:/data: URLs and invalid colours are refused by the database (stored-XSS vectors)", async () => {
      for (const v of ["javascript:alert(1)", "data:text/html,<script>1</script>", "http://insecure.example"]) {
        expect((await admin.from("site_settings").update({ instagram_url: v }).eq("id", 1)).error, v).not.toBeNull();
      }
      expect((await admin.from("collections").insert({ name: "E2E Evil", slug: "e2e-evil", theme_color: "red;background:url(//evil)" })).error).not.toBeNull();
      expect((await admin.from("site_settings").update({ whatsapp_number: "javascript:alert(1)" }).eq("id", 1)).error).not.toBeNull();
    });
  });
});
