import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'https://pickleballer-pwa.eunika.xyz';
const OUT = '/var/public/pickleplay/reports/2026-07-16-demo-shots';
fs.mkdirSync(OUT, { recursive: true });

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

const results = [];
const log = (...a) => console.log('[cap]', ...a);

async function newCtx(browser, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  ctx.setDefaultTimeout(25000);
  return ctx;
}

async function settle(page, ms = 1200) {
  try { await page.waitForLoadState('networkidle', { timeout: 15000 }); } catch {}
  await page.waitForTimeout(ms);
}

// Log in via quick-test button (by label) or email/password for staff.
async function login(page, { label, email, password }) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle(page, 1500);
  if (label) {
    // A .footer-stack landing overlay intercepts pointer events on /login, so
    // dispatch the click via JS to bypass interception.
    await page.evaluate((lbl) => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === lbl);
      b?.click();
    }, label);
  } else {
    // type into email + password, then JS-click the submit button
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passInput = page.locator('input[type="password"]').first();
    await emailInput.fill(email);
    await passInput.fill(password);
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button[type="submit"], button')]
        .find(x => /^(sign in|log in|login)$/i.test(x.textContent.trim()));
      b?.click();
    });
  }
  // wait for navigation away from /login
  await page.waitForFunction(() => !location.pathname.startsWith('/login'), { timeout: 20000 }).catch(()=>{});
  await settle(page, 1500);
  log('logged in as', label || email, '->', page.url());
}

async function shot(page, name, { full = true, before } = {}) {
  try {
    if (before) await before();
    await page.waitForTimeout(400);
    const path = `${OUT}/${name}.png`;
    await page.screenshot({ path, fullPage: full });
    results.push({ name, ok: true });
    log('SHOT', name, 'OK');
  } catch (e) {
    results.push({ name, ok: false, err: String(e).split('\n')[0] });
    log('SHOT', name, 'FAIL', String(e).split('\n')[0]);
  }
}

async function nav(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle(page);
}

const browser = await chromium.launch();

/* ============ PLAYER 1 (mobile) ============ */
try {
  const ctx = await newCtx(browser, MOBILE);
  const page = await ctx.newPage();
  await login(page, { label: 'Player 1', email: '84a3be4a.hernandez@example.com', password: 'password123' });

  // 6. Player home
  await nav(page, '/');
  await shot(page, 'player-home');

  // 1. PickleFeed
  await nav(page, '/social?tab=feed');
  await shot(page, 'picklefeed');

  // 1b. open a feed post (first post card link)
  await shot(page, 'picklefeed-post', { before: async () => {
    // click first post that navigates to /feed/
    const link = page.locator('a[href^="/feed/"], [data-post-id]').first();
    if (await link.count()) { await link.click(); await settle(page); }
    else {
      // fallback: click first article/post card
      const card = page.locator('article, [class*="post"]').first();
      if (await card.count()) { await card.click(); await settle(page); }
    }
  }});

  // 4/7. Play Discover (open play)
  await nav(page, '/games?section=open-play&view=discover');
  await shot(page, 'play-discover');

  // 7b. Sort menu open
  await shot(page, 'play-discover-sort', { full: false, before: async () => {
    const b = page.locator('button[aria-label^="Sort plays"]').first();
    await b.click({force:true}); await page.waitForTimeout(600);
  }});

  // 3/7c. Filter sheet open (Who can play)
  await nav(page, '/games?section=open-play&view=discover');
  await shot(page, 'play-discover-filter', { before: async () => {
    const b = page.locator('button[aria-label^="Filter plays"]').first();
    await b.click({force:true}); await page.waitForTimeout(800);
  }});

  // 3b. gender-restricted card + 2. Not Eligible detail
  await nav(page, '/games?section=open-play&view=discover');
  await shot(page, 'play-discover-gender-cards');
  // open a women/men restricted game -> detail with Not eligible chip
  await shot(page, 'eligibility-not-eligible', { before: async () => {
    // find a card mentioning Women or Men restriction
    const women = page.getByText(/Women/i).first();
    const men = page.getByText(/\bMen\b/i).first();
    let target = null;
    if (await women.count()) target = women;
    else if (await men.count()) target = men;
    if (target) {
      // click the enclosing card
      await target.scrollIntoViewIfNeeded();
      await target.click({ timeout: 5000 }).catch(async () => {
        await target.locator('xpath=ancestor::*[self::a or self::button or contains(@class,"card")][1]').first().click();
      });
      await settle(page);
    }
  }});

  // 8. Find Coach
  await nav(page, '/coaches');
  await shot(page, 'find-coach');
  // coach profile
  await shot(page, 'coach-profile', { before: async () => {
    const link = page.locator('a[href^="/coaches/"]').first();
    if (await link.count()) { await link.click(); await settle(page); }
    else {
      const card = page.locator('[class*="coach"], article, li').first();
      if (await card.count()) { await card.click(); await settle(page); }
    }
  }});
  const coachDetailUrl = page.url();
  // book a session (calendar picker)
  await shot(page, 'book-coach-calendar', { before: async () => {
    const bookBtn = page.getByRole('button', { name: /book/i }).first();
    if (await bookBtn.count()) { await bookBtn.click(); await settle(page); }
    else if (coachDetailUrl.includes('/coaches/')) { await nav(page, coachDetailUrl.replace(BASE,'') + '/book'); }
  }});

  // 8b. Become a coach subscription ₱499
  await nav(page, '/coach/subscribe');
  await shot(page, 'coach-subscribe-499');

  // 9. Clubs
  await nav(page, '/social?tab=clubs');
  await shot(page, 'social-clubs');
  // 9b. Friends
  await nav(page, '/social?tab=friends');
  await shot(page, 'social-friends');

  await ctx.close();
} catch (e) { log('PLAYER FLOW ERROR', String(e).split('\n')[0]); }

/* ============ ORGANIZER 1 (mobile) ============ */
try {
  const ctx = await newCtx(browser, MOBILE);
  const page = await ctx.newPage();
  await login(page, { label: 'Organizer 1', email: '556b9e79.matthews@example.com', password: 'password123' });
  await nav(page, '/organizer/subscribe');
  await shot(page, 'organizer-subscribe-999');
  // organizer hub as bonus context
  await nav(page, '/organizer');
  await shot(page, 'organizer-hub');
  await ctx.close();
} catch (e) { log('ORGANIZER FLOW ERROR', String(e).split('\n')[0]); }

/* ============ OWNER 1 (desktop) ============ */
try {
  const ctx = await newCtx(browser, DESKTOP);
  const page = await ctx.newPage();
  await login(page, { label: 'Owner 1', email: 'ccdfa3b7.walker@example.com', password: 'password123' });

  await nav(page, '/messages');
  await shot(page, 'owner-messages-shared-inbox', { full: false });

  await nav(page, '/owner/manual-reservation');
  await shot(page, 'owner-manual-reservation', { full: false });

  await nav(page, '/owner/calendar');
  await shot(page, 'owner-calendar', { full: false });

  await nav(page, '/owner/pricing');
  await shot(page, 'owner-pricing-override', { full: false });

  await nav(page, '/owner/partners');
  await shot(page, 'owner-partners', { full: false });

  await nav(page, '/owner/reports');
  await shot(page, 'owner-reports', { full: false });

  await nav(page, '/owner/insights');
  await shot(page, 'owner-insights', { full: false });

  await nav(page, '/owner/venues/v2');
  await shot(page, 'owner-venues', { full: false });

  await ctx.close();
} catch (e) { log('OWNER FLOW ERROR', String(e).split('\n')[0]); }

/* ============ STAFF (desktop) ============ */
try {
  const ctx = await newCtx(browser, DESKTOP);
  const page = await ctx.newPage();
  await login(page, { email: 'staff@example.com', password: 'password123' });

  await nav(page, '/owner/venues/v2');
  await shot(page, 'staff-venues-no-delete', { full: false });

  await nav(page, '/');
  await shot(page, 'staff-home', { full: false });
  await ctx.close();
} catch (e) { log('STAFF FLOW ERROR', String(e).split('\n')[0]); }

await browser.close();

console.log('\n===== MANIFEST =====');
for (const r of results) console.log(`${r.ok ? 'OK ' : 'XX '} ${r.name}${r.err ? '  ('+r.err+')' : ''}`);
console.log('Total OK:', results.filter(r=>r.ok).length, '/', results.length);
