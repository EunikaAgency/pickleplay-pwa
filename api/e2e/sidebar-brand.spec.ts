import { test, expect } from '@playwright/test';

const APP = 'http://localhost:9000';
const WEB = 'http://localhost:9001';
const SHOT = '/tmp/claude-1000/-var-public-pickleplay/31a34a87-4420-4313-83e9-bda97ee21ba2/scratchpad';

const ADMIN = { email: 'info@eunika.agency', password: 'password123' };

/** The app sidebar only activates at >=1024px. */
test('app sidebar shows the brand icon', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${APP}/nearby`);

  const sidebar = page.locator('.sidebar');
  await expect(sidebar).toBeVisible();

  const logo = sidebar.locator('.brand-mark img');
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('src', '/brand-icon.png');

  // The image must actually decode — a broken src still "renders" a 0-size box.
  const size = await logo.evaluate((el: HTMLImageElement) => ({
    w: el.naturalWidth,
    h: el.naturalHeight,
  }));
  expect(size.w).toBeGreaterThan(0);
  expect(size.h).toBeGreaterThan(0);

  await sidebar.screenshot({ path: `${SHOT}/app-sidebar.png` });
});

test('web sidebar shows the brand icon', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto(`${WEB}/login`);
  await page.locator('#login-email').fill(ADMIN.email);
  await page.locator('#login-password').fill(ADMIN.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });

  await page.goto(`${WEB}/dashboard`);
  const sidebar = page.locator('aside').first();
  await expect(sidebar).toBeVisible();

  const logo = sidebar.locator('img[src="/brand-icon.png"]');
  await expect(logo).toBeVisible();
  const size = await logo.evaluate((el: HTMLImageElement) => ({
    w: el.naturalWidth,
    h: el.naturalHeight,
  }));
  expect(size.w).toBeGreaterThan(0);

  await sidebar.screenshot({ path: `${SHOT}/web-sidebar.png` });
});
