// Prompt builders kept pure so they can be unit-tested without network access.

export type QA = { question: string; answer: string };

export type ReplyContext = {
  shopName: string;
  customerName: string;
  products: { name: string; code: string }[];
  qa: QA[];
  extraNote?: string;
};

export const REPLY_SYSTEM = [
  "You write short, warm, professional WhatsApp replies for a jewellery shop to its customer.",
  "STRICT RULES:",
  "- Use ONLY the facts in the shop's answers. Never invent or estimate prices, weights, making charges, availability, discounts or delivery timelines.",
  "- If an answer is blank, say the shop will confirm that detail; do not guess.",
  "- Mention that prices are approximate and final price is confirmed at the shop when a price is given.",
  "- Plain text suitable for WhatsApp: no markdown headings, at most one emoji, under 150 words.",
  "- Address the customer by first name and sign off with the shop name.",
].join("\n");

export function buildReplyPrompt(c: ReplyContext): string {
  const lines = [
    `Shop name: ${c.shopName}`,
    `Customer name: ${c.customerName}`,
    c.products.length
      ? `Design(s): ${c.products.map((p) => `${p.name} (${p.code})`).join("; ")}`
      : "Design(s): custom design request",
    "",
    "Customer questions and the shop's answers:",
    ...c.qa.map((x, i) => `${i + 1}. Q: ${x.question}\n   Shop's answer: ${x.answer.trim() || "(not answered — say the shop will confirm)"}`),
  ];
  if (c.extraNote?.trim()) lines.push("", `Additional note from the shop: ${c.extraNote.trim()}`);
  lines.push("", "Write the reply message now.");
  return lines.join("\n");
}

/** Manual fallback: assembles a reply from the answers without AI. */
export function composeManualReply(c: ReplyContext): string {
  const first = c.customerName.trim().split(/\s+/)[0] || "there";
  const lines = [`Hello ${first},`, "", `Thank you for your enquiry${c.products.length ? ` about ${c.products.map((p) => p.name).join(", ")}` : ""}.`];
  const answered = c.qa.filter((x) => x.answer.trim());
  if (answered.length) {
    lines.push("");
    answered.forEach((x) => lines.push(`• ${x.question}`, `  ${x.answer.trim()}`));
  }
  if (c.extraNote?.trim()) lines.push("", c.extraNote.trim());
  lines.push("", "Prices are approximate; the final price is confirmed at the shop.", "", `— ${c.shopName}`);
  return lines.join("\n");
}

export const EXTRACT_SYSTEM = [
  "You read text from a photo of a jewellery catalogue page or product tag and return JSON only.",
  "Extract only information that is clearly printed. Use null for anything not present. Never guess prices or weights.",
  "Do not describe or invent the jewellery's appearance beyond printed text.",
].join("\n");

export const EXTRACT_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING", nullable: true },
    description: { type: "STRING", nullable: true },
    model_description: { type: "STRING", nullable: true },
    metal: { type: "STRING", enum: ["gold", "silver"], nullable: true },
    karat: { type: "INTEGER", nullable: true },
    weight_g: { type: "NUMBER", nullable: true },
    stones_note: { type: "STRING", nullable: true },
    style: { type: "STRING", nullable: true },
    occasion: { type: "STRING", nullable: true },
    tags: { type: "ARRAY", items: { type: "STRING" } },
    specifications: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { label: { type: "STRING" }, value: { type: "STRING" } }, required: ["label", "value"] },
    },
  },
} as const;

export type ExtractedDraft = {
  name: string | null;
  description: string | null;
  model_description: string | null;
  metal: "gold" | "silver" | null;
  karat: number | null;
  weight_g: number | null;
  stones_note: string | null;
  style: string | null;
  occasion: string | null;
  tags: string[];
  specifications: { label: string; value: string }[];
};

/** Normalises untrusted model output into safe, bounded draft fields. */
export function sanitizeDraft(raw: unknown): ExtractedDraft {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  const karat = num(o.karat);
  return {
    name: str(o.name, 120),
    description: str(o.description, 2000),
    model_description: str(o.model_description, 2000),
    metal: o.metal === "gold" || o.metal === "silver" ? o.metal : null,
    karat: karat && [18, 22, 24].includes(karat) ? karat : null,
    weight_g: num(o.weight_g) && (o.weight_g as number) < 10000 ? (o.weight_g as number) : null,
    stones_note: str(o.stones_note, 200),
    style: str(o.style, 40),
    occasion: str(o.occasion, 40),
    tags: Array.isArray(o.tags) ? o.tags.map((t) => str(t, 40)).filter((t): t is string => !!t).slice(0, 20) : [],
    specifications: Array.isArray(o.specifications)
      ? o.specifications
          .map((s) => {
            const r = (s ?? {}) as Record<string, unknown>;
            const label = str(r.label, 40);
            const value = str(r.value, 120);
            return label && value ? { label, value } : null;
          })
          .filter((s): s is { label: string; value: string } => !!s)
          .slice(0, 20)
      : [],
  };
}

export type DescribeFacts = {
  name: string;
  category?: string;
  metal: string;
  karat?: number | null;
  weightG?: number | null;
  stonesNote?: string | null;
  style?: string | null;
  occasion?: string | null;
  ownerNotes?: string | null;
};

export const DESCRIBE_SYSTEM = [
  "You write concise product copy for a jewellery shop's catalogue. Return JSON only.",
  "Use only the facts given. Do not claim hallmarking, certification, purity, stone quality, availability or price.",
  "description: 1–2 sentences for customers. model_description: one short sentence about the form/design.",
].join("\n");

export function buildDescribePrompt(f: DescribeFacts): string {
  return [
    `Product: ${f.name}`,
    f.category && `Category: ${f.category}`,
    `Metal: ${f.metal}${f.karat ? ` ${f.karat}K` : ""}`,
    f.weightG && `Approx. weight: ${f.weightG} g`,
    f.stonesNote && `Stones: ${f.stonesNote}`,
    f.style && `Style: ${f.style}`,
    f.occasion && `Occasion: ${f.occasion}`,
    f.ownerNotes && `Owner's notes: ${f.ownerNotes}`,
  ]
    .filter(Boolean)
    .join("\n");
}
