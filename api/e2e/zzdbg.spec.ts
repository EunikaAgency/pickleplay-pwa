import { test } from '@playwright/test';
test('debug', async ({ page }) => {
  const reqs: string[] = [];
  page.on('request', (r) => { const u=r.url(); if (u.includes('/api/v1/')) reqs.push(u.split('/api/v1/')[1]); });
  page.on('console', (m) => console.log('CONSOLE>', m.type(), m.text().slice(0,180)));
  page.on('response', async (r) => {
    if (r.url().includes('/play/discover')) console.log('DISCOVER>', r.status(), (await r.text()).slice(0,100));
  });
  await page.goto('http://localhost:9000/games');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
  console.log('CALLS>', JSON.stringify(reqs));
  console.log('CARDS>', await page.locator('.game-card').count());
  console.log('BODY>', (await page.locator('body').innerText()).replace(/\n/g,' | ').slice(0,400));
});
