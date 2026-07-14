/**
 * The Play tab's filter sheet can narrow the feed by who a game admits.
 *
 * Seeds one women-only and one open-to-all game (hosted by a third account, since
 * Discover hides your own), then drives the sheet as a player.
 */
import { test, expect, type Browser, type Page } from '@playwright/test';

const APP = 'http://localhost:9000';
const API = 'http://localhost:9002';

const HOST = { email: 'ccdfa3b7.walker@example.com', password: 'password123' };
const PLAYER = { email: '84a3be4a.hernandez@example.com', password: 'password123' };

async function tokens(creds: { email: string; password: string }) {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(creds),
  });
  const j = await res.json() as { data?: { accessToken?: string; refreshToken?: string } };
  if (!j.data?.accessToken || !j.data?.refreshToken) throw new Error(`login failed for ${creds.email}`);
  return { accessToken: j.data.accessToken, refreshToken: j.data.refreshToken };
}

async function createGame(body: Record<string, unknown>): Promise<string> {
  const { accessToken } = await tokens(HOST);
  const res = await fetch(`${API}/api/v1/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ gameType: 'open', targetPlayers: 8, skillLabel: 'Open', date: '2026-07-16', timeLabel: '6:00 PM', ...body }),
  });
  const j = await res.json() as { data?: { id?: string } };
  if (!j.data?.id) throw new Error(`createGame failed: ${JSON.stringify(j)}`);
  return j.data.id;
}

async function deleteGame(id: string) {
  const { accessToken } = await tokens(HOST);
  await fetch(`${API}/api/v1/games/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
}

async function playTab(browser: Browser): Promise<Page> {
  const t = await tokens(PLAYER);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(APP);
  await page.evaluate((tk) => {
    localStorage.setItem('pb-access-token', tk.accessToken);
    localStorage.setItem('pb-refresh-token', tk.refreshToken);
    sessionStorage.setItem('pb-splash-seen', '1');
  }, t);
  await page.goto(`${APP}/games`);
  return page;
}

test('the filter sheet narrows the feed by who can play', async ({ browser }) => {
  const womenOnly = await createGame({ genderPolicy: 'women', title: 'ZZ Ladies Drop-in' });
  const openToAll = await createGame({ title: 'ZZ Everyone Drop-in' });
  try {
    const page = await playTab(browser);
    const ladies = page.locator('.game-card', { hasText: 'ZZ Ladies Drop-in' });
    const everyone = page.locator('.game-card', { hasText: 'ZZ Everyone Drop-in' });

    // Unfiltered: both listings are in the feed.
    await expect(ladies).toBeVisible({ timeout: 25_000 });
    await expect(everyone).toBeVisible();

    // Women → the open-to-all game drops out. (Exact names: a /Men/ regex would
    // also match "Wo-men" and hit two chips.)
    await page.getByRole('button', { name: /^Filter/ }).click();
    await expect(page.getByText('Who can play')).toBeVisible();
    await page.getByRole('button', { name: 'Women', exact: true }).click();
    await page.getByRole('button', { name: /Show \d+ plays?/ }).click();
    await expect(ladies).toBeVisible();
    await expect(everyone).toHaveCount(0);
    await page.screenshot({ path: 'test-results/gender-filter-women.png' });

    // Everyone → the women-only game drops out instead.
    await page.getByRole('button', { name: /^Filter/ }).click();
    await page.getByRole('button', { name: 'Everyone', exact: true }).click();
    await page.getByRole('button', { name: /Show \d+ plays?/ }).click();
    await expect(everyone).toBeVisible();
    await expect(ladies).toHaveCount(0);

    // Reset → both are back.
    await page.getByRole('button', { name: /^Filter/ }).click();
    await page.getByRole('button', { name: /^Reset$/ }).click();
    await expect(ladies).toBeVisible();
    await expect(everyone).toBeVisible();
    await page.context().close();
  } finally {
    await deleteGame(womenOnly);
    await deleteGame(openToAll);
  }
});
