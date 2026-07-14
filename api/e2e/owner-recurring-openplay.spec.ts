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
  test('an owner can open the Recurring sessions screen, and it actually loads', async ({ page }) => {
    await signedInAs(page, OWNER, '/organizer/open-play');
    // It used to be gated on organizer.events.manage alone, so an owner typing this
    // address was bounced to home.
    await expect(page.getByText(/recurring session/i).first()).toBeVisible({ timeout: 10_000 });
    expect(page.url()).toContain('/organizer/open-play');

    // Opening the door is not enough: the LIST endpoint had the old gate too, so the
    // screen rendered and then immediately errored at the owner.
    await expect(page.getByText(/organizer events permission required/i)).toHaveCount(0);
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
  });

  test('the venue picker offers the owner ONLY venues they manage', async ({ page }) => {
    await signedInAs(page, OWNER, '/organizer/open-play');
    await page.getByRole('button', { name: /new series/i }).click();

    // FormSelect renders the app's own listbox, not a native <select>; its
    // accessible name comes from the field label, not the placeholder.
    const venuePicker = page.getByRole('button', { name: 'Venue' }).first();
    await expect(venuePicker).toBeVisible({ timeout: 10_000 });
    await venuePicker.click();

    const shown = (await page.getByRole('option').allInnerTexts())
      .map((t) => t.trim())
      .filter((t) => t && !/select a venue/i.test(t));

    // Every venue the server would refuse is a venue that should not be offered.
    const token = await tokenFor(OWNER);
    const me = await (await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })).json();
    const mine = await (await fetch(`${API}/venues?ownerUserId=${me.data.id}&pageSize=100`)).json();
    const mineNames: string[] = mine.data.items
      ? mine.data.items.map((v: { displayName: string }) => v.displayName)
      : mine.data.map((v: { displayName: string }) => v.displayName);

    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThanOrEqual(mineNames.length); // not the whole directory
    for (const name of shown) expect(mineNames).toContain(name);
  });

  test('a plain player is still bounced off the screen', async ({ page }) => {
    // Never `networkidle` on a signed-in page — the app holds an open SSE stream to
    // /me/stream, so it never goes idle and the wait just times out.
    await signedInAs(page, PLAYER, '/organizer/open-play');
    // Widened, not opened: a player manages no venue and runs no events.
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
      .not.toBe('/organizer/open-play');
  });
});
