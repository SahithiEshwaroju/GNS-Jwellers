import type { NextConfig } from "next";

// Content-Security-Policy. Next.js bootstraps with inline scripts, so script-src keeps 'unsafe-inline' (no nonces);
// the policy's main value is restricting where the page can load from / send data to, and blocking framing,
// <object>, <base> hijacking and off-site form posts. Allowed external hosts: Supabase (API/auth) and R2 (signed image URLs / direct uploads).
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();
const r2Origins = ["https://*.r2.cloudflarestorage.com", process.env.R2_ENDPOINT ?? ""].filter(Boolean);
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${r2Origins.join(" ")}`,
  "font-src 'self' data:",
  `connect-src 'self' ${[supabaseOrigin, ...r2Origins].filter(Boolean).join(" ")}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // D-006: classic dynamic rendering; nearly every page reads Supabase auth cookies.
  cacheComponents: false,
  poweredByHeader: false,
  // Backup restore sends the website data (text only; photos go straight to storage) in one action call.
  // Netlify functions cap requests near 6 MB, so 5 MB is the practical ceiling.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Content-Security-Policy", value: csp },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
