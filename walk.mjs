import { chromium, devices } from 'playwright';
import fs from 'node:fs';

const url = process.env.URL || 'http://localhost:9003';
const outDir = '/tmp/shots';
fs.mkdirSync(outDir, { recursive: true });

const device = devices['iPhone 14 Pro'];
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...device, viewport: { width: 402, height: 874 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

async function shot(name) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
  const clip = await page.screenshot({ path: `${outDir}/${name}-view.png`, fullPage: false });
  return clip;
}

await page.goto(url, { waitUntil: 'networkidle' });
await shot('01-landing');

// Login flow
await page.getByRole('button', { name: /Get started — it's free/ }).click();
await page.waitForTimeout(400);
await shot('02-login');
await page.getByRole('button', { name: /^Sign in/ }).click();
await page.waitForTimeout(500);
await shot('03-onboarding-1');
await page.getByRole('button', { name: /Get started/ }).click();
await page.waitForTimeout(300);
await shot('04-onboarding-2');
await page.locator('input[placeholder="City or zip code"]').fill('Austin, TX');
await page.getByRole('button', { name: /^Continue/ }).click();
await page.waitForTimeout(300);
await shot('05-onboarding-3');
// pick a tier
await page.getByRole('button', { name: /Solid/ }).click();
await page.getByRole('button', { name: /Let's play/ }).click();
await page.waitForTimeout(500);
await shot('06-home');

// Try opening the now-card
await page.locator('.now-card').click();
await page.waitForTimeout(400);
await shot('07-game-details');
await page.locator('.detail-hero .icon-btn').first().click();
await page.waitForTimeout(400);

// Tab: Games
await page.locator('.tabbar .tab').nth(1).click();
await page.waitForTimeout(400);
await shot('08-games');

// FAB → create game
await page.locator('.tabbar .fab').click();
await page.waitForTimeout(400);
await shot('09-create-game-step1');
await page.getByRole('button', { name: /Continue/ }).click();
await page.waitForTimeout(300);
await shot('10-create-game-step2');
await page.getByRole('button', { name: /Continue/ }).click();
await page.waitForTimeout(300);
await shot('11-create-game-step3');

// Back to tab Games via TabBar
await page.locator('.tabbar .tab').first().click();
await page.waitForTimeout(300);
await page.locator('.tabbar .tab').nth(2).click(); // Courts tab (after FAB)
await page.waitForTimeout(500);
await shot('12-nearby');

// Tab: profile
await page.locator('.tabbar .tab').nth(3).click();
await page.waitForTimeout(500);
await shot('13-profile');

// Edit profile
await page.getByRole('button', { name: /Edit profile/ }).click();
await page.waitForTimeout(400);
await shot('14-edit-profile');
await page.locator('button[aria-label="Back"]').first().click();
await page.waitForTimeout(300);

// Notifications via the Profile row settings list
await page.locator('.set-list .row').filter({ hasText: 'Notifications' }).click();
await page.waitForTimeout(400);
await shot('15-notifications');
await page.locator('button[aria-label="Back"]').first().click();
await page.waitForTimeout(300);

// Settings via gear icon
await page.locator('button[aria-label="Open settings"]').click();
await page.waitForTimeout(400);
await shot('16-settings');
await page.locator('button[aria-label="Back"]').first().click();
await page.waitForTimeout(300);

// Browse a club: tap Home tab then go to clubs via "From your clubs" row? Easier: go home, scroll to clubs link
await page.locator('.tabbar .tab').first().click();
await page.waitForTimeout(400);
// the "Clubs" more button on the From-your-clubs section
await page.getByRole('button', { name: /^Clubs$/ }).click();
await page.waitForTimeout(500);
await shot('17-clubs');

// Open featured club
await page.locator('.featured-club').click();
await page.waitForTimeout(500);
await shot('18-club-details');

// Open court via Nearby
await page.locator('.tabbar .tab').nth(2).click();
await page.waitForTimeout(500);
await page.locator('.court-row').first().click();
await page.waitForTimeout(500);
await shot('19-court-details');

fs.writeFileSync(`${outDir}/log.txt`, logs.join('\n'));
console.log('OK', logs.length, 'logs');
await browser.close();
