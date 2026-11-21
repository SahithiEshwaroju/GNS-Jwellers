import { test as base, expect, type BrowserContext } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnv, sessionCookies } from "./session";

loadEnv();

export async function loginAs(ctx: BrowserContext, kind: "ADMIN" | "CUSTOMER" | "OTHER", baseURL: string) {
  await ctx.addCookies(await sessionCookies(kind, baseURL));
}

/** Direct DB access as the test admin (RLS applies) for setup, verification and cleanup. */
export async function adminDb(): Promise<SupabaseClient> {
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! });
  if (error) throw error;
  return c;
}

export const randomMobile = () => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;

/** Every page used in a test also asserts that the Content-Security-Policy blocked nothing. */
export const test = base.extend({
  page: async ({ page }, run) => {
    const violations: string[] = [];
    page.on("console", (m) => {
      if (/Content Security Policy|violates the following/i.test(m.text())) violations.push(m.text().slice(0, 240));
    });
    await run(page);
    expect(violations, "CSP violations").toEqual([]);
  },
});
export { expect };
