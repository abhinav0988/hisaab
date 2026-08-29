import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
  webServer: [
    {
      command:
        "XDG_CONFIG_HOME=/tmp/hisaab-e2e-wrangler BETTER_AUTH_SECRET=e2e-secret-with-at-least-thirty-two-characters RATE_LIMIT_SECRET=e2e-rate-limit-secret-with-at-least-thirty-two-chars pnpm --filter @hisaab/auth db:migrate:local && XDG_CONFIG_HOME=/tmp/hisaab-e2e-wrangler pnpm --filter @hisaab/auth db:seed:local && XDG_CONFIG_HOME=/tmp/hisaab-e2e-wrangler BETTER_AUTH_SECRET=e2e-secret-with-at-least-thirty-two-characters RATE_LIMIT_SECRET=e2e-rate-limit-secret-with-at-least-thirty-two-chars pnpm --filter @hisaab/gateway dev -- --var E2E_DISABLE_RATE_LIMIT:1",
      url: "http://localhost:8787/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "PLAYWRIGHT=1 NEXT_PUBLIC_API_URL=http://localhost:8787 pnpm --filter @hisaab/web dev",
      url: "http://localhost:3000/login",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
