import { describe, expect, it } from "vitest";
import { formatINR, formatDateTime, formatDate, slugify, metalLabel, formatRelativeShort } from "@/lib/format";

describe("format", () => {
  it("uses Indian digit grouping", () => {
    expect(formatINR(362694)).toBe("₹3,62,694");
    expect(formatINR(1250000)).toBe("₹12,50,000");
    expect(formatINR(null)).toBe("—");
  });
  it("formats IST date-times like the design", () => {
    expect(formatDateTime("2026-11-16T04:54:00Z")).toBe("16 Nov 2026, 10:24 AM");
    expect(formatDate("2026-12-05")).toBe("5 Dec 2026");
  });
  it("relative short timestamps", () => {
    const now = new Date("2026-11-16T10:00:00Z");
    expect(formatRelativeShort("2026-11-15T10:00:00Z", now)).toBe("Yesterday");
    expect(formatRelativeShort("2026-11-14T10:00:00Z", now)).toBe("14 Nov");
  });
  it("slugifies names", () => {
    expect(slugify("Nose Pins & Studs")).toBe("nose-pins-studs");
  });
  it("labels metals", () => {
    expect(metalLabel("gold", 22)).toBe("22K Gold");
    expect(metalLabel("silver", null, "925")).toBe("Silver 925");
  });
});
