import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** OAuth (PKCE) return URL. Only same-site relative paths are accepted for `next`. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") && !nextParam.startsWith("/\\") ? nextParam : "/";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    console.error("[auth/callback]", error.message);
  }
  const fail = new URL(next.startsWith("/admin") ? "/admin/login" : "/login", url.origin);
  fail.searchParams.set("error", "signin");
  return NextResponse.redirect(fail);
}
