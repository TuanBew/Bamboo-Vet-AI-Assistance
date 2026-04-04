import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto('http://localhost:3000/login');
await page.waitForSelector('#email', { timeout: 10000 });
await page.fill('#email', 'admin@bamboovet.com');
await page.fill('#password', 'TestAdmin123!');
await page.click('button[type=submit]');
await page.waitForURL('**/admin/**', { timeout: 10000 });

console.log('Logged in, navigating to ton-kho...');

// Navigate to ton-kho
await page.goto('http://localhost:3000/admin/ton-kho', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(15000); // Wait for data to load

// Screenshot top section (KPIs + filter bar)
await page.screenshot({ path: 'ton-kho-top.png' });
console.log('Screenshot 1 (top) saved');

// Get page height
const height = await page.evaluate(() => {
  const m = document.getElementById('admin-main');
  return m ? m.scrollHeight : document.body.scrollHeight;
});
console.log('Page scroll height:', height);

// Scroll to see charts
await page.evaluate(() => {
  const m = document.getElementById('admin-main');
  if (m) m.scrollTop = 500;
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'ton-kho-charts.png' });
console.log('Screenshot 2 (charts) saved');

// Scroll to see data table
await page.evaluate(() => {
  const m = document.getElementById('admin-main');
  if (m) m.scrollTop = 1400;
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'ton-kho-table.png' });
console.log('Screenshot 3 (table) saved');

// Check for errors in console
const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

console.log('Console errors:', errors.length);

// Check KPI values are non-zero
const kpiTexts = await page.evaluate(() => {
  const kpis = document.querySelectorAll('[class*="text-3xl"], [class*="text-2xl"]');
  return Array.from(kpis).map(el => el.textContent?.trim()).filter(Boolean);
});
console.log('KPI values:', kpiTexts.slice(0, 6));

await browser.close();
console.log('Test complete!');
