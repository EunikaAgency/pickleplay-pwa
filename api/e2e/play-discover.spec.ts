/**
 * Play Discover E2E — the feed is ranked by the SERVER now, not the device.
 *
 * Prerequisites:
 *   1. API running on localhost:9002 with seeded data
 *   2. App running on localhost:9000
 *
 * Run: npx playwright test --config=playwright.config.ts play-discover
 *
 * The Play tab is public, so these run as a guest (which is also the cold-start
 * case the ranker has to degrade cleanly for — no location, no skill, no friends).
 */

import { test, expect, type Page, type Request } from '@playwright/test';

const APP = 'http://localhost:9000';

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

    // A bare `/games` opens on Events; the section lives in `?section=`.
    await page.goto(`${APP}/games?section=open-play`);
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
    expect(await cards.count()).toBeGreaterThan(0);

    // The top-ranked listing's venue should be on the page — the server's #1 is
    // the user's #1. If the client re-ranked, this would drift.
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

  test('each section asks the server for its own ranked feed', async ({ page }) => {
    const calls = trackDiscover(page);

    await page.goto(`${APP}/games?section=open-play`);
    await page.waitForLoadState('networkidle');
    expect(calls.at(-1)!.url()).toContain('section=open-play');

    // Events is a different product with a different candidate set — it must be
    // ranked as one, not sliced out of the Open Play feed on the device.
    await page.goto(`${APP}/games?section=games`);
    await page.waitForLoadState('networkidle');
    expect(calls.at(-1)!.url()).toContain('section=events');
  });

  test('the ranked order is stable across a reload — it is the server\'s, not the device\'s', async ({ page }) => {
    await page.goto(`${APP}/games?section=open-play`);
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
