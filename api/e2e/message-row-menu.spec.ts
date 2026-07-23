/**
 * Row overflow menus on Messages + Notifications — end-to-end.
 *
 * The per-row "✕" was replaced by a "⋮" that opens a dropdown with
 * Mark as read/unread · Report · Delete. This verifies the trigger renders,
 * the menu opens with the three actions, opening it does NOT open the row,
 * mark-unread actually flips the badge, and reporting submits a reason.
 *
 * Runs against the seeded owner (Oscar Walker) because he has both venue
 * threads and notifications; every mutation is undone in afterAll.
 */
import { test, expect, type Page } from '@playwright/test';

const APP = 'http://localhost:9000';
const API = 'http://localhost:9002/api/v1';
const EMAIL = 'ccdfa3b7.walker@example.com';
const PASSWORD = 'password123';

let token = '';

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  return res.json();
}

test.beforeAll(async () => {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  token = (await res.json()).data.accessToken;
});

/** Leave the seeded account exactly as we found it: every thread read. */
test.afterAll(async () => {
  const list = await api('/messages/conversations');
  for (const c of list.data ?? []) {
    if (c.unread > 0) await api(`/messages/conversations/${c.id}/read`, { method: 'POST', body: '{}' });
  }
});

async function skipIntro(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem('pb-splash-seen', '1'));
}

async function login(page: Page) {
  await skipIntro(page);
  await page.goto(`${APP}/login`);
  await page.addStyleTag({ content: '.install-prompt,.pwa-toast{display:none!important}' });
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.getByRole('button', { name: /^(sign in|log in)$/i }).first().click();
  await page.waitForFunction(() => !!localStorage.getItem('pb-access-token'), null, { timeout: 20000 });
}

test.use({ viewport: { width: 1280, height: 900 } });

test('messages: every row has a ⋮ that opens the three actions', async ({ page }) => {
  await login(page);
  await page.goto(`${APP}/messages`);

  const triggers = page.getByRole('button', { name: /More actions for the conversation with/i });
  await expect(triggers.first()).toBeVisible({ timeout: 15000 });
  expect(await triggers.count()).toBeGreaterThan(0);

  // The old delete-✕ is gone.
  await expect(page.getByRole('button', { name: /^Delete conversation with/i })).toHaveCount(0);

  await triggers.first().click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /Mark as (un)?read/ })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Report conversation' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Delete conversation' })).toBeVisible();

  // Opening the menu must not have opened the thread.
  expect(new URL(page.url()).pathname).toBe('/messages');

  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
});

test('messages: "Mark as unread" flips the badge and persists', async ({ page }) => {
  await login(page);
  await page.goto(`${APP}/messages`);

  const trigger = page.getByRole('button', { name: /More actions for the conversation with/i }).first();
  await expect(trigger).toBeVisible({ timeout: 15000 });
  await trigger.click();
  await page.getByRole('menuitem', { name: 'Mark as unread' }).click();

  await expect(page.getByText('Marked as unread')).toBeVisible();

  // Server agrees: at least one thread now carries unread.
  const after = await api('/messages/conversations');
  expect((after.data ?? []).some((c: { unread: number }) => c.unread > 0)).toBe(true);

  // And the menu now offers the inverse.
  await trigger.click();
  await expect(page.getByRole('menuitem', { name: 'Mark as read' })).toBeVisible();
});

test('messages: reporting a thread opens the reason picker and submits', async ({ page }) => {
  await login(page);
  await page.goto(`${APP}/messages`);

  const trigger = page.getByRole('button', { name: /More actions for the conversation with/i }).first();
  await expect(trigger).toBeVisible({ timeout: 15000 });
  await trigger.click();
  await page.getByRole('menuitem', { name: 'Report conversation' }).click();

  await expect(page.getByText('Why are you reporting this conversation?')).toBeVisible();
  await page.getByRole('button', { name: 'Harassment or bullying' }).click();
  await expect(page.getByText("Thanks — we'll take a look")).toBeVisible();
});

test('notifications: the row ⋮ carries the same three actions', async ({ page }) => {
  await login(page);
  await page.goto(`${APP}/notifications`);

  const trigger = page.getByRole('button', { name: 'Notification actions' }).first();
  await expect(trigger).toBeVisible({ timeout: 15000 });
  await trigger.click();

  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem', { name: /Mark as (un)?read/ })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Report notification' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Delete notification' })).toBeVisible();
});
