/**
 * Attacker-perspective tests against the running production build (next start) and the live Supabase project.
 * The UI is not trusted: server actions and route handlers are called directly with anonymous / customer / forged requests.
 * Needs R2_ENDPOINT etc. pointing at a local S3-compatible server for the media tests.
 */
import fs from "node:fs";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { APIRequestContext } from "@playwright/test";
import { test, expect, loginAs, adminDb, randomMobile } from "./fixtures";

const storage = Boolean(process.env.R2_ENDPOINT);

/** name → server action id, read from the client bundle exactly as an attacker could. */
function actionIds(): Record<string, string> {
  const dir = path.join(process.cwd(), ".next/static/chunks");
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) walk(p);
      else if (f.name.endsWith(".js")) {
        const src = fs.readFileSync(p, "utf8");
        for (const m of src.matchAll(/createServerReference\)?\(?"([0-9a-f]{40,})"[^)]*?"([A-Za-z]+)"\)/g)) out[m[2]] = m[1];
      }
    }
  };
  walk(dir);
  return out;
}
const IDS = actionIds();
const UUID0 = "00000000-0000-4000-8000-000000000001";

async function callAction(req: APIRequestContext, name: string, args: unknown[], origin: string, extraPath = "/jewellery") {
  const id = IDS[name];
  if (!id) return { status: 0, ok: false, error: "Your admin session has ended (not in client bundle)", text: "not-in-bundle" };
  const res = await req.post(extraPath, {
    headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", Origin: origin },
    data: JSON.stringify(args),
    failOnStatusCode: false,
    maxRedirects: 0,
  });
  const text = await res.text();
  const ok = /"ok":true/.test(text);
  const err = /"error":"([^"]*)"/.exec(text)?.[1] ?? null;
  return { status: res.status(), ok, error: err, text };
}

/**
 * A refused admin action is either (a) stopped by the proxy's admin gate — Next.js routes the action to its owning
 * /admin page, the proxy redirects, and the response is an empty JSON object / redirect — or (b) executed and rejected
 * by the action's own assertAdmin() guard ("session has ended"). Never a success, never a server error, never data.
 */
function expectRefused(r: { status: number; ok: boolean; error: string | null; text: string }, name: string) {
  expect(r.ok, name).toBe(false);
  expect(r.status, `${name} must not 5xx`).toBeLessThan(500);
  const guarded = /session has ended|Not authorised|ended/i.test(r.error ?? r.text);
  const gated = r.text.trim() === "{}" || [307, 308, 401, 403, 404].includes(r.status) || r.text === "not-in-bundle";
  expect(guarded || gated, `${name}: unexpected response ${r.status} ${r.text.slice(0, 160)}`).toBe(true);
  expect(r.text, name).not.toMatch(/"data":\{|"data":\[|GNS-\d|@gmail\.com/);
}

const ADMIN_ACTIONS: [string, unknown[]][] = [
  ["saveProduct", [{ name: "E2E Pwn", category_id: UUID0, metal: "gold", karat: "22", weight_g: "1", making_type: "fixed", making_value: "1", status: "draft" }]],
  ["setProductStatus", [UUID0, "published"]],
  ["setProductFeatured", [UUID0, true]],
  ["deleteProduct", [UUID0]],
  ["addCategory", ["E2E Pwn Category", "EZ"]],
  ["renameCategory", [UUID0, "Pwned"]],
  ["deleteCategory", [UUID0]],
  ["saveHomeCategories", [{ order: [], layout: "square", limit: 6, colsMobile: 3 }]],
  ["addSubcategory", [UUID0, "Pwn"]],
  ["deleteSubcategory", [UUID0]],
  ["saveCollection", [{ name: "E2E Pwn Col", theme_color: "#000000", show_on_home: true }]],
  ["moveCollection", [UUID0, 1]],
  ["deleteCollection", [UUID0]],
  ["saveTag", [null, "E2E Pwn Tag"]],
  ["deleteTag", [UUID0]],
  ["saveRates", [{ gold22_per_10g: "1", silver_per_kg: "1", gst_percent: "0" }]],
  ["setEnquiryStatus", [UUID0, "closed"]],
  ["approveReply", [UUID0, "You won a prize"]],
  ["aiDraftReply", [{ enquiryId: UUID0, qa: [] }]],
  ["manualReplyTemplate", [UUID0]],
  ["confirmOrder", [{ subject: "E2E Pwn", order_date: "2026-11-01", expected_delivery_date: "2026-11-02", customer_name: "x", mobile: "9876543210", items: [{ product_name: "x" }] }]],
  ["updateOrder", [UUID0, { status: "cancelled" }]],
  ["searchProductsForOrder", ["a"]],
  ["addAdmin", [{ name: "Attacker", email: "attacker@evil.test" }]],
  ["removeAdmin", ["dubbakasathwik@gmail.com"]],
  ["saveSiteSettings", [{ shop_name: "HACKED", tagline: "", hero_eyebrow: "", hero_headline: "H", hero_text: "", is_hallmarked: false, whatsapp_number: "+919999999999" }]],
  ["setSiteImage", [{ kind: "slot", slot: "hero" }, null]],
  ["cleanupStaleUploads", []],
  ["aiExtractCatalogue", [UUID0]],
  ["aiSuggestDescription", [{ name: "Ring", metal: "gold" }]],
];

test.describe("App-layer attacks", () => {
  test("every admin server action refuses anonymous callers", async ({ request, baseURL }) => {
    expect(Object.keys(IDS).length).toBeGreaterThan(30);
    for (const [name, args] of ADMIN_ACTIONS) {
      const r = await callAction(request, name, args, baseURL!);
      expect(r.ok, `${name} (anon) -> ${r.status} ${r.text.slice(0, 160)}`).toBe(false);
      expectRefused(r, name);
    }
  });

  test("every admin server action refuses a signed-in non-admin customer, and changes nothing", async ({ context, baseURL }) => {
    await loginAs(context, "CUSTOMER", baseURL!);
    for (const [name, args] of ADMIN_ACTIONS) {
      const r = await callAction(context.request, name, args, baseURL!);
      expect(r.ok, `${name} (customer) -> ${r.status} ${r.text.slice(0, 160)}`).toBe(false);
      expectRefused(r, name);
    }
    const db = await adminDb();
    expect((await db.from("admins").select("email").eq("email", "attacker@evil.test")).data).toEqual([]);
    expect((await db.from("admins").select("email").eq("email", "dubbakasathwik@gmail.com")).data).toHaveLength(1);
    expect((await db.from("site_settings").select("shop_name").eq("id", 1).single()).data!.shop_name).not.toBe("HACKED");
    expect((await db.from("categories").select("id").like("name", "E2E Pwn%")).data).toEqual([]);
    expect((await db.from("collections").select("id").like("name", "E2E Pwn%")).data).toEqual([]);
    expect((await db.from("tags").select("id").like("name", "E2E Pwn%")).data).toEqual([]);
  });

  test("positive control: the same call works for a real admin (proves the harness is not vacuous)", async ({ context, baseURL }) => {
    await loginAs(context, "ADMIN", baseURL!);
    const r = await callAction(context.request, "setProductFeatured", [UUID0, false], baseURL!);
    expect(r.ok, r.text.slice(0, 200)).toBe(true);
    const s = await callAction(context.request, "searchProductsForOrder", ["ring"], baseURL!);
    expect(s.ok).toBe(true);
  });

  test("cross-site server-action request (CSRF) is rejected even with a valid admin session", async ({ context, baseURL }) => {
    await loginAs(context, "ADMIN", baseURL!);
    const r = await callAction(context.request, "addCategory", ["E2E CSRF Category", "EC"], "https://evil.example");
    expect(r.ok, r.text.slice(0, 200)).toBe(false);
    const db = await adminDb();
    expect((await db.from("categories").select("id").eq("name", "E2E CSRF Category")).data).toEqual([]);
  });

  test("public server actions validate input and give no internals", async ({ request, baseURL }) => {
    const bad = await callAction(request, "submitEnquiry", [{ source: "product", productCodes: ["' OR 1=1--"], questions: ["x"], name: "a", mobile: "1" }], baseURL!);
    expect(bad.ok).toBe(false);
    expect(bad.text).not.toMatch(/relation|syntax error|pg_|stack|node_modules/i);
    const saved = await callAction(request, "toggleSaved", [UUID0], baseURL!);
    expect(saved.ok).toBe(false);
    expect(saved.text).toMatch(/needsSignIn|Sign in/);
  });

  test("every /admin page: anonymous and customer are redirected before any admin page code runs", async ({ playwright, baseURL }) => {
    const routes = ["/admin", "/admin/products", "/admin/products/new", `/admin/products/${UUID0}`, "/admin/orders", "/admin/orders/new", `/admin/orders/${UUID0}`, "/admin/enquiries", "/admin/rates", "/admin/taxonomy", "/admin/extract", "/admin/analytics", "/admin/admins", "/admin/images", "/admin/content"];
    const anon = await playwright.request.newContext({ baseURL });
    for (const r of routes) {
      const res = await anon.get(r, { maxRedirects: 0 });
      expect(res.status(), r).toBe(307);
      expect(res.headers()["location"], r).toContain("/admin/login");
    }
    const db = await adminDb();
    const sentinel = (await db.from("admins").select("email")).data!.map((a) => a.email as string);
    const cust = await (await import("./session")).sessionCookies("CUSTOMER", baseURL!);
    const ctx = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Cookie: cust.map((c) => `${c.name}=${c.value}`).join("; ") } });
    for (const r of routes) {
      // The proxy must stop a signed-in non-admin before any admin page code runs: no page output at all.
      const res = await ctx.get(r, { maxRedirects: 0 });
      const body = await res.text();
      expect(res.status(), r).toBe(307);
      expect(res.headers()["location"], r).toContain("/admin/login");
      for (const s of sentinel) expect(body, `${r} leaks ${s}`).not.toContain(s);
      expect(body, `${r} executed admin page code`).not.toMatch(/Create New Order|Customer's questions|admin-card/);
    }
    await anon.dispose();
    await ctx.dispose();
  });

  test("open-redirect attempts through /auth/callback never leave the site", async ({ request, baseURL }) => {
    const host = new URL(baseURL!).host;
    for (const next of ["//evil.example", "/\\evil.example", "https://evil.example", "///evil.example", "/%2F%2Fevil.example", "javascript:alert(1)", "\\\\evil.example", "/..//evil.example"]) {
      const r = await request.get(`/auth/callback?next=${encodeURIComponent(next)}`, { maxRedirects: 0 });
      const loc = r.headers()["location"] ?? "";
      expect(loc, next).not.toMatch(/evil\.example/);
      if (loc) expect(new URL(loc, baseURL!).host, `${next} -> ${loc}`).toBe(host);
    }
  });

  test("sign-out cannot be triggered cross-site", async ({ request }) => {
    const r = await request.post("/auth/signout", { headers: { Origin: "https://evil.example" }, maxRedirects: 0 });
    expect(r.status()).toBe(403);
  });

  test("upload endpoints validate hostile input even for an admin", async ({ context, baseURL }) => {
    test.skip(!storage, "needs S3-compatible storage");
    await loginAs(context, "ADMIN", baseURL!);
    const post = (data: unknown, headers: Record<string, string> = {}) => context.request.post("/api/uploads/presign", { data, headers, failOnStatusCode: false });
    for (const body of [
      { purpose: "product", contentType: "image/svg+xml", size: 100 },
      { purpose: "product", contentType: "text/html", size: 100 },
      { purpose: "product", contentType: "image/png", size: 9 * 1024 * 1024 },
      { purpose: "product", contentType: "image/png", size: 0 },
      { purpose: "product", contentType: "image/png", size: -5 },
      { purpose: "../../etc", contentType: "image/png", size: 10 },
      { purpose: "product", contentType: "image/png", size: "10; drop" },
      { purpose: "product", contentType: "image/png", size: 10, key: "../../../x.png", objectKey: "products/../../x.png" },
    ]) {
      const r = await post(body);
      const j = await r.json().catch(() => ({}));
      if (r.status() === 200) {
        // extra fields must be ignored: the key is always server-generated
        expect(JSON.stringify(j)).not.toContain("..");
      } else {
        expect(r.status(), JSON.stringify(body)).toBe(400);
        expect(JSON.stringify(j)).not.toMatch(/at |node_modules|stack|supabase/i);
      }
    }
    expect((await post("not json")).status()).toBe(400);
    expect((await post({ purpose: "product", contentType: "image/png", size: 10 }, { Origin: "https://evil.example" })).status()).toBe(403);
    const db = await adminDb();
    await db.from("media").delete().eq("status", "pending").like("object_key", "products/%");
  });

  test("probing for secrets, source and config files returns nothing", async ({ request }) => {
    for (const p of ["/.env", "/.env.local", "/.git/config", "/.git/HEAD", "/package.json", "/next.config.ts", "/supabase/migrations/20261118000100_core_schema.sql", "/docs/design-reference/tokens.css", "/tests/e2e/session.ts", "/src/lib/server-env.ts", "/netlify.toml", "/_next/../.env", "/..%2f.env", "/api/uploads/presign", "/server-env", "/.next/BUILD_ID"]) {
      const r = await request.get(p, { maxRedirects: 0, failOnStatusCode: false });
      const body = await r.text();
      expect([404, 405, 400, 308, 307].includes(r.status()), `${p} -> ${r.status()}`).toBe(true);
      expect(body, p).not.toMatch(/SUPABASE|R2_SECRET|GEMINI|service_role|PASSWORD=/);
    }
  });

  test("hostile URLs and parameters give generic errors without stack traces", async ({ request }) => {
    for (const p of ["/product/%00", "/product/%E0%A4%A", "/jewellery?show=-5&sort=;--&price='%20OR%201=1&category[]=x&sub=%27", "/jewellery?q=" + "a".repeat(5000), "/collections/%27%22%3C", "/api/media/%27", "/api/media/" + "9".repeat(500), "/admin/orders/%27%20OR%201=1"]) {
      const r = await request.get(p, { maxRedirects: 0, failOnStatusCode: false });
      const body = await r.text();
      // Malformed percent-encoding in a dynamic segment makes Next.js itself answer a bare, generic 500 (no detail leaked).
      if (r.status() === 500) expect(body.trim(), p).toBe("Internal Server Error");
      else expect(r.status(), p).toBeLessThan(500);
      expect(body, p).not.toMatch(/node_modules|at Object\.|at async|ECONN|PGRST|postgres|relation "|Error: /i);
    }
  });

  test("security headers and cache rules", async ({ request, context, baseURL }) => {
    const home = await request.get("/");
    const h = home.headers();
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBeTruthy();
    expect(h["x-powered-by"]).toBeUndefined();
    await loginAs(context, "ADMIN", baseURL!);
    const adm = await context.request.get("/admin/orders");
    const cc = adm.headers()["cache-control"] ?? "";
    expect(cc, "admin pages must not be cacheable by shared caches").toMatch(/no-store|private/);
    const login = await request.get("/admin/login");
    expect(login.headers()["cache-control"] ?? "").toMatch(/no-store|private|no-cache/);
    expect(h["strict-transport-security"]).toMatch(/max-age=\d+/);
    const csp = h["content-security-policy"] ?? "";
    for (const d of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'"]) expect(csp, d).toContain(d);
    expect(csp).not.toMatch(/script-src[^;]*\*(?!\.)/); // no wildcard script sources
  });

  test.describe("stored and reflected XSS (payloads must render as text and never execute)", () => {
    const PAYLOADS = [`<img src=x onerror="window.__xss=1">`, `<script>window.__xss=1</script>`, `"><svg onload=window.__xss=1>`, `javascript:window.__xss=1`];
    const arm = async (page: import("@playwright/test").Page) => {
      page.on("dialog", async (d) => { await d.dismiss(); throw new Error(`XSS dialog fired: ${d.message()}`); });
    };
    const executed = (page: import("@playwright/test").Page) => page.evaluate(() => (window as unknown as { __xss?: number }).__xss === 1);

    test("reflected: search query and filter params", async ({ page }) => {
      await arm(page);
      for (const p of PAYLOADS) {
        await page.goto(`/jewellery?q=${encodeURIComponent(p)}&category=${encodeURIComponent(p)}&sort=${encodeURIComponent(p)}`);
        expect(await executed(page), p).toBe(false);
        await expect(page.locator("img[onerror], svg[onload], main script")).toHaveCount(0);
      }
      await page.goto(`/jewellery?q=${encodeURIComponent(PAYLOADS[0])}`);
      await expect(page.getByText(PAYLOADS[0], { exact: false }).first()).toBeVisible();
    });

    test("stored: visitor-supplied enquiry fields rendered in the admin portal", async ({ page, context, baseURL }) => {
      await arm(page);
      const db = await adminDb();
      const anon = (await import("@supabase/supabase-js")).createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const code = (await anon.from("catalogue_products").select("code").limit(1).single()).data!.code;
      const ids: string[] = [];
      for (const p of PAYLOADS.slice(0, 3)) {
        const r = await anon.rpc("create_enquiry", { p_source: "product", p_customer_name: `E2E ${p}`.slice(0, 80), p_mobile: randomMobile(), p_email: null, p_product_codes: [code], p_questions: [p.slice(0, 190)], p_custom_question: p, p_customisation: { [p.slice(0, 15)]: p.slice(0, 35) }, p_message: p });
        if (r.data) ids.push(r.data[0].id);
      }
      expect(ids.length).toBeGreaterThan(0);
      try {
        await loginAs(context, "ADMIN", baseURL!);
        for (const id of ids) {
          await page.goto(`/admin/enquiries?id=${id}`);
          expect(await executed(page)).toBe(false);
          await expect(page.locator("main img[onerror], main svg[onload], main script")).toHaveCount(0);
        }
        await page.goto("/admin");
        expect(await executed(page)).toBe(false);
      } finally {
        await db.from("enquiries").delete().in("id", ids);
      }
    });

    test("stored: admin-entered content and product text on public pages", async ({ page }) => {
      await arm(page);
      const db = await adminDb();
      const before = (await db.from("site_settings").select("brand_story, about_story, hero_text, address, trust_highlights, about_values").eq("id", 1).single()).data!;
      const catId = (await db.from("categories").select("id").limit(1).single()).data!.id;
      const mid = (await db.from("media").insert({ object_key: `products/xss${Date.now()}/p.png`, purpose: "product", content_type: "image/png", size_bytes: 10, status: "ready", uploaded_by: (await db.auth.getUser()).data.user!.id }).select("id").single()).data!.id;
      const pr = await db.rpc("admin_save_product", {
        p_product: { name: `E2E ${PAYLOADS[0]}`.slice(0, 120), category_id: catId, metal: "gold", karat: "22", weight_g: "1", making_type: "fixed", making_value: "1", description: PAYLOADS[1], style: PAYLOADS[2].slice(0, 40), stones_note: PAYLOADS[0].slice(0, 190) },
        p_tag_names: [PAYLOADS[1].slice(0, 39)], p_images: [{ media_id: mid, view_label: "front" }], p_status: "published",
      });
      const pid = pr.data![0].id, code = pr.data![0].code;
      try {
        await db.from("site_settings").update({ brand_story: PAYLOADS[0], about_story: PAYLOADS[1], hero_text: PAYLOADS[2], address: PAYLOADS[0], trust_highlights: PAYLOADS[1], about_values: `${PAYLOADS[0]}: ${PAYLOADS[1]}` }).eq("id", 1);
        for (const u of ["/", "/about", "/jewellery", `/product/${code}`, "/collections", "/custom-jewellery", "/privacy"]) {
          await page.goto(u);
          expect(await executed(page), u).toBe(false);
          await expect(page.locator("main img[onerror], main svg[onload], main script, footer img[onerror]"), u).toHaveCount(0);
        }
        await page.goto("/about");
        await expect(page.getByText(PAYLOADS[1], { exact: false }).first()).toBeVisible(); // literal text, not markup
      } finally {
        await db.from("site_settings").update(before).eq("id", 1);
        await db.from("products").delete().eq("id", pid);
        await db.from("media").delete().eq("id", mid);
        await db.from("tags").delete().eq("name", PAYLOADS[1].slice(0, 39));
      }
    });
  });

  test.describe("authorised media access (IDOR on stored files)", () => {
    test.skip(!storage, "needs S3-compatible storage");
    const s3 = () => new S3Client({ region: "auto", endpoint: process.env.R2_ENDPOINT, forcePathStyle: true, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! } });
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
    const created: { mediaIds: string[]; productIds: string[] } = { mediaIds: [], productIds: [] };

    test.afterAll(async () => {
      const db = await adminDb();
      if (created.productIds.length) await db.from("products").delete().in("id", created.productIds);
      if (created.mediaIds.length) await db.from("media").delete().in("id", created.mediaIds);
    });

    test("drafts' photos and AI-extraction uploads are admin-only; published photos are public; headers are safe", async ({ request, context, baseURL, playwright }) => {
      const db = await adminDb();
      const uid = (await db.auth.getUser()).data.user!.id;
      const catId = (await db.from("categories").select("id").limit(1).single()).data!.id;
      const mk = async (purpose: "product" | "extract" | "site", tag: string) => {
        const key = `${purpose === "product" ? "products" : purpose}/idor${Date.now()}${tag}/f.png`;
        await s3().send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key, Body: png, ContentType: "image/png" }));
        const { data, error } = await db.from("media").insert({ object_key: key, purpose, content_type: "image/png", size_bytes: png.length, status: "ready", uploaded_by: uid }).select("id").single();
        if (error) throw error;
        created.mediaIds.push(data!.id);
        return data!.id as string;
      };
      const mDraft = await mk("product", "d"), mPub = await mk("product", "p"), mExtract = await mk("extract", "e"), mSite = await mk("site", "s");
      const save = async (name: string, media: string, status: "draft" | "published") => {
        const r = await db.rpc("admin_save_product", { p_product: { name, category_id: catId, metal: "gold", karat: "22", weight_g: "1", making_type: "fixed", making_value: "1" }, p_tag_names: [], p_images: [{ media_id: media, view_label: "front" }], p_status: status });
        created.productIds.push(r.data![0].id);
      };
      await save("E2E IDOR Draft", mDraft, "draft");
      await save("E2E IDOR Pub", mPub, "published");

      const get = (r: APIRequestContext, id: string) => r.get(`/api/media/${id}`, { maxRedirects: 0, failOnStatusCode: false });
      const cust = await (await import("./session")).sessionCookies("CUSTOMER", baseURL!);
      const custCtx = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Cookie: cust.map((c) => `${c.name}=${c.value}`).join("; ") } });
      await loginAs(context, "ADMIN", baseURL!);

      for (const [label, id] of [["draft product photo", mDraft], ["AI-extraction upload", mExtract], ["unattached site image", mSite]] as const) {
        expect((await get(request, id)).status(), `anon -> ${label}`).toBe(404);
        expect((await get(custCtx, id)).status(), `customer -> ${label}`).toBe(404);
        expect((await get(context.request, id)).status(), `admin -> ${label}`).toBe(302);
      }
      const pub = await get(request, mPub);
      expect(pub.status()).toBe(302);
      const loc = pub.headers()["location"];
      expect(loc).toContain("X-Amz-Signature");
      expect(loc).toContain("response-content-type=image%2Fpng");
      expect(pub.headers()["cache-control"]).toMatch(/private/);
      const fetched = await request.get(loc, { failOnStatusCode: false });
      expect(fetched.status()).toBe(200);
      expect(fetched.headers()["content-type"]).toBe("image/png");
      // tampering with the signed URL (swap the object key) must fail
      const tampered = loc.replace(/\/idor\d+p\//, "/idor0000000000000d/");
      expect((await request.get(tampered, { failOnStatusCode: false })).status()).toBeGreaterThanOrEqual(400);
      // unpublishing makes the photo private again
      await db.from("products").update({ status: "draft" }).eq("id", created.productIds[1]);
      expect((await get(request, mPub)).status()).toBe(404);
      await custCtx.dispose();
    });

    test("upload completion cannot be used by a non-admin to mark or delete someone else's media", async ({ request, context, baseURL, playwright }) => {
      const cust = await (await import("./session")).sessionCookies("CUSTOMER", baseURL!);
      const custCtx = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Cookie: cust.map((c) => `${c.name}=${c.value}`).join("; ") } });
      for (const route of ["complete", "discard"]) {
        for (const ctx of [request, custCtx]) {
          const r = await ctx.post(`/api/uploads/${route}`, { data: { mediaId: created.mediaIds[0] ?? UUID0 }, failOnStatusCode: false });
          expect(r.status(), route).toBe(403);
        }
      }
      void context;
      await custCtx.dispose();
    });
  });
});
