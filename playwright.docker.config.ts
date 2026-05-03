import { defineConfig, devices } from '@playwright/test'

// Playwright config for verifying the local Docker Compose stack.
// Run with: npx playwright test --config=playwright.docker.config.ts
// Requires: Docker stack running via docker-compose.yml + docker-compose.local.yml
// Optional: DOCKER_TEST_EMAIL and DOCKER_TEST_PASSWORD for authenticated tests
export default defineConfig({
  testDir: './tests/production',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.DOCKER_TEST_URL ?? 'http://localhost:8080',
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // No webServer — tests run against the already-running Docker stack
})
