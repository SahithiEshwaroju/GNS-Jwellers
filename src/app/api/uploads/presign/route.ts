import { NextResponse } from "next/server";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { r2Configured } from "@/lib/server-env";
import { presignUpload, UPLOAD_URL_TTL } from "@/lib/r2";
import { buildObjectKey, validateUpload, type AllowedType } from "@/lib/media-rules";
import { handleRouteError, jsonError, sameOrigin } from "@/lib/api";

const body = z.object({
  purpose: z.enum(["product", "site", "extract"]),
  contentType: z.string().max(50),
  size: z.number().int(),
  altText: z.string().trim().max(200).optional(),
});

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return jsonError("Cross-site request blocked.", 403);
    const user = await assertAdmin();
    if (!r2Configured()) return jsonError("Image storage is not configured yet (Cloudflare R2).", 503);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError("Invalid upload request.", 400);
    const { purpose, contentType, size, altText } = parsed.data;
    const problem = validateUpload(contentType, size);
    if (problem) return jsonError(problem, 400);

    const scope = purpose === "extract" ? user.id : crypto.randomUUID();
    const key = buildObjectKey(purpose, scope, crypto.randomUUID().replace(/-/g, ""), contentType as AllowedType);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("media")
      .insert({ object_key: key, purpose, content_type: contentType, size_bytes: size, alt_text: altText, uploaded_by: user.id })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "media insert failed");

    const uploadUrl = await presignUpload(key, contentType as AllowedType, size);
    return NextResponse.json(
      { ok: true, mediaId: data.id, uploadUrl, expiresIn: UPLOAD_URL_TTL },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return handleRouteError(e, "uploads/presign");
  }
}
