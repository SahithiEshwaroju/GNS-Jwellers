import { NextResponse } from "next/server";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteObjects, headObject, readObjectHead } from "@/lib/r2";
import { verifyUploadedObject } from "@/lib/media-rules";
import { handleRouteError, jsonError, sameOrigin } from "@/lib/api";

const body = z.object({ mediaId: z.string().uuid() });

/** Verifies the uploaded object (exists, size, real image type) before marking it ready. */
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return jsonError("Cross-site request blocked.", 403);
    await assertAdmin();
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError("Invalid request.", 400);

    const supabase = await createClient();
    const { data: media } = await supabase
      .from("media")
      .select("id, object_key, content_type, size_bytes, status")
      .eq("id", parsed.data.mediaId)
      .maybeSingle();
    if (!media) return jsonError("Upload not found.", 404);
    if (media.status === "ready") return NextResponse.json({ ok: true, mediaId: media.id });

    const head = await headObject(media.object_key);
    const reject = async (msg: string) => {
      await deleteObjects([media.object_key]).catch(() => undefined);
      await supabase.from("media").delete().eq("id", media.id);
      return jsonError(msg, 400);
    };
    const firstBytes = head ? await readObjectHead(media.object_key) : null;
    const problem = verifyUploadedObject({ size: media.size_bytes, contentType: media.content_type }, head, firstBytes);
    if (problem) return reject(problem);

    const { error } = await supabase.from("media").update({ status: "ready" }).eq("id", media.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, mediaId: media.id }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return handleRouteError(e, "uploads/complete");
  }
}
