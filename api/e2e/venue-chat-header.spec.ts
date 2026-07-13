/**
 * A player who messages a venue must see the VENUE in the chat header — not the
 * owner's personal name (the reported bug: "Oscar Walker" instead of "Cristy
 * Hernandez Activity Center"). The owner keeps seeing the player, with the venue
 * named in the eyebrow, so they know which listing the inquiry is about.
 *
 * Both tests cold-load the thread WITHOUT the `?name=` hint the conversation list
 * passes, so a pass proves the identity comes from the API, not the URL.
 */
import { execFileSync } from 'node:child_process';
import { test, expect, type Browser, type Page } from '@playwright/test';

const APP = 'http://localhost:9000';
const API = 'http://localhost:9002';
const PLAYER = { email: '84a3be4a.hernandez@example.com', password: 'password123' }; // Steve Hernandez
const OWNER = { email: 'ccdfa3b7.walker@example.com', password: 'password123' };     // Oscar Walker
const VENUE = 'Cristy Hernandez Activity Center';

/** The venue-scoped thread between the player and the venue's owner. */
function venueConversationId(): string {
  const out = execFileSync('mongosh', ['--quiet', 'pickleballers', '--eval', `
    const v = db.venues.findOne({displayName: ${JSON.stringify(VENUE)}});
    const p = db.users.findOne({email: ${JSON.stringify(PLAYER.email)}});
    const c = db.conversations.findOne({contextType: "venue", contextId: v._id, participantIds: p._id});
    print(String(c._id));
  `], { stdio: 'pipe' }).toString().trim();
  if (!/^[0-9a-f]{24}$/.test(out)) throw new Error(`no venue conversation found: ${out}`);
  return out;
}

async function tokens(creds: { email: string; password: string }) {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(creds),
  });
  const j = await res.json() as { data?: { accessToken?: string; refreshToken?: string } };
  if (!j.data?.accessToken || !j.data?.refreshToken) throw new Error(`login failed for ${creds.email}`);
  return { accessToken: j.data.accessToken, refreshToken: j.data.refreshToken };
}

/** Never wait for `networkidle` — the app holds an open SSE stream to /me/stream. */
async function signedInPage(browser: Browser, creds: { email: string; password: string }, path: string): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(APP);
  await page.evaluate((t) => {
    localStorage.setItem('pb-access-token', t.accessToken);
    localStorage.setItem('pb-refresh-token', t.refreshToken);
    sessionStorage.setItem('pb-splash-seen', '1');
  }, await tokens(creds));
  await page.goto(`${APP}${path}`);
  return page;
}

test('the player sees the venue, not the owner', async ({ browser }) => {
  const page = await signedInPage(browser, PLAYER, `/messages/${venueConversationId()}`);

  await expect(page.locator('.hd-2')).toHaveText(VENUE);
  await expect(page.locator('.t-eyebrow')).toHaveText('Venue');
  // The owner is still named — as the person who'll reply, under the venue.
  await expect(page.locator('.t-sm').first()).toContainText('Oscar Walker');
  // The composer addresses the venue too.
  await expect(page.locator('input[placeholder]')).toHaveAttribute('placeholder', `Message ${VENUE}`);
  // The header must not lead with the owner's personal name anywhere.
  await expect(page.locator('.hd-2')).not.toContainText('Oscar Walker');
});

test('the owner sees the player, with the venue in the eyebrow', async ({ browser }) => {
  const page = await signedInPage(browser, OWNER, `/messages/${venueConversationId()}`);

  await expect(page.locator('.hd-2')).toHaveText('Steve Hernandez');
  await expect(page.locator('.t-eyebrow')).toHaveText(`Re: ${VENUE}`);
});
