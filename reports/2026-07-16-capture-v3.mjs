import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'https://pickleballer-pwa.eunika.xyz';
const OUT = '/var/public/pickleplay/reports/2026-07-16-demo-shots';
const PW = 'password123';
fs.mkdirSync(OUT, { recursive: true });
const MOBILE = { width: 390, height: 844 }, DESKTOP = { width: 1440, height: 900 };
const results = [];
const log = (...a) => console.log('[cap]', ...a);

async function newCtx(browser, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  ctx.setDefaultTimeout(25000);
  await ctx.addInitScript(() => { try { sessionStorage.setItem('pb-splash-seen', '1'); } catch {} });
  return ctx;
}
async function settle(page, ms = 1000) {
  try { await page.waitForLoadState('networkidle', { timeout: 15000 }); } catch {}
  await page.evaluate(() => document.querySelectorAll('.pb-splash').forEach(n => n.remove())).catch(()=>{});
  await page.waitForTimeout(ms);
}
const heading = (page) => page.evaluate(() => (document.querySelector('h1,h2')?.textContent||'').trim().replace(/\s+/g,' ').slice(0,44)||'(none)').catch(()=>'(err)');

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle(page, 900);
  await page.locator('input[type="email"], input[name="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(PW);
  await page.waitForTimeout(250);
  await page.evaluate(() => { const b=[...document.querySelectorAll('button[type="submit"],button')].find(x=>/^(sign in|log in|login)$/i.test(x.textContent.trim())); b?.click(); });
  await page.waitForFunction(() => !location.pathname.startsWith('/login'), { timeout: 18000 }).catch(()=>{});
  await settle(page, 1600);
  const h = await heading(page);
  log('login', email, '-> H:', h);
  return h;
}
// SPA navigation — NO full reload, so the auth session in memory is preserved
// (a full goto() reload races the async session-restore and flashes the guest login screen).
async function nav(page, path) {
  await page.evaluate((p) => {
    const idx = ((window.history.state && window.history.state.pbIdx) || 0) + 1;
    window.history.pushState({ pbIdx: idx }, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await settle(page);
}
async function shot(page, name, { full = false, before } = {}) {
  try {
    if (before) await before();
    await settle(page, 450);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
    const h = await heading(page);
    const bad = /create your free account/i.test(h);
    results.push({ name, ok: !bad, h });
    log(bad ? 'BADAUTH' : 'SHOT', name, '| H:', h);
  } catch (e) { results.push({ name, ok:false, err:String(e).split('\n')[0] }); log('FAIL', name, String(e).split('\n')[0]); }
}

const browser = await chromium.launch();

/* PLAYER (mobile) — hernandez. Also grab both subscribe upsells (any logged-in user can view them). */
try {
  const ctx = await newCtx(browser, MOBILE); const page = await ctx.newPage();
  await login(page, '84a3be4a.hernandez@example.com');
  await nav(page, '/'); await shot(page, 'player-home');
  await nav(page, '/social?tab=feed'); await shot(page, 'picklefeed', { full: true });
  await nav(page, '/games?section=open-play&view=discover'); await shot(page, 'play-discover');
  await shot(page, 'play-discover-sort', { before: async()=>{ const b=page.locator('button[aria-label^="Sort"]').first(); if(await b.count()){await b.click({force:true});await page.waitForTimeout(600);} }});
  await nav(page, '/games?section=open-play&view=discover');
  await shot(page, 'play-discover-filter', { before: async()=>{ const b=page.locator('button[aria-label^="Filter"]').first(); if(await b.count()){await b.click({force:true});await page.waitForTimeout(800);} }});
  await nav(page, '/coaches'); await shot(page, 'find-coach');
  await shot(page, 'coach-profile', { before: async()=>{ const l=page.locator('a[href^="/coaches/"]').first(); if(await l.count()){await l.click();await settle(page);} }});
  const cUrl = new URL(page.url()).pathname;
  await shot(page, 'book-coach-calendar', { full: true, before: async()=>{ const b=page.getByRole('button',{name:/book/i}).first(); if(await b.count()){await b.click();await settle(page);} else if(cUrl.includes('/coaches/')) await nav(page, cUrl+'/book'); }});
  await nav(page, '/coach/subscribe'); await shot(page, 'coach-subscribe-499', { full: true });
  await nav(page, '/organizer/subscribe'); await shot(page, 'organizer-subscribe-999', { full: true });
  await nav(page, '/social?tab=clubs'); await shot(page, 'social-clubs');
  await nav(page, '/social?tab=friends'); await shot(page, 'social-friends');
  await nav(page, '/messages'); await shot(page, 'player-messages');
  await ctx.close();
} catch (e) { log('PLAYER ERR', String(e).split('\n')[0]); }

/* ORGANIZER console — find a real organizer among the candidates (labels are unreliable) */
try {
  const ctx = await newCtx(browser, MOBILE); const page = await ctx.newPage();
  const cands = ['389b0d83.fuentes@example.com','637fa51b.reyes@example.com','a15e6e3e.garrido@example.com'];
  let found = false;
  for (const em of cands) {
    const h = await login(page, em);
    const isOrg = await page.evaluate(() => document.body.innerText.includes('Player Lists') || /Organize/.test(document.querySelector('h1,h2')?.textContent||''));
    log('  org-probe', em, 'home:', h, 'isOrganizer:', isOrg);
    if (isOrg) { found = true;
      await nav(page, '/organizer'); await shot(page, 'organizer-hub');
      await nav(page, '/organizer/open-play'); await shot(page, 'organizer-open-play');
      break;
    }
  }
  if (!found) log('  NO real organizer among candidates — skipping console (subscribe shot already captured)');
  await ctx.close();
} catch (e) { log('ORGANIZER ERR', String(e).split('\n')[0]); }

/* OWNER (desktop) — walker */
try {
  const ctx = await newCtx(browser, DESKTOP); const page = await ctx.newPage();
  await login(page, 'ccdfa3b7.walker@example.com');
  await nav(page, '/'); await shot(page, 'owner-home');
  await nav(page, '/owner/manual-reservation'); await shot(page, 'owner-manual-reservation');
  await nav(page, '/owner/calendar'); await shot(page, 'owner-calendar');
  await nav(page, '/owner/pricing'); await shot(page, 'owner-pricing');
  await nav(page, '/owner/partners'); await shot(page, 'owner-partners');
  await nav(page, '/owner/reports'); await shot(page, 'owner-reports');
  await nav(page, '/owner/venues/v2'); await shot(page, 'owner-venues');
  await nav(page, '/messages'); await shot(page, 'owner-messages');
  await ctx.close();
} catch (e) { log('OWNER ERR', String(e).split('\n')[0]); }

/* STAFF (desktop) */
try {
  const ctx = await newCtx(browser, DESKTOP); const page = await ctx.newPage();
  await login(page, 'staff@example.com');
  await nav(page, '/'); await shot(page, 'staff-home');
  await nav(page, '/owner/venues/v2'); await shot(page, 'staff-venues');
  await nav(page, '/messages'); await shot(page, 'staff-messages');
  await ctx.close();
} catch (e) { log('STAFF ERR', String(e).split('\n')[0]); }

await browser.close();
console.log('\n===== MANIFEST =====');
for (const r of results) console.log(`${r.ok?'OK ':'XX '} ${r.name.padEnd(26)} ${r.ok?'| '+r.h:'('+(r.err||r.h)+')'}`);
console.log('OK:', results.filter(r=>r.ok).length, '/', results.length);
