import "server-only";
import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export function handleRouteError(e: unknown, context: string) {
  if (e instanceof AuthError) return jsonError("You need to be signed in as an admin.", 403);
  console.error(`[${context}]`, e instanceof Error ? e.message : e);
  return jsonError("Something went wrong. Please try again.", 500);
}

/** Rejects cross-site POSTs (defence in depth on top of SameSite cookies). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(req.url).host || origin === process.env.NEXT_PUBLIC_SITE_URL;
  } catch {
    return false;
  }
}
