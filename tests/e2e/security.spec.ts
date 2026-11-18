import { test, expect, loginAs } from "./fixtures";

test.describe("Access control", () => {
  test("signed-out visitors are sent to admin login", async ({ page }) => {
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByRole("heading", { name: "Admin Portal" })).toBeVisible();
  });

  test("a signed-in non-admin sees no admin data", async ({ page, context, baseURL }) => {
    await loginAs(context, "OTHER", baseURL!);
    await page.goto("/admin/enquiries");
    await expect(page.getByRole("heading", { name: "No admin access" })).toBeVisible();
    await expect(page.getByText("GNS-ENQ-")).toHaveCount(0);
  });

  test("upload endpoints reject anonymous and non-admin callers", async ({ request, context, baseURL }) => {
    const body = { purpose: "product", contentType: "image/png", size: 100 };
    expect((await request.post("/api/uploads/presign", { data: body })).status()).toBe(403);
    await loginAs(context, "CUSTOMER", baseURL!);
    expect((await context.request.post("/api/uploads/presign", { data: body })).status()).toBe(403);
    expect((await context.request.post("/api/uploads/presign", { data: body, headers: { Origin: "https://evil.example" } })).status()).toBe(403);
  });

  test("media route does not leak unknown or private files", async ({ request }) => {
    expect((await request.get("/api/media/00000000-0000-0000-0000-000000000000", { maxRedirects: 0 })).status()).toBe(404);
    expect((await request.get("/api/media/not-a-uuid", { maxRedirects: 0 })).status()).toBe(404);
  });

  test("auth callback only redirects to same-site paths", async ({ request }) => {
    const r = await request.get("/auth/callback?next=//evil.example", { maxRedirects: 0 });
    expect(r.headers()["location"]).not.toContain("evil.example");
  });
});
