import { NextResponse } from "next/server";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteObjects } from "@/lib/r2";
import { handleRouteError, jsonError, sameOrigin } from "@/lib/api";

const body = z.object({ mediaId: z.string().uuid() });

/** Deletes an uploaded image that is not attached to a product (e.g. removed before saving). */
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return jsonError("Cross-site request blocked.", 403);
    await assertAdmin();
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError("Invalid request.", 400);
    const supabase = await createClient();
    const { count } = await supabase
      .from("product_images")
      .select("id", { count: "exact", head: true })
      .eq("media_id", parsed.data.mediaId);
    if (count) return jsonError("This photo is attached to a saved product; remove it from the product instead.", 409);
    const { data, error } = await supabase.from("media").delete().eq("id", parsed.data.mediaId).select("object_key");
    if (error) throw new Error(error.message);
    if (data?.length) await deleteObjects(data.map((d) => d.object_key));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e, "uploads/discard");
  }
}
