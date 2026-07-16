import { chromium } from 'playwright';
const BASE='https://pickleballer-pwa.eunika.xyz', OUT='/var/public/pickleplay/reports/2026-07-16-demo-shots', PW='password123';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:1440,height:900}, deviceScaleFactor:2 });
await ctx.addInitScript(()=>{ try{sessionStorage.setItem('pb-splash-seen','1');}catch{} });
const page = await ctx.newPage();
const H = () => page.evaluate(()=> (document.querySelector('h1,h2')?.textContent||'').trim().slice(0,50));
const settle = async(ms=1300)=>{ try{await page.waitForLoadState('networkidle',{timeout:15000});}catch{} await page.evaluate(()=>document.querySelectorAll('.pb-splash').forEach(n=>n.remove())).catch(()=>{}); await page.waitForTimeout(ms); };

// login as OWNER (walker) — the route allows owner.venues.manage
await page.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'}); await settle(900);
await page.locator('input[type="email"]').first().fill('ccdfa3b7.walker@example.com');
await page.locator('input[type="password"]').first().fill(PW);
await page.waitForTimeout(200);
await page.evaluate(()=>{const x=[...document.querySelectorAll('button')].find(e=>/^(sign in|log in|login)$/i.test(e.textContent.trim()));x?.click();});
await page.waitForFunction(()=>!location.pathname.startsWith('/login'),{timeout:18000}).catch(()=>{});
await settle(1500);
console.log('owner home H:', await H());

// the recurring Open Play console
await page.goto(`${BASE}/organizer/open-play`,{waitUntil:'domcontentloaded'}); await settle(1600);
const h1 = await H();
const bodyTxt = await page.evaluate(()=>document.body.innerText.slice(0,300).replace(/\s+/g,' '));
const blocked = /create your free account|not allowed|no access/i.test(bodyTxt);
console.log('recurring screen H:', h1);
console.log('  visible text:', bodyTxt.slice(0,180));
console.log('  OWNER CAN REACH IT:', !blocked ? 'YES ✓' : 'NO ✗');
await page.screenshot({ path:`${OUT}/owner-recurring-openplay.png` });
console.log('  saved owner-recurring-openplay.png');

// open the "New series" composer to show days-of-week + weeks-ahead
const nw = page.getByRole('button',{name:/new series|\+/i}).first();
if (await nw.count()) {
  await nw.click().catch(()=>{}); await settle(1400);
  const h2 = await H();
  const t2 = await page.evaluate(()=>document.body.innerText.slice(0,300).replace(/\s+/g,' '));
  console.log('new-series form H:', h2);
  console.log('  text:', t2.slice(0,200));
  await page.screenshot({ path:`${OUT}/owner-recurring-new-series.png` });
  console.log('  saved owner-recurring-new-series.png');
}
await b.close();
console.log('done');
