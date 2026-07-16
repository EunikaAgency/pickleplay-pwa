import { chromium } from 'playwright';

const URL = 'https://pickleballer-pwa.eunika.xyz';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);
console.log('URL:', page.url());
console.log('TITLE:', await page.title());
// Dump all buttons and links text
const buttons = await page.$$eval('button', els => els.map(e => e.textContent.trim()).filter(Boolean));
console.log('BUTTONS:', JSON.stringify(buttons, null, 1));
const links = await page.$$eval('a', els => els.map(e => ({t: e.textContent.trim(), h: e.getAttribute('href')})).filter(e=>e.t));
console.log('LINKS:', JSON.stringify(links, null, 1));
const inputs = await page.$$eval('input', els => els.map(e => ({type:e.type, name:e.name, ph:e.placeholder, id:e.id})));
console.log('INPUTS:', JSON.stringify(inputs, null, 1));
const bodyText = await page.$eval('body', e => e.innerText);
console.log('BODYTEXT:', bodyText.slice(0, 1500));
await browser.close();
