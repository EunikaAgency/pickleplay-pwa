/**
 * The Play tab's Discover card must say up front whether the viewer can join a
 * gender-restricted game — tapping through only to find the button locked is the
 * bug this guards.
 *
 * The host is a third account, since Discover deliberately hides your own games.
 */
import { test, expect, type Browser, type Page } from '@playwright/test';

const APP = 'http://localhost:9000';
const API = 'http://localhost:9002';

// Roles matter: Discover only renders for a PLAYER (an owner gets the venue
// console on this tab), so both viewers must be plain players.
const HOST = { email: 'ccdfa3b7.walker@example.com', password: 'password123' };
const FEMALE_PLAYER = { email: 'johnkenneth.tan.dev+player@gmail.com', password: 'password123' };
const MALE_PLAYER = { email: '84a3be4a.hernandez@example.com', password: 'password123' };

async function tokens(creds: { email: string; password: string }) {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(creds),
  });
  const j = await res.json() as { data?: { accessToken?: string; refreshToken?: string } };
  if (!j.data?.accessToken || !j.data?.refreshToken) throw new Error(`login failed for ${creds.email}`);
  return { accessToken: j.data.accessToken, refreshToken: j.data.refreshToken };
}

async function createGame(creds: { email: string; password: string }, body: Record<string, unknown>): Promise<string> {
  const { accessToken } = await tokens(creds);
  const res = await fetch(`${API}/api/v1/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ skillLabel: 'Open', date: '2026-07-16', timeLabel: '6:00 PM', ...body }),
  });
  const j = await res.json() as { data?: { id?: string } };
  if (!j.data?.id) throw new Error(`createGame failed: ${JSON.stringify(j)}`);
  return j.data.id;
}

async function deleteGame(creds: { email: string; password: string }, id: string) {
  const { accessToken } = await tokens(creds);
  await fetch(`${API}/api/v1/games/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
}

async function playTab(browser: Browser, creds: { email: string; password: string }): Promise<Page> {
  const t = await tokens(creds);
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

test('the Discover card says whether you can join, before you open it', async ({ browser }) => {
  const id = await createGame(HOST, {
    gameType: 'open', targetPlayers: 8, genderPolicy: 'women', title: 'ZZ Ladies Drop-in',
  });
  try {
    // The male player is told he can't join, on the card itself.
    const male = await playTab(browser, MALE_PLAYER);
    const his = male.locator('.game-card', { hasText: 'ZZ Ladies Drop-in' });
    await expect(his).toBeVisible({ timeout: 25_000 });
    await expect(his.getByText(/Not eligible · Women only/i)).toBeVisible();
    await his.scrollIntoViewIfNeeded();
    await his.screenshot({ path: 'test-results/gender-card-ineligible.png' });
    await male.context().close();

    // The female player sees the same restriction as a plain badge — not a lock.
    const female = await playTab(browser, FEMALE_PLAYER);
    const hers = female.locator('.game-card', { hasText: 'ZZ Ladies Drop-in' });
    await expect(hers).toBeVisible({ timeout: 25_000 });
    await expect(hers.getByText(/Women only/i)).toBeVisible();
    await expect(hers.getByText(/Not eligible/i)).toHaveCount(0);
    await hers.scrollIntoViewIfNeeded();
    await hers.screenshot({ path: 'test-results/gender-card-eligible.png' });
    await female.context().close();
  } finally {
    await deleteGame(HOST, id);
  }
});
