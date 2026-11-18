import "server-only";

// Server-only secrets. Never import this file from a Client Component.
export const serverEnv = {
  r2: {
    accountId: process.env.R2_ACCOUNT_ID ?? "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    bucket: process.env.R2_BUCKET ?? "",
    // Optional override, e.g. a local S3-compatible server for tests. Defaults to the R2 endpoint.
    endpoint: process.env.R2_ENDPOINT ?? "",
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  },
};

export function r2Configured(): boolean {
  const r = serverEnv.r2;
  return Boolean(r.accessKeyId && r.secretAccessKey && r.bucket && (r.accountId || r.endpoint));
}

export function geminiConfigured(): boolean {
  return Boolean(serverEnv.gemini.apiKey);
}
