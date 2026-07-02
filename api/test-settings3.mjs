import { chromium } from 'playwright';

const BASE = 'https://pickleballer-pwa.eunika.xyz';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', err => errors.push(err.message));

try {
  const loginRes = await page.request.post('https://pickleballer-api.eunika.xyz/api/v1/auth/login', {
    data: { email: 'info@eunika.agency', password: 'justinianthegreat!' }
  });
  const { accessToken, refreshToken, user } = (await loginRes.json()).data;

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.evaluate(({ a, r, u }) => {
    localStorage.clear();
    localStorage.setItem('pb-access-token', a);
    localStorage.setItem('pb-refresh-token', r);
    localStorage.setItem('pb-user', JSON.stringify(u));
  }, { a: accessToken, r: refreshToken, u: user });

  // Reload with stored session
  await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(5000);

  const body = await page.textContent('body');
  console.log('Email monitoring:', body?.includes('Email monitoring') ? '✅' : '❌');
  console.log('BCC emails:', body?.includes('BCC emails') ? '✅' : '❌');
  console.log('Errors:', errors.length);
  errors.slice(0, 5).forEach(e => console.log('  ERR:', e.substring(0, 200)));
  
  await page.screenshot({ path: '/tmp/admin-settings3.png', fullPage: true });
} finally {
  await browser.close();
}
