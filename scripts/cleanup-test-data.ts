// Removes rows created by automated tests (names start with "E2E"), using the test admin account (RLS applies).
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "../tests/e2e/session.ts";
loadEnv();
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const { error } = await db.auth.signInWithPassword({ email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! });
if (error) throw error;
const out: Record<string, number | string> = {};
const del = async (label: string, q: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>) => {
  const r = await q; out[label] = r.error ? `ERR ${r.error.message}` : (r.data ?? []).length;
};
await del("products", db.from("products").delete().like("name", "E2E%").eq("is_sample", false).select("id"));
await del("enquiries", db.from("enquiries").delete().like("customer_name", "E2E%").select("id"));
await del("categories", db.from("categories").delete().like("name", "E2E%").select("id"));
await del("collections", db.from("collections").delete().like("name", "E2E%").select("id"));
await del("tags", db.from("tags").delete().like("name", "E2E%").select("id"));
const uid = (await db.auth.getUser()).data.user!.id;
await del("media", db.from("media").delete().eq("uploaded_by", uid).select("id"));
const c = async (t: string) => (await db.from(t).select("*", { count: "exact", head: true })).count;
console.log(JSON.stringify({ deleted: out, remaining: { products: await c("products"), media: await c("media"), enquiries: await c("enquiries"), orders: await c("orders") } }));
