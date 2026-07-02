import { chromium } from 'playwright';

const BASE = 'https://pickleballer-pwa.eunika.xyz';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  // Clear any existing session
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.evaluate(() => localStorage.clear());
  
  // Go to login
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(2000);

  // Dismiss splash if present
  const splash = page.locator('.pb-splash .cta-btn');
  if (await splash.isVisible({ timeout: 2000 }).catch(() => false)) {
    await splash.click({ force: true });
    await page.waitForTimeout(1500);
  }

  // Login
  await page.fill('input[type="email"]', 'info@eunika.agency');
  await page.fill('input[type="password"]', 'justinianthegreat!');
  
  // Click submit via JS to bypass overlay issues
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button[type="submit"]');
    if (btns.length) btns[btns.length - 1].click();
  });
  console.log('1. Login submitted...');
  await page.waitForTimeout(5000);
  
  console.log('Current URL:', page.url());
  
  // Navigate to settings
  await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(3000);
  
  console.log('Current URL:', page.url());
  await page.screenshot({ path: '/tmp/admin-settings2.png', fullPage: true });
  
  const body = await page.textContent('body');
  console.log('Email monitoring:', body?.includes('Email monitoring') ? 'YES' : 'NO');
  console.log('BCC emails:', body?.includes('BCC emails') ? 'YES' : 'NO');
  console.log('Notification preferences:', body?.includes('Notification') ? 'YES (v2 screen)' : 'NO (v1 screen)');
  console.log('Screenshot: /tmp/admin-settings2.png');
} finally {
  await browser.close();
}
