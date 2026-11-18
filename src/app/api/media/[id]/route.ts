import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { presignDownload } from "@/lib/r2";
import { r2Configured } from "@/lib/server-env";
import type { AllowedType } from "@/lib/media-rules";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Authorised image access. RLS on `media` decides visibility: public only when attached to a
 * published product or a site slot; everything else (drafts, catalogue-extraction uploads) admin-only.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id) || !r2Configured()) return new NextResponse(null, { status: 404 });
  const supabase = await createClient();
  const { data } = await supabase.from("media").select("object_key, status, content_type").eq("id", id).maybeSingle();
  if (!data || data.status !== "ready") return new NextResponse(null, { status: 404 });
  try {
    const url = await presignDownload(data.object_key, data.content_type as AllowedType);
    return NextResponse.redirect(url, {
      status: 302,
      headers: { "Cache-Control": "private, max-age=3000", "Referrer-Policy": "no-referrer" },
    });
  } catch (e) {
    console.error("[media]", e instanceof Error ? e.message : e);
    return new NextResponse(null, { status: 502 });
  }
}
