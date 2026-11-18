import { describe, expect, it } from "vitest";
import { validateUpload, sniffImageType, buildObjectKey, OBJECT_KEY_PATTERN, MAX_UPLOAD_BYTES } from "@/lib/media-rules";

describe("upload rules", () => {
  it("accepts JPG/PNG/WebP up to 8 MB", () => {
    expect(validateUpload("image/jpeg", 1000)).toBeNull();
    expect(validateUpload("image/webp", MAX_UPLOAD_BYTES)).toBeNull();
  });
  it("rejects other types, empty and oversized files", () => {
    expect(validateUpload("image/svg+xml", 10)).toMatch(/JPG/);
    expect(validateUpload("text/html", 10)).toMatch(/JPG/);
    expect(validateUpload("image/png", 0)).toMatch(/empty/);
    expect(validateUpload("image/png", MAX_UPLOAD_BYTES + 1)).toMatch(/8 MB/);
  });
  it("sniffs real image signatures", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
  it("builds safe keys that never include user filenames", () => {
    const k = buildObjectKey("product", "abc-123", "f00d", "image/png");
    expect(k).toBe("products/abc-123/f00d.png");
    expect(OBJECT_KEY_PATTERN.test(k)).toBe(true);
    expect(() => buildObjectKey("product", "../etc", "x", "image/png")).toThrow();
    expect(OBJECT_KEY_PATTERN.test("products/../x.png")).toBe(false);
  });
});

import { verifyUploadedObject } from "@/lib/media-rules";
describe("verifyUploadedObject", () => {
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  it("accepts a matching object", () => {
    expect(verifyUploadedObject({ size: 4, contentType: "image/jpeg" }, { size: 4, contentType: "image/jpeg" }, jpg)).toBeNull();
  });
  it("rejects missing, wrong size, wrong type and fake images", () => {
    expect(verifyUploadedObject({ size: 4, contentType: "image/jpeg" }, null, null)).toMatch(/did not reach/);
    expect(verifyUploadedObject({ size: 5, contentType: "image/jpeg" }, { size: 4, contentType: "image/jpeg" }, jpg)).toMatch(/size/);
    expect(verifyUploadedObject({ size: 4, contentType: "image/jpeg" }, { size: 4, contentType: "text/html" }, jpg)).toMatch(/type/);
    expect(verifyUploadedObject({ size: 4, contentType: "image/png" }, { size: 4, contentType: "image/png" }, jpg)).toMatch(/not a valid/);
  });
});
