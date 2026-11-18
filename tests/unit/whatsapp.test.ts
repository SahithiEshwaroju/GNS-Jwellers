import { describe, expect, it } from "vitest";
import { buildEnquiryMessage, toWhatsAppNumber, whatsappLink, PREDEFINED_QUESTIONS } from "@/lib/whatsapp";

const product = { code: "GNS-PD-0001", name: "Classic Diamond Pendant", estimatedPrice: 61795, url: "https://gns.example/product/GNS-PD-0001" };

describe("buildEnquiryMessage", () => {
  it("includes product, price, link, questions, custom question and customer details", () => {
    const msg = buildEnquiryMessage({
      shopName: "GNS Jewellers", source: "product", products: [product],
      questions: [PREDEFINED_QUESTIONS[0], PREDEFINED_QUESTIONS[5]], customQuestion: "Can it be made in 22K?",
      customisation: { Metal: "Gold", Karat: "22K" }, name: "Asha R", mobile: "9876543210", email: "asha@example.com", ref: "GNS-ENQ-1042",
    });
    expect(msg).toContain("Classic Diamond Pendant (GNS-PD-0001)");
    expect(msg).toContain("Approx. price: ₹61,795");
    expect(msg).toContain(product.url);
    expect(msg).toContain("1. What is the approximate price?");
    expect(msg).toContain("2. Can this design be customized?");
    expect(msg).toContain("3. Can it be made in 22K?");
    expect(msg).toContain("Customisation I'd like: Metal Gold, Karat 22K");
    expect(msg).toContain("Mobile: 9876543210");
    expect(msg).toContain("Email: asha@example.com");
    expect(msg).toContain("Enquiry ref: GNS-ENQ-1042");
  });
  it("lists several designs for a multi-product enquiry", () => {
    const msg = buildEnquiryMessage({ shopName: "GNS", source: "multi", products: [product, { ...product, code: "GNS-RG-0001", name: "Floral Bloom Ring" }], questions: ["Q"], name: "A", mobile: "9000000000" });
    expect(msg).toContain("these designs");
    expect(msg).toContain("Floral Bloom Ring (GNS-RG-0001)");
  });
  it("custom enquiries describe the idea", () => {
    const msg = buildEnquiryMessage({ shopName: "GNS", source: "custom", products: [], questions: [], customQuestion: "22K temple necklace ~25 g", name: "A", mobile: "9000000000" });
    expect(msg).toContain("custom jewellery design");
    expect(msg).toContain("22K temple necklace ~25 g");
    expect(msg).not.toContain("Email:");
  });
});

describe("WhatsApp numbers and links", () => {
  it("normalises Indian numbers to 91XXXXXXXXXX", () => {
    expect(toWhatsAppNumber("98765 43210")).toBe("919876543210");
    expect(toWhatsAppNumber("+91 98765-43210")).toBe("919876543210");
    expect(toWhatsAppNumber("09876543210")).toBe("919876543210");
    expect(toWhatsAppNumber("12345")).toBeNull();
  });
  it("encodes the message into a wa.me link", () => {
    const url = whatsappLink("+919876543210", "Hello & welcome\nline 2")!;
    expect(url).toBe("https://wa.me/919876543210?text=Hello%20%26%20welcome%0Aline%202");
    expect(whatsappLink(null, "x")).toBeNull();
  });
});
