/**
 * Drives the coach feature end-to-end in the real PWA:
 *  - Home tab shows the 3rd "Find Coach" quick action + the subscribe CTA
 *  - Profile tab carries the canonical "Become a coach" entry
 *  - Subscribing through the UI grants the coach role
 *  - Find Coach lists only subscribed coaches
 *  - A player books a coach; the coach accepts; the badge shows on the profile
 *
 * The suite MUTATES the coach account, so `beforeAll` resets it — otherwise it
 * would only ever pass on a virgin database.
 */
import { execFileSync } from 'node:child_process';
import { test, expect, type Browser, type Page } from '@playwright/test';

const APP = 'http://localhost:9000';
const API = 'http://localhost:9002';
const COACH = { email: 'johnkenneth.tan.dev+player@gmail.com', password: 'password123' };
const PLAYER = { email: 'christianian.i.alcazar@gmail.com', password: 'password123' };

/** Wipe the coach account back to "player with an address on file". */
function resetCoachAccount() {
  execFileSync('mongosh', ['--quiet', 'pickleballers', '--eval', `
    const u = db.users.findOne({email: ${JSON.stringify(COACH.email)}});
    db.partnersubscriptions.deleteMany({userId: u._id});
    db.userroles.deleteMany({userId: u._id, role: "coach", scopeType: null});
    db.coaches.deleteMany({userId: u._id});
    db.coachbookings.deleteMany({});
    db.payments.deleteMany({purpose: "partner_subscription"});
    db.users.updateOne({_id: u._id}, {
      $unset: {coachId: ""},
      $set: {address1: "123 Antero Soriano Hwy", city: "Tanza", province: "Cavite", zipcode: "4108"},
    });
  `], { stdio: 'pipe' });
}

async function tokens(creds: { email: string; password: string }) {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(creds),
  });
  const j = await res.json() as { data?: { accessToken?: string; refreshToken?: string } };
  if (!j.data?.accessToken || !j.data?.refreshToken) throw new Error(`login failed for ${creds.email}`);
  return { accessToken: j.data.accessToken, refreshToken: j.data.refreshToken };
}

/** Never wait for `networkidle` — the app holds an open SSE stream to /me/stream. */
async function signedInPage(browser: Browser, creds: { email: string; password: string }, path = '/'): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(APP);
  await page.evaluate((t) => {
    localStorage.setItem('pb-access-token', t.accessToken);
    localStorage.setItem('pb-refresh-token', t.refreshToken);
    sessionStorage.setItem('pb-splash-seen', '1');
  }, await tokens(creds));
  await page.goto(`${APP}${path}`);
  return page;
}

test.beforeAll(() => resetCoachAccount());

test('home tab gains a Find Coach card and a subscribe CTA', async ({ browser }) => {
  const page = await signedInPage(browser, COACH, '/home');

  // Three quick actions now, not two.
  const cards = page.locator('.quick-actions .qa-card');
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText('Play');
  await expect(cards.nth(1)).toContainText('Book Court');
  await expect(cards.nth(2)).toContainText('Find Coach');

  // The grid really is 3 columns (it used to hardcode repeat(2, 1fr)).
  const cols = await page.locator('.quick-actions').evaluate((el) => getComputedStyle(el).gridTemplateColumns);
  expect(cols.split(' ')).toHaveLength(3);

  // The CTA is a doorway only — it routes to the Profile-tab subscribe screen.
  const cta = page.locator('.coach-cta');
  await expect(cta).toBeVisible();
  await cta.click();
  await expect(page).toHaveURL(/\/coach\/subscribe$/);
  await expect(page.getByText('Coach on PickleBallers')).toBeVisible();

  // Find Coach is reachable straight from the card.
  await page.goto(`${APP}/home`);
  await cards.nth(2).click();
  await expect(page).toHaveURL(/\/coaches$/);

  await page.context().close();
});

test('profile tab pitches coaching as an upgrade banner whose popup lists the perks', async ({ browser }) => {
  const page = await signedInPage(browser, COACH, '/profile');

  // The Coaching section leads with an upgrade banner (same treatment as
  // "Unlock Full Stats"), not a plain settings row.
  const banner = page.locator('.upgrade-banner').filter({ hasText: 'Coach on PickleBallers' });
  await expect(banner).toBeVisible({ timeout: 20_000 });
  // The price is read from GET /settings, never hard-coded in the component.
  await expect(banner.locator('.upgrade-pill')).toHaveText('₱499');
  await expect(page.getByText('Become a coach', { exact: true })).toHaveCount(0);

  // Tapping it opens the "what you get" popup.
  await banner.click();
  await expect(page.getByText("Turn your game into income. Here's what a subscription unlocks.")).toBeVisible();
  for (const perk of [
    'Get discovered in Find Coach',
    'Coach at any venue',
    'Take paid bookings',
    'A Coach badge on your profile',
  ]) {
    await expect(page.getByText(perk, { exact: true })).toBeVisible();
  }
  await expect(page.getByText('/ 30 days')).toBeVisible();

  // Continue hands off to the paid screen (which owns the address gate).
  await page.getByRole('button', { name: /Continue · ₱499/ }).click();
  await expect(page).toHaveURL(/\/coach\/subscribe$/);

  await page.context().close();
});

test('subscribe → get listed → player books → coach accepts → badge shows', async ({ browser }) => {
  // ── The coach subscribes through the UI ──────────────────────────
  const coachPage = await signedInPage(browser, COACH, '/coach/subscribe');
  await expect(coachPage.getByText('Coach on PickleBallers')).toBeVisible();
  const subscribeBtn = coachPage.getByRole('button', { name: /Subscribe · ₱499/ });
  await expect(subscribeBtn).toBeEnabled();
  await subscribeBtn.click();
  await expect(coachPage.getByText('Coach subscription active')).toBeVisible({ timeout: 20_000 });

  // Create + list the coach profile (the profile editor is a separate surface).
  const t = (await tokens(COACH)).accessToken;
  const created = await fetch(`${API}/api/v1/coaches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
    body: JSON.stringify({ displayName: 'Coach Mari', specialty: 'Third-shot drops', pricePrivatePerHour: 800 }),
  });
  expect(created.status, 'creating a coach profile while subscribed').toBe(201);
  await fetch(`${API}/api/v1/coaches/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
    body: JSON.stringify({ isListed: true }),
  });

  // ── A different player finds and books them ──────────────────────
  const playerPage = await signedInPage(browser, PLAYER, '/coaches');
  await expect(playerPage.getByText('Every coach here holds an active PickleBallers subscription.')).toBeVisible();
  const card = playerPage.getByRole('button', { name: /Coach Mari/ });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(playerPage.getByText('₱800')).toBeVisible();
  await card.click();

  await expect(playerPage).toHaveURL(/\/coaches\/[^/]+$/);
  await playerPage.getByRole('button', { name: 'Book a session' }).click();
  await expect(playerPage).toHaveURL(/\/book$/);

  // Send is blocked until a start time is chosen.
  await expect(playerPage.getByRole('button', { name: 'Pick a start time' })).toBeDisabled();

  // HourSelect is a popup listbox — open it, then pick an option.
  await playerPage.getByRole('button', { name: 'Select time' }).click();
  await playerPage.getByRole('option', { name: '9:00 AM' }).click();
  await playerPage.getByRole('button', { name: 'Send request' }).click();
  await expect(playerPage.getByText(/Request sent to Coach Mari/)).toBeVisible({ timeout: 20_000 });

  // ── The coach sees it, and accepts ───────────────────────────────
  await coachPage.goto(`${APP}/coach/bookings`);
  await expect(coachPage.getByText('Awaiting coach')).toBeVisible({ timeout: 20_000 });
  await coachPage.getByRole('button', { name: 'Accept' }).click();
  await expect(coachPage.getByText('Confirmed')).toBeVisible({ timeout: 20_000 });

  // ── The coach's public profile wears the badge ───────────────────
  const meRes = await fetch(`${API}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${t}` } });
  const coachUserId = (await meRes.json() as any).data.id;
  await playerPage.goto(`${APP}/players/${coachUserId}`);
  await expect(playerPage.getByText('Book a coaching session')).toBeVisible({ timeout: 20_000 });
  // The badge pill. Its Icon renders a Material-Symbols ligature inside the same
  // span, so the pill's text is "sportsCoach" — assert on the trailing label.
  await expect(playerPage.locator('span').filter({ hasText: /Coach$/ }).first()).toBeVisible();
  // And the API must not have granted the badge from a stale venue role.
  const pub = await (await fetch(`${API}/api/v1/users/${coachUserId}`)).json() as any;
  expect(pub.data.isCoach, 'badge tracks the live subscription').toBe(true);
  expect(pub.data.partnerRoles.every((p: any) => p.venueName !== 'Unknown venue'),
    'no badges for venues that no longer exist').toBe(true);

  // ── Once subscribed, the pitch banner gives way to manage rows ───
  await coachPage.goto(`${APP}/profile`);
  await expect(coachPage.getByText('Coach subscription', { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(coachPage.getByText('Session requests', { exact: true })).toBeVisible();
  await expect(coachPage.locator('.upgrade-banner').filter({ hasText: 'Coach on PickleBallers' })).toHaveCount(0);

  await coachPage.context().close();
  await playerPage.context().close();
});
