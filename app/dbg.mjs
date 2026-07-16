import { chromium } from 'playwright';
const BASE = 'https://pickleballer-pwa.eunika.xyz';
const OUT = '/var/public/pickleplay/reports/2026-07-16-demo-shots';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
console.log('URL', page.url());
await page.screenshot({ path: `${OUT}/_dbg-login.png`, fullPage: true });
const btns = await page.$$eval('button', els => els.map(e => ({t:e.textContent.trim(), vis: e.offsetParent!==null, disabled:e.disabled})));
console.log('BUTTONS', JSON.stringify(btns));
// try player1 button
try {
  const b = page.getByRole('button', { name: 'Player 1', exact: true });
  console.log('Player1 count', await b.count());
  const box = await b.first().boundingBox();
  console.log('Player1 box', JSON.stringify(box));
  await b.first().click({ timeout: 5000 });
  await page.waitForTimeout(3000);
  console.log('after click URL', page.url());
} catch(e){ console.log('CLICK ERR', String(e).split('\n')[0]); }
await browser.close();
