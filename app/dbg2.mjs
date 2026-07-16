import { chromium } from 'playwright';
const BASE = 'https://pickleballer-pwa.eunika.xyz';
const OUT = '/var/public/pickleplay/reports/2026-07-16-demo-shots';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
// what's on top at the button center?
const info = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Player 1');
  const b = btns[0];
  const r = b.getBoundingClientRect();
  const top = document.elementFromPoint(r.x+r.width/2, r.y+r.height/2);
  return { topTag: top?.tagName, topClass: top?.className?.toString().slice(0,120), topText: top?.textContent?.slice(0,50), isBtn: top===b };
});
console.log('TOP AT CENTER', JSON.stringify(info));
// try JS click
await page.evaluate(() => { [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Player 1')?.click(); });
await page.waitForTimeout(3500);
console.log('after JS click URL', page.url());
await browser.close();
