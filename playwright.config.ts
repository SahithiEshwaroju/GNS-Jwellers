import { defineConfig, devices } from "@playwright/test";

/**
 * E2E against a production build (`next start`) using the real Supabase project.
 * Image storage points at a local S3-compatible server (moto) unless real R2 env vars are supplied:
 *   R2_ENDPOINT=http://127.0.0.1:5055 R2_ACCESS_KEY_ID=test R2_SECRET_ACCESS_KEY=test R2_BUCKET=gns-test R2_ACCOUNT_ID=local
 */
const PORT = 3100;
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "off", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testIgnore: /mobile\.spec/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec/ },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { NODE_USE_ENV_PROXY: "1", NODE_NO_WARNINGS: "1" },
  },
});
