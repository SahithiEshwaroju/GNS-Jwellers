import { describe, expect, it } from "vitest";
import { envChecks, explainR2Error, summarize } from "@/lib/diagnostics";

const good = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_abcdefghijklmnopqrstuvwxyz",
  NEXT_PUBLIC_SITE_URL: "https://shop.example.com",
  R2_ACCOUNT_ID: "0123456789abcdef0123456789abcdef", R2_ACCESS_KEY_ID: "AKIAEXAMPLEKEY123", R2_SECRET_ACCESS_KEY: "supersecretvalue", R2_BUCKET: "gns-media",
  GEMINI_API_KEY: "g-key", NODE_ENV: "production",
};
const origin = { host: "shop.example.com", https: true };
const find = (c: ReturnType<typeof envChecks>, label: string) => c.find((x) => x.label === label)!;

describe("envChecks", () => {
  it("passes a correct configuration", () => {
    const c = envChecks(good, origin);
    expect(summarize(c).fail).toBe(0);
    expect(summarize(c).warn).toBe(0);
  });
  it("never reveals secret values, only presence and length", () => {
    const text = JSON.stringify(envChecks(good, origin));
    for (const secret of ["supersecretvalue", "AKIAEXAMPLEKEY123", "g-key", good.NEXT_PUBLIC_SUPABASE_ANON_KEY]) expect(text).not.toContain(secret);
  });
  it("flags missing variables with a fix", () => {
    const c = envChecks({ NEXT_PUBLIC_SUPABASE_URL: good.NEXT_PUBLIC_SUPABASE_URL }, origin);
    expect(find(c, "R2_SECRET_ACCESS_KEY").status).toBe("fail");
    expect(find(c, "NEXT_PUBLIC_SITE_URL").fix).toBeTruthy();
    expect(find(c, "GEMINI_API_KEY").status).toBe("info"); // optional
  });
  it("fails loudly if a SECRET key is placed in the public variable", () => {
    expect(find(envChecks({ ...good, NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_secret_abc123" }, origin), "NEXT_PUBLIC_SUPABASE_ANON_KEY").status).toBe("fail");
    const jwt = "eyJhbGciOiJIUzI1NiJ9." + Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url") + ".sig";
    expect(find(envChecks({ ...good, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt }, origin), "NEXT_PUBLIC_SUPABASE_ANON_KEY").status).toBe("fail");
    const anon = "eyJhbGciOiJIUzI1NiJ9." + Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url") + ".sig";
    expect(find(envChecks({ ...good, NEXT_PUBLIC_SUPABASE_ANON_KEY: anon }, origin), "NEXT_PUBLIC_SUPABASE_ANON_KEY").status).toBe("ok");
  });
  it("checks the site URL: https, no trailing slash, matches the visited host", () => {
    expect(find(envChecks({ ...good, NEXT_PUBLIC_SITE_URL: "http://shop.example.com" }, origin), "NEXT_PUBLIC_SITE_URL").status).toBe("fail");
    expect(find(envChecks({ ...good, NEXT_PUBLIC_SITE_URL: "https://shop.example.com/" }, origin), "NEXT_PUBLIC_SITE_URL").status).toBe("warn");
    expect(find(envChecks(good, { host: "other.netlify.app", https: true }), "NEXT_PUBLIC_SITE_URL").status).toBe("warn");
  });
  it("warns about R2_ENDPOINT and a malformed account id", () => {
    expect(find(envChecks({ ...good, R2_ENDPOINT: "http://127.0.0.1:5055" }, origin), "R2_ENDPOINT").status).toBe("warn");
    expect(find(envChecks({ ...good, R2_ACCOUNT_ID: "not-an-id" }, origin), "R2_ACCOUNT_ID").status).toBe("warn");
  });
});

describe("explainR2Error", () => {
  it("translates common storage errors into causes and fixes", () => {
    expect(explainR2Error({ name: "InvalidAccessKeyId" }).fix).toMatch(/R2_ACCESS_KEY_ID/);
    expect(explainR2Error({ name: "SignatureDoesNotMatch" }).fix).toMatch(/R2_SECRET_ACCESS_KEY/);
    expect(explainR2Error({ name: "NoSuchBucket", $metadata: { httpStatusCode: 404 } }).fix).toMatch(/R2_BUCKET/);
    expect(explainR2Error({ name: "AccessDenied", $metadata: { httpStatusCode: 403 } }).fix).toMatch(/Object Read & Write/);
    expect(explainR2Error({ name: "Error", message: "getaddrinfo ENOTFOUND x.r2.cloudflarestorage.com" }).fix).toMatch(/R2_ACCOUNT_ID/);
  });
});
