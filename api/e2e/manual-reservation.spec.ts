/**
 * Manual Reservation screen — E2E verification.
 *
 * Covers the new owner "Manual reservation" screen and its two placements:
 *   - Desktop (>=1024px): a "Reservation" item in the Sidebar.
 *   - Mobile/tablet (<1024px): a "Manual reservation" row in the owner Profile tab.
 * And the core behaviour: saving a reservation creates a manual booking AND a
 * `note: 'Reserved'` slot override (the artifact the Pricing Override grid paints).
 *
 * Prereqs: API on :9002, PWA on :9000, seeded data.
 * Owner: 29d13b77.moreno@example.com / password123 (owns a venue).
 *
 * Each test creates its own context with an explicit viewport so the desktop
 * (sidebar) vs mobile/tablet (profile) chrome resolves correctly regardless of
 * the config's default device.
 */
import { test, expect, type Browser, type Page } from '@playwright/test';

const APP = 'http://localhost:9000';
const API = 'http://localhost:9002';
const OWNER = { email: 'ccdfa3b7.walker@example.com', password: 'password123' }; // owns venues with courts

async function ownerToken(): Promise<string> {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(OWNER),
  });
  const j = await res.json() as { data?: { accessToken?: string } };
  if (!j.data?.accessToken) throw new Error('owner login failed');
  return j.data.accessToken;
}

/** A signed-in owner page at the given viewport, with the launch splash suppressed. */
async function ownerPage(browser: Browser, width: number, height = 900): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const token = await ownerToken();
  await page.goto(APP);
  await page.evaluate((t) => {
    localStorage.setItem('pb-access-token', t);
    localStorage.setItem('pb-refresh-token', t);
    sessionStorage.setItem('pb-splash-seen', '1'); // suppress the once-per-session splash
  }, token);
  return page;
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

test.describe('Owner Manual Reservation', () => {
  test('T1: screen renders + Sidebar entry on desktop', async ({ browser }) => {
    const page = await ownerPage(browser, 1280);
    await page.goto(`${APP}/owner/manual-reservation`);
    await page.waitForTimeout(1500);

    await expect(page.getByText('Manual reservation').first()).toBeVisible({ timeout: 6000 });
    await expect(page.getByPlaceholder("Who's reserving?")).toBeVisible({ timeout: 4000 });
    await expect(page.locator('text=Could not load')).toHaveCount(0);

    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();
    // The label sits beside a Material-icon ligature span, so match by substring.
    await expect(sidebar.locator('.side-tab', { hasText: 'Reservation' })).toBeVisible();
    await page.context().close();
  });

  test('T2: Profile-tab entry on mobile + tablet, hidden on desktop', async ({ browser }) => {
    for (const width of [390, 820]) {
      const page = await ownerPage(browser, width);
      await page.goto(`${APP}/profile`);
      await page.waitForTimeout(1500);
      await expect(page.locator('.sidebar')).toBeHidden();
      await expect(page.getByText('Manual reservation').first()).toBeVisible({ timeout: 6000 });
      await page.context().close();
    }
    // Desktop: the row is hidden (lg:hidden) — the Sidebar carries it instead.
    // (lg:hidden sets display:none, so the node stays in the DOM → assert hidden.)
    const page = await ownerPage(browser, 1280);
    await page.goto(`${APP}/profile`);
    await page.waitForTimeout(1500);
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.getByText('Manual reservation').first()).toBeHidden();
    await page.context().close();
  });

  test('T3: saving fires booking + Reserved slot-override (the pricing-grid paint)', async ({ browser }) => {
    const page = await ownerPage(browser, 1280);

    const posts: { url: string; body: string }[] = [];
    page.on('request', (req) => {
      if (req.method() !== 'POST') return;
      const u = req.url();
      if (u.includes('/bookings') || u.includes('/slot-overrides')) posts.push({ url: u, body: req.postData() || '' });
    });

    await page.goto(`${APP}/owner/manual-reservation`);
    await page.waitForTimeout(1500);
    await expect(page.getByText('Manual reservation').first()).toBeVisible({ timeout: 6000 });

    // Far-future date → no seeded bookings there → conflict-free save.
    const target = new Date(); target.setDate(target.getDate() + 45);
    const targetYmd = ymd(target);
    const now = new Date();
    const monthsAhead = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());

    await page.locator('button.control', { hasText: ymd(now) }).first().click();
    for (let i = 0; i < monthsAhead; i++) {
      await page.getByRole('button', { name: 'Next month' }).click();
      await page.waitForTimeout(150);
    }
    await page.locator(`[aria-label="${targetYmd}"]`).first().click();
    await page.waitForTimeout(300);

    await page.getByPlaceholder("Who's reserving?").fill('E2E Reserve');
    await page.getByRole('button', { name: /Save reservation/i }).click();

    await expect(page.getByText('Reservation saved')).toBeVisible({ timeout: 8000 });

    const bookingPost = posts.find((p) => /\/venues\/[^/]+\/bookings$/.test(p.url));
    const overridePost = posts.find((p) => p.url.includes('/slot-overrides'));
    expect(bookingPost, 'a booking POST fired').toBeTruthy();
    expect(overridePost, 'a slot-override POST fired').toBeTruthy();
    expect(overridePost!.body).toContain('"note":"Reserved"');
    expect(overridePost!.body).toContain(targetYmd);

    // Server-side confirmation: the override is listable (what the pricing grid reads).
    const vref = overridePost!.url.match(/\/venues\/([^/]+)\/slot-overrides/)![1];
    const token = await ownerToken();
    const listRes = await fetch(`${API}/api/v1/venues/${vref}/slot-overrides?date=${targetYmd}`, { headers: { Authorization: `Bearer ${token}` } });
    const listJson = await listRes.json() as { data?: any[] } | any[];
    const list = Array.isArray(listJson) ? listJson : (listJson.data ?? []);
    const reserved = list.filter((o: any) => o.note === 'Reserved');
    expect(reserved.length).toBeGreaterThan(0);

    // Cleanup so we don't pollute the seed.
    for (const o of reserved) {
      await fetch(`${API}/api/v1/venues/slot-overrides/${o.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
    const bRes = await fetch(`${API}/api/v1/venues/${vref}/bookings?status=confirmed`, { headers: { Authorization: `Bearer ${token}` } });
    const bJson = await bRes.json() as any;
    const bList = Array.isArray(bJson) ? bJson : (bJson.data ?? []);
    for (const b of bList.filter((x: any) => x.date === targetYmd && x.customerName === 'E2E Reserve')) {
      await fetch(`${API}/api/v1/bookings/${b.id}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});
    }
    await page.context().close();
  });
});
