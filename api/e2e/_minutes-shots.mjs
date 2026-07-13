/**
 * Screenshot capture for the Updated Minutes of the Meeting (2026-07-08) PDF.
 *
 * Drives the REAL running PWA (:9000 against the API on :9002) and captures the
 * interfaces referenced by each section of the minutes. Mobile shots use a
 * 390x844 phone viewport (player-facing flows); desktop shots use 1440x900
 * (owner/staff management surfaces).
 *
 * Run:  node e2e/_minutes-shots.mjs
 * Out:  docs/minutes-assets/*.png
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const APP = 'http://localhost:9000';
const API = 'http://localhost:9002';
const OUT = '/var/public/pickleplay/docs/minutes-assets';

const PLAYER = { email: 'christianian.i.alcazar@gmail.com', password: 'password123' };
const OWNER  = { email: 'ccdfa3b7.walker@example.com',      password: 'password123' };
const STAFF  = { email: 'minutes.staff@example.com',        password: 'password123' };

// Manila-ish coords so distance-dependent UI (proximity, "km away") renders.
const GEO = { latitude: 14.5995, longitude: 120.9842 };

const shots = [];

async function token({ email, password }) {
  const r = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json();
  if (!j?.data?.accessToken) throw new Error(`login failed for ${email}: ${JSON.stringify(j).slice(0, 160)}`);
  return j.data.accessToken;
}

/** A signed-in page at a given viewport, with splash + install banner suppressed. */
async function makePage(browser, creds, width, height) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,              // retina — stays sharp when scaled down in the PDF
    isMobile: width < 700,
    hasTouch: width < 700,
    geolocation: GEO,
    permissions: ['geolocation'],
    locale: 'en-PH',
  });
  const page = await ctx.newPage();
  const t = creds ? await token(creds) : null;
  await page.goto(APP);
  await page.evaluate((tok) => {
    if (tok) {
      localStorage.setItem('pb-access-token', tok);
      localStorage.setItem('pb-refresh-token', tok);
    }
    sessionStorage.setItem('pb-splash-seen', '1');   // once-per-session splash covers everything
  }, t);
  await page.addStyleTag({ content: `
    .install-prompt, .pwa-toast, .demo-state-control { display: none !important; }
  ` });
  return page;
}

/** Navigate, settle, screenshot. */
async function shot(page, path, name, note, opts = {}) {
  await page.goto(`${APP}${path}`);
  await page.waitForTimeout(opts.wait ?? 2600);       // let fetches + skeletons resolve
  if (opts.before) await opts.before(page);
  await page.addStyleTag({ content: '.install-prompt,.pwa-toast{display:none!important}' });
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file, fullPage: !!opts.fullPage });
  const w = page.viewportSize().width;
  shots.push({ name, path, note, device: w < 700 ? `mobile ${w}px` : `desktop ${w}px` });
  console.log(`  ✓ ${name.padEnd(28)} ${w < 700 ? 'mobile ' : 'desktop'}  ${path}`);
  return file;
}

const run = async () => {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  /* ── Open-play + lobby game ids (real seeded rows) ───────────────────── */
  const openId  = '6a4618d7e3144c4c4d9df8a4';   // Social Mix-In Saturday  (gameType: open)
  const lobbyId = '6a4618d7e3144c4c4d9df8a3';   // Morning Dinks @ Zone    (lobby game)

  /* ── MOBILE — player-facing ──────────────────────────────────────────── */
  console.log('\nMOBILE (390x844, player)');
  const p = await makePage(browser, PLAYER, 390, 844);

  await shot(p, '/', 'm01-home',
    'Player home: the three quick actions (Play / Book Court / Find Coach).');

  await shot(p, '/games?section=open-play&view=discover', 'm02-discover',
    'Play tab: Open Play | Events sections, Discover open by default, ranked listing cards.');

  await shot(p, '/games?section=open-play&view=discover', 'm03-filters',
    'The filter sheet: date, skill, play type, openings, distance.', {
      before: async (pg) => {
        const b = pg.locator('button').filter({ hasText: /^Filter/i }).first();
        if (await b.count()) { await b.click(); await pg.waitForTimeout(900); }
      },
    });

  await shot(p, '/games?section=open-play&view=discover', 'm04-sort',
    'The sort menu: Relevance, Start time, Distance, Spots left, Recently added.', {
      before: async (pg) => {
        const b = pg.locator('button').filter({ hasText: /Relevance|Sort/i }).first();
        if (await b.count()) { await b.click(); await pg.waitForTimeout(900); }
      },
    });

  await shot(p, '/games?section=games&view=discover', 'm05-events',
    'The Events section — a sibling tab beside Open Play, not hidden in a dropdown.');

  await shot(p, '/games?section=open-play&view=invites', 'm06-invites',
    'The Invites view for Open Play.');

  await shot(p, `/open-play/${openId}`, 'm07-openplay-detail',
    'Open Play detail as it ships today: an interest-based "I\'m Interested" action. No lobby, roster or chat.');

  await shot(p, `/games/${lobbyId}`, 'm08-game-lobby',
    'The organizer/game lobby that DOES exist — roster, host, join state — for contrast with Open Play.');

  await shot(p, `/games/${lobbyId}/chat`, 'm09-game-chat',
    'The existing game-roster group chat. The machinery exists but is not attached to Open Play.');

  await shot(p, '/social', 'm10-social-clubs',
    'The Social tab: Clubs | Friends switch, replacing the old Clubs-only tab.');

  await shot(p, '/social?tab=friends', 'm11-social-friends',
    'The Friends panel inside Social — friends were previously buried in the profile.');

  await shot(p, '/coaches', 'm12-find-coach',
    'Find Coach: the directory of actively subscribed coaches, with search.');

  await shot(p, '/coach/subscribe', 'm13-coach-subscribe',
    'The coach subscription — PHP 499 / 30 days, the platform\'s live revenue mechanism.');

  await p.context().close();

  /* ── DESKTOP — owner ─────────────────────────────────────────────────── */
  console.log('\nDESKTOP (1440x900, owner)');
  const o = await makePage(browser, OWNER, 1440, 900);

  await shot(o, '/owner/manual-reservation', 'd01-manual-reservation',
    'Owner Manual Reservation: court, date, time, customer, amount, source (Walk-in / Phone / Messenger / Instagram / Other).');

  await shot(o, '/owner/calendar', 'd02-owner-calendar',
    'The owner booking calendar — where a manual reservation lands and blocks the court.');

  await shot(o, '/owner/front-desk', 'd03-front-desk',
    'The Front Desk — day-to-day venue operations, available to both owners and staff.');

  await shot(o, '/owner/reports', 'd04-owner-reports',
    'The owner Reports page — revenue and business data. This is what staff cannot see.');

  await shot(o, '/owner/venues', 'd05-owner-venues',
    'Owner venue list — the owner has the Delete option.');

  await o.context().close();

  /* ── DESKTOP — staff (restricted) ────────────────────────────────────── */
  console.log('\nDESKTOP (1440x900, staff)');
  const s = await makePage(browser, STAFF, 1440, 900);

  await shot(s, '/owner/venues', 'd06-staff-venues',
    'The SAME venue list signed in as staff: venues inherited from the owner, no Delete, no Reports in the sidebar.');

  await shot(s, '/profile', 'd07-staff-profile',
    'The staff profile — owner analytics (venue/court counts, revenue) are absent, and the role reads "Staff".');

  await s.context().close();

  /* ── DESKTOP — organizer recurring open play ─────────────────────────── */
  console.log('\nDESKTOP (1440x900, organizer surface)');
  const g = await makePage(browser, OWNER, 1440, 900);
  await shot(g, '/organizer/open-play', 'd08-organizer-openplay',
    'Recurring Open Play as it exists today — an organizer-side series, not yet available to ordinary venue owners.');
  await g.context().close();

  await browser.close();

  console.log(`\n${shots.length} screenshots → ${OUT}\n`);
  console.log(JSON.stringify(shots, null, 1));
};

run().catch((e) => { console.error('FAILED:', e); process.exit(1); });
