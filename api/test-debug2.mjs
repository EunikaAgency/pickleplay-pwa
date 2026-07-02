import { chromium } from 'playwright';

const BASE = 'https://pickleballer-pwa.eunika.xyz';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ 
  viewport: { width: 390, height: 844 },
  serviceWorkers: 'block'
});
const page = await ctx.newPage();

try {
  const loginRes = await page.request.post('https://pickleballer-api.eunika.xyz/api/v1/auth/login', {
    data: { email: 'info@eunika.agency', password: 'justinianthegreat!' }
  });
  const d = (await loginRes.json()).data;

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.evaluate((d2) => {
    localStorage.clear();
    localStorage.setItem('pb-access-token', d2.accessToken);
    localStorage.setItem('pb-refresh-token', d2.refreshToken);
    localStorage.setItem('pb-user', JSON.stringify(d2.user));
  }, d);

  await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(5000);

  // Check the auth store state via React DevTools hack
  const state = await page.evaluate(() => {
    // Try to access Zustand store directly
    const el = document.querySelector('.pb-v2');
    if (!el) return 'No .pb-v2 element found';
    
    // Check if we can read the user from the store
    const store = JSON.parse(localStorage.getItem('pb-user') || 'null');
    return {
      storedUser: store?.roleDefault,
      storedRoles: store?.roles,
      bodyHasEmailMonitoring: document.body.textContent?.includes('Email monitoring'),
      bodySnippet: document.body.textContent?.substring(0, 300),
    };
  });

  console.log(JSON.stringify(state, null, 2));
} finally {
  await browser.close();
}
