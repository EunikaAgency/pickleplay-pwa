/**
 * Edit Profile: the free-text "Location" field was replaced by a real postal
 * address (address1 / address2 / city / province / zipcode) that persists to
 * the account via PATCH /me.
 *
 * Guards the two things the old field got wrong: it never prefilled from the
 * server, and it was never submitted.
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

/** Overwrite the account's address straight through the API, so the UI test
 *  starts from a known server-side state. */
async function setAddress(token: string, body: Record<string, string>) {
  const res = await fetch(`${API}/api/v1/auth/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH /me failed: ${res.status}`);
}

async function readAddress(token: string) {
  const res = await fetch(`${API}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await res.json() as { data?: Record<string, string> };
  const d = j.data ?? {};
  return {
    address1: d.address1 ?? '', address2: d.address2 ?? '',
    city: d.city ?? '', province: d.province ?? '', zipcode: d.zipcode ?? '',
  };
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
  await expect(page.getByLabel('Address line 1')).toBeVisible({ timeout: 20_000 });
  return page;
}

test('address fields prefill from the account, save, and survive a reload', async ({ browser }) => {
  const tokens = await playerTokens();
  const token = tokens.accessToken;

  // Seed a known address server-side, then assert the form PREFILLS it.
  await setAddress(token, {
    address1: 'SEED line one', address2: 'SEED line two',
    city: 'Seedville', province: 'Seed Province', zipcode: '0000',
  });

  const page = await editProfilePage(browser, tokens);

  await expect(page.getByLabel('Address line 1')).toHaveValue('SEED line one');
  await expect(page.getByLabel('Address line 2')).toHaveValue('SEED line two');
  await expect(page.getByLabel('City')).toHaveValue('Seedville');
  await expect(page.getByLabel('Province')).toHaveValue('Seed Province');
  await expect(page.getByLabel('Zip code')).toHaveValue('0000');

  // A cold-loaded form must also prefill the pre-existing fields. It didn't
  // before (useForm captured its initial values while the session was still
  // restoring), which is harmless for throwaway state but would blank a saved
  // bio the moment the address fields started persisting.
  await expect(page.getByLabel(/First name/)).not.toHaveValue('');

  // The old single "Location" input must be gone.
  await expect(page.getByLabel('Location')).toHaveCount(0);

  // Edit every field and save.
  await page.getByLabel('Address line 1').fill('123 Antero Soriano Hwy');
  await page.getByLabel('Address line 2').fill('Brgy. Daang Amaya II');
  await page.getByLabel('City').fill('Tanza');
  await page.getByLabel('Province').fill('Cavite');
  await page.getByLabel('Zip code').fill('4108');

  const saved = page.waitForResponse(
    (r) => r.url().includes('/api/v1/auth/me') && r.request().method() === 'PATCH' && r.ok(),
  );
  await page.getByRole('button', { name: /save/i }).click();
  await saved;

  // The server is the source of truth — read it back independently of the UI.
  expect(await readAddress(token)).toEqual({
    address1: '123 Antero Soriano Hwy',
    address2: 'Brgy. Daang Amaya II',
    city: 'Tanza',
    province: 'Cavite',
    zipcode: '4108',
  });

  // And a cold reload rehydrates the saved values into the form.
  await page.reload();
  await expect(page.getByLabel('Address line 1')).toHaveValue('123 Antero Soriano Hwy');
  await expect(page.getByLabel('City')).toHaveValue('Tanza');
  await expect(page.getByLabel('Zip code')).toHaveValue('4108');

  await page.context().close();
});
