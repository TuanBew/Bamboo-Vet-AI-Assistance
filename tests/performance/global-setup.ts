import { chromium, FullConfig } from '@playwright/test'
import path from 'path'
import fs from 'fs'

// Admin credentials must be supplied via environment variables.
// Create tests/.env.test.local (gitignored) with:
//   TEST_ADMIN_EMAIL=your-admin@email.com
//   TEST_ADMIN_PASSWORD=your-password
async function globalSetup(_config: FullConfig) {
  const email = process.env.TEST_ADMIN_EMAIL
  const password = process.env.TEST_ADMIN_PASSWORD

  if (!email || !password) {
    console.warn(
      '[global-setup] TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD not set. ' +
      'Skipping auth state creation. Authenticated E2E tests will fail.'
    )
    // Write empty storage state so Playwright does not error on missing file
    const authDir = path.join(process.cwd(), 'tests', '.auth')
    fs.mkdirSync(authDir, { recursive: true })
    const authPath = path.join(authDir, 'admin.json')
    if (!fs.existsSync(authPath)) {
      fs.writeFileSync(authPath, JSON.stringify({ cookies: [], origins: [] }))
    }
    return
  }

  const browser = await chromium.launch()
  const page = await browser.newPage()

  await page.goto('http://localhost:3001/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')

  // Wait for redirect to admin dashboard (admins are redirected from /app → /admin/dashboard)
  await page.waitForURL(/\/(admin\/dashboard|app)/, { timeout: 20_000 })

  const authDir = path.join(process.cwd(), 'tests', '.auth')
  fs.mkdirSync(authDir, { recursive: true })
  await page.context().storageState({ path: path.join(authDir, 'admin.json') })

  await browser.close()
}

export default globalSetup
