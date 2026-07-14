/**
 * "Who can play" — men-only / women-only / open-to-all on a published game.
 *
 * The picker rides in step 2 of the booking flow for BOTH published modes
 * (open play + hosted game) and is absent from a private game, which publishes
 * nothing. The server matches the choice against the joiner's profile gender;
 * these tests cover the surfaces a player actually sees.
 *
 * Run: npx playwright test --config=playwright.config.ts game-gender-policy
 */
import { test, expect, type Browser, type Page } from '@playwright/test';

const APP = 'http://localhost:9000';
const API = 'http://localhost:9002';
const VENUE = '6a4f11a0a63522a6e14a427c';

// Mari is female, Oscar is male — both seeded with a gender on the account.
const FEMALE = { email: 'johnkenneth.tan.dev+player@gmail.com', password: 'password123' };
const MALE = { email: 'ccdfa3b7.walker@example.com', password: 'password123' };

// The picker's accessible names (icon + label, as rendered). One word each: three
// chips across a phone can't hold the full phrase at the row's shared type size.
// Matched exactly — a /Men/ regex would also match "Wo-men" and hit two buttons.
const GENDER_BTN = { all: '🌍Everyone', men: '👨Men', women: '👩Women' } as const;

async function tokens(creds: { email: string; password: string }) {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(creds),
  });
  const j = await res.json() as { data?: { accessToken?: string; refreshToken?: string } };
  if (!j.data?.accessToken || !j.data?.refreshToken) throw new Error(`login failed for ${creds.email}`);
  return { accessToken: j.data.accessToken, refreshToken: j.data.refreshToken };
}

/** A signed-in page. The splash is a once-per-session overlay that swallows
 *  clicks, so mark it seen before the app boots. Never wait for `networkidle`:
 *  the app holds an SSE connection open, so the network never goes idle. */
async function signedInPage(browser: Browser, creds: { email: string; password: string }, path: string): Promise<Page> {
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

/** Post a game straight through the API, so a UI test starts from a known game. */
async function createGame(creds: { email: string; password: string }, body: Record<string, unknown>): Promise<string> {
  const { accessToken } = await tokens(creds);
  const res = await fetch(`${API}/api/v1/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ skillLabel: 'Open', date: '2026-07-20', timeLabel: '6:00 PM', ...body }),
  });
  const j = await res.json() as { data?: { id?: string } };
  if (!j.data?.id) throw new Error(`createGame failed: ${JSON.stringify(j)}`);
  return j.data.id;
}

async function deleteGame(creds: { email: string; password: string }, id: string) {
  const { accessToken } = await tokens(creds);
  await fetch(`${API}/api/v1/games/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
}

/** Walk the booking wizard's step 1 (booking type → court → start → end) into the
 *  details step, where the Who-can-play picker lives. Continue stays disabled
 *  until availability resolves, so wait on the button, not on a timeout. */
async function toDetailsStep(page: Page, mode: 'Open play session' | 'Hosted game') {
  await page.getByRole('button', { name: new RegExp(mode, 'i') }).click();

  const court = page.getByRole('radiogroup', { name: /Choose a court/i }).getByRole('button').first();
  if (await court.count()) await court.click();

  for (const label of [/Start time/i, /End time/i]) {
    await page.getByRole('button', { name: label }).click();
    await page.getByRole('option').first().click();
  }

  const cont = page.getByRole('button', { name: /^Continue/i });
  await expect(cont).toBeEnabled({ timeout: 20_000 });
  await cont.click();
  await expect(page.getByText(/Step 2 of/i)).toBeVisible({ timeout: 10_000 });
}

test.describe('booking step 2 — Who can play', () => {
  test('open play offers all three options and defaults to open-to-all', async ({ browser }) => {
    const page = await signedInPage(browser, FEMALE, `/book?venueId=${VENUE}`);
    await toDetailsStep(page, 'Open play session');

    await expect(page.getByText('Who can play', { exact: false })).toBeVisible();
    // Exact names, not /Men only/ — that regex also matches "Wo-men only".
    for (const name of Object.values(GENDER_BTN)) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    }
    // Default: nothing is restricted until the host says so.
    await expect(page.getByRole('button', { name: GENDER_BTN.all, exact: true })).toHaveClass(/active/);

    // Choosing a restriction explains itself in plain language.
    await page.getByRole('button', { name: GENDER_BTN.women, exact: true }).click();
    await expect(page.getByText(/Only players whose profile says female can join/i)).toBeVisible();
    await page.screenshot({ path: 'test-results/gender-step2-open-play.png', fullPage: false });
    await page.context().close();
  });

  test('a private game has no Who-can-play picker (it publishes nothing)', async ({ browser }) => {
    const page = await signedInPage(browser, FEMALE, `/book?venueId=${VENUE}`);
    await toDetailsStep(page, 'Open play session');
    await page.getByRole('button', { name: /Private game/i }).click();
    await expect(page.getByText('Who can play', { exact: false })).toHaveCount(0);
    await page.context().close();
  });

  test('a hosted game offers the picker too', async ({ browser }) => {
    const page = await signedInPage(browser, FEMALE, `/book?venueId=${VENUE}`);
    await toDetailsStep(page, 'Hosted game');
    await expect(page.getByText('Who can play', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: GENDER_BTN.women, exact: true })).toBeVisible();
    await page.context().close();
  });
});

test.describe('the restriction is visible and enforced where players join', () => {
  test('an ineligible player sees a locked, explained Join button', async ({ browser }) => {
    // A women-only hosted game, seen by a male player.
    const id = await createGame(FEMALE, {
      gameType: 'public', format: 'round_robin', capacity: 4,
      genderPolicy: 'women', title: 'Ladies Night (e2e)',
    });
    try {
      const page = await signedInPage(browser, MALE, `/games/${id}`);
      await expect(page.getByText('Women only').first()).toBeVisible({ timeout: 15_000 });

      const join = page.getByRole('button', { name: /Not eligible|Join Game/i });
      await expect(join).toBeDisabled();
      await expect(join).toContainText(/Not eligible — women only/i);
      await page.screenshot({ path: 'test-results/gender-lobby-blocked.png' });
      await page.context().close();
    } finally {
      await deleteGame(FEMALE, id);
    }
  });

  test('an eligible player can still join normally', async ({ browser }) => {
    const id = await createGame(FEMALE, {
      gameType: 'public', format: 'round_robin', capacity: 4,
      genderPolicy: 'women', title: 'Ladies Night (e2e)',
    });
    try {
      const page = await signedInPage(browser, FEMALE, `/games/${id}`);
      // The host is already on the roster, so she sees the host CTA, not Join —
      // what matters is that nothing is locked for her.
      await expect(page.getByText(/Not eligible/i)).toHaveCount(0);
      await page.context().close();
    } finally {
      await deleteGame(FEMALE, id);
    }
  });

  test('open play: an ineligible player cannot show interest', async ({ browser }) => {
    const id = await createGame(MALE, {
      gameType: 'open', targetPlayers: 8, genderPolicy: 'men', title: 'Boys Session (e2e)',
    });
    try {
      const page = await signedInPage(browser, FEMALE, `/games/${id}`);
      await expect(page.getByText('Men only').first()).toBeVisible({ timeout: 15_000 });
      const cta = page.getByRole('button', { name: /Not eligible|I'm Interested/i });
      await expect(cta).toBeDisabled();
      await page.screenshot({ path: 'test-results/gender-openplay-blocked.png' });
      await page.context().close();
    } finally {
      await deleteGame(MALE, id);
    }
  });

  test('an unrestricted game is untouched — no badge, join stays open', async ({ browser }) => {
    const id = await createGame(FEMALE, {
      gameType: 'public', format: 'round_robin', capacity: 4, title: 'Everyone Welcome (e2e)',
    });
    try {
      const page = await signedInPage(browser, MALE, `/games/${id}`);
      const join = page.getByRole('button', { name: /Join Game/i });
      await expect(join).toBeEnabled({ timeout: 15_000 });
      // No gender badge, and nothing locked. (Scoped to the badge text — a bare
      // /only/i also matches unrelated lobby copy like "Invite only".)
      await expect(page.getByText('Women only')).toHaveCount(0);
      await expect(page.getByText('Men only')).toHaveCount(0);
      await expect(page.getByText(/Not eligible/i)).toHaveCount(0);
      await page.context().close();
    } finally {
      await deleteGame(FEMALE, id);
    }
  });
});
