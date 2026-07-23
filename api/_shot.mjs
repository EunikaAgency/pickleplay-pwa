import { chromium } from '@playwright/test';

const APP = 'http://localhost:9000';
const API = 'http://localhost:9002';
const PLAYER = { email: 'christianian.i.alcazar@gmail.com', password: 'password123' };
const OUT = process.argv[2] || 'notif.png';
const THEME = process.argv[3] || 'light';

const res = await fetch(`${API}/api/v1/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(PLAYER),
});
const j = await res.json();
if (!j.data?.accessToken) throw new Error('login failed: ' + JSON.stringify(j).slice(0, 300));

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: THEME,
});
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(APP);
await page.evaluate((t) => {
  localStorage.setItem('pb-access-token', t.accessToken);
  localStorage.setItem('pb-refresh-token', t.refreshToken);
  sessionStorage.setItem('pb-splash-seen', '1');
  localStorage.setItem('pb-theme', t.theme);
}, { accessToken: j.data.accessToken, refreshToken: j.data.refreshToken, theme: THEME });
await page.goto(`${APP}/notifications`);
await page.waitForSelector('.notif, .notif-group', { timeout: 20000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT });

const stats = await page.evaluate(() => ({
  rows: document.querySelectorAll('.notif').length,
  groups: [...document.querySelectorAll('.notif-group')].map((e) => e.textContent),
  unread: document.querySelectorAll('.notif.unread').length,
  dots: document.querySelectorAll('.notif-dot-unread').length,
  firstRow: (() => {
    const r = document.querySelector('.notif');
    if (!r) return null;
    const ic = r.querySelector('.ic');
    return {
      head: r.querySelector('.head')?.textContent,
      meta: r.querySelector('.meta')?.textContent,
      icRadius: ic && getComputedStyle(ic).borderRadius,
      icSize: ic && getComputedStyle(ic).width,
      icBg: ic && getComputedStyle(ic).backgroundColor,
      rowBg: getComputedStyle(r).backgroundColor,
      hasMsgLeftover: !!r.querySelector('.msg'),
    };
  })(),
  bodyScrollX: document.body.scrollWidth > document.body.clientWidth,
}));
console.log(JSON.stringify({ stats, errs: errs.slice(0, 5) }, null, 2));
await browser.close();
