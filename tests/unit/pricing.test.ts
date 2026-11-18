import { describe, expect, it } from "vitest";
import { estimatePrice, derivedRates, pgRound, type Rates } from "@/lib/pricing";

const rates: Rates = { gold22Per10g: 115000, silverPerKg: 145000, gstPercent: 3 };

describe("estimatePrice (BR-01) — figures from the final design", () => {
  it("Heritage Temple Necklace 22K 28.34 g → ₹3,62,694", () => {
    expect(
      estimatePrice({ metal: "gold", karat: 22, weightG: 28.34, makingType: "fixed", makingValue: 21720, stoneValue: 4500 }, rates),
    ).toEqual({ ratePerG: 11500, metalValue: 325910, makingAmount: 21720, stoneAmount: 4500, gstAmount: 10564, total: 362694 });
  });
  it("Classic Diamond Pendant 18K 3.9 g → ₹61,795", () => {
    const r = estimatePrice({ metal: "gold", karat: 18, weightG: 3.9, makingType: "fixed", makingValue: 4800, stoneValue: 18500 }, rates)!;
    expect([r.metalValue, r.gstAmount, r.total]).toEqual([36695, 1800, 61795]);
  });
  it("silver uses rate per kg ÷ 1000", () => {
    expect(estimatePrice({ metal: "silver", karat: null, weightG: 42, makingType: "fixed", makingValue: 1800, stoneValue: 0 }, rates)!.total).toBe(8127);
  });
  it("supports percentage and per-gram making charges", () => {
    const pct = estimatePrice({ metal: "gold", karat: 22, weightG: 10, makingType: "percent", makingValue: 12, stoneValue: 0 }, rates)!;
    expect(pct.makingAmount).toBe(13800);
    const pg = estimatePrice({ metal: "gold", karat: 22, weightG: 10, makingType: "per_gram", makingValue: 750, stoneValue: 0 }, rates)!;
    expect(pg.makingAmount).toBe(7500);
  });
  it("returns null when no rates are configured", () => {
    expect(estimatePrice({ metal: "gold", karat: 22, weightG: 1, makingType: "fixed", makingValue: 0, stoneValue: 0 }, null)).toBeNull();
  });
  it("changes when the rate changes", () => {
    const a = estimatePrice({ metal: "gold", karat: 22, weightG: 10, makingType: "fixed", makingValue: 0, stoneValue: 0 }, rates)!.total;
    const b = estimatePrice({ metal: "gold", karat: 22, weightG: 10, makingType: "fixed", makingValue: 0, stoneValue: 0 }, { ...rates, gold22Per10g: 120000 })!.total;
    expect(b).toBeGreaterThan(a);
  });
});

describe("derivedRates — Rates page table from the design", () => {
  it("matches 24K 12,545 / 22K 11,500 / 18K 9,409 / 24K per 10 g 1,25,455 / silver 145", () => {
    expect(derivedRates(rates)).toEqual({ gold24PerG: 12545, gold22PerG: 11500, gold18PerG: 9409, gold24Per10g: 125455, silverPerG: 145 });
  });
});

describe("pgRound", () => {
  it("rounds half away from zero like Postgres", () => {
    expect(pgRound(2.5)).toBe(3);
    expect(pgRound(1799.85)).toBe(1800);
  });
});

// Parity with public.product_estimate(): values below were returned by the live database for the sample catalogue.
describe("TS ↔ SQL parity on the seeded catalogue", () => {
  const cases: [string, Parameters<typeof estimatePrice>[0], number][] = [
    ["GNS-NK-0002", { metal: "gold", karat: 18, weightG: 18.6, makingType: "fixed", makingValue: 18500, stoneValue: 34000 }, 234334],
    ["GNS-NK-0003", { metal: "gold", karat: 22, weightG: 12.4, makingType: "fixed", makingValue: 6800, stoneValue: 0 }, 153882],
    ["GNS-NK-0005", { metal: "gold", karat: 22, weightG: 32.5, makingType: "fixed", makingValue: 27500, stoneValue: 6000 }, 419468],
    ["GNS-RG-0001", { metal: "gold", karat: 22, weightG: 2.8, makingType: "fixed", makingValue: 6500, stoneValue: 0 }, 39861],
    ["GNS-RG-0002", { metal: "gold", karat: 18, weightG: 3.2, makingType: "fixed", makingValue: 9200, stoneValue: 38000 }, 79628],
    ["GNS-BG-0001", { metal: "gold", karat: 22, weightG: 12.6, makingType: "fixed", makingValue: 8900, stoneValue: 0 }, 158414],
    ["GNS-ER-0001", { metal: "gold", karat: 18, weightG: 4.1, makingType: "fixed", makingValue: 6400, stoneValue: 4290 }, 50745],
  ];
  it.each(cases)("%s", (_code, input, expected) => {
    expect(estimatePrice(input, rates)!.total).toBe(expected);
  });
});
