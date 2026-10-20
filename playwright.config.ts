import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);

/**
 * End-to-end tests run against a production build (`pnpm build` first):
 * the service worker only registers in production.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.ts/ },
    { name: "iphone-webkit", use: { ...devices["iPhone 15"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: "node tests/e2e/server.mjs",
    url: `http://localhost:${port}/manifest.webmanifest`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: { E2E_PORT: String(port) },
  },
});
