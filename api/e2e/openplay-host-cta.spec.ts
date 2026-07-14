/**
 * The host of an Open Play doesn't sign up for their own session.
 *
 * The Open Play detail (`/open-play/:id`) never checked who was looking, so the
 * host saw the same "I'm Interested" CTA as everyone else — and could add
 * themselves to their own interest list. The host now gets "Cancel session"
 * instead, mirroring the game lobby's host-only delete.
 *
 * Run: npx playwright test --config=playwright.config.ts openplay-host-cta
 */
import { test, expect, type Browser, type Page } from '@playwright/test';

const APP = 'http://localhost:9000';
const API = 'http://localhost:9002';
const VENUE = '6a4f11a0a63522a6e14a427c';

const HOST = { email: 'johnkenneth.tan.dev+player@gmail.com', password: 'password123' };
const OTHER = { email: 'ccdfa3b7.walker@example.com', password: 'password123' };

type Creds = { email: string; password: string };

async function tokens(creds: Creds) {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(creds),
  });
  const j = await res.json() as { data?: { accessToken?: string; refreshToken?: string } };
  if (!j.data?.accessToken || !j.data?.refreshToken) throw new Error(`login failed for ${creds.email}`);
  return { accessToken: j.data.accessToken, refreshToken: j.data.refreshToken };
}

/** The splash is a once-per-session overlay that swallows clicks — mark it seen
 *  before the app boots. Never wait for `networkidle`: the app holds an SSE
 *  connection open, so the network never goes idle. */
async function signedInPage(browser: Browser, creds: Creds, path: string): Promise<Page> {
  const t = await tokens(creds);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(APP);
  await page.evaluate((tk) => {
    localStorage.setItem('pb-access-token', tk.accessToken);
    localStorage.setItem('pb-refresh-token', tk.refreshToken);
    sessionStorage.setItem('pb-splash-seen', '1');
  }, t);
  await page.goto(`${APP}${path}`);
  return page;
}

/** An Open Play (gameType 'open') posted straight through the API. */
async function createOpenPlay(creds: Creds): Promise<string> {
  const { accessToken } = await tokens(creds);
  const res = await fetch(`${API}/api/v1/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      title: 'Host CTA test session',
      gameType: 'open',
      venueId: VENUE,
      skillLabel: 'Open',
      date: '2026-08-14',
      timeLabel: '6:00 PM',
    }),
  });
  const j = await res.json() as { data?: { id?: string } };
  if (!j.data?.id) throw new Error(`createOpenPlay failed: ${JSON.stringify(j)}`);
  return j.data.id;
}

async function gameStatus(id: string): Promise<number> {
  const res = await fetch(`${API}/api/v1/games/${id}`);
  return res.status;
}

async function deleteGame(creds: Creds, id: string) {
  const { accessToken } = await tokens(creds);
  await fetch(`${API}/api/v1/games/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
}

const cta = (page: Page) => page.locator('.sticky-cta .btn-join');

test('the host sees "Cancel session", never "I\'m Interested"', async ({ browser }) => {
  const id = await createOpenPlay(HOST);
  try {
    const page = await signedInPage(browser, HOST, `/open-play/${id}`);
    await expect(cta(page)).toHaveText(/Cancel session/i);
    await expect(page.getByText(/I'm Interested/i)).toHaveCount(0);
    await page.close();
  } finally {
    await deleteGame(HOST, id);
  }
});

test('a player who is not the host still sees "I\'m Interested"', async ({ browser }) => {
  const id = await createOpenPlay(HOST);
  try {
    const page = await signedInPage(browser, OTHER, `/open-play/${id}`);
    await expect(cta(page)).toHaveText(/I'm Interested/i);
    await expect(page.getByText(/Cancel session/i)).toHaveCount(0);
    await page.close();
  } finally {
    await deleteGame(HOST, id);
  }
});

test('a guest still sees "I\'m Interested"', async ({ browser }) => {
  const id = await createOpenPlay(HOST);
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(APP);
    await page.evaluate(() => sessionStorage.setItem('pb-splash-seen', '1'));
    await page.goto(`${APP}/open-play/${id}`);
    await expect(cta(page)).toHaveText(/I'm Interested/i);
    await page.close();
  } finally {
    await deleteGame(HOST, id);
  }
});

test('the host can cancel the session end to end', async ({ browser }) => {
  const id = await createOpenPlay(HOST);
  let page: Page | undefined;
  try {
    page = await signedInPage(browser, HOST, `/open-play/${id}`);

    await cta(page).click();
    await expect(page.getByText('Cancel this Open Play?')).toBeVisible();

    // The sheet's own confirm button, not the sticky CTA behind it.
    await page.getByRole('button', { name: 'Cancel session', exact: true }).last().click();

    await expect(page.getByText('Session cancelled')).toBeVisible();
    expect(await gameStatus(id)).toBe(404);
  } finally {
    if (page) await page.close();
    await deleteGame(HOST, id);
  }
});
