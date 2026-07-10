// Ad-hoc: prove the Edit Profile map picker fills the address fields.
//   1. "Use my location" (geolocation mocked to a known Manila point)
//   2. a manual pin drop somewhere else
// Usage: node e2e/_profile-map.mjs
import { chromium } from 'playwright';

const APP = 'https://pickleballer-pwa.eunika.xyz';
// API base kept for reference; the test drives the UI only.



// Rizal Park, Manila — a well-mapped point, so Nominatim returns a full address.
const MANILA = { latitude: 14.5826, longitude: 120.9787 };

// FormField renders <label htmlFor> + <input id>, so getByLabel is the locator.
// A `label:has-text(...) input` descendant selector finds nothing here.
const val = (page, label) =>
  page.getByLabel(label, { exact: true }).first().inputValue({ timeout: 5000 }).catch(() => '<not found>');

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 420, height: 900 },
  permissions: ['geolocation'],
  geolocation: MANILA,
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 140)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });

await page.addInitScript(() => {
  try { sessionStorage.setItem('pb-splash-seen', '1'); } catch { /* private mode */ }
});

// Sign in through the UI's own quick-test login — injecting tokens into
// localStorage didn't restore the session.
// Not `networkidle` anywhere: the app keeps a notification poll + SSE stream
// open, so it never idles. Wait for real elements instead.
await page.goto(`${APP}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.locator('button:has-text("Player 1")').first().click({ timeout: 20000 });
await page.waitForTimeout(4000);

await page.goto(`${APP}/profile/edit`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForSelector('.leaflet-container', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2000);
if (page.url().includes('/login')) throw new Error('still signed out — quick login did not take');

const mapPresent = await page.locator('.leaflet-container').count();
const btn = page.locator('button:has-text("Use my location")');
console.log(`map rendered: ${mapPresent > 0}   use-my-location button: ${await btn.count() > 0}`);

// Map must sit ABOVE Address line 1.
const mapY = await page.locator('.leaflet-container').first().boundingBox().then((b) => b?.y ?? -1);
const a1Y = await page.getByLabel("Address line 1", { exact: true }).first().boundingBox().then((b) => b?.y ?? -1);
console.log(`map above "Address line 1": ${mapY > 0 && a1Y > 0 && mapY < a1Y}  (map y=${Math.round(mapY)}, field y=${Math.round(a1Y)})`);

const before = { a1: await val(page, 'Address line 1'), city: await val(page, 'City'), prov: await val(page, 'Province'), zip: await val(page, 'Zip code') };
console.log('before        :', JSON.stringify(before));

// ── 1. Use my location
await btn.click();
await page.waitForFunction(() => !document.body.innerText.includes('Looking up that spot'), { timeout: 25000 }).catch(() => {});
await page.waitForTimeout(1500);
const afterLocate = { a1: await val(page, 'Address line 1'), city: await val(page, 'City'), prov: await val(page, 'Province'), zip: await val(page, 'Zip code') };
console.log('after locate  :', JSON.stringify(afterLocate));
console.log('status line   :', (await page.locator('p[aria-live="polite"]').first().innerText().catch(() => '')).trim());

// ── 2. Manual pin: click a different part of the map, expect a RE-prefill
const box = await page.locator('.leaflet-container').first().boundingBox();
await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.25);
await page.waitForFunction(() => !document.body.innerText.includes('Looking up that spot'), { timeout: 25000 }).catch(() => {});
await page.waitForTimeout(1500);
const afterPin = { a1: await val(page, 'Address line 1'), city: await val(page, 'City'), prov: await val(page, 'Province'), zip: await val(page, 'Zip code') };
console.log('after pin     :', JSON.stringify(afterPin));
console.log('re-prefilled  :', JSON.stringify(afterPin) !== JSON.stringify(afterLocate));

await page.screenshot({ path: 'e2e/_profile-map.png' });
console.log('console errors:', errors.length, errors.slice(0, 3));
await browser.close();
