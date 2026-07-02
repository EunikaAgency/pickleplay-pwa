import { chromium } from 'playwright';

const BASE = 'https://pickleballer-pwa.eunika.xyz';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  console.log('1. Logging in as admin...');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'info@eunika.agency');
  await page.fill('input[type="password"]', 'justinianthegreat!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  console.log('2. Going to settings...');
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const body = await page.textContent('body');
  const hasMonitoring = body?.includes('Email monitoring') || false;
  const hasBcc = body?.includes('BCC emails') || false;
  
  console.log('\n=== RESULTS ===');
  console.log('Email monitoring section:', hasMonitoring ? '✅ FOUND' : '❌ MISSING');
  console.log('BCC emails toggle:', hasBcc ? '✅ FOUND' : '❌ MISSING');

  await page.screenshot({ path: '/tmp/admin-settings.png', fullPage: true });
  console.log('Screenshot: /tmp/admin-settings.png');

  if (!hasMonitoring) {
    console.log('\nPage body (first 600 chars):');
    console.log(body?.substring(0, 600));
  }
} finally {
  await browser.close();
}
