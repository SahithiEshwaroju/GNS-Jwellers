import { test, expect, adminDb, randomMobile } from "./fixtures";

test.describe("Guest customer journey", () => {
  test.beforeAll(async () => {
    const db = await adminDb();
    await db.from("site_settings").update({ whatsapp_number: "+919000000001" }).eq("id", 1);
  });
  test.afterAll(async () => {
    const db = await adminDb();
    await db.from("site_settings").update({ whatsapp_number: null }).eq("id", 1);
    await db.from("enquiries").delete().like("customer_name", "E2E%");
  });

  test("home shows hero, categories, featured designs and reference rates", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Shop by Category" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Featured Designs" })).toBeVisible();
    await expect(page.getByText(/Reference rates · 22K gold ₹/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Heritage Temple Necklace/ }).first()).toBeVisible();
  });

  test("catalogue filters, sorting, search and load more", async ({ page }) => {
    await page.goto("/jewellery");
    await expect(page.getByText(/\d+ Products/)).toBeVisible();
    await page.getByRole("complementary", { name: "Filters" }).getByLabel(/^Rings/).check();
    await expect(page).toHaveURL(/category=rings/);
    await expect(page.getByText("2 Products")).toBeVisible();
    await page.getByLabel("Sort by").selectOption("price-desc");
    await expect(page).toHaveURL(/sort=price-desc/);
    const names = await page.locator("article h3").allTextContents();
    expect(names[0]).toContain("Solitaire Promise Ring");
    await page.goto("/jewellery?q=GNS-PD-0001");
    await expect(page.getByText("1 Product")).toBeVisible();
    await page.goto("/jewellery?q=zzzz-no-match");
    await expect(page.getByRole("heading", { name: "No designs found" })).toBeVisible();
    await page.goto("/jewellery");
    await page.getByRole("link", { name: "Load more designs" }).click();
    await expect(page).toHaveURL(/show=24/);
  });

  test("product page shows price breakup that matches the design", async ({ page }) => {
    await page.goto("/product/GNS-PD-0001");
    await expect(page.getByRole("heading", { name: "Classic Diamond Pendant", level: 1 })).toBeVisible();
    const breakup = page.getByRole("region", { name: /Price Breakup/ });
    await expect(breakup.getByText("₹36,695")).toBeVisible();
    await expect(breakup.getByText("₹61,795")).toBeVisible();
    await expect(page.getByText(/Approximate price\. Final price will be confirmed/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Similar Designs" })).toBeVisible();
  });

  test("smart enquiry builder records the enquiry and prepares WhatsApp", async ({ page, context }) => {
    await context.route("https://wa.me/**", (r) => r.fulfill({ status: 200, body: "whatsapp stub" }));
    await page.goto("/product/GNS-NK-0001");
    await page.getByRole("radio", { name: "18K" }).click();
    await page.getByRole("button", { name: "Enquire Now" }).click();
    const dlg = page.getByRole("dialog");
    await expect(dlg.getByText("1 · Questions & details")).toBeVisible();
    // validation
    await dlg.getByRole("button", { name: "Review message" }).click();
    await expect(dlg.getByRole("alert")).toBeVisible();
    await dlg.getByLabel("What are the making charges?").check();
    await dlg.getByLabel("Your own question (optional)").fill("Can it be lighter, around 22 g?");
    await dlg.getByLabel(/^Name/).fill("E2E Guest");
    const mobile = randomMobile();
    await dlg.getByLabel(/^Mobile number/).fill(mobile);
    await dlg.getByRole("button", { name: "Review message" }).click();
    const msg = dlg.locator("pre");
    await expect(msg).toContainText("Heritage Temple Necklace (GNS-NK-0001)");
    await expect(msg).toContainText("Customisation I'd like: Karat 18K");
    await expect(msg).toContainText("1. What are the making charges?");
    await expect(msg).toContainText(`Mobile: ${mobile}`);
    await dlg.getByRole("button", { name: "Continue" }).click();
    await expect(dlg.getByText(/Your enquiry reference is GNS-ENQ-\d+/)).toBeVisible();
    const link = dlg.getByRole("link", { name: "Open WhatsApp" });
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^https:\/\/wa\.me\/919000000001\?text=/);
    expect(decodeURIComponent(href!.split("text=")[1])).toContain("Enquiry ref: GNS-ENQ-");
    const popup = page.waitForEvent("popup");
    await link.click();
    await (await popup).close();
    await expect(dlg.getByText(/WhatsApp opened/)).toBeVisible();
    // the record exists with WhatsApp-opened time (checked as admin)
    const db = await adminDb();
    await expect.poll(async () => (await db.from("enquiries").select("whatsapp_opened_at, questions, customisation").eq("mobile", mobile).single()).data?.whatsapp_opened_at ?? null).not.toBeNull();
  });

  test("custom jewellery enquiry", async ({ page }) => {
    await page.goto("/custom-jewellery");
    await page.getByLabel(/^Your idea/).fill("A 22K temple necklace like my photo, about 25 g");
    await page.getByLabel(/^Name/).fill("E2E Custom");
    await page.getByLabel(/^Mobile number/).fill(randomMobile());
    await page.getByRole("button", { name: "Preview WhatsApp message" }).click();
    await expect(page.locator("pre")).toContainText("custom jewellery design");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/Your enquiry reference is GNS-ENQ-\d+/)).toBeVisible();
  });

  test("saving requires sign-in; unknown products 404; collections and about pages render", async ({ page }) => {
    await page.goto("/jewellery");
    await page.getByRole("button", { name: /^Save / }).first().click();
    await expect(page).toHaveURL(/\/saved\?signin=1/);
    await expect(page.getByRole("heading", { name: "Sign in to save designs" })).toBeVisible();
    const r = await page.goto("/product/GNS-XX-9999");
    expect(r?.status()).toBe(404);
    await page.goto("/collections");
    await expect(page.getByRole("link", { name: /Bridal Collection/ })).toBeVisible();
    await page.getByRole("link", { name: /Bridal Collection/ }).click();
    await expect(page.getByRole("heading", { name: "Bridal Collection", level: 1 })).toBeVisible();
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: "Visit or message us" })).toBeVisible();
  });
});
