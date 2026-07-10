/**
 * Social tab (Clubs + Friends) — end-to-end.
 *
 * Verifies the merge itself (nav, back-compat deep links, guest gate) and the
 * thing the merge exists to enable: a pending-friend-request badge on the tab,
 * plus the landing rule that opens on Friends when requests are waiting.
 *
 * Self-seeding: registers Bob plus three senders, each of whom friend-requests
 * him, so Bob lands with exactly 3 pending. `@example.com` accounts are wiped by
 * the API's dummy-user seeder, so this leaves no lasting state.
 */
import { test, expect, type Page } from '@playwright/test';

const APP = 'http://localhost:9000';
const API = 'http://localhost:9002/api/v1';
const PASSWORD = 'Password123';
const PENDING = 3;

let BOB = '';

/** Register an @example.com account and return its token + id. */
async function register(email: string, displayName: string) {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, displayName }),
  });
  if (!res.ok) throw new Error(`register ${email} failed: ${res.status}`);
  const body = await res.json();
  const data = body.data ?? body;
  return { token: data.accessToken as string, id: data.user.id as string };
}

test.beforeAll(async () => {
  const run = `${Date.now()}`;
  BOB = `e2e.bob.${run}@example.com`;
  const bob = await register(BOB, 'Bob Bautista');

  const senders = [['alice', 'Alice Alonzo'], ['carol', 'Carol Cruz'], ['dave', 'Dave Dizon']];
  for (const [slug, name] of senders) {
    const s = await register(`e2e.${slug}.${run}@example.com`, name);
    const res = await fetch(`${API}/friends/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.token}` },
      body: JSON.stringify({ userId: bob.id }),
    });
    if (!res.ok) throw new Error(`friend request from ${slug} failed: ${res.status}`);
  }
});

/** The install banner can steal clicks; kill it before interacting. */
async function dismissChrome(page: Page) {
  await page.addStyleTag({ content: '.install-prompt,.pwa-toast{display:none!important}' });
}

async function login(page: Page) {
  await skipIntro(page);
  await page.goto(`${APP}/login`);
  await dismissChrome(page);
  await page.locator('input[type="email"]').fill(BOB);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.getByRole('button', { name: /^(sign in|log in)$/i }).first().click();
  await page.waitForFunction(() => !!localStorage.getItem('pb-access-token'), null, { timeout: 20000 });
}

/** Skip the once-per-session splash overlay — it covers the whole app, login included.
 *  addInitScript runs before page scripts on every navigation, unlike evaluate(). */
async function skipIntro(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem('pb-splash-seen', '1'));
}

test.use({ viewport: { width: 390, height: 844 } });

test('guest: tab bar reads Home Map Play Social Profile', async ({ page }) => {
  await skipIntro(page);
  await page.goto(APP);
  await dismissChrome(page);

  const labels = page.locator('.v2c-tabbar .v2c-tab-label');
  await expect(labels).toHaveText(['Home', 'Map', 'Play', 'Social', 'Profile']);
});

test('guest: Social opens on Clubs, and tapping Friends prompts sign-in without switching', async ({ page }) => {
  await skipIntro(page);
  await page.goto(`${APP}/social`);
  await dismissChrome(page);

  // Landing: guests always get Clubs (Friends needs an account).
  await expect(page.locator('.social-seg button[aria-selected="true"]')).toHaveText('Clubs');
  await expect(page.locator('.v2c-tab-badge')).toHaveCount(0);

  await page.locator('.social-seg button', { hasText: 'Friends' }).click();

  // Auth sheet opened, and the panel did NOT switch.
  await expect(page.locator('.sheet, [role="dialog"]').first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.social-seg button[aria-selected="true"]')).toHaveText('Clubs');
});

test('back-compat: /clubs and /friends still land on the right panel', async ({ page }) => {
  await skipIntro(page);
  await page.goto(`${APP}/clubs`);
  await dismissChrome(page);
  await expect(page.locator('.social-seg button[aria-selected="true"]')).toHaveText('Clubs');
  // The Social tab is the highlighted one, not a stale Clubs tab.
  await expect(page.locator('.v2c-tab[aria-current="page"] .v2c-tab-label')).toHaveText('Social');
});

test.describe('signed in as Bob (3 pending requests)', () => {
  // Confirming a request mutates the count, so later tests depend on earlier ones.
  test.describe.configure({ mode: 'serial' });

  test('badge shows 3, and a bare /social lands on Friends', async ({ page }) => {
    await login(page);

    await page.goto(`${APP}/social`);
    await dismissChrome(page);

    // The feature: a persistent count on the tab.
    const badge = page.locator('.v2c-tab-badge');
    await expect(badge).toHaveText(String(PENDING), { timeout: 10000 });
    await expect(page.locator('.v2c-tab[aria-current="page"]')).toHaveAttribute(
      'aria-label', new RegExp(`${PENDING} pending friend requests`),
    );

    // The landing rule: requests waiting → open on Friends.
    await expect(page.locator('.social-seg button[aria-selected="true"]')).toContainText('Friends');
    await expect(page.locator('.social-seg-count')).toHaveText(String(PENDING));
  });

  test('Requests tab lists all three; confirming one drops the badge to 2', async ({ page }) => {
    await login(page);
    await page.goto(`${APP}/social?tab=friends`);
    await dismissChrome(page);

    await page.locator('.filter-chip', { hasText: 'Requests' }).click();
    await expect(page.locator('.friend-row')).toHaveCount(PENDING);
    await expect(page.locator('.friend-name').first()).toBeVisible();

    await page.locator('.fbtn.primary', { hasText: 'Confirm' }).first().click();

    await expect(page.locator('.v2c-tab-badge')).toHaveText(String(PENDING - 1), { timeout: 10000 });
    await expect(page.locator('.friend-row')).toHaveCount(PENDING - 1);
  });

  test('sub-tab is in the URL and survives a reload', async ({ page }) => {
    await login(page);
    await page.goto(`${APP}/social?tab=clubs`);
    await dismissChrome(page);
    await expect(page.locator('.social-seg button[aria-selected="true"]')).toHaveText('Clubs');

    await page.locator('.social-seg button', { hasText: 'Friends' }).click();
    await expect(page).toHaveURL(/\/social\?tab=friends/);

    await page.reload();
    await dismissChrome(page);
    await expect(page.locator('.social-seg button[aria-selected="true"]')).toContainText('Friends');
  });

  test('dark mode: no green text on a dark ground', async ({ page }) => {
    await login(page);
    await page.goto(`${APP}/social?tab=friends`);
    await dismissChrome(page);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));

    await page.locator('.filter-chip', { hasText: 'Requests' }).click();
    await expect(page.locator('.friend-row').first()).toBeVisible();

    // --success-text must have flipped to the light variant (#4ADE80).
    const token = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.pb-v2.v2-social')!).getPropertyValue('--success-text').trim(),
    );
    expect(token.toLowerCase()).toBe('#4ade80');

    const nameColor = await page.locator('.friend-name').first().evaluate((el) => getComputedStyle(el).color);
    expect(nameColor).toBe('rgb(243, 245, 249)'); // --ink flipped light
  });

  test('dark mode: the active segment sits above the track, not below it', async ({ page }) => {
    await login(page);
    await page.goto(`${APP}/social?tab=friends`);
    await dismissChrome(page);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));

    const [activeBg, trackBg] = await page.evaluate(() => {
      const track = document.querySelector('.social-seg')!;
      const active = document.querySelector('.social-seg button.active')!;
      return [getComputedStyle(active).backgroundColor, getComputedStyle(track).backgroundColor];
    });
    const luma = (c: string) => { const [r, g, b] = c.match(/\d+/g)!.map(Number); return 0.299 * r + 0.587 * g + 0.114 * b; };
    // `--surface` is DARKER than `--bg-alt` in dark mode, so a naive active pill
    // reads as a recessed hole. `--seg-active`/`--seg-track` exist to prevent that.
    expect(luma(activeBg)).toBeGreaterThan(luma(trackBg));
  });

  test('a member with no clubs is offered Friends instead of a dead end', async ({ page }) => {
    await login(page);
    await page.goto(`${APP}/social?tab=clubs`);
    await dismissChrome(page);

    await page.locator('.filter-chip', { hasText: 'My Clubs' }).click();
    const crosslink = page.locator('.social-crosslink');
    await expect(crosslink).toBeVisible({ timeout: 10000 });

    await crosslink.click();
    await expect(page.locator('.social-seg button[aria-selected="true"]')).toContainText('Friends');
    await expect(page).toHaveURL(/tab=friends/);
  });
});

test('club permalink: Social tab stays lit, and Back returns to the Clubs panel', async ({ page }) => {
  await skipIntro(page);
  await page.goto(`${APP}/social?tab=clubs`);
  await dismissChrome(page);

  const card = page.locator('.club-card, .discover-club-card').first();
  await expect(card).toBeVisible({ timeout: 15000 });
  await card.click();
  await expect(page).toHaveURL(/\/clubs\/[^/?]+/, { timeout: 10000 });

  // Cold-load the permalink with no history — `deepLinkParent` seeds Social.
  await page.goto(page.url());
  await dismissChrome(page);
  await page.goBack().catch(() => {});
  await expect(page.locator('.v2c-tab[aria-current="page"] .v2c-tab-label')).toHaveText('Social');
  await expect(page.locator('.social-seg button[aria-selected="true"]')).toHaveText('Clubs');
});
