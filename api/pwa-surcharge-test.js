const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  console.log('1. Opening venue...');
  await page.goto('http://localhost:9000/venues/test-pb-arena', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/surcharge-1-venue.png' });
  console.log('   ✓ Venue page');

  console.log('2. Tapping Book...');
  const bookBtn = page.getByRole('button').filter({ hasText: /Book/i }).first();
  await bookBtn.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/tmp/surcharge-2-booking.png' });
  console.log('   ✓ Booking screen');

  console.log('3. Selecting time...');
  const timeBtn = page.locator('button').filter({ hasText: /^\d{1,2}:\d{2}$/ }).first();
  if (await timeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await timeBtn.click();
    await page.waitForTimeout(800);
    console.log('   ✓ Time selected');
  }
  await page.screenshot({ path: '/tmp/surcharge-3-time.png' });

  console.log('4. Going to review...');
  const nextBtn = page.locator('button').filter({ hasText: /Continue|Review|Next|Proceed/i }).first();
  if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await nextBtn.click();
    await page.waitForTimeout(1500);
    console.log('   ✓ Review step');
  }
  await page.screenshot({ path: '/tmp/surcharge-4-review.png' });

  console.log('5. Increasing player count...');
  const plusBtn = page.locator('button[aria-label="More players"], button[aria-label="Add player"]').first();
  if (await plusBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await plusBtn.click(); await plusBtn.click(); await plusBtn.click();
    await page.waitForTimeout(500);
    console.log('   ✓ Players 1→4 (surcharge: ₱100×2 = ₱200)');
  }

  await page.screenshot({ path: '/tmp/surcharge-5-final.png', fullPage: true });
  console.log('\nDone! Check /tmp/surcharge-*.png');
  await browser.close();
})();
