import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/api";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403 });
  const supabase = await createClient();
  await supabase.auth.signOut();
  const url = new URL(request.url);
  const to = url.searchParams.get("to") === "admin" ? "/admin/login" : "/";
  return NextResponse.redirect(new URL(to, url.origin), { status: 303 });
}
