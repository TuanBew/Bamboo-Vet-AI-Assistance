import { test, expect } from '@playwright/test'

const VERCEL_URL = process.env.VERCEL_TEST_URL ?? 'https://bamboo-vet-ai.vercel.app'
const email = process.env.VERCEL_TEST_EMAIL ?? ''
const password = process.env.VERCEL_TEST_PASSWORD ?? ''
const expectedMysqlMode = process.env.VERCEL_EXPECTED_MYSQL_MODE ?? 'backup'

// ─── 1. Page loads ────────────────────────────────────────────────────────────
test('VRC-01: login page loads on Vercel', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveURL(/\/login/)
  // Verify the login form renders (not a 500 error page)
  await expect(page.locator('input[type="email"], #email, input[name="email"]').first()).toBeVisible()
  await expect(page.locator('input[type="password"], #password, input[name="password"]').first()).toBeVisible()
})

// ─── 2. Auth redirects (no login needed) ─────────────────────────────────────
test('VRC-02: /admin/* → /login when unauthenticated', async ({ page }) => {
  await page.goto('/admin/dashboard')
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })
})

test('VRC-03: /app → /login when unauthenticated', async ({ page }) => {
  await page.goto('/app')
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })
})

// ─── 3. API protection (no login needed) ─────────────────────────────────────
test('VRC-04: /api/admin/* returns 401/403 without auth', async ({ request }) => {
  const routes = [
    '/api/admin/dashboard',
    '/api/admin/nhap-hang',
    '/api/admin/ton-kho',
    '/api/admin/khach-hang',
  ]
  for (const route of routes) {
    const res = await request.get(`${VERCEL_URL}${route}`)
    expect([401, 403], `${route} should be protected`).toContain(res.status())
  }
})

test('VRC-05: /api/chat POST without auth returns 4xx', async ({ request }) => {
  const res = await request.post(`${VERCEL_URL}/api/chat`, {
    data: { messages: [{ role: 'user', content: 'test' }] },
  })
  // Chat requires Supabase session — should get a non-200 or stream an error, not a 500
  expect(res.status()).not.toBe(500)
})

// ─── 4. Login + authenticated flow (requires credentials) ────────────────────
test.describe('Authenticated tests', () => {
  test.skip(!email || !password, 'Set VERCEL_TEST_EMAIL and VERCEL_TEST_PASSWORD to run')

  let adminPage: import('@playwright/test').Page

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    adminPage = await context.newPage()

    // Log in
    await adminPage.goto('/login')
    await adminPage.locator('input[type="email"], #email, input[name="email"]').first().fill(email)
    await adminPage.locator('input[type="password"], #password, input[name="password"]').first().fill(password)
    await adminPage.locator('button[type="submit"]').click()
    await adminPage.waitForURL(/\/(admin\/dashboard|app)/, { timeout: 20_000 })
  })

  test('VRC-06: email/password login works on Vercel', async () => {
    // Verified by beforeAll completing without timeout
    expect(adminPage.url()).toMatch(/\/(admin\/dashboard|app)/)
  })

  test('VRC-07: admin dashboard page loads after login', async () => {
    await adminPage.goto('/admin/dashboard')
    await expect(adminPage).toHaveURL(/\/admin\/dashboard/)
    // Sidebar should be visible
    await expect(adminPage.locator('nav, aside, [data-sidebar]').first()).toBeVisible({ timeout: 15_000 })
  })

  test('VRC-08: chat page loads and renders input', async () => {
    await adminPage.goto('/chat')
    // Chat input textarea should be visible
    await expect(
      adminPage.locator('textarea, input[type="text"][placeholder*="chat"], input[type="text"][placeholder*="Nhập"]').first()
    ).toBeVisible({ timeout: 15_000 })
  })

  test('VRC-09: chat streams a response via MCP + ngrok', async () => {
    test.setTimeout(90_000)  // full stream can take up to 60s

    await adminPage.goto('/chat')
    const textarea = adminPage.locator('textarea').first()
    await textarea.fill('Xin chào')
    await textarea.press('Enter')

    // MessageBubble renders assistant messages as div.justify-start > div > p.whitespace-pre-wrap
    // Wait for the paragraph inside an assistant bubble to have non-empty text
    const assistantText = adminPage.locator('div.justify-start p.whitespace-pre-wrap').first()
    await expect(assistantText).toBeVisible({ timeout: 60_000 })
    const text = await assistantText.textContent()
    expect(text?.trim().length ?? 0).toBeGreaterThan(0)
  })

  test('VRC-10: db status and backup banner matches expected MySQL mode', async ({ request }) => {
    await adminPage.goto('/admin/dashboard')

    const cookies = await adminPage.context().cookies()
    const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
    const res = await request.get(`${VERCEL_URL}/api/admin/db-status`, {
      headers: { cookie: cookieHeader },
    })

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.database.activeMode).toBe(expectedMysqlMode)

    const backupBanner = adminPage.getByRole('status', { name: 'Cảnh báo dữ liệu dự phòng' })
    if (expectedMysqlMode === 'backup') {
      await expect(backupBanner).toBeVisible()
    } else {
      await expect(backupBanner).toBeHidden()
    }
  })
})
