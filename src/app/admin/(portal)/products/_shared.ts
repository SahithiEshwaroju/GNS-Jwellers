import "server-only";
import { getCategories, getCollections, getCurrentRates } from "@/lib/data/site";
import { r2Configured, geminiConfigured } from "@/lib/server-env";

export async function formDeps() {
  const [cats, cols, rates] = await Promise.all([getCategories(), getCollections(), getCurrentRates()]);
  return {
    categories: cats.map((c) => ({ id: c.id, name: c.name, subcategories: c.subcategories.map((s) => ({ id: s.id, name: s.name })) })),
    collections: cols.map((c) => ({ id: c.id, name: c.name })),
    rates: rates ? { gold22Per10g: rates.gold22Per10g, silverPerKg: rates.silverPerKg, gstPercent: rates.gstPercent } : null,
    storageReady: r2Configured(),
    aiReady: geminiConfigured(),
  };
}
