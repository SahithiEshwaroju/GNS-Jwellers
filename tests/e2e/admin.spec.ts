import path from "node:path";
import { test, expect, loginAs, adminDb, randomMobile } from "./fixtures";

const storage = Boolean(process.env.R2_ENDPOINT || process.env.R2_ACCOUNT_ID);

test.describe("Admin portal", () => {
  test.beforeEach(async ({ context, baseURL }) => loginAs(context, "ADMIN", baseURL!));

  test("dashboard shows real statistics", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByText("Total Products")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();
  });

  test("rates update recalculates website prices", async ({ page }) => {
    const db = await adminDb();
    const before = (await db.from("current_rates").select("*").single()).data!;
    await page.goto("/admin/rates");
    await page.getByLabel(/22K gold — price per 10 g/).fill(String(Number(before.gold22_per_10g) + 2000));
    await page.getByRole("button", { name: "Save & update prices" }).click();
    await expect(page.getByText("Rates saved. Website prices updated.")).toBeVisible();
    await page.goto("/product/GNS-NK-0001");
    await expect(page.getByRole("region", { name: /Price Breakup/ }).getByText("₹3,62,694")).toHaveCount(0);
    // restore
    await page.goto("/admin/rates");
    await page.getByLabel(/22K gold — price per 10 g/).fill(String(before.gold22_per_10g));
    await page.getByRole("button", { name: "Save & update prices" }).click();
    await expect(page.getByText("Rates saved. Website prices updated.")).toBeVisible();
    await page.goto("/product/GNS-NK-0001");
    await expect(page.getByRole("region", { name: /Price Breakup/ }).getByText("₹3,62,694")).toBeVisible();
  });

  test("product lifecycle: draft without photo, publish blocked, upload photo, publish, feature, delete", async ({ page }) => {
    test.skip(!storage, "Needs image storage (R2 or local S3-compatible server)");
    await page.goto("/admin/products/new");
    await page.getByLabel(/^Product name/).fill("E2E Lotus Ring");
    await page.getByLabel(/^Category/).selectOption({ label: "Rings" });
    await page.getByLabel(/^Weight \(g\)/).fill("3.5");
    await page.getByLabel("Making amount (₹)").fill("5000");
    await expect(page.getByText("Total")).toBeVisible();
    // publish without photo is blocked by validation
    await page.getByRole("button", { name: "Save & publish" }).click();
    await expect(page.getByText("Add at least one actual product photo before publishing").first()).toBeVisible();
    // save as draft
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}\?saved=1/);
    await expect(page.getByText(/^GNS-RG-\d{4} · Draft/)).toBeVisible();
    const code = (await page.getByText(/^GNS-RG-\d{4} · Draft/).textContent())!.split(" ")[0];
    // drafts are hidden from the public
    const pub = await page.context().browser()!.newContext();
    expect((await (await pub.newPage()).goto(`${page.url().split("/admin")[0]}/product/${code}`))?.status()).toBe(404);
    // invalid file is rejected server-side
    await page.locator('input[type=file][aria-label="Choose product photos"]').setInputFiles({ name: "evil.jpg", mimeType: "image/jpeg", buffer: Buffer.from("<html><script>alert(1)</script></html>") });
    await expect(page.getByText(/evil\.jpg: .*(not a valid|did not match)/)).toBeVisible();
    // real upload
    await page.locator('input[type=file][aria-label="Choose product photos"]').setInputFiles(path.join(__dirname, "../fixtures/test-photo.jpg"));
    await expect(page.getByText("Cover photo")).toBeVisible();
    await page.getByRole("button", { name: "Save & publish" }).click();
    await expect(page.getByText("Saved and published.")).toBeVisible();
    // public page shows the photo through the authorised media route
    const pp = await pub.newPage();
    const res = await pp.goto(`${page.url().split("/admin")[0]}/product/${code}`);
    expect(res?.status()).toBe(200);
    const img = pp.getByRole("img", { name: /E2E Lotus Ring — Front view/ });
    await expect(img).toBeVisible();
    expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    await pub.close();
    // feature + delete from list
    await page.goto(`/admin/products?q=${code}`);
    await page.getByRole("switch", { name: "Feature E2E Lotus Ring" }).click();
    await expect(page.getByText("E2E Lotus Ring is featured")).toBeVisible();
    await page.getByRole("button", { name: "Delete E2E Lotus Ring" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("E2E Lotus Ring deleted")).toBeVisible();
  });

  test("categories: add, appears on the website, delete", async ({ page }) => {
    await page.goto("/admin/taxonomy");
    await page.getByLabel("New category").fill("E2E Nose Pins");
    await page.getByLabel("Code prefix").fill("EZ");
    await page.getByRole("button", { name: "Add category" }).click();
    await expect(page.getByText("Category “E2E Nose Pins” added.")).toBeVisible();
    await page.goto("/jewellery");
    await expect(page.getByRole("complementary", { name: "Filters" }).getByLabel(/^E2E Nose Pins/)).toBeVisible();
    await page.goto("/admin/taxonomy");
    await page.getByRole("region", { name: "E2E Nose Pins" }).getByRole("button", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Category deleted.")).toBeVisible();
  });

  test("enquiry: manual reply, approve, WhatsApp to customer, then create order", async ({ page }) => {
    const db = await adminDb();
    const anon = (await import("@supabase/supabase-js")).createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const mobile = randomMobile();
    const { data } = await anon.rpc("create_enquiry", {
      p_source: "product", p_customer_name: "E2E Reply Test", p_mobile: mobile, p_email: null, p_product_codes: ["GNS-RG-0001"],
      p_questions: ["What are the making charges?"], p_custom_question: null, p_customisation: {}, p_message: "Hello",
    });
    const enq = data![0];
    await page.goto(`/admin/enquiries?id=${enq.id}`);
    await expect(page.getByRole("heading", { name: enq.ref })).toBeVisible();
    await page.getByRole("button", { name: "✦ Reply with AI assistance" }).click();
    await page.getByLabel("What are the making charges?").fill("₹6,500 for this design");
    await page.getByRole("button", { name: "Prepare reply" }).click();
    const reply = page.getByLabel(/^Reply to E2E Reply Test/);
    await expect(reply).toHaveValue(/₹6,500 for this design/);
    await page.getByRole("button", { name: "Approve reply" }).click();
    const wa = page.getByRole("link", { name: /Open WhatsApp to E2E/ });
    await expect(wa).toHaveAttribute("href", new RegExp(`^https://wa\\.me/91${mobile}\\?text=`));
    expect((await db.from("enquiries").select("status, admin_reply").eq("id", enq.id).single()).data).toMatchObject({ status: "replied" });

    // create an order from the enquiry: catalogue product prefilled + a manual line
    await page.goto(`/admin/orders/new?enquiry=${enq.id}`);
    await expect(page.getByText(`From enquiry ${enq.ref}`)).toBeVisible();
    await page.getByLabel(/^Order subject/).fill("E2E Ring resize");
    await page.getByLabel(/^Expected delivery/).fill("2026-12-20");
    await page.getByLabel("Manual product name").fill("Polishing service");
    await page.getByRole("button", { name: "Add manual product" }).click();
    await page.getByLabel("Quoted amount (₹, optional)").fill("40000");
    await page.getByLabel("Advance received (₹, optional)").fill("10000");
    await page.getByRole("button", { name: "Review order" }).click();
    await expect(page.getByRole("heading", { name: "Review order" })).toBeVisible();
    await page.getByRole("button", { name: "Confirm order" }).click();
    await expect(page.getByText(/Order confirmed\. Order number GNS-\d{4,}/)).toBeVisible();
    const orderNo = (await page.getByRole("heading", { level: 1 }).textContent())!.match(/GNS-\d+/)![0];
    expect((await db.from("enquiries").select("status").eq("id", enq.id).single()).data?.status).toBe("converted");
    // listed and searchable; balance computed
    await page.goto(`/admin/orders?q=${orderNo}`);
    await expect(page.getByRole("link", { name: orderNo })).toBeVisible();
    await expect(page.getByRole("cell", { name: "₹30,000" })).toBeVisible();
    // cancel (orders are never deleted)
    await page.getByRole("link", { name: orderNo }).click();
    await page.getByRole("button", { name: "Cancel order" }).click();
    await expect(page.getByText("Order cancelled.")).toBeVisible();
    await db.from("enquiries").delete().eq("id", enq.id);
  });

  test("site content edits appear on the website", async ({ page }) => {
    await page.goto("/admin/content");
    await page.getByLabel(/^Brand story/).fill("E2E story text for verification.");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Changes saved and live on the website.")).toBeVisible();
    await page.goto("/");
    await expect(page.getByText("E2E story text for verification.")).toBeVisible();
    await page.goto("/admin/content");
    await page.getByLabel(/^Brand story/).fill("");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Changes saved and live on the website.")).toBeVisible();
  });

  test("admin access: cannot remove self; add and remove another admin", async ({ page }) => {
    await page.goto("/admin/admins");
    const self = page.getByRole("row", { name: /e2e-admin@gns-test\.invalid/ });
    await expect(self.getByRole("button", { name: "Remove" })).toBeDisabled();
    await page.getByLabel("Name").fill("E2E Temp");
    await page.getByLabel(/^Google email address/).fill("e2e-temp@gns-test.invalid");
    await page.getByRole("button", { name: "Add admin" }).click();
    await expect(page.getByText("e2e-temp@gns-test.invalid can now sign in")).toBeVisible();
    await page.getByRole("row", { name: /e2e-temp@gns-test\.invalid/ }).getByRole("button", { name: "Remove" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("Removed e2e-temp@gns-test.invalid.")).toBeVisible();
  });

  test("analytics, extraction, images pages load", async ({ page }) => {
    await page.goto("/admin/analytics?days=30");
    await expect(page.getByRole("heading", { name: "Popular categories (product views)" })).toBeVisible();
    await page.goto("/admin/extract");
    await expect(page.getByRole("heading", { name: "Extraction result" })).toBeVisible();
    await page.goto("/admin/images");
    await expect(page.getByText("Hero photograph")).toBeVisible();
  });
});
