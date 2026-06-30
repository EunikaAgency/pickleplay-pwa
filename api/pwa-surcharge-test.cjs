const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  // Step 1: Dismiss splash
  await page.goto('http://localhost:9000', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);
  const splashBtn = page.locator('button:has-text("Let\'s Play")').first();
  if (await splashBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await splashBtn.click(); await page.waitForTimeout(1000);
    console.log('✓ Splash dismissed');
  }

  // Step 2: Fill in login form directly via the login screen
  console.log('Logging in...');
  await page.goto('http://localhost:9000/login', { waitUntil: 'networkidle', timeout: 10000 });
  await page.waitForTimeout(1500);

  // Fill email
  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i], input[name="email"]').first();
  await emailInput.fill('info@eunika.agency');
  
  // Fill password
  const pwdInput = page.locator('input[type="password"]').first();
  await pwdInput.fill('password123');
  
  // Click sign in
  const signInBtn = page.locator('button').filter({ hasText: /Sign in|Log in|Login/i }).first();
  await signInBtn.click();
  await page.waitForTimeout(2500);
  console.log('✓ Login attempted, URL:', page.url());

  // Step 3: Go to booking flow
  console.log('Going to booking...');
  await page.goto('http://localhost:9000/venues/test-pb-arena', { waitUntil: 'networkidle', timeout: 10000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/surcharge-1-venue.png', fullPage: true });
  console.log('✓ Venue page');

  // Tap Book
  const bookBtn = page.locator('button').filter({ hasText: /Book/i }).first();
  if (await bookBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await bookBtn.click();
    await page.waitForTimeout(2500);
    console.log('✓ Booking screen, URL:', page.url());
  }
  await page.screenshot({ path: '/tmp/surcharge-2-booking.png', fullPage: true });

  // Select a date (tomorrow)
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const day = String(tomorrow.getDate());
  // Try tapping on a calendar date number
  const dateBtn = page.locator('[class*="calendar"] button, [class*="date"] button').filter({ hasText: new RegExp('^'+day+'$') }).first();
  if (await dateBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await dateBtn.click();
    await page.waitForTimeout(1000);
    console.log('✓ Date selected:', day);
  }
  await page.screenshot({ path: '/tmp/surcharge-3-date.png', fullPage: true });

  // Select a time
  const timeChips = page.locator('button, [class*="chip"]').filter({ hasText: /^\d{2}:\d{2}$/ });
  const timeCount = await timeChips.count();
  if (timeCount > 0) {
    await timeChips.first().click();
    await page.waitForTimeout(800);
    console.log('✓ Time selected');
  } else {
    console.log('  No time chips found, trying hour buttons...');
    await page.screenshot({ path: '/tmp/surcharge-3b-no-times.png', fullPage: true });
  }
  await page.screenshot({ path: '/tmp/surcharge-4-after-time.png', fullPage: true });

  // Continue
  for (let i = 0; i < 3; i++) {
    const nextBtn = page.locator('button').filter({ hasText: /Continue|Next|Proceed|Review/i }).first();
    if (await nextBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(1200);
      console.log('✓ Clicked continue #' + (i+1));
    } else { break; }
  }

  // Player count
  const plusBtn = page.locator('button[aria-label*="player" i], button[aria-label*="more" i]').first();
  if (await plusBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await plusBtn.click(); await plusBtn.click(); await plusBtn.click();
    await page.waitForTimeout(500);
    console.log('✓ Players: 1→4 (surcharge ₱200)');
  }

  await page.screenshot({ path: '/tmp/surcharge-5-final.png', fullPage: true });
  console.log('\nDone! /tmp/surcharge-*.png');
  await browser.close();
})();
