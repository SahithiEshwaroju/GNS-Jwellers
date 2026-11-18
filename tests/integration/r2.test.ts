/**
 * R2 storage flow against an S3-compatible server (moto) — proves presign → PUT → HEAD → sniff →
 * signed GET → delete with the real AWS SDK code paths. It does NOT prove Cloudflare R2 itself.
 * Requires R2_ENDPOINT (e.g. http://127.0.0.1:5055) and dummy credentials; skipped otherwise.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { S3Client, CreateBucketCommand } from "@aws-sdk/client-s3";

const endpoint = process.env.R2_ENDPOINT;
const d = endpoint ? describe : describe.skip;

d("R2 storage helpers (S3-compatible)", () => {
  let r2: typeof import("@/lib/r2");
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);

  beforeAll(async () => {
    const s3 = new S3Client({
      region: "auto", endpoint, forcePathStyle: true,
      credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
    });
    await s3.send(new CreateBucketCommand({ Bucket: process.env.R2_BUCKET! })).catch(() => undefined);
    r2 = await import("@/lib/r2");
  });

  it("uploads with a presigned PUT, verifies, serves via signed GET, deletes", async () => {
    const key = `products/test-${Date.now()}/abc123.png`;
    const putUrl = await r2.presignUpload(key, "image/png", png.length);
    expect(putUrl).toContain("X-Amz-Signature");
    const put = await fetch(putUrl, { method: "PUT", body: png, headers: { "Content-Type": "image/png" } });
    expect(put.status).toBe(200);

    expect(await r2.headObject(key)).toMatchObject({ size: png.length });
    const head = await r2.readObjectHead(key);
    const { sniffImageType } = await import("@/lib/media-rules");
    expect(sniffImageType(head)).toBe("image/png");

    const getUrl = await r2.presignDownload(key);
    const got = await fetch(getUrl);
    expect(got.status).toBe(200);
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(png);

    await r2.deleteObjects([key]);
    expect(await r2.headObject(key)).toBeNull();
  });

  it("completion check rejects a stored object whose type or bytes don't match (moto does not enforce signed headers; R2 does)", async () => {
    const { verifyUploadedObject } = await import("@/lib/media-rules");
    const key = `products/test-${Date.now()}/mismatch.png`;
    const putUrl = await r2.presignUpload(key, "image/png", png.length);
    await fetch(putUrl, { method: "PUT", body: png, headers: { "Content-Type": "text/html" } });
    const head = await r2.headObject(key);
    expect(verifyUploadedObject({ size: png.length, contentType: "image/png" }, head, await r2.readObjectHead(key))).toMatch(/type did not match/);

    const key2 = `products/test-${Date.now()}/notimage.png`;
    const html = new TextEncoder().encode("<html><script>alert(1)</script>");
    await fetch(await r2.presignUpload(key2, "image/png", html.length), { method: "PUT", body: html, headers: { "Content-Type": "image/png" } });
    expect(verifyUploadedObject({ size: html.length, contentType: "image/png" }, await r2.headObject(key2), await r2.readObjectHead(key2))).toMatch(/not a valid/);
    await r2.deleteObjects([key, key2]);
  });

  it("signed downloads force the image content type", async () => {
    const key = `products/test-${Date.now()}/forced.png`;
    await fetch(await r2.presignUpload(key, "image/png", png.length), { method: "PUT", body: png, headers: { "Content-Type": "image/png" } });
    const url = await r2.presignDownload(key, "image/png");
    expect(url).toContain("response-content-type=image%2Fpng");
    expect((await fetch(url)).headers.get("content-type")).toBe("image/png");
    await r2.deleteObjects([key]);
  });

  it("refuses keys outside the allowed layout", async () => {
    await expect(r2.presignDownload("../secrets.txt")).rejects.toThrow(/Invalid object key/);
    await expect(r2.presignUpload("products/x/../../y.png", "image/png", 10)).rejects.toThrow();
  });
});
