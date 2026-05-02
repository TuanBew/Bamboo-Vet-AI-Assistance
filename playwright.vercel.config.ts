import { defineConfig, devices } from '@playwright/test'

// Dedicated Playwright config for verifying the live Vercel deployment.
// Run with: npx playwright test --config=playwright.vercel.config.ts
// Requires: VERCEL_TEST_EMAIL and VERCEL_TEST_PASSWORD env vars (admin account)
export default defineConfig({
  testDir: './tests/vercel',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'https://bamboo-vet-ai.vercel.app',
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // No webServer — tests run against the already-deployed Vercel URL
})
