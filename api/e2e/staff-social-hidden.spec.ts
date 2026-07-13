/**
 * Staff must not see the Social tab (/social).
 *
 * Social (Clubs + Friends) is a PUBLIC surface — guests browse it holding no
 * permissions — so unlike /owner/pricing it cannot be gated on a permission
 * without taking it from guests and players too. It's gated on the ROLE instead,
 * exactly like the Tournament tab. Owners keep it; only staff lose it.
 *
 * The gate must hold for the nav (desktop sidebar + mobile tab bar) AND for a
 * hand-typed URL — including the /clubs and /friends aliases, which resolve to
 * the same screen and would otherwise be a hole.
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

test.describe('Staff cannot reach the Social tab', () => {
  test('T1: no Social item in the staff sidebar (but the owner has one)', async ({ browser }) => {
    const staff = await pageAs(browser, STAFF);
    await staff.goto(APP);
    await staff.waitForTimeout(2000);
    await expect(staff.locator('.sidebar')).toBeVisible({ timeout: 6000 });
    await expect(staff.locator('.sidebar').getByText('Social', { exact: true })).toHaveCount(0);

    // Control: the same sidebar DOES show Social for an owner.
    const owner = await pageAs(browser, OWNER);
    await owner.goto(APP);
    await owner.waitForTimeout(2000);
    await expect(owner.locator('.sidebar').getByText('Social', { exact: true })).toBeVisible({ timeout: 6000 });
  });

  test('T2: no Social item in the staff mobile tab bar', async ({ browser }) => {
    const staff = await pageAs(browser, STAFF, 390);
    await staff.goto(APP);
    await staff.waitForTimeout(2000);
    await expect(staff.locator('.tabbar')).toBeVisible({ timeout: 6000 });
    await expect(staff.locator('.tabbar').getByText('Social', { exact: true })).toHaveCount(0);

    const owner = await pageAs(browser, OWNER, 390);
    await owner.goto(APP);
    await owner.waitForTimeout(2000);
    await expect(owner.locator('.tabbar').getByText('Social', { exact: true })).toBeVisible({ timeout: 6000 });
  });

  test('T3: hand-typed /social, /clubs and /friends all refuse for staff', async ({ browser }) => {
    const staff = await pageAs(browser, STAFF);
    for (const path of ['/social', '/clubs', '/friends']) {
      await staff.goto(`${APP}${path}`);
      await staff.waitForTimeout(1800);
      // The Social screen's own furniture must be absent on every alias.
      await expect(staff.locator('.v2-social'), `${path} must not render the Social screen`).toHaveCount(0);
      await expect(staff.getByRole('button', { name: 'Friends', exact: true })).toHaveCount(0);
    }
  });

  test('T4: the owner still gets Social on all three paths (no regression)', async ({ browser }) => {
    const owner = await pageAs(browser, OWNER);
    for (const path of ['/social', '/clubs', '/friends']) {
      await owner.goto(`${APP}${path}`);
      await owner.waitForTimeout(1800);
      await expect(owner.locator('.v2-social'), `${path} must render the Social screen`).toHaveCount(1);
    }
  });
});
