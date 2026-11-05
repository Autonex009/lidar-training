import path from "node:path";
import { defineConfig } from "@playwright/test";

/**
 * End-to-end acceptance tests (SPEC "Testing" T1-T10).
 * Starts its own `next dev` on a dedicated port against a throw-away SQLite file (prisma/e2e.db);
 * e2e/global-setup.ts migrates, generates assets, seeds and bootstraps admin + reviewer.
 */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3210);
export const BASE_URL = `http://localhost:${E2E_PORT}`;

// Env shared by the dev server, global setup and test workers (workers inherit process.env).
Object.assign(process.env, {
  DATABASE_URL: "file:./e2e.db",
  AUTH_SECRET: "e2e-secret-not-for-production-0123456789",
  AUTH_TRUST_HOST: "true",
  SETUP_TOKEN: "e2e-setup-token",
  ALLOWED_EMAIL_DOMAINS: "example.com",
  REGISTRATION_INVITE_CODE: "",
  DEFAULT_PROGRAM_SLUG: "foundations",
  LOGIN_RATE_LIMIT_PER_MIN: "1000",
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_DIST_DIR: ".next-e2e",
});
delete process.env.AUTH_URL;
delete process.env.NEXTAUTH_URL;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  globalSetup: path.resolve(__dirname, "e2e/global-setup.ts"),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1600, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 30_000,
    navigationTimeout: 90_000,
    launchOptions: { args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
  },
  webServer: {
    command: `npx next dev -p ${E2E_PORT}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
