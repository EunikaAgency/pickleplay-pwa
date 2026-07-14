/**
 * Play tab E2E — the Discover feed is ranked by the SERVER now, and Open Play and
 * Events sit side by side as visible tabs (§3.3 / §3.4 of the 8 July minutes).
 *
 * Prerequisites:
 *   1. API running on localhost:9002 with seeded data
 *   2. App running on localhost:9000
 *
 * Run: npx playwright test --config=playwright.config.ts play-discover
 *
 * The Play tab is public, so these run as a guest — which is also the cold-start
 * case the ranker has to degrade cleanly for (no location, no skill, no friends).
 */

import { test, expect, type Page, type Request } from '@playwright/test';

const APP = 'http://localhost:9000';
const API_BASE = 'http://localhost:9002/api/v1';

// The launch splash is a once-per-session overlay that sits on top of everything
// until "Let's Play" is tapped. Locators still FIND elements behind it, so an
// assertion can pass while a click times out — mark it seen before the app boots.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('pb-splash-seen', '1'));
});

/** Every /play/discover call the page makes. */
function trackDiscover(page: Page): Request[] {
  const calls: Request[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/play/discover')) calls.push(r);
  });
  return calls;
}

test.describe('Play Discover — server-ranked feed', () => {
  test('the Play tab loads its feed from /play/discover, and renders the cards it returns', async ({ page }) => {
    const calls = trackDiscover(page);
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto(`${APP}/games`);
    await page.waitForLoadState('networkidle');

    // The screen asked the server to rank, rather than ranking on the device.
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0].url()).toContain('section=open-play');

    // And what came back is what's on screen.
    const res = await page.request.get(
      'http://localhost:9002/api/v1/play/discover?section=open-play&pageSize=50',
    );
    const body = await res.json();
    expect(body.data.length).toBeGreaterThan(0);

    const cards = page.locator('.game-card');
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });

    // The top-ranked listing's venue is on the page — the server's #1 is the
    // user's #1. If the client re-ranked, this would drift.
    await expect(page.getByText(body.data[0].venueName, { exact: false }).first()).toBeVisible();

    expect(errors.filter((e) => !e.includes('favicon'))).toEqual([]);
  });

  test('the old client-side ranking sources are no longer fetched for Discover', async ({ page }) => {
    // The screen used to pull the public games list and rank it locally. If that
    // request comes back, two rankers are live again and they will drift.
    const publicGameCalls: string[] = [];
    page.on('request', (r) => {
      const u = r.url();
      if (u.includes('/games?') && u.includes('status=published')) publicGameCalls.push(u);
    });

    await page.goto(`${APP}/games`);
    await page.waitForLoadState('networkidle');

    expect(publicGameCalls).toEqual([]);
  });

  test('the ranked order is stable across a reload — it is the server\'s, not the device\'s', async ({ page }) => {
    await page.goto(`${APP}/games`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.game-card').first()).toBeVisible({ timeout: 10_000 });

    const first = await page.locator('.game-card').first().innerText();

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.game-card').first()).toBeVisible({ timeout: 10_000 });

    // Same viewer, same inputs, same order.
    expect(await page.locator('.game-card').first().innerText()).toBe(first);
  });
});

test.describe('Discover filters (§4.3)', () => {
  async function openFilters(page: Page) {
    await page.goto(`${APP}/games`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.game-card').first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /filter/i }).first().click();
  }

  test('the four new filters are offered', async ({ page }) => {
    await openFilters(page);
    // The meeting asked for free/paid, public/invite-only, recurring/one-time, venue.
    await expect(page.getByText('Cost to join')).toBeVisible();
    await expect(page.getByText('Who can join')).toBeVisible();
    await expect(page.getByText('How often')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Venue' })).toBeVisible();
  });

  test('"Weekly" narrows the feed to recurring sessions, and clearing restores it', async ({ page }) => {
    await openFilters(page);
    const before = await page.locator('.game-card').count();

    await page.getByRole('button', { name: 'Weekly', exact: true }).click();
    await page.getByRole('button', { name: /show|apply/i }).last().click();
    await page.waitForTimeout(500);

    const after = await page.locator('.game-card').count();
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);

    // A filter that empties the feed with no way back is the failure mode here.
    await page.getByRole('button', { name: /clear|reset/i }).first().click();
    await page.waitForTimeout(500);
    expect(await page.locator('.game-card').count()).toBe(before);
  });

  test('"Free" keeps the free-to-join games whose card shows the venue\'s court rate', async ({ page }) => {
    // The whole point of joinFee: a player-hosted game is free to join even when its
    // card reads "₱350" — that is what the COURT cost the host, not what you pay.
    const res = await page.request.get(`${API_BASE}/play/discover?section=open-play&pageSize=200`);
    const items = (await res.json()).data as { joinFee: number | null; priceLabel: string | null }[];
    const freeButPriced = items.filter((i) => i.joinFee === null && i.priceLabel);
    expect(freeButPriced.length).toBeGreaterThan(0); // the trap exists in real data

    await openFilters(page);
    await page.getByRole('button', { name: 'Free', exact: true }).click();
    await page.getByRole('button', { name: /show|apply/i }).last().click();
    await page.waitForTimeout(500);

    // Had the filter been built on priceLabel, these would all have been hidden.
    expect(await page.locator('.game-card').count()).toBeGreaterThanOrEqual(freeButPriced.length);
  });
});

test.describe('Play sections — Open Play and Events, side by side', () => {
  test('both sections are visible as tabs — neither is hidden behind a dropdown', async ({ page }) => {
    await page.goto(`${APP}/games`);
    await page.waitForLoadState('networkidle');

    // The whole point of §3.4: a player who never opens a menu must still be able
    // to SEE that Events exists.
    await expect(page.locator('.section-tab')).toHaveCount(2);
    expect(await page.locator('.section-tab').allInnerTexts()).toEqual(['Open Play', 'Events']);

    // The dropdown that used to hide Events is gone.
    await expect(page.locator('.section-dropdown')).toHaveCount(0);
  });

  test('a bare Play tap opens on Open Play, not Events (§3.3)', async ({ page }) => {
    await page.goto(`${APP}/games`);
    await page.waitForLoadState('networkidle');

    // It used to land on Events, so the most common player need sat one hidden
    // dropdown away while the least common one greeted them.
    await expect(page.locator('.section-tab.active')).toHaveText('Open Play');
    await expect(page.locator('.games-subheading')).toContainText('Open play');
  });

  test('tapping Events switches section and refetches that section\'s ranked feed', async ({ page }) => {
    const calls = trackDiscover(page);

    await page.goto(`${APP}/games`);
    await page.waitForLoadState('networkidle');
    expect(calls.at(-1)!.url()).toContain('section=open-play');

    await page.getByRole('tab', { name: 'Events' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.section-tab.active')).toHaveText('Events');
    // Events is a different product with a different candidate set — it must be
    // ranked as one, not sliced out of the Open Play feed on the device.
    expect(calls.at(-1)!.url()).toContain('section=events');
  });

  test('the chosen section survives a reload', async ({ page }) => {
    await page.goto(`${APP}/games`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: 'Events' }).click();
    await page.waitForLoadState('networkidle');

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.section-tab.active')).toHaveText('Events');
  });
});
