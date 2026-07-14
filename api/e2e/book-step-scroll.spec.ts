/**
 * Book-a-court wizard — every step must start at the top.
 *
 * All four steps render inside ONE `.scroll` container, so advancing from the
 * long Step 1 (court list + calendar + hour pickers) used to carry its scroll
 * offset into Step 2, dropping the user at the bottom of the details form with
 * the header and progress bar off-screen.
 *
 * Prerequisites: API on :9002, app on :9000, seeded venues.
 * Run: npx playwright test --config=playwright.config.ts book-step-scroll
 */

import { test, expect, type Browser, type Page } from '@playwright/test';

const APP = 'http://localhost:9000';
const API = 'http://localhost:9002';
const PLAYER = { email: 'christianian.i.alcazar@gmail.com', password: 'password123' };
const VENUE = '6a4f11a0a63522a6e14a427c'; // The Dink Lab — the venue in the bug report
// Deep-link a full slot (date + start + duration) so Step 1 is already valid and
// Continue isn't held back by "Please pick an end time" — this test is about the
// scroll position between steps, not about the schedule pickers.
const BOOK = `/book?venueId=${VENUE}&date=2026-07-15&time=08:00&hours=2`;

async function tokens(creds: { email: string; password: string }) {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(creds),
  });
  const j = await res.json() as { data?: { accessToken?: string; refreshToken?: string } };
  if (!j.data?.accessToken || !j.data?.refreshToken) throw new Error(`login failed for ${creds.email}`);
  return { accessToken: j.data.accessToken, refreshToken: j.data.refreshToken };
}

/** Never wait for `networkidle` — the app holds an open SSE stream to /me/stream. */
async function signedInPage(browser: Browser, path: string): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(APP);
  await page.evaluate((t) => {
    localStorage.setItem('pb-access-token', t.accessToken);
    localStorage.setItem('pb-refresh-token', t.refreshToken);
    sessionStorage.setItem('pb-splash-seen', '1');
  }, await tokens(PLAYER));
  await page.goto(`${APP}${path}`);
  return page;
}

const scrollTop = (page: Page) => page.locator('.scroll').first().evaluate((el) => el.scrollTop);

/** The wizard gates Continue on the availability check ("Checking availability…"). */
async function continueOn(page: Page) {
  const btn = page.getByRole('button', { name: /^Continue/ });
  await expect(btn).toBeEnabled({ timeout: 15_000 });
  await btn.click();
}

test.describe('Book a court — step scroll position', () => {
  test('advancing to the details step lands at the top, not the bottom', async ({ browser }) => {
    const page = await signedInPage(browser, BOOK);

    await expect(page.getByText('Step 1 of 4')).toBeVisible({ timeout: 15_000 });

    // Reproduce the report: scroll Step 1 to its bottom before continuing.
    await page.locator('.scroll').first().evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await expect.poll(() => scrollTop(page)).toBeGreaterThan(100);

    await continueOn(page);

    await expect(page.getByText('Step 2 of 4')).toBeVisible();
    // The header + progress bar are on screen — i.e. we're at the top of the step.
    await expect.poll(() => scrollTop(page)).toBe(0);
    await expect(page.getByText('WHO CAN PLAY')).toBeVisible();

    await page.close();
  });

  test('every subsequent step — and going back — also starts at the top', async ({ browser }) => {
    const page = await signedInPage(browser, BOOK);
    await expect(page.getByText('Step 1 of 4')).toBeVisible({ timeout: 15_000 });

    await continueOn(page);
    await expect(page.getByText('Step 2 of 4')).toBeVisible();

    // Scroll the details step down, then advance to the summary.
    await page.locator('.scroll').first().evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await continueOn(page);
    await expect(page.getByText('Step 3 of 4')).toBeVisible();
    await expect.poll(() => scrollTop(page)).toBe(0);

    // Back to the details step — also from the top, not wherever we left it.
    await page.locator('.scroll').first().evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await page.locator('.scroll').first().getByRole('button').first().click();
    await expect(page.getByText('Step 2 of 4')).toBeVisible();
    await expect.poll(() => scrollTop(page)).toBe(0);

    await page.close();
  });
});
