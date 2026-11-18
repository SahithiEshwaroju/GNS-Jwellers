import { formatINR } from "./format";

export const PREDEFINED_QUESTIONS = [
  "What is the approximate price?",
  "What are the making charges?",
  "Can I provide my own gold?",
  "How many days will it take to make?",
  "Is this design currently available?",
  "Can this design be customized?",
  "What is the approximate gold weight?",
] as const;

export type EnquiryProduct = { code: string; name: string; estimatedPrice: number | null; url: string };

export type EnquiryMessageInput = {
  shopName: string;
  source: "product" | "multi" | "custom" | "general";
  products: EnquiryProduct[];
  questions: string[];
  customQuestion?: string | null;
  customisation?: Record<string, string>;
  name: string;
  mobile: string;
  email?: string | null;
  ref?: string | null;
};

/** The customer's enquiry message, shown for review and prefilled in WhatsApp. */
export function buildEnquiryMessage(i: EnquiryMessageInput): string {
  const lines: string[] = [];
  if (i.source === "custom") {
    lines.push(`Hello ${i.shopName}, I'd like to discuss a custom jewellery design.`);
    if (i.customQuestion) lines.push("", "My idea:", i.customQuestion.trim());
    lines.push("", "I can share reference images here on WhatsApp.");
  } else {
    lines.push(
      i.products.length > 1
        ? `Hello ${i.shopName}, I'd like to enquire about these designs:`
        : `Hello ${i.shopName}, I'd like to enquire about this design:`,
    );
    for (const p of i.products) {
      lines.push(
        "",
        `• ${p.name} (${p.code})`,
        `  Approx. price: ${p.estimatedPrice ? formatINR(p.estimatedPrice) : "on request"}`,
        `  ${p.url}`,
      );
    }
    const custom = Object.entries(i.customisation ?? {}).filter(([, v]) => v);
    if (custom.length) {
      lines.push("", `Customisation I'd like: ${custom.map(([k, v]) => `${k} ${v}`).join(", ")}`);
    }
    if (i.questions.length || i.customQuestion) {
      lines.push("", "My questions:");
      i.questions.forEach((q, n) => lines.push(`${n + 1}. ${q}`));
      if (i.customQuestion) lines.push(`${i.questions.length + 1}. ${i.customQuestion.trim()}`);
    }
  }
  lines.push("", `Name: ${i.name.trim()}`, `Mobile: ${i.mobile}`);
  if (i.email) lines.push(`Email: ${i.email}`);
  if (i.ref) lines.push(`Enquiry ref: ${i.ref}`);
  return lines.join("\n");
}

/** Digits only, with country code (assumes India for 10-digit numbers). */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(d)) return `91${d}`;
  if (/^0[6-9]\d{9}$/.test(d)) return `91${d.slice(1)}`;
  if (/^\d{11,15}$/.test(d)) return d;
  return null;
}

export function whatsappLink(number: string | null | undefined, text: string): string | null {
  const n = toWhatsAppNumber(number);
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}
