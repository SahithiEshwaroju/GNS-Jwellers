import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { readBackupZip } from "@/lib/backup/format";
import { buildStarterZip } from "../../starter/build";

describe("starter backup", () => {
  const zip = buildStarterZip();
  const b = readBackupZip(zip);
  it("is a valid backup with the default catalogue and no products or photos", () => {
    expect(b.tables.categories).toHaveLength(11);
    expect(b.tables.subcategories.length).toBeGreaterThan(20);
    expect(b.tables.collections).toHaveLength(6);
    expect(b.tables.tags).toHaveLength(18);
    expect(b.tables.products).toHaveLength(0);
    expect(b.tables.media).toHaveLength(0);
    expect(b.images.size).toBe(0);
    expect(b.tables.site_settings[0].shop_name).toBe("GNS Jewellers");
  });
  it("is deterministic", () => {
    expect(Array.from(buildStarterZip())).toEqual(Array.from(zip));
  });
  it.runIf(process.env.WRITE_STARTER)("writes the file", () => {
    writeFileSync("starter/GNS-Jewellers-Starter-Backup.zip", zip);
  });
});
