/**
 * The shared `BottomSheet` (26 screens use it) must behave differently by width:
 *
 *  - phone  → bottom drawer, full-bleed, only the TOP corners rounded
 *  - desktop → modal centred on the VIEWPORT, all four corners rounded, capped
 *              so the footer never falls below the bottom edge
 *
 * This regressed once already: two desktop CSS blocks fought each other
 * (`top: 50vh !important` from one, `transform: translateY(0)` from a later
 * one), pinning the panel at mid-height so it grew off the bottom of the screen.
 * Keep desktop sheet positioning in ONE place.
 */
import { test, expect, type Browser, type Page } from '@playwright/test';

const APP = 'http://localhost:9000';
const API = 'http://localhost:9002';
const PLAYER = { email: 'christianian.i.alcazar@gmail.com', password: 'password123' };

async function signedInPage(browser: Browser, width: number, height: number, path: string): Promise<Page> {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(PLAYER),
  });
  const j = await res.json() as { data?: { accessToken?: string; refreshToken?: string } };
  if (!j.data?.accessToken) throw new Error('login failed');

  const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
  await page.goto(APP);
  await page.evaluate((t) => {
    localStorage.setItem('pb-access-token', t.accessToken!);
    localStorage.setItem('pb-refresh-token', t.refreshToken!);
    sessionStorage.setItem('pb-splash-seen', '1');
  }, j.data);
  // Never `networkidle` — the app holds an open SSE stream to /me/stream.
  await page.goto(`${APP}${path}`);
  return page;
}

/** Open the coach promo sheet and wait for its slide/fade to FINISH.
 *
 *  Wait on `transitionend` for `transform`, not on a fixed sleep and not on
 *  geometry "stability": right after the click the transition hasn't started,
 *  so the box is briefly stable at its CLOSED position and a naive poll happily
 *  measures the parked drawer (bottom: 1502 in an 844px viewport). */
async function openCoachSheet(page: Page) {
  // Select by TEXT, never `.first()`: before /me restores there is no coaching
  // banner, so the first `.upgrade-banner` on the page is "Unlock Full Stats" —
  // clicking it opens nothing and the suite fails intermittently.
  const banner = page.locator('.upgrade-banner').filter({ hasText: 'Coach on PickleBallers' });
  await banner.waitFor({ state: 'visible', timeout: 20_000 });
  await banner.click();
  await page.waitForSelector('.sheet.open', { timeout: 20_000 });
  await page.evaluate(() => new Promise<void>((resolve) => {
    const s = document.querySelector('.sheet.open');
    if (!s) return resolve();
    const finish = () => { s.removeEventListener('transitionend', onEnd); resolve(); };
    const onEnd = (e: Event) => {
      if ((e as TransitionEvent).propertyName === 'transform') finish();
    };
    s.addEventListener('transitionend', onEnd);
    // Fallback for prefers-reduced-motion / an already-settled panel.
    setTimeout(finish, 1500);
  }));
  // One more frame so the final position is committed before we read it.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

interface SheetBox {
  top: number; bottom: number; left: number; right: number;
  vw: number; vh: number; radius: string;
  footerBottom: number | null; bodyScrolls: boolean;
  /** The footer is the last child and paints an opaque background — if it
   *  doesn't inherit the bottom radius, the panel LOOKS square-cornered even
   *  though `.sheet` computes to 24px. Assert on what's painted. */
  footerBottomRadius: string;
  bottomCornersPaintedSquare: boolean;
}

async function measure(page: Page): Promise<SheetBox> {
  return page.evaluate(() => {
    const s = document.querySelector('.sheet.open')!;
    const r = s.getBoundingClientRect();
    const body = s.querySelector('.sheet-body')!;
    const f = s.querySelector('.sheet-footer');
    // A few px inside each bottom corner: on a rounded panel those pixels fall
    // OUTSIDE the shape, so they must not hit the sheet or its footer.
    const probe = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y);
      return !!(el && (el === s || s.contains(el)));
    };
    const inset = 3;
    const squareBL = probe(Math.round(r.left + inset), Math.round(r.bottom - inset));
    const squareBR = probe(Math.round(r.right - inset), Math.round(r.bottom - inset));
    return {
      top: Math.round(r.top), bottom: Math.round(r.bottom),
      left: Math.round(r.left), right: Math.round(r.right),
      vw: window.innerWidth, vh: window.innerHeight,
      radius: getComputedStyle(s).borderRadius,
      footerBottom: f ? Math.round(f.getBoundingClientRect().bottom) : null,
      bodyScrolls: body.scrollHeight > body.clientHeight + 1,
      footerBottomRadius: f ? getComputedStyle(f).borderBottomLeftRadius : '0px',
      bottomCornersPaintedSquare: squareBL || squareBR,
    };
  });
}

for (const [w, h] of [[1280, 900], [1680, 1000], [1440, 720], [820, 1180]] as const) {
  test(`desktop ${w}x${h}: sheet is centred on the viewport, fully rounded, never cut off`, async ({ browser }) => {
    const page = await signedInPage(browser, w, h, '/profile');
    await openCoachSheet(page);
    const m = await measure(page);

    // Fully inside the viewport — the whole bug was the bottom hanging off.
    expect(m.top, 'top edge on screen').toBeGreaterThanOrEqual(0);
    expect(m.bottom, 'bottom edge on screen').toBeLessThanOrEqual(m.vh);

    // Centred both ways, on the VIEWPORT (not the content column beside the sidebar).
    expect(Math.abs((m.top + m.bottom) / 2 - m.vh / 2), 'vertically centred').toBeLessThanOrEqual(2);
    expect(Math.abs((m.left + m.right) / 2 - m.vw / 2), 'horizontally centred').toBeLessThanOrEqual(2);

    // All four corners rounded (the drawer only rounds the top two)...
    expect(m.radius, 'all corners rounded').toBe('24px');
    // ...and actually PAINTED that way. `.sheet` computing 24px isn't enough:
    // the opaque footer squared off the bottom corners until it inherited it.
    expect(m.footerBottomRadius, 'footer inherits the bottom radius').toBe('24px');
    expect(m.bottomCornersPaintedSquare, 'bottom corners must not be painted square').toBe(false);

    // The primary action is reachable.
    expect(m.footerBottom!, 'footer on screen').toBeLessThanOrEqual(m.vh);

    await page.context().close();
  });
}

test('phone: sheet stays a bottom drawer with only the top corners rounded', async ({ browser }) => {
  const page = await signedInPage(browser, 390, 844, '/profile');
  await openCoachSheet(page);
  const m = await measure(page);

  expect(m.bottom, 'docked to the bottom edge').toBe(m.vh);
  expect(m.radius, 'top corners only').toMatch(/^28px 28px 0px 0px$/);
  // The drawer's bottom sits off the screen edge — square there is correct.
  expect(m.footerBottomRadius, 'no bottom radius on the drawer').toBe('0px');

  await page.context().close();
});

test('short desktop viewport: body scrolls internally, footer still visible', async ({ browser }) => {
  const page = await signedInPage(browser, 1280, 480, '/profile');
  await openCoachSheet(page);
  const m = await measure(page);

  expect(m.top).toBeGreaterThanOrEqual(0);
  expect(m.bottom).toBeLessThanOrEqual(m.vh);
  expect(m.bodyScrolls, 'content scrolls inside the sheet rather than overflowing it').toBe(true);
  expect(m.footerBottom!, 'footer still reachable').toBeLessThanOrEqual(m.vh);

  await page.context().close();
});

test('a CLOSED sheet does not swallow clicks at the centre of the desktop viewport', async ({ browser }) => {
  const page = await signedInPage(browser, 1680, 1000, '/profile');
  await page.waitForSelector('.upgrade-banner', { timeout: 20_000 });
  await page.waitForTimeout(500);

  const swallows = await page.evaluate(() => {
    const s = document.querySelector('.sheet')!;
    const el = document.elementFromPoint(Math.round(window.innerWidth / 2), Math.round(window.innerHeight / 2));
    return !!(el && (el === s || s.contains(el)));
  });
  expect(swallows, 'the invisible, centred, closed panel must be click-through').toBe(false);

  await page.context().close();
});
