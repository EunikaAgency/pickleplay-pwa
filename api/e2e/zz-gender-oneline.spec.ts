/**
 * The "Who can play" row must sit on ONE line at phone width — "Women only"
 * wrapped inside its chip at the default 14px, making the row two lines tall.
 *
 * Measured, not eyeballed: each chip's rendered height must equal a single line
 * box, and none may overflow its own width.
 */
import { test, expect, type Page } from '@playwright/test';

const APP = 'http://localhost:9000';
const API = 'http://localhost:9002';
const VENUE = '6a4f11a0a63522a6e14a427c';
const PLAYER = { email: 'johnkenneth.tan.dev+player@gmail.com', password: 'password123' };

async function tokens() {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(PLAYER),
  });
  const j = await res.json() as { data?: { accessToken?: string; refreshToken?: string } };
  if (!j.data?.accessToken || !j.data?.refreshToken) throw new Error('login failed');
  return { accessToken: j.data.accessToken, refreshToken: j.data.refreshToken };
}

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

for (const mode of ['Open play session', 'Hosted game'] as const) {
  test(`Who can play fits on one line — ${mode}`, async ({ browser }) => {
    const t = await tokens();
    // 375px: the narrowest phone the design targets, where the wrap showed up.
    const ctx = await browser.newContext({ viewport: { width: 375, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(APP);
    await page.evaluate((tk) => {
      localStorage.setItem('pb-access-token', tk.accessToken);
      localStorage.setItem('pb-refresh-token', tk.refreshToken);
      sessionStorage.setItem('pb-splash-seen', '1');
    }, t);
    await page.goto(`${APP}/book?venueId=${VENUE}`);
    await toDetailsStep(page, mode);

    const chips = page.locator('.time-pick.one-line');
    await expect(chips).toHaveCount(3);

    const boxes = await chips.evaluateAll((els) => els.map((el) => {
      const cs = getComputedStyle(el);
      const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
      const padding = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const border = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
      return {
        text: (el.textContent || '').trim(),
        height: el.getBoundingClientRect().height,
        oneLineHeight: lineHeight + padding + border,
        overflows: el.scrollWidth > el.clientWidth + 1,
      };
    }));

    for (const b of boxes) {
      // A wrapped label would be a whole line box taller than a single-line chip.
      expect(b.height, `"${b.text}" should be one line tall`).toBeLessThan(b.oneLineHeight + 4);
      expect(b.overflows, `"${b.text}" should not overflow its chip`).toBe(false);
    }

    // All three chips share one row: same top edge.
    const tops = await chips.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(new Set(tops).size, 'all three chips sit on the same row').toBe(1);

    await page.locator('.field', { hasText: 'Who can play' }).first()
      .screenshot({ path: `test-results/gender-oneline-${mode.split(' ')[0].toLowerCase()}.png` });
    await ctx.close();
  });
}
