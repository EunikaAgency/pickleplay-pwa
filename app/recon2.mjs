import { chromium } from 'playwright';

const URL = 'https://pickleballer-pwa.eunika.xyz';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1500);
// click Login
await page.getByRole('button', { name: 'Login', exact: true }).first().click();
await page.waitForTimeout(2000);
console.log('URL:', page.url());
const buttons = await page.$$eval('button', els => els.map(e => e.textContent.trim()).filter(Boolean));
console.log('BUTTONS:', JSON.stringify(buttons, null, 1));
const inputs = await page.$$eval('input', els => els.map(e => ({type:e.type, name:e.name, ph:e.placeholder, id:e.id})));
console.log('INPUTS:', JSON.stringify(inputs, null, 1));
const bodyText = await page.$eval('body', e => e.innerText);
console.log('BODYTEXT:', bodyText.slice(0, 1200));
await browser.close();
