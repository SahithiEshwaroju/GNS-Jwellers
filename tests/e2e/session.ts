/**
 * Test-only: signs a test account in with the real Supabase password grant and returns the
 * @supabase/ssr session cookies so Playwright can act as that user (Google OAuth can't be automated).
 */
import { createServerClient } from "@supabase/ssr";
import fs from "node:fs";

export function loadEnv() {
  for (const file of [".env.local", ".env.test.local"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

export async function sessionCookies(kind: "ADMIN" | "CUSTOMER" | "OTHER", baseURL: string) {
  loadEnv();
  const jar = new Map<string, string>();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email: process.env[`TEST_${kind}_EMAIL`]!, password: process.env[`TEST_${kind}_PASSWORD`]! });
  if (error) throw new Error(`sign-in ${kind}: ${error.message}`);
  const url = new URL(baseURL);
  return [...jar].map(([name, value]) => ({ name, value, domain: url.hostname, path: "/", httpOnly: false, secure: false, sameSite: "Lax" as const }));
}
