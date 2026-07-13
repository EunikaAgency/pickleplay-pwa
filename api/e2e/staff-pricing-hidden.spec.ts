/**
 * Staff must not see the Pricing Override screen (/owner/pricing).
 *
 * Pricing sets the rates players are charged — the owner's business, not the
 * delegated sub-account's. The screen + every entry point into it are gated by
 * `owner.pricing.manage`, which the owner role holds and the staff role does not
 * (same reasoning as /owner/reports and `owner.reports.view`).
 *
 * The gate must hold for BOTH the nav affordances and a hand-typed URL.
 *
 * Prereqs: API on :9002, PWA on :9000, seeded data.
 */
import { test, expect, type Browser, type Page } from '@playwright/test';

const APP = 'http://localhost:9000';
const API = 'http://localhost:9002';

const STAFF = { email: 'stafftest@test.com', password: 'password123' };
const OWNER = { email: 'ccdfa3b7.walker@example.com', password: 'password123' };

async function tokenFor(creds: { email: string; password: string }): Promise<string> {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(creds),
  });
  const j = await res.json() as { data?: { accessToken?: string } };
  if (!j.data?.accessToken) throw new Error(`login failed for ${creds.email}`);
  return j.data.accessToken;
}

/** A signed-in page at the given viewport, with the launch splash suppressed. */
async function pageAs(browser: Browser, creds: { email: string; password: string }, width = 1280): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  const token = await tokenFor(creds);
  await page.goto(APP);
  await page.evaluate((t) => {
    localStorage.setItem('pb-access-token', t);
    localStorage.setItem('pb-refresh-token', t);
    sessionStorage.setItem('pb-splash-seen', '1');
  }, token);
  return page;
}

const sidebarPricing = (page: Page) => page.locator('.sidebar').getByText('Pricing', { exact: true });

test.describe('Staff cannot reach /owner/pricing', () => {
  test('T1: no Pricing item in the staff sidebar (but the owner has one)', async ({ browser }) => {
    const staff = await pageAs(browser, STAFF);
    await staff.goto(APP);
    await staff.waitForTimeout(1500);
    await expect(staff.locator('.sidebar')).toBeVisible({ timeout: 6000 });
    await expect(sidebarPricing(staff)).toHaveCount(0);

    // Control: the same sidebar DOES show Pricing for an owner, so T1 isn't
    // passing just because the sidebar failed to render.
    const owner = await pageAs(browser, OWNER);
    await owner.goto(APP);
    await owner.waitForTimeout(1500);
    await expect(sidebarPricing(owner)).toBeVisible({ timeout: 6000 });
  });

  test('T2: a hand-typed /owner/pricing URL does not render the grid for staff', async ({ browser }) => {
    const staff = await pageAs(browser, STAFF);
    await staff.goto(`${APP}/owner/pricing`);
    await staff.waitForTimeout(2000);

    // The screen's own furniture must be absent.
    await expect(staff.getByText('Pricing Override')).toHaveCount(0);
    await expect(staff.getByText('Paint time blocks with pricing rules')).toHaveCount(0);
    await expect(staff.getByText('Save Schedule')).toHaveCount(0);
    await expect(staff.locator('.owner-pricing-screen')).toHaveCount(0);
  });

  test('T3: the owner still gets the grid (no regression)', async ({ browser }) => {
    const owner = await pageAs(browser, OWNER);
    await owner.goto(`${APP}/owner/pricing`);
    await owner.waitForTimeout(2000);

    await expect(owner.getByText('Pricing Override')).toBeVisible({ timeout: 6000 });
    await expect(owner.locator('.owner-pricing-screen')).toBeVisible();
  });

  test('T4: the Pricing entry point on the staff ops map is gone', async ({ browser }) => {
    const staff = await pageAs(browser, STAFF);
    await staff.goto(`${APP}/nearby`);
    await staff.waitForTimeout(2000);
    await expect(staff.getByRole('button', { name: /Manage venues pricing/i })).toHaveCount(0);

    const owner = await pageAs(browser, OWNER);
    await owner.goto(`${APP}/nearby`);
    await owner.waitForTimeout(2000);
    await expect(owner.getByRole('button', { name: /Manage venues pricing/i })).toBeVisible({ timeout: 6000 });
  });

  // The seeded STAFF above belongs to an owner with no venues, so its Manual
  // Reservation screen renders an empty state rather than the form — useless for
  // proving staff *keep* that screen. So seed a staff under an owner who does own
  // venues, and tear it down afterwards.
  test('T5: staff keep the screens that ARE theirs (manual reservation), minus the Pricing shortcut', async ({ browser }) => {
    const ownerTok = await tokenFor(OWNER);
    const sub = { email: `pricing-gate-${Date.now()}@test.com`, password: 'password123' };
    const created = await fetch(`${API}/api/v1/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerTok}` },
      body: JSON.stringify({ ...sub, displayName: 'Pricing Gate Staff' }),
    });
    const staffId = ((await created.json()) as { data?: { id?: string } }).data?.id;
    expect(created.status, 'staff sub-account created').toBeLessThan(300);

    try {
      const staff = await pageAs(browser, sub);
      await staff.goto(`${APP}/owner/manual-reservation`);
      await staff.waitForTimeout(2500);

      // Access retained: the form renders (this staff's owner has venues + courts).
      await expect(staff.getByPlaceholder("Who's reserving?")).toBeVisible({ timeout: 8000 });
      // ...but the "Pricing grid" shortcut inside it is gated away.
      await expect(staff.getByRole('button', { name: 'Pricing grid' })).toHaveCount(0);

      // And the grid itself stays shut even for a staff whose org has venues.
      await staff.goto(`${APP}/owner/pricing`);
      await staff.waitForTimeout(2000);
      await expect(staff.getByText('Pricing Override')).toHaveCount(0);
    } finally {
      if (staffId) {
        await fetch(`${API}/api/v1/staff/${staffId}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${ownerTok}` },
        });
      }
    }
  });
});
