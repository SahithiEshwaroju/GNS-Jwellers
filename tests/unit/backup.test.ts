import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { createBackupZip, readBackupZip, sanitizeTables, emptyTables, BACKUP_TABLES, type Tables } from "@/lib/backup/format";
import { exportBackup, importBackup, type BackupApi } from "@/lib/backup/engine";

const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9]);

function sample(): Tables {
  const t = emptyTables();
  t.site_settings = [{ id: 1, shop_name: "GNS", hero_headline: "Tradition ✨ in Every Design" }];
  t.media = [
    { id: "m1", object_key: "products/a/one.jpg", content_type: "image/jpeg", size_bytes: JPG.length, status: "ready" },
    { id: "m2", object_key: "site/b/two.png", content_type: "image/png", size_bytes: PNG.length, status: "ready" },
    { id: "m3", object_key: "products/a/pending.jpg", content_type: "image/jpeg", size_bytes: 5, status: "pending" },
  ];
  t.categories = [{ id: "c1", name: "Rings", image_media_id: "m3" }];
  t.product_images = [{ id: "p1", product_id: "x", media_id: "m1" }, { id: "p2", product_id: "x", media_id: "m3" }];
  t.site_images = [{ id: "s1", media_id: "m2" }];
  return t;
}
const imgs = () => new Map([["products/a/one.jpg", JPG], ["site/b/two.png", PNG]]);

describe("backup format", () => {
  it("sanitize drops pending photos and dangling references", () => {
    const s = sanitizeTables(sample());
    expect(s.media.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(s.product_images.map((r) => r.id)).toEqual(["p1"]);
    expect(s.categories[0].image_media_id).toBeNull();
  });

  it("round-trips data and photos exactly", () => {
    const t = sanitizeTables(sample());
    const zip = createBackupZip(t, imgs(), new Date("2026-01-01T00:00:00Z"));
    const back = readBackupZip(zip);
    expect(back.tables).toEqual(t);
    expect([...back.images.keys()].sort()).toEqual(["products/a/one.jpg", "site/b/two.png"]);
    expect(Array.from(back.images.get("products/a/one.jpg")!)).toEqual(Array.from(JPG));
    expect(back.manifest.counts.media).toBe(2);
  });

  it("rejects non-backups and damaged files", () => {
    expect(() => readBackupZip(strToU8("not a zip"))).toThrow(/valid backup/);
    expect(() => readBackupZip(zipSync({ "x.txt": strToU8("hi") }))).toThrow(/manifest/);
  });

  it("rejects path traversal / bad keys, wrong sizes and fake images", () => {
    const base = (mut: (t: Tables) => void, images = imgs()) => { const t = sanitizeTables(sample()); mut(t); return createBackupZip(t, images); };
    expect(() => readBackupZip(base((t) => { t.media[0].object_key = "../etc/passwd"; }))).toThrow(/invalid image path/);
    expect(() => readBackupZip(base((t) => { t.media[0].size_bytes = 999; }))).toThrow(/size/);
    expect(() => readBackupZip(base(() => undefined, new Map([["products/a/one.jpg", PNG], ["site/b/two.png", PNG]])))).toThrow(/not a valid/);
    expect(() => readBackupZip(base(() => undefined, new Map([["site/b/two.png", PNG]])))).toThrow(/missing/);
  });
});

function fakeApi(db: Tables, store: Map<string, Uint8Array>): BackupApi & { restored?: Tables } {
  const api: BackupApi & { restored?: Tables } = {
    async tablePage(table, offset) { const rows = db[table].slice(offset, offset + 2); return { rows, done: offset + rows.length >= db[table].length }; },
    async downloadUrls(ids) { return Object.fromEntries(db.media.filter((m) => ids.includes(m.id as string)).map((m) => [m.id as string, `mem://${m.object_key}`])); },
    async presignRestore(items) { return Object.fromEntries(items.map((m) => [m.object_key, `mem://${m.object_key}`])); },
    async verifyRestore(items) { return items.filter((m) => store.get(m.object_key)?.length !== m.size_bytes).map((m) => m.object_key); },
    async restore(t) { api.restored = t; return { ok: true, counts: { media: t.media.length } }; },
    fetch: (async (url: string, init?: RequestInit) => {
      const key = String(url).replace("mem://", "");
      if (init?.method === "PUT") { store.set(key, new Uint8Array(init.body as Uint8Array)); return new Response(null, { status: 200 }); }
      const b = store.get(key);
      return b ? new Response(b as BodyInit) : new Response(null, { status: 403 });
    }) as typeof fetch,
  };
  return api;
}

describe("backup engine", () => {
  it("exports everything then restores it into an empty store", async () => {
    const db = sample();
    const src = new Map(imgs());
    const { zip, images } = await exportBackup(fakeApi(db, src));
    expect(images).toBe(2);

    const dest = new Map<string, Uint8Array>();
    const api = fakeApi(emptyTables(), dest);
    const counts = await importBackup(api, zip);
    expect(counts.media).toBe(2);
    expect([...dest.keys()].sort()).toEqual(["products/a/one.jpg", "site/b/two.png"]);
    expect(api.restored!.site_settings[0].hero_headline).toBe("Tradition ✨ in Every Design");
    for (const k of BACKUP_TABLES) expect(api.restored![k]).toBeDefined();
  });

  it("fails loudly instead of making an incomplete backup", async () => {
    const api = fakeApi(sample(), new Map([["products/a/one.jpg", JPG]]));
    await expect(exportBackup(api)).rejects.toThrow(/refused an image download/);
  });

  it("does not touch the database when a photo fails verification", async () => {
    const t = sanitizeTables(sample());
    const zip = createBackupZip(t, imgs());
    const api = fakeApi(emptyTables(), new Map());
    api.verifyRestore = async (items) => items.map((m) => m.object_key);
    await expect(importBackup(api, zip)).rejects.toThrow(/NOT changed/);
    expect(api.restored).toBeUndefined();
  });

  it("surfaces a database restore error", async () => {
    const zip = createBackupZip(sanitizeTables(sample()), imgs());
    const api = fakeApi(emptyTables(), new Map());
    api.restore = async () => ({ ok: false, error: "boom" });
    await expect(importBackup(api, zip)).rejects.toThrow("boom");
  });
});
