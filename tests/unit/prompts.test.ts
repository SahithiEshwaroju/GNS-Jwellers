import { describe, expect, it } from "vitest";
import { buildReplyPrompt, composeManualReply, sanitizeDraft, REPLY_SYSTEM, buildDescribePrompt } from "@/lib/ai/prompts";

const ctx = {
  shopName: "GNS Jewellers", customerName: "Asha R.", products: [{ name: "Heritage Temple Necklace", code: "GNS-NK-0001" }],
  qa: [{ question: "What are the making charges?", answer: "₹21,720" }, { question: "How many days?", answer: "" }],
};

describe("AI reply prompts (BR-08)", () => {
  it("system prompt forbids inventing facts", () => {
    expect(REPLY_SYSTEM).toMatch(/Never invent/);
  });
  it("prompt contains only the customer questions and the admin's answers", () => {
    const p = buildReplyPrompt(ctx);
    expect(p).toContain("Shop's answer: ₹21,720");
    expect(p).toContain("not answered — say the shop will confirm");
  });
  it("manual reply works without AI and skips blank answers", () => {
    const r = composeManualReply(ctx);
    expect(r).toContain("Hello Asha,");
    expect(r).toContain("₹21,720");
    expect(r).not.toContain("How many days?");
    expect(r).toContain("— GNS Jewellers");
  });
});

describe("sanitizeDraft (untrusted model output)", () => {
  it("bounds and filters fields", () => {
    const d = sanitizeDraft({ name: "  Ring ", metal: "platinum", karat: 14, weight_g: -3, tags: ["a", 5, "b"], specifications: [{ label: "Size", value: "14" }, { label: "" }] });
    expect(d).toMatchObject({ name: "Ring", metal: null, karat: null, weight_g: null, tags: ["a", "b"], specifications: [{ label: "Size", value: "14" }] });
  });
  it("handles garbage", () => {
    expect(sanitizeDraft("nope").name).toBeNull();
  });
  it("describe prompt omits empty facts", () => {
    expect(buildDescribePrompt({ name: "X", metal: "gold", karat: 22 })).toBe("Product: X\nMetal: gold 22K");
  });
});
