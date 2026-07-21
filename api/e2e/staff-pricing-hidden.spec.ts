/**
 * Staff pricing access: default-hidden, owner-grantable.
 *
 * Pricing sets the rates players are charged — the owner's business. The staff
 * role does NOT hold `owner.pricing.manage` by default, so the Pricing screen,
 * sidebar entry, and slot-override endpoints are all gated away.
 *
 * NEW: An owner can now GRANT pricing (and other owner.* permissions) to a
 * specific staff sub-account via `PATCH /staff/:id { grantedPermissions: [...] }`.
 * The granted permissions are unioned into the staff member's effective set at
 * their next login. This file tests BOTH the default-gated AND post-grant states.
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

  // ── Grant flow ──────────────────────────────────────────────────────────
  // An owner grants pricing to a staff sub-account. After re-login the staff
  // can see Pricing. Without the grant, slot-override endpoints 403 for staff.

  test('T6: after owner grants pricing, staff can see Pricing sidebar + grid', async ({ browser }) => {
    const ownerTok = await tokenFor(OWNER);
    const sub = { email: `pricing-grant-${Date.now()}@test.com`, password: 'password123' };

    // Create a staff sub-account.
    const created = await fetch(`${API}/api/v1/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerTok}` },
      body: JSON.stringify({ ...sub, displayName: 'Pricing Granted Staff' }),
    });
    const staffId = ((await created.json()) as { data?: { id?: string } }).data?.id;
    expect(created.ok, 'staff created').toBeTruthy();

    try {
      // Grant pricing to the staff member.
      const patched = await fetch(`${API}/api/v1/staff/${staffId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerTok}` },
        body: JSON.stringify({ grantedPermissions: ['owner.pricing.manage'] }),
      });
      expect(patched.ok, 'grant persisted').toBeTruthy();
      const body = (await patched.json()) as { data?: { grantedPermissions?: string[] } };
      expect(body.data?.grantedPermissions).toContain('owner.pricing.manage');

      // Staff logs in AFTER the grant → JWT carries the new permission.
      const staff = await pageAs(browser, sub);
      await staff.goto(APP);
      await staff.waitForTimeout(1500);
      await expect(staff.locator('.sidebar')).toBeVisible({ timeout: 6000 });

      // The sidebar now HAS Pricing (was absent before the grant).
      await expect(sidebarPricing(staff)).toBeVisible({ timeout: 6000 });

      // The grid itself renders.
      await staff.goto(`${APP}/owner/pricing`);
      await staff.waitForTimeout(2000);
      await expect(staff.getByText('Pricing Override')).toBeVisible({ timeout: 8000 });
    } finally {
      if (staffId) {
        await fetch(`${API}/api/v1/staff/${staffId}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${ownerTok}` },
        });
      }
    }
  });

  test('T7: slot-override backend enforces pricing permission for staff', async () => {
    const ownerTok = await tokenFor(OWNER);
    const sub = { email: `slot-gate-${Date.now()}@test.com`, password: 'password123' };

    const created = await fetch(`${API}/api/v1/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerTok}` },
      body: JSON.stringify({ ...sub, displayName: 'Slot Gate Staff' }),
    });
    const staffId = ((await created.json()) as { data?: { id?: string } }).data?.id;
    expect(created.ok, 'staff created').toBeTruthy();

    try {
      // Login as the new staff (no pricing grant yet).
      const staffLogin = await fetch(`${API}/api/v1/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      });
      const staffTok = ((await staffLogin.json()) as { data?: { accessToken?: string } }).data?.accessToken!;

      // Staff must also be venue staff on at least one venue to reach the endpoint
      // (requireVenueManager). Add them to the owner's first venue.
      const venues = await fetch(`${API}/api/v1/venues?ownerUserId=&pageSize=1`, {
        headers: { Authorization: `Bearer ${ownerTok}` },
      });
      const venueId = ((await venues.json()) as { data?: Array<{ id: string }> }).data?.[0]?.id;
      expect(venueId, 'owner has a venue').toBeTruthy();

      await fetch(`${API}/api/v1/venues/${venueId}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerTok}` },
        body: JSON.stringify({ userId: staffId, staffRole: 'manager' }),
      });

      const slot = { date: '2099-12-25', startTime: '10:00', endTime: '11:00', price: 500 };

      // Without pricing grant → 403.
      const denied = await fetch(`${API}/api/v1/venues/${venueId}/slot-overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffTok}` },
        body: JSON.stringify(slot),
      });
      expect(denied.status, 'staff w/o pricing = 403').toBe(403);

      // Grant pricing permission.
      await fetch(`${API}/api/v1/staff/${staffId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerTok}` },
        body: JSON.stringify({ grantedPermissions: ['owner.pricing.manage'] }),
      });

      // Staff re-logs in → fresh token with the granted permission.
      const relogin = await fetch(`${API}/api/v1/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      });
      const newTok = ((await relogin.json()) as { data?: { accessToken?: string } }).data?.accessToken!;

      // With pricing grant → 201.
      const allowed = await fetch(`${API}/api/v1/venues/${venueId}/slot-overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${newTok}` },
        body: JSON.stringify(slot),
      });
      expect(allowed.status, 'staff w/ pricing = 201').toBe(201);

      // Clean up the override.
      const createdSlot = ((await allowed.json()) as { data?: { id?: string } }).data?.id;
      if (createdSlot) {
        await fetch(`${API}/api/v1/venues/slot-overrides/${createdSlot}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${ownerTok}` },
        });
      }

      // Remove staff from venue.
      const staffRows = await fetch(`${API}/api/v1/venues/${venueId}/staff`, {
        headers: { Authorization: `Bearer ${ownerTok}` },
      });
      const vStaff = ((await staffRows.json()) as { data?: Array<{ id: string }> }).data ?? [];
      const row = vStaff.find((r: any) => r.userId === staffId);
      if (row) {
        await fetch(`${API}/api/v1/venues/staff/${row.id}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${ownerTok}` },
        });
      }
    } finally {
      if (staffId) {
        await fetch(`${API}/api/v1/staff/${staffId}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${ownerTok}` },
        });
      }
    }
  });
});
