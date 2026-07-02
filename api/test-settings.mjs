import { chromium } from 'playwright';

const BASE = 'https://pickleballer-pwa.eunika.xyz';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

try {
  // Login via API directly to get a token, then inject it
  console.log('1. Logging in via API...');
  const loginRes = await page.request.post('https://pickleballer-api.eunika.xyz/api/v1/auth/login', {
    data: { email: 'info@eunika.agency', password: 'justinianthegreat!' }
  });
  const { accessToken, refreshToken } = (await loginRes.json()).data;
  console.log('   Token obtained:', accessToken.substring(0, 20) + '...');

  // Inject tokens into localStorage
  console.log('2. Injecting session and navigating to settings...');
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.evaluate(({ access, refresh }) => {
    localStorage.setItem('pb-access-token', access);
    localStorage.setItem('pb-refresh-token', refresh);
  }, { access: accessToken, refresh: refreshToken });

  // Reload with the token
  await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(3000);

  // Screenshot
  await page.screenshot({ path: '/tmp/admin-settings.png', fullPage: true });
  const body = await page.textContent('body');

  console.log('\n=== RESULTS ===');
  console.log('Email monitoring:', body?.includes('Email monitoring') ? '✅ FOUND' : '❌ MISSING');
  console.log('BCC emails:', body?.includes('BCC emails') ? '✅ FOUND' : '❌ MISSING');
  console.log('Log Out button:', body?.includes('Log Out') ? '✅ FOUND (logged in)' : '❌ MISSING');

  if (!body?.includes('Email monitoring') && !body?.includes('BCC emails')) {
    console.log('\n--- Body preview (first 500 chars) ---');
    console.log(body?.substring(0, 500));
    // Check if we're on settings at all
    const url = page.url();
    console.log('Current URL:', url);
  }
} finally {
  await browser.close();
}
