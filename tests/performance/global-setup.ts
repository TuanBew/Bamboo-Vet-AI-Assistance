import { chromium, FullConfig } from '@playwright/test'
import path from 'path'
import fs from 'fs'

export default async function globalSetup(_config: FullConfig) {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email) {
    throw new Error(
      '[global-setup] Missing required environment variable: ADMIN_EMAIL'
    )
  }
  if (!password) {
    throw new Error(
      '[global-setup] Missing required environment variable: ADMIN_PASSWORD'
    )
  }

  const storageStatePath = path.join(process.cwd(), 'tests', '.auth', 'admin.json')

  // Ensure the directory exists before writing
  fs.mkdirSync(path.dirname(storageStatePath), { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Navigate to the login page
    await page.goto('http://localhost:3000/login')

    // Fill in credentials using the form's input IDs
    await page.fill('#email', email)
    await page.fill('#password', password)

    // Submit the form
    await page.click('button[type="submit"]')

    // After login, the app redirects to /app which middleware forwards to /admin/dashboard
    await page.waitForURL('**/admin/dashboard', { timeout: 30_000 })

    // Persist authentication state for reuse across tests
    await context.storageState({ path: storageStatePath })

    console.log(`[global-setup] Auth state saved to ${storageStatePath}`)
  } finally {
    await browser.close()
  }
}
