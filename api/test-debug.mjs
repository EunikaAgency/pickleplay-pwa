import { chromium } from 'playwright';

const BASE = 'https://pickleballer-pwa.eunika.xyz';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ 
  viewport: { width: 390, height: 844 },
  serviceWorkers: 'block'
});
const page = await ctx.newPage();

let settingsModuleContent = '';

// Intercept and capture the SettingsScreenV2 module
page.route('**/SettingsScreenV2*', async (route) => {
  const response = await route.fetch();
  settingsModuleContent = await response.text();
  await route.fulfill({ response });
});

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
  await page.waitForTimeout(4000);

  // Check what the module actually contains
  console.log('Module contains "Email monitoring":', settingsModuleContent.includes('Email monitoring'));
  console.log('Module contains "isAdmin":', settingsModuleContent.includes('isAdmin'));
  console.log('Module contains "BCC emails":', settingsModuleContent.includes('BCC emails'));
  
  // Screenshot
  await page.screenshot({ path: '/tmp/admin-settings-debug.png', fullPage: true });
  
  // Check body
  const body = await page.textContent('body');
  console.log('Body has "Email monitoring":', body?.includes('Email monitoring'));
} finally {
  await browser.close();
}
