/**
 * Staff must not see the owner's revenue on the console home.
 *
 * The blue "Revenue • This month" hero banner AND the two money tiles inside the
 * KPI grid both showed the owner's business-wide takings; staff hold
 * owner.analytics.view (they need the operational numbers) but NOT
 * owner.reports.view, so the money is gated on reports.
 *
 * Staff KEEP the operational tiles (Bookings today / Awaiting approval) — that's
 * the work they're there to do — so this asserts both directions.
 *
 * Self-seeding: the shared "Test Staff" fixture belongs to an owner with no
 * venues, whose home renders an empty state where no KPI would show anyway. This
 * seeds a staff under an owner who HAS venues, so a permission gate can't be
 * confused with a data condition.
 */
import { test, expect, type Browser, type Page } from '@playwright/test';

const APP = 'http://localhost:9000';
const API = 'http://localhost:9002';
const OWNER = { email: 'ccdfa3b7.walker@example.com', password: 'password123' }; // owns venues

async function tokenFor(creds: { email: string; password: string }): Promise<string> {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(creds),
  });
  const j = await res.json() as { data?: { accessToken?: string } };
  if (!j.data?.accessToken) throw new Error(`login failed for ${creds.email}`);
  return j.data.accessToken;
}

async function homeAs(browser: Browser, creds: { email: string; password: string }): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const token = await tokenFor(creds);
  await page.goto(APP);
  await page.evaluate((t) => {
    localStorage.setItem('pb-access-token', t);
    localStorage.setItem('pb-refresh-token', t);
    sessionStorage.setItem('pb-splash-seen', '1');
  }, token);
  await page.goto(APP);
  await page.waitForTimeout(2500);
  return page;
}

test.describe('Staff cannot see owner revenue on the console home', () => {
  test('staff: no revenue banner and no business-wide money tiles — but the operational tiles stay', async ({ browser }) => {
    const ownerTok = await tokenFor(OWNER);
    const sub = { email: `revenue-gate-${Date.now()}@test.com`, password: 'password123' };
    const created = await fetch(`${API}/api/v1/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerTok}` },
      body: JSON.stringify({ ...sub, displayName: 'Revenue Gate Staff' }),
    });
    const staffId = ((await created.json()) as { data?: { id?: string } }).data?.id;
    expect(created.status, 'staff sub-account created').toBeLessThan(300);

    try {
      const staff = await homeAs(browser, sub);

      // The owner home did render (so the assertions below mean something).
      await expect(staff.locator('.ohome-container')).toBeVisible({ timeout: 8000 });

      // Gone: the hero banner AND the whole "My revenue" KPI section.
      await expect(staff.locator('.ohome-revenue')).toHaveCount(0);
      await expect(staff.getByRole('heading', { name: 'My revenue' })).toHaveCount(0);
      await expect(staff.locator('.ohome-kpi-grid')).toHaveCount(0);
      await expect(staff.getByText('Revenue this month')).toHaveCount(0);
      await expect(staff.getByText('Revenue this week')).toHaveCount(0);

      // The work itself is untouched: the live approval queue (with its
      // Confirm/Decline actions) and the bookings list still render. Staff lose
      // the two counters, not the job.
      await expect(staff.getByRole('button', { name: 'Confirm' }).first()).toBeVisible({ timeout: 8000 });
      await expect(staff.getByRole('heading', { name: 'Awaiting approval' })).toBeVisible();
      await expect(staff.getByRole('heading', { name: 'Bookings' })).toBeVisible();

      // Per-booking prices survive — deliberately. Staff confirm/decline these, and
      // each venue's own takings are exactly what owner.analytics.view grants them.
      // Only the CROSS-VENUE headline is the owner's business, so "no ₱ at all"
      // would be the wrong assertion here.
      const homeText = await staff.locator('.ohome-container').innerText();
      expect(homeText, 'staff still price the bookings they action').toMatch(/₱/);
    } finally {
      if (staffId) {
        await fetch(`${API}/api/v1/staff/${staffId}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${ownerTok}` },
        });
      }
    }
  });

  test('owner: still sees the banner and the whole "My revenue" section', async ({ browser }) => {
    const owner = await homeAs(browser, OWNER);

    await expect(owner.locator('.ohome-revenue')).toBeVisible({ timeout: 8000 });
    await expect(owner.getByRole('heading', { name: 'My revenue' })).toBeVisible();
    await expect(owner.locator('.ohome-kpi-grid')).toHaveCount(1);
    await expect(owner.getByText('Revenue this month')).toBeVisible();
    await expect(owner.getByText('Revenue this week')).toBeVisible();
    await expect(owner.getByText('Bookings today').first()).toBeVisible();

    const homeText = await owner.locator('.ohome-container').innerText();
    expect(homeText, 'the owner still sees peso amounts').toMatch(/₱/);
  });
});
