import { chromium } from 'playwright';

const BASE = 'https://pickleballer-pwa.eunika.xyz';
const browser = await chromium.launch({ headless: true });
// Block service worker caching
const ctx = await browser.newContext({ 
  viewport: { width: 390, height: 844 },
  serviceWorkers: 'block'
});
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', err => errors.push(err.message));

try {
  const loginRes = await page.request.post('https://pickleballer-api.eunika.xyz/api/v1/auth/login', {
    data: { email: 'info@eunika.agency', password: 'justinianthegreat!' }
  });
  const data = (await loginRes.json()).data;

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.evaluate((d) => {
    localStorage.clear();
    localStorage.setItem('pb-access-token', d.accessToken);
    localStorage.setItem('pb-refresh-token', d.refreshToken);
    localStorage.setItem('pb-user', JSON.stringify(d.user));
  }, data);

  await page.goto(`${BASE}/settings?nocache=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(4000);

  const body = await page.textContent('body');
  console.log('Email monitoring:', body?.includes('Email monitoring') ? '✅ FOUND' : '❌ MISSING');
  console.log('BCC emails:', body?.includes('BCC emails') ? '✅ FOUND' : '❌ MISSING');
  console.log('Errors:', errors.length);
  if (errors.length) errors.forEach(e => console.log('  ERR:', e.substring(0, 200)));
  
  await page.screenshot({ path: '/tmp/admin-settings-final.png', fullPage: true });
  console.log('Screenshot: /tmp/admin-settings-final.png');
} finally {
  await browser.close();
}
