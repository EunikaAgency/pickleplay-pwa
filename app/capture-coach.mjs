import { chromium } from 'playwright';
const BASE = 'https://pickleballer-pwa.eunika.xyz';
const OUT = '/var/public/pickleplay/reports/2026-07-16-demo-shots';
const PW = 'password123';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { try { sessionStorage.setItem('pb-splash-seen','1'); } catch {} });
const page = await ctx.newPage();
const H = () => page.evaluate(() => (document.querySelector('h1,h2')?.textContent||'').trim().slice(0,40));
const settle = async (ms=1200) => { try{await page.waitForLoadState('networkidle',{timeout:15000});}catch{} await page.evaluate(()=>document.querySelectorAll('.pb-splash').forEach(n=>n.remove())).catch(()=>{}); await page.waitForTimeout(ms); };

// login
await page.goto(`${BASE}/login`, { waitUntil:'domcontentloaded' }); await settle(1000);
await page.locator('input[type="email"]').first().fill('84a3be4a.hernandez@example.com');
await page.locator('input[type="password"]').first().fill(PW);
await page.waitForTimeout(200);
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/^(sign in|log in|login)$/i.test(x.textContent.trim()));b?.click();});
await page.waitForFunction(()=>!location.pathname.startsWith('/login'),{timeout:18000}).catch(()=>{});
await settle(1500);
console.log('login home H:', await H());

// Find Coach directory
await page.goto(`${BASE}/coaches`, { waitUntil:'domcontentloaded' }); await settle(1200);
console.log('coaches H:', await H(), 'url:', page.url());

// Click the coach row by its name (the card is a clickable div, not an anchor)
const before = page.url();
const coach = page.getByText('Coach Mari', { exact:false }).first();
if (await coach.count()) { await coach.click({ timeout:6000 }).catch(async()=>{
  // fallback: click nearest clickable ancestor
  await coach.locator('xpath=ancestor-or-self::*[@role="button" or self::a or self::button or contains(@class,"card") or contains(@class,"coach")][1]').first().click().catch(()=>{});
}); }
await page.waitForFunction((b)=>location.href!==b && /\/coaches\/[^/]+/.test(location.pathname), before, {timeout:8000}).catch(()=>{});
await settle(1200);
const onProfile = /\/coaches\/[^/]+/.test(new URL(page.url()).pathname);
console.log('after coach click -> url:', page.url(), 'onProfile:', onProfile, 'H:', await H());
if (onProfile) { await page.screenshot({ path:`${OUT}/coach-profile.png` }); console.log('  saved coach-profile.png'); }

// Book a session -> calendar
const coachUrl = new URL(page.url()).pathname;
const book = page.getByRole('button', { name:/book/i }).first();
if (await book.count()) { await book.click().catch(()=>{}); await settle(1200); }
else if (onProfile) { await page.goto(`${BASE}${coachUrl}/book`, { waitUntil:'domcontentloaded' }); await settle(1200); }
const onBook = /\/book/.test(page.url()) || /book a session/i.test((await H())||'');
console.log('after book -> url:', page.url(), 'onBook:', onBook, 'H:', await H());
if (onBook) { await page.screenshot({ path:`${OUT}/book-coach-calendar.png`, fullPage:true }); console.log('  saved book-coach-calendar.png'); }

await browser.close();
console.log('coach capture done');
