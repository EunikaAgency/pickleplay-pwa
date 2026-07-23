import { chromium } from 'playwright';

const APP = 'http://localhost:9000';
const shots = '/tmp/claude-1000/-var-public-pickleballer-eunika-xyz/827ffba1-579f-4164-9316-782038384d2a/scratchpad';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// Log in through the API and seed the tokens the app reads.
const res = await page.request.post('http://localhost:9002/api/v1/auth/login', {
  data: { email: 'ccdfa3b7.walker@example.com', password: 'password123' },
});
const { data } = await res.json();
await page.goto(APP);
await page.evaluate(([a, r]) => {
  localStorage.setItem('pb-access-token', a);
  localStorage.setItem('pb-refresh-token', r);
  sessionStorage.setItem('pb-splash-seen', '1');
}, [data.accessToken, data.refreshToken]);

// ── Messages ──────────────────────────────────────────────────
await page.goto(`${APP}/messages`);
await page.waitForSelector('.organizer', { timeout: 15000 });
const rows = await page.locator('.organizer').count();
console.log('conversation rows:', rows);

const trigger = page.locator('.organizer button[aria-haspopup="menu"]').first();
console.log('3-dot triggers:', await page.locator('.organizer button[aria-haspopup="menu"]').count());
console.log('leftover X buttons:', await page.locator('.organizer button[aria-label^="Delete conversation with"]').count());

await trigger.click();
await page.waitForSelector('ul[role="menu"]', { timeout: 5000 });
const labels = await page.locator('ul[role="menu"] button[role="menuitem"]').allInnerTexts();
console.log('menu items:', JSON.stringify(labels));
console.log('url after opening menu (must still be /messages):', new URL(page.url()).pathname);
await page.screenshot({ path: `${shots}/01-messages-menu.png` });

// Report → reason sheet
await page.locator('ul[role="menu"] button[role="menuitem"]', { hasText: 'Report conversation' }).click();
await page.waitForSelector('text=Why are you reporting this conversation?', { timeout: 5000 });
await page.screenshot({ path: `${shots}/02-messages-report.png` });
await page.locator('button', { hasText: 'Harassment or bullying' }).first().click();
await page.waitForTimeout(800);
console.log('toast after report:', await page.locator('.toast.show').innerText().catch(() => 'NONE'));

// Mark as unread → badge appears
await page.waitForTimeout(1500);
await trigger.click();
await page.waitForSelector('ul[role="menu"]');
const readLabel = await page.locator('ul[role="menu"] button[role="menuitem"]').first().innerText();
console.log('read-toggle label (thread is read → expect "Mark as unread"):', readLabel);
await page.locator('ul[role="menu"] button[role="menuitem"]').first().click();
await page.waitForTimeout(1200);
console.log('toast after toggle:', await page.locator('.toast.show').innerText().catch(() => 'NONE'));
await page.screenshot({ path: `${shots}/03-messages-unread.png` });

// Flip it back to read so the demo DB is left as we found it.
await page.waitForTimeout(1500);
await trigger.click();
await page.waitForSelector('ul[role="menu"]');
const backLabel = await page.locator('ul[role="menu"] button[role="menuitem"]').first().innerText();
console.log('read-toggle label after marking unread (expect "Mark as read"):', backLabel);
await page.locator('ul[role="menu"] button[role="menuitem"]').first().click();
await page.waitForTimeout(1000);

// ── Notifications ─────────────────────────────────────────────
await page.goto(`${APP}/notifications`);
await page.waitForSelector('.notif', { timeout: 15000 });
console.log('notification rows:', await page.locator('.notif').count());
const nTrigger = page.locator('.notif button[aria-label="Notification actions"]').first();
console.log('notif 3-dot triggers:', await page.locator('.notif button[aria-label="Notification actions"]').count());
await nTrigger.click();
await page.waitForSelector('ul[role="menu"]');
console.log('notif menu items:', JSON.stringify(await page.locator('ul[role="menu"] button[role="menuitem"]').allInnerTexts()));
await page.screenshot({ path: `${shots}/04-notifications-menu.png` });
await page.keyboard.press('Escape');

// ── Mobile width: menu must stay on-screen ────────────────────
const phone = await ctx.newPage();
await phone.setViewportSize({ width: 390, height: 844 });
await phone.goto(`${APP}/messages`);
await phone.waitForSelector('.organizer', { timeout: 15000 });
const last = phone.locator('.organizer button[aria-haspopup="menu"]').last();
await last.click();
await phone.waitForSelector('ul[role="menu"]');
const box = await phone.locator('ul[role="menu"]').boundingBox();
console.log('phone menu box:', JSON.stringify(box), '→ fits viewport:',
  box.x >= 0 && box.y >= 0 && box.x + box.width <= 390 && box.y + box.height <= 844);
await phone.screenshot({ path: `${shots}/05-phone-menu.png` });

console.log('console errors:', errors.length, errors.slice(0, 5));
await browser.close();
