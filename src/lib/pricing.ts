// Mirrors public.product_estimate() in supabase/migrations/..._pricing_and_catalogue.sql (BR-01).
export type Metal = "gold" | "silver";
export type MakingType = "fixed" | "percent" | "per_gram";

export type Rates = { gold22Per10g: number; silverPerKg: number; gstPercent: number };

export type PriceInput = {
  metal: Metal;
  karat: number | null;
  weightG: number;
  makingType: MakingType;
  makingValue: number;
  stoneValue: number;
};

export type PriceBreakdown = {
  ratePerG: number;
  metalValue: number;
  makingAmount: number;
  stoneAmount: number;
  gstAmount: number;
  total: number;
};

/** Postgres round(numeric) rounds half away from zero. */
export function pgRound(n: number): number {
  return Math.sign(n) * Math.round(Math.abs(n) + Number.EPSILON * Math.abs(n));
}

export function ratePerGram(metal: Metal, karat: number | null, rates: Rates): number {
  if (metal === "gold") return ((rates.gold22Per10g / 10) * (karat ?? 22)) / 22;
  return rates.silverPerKg / 1000;
}

export function estimatePrice(p: PriceInput, rates: Rates | null): PriceBreakdown | null {
  if (!rates) return null;
  const rate = ratePerGram(p.metal, p.karat, rates);
  const metalValue = pgRound(p.weightG * rate);
  const makingAmount =
    p.makingType === "percent"
      ? pgRound((metalValue * p.makingValue) / 100)
      : p.makingType === "per_gram"
        ? pgRound(p.weightG * p.makingValue)
        : pgRound(p.makingValue);
  const stoneAmount = pgRound(p.stoneValue || 0);
  const gstAmount = pgRound(((metalValue + makingAmount + stoneAmount) * rates.gstPercent) / 100);
  return {
    ratePerG: rate,
    metalValue,
    makingAmount,
    stoneAmount,
    gstAmount,
    total: metalValue + makingAmount + stoneAmount + gstAmount,
  };
}

/** Per-gram table shown on the Rates page. */
export function derivedRates(rates: Rates) {
  return {
    gold24PerG: pgRound(ratePerGram("gold", 24, rates)),
    gold22PerG: pgRound(ratePerGram("gold", 22, rates)),
    gold18PerG: pgRound(ratePerGram("gold", 18, rates)),
    gold24Per10g: pgRound(ratePerGram("gold", 24, rates) * 10),
    silverPerG: pgRound(ratePerGram("silver", null, rates)),
  };
}
