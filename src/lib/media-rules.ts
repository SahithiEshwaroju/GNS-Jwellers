// Pure upload rules shared by the browser widget and the server (server is authoritative).
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export type AllowedType = keyof typeof ALLOWED_TYPES;

export type UploadPurpose = "product" | "site" | "extract";

export function isAllowedType(t: string): t is AllowedType {
  return Object.prototype.hasOwnProperty.call(ALLOWED_TYPES, t);
}

export function validateUpload(contentType: string, size: number): string | null {
  if (!isAllowedType(contentType)) return "Only JPG, PNG or WebP photos are allowed.";
  if (!Number.isInteger(size) || size <= 0) return "The file is empty.";
  if (size > MAX_UPLOAD_BYTES) return "Photos must be 8 MB or smaller.";
  return null;
}

/** Detects the real image type from the first bytes of the file. */
export function sniffImageType(bytes: Uint8Array): AllowedType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)
  )
    return "image/png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}

const SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;

/** Object keys never contain user-supplied names: <purpose>/<scope>/<random>.<ext>. */
export function buildObjectKey(purpose: UploadPurpose, scope: string, random: string, contentType: AllowedType): string {
  const dir = purpose === "product" ? "products" : purpose;
  if (!SEGMENT.test(scope) || !SEGMENT.test(random)) throw new Error("Invalid key segment");
  return `${dir}/${scope}/${random}.${ALLOWED_TYPES[contentType]}`;
}

export const OBJECT_KEY_PATTERN = /^(products|site|extract)\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*\.(jpg|png|webp)$/;

/** Server-side acceptance check after a direct upload. Returns an error message or null. */
export function verifyUploadedObject(
  expected: { size: number; contentType: string },
  head: { size: number; contentType: string | undefined } | null,
  firstBytes: Uint8Array | null,
): string | null {
  if (!head) return "The upload did not reach storage. Please try again.";
  if (head.size !== expected.size) return "The uploaded file size did not match.";
  if ((head.contentType ?? "").split(";")[0].trim().toLowerCase() !== expected.contentType)
    return "The uploaded file type did not match.";
  if (!firstBytes || sniffImageType(firstBytes) !== expected.contentType)
    return "That file is not a valid JPG, PNG or WebP image.";
  return null;
}
