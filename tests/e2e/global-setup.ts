import { S3Client, CreateBucketCommand } from "@aws-sdk/client-s3";

/** When testing against a local S3-compatible server, make sure the bucket exists. No-op for real R2. */
export default async function globalSetup() {
  if (!process.env.R2_ENDPOINT) return;
  const s3 = new S3Client({
    region: "auto", endpoint: process.env.R2_ENDPOINT, forcePathStyle: true,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "", secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "" },
  });
  await s3.send(new CreateBucketCommand({ Bucket: process.env.R2_BUCKET! })).catch(() => undefined);
}
