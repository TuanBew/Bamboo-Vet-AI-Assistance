import { test, expect } from '@playwright/test'

// Target: local Docker Compose stack (http://localhost:8080 by default)
// Run: DOCKER_TEST_EMAIL=<admin-email> DOCKER_TEST_PASSWORD=<admin-password> \
//        npx playwright test --config=playwright.docker.config.ts
//
// Authenticated tests (DOK-09 to DOK-12) are skipped if credentials are not provided.
// DOK-12 (chat stream) additionally requires RAGflow to be running on host:9380.

const BASE_URL = process.env.DOCKER_TEST_URL ?? 'http://localhost:3000'
const email    = process.env.DOCKER_TEST_EMAIL    ?? ''
const password = process.env.DOCKER_TEST_PASSWORD ?? ''

// ─── Infrastructure ───────────────────────────────────────────────────────────

test('DOK-01: /api/health returns {"ok":true}', async ({ request }) => {
  const res = await request.get(`${BASE_URL}/api/health`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body).toMatchObject({ ok: true })
})

test('DOK-02: login page loads with email and password inputs', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.locator('input[type="email"], #email, input[name="email"]').first()).toBeVisible()
  await expect(page.locator('input[type="password"], #password, input[name="password"]').first()).toBeVisible()
})

// ─── Auth redirects ───────────────────────────────────────────────────────────

test('DOK-03: /admin/dashboard → /login when unauthenticated', async ({ page }) => {
  await page.goto('/admin/dashboard')
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })
})

test('DOK-04: /app → /login when unauthenticated', async ({ page }) => {
  await page.goto('/app')
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })
})

// ─── API protection ───────────────────────────────────────────────────────────

test('DOK-05: /api/admin/* returns 401 or 403 without auth', async ({ request }) => {
  const routes = [
    '/api/admin/dashboard',
    '/api/admin/nhap-hang',
    '/api/admin/ton-kho',
    '/api/admin/khach-hang',
  ]
  for (const route of routes) {
    const res = await request.get(`${BASE_URL}${route}`)
    expect([401, 403], `${route} should be protected`).toContain(res.status())
  }
})

test('DOK-06: /api/chat POST without auth is not a 500 (guest mode with rate limiting)', async ({ request }) => {
  // /api/chat allows unauthenticated guests — Upstash rate limiting applies instead of blocking.
  // Valid responses: 200 (guest stream), 429 (rate limited). Never 500.
  const res = await request.post(`${BASE_URL}/api/chat`, {
    data: { messages: [{ role: 'user', content: 'test' }] },
  })
  expect(res.status()).not.toBe(500)
  expect([200, 429, 401, 403]).toContain(res.status())
})

// ─── Docker-specific infrastructure ──────────────────────────────────────────

test('DOK-07: Next.js standalone serves static assets via Cloudflare Tunnel', async ({ page, request }) => {
  const response = await page.goto('/login')
  expect(response?.status()).toBe(200)

  // Verify at least one /_next/static/ asset from the rendered HTML returns 200
  const html = await page.content()
  const match = html.match(/\/_next\/static\/[^"'<>]+\.(js|css)/)
  if (match) {
    const staticRes = await request.get(`${BASE_URL}${match[0]}`)
    expect(staticRes.status(), `Static asset ${match[0]} should be served`).toBe(200)
  } else {
    // Fallback: if no static refs found, just verify the page loaded with content
    expect(html).toContain('/_next/')
  }
})

test('DOK-08: MCP server port 3100 is NOT accessible from host (container isolation)', async () => {
  // mcp-server must NOT have any host port binding — only reachable via Docker internal DNS
  let accessible = false
  try {
    const res = await fetch('http://localhost:3100/health', { signal: AbortSignal.timeout(2_500) })
    if (res.ok) accessible = true
  } catch {
    // Expected: ECONNREFUSED — port is not exposed to the host
  }
  expect(accessible, 'Port 3100 should not be exposed to host — mcp-server is Docker-internal only').toBe(false)
})

// ─── Authenticated tests ──────────────────────────────────────────────────────

test.describe('Authenticated tests', () => {
  test.skip(!email || !password, 'Set DOCKER_TEST_EMAIL and DOCKER_TEST_PASSWORD to run')

  let adminPage: import('@playwright/test').Page

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    adminPage = await context.newPage()

    await adminPage.goto('/login')
    await adminPage.locator('input[type="email"], #email, input[name="email"]').first().fill(email)
    await adminPage.locator('input[type="password"], #password, input[name="password"]').first().fill(password)
    await adminPage.locator('button[type="submit"]').click()
    await adminPage.waitForURL(/\/(admin\/dashboard|app)/, { timeout: 20_000 })
  })

  test('DOK-09: email/password login works on Docker stack', async () => {
    expect(adminPage.url()).toMatch(/\/(admin\/dashboard|app)/)
  })

  test('DOK-10: admin dashboard loads with sidebar after login', async () => {
    await adminPage.goto('/admin/dashboard')
    await expect(adminPage).toHaveURL(/\/admin\/dashboard/)
    await expect(adminPage.locator('nav, aside, [data-sidebar]').first()).toBeVisible({ timeout: 15_000 })
  })

  test('DOK-11: chat page loads with textarea input', async () => {
    await adminPage.goto('/chat')
    await expect(
      adminPage.locator('textarea, input[type="text"][placeholder*="chat"], input[type="text"][placeholder*="Nhập"]').first()
    ).toBeVisible({ timeout: 15_000 })
  })

  test('DOK-12: chat streams a response via Docker-internal MCP server', async () => {
    // Requires: RAGflow Docker container running on the host at port 9380
    // If RAGflow is not running, this test fails with a connection/stream error — expected.
    test.setTimeout(90_000)

    await adminPage.goto('/chat')
    const textarea = adminPage.locator('textarea').first()
    await textarea.fill('Xin chào')
    await textarea.press('Enter')

    // Wait for an assistant message bubble to appear with non-empty text
    const assistantText = adminPage.locator('div.justify-start p.whitespace-pre-wrap').first()
    await expect(assistantText).toBeVisible({ timeout: 60_000 })
    const text = await assistantText.textContent()
    expect(text?.trim().length ?? 0).toBeGreaterThan(0)
  })
})
