/**
 * Screenshot capture for the Weekly Progress Update (9–16 July 2026).
 *
 * Captures ONLY what changed after the 8 July meeting. Player flows at
 * 390x844; owner/staff console at 1440x900.
 *
 * Run: node e2e/_weekly-shots.mjs
 * Out: docs/weekly-assets/*.png
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const APP = 'http://localhost:9000';
const API = 'http://localhost:9002';
const OUT = '/var/public/pickleplay/docs/weekly-assets';

const PLAYER = { email: 'christianian.i.alcazar@gmail.com', password: 'password123' };
const OWNER  = { email: 'ccdfa3b7.walker@example.com',      password: 'password123' };
const STAFF  = { email: 'minutes.staff@example.com',        password: 'password123' };
const GEO = { latitude: 14.5995, longitude: 120.9842 };

const WOMEN_GAME = '6a56e7242efd24cf65be161c';   // Ladies' Open Play  (women-only)
const MEN_GAME   = '6a56e6fb2efd24cf65be1609';   // Men's Doubles Night

const log = [];

async function token(c) {
  const r = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c),
  });
  const j = await r.json();
  if (!j?.data?.accessToken) throw new Error('login failed: ' + c.email);
  return j.data.accessToken;
}

async function page(browser, creds, w, h) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h }, deviceScaleFactor: 2,
    isMobile: w < 700, hasTouch: w < 700,
    geolocation: GEO, permissions: ['geolocation'], locale: 'en-PH',
  });
  const p = await ctx.newPage();
  const t = creds ? await token(creds) : null;
  await p.goto(APP);
  await p.evaluate((tok) => {
    if (tok) { localStorage.setItem('pb-access-token', tok); localStorage.setItem('pb-refresh-token', tok); }
    sessionStorage.setItem('pb-splash-seen', '1');
  }, t);
  await p.addStyleTag({ content: '.install-prompt,.pwa-toast,.demo-state-control{display:none!important}' });
  return p;
}

async function shot(p, path, name, opts = {}) {
  await p.goto(`${APP}${path}`);
  await p.waitForTimeout(opts.wait ?? 2800);
  if (opts.before) await opts.before(p);
  await p.addStyleTag({ content: '.install-prompt,.pwa-toast{display:none!important}' });
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: !!opts.fullPage });
  const w = p.viewportSize().width;
  log.push(name);
  console.log(`  ✓ ${name.padEnd(26)} ${w < 700 ? 'mobile ' : 'desktop'} ${path}`);
}

const run = async () => {
  mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();

  /* ── PLAYER ─────────────────────────────────────────────────────────── */
  console.log('\nPLAYER (390x844)');
  const p = await page(b, PLAYER, 390, 844);

  await shot(p, '/', 'p01-home-openplay');                       // renamed button + new icons
  await shot(p, '/games?section=open-play&view=discover', 'p02-play-tabs');   // segmented tabs (was dropdown)
  await shot(p, '/games?section=games&view=discover', 'p03-events-tab');      // Events as a real tab

  // Who-can-play filter (new)
  await shot(p, '/games?section=open-play&view=discover', 'p04-whocanplay-filter', {
    before: async (pg) => {
      const f = pg.locator('button').filter({ hasText: /^Filter/i }).first();
      if (await f.count()) { await f.click(); await pg.waitForTimeout(1000); }
      const sheet = pg.locator('.sheet, [role="dialog"]').first();
      if (await sheet.count()) {
        await sheet.evaluate((el) => {
          const t = [...el.querySelectorAll('*')].find(n => /who can play/i.test(n.textContent || '') && n.children.length === 0);
          if (t) t.scrollIntoView({ block: 'center' });
        }).catch(() => {});
        await pg.waitForTimeout(600);
      }
    },
  });

  await shot(p, `/games/${WOMEN_GAME}`, 'p05-women-only-game');   // gender restriction on a game
  await shot(p, `/games/${MEN_GAME}`, 'p06-men-only-game');

  // PickleFeed — the new global newsfeed
  await shot(p, '/social?tab=feed', 'p07-picklefeed', { wait: 3600 });
  await shot(p, '/social', 'p08-social-sections');                 // Feed | Clubs | Friends

  // Public profile redesign
  await shot(p, '/players/6a193144dca893418141a0da', 'p09-public-profile');
  await shot(p, '/coaches/6a50bac40c585c0af26c8b4f', 'p10-coach-profile');

  // Organizer subscription — the licence to charge
  await shot(p, '/organizer/subscribe', 'p11-organizer-subscribe');

  // Messages redesign (tabs + unread counters)
  await shot(p, '/messages', 'p12-messages');

  // Edit profile — new required Gender field
  await shot(p, '/profile/edit', 'p13-gender-field', {
    before: async (pg) => {
      await pg.evaluate(() => {
        const el = [...document.querySelectorAll('label,div,span')]
          .find(n => /gender/i.test(n.textContent || '') && n.children.length === 0);
        if (el) el.scrollIntoView({ block: 'center' });
      });
      await pg.waitForTimeout(600);
    },
  });

  await p.context().close();

  /* ── OWNER ──────────────────────────────────────────────────────────── */
  console.log('\nOWNER (1440x900)');
  const o = await page(b, OWNER, 1440, 900);
  await shot(o, '/owner/partners', 'o01-partners-real-stats');    // real numbers (was invented)
  await shot(o, '/shop', 'o02-rental-coming-soon');               // rental now "Coming soon"
  await o.context().close();

  /* ── STAFF ──────────────────────────────────────────────────────────── */
  console.log('\nSTAFF (1440x900)');
  const s = await page(b, STAFF, 1440, 900);
  await shot(s, '/', 's01-staff-home-no-revenue');                // revenue gone (was ₱9,400)
  await s.context().close();

  await b.close();
  console.log(`\n${log.length} shots → ${OUT}\n`);
};

run().catch((e) => { console.error('FAILED:', e); process.exit(1); });
