import { test, expect, loginAs, adminDb } from "./fixtures";

test.describe("Signed-in customer", () => {
  test.beforeAll(async () => {
    const db = await adminDb();
    await db.from("site_settings").update({ whatsapp_number: "+919000000001" }).eq("id", 1);
  });
  test.afterAll(async () => {
    const db = await adminDb();
    await db.from("site_settings").update({ whatsapp_number: null }).eq("id", 1);
    await db.from("enquiries").delete().like("customer_name", "E2E%");
  });

  test("saves designs, sees them in Saved designs, and enquires about several at once", async ({ page, context, baseURL }) => {
    await loginAs(context, "CUSTOMER", baseURL!);
    await page.goto("/saved");
    // start clean
    while (await page.getByRole("button", { name: /^Remove .* from saved designs/ }).count()) {
      const before = await page.getByRole("button", { name: /^Remove .* from saved designs/ }).count();
      await page.getByRole("button", { name: /^Remove .* from saved designs/ }).first().click();
      await expect(page.getByRole("button", { name: /^Remove .* from saved designs/ })).toHaveCount(before - 1);
    }
    await page.goto("/product/GNS-RG-0001");
    await page.getByRole("button", { name: "Save Floral Bloom Ring" }).click();
    await expect(page.getByRole("button", { name: "Remove Floral Bloom Ring from saved designs" })).toBeVisible();
    await page.goto("/product/GNS-ER-0002");
    await page.getByRole("button", { name: "Save Temple Jhumkas" }).click();
    await expect(page.getByRole("button", { name: "Remove Temple Jhumkas from saved designs" })).toBeVisible();

    await page.goto("/saved");
    await expect(page.getByRole("link", { name: "Floral Bloom Ring" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Temple Jhumkas" })).toBeVisible();
    await page.getByRole("button", { name: "Select all" }).click();
    await page.getByRole("button", { name: /Enquire about 2 selected/ }).click();
    const dlg = page.getByRole("dialog");
    await expect(dlg.getByRole("heading", { name: "Enquire about these designs" })).toBeVisible();
    await dlg.getByLabel("Is this design currently available?").check();
    await expect(dlg.getByLabel(/^Name/)).toHaveValue("E2E Customer");
    await dlg.getByLabel(/^Name/).fill("E2E Customer");
    await dlg.getByLabel(/^Mobile number/).fill("9811122233");
    await dlg.getByRole("button", { name: "Review message" }).click();
    await expect(dlg.locator("pre")).toContainText("these designs");
    await expect(dlg.locator("pre")).toContainText("GNS-RG-0001");
    await expect(dlg.locator("pre")).toContainText("GNS-ER-0002");
    await dlg.getByRole("button", { name: "Continue" }).click();
    await expect(dlg.getByText(/GNS-ENQ-\d+/)).toBeVisible();
    await dlg.getByRole("button", { name: "Done" }).click();

    // registered-customer reference recorded
    const db = await adminDb();
    const { data } = await db.from("enquiries").select("source, user_id").eq("mobile", "9811122233").order("created_at", { ascending: false }).limit(1).single();
    expect(data?.source).toBe("multi");
    expect(data?.user_id).not.toBeNull();

    // remove from saved
    for (const n of ["Floral Bloom Ring", "Temple Jhumkas"]) {
      await page.getByRole("button", { name: `Remove ${n} from saved designs` }).click();
      await expect(page.getByRole("link", { name: n })).toHaveCount(0);
    }
    await page.reload();
    await expect(page.getByRole("heading", { name: "No saved designs yet" })).toBeVisible();
  });

  test("customer cannot open the admin portal", async ({ page, context, baseURL }) => {
    await loginAs(context, "CUSTOMER", baseURL!);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByText(/doesn't have admin access/)).toBeVisible();
  });
});
