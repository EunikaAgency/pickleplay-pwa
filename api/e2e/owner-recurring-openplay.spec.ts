/**
 * Recurring Open Play is reachable by a venue OWNER, not just an organizer (§5.3).
 *
 * Prerequisites: API on :9002 (seeded), app on :9000.
 * Run: npx playwright test --config=playwright.config.ts owner-recurring
 */

import { test, expect, type Page } from '@playwright/test';

const APP = 'http://localhost:9000';
const API = 'http://localhost:9002/api/v1';
const OWNER = { email: 'ccdfa3b7.walker@example.com', password: 'password123' }; // owns venues
const PLAYER = { email: 'christianian.i.alcazar@gmail.com', password: 'password123' };

async function tokenFor(creds: { email: string; password: string }): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(creds),
  });
  return (await res.json()).data.accessToken;
}

async function signedInAs(page: Page, creds: { email: string; password: string }, path: string) {
  const token = await tokenFor(creds);
  await page.addInitScript((t) => {
    localStorage.setItem('pb-access-token', t);
    sessionStorage.setItem('pb-splash-seen', '1'); // the once-per-session overlay eats clicks
  }, token);
  await page.goto(`${APP}${path}`);
}

test.describe('Recurring Open Play — venue owners', () => {
  test('an owner can open the Recurring sessions screen', async ({ page }) => {
    await signedInAs(page, OWNER, '/organizer/open-play');
    // It used to be gated on organizer.events.manage alone, so an owner typing this
    // address was bounced to home.
    await expect(page.getByText(/recurring session/i).first()).toBeVisible({ timeout: 10_000 });
    expect(page.url()).toContain('/organizer/open-play');
  });

  test('the venue picker offers the owner ONLY venues they manage', async ({ page }) => {
    await signedInAs(page, OWNER, '/organizer/open-play');
    await page.getByRole('button', { name: /new series/i }).click();

    const venueSelect = page.locator('select').filter({ hasText: /select a venue/i }).first();
    await expect(venueSelect).toBeVisible({ timeout: 10_000 });

    // Every option the server would refuse is an option that should not be there.
    const shown = (await venueSelect.locator('option').allInnerTexts())
      .filter((t) => !/select a venue/i.test(t));
    const token = await tokenFor(OWNER);
    const me = await (await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })).json();
    const mine = await (await fetch(`${API}/venues?ownerUserId=${me.data.id}&pageSize=100`)).json();
    const mineNames: string[] = mine.data.map((v: { displayName: string }) => v.displayName);

    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(100); // not the whole directory
    for (const name of shown) expect(mineNames).toContain(name);
  });

  test('a plain player is still bounced off the screen', async ({ page }) => {
    await signedInAs(page, PLAYER, '/organizer/open-play');
    await page.waitForLoadState('networkidle');
    // Widened, not opened: a player manages no venue and runs no events.
    expect(page.url()).not.toContain('/organizer/open-play');
  });
});
