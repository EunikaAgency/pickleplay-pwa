/**
 * The filter sheet's "Who can play" row must sit on ONE line at phone width —
 * with the full phrases ("👩 Women only") the fourth chip dropped to a second row.
 *
 * Measured, not eyeballed: all four chips must share a top edge, none may spill
 * past the sheet, and the row must read like the Play type row above it.
 */
import { test, expect, type Browser, type Page } from '@playwright/test';

const APP = 'http://localhost:9000';
const API = 'http://localhost:9002';
const PLAYER = { email: '84a3be4a.hernandez@example.com', password: 'password123' };

async function playTab(browser: Browser): Promise<Page> {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(PLAYER),
  });
  const j = await res.json() as { data?: { accessToken?: string; refreshToken?: string } };
  if (!j.data?.accessToken) throw new Error('login failed');
  // 375px: the narrowest phone the design targets, where the wrap showed up.
  const ctx = await browser.newContext({ viewport: { width: 375, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(APP);
  await page.evaluate((tk) => {
    localStorage.setItem('pb-access-token', tk.accessToken!);
    localStorage.setItem('pb-refresh-token', tk.refreshToken!);
    sessionStorage.setItem('pb-splash-seen', '1');
  }, j.data);
  await page.goto(`${APP}/games`);
  return page;
}

test('the filter sheet\'s Who-can-play row fits on one line', async ({ browser }) => {
  const page = await playTab(browser);
  await page.getByRole('button', { name: /^Filter/ }).click();
  await expect(page.getByText('Who can play')).toBeVisible();

  // The row's own chips: everything between this heading and the next one.
  const row = page.locator('.field', { has: page.getByText('Who can play') }).first();
  const chips = row.getByRole('button');
  await expect(chips).toHaveCount(4);

  const boxes = await chips.evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect();
    return { text: (el.textContent || '').trim(), top: Math.round(r.top), right: r.right, overflows: el.scrollWidth > el.clientWidth + 1 };
  }));

  const tops = new Set(boxes.map((b) => b.top));
  expect(tops.size, `all four chips share one row (tops: ${[...tops].join(', ')})`).toBe(1);
  for (const b of boxes) {
    expect(b.overflows, `"${b.text}" should not overflow its chip`).toBe(false);
    expect(b.right, `"${b.text}" should stay inside the sheet`).toBeLessThanOrEqual(375);
  }

  await row.screenshot({ path: 'test-results/gender-filter-oneline.png' });
  await page.context().close();
});
