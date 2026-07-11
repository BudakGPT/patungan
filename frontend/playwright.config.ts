import { defineConfig, devices } from "@playwright/test";

/**
 * Wallet-free E2E over a production build. The public surfaces (landing, seasons, results,
 * campaign detail, 404) render their chrome without a wallet or live chain data, so these specs
 * assert navigation, localized copy, and the 404 route — not RPC-backed figures. The webServer
 * builds then serves; CI reuses the same command.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  // The heavy landing/detail pages paint slowly against a just-booted server under parallel load;
  // 5s (the default) is too tight for the first requests.
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile",
      // 390px — the iPhone-class breakpoint the design is tuned for.
      use: { ...devices["Pixel 5"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
