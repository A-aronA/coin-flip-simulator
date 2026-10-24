import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  workers: 2,
  timeout: 30000,
  expect: { timeout: 7000 },
  use: { ...devices["Desktop Chrome"], trace: "retain-on-failure" },
  reporter: "list",
  webServer: [
    {
      command: "npm run dev -- --port 5173 --strictPort",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev -- --port 5174 --strictPort",
      url: "http://127.0.0.1:5174",
      env: {
        VITE_AD_PROVIDER: "mock",
        VITE_ENABLE_DEV_ADS: "true",
        VITE_REWARD_COOLDOWN_MS: "0",
      },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run preview -- --port 4173 --strictPort",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    {
      name: "chromium-game",
      testMatch: "game.spec.ts",
      use: { baseURL: "http://127.0.0.1:5173" },
    },
    {
      name: "chromium-development-ads",
      testMatch: "mock.spec.ts",
      use: { baseURL: "http://127.0.0.1:5174", reducedMotion: "reduce" },
    },
    {
      name: "chromium-production",
      testMatch: "production.spec.ts",
      use: { baseURL: "http://127.0.0.1:4173", reducedMotion: "reduce" },
    },
  ],
});
