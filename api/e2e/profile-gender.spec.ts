/**
 * Edit Profile: gender is a new required field.
 *
 * Guards the two halves of "required": an account that has no gender (every
 * account predates the field) cannot save until one is picked, and once picked
 * it round-trips through PATCH /me and prefills on the next load.
 */
import { test, expect, type Browser, type Page } from '@playwright/test';

const APP = 'http://localhost:9000';
const API = 'http://localhost:9002';
const PLAYER = { email: 'johnkenneth.tan.dev+player@gmail.com', password: 'password123' };

async function playerTokens(): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(PLAYER),
  });
  const j = await res.json() as { data?: { accessToken?: string; refreshToken?: string } };
  if (!j.data?.accessToken || !j.data?.refreshToken) throw new Error('player login failed');
  return { accessToken: j.data.accessToken, refreshToken: j.data.refreshToken };
}

async function readGender(token: string): Promise<string | null> {
  const res = await fetch(`${API}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await res.json() as { data?: { gender?: string | null } };
  return j.data?.gender ?? null;
}

/** Clear the account's gender directly in Mongo — the API deliberately has no
 *  way to blank one, so this is how we reproduce a pre-existing account. */
async function clearGender(email: string) {
  const { execFileSync } = await import('node:child_process');
  execFileSync('mongosh', ['pickleballers', '--quiet', '--eval',
    `db.users.updateOne({email:${JSON.stringify(email)}},{$unset:{gender:1}})`]);
}

/** Signed-in Edit Profile page. Never wait for `networkidle` here — the app
 *  holds an open SSE connection to /me/stream, so the network is never idle. */
async function editProfilePage(
  browser: Browser,
  tokens: { accessToken: string; refreshToken: string },
): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(APP);
  await page.evaluate((t) => {
    localStorage.setItem('pb-access-token', t.accessToken);
    localStorage.setItem('pb-refresh-token', t.refreshToken);
    sessionStorage.setItem('pb-splash-seen', '1');
  }, tokens);
  await page.goto(`${APP}/profile/edit`);
  await expect(page.getByRole('button', { name: 'Gender' })).toBeVisible({ timeout: 20_000 });
  return page;
}

test('gender is required: no save without one, and it round-trips once set', async ({ browser }) => {
  const tokens = await playerTokens();
  const token = tokens.accessToken;

  // Start from an account with NO gender — the state every existing user is in.
  await clearGender(PLAYER.email);
  expect(await readGender(token)).toBeNull();

  const page = await editProfilePage(browser, tokens);

  // The whole point of "required": the account is otherwise complete (name is
  // prefilled), yet Save is held because gender is missing.
  await expect(page.getByLabel(/First name/)).not.toHaveValue('');
  const save = page.getByRole('button', { name: /save/i });
  await expect(save).toBeDisabled();

  // Picking a gender releases the save.
  await page.getByRole('button', { name: 'Gender' }).click();
  await page.getByRole('option', { name: 'Female' }).click();
  await expect(save).toBeEnabled();

  const saved = page.waitForResponse(
    (r) => r.url().includes('/api/v1/auth/me') && r.request().method() === 'PATCH' && r.ok(),
  );
  await save.click();
  await saved;

  // The server is the source of truth — read it back independently of the UI.
  expect(await readGender(token)).toBe('female');

  // And it prefills on the next load, rather than resetting to blank (which
  // would silently re-block the save on every visit).
  const fresh = await editProfilePage(browser, tokens);
  await expect(fresh.getByRole('button', { name: 'Gender' })).toContainText('Female');
  await expect(fresh.getByRole('button', { name: /save/i })).toBeEnabled();
});
