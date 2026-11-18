import "server-only";
import { serverEnv, geminiConfigured } from "@/lib/server-env";
import {
  REPLY_SYSTEM, buildReplyPrompt, type ReplyContext,
  EXTRACT_SYSTEM, EXTRACT_SCHEMA, sanitizeDraft, type ExtractedDraft,
  DESCRIBE_SYSTEM, buildDescribePrompt, type DescribeFacts,
} from "./prompts";

export type AiResult<T> = { ok: true; data: T } | { ok: false; reason: "not_configured" | "failed"; message: string };

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

async function generate(system: string, parts: Part[], opts: { json?: boolean; schema?: unknown; temperature?: number } = {}) {
  const { apiKey, model } = serverEnv.gemini;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: opts.temperature ?? 0.3,
        maxOutputTokens: 1024,
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
        ...(opts.schema ? { responseSchema: opts.schema } : {}),
      },
    }),
    signal: AbortSignal.timeout(20_000), // fits Netlify function limits (26 s max)
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini returned no text");
  return text;
}

async function run<T>(fn: () => Promise<T>): Promise<AiResult<T>> {
  if (!geminiConfigured()) {
    return { ok: false, reason: "not_configured", message: "AI assistance isn't set up yet. You can write the text manually." };
  }
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    console.error("[gemini]", e instanceof Error ? e.message : e);
    return { ok: false, reason: "failed", message: "AI assistance is unavailable right now. You can write the text manually." };
  }
}

export function draftReply(ctx: ReplyContext): Promise<AiResult<string>> {
  return run(async () => (await generate(REPLY_SYSTEM, [{ text: buildReplyPrompt(ctx) }], { temperature: 0.4 })).slice(0, 4000));
}

export function extractCatalogue(image: Uint8Array, mimeType: string): Promise<AiResult<ExtractedDraft>> {
  return run(async () => {
    const text = await generate(
      EXTRACT_SYSTEM,
      [
        { text: "Extract the product information printed in this image." },
        { inline_data: { mime_type: mimeType, data: Buffer.from(image).toString("base64") } },
      ],
      { json: true, schema: EXTRACT_SCHEMA, temperature: 0 },
    );
    return sanitizeDraft(JSON.parse(text));
  });
}

export function suggestDescription(facts: DescribeFacts): Promise<AiResult<{ description: string; model_description: string }>> {
  return run(async () => {
    const text = await generate(DESCRIBE_SYSTEM, [{ text: buildDescribePrompt(facts) }], {
      json: true,
      schema: {
        type: "OBJECT",
        properties: { description: { type: "STRING" }, model_description: { type: "STRING" } },
        required: ["description", "model_description"],
      },
      temperature: 0.6,
    });
    const o = JSON.parse(text) as Record<string, unknown>;
    const s = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 2000) : "");
    return { description: s(o.description), model_description: s(o.model_description) };
  });
}
