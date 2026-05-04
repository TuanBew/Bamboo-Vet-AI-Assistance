import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

// Load .env.local so TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD are available to globalSetup
loadEnv({ path: '.env.local' })

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  globalSetup: './tests/performance/global-setup.ts',
  use: {
    baseURL: 'http://localhost:3001',
    headless: true,
    screenshot: 'only-on-failure',
    storageState: 'tests/.auth/admin.json',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- -p 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
