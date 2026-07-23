import { test, expect, type Page } from '@playwright/test';

const ADMIN = { email: 'info@eunika.agency', password: 'password123' };

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

async function loginAsAdmin(page: Page) {
  const res = await page.request.post('http://localhost:9002/api/v1/auth/login', { data: ADMIN });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()).data;
  await page.goto('/');
  await page.evaluate(({ a, r }) => {
    localStorage.setItem('pb-access-token', a);
    localStorage.setItem('pb-refresh-token', r);
    sessionStorage.setItem('pb-splash-seen', '1');
  }, { a: body.accessToken, r: body.refreshToken });
}

/** The "Directory" section header button in the desktop sidebar. */
const dirHeader = (page: Page) => page.locator('.sidebar .admin-section-header', { hasText: 'Directory' });
const playersItem = (page: Page) => page.locator('.sidebar .admin-item', { hasText: 'Players' });

test('a sidebar tab inside a dropdown keeps its dropdown open after reload', async ({ page }) => {
  await loginAsAdmin(page);
  await page.evaluate(() => localStorage.removeItem('pb-admin-sections'));

  await page.goto('/admin');
  await expect(dirHeader(page)).toBeVisible();

  // Fresh state: every section collapsed.
  await expect(dirHeader(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(playersItem(page)).toHaveCount(0);

  // Open the dropdown and click a tab inside it.
  await dirHeader(page).click();
  await expect(dirHeader(page)).toHaveAttribute('aria-expanded', 'true');
  await playersItem(page).click();
  await expect(page).toHaveURL(/\/admin\/users/);
  await expect(playersItem(page)).toHaveClass(/active/);

  // THE FIX: reload → the dropdown is still open, with the tab still active.
  await page.reload();
  await expect(dirHeader(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(playersItem(page)).toHaveClass(/active/);
});

test('a cold deep-link opens the section holding the active screen', async ({ page }) => {
  await loginAsAdmin(page);
  await page.evaluate(() => localStorage.removeItem('pb-admin-sections'));

  await page.goto('/admin/moderation/venue-approvals');
  const mod = page.locator('.sidebar .admin-section-header', { hasText: 'Moderation' });
  await expect(mod).toHaveAttribute('aria-expanded', 'true');
  // Sections that don't hold the active screen stay collapsed.
  await expect(dirHeader(page)).toHaveAttribute('aria-expanded', 'false');
});

test('an explicit collapse survives a reload too', async ({ page }) => {
  await loginAsAdmin(page);
  await page.evaluate(() => localStorage.removeItem('pb-admin-sections'));

  await page.goto('/admin/users');
  await expect(dirHeader(page)).toHaveAttribute('aria-expanded', 'true');

  await dirHeader(page).click(); // close it by hand while its tab is active
  await expect(dirHeader(page)).toHaveAttribute('aria-expanded', 'false');

  await page.reload();
  await expect(dirHeader(page)).toHaveAttribute('aria-expanded', 'false');
});

test.describe('mobile drawer', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the drawer remembers the same open section', async ({ page }) => {
    await loginAsAdmin(page);
    await page.evaluate(() => localStorage.removeItem('pb-admin-sections'));

    await page.goto('/admin/users');
    const fab = page.locator('.admin-drawer-fab');
    await expect(fab).toBeVisible();
    await fab.click();
    const dir = page.locator('.ad-section-header', { hasText: 'Directory' });
    await expect(dir).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.ad-section-header', { hasText: 'System' })).toHaveAttribute('aria-expanded', 'false');
  });
});
