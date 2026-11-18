import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { serverEnv, r2Configured } from "@/lib/server-env";
import { OBJECT_KEY_PATTERN, type AllowedType } from "@/lib/media-rules";

let client: S3Client | undefined;

function s3(): S3Client {
  if (!r2Configured()) throw new Error("Image storage (Cloudflare R2) is not configured.");
  const r = serverEnv.r2;
  client ??= new S3Client({
    region: "auto",
    endpoint: r.endpoint || `https://${r.accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: Boolean(r.endpoint),
    credentials: { accessKeyId: r.accessKeyId, secretAccessKey: r.secretAccessKey },
  });
  return client;
}

function assertKey(key: string) {
  if (!OBJECT_KEY_PATTERN.test(key) || key.includes("..")) throw new Error("Invalid object key");
}

export const UPLOAD_URL_TTL = 300; // 5 minutes
export const DOWNLOAD_URL_TTL = 3600; // 1 hour

/** Presigned PUT bound to the exact content type and length. */
export async function presignUpload(key: string, contentType: AllowedType, size: number): Promise<string> {
  assertKey(key);
  return getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: serverEnv.r2.bucket, Key: key, ContentType: contentType, ContentLength: size }),
    { expiresIn: UPLOAD_URL_TTL, signableHeaders: new Set(["content-type", "content-length"]) },
  );
}

/** Signed GET; forces the stored, validated image content type so a file can never be served as HTML. */
export async function presignDownload(key: string, contentType?: AllowedType): Promise<string> {
  assertKey(key);
  const cmd = new GetObjectCommand({
    Bucket: serverEnv.r2.bucket,
    Key: key,
    ...(contentType ? { ResponseContentType: contentType, ResponseContentDisposition: "inline" } : {}),
  });
  return getSignedUrl(s3(), cmd, {
    expiresIn: DOWNLOAD_URL_TTL,
  });
}

export async function headObject(key: string): Promise<{ size: number; contentType: string | undefined } | null> {
  assertKey(key);
  try {
    const r = await s3().send(new HeadObjectCommand({ Bucket: serverEnv.r2.bucket, Key: key }));
    return { size: Number(r.ContentLength ?? 0), contentType: r.ContentType };
  } catch (e) {
    const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return null;
    throw e;
  }
}

/** First bytes of an object, for magic-number validation. */
export async function readObjectHead(key: string, bytes = 16): Promise<Uint8Array> {
  assertKey(key);
  const r = await s3().send(
    new GetObjectCommand({ Bucket: serverEnv.r2.bucket, Key: key, Range: `bytes=0-${bytes - 1}` }),
  );
  return r.Body ? new Uint8Array(await r.Body.transformToByteArray()) : new Uint8Array();
}

/** Full object bytes (used only for admin catalogue extraction, ≤ 8 MB). */
export async function readObject(key: string): Promise<Uint8Array> {
  assertKey(key);
  const r = await s3().send(new GetObjectCommand({ Bucket: serverEnv.r2.bucket, Key: key }));
  return r.Body ? new Uint8Array(await r.Body.transformToByteArray()) : new Uint8Array();
}

export async function deleteObjects(keys: string[]): Promise<void> {
  const valid = keys.filter((k) => OBJECT_KEY_PATTERN.test(k));
  for (let i = 0; i < valid.length; i += 1000) {
    await s3().send(
      new DeleteObjectsCommand({
        Bucket: serverEnv.r2.bucket,
        Delete: { Objects: valid.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }
}
