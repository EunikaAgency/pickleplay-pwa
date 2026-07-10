// Ad-hoc: screenshot the PWA full map and dump every venue pin's coordinates.
//
// Pin coords are read from the API the page itself calls, not scraped from the
// DOM — Leaflet only mounts markers inside the current viewport, so a DOM scrape
// silently misses most venues.
//
// Usage: node e2e/_map-pins.mjs [outPrefix]
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const URL_MAP = 'https://pickleballer-pwa.eunika.xyz/map';
const prefix = process.argv[2] || 'map';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const venues = new Map();
page.on('response', async (res) => {
  const u = res.url();
  if (!/\/api\/v1\/venues(\?|$)/.test(u) || !res.ok()) return;
  try {
    const body = await res.json();
    for (const v of body?.data?.items ?? body?.data ?? []) {
      if (typeof v?.lat === 'number' && typeof v?.lng === 'number') {
        venues.set(v.slug ?? v.id, { slug: v.slug, name: v.displayName, lat: v.lat, lng: v.lng });
      }
    }
  } catch { /* not the payload we want */ }
});

// The cold-start splash is a full-screen overlay gated on sessionStorage.
// Pre-seed the flag so the map is visible the moment the app mounts.
await page.addInitScript(() => {
  try { sessionStorage.setItem('pb-splash-seen', '1'); } catch {}
});

await page.goto(URL_MAP, { waitUntil: 'networkidle', timeout: 60000 });

// Belt and braces: if the splash rendered anyway, tap through it.
await page.locator('button:has-text("Let\'s Play")').first().click({ timeout: 3000 }).catch(() => {});
// Dismiss the PWA install banner if it appears — it overlays the map.
await page.locator('button:has-text("Not now"), button:has-text("Dismiss")')
  .first().click({ timeout: 2500 }).catch(() => {});

await page.waitForSelector('.leaflet-container', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(5000); // let tiles + markers settle

const markers = await page.locator('.leaflet-marker-icon').count();
await page.screenshot({ path: `e2e/${prefix}.png`, fullPage: false });

const list = [...venues.values()];
writeFileSync(`e2e/${prefix}-pins.json`, JSON.stringify(list, null, 1));
console.log(JSON.stringify({
  markersRenderedInViewport: markers,
  venuesWithCoordsFromApi: list.length,
  screenshot: `e2e/${prefix}.png`,
  latRange: list.length ? [Math.min(...list.map(v => v.lat)), Math.max(...list.map(v => v.lat))] : null,
  lngRange: list.length ? [Math.min(...list.map(v => v.lng)), Math.max(...list.map(v => v.lng))] : null,
}, null, 2));

await browser.close();
