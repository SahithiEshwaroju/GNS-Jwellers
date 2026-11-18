import { test, expect, loginAs } from "./fixtures";

const noOverflow = async (page: import("@playwright/test").Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

test.describe("Mobile layouts", () => {
  for (const url of ["/", "/jewellery", "/product/GNS-NK-0001", "/collections", "/custom-jewellery", "/about", "/saved"]) {
    test(`no horizontal scroll on ${url}`, async ({ page }) => {
      await page.goto(url);
      await noOverflow(page);
    });
  }

  test("menu opens with categories and search", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    const nav = page.getByRole("navigation", { name: "Mobile" });
    await expect(nav.getByRole("link", { name: "Necklaces" })).toBeVisible();
    await nav.getByRole("link", { name: "Rings", exact: true }).click();
    await expect(page).toHaveURL(/category=rings/);
  });

  test("filter sheet applies on Save", async ({ page }) => {
    await page.goto("/jewellery");
    await page.getByRole("button", { name: /^Filters/ }).click();
    const sheet = page.getByRole("dialog", { name: "Filters" });
    await sheet.getByLabel(/^Silver/).check();
    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/metal=silver/);
    await expect(page.getByText("1 Product")).toBeVisible();
  });

  test("admin portal works on a phone", async ({ page, context, baseURL }) => {
    await loginAs(context, "ADMIN", baseURL!);
    await page.goto("/admin");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("link", { name: "Orders" }).click();
    await expect(page.getByRole("heading", { name: "Orders", level: 1 })).toBeVisible();
    await noOverflow(page);
  });
});
