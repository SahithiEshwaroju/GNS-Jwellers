import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import type { Database } from "@/lib/supabase/database.types";

function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env.test.local");

export const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.TEST_ADMIN_PASSWORD);

export function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function signedIn(kind: "ADMIN" | "CUSTOMER" | "OTHER"): Promise<SupabaseClient<Database>> {
  const c = anonClient();
  const { error } = await c.auth.signInWithPassword({
    email: process.env[`TEST_${kind}_EMAIL`]!,
    password: process.env[`TEST_${kind}_PASSWORD`]!,
  });
  if (error) throw new Error(`sign-in ${kind}: ${error.message}`);
  return c;
}

export const randomMobile = () => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;
