/**
 * Sign-up: gender is a required field on the Create-account form.
 *
 * The API keeps it optional (web registers through the same endpoint and
 * doesn't collect one), so the form is the only thing enforcing it — which is
 * exactly what this guards, along with the value actually reaching the account.
 */
import { test, expect } from '@playwright/test';

const APP = 'http://localhost:9000';
const API = 'http://localhost:9002';

async function readGender(email: string, password: string): Promise<string | null> {
  const login = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const lj = await login.json() as { data?: { accessToken?: string } };
  if (!lj.data?.accessToken) throw new Error('login after register failed');
  const me = await fetch(`${API}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${lj.data.accessToken}` },
  });
  const mj = await me.json() as { data?: { gender?: string | null } };
  return mj.data?.gender ?? null;
}

test('sign-up requires a gender, and it lands on the new account', async ({ browser }, testInfo) => {
  // Unique per run so the spec is re-runnable without a 409.
  const email = `gender.e2e.${testInfo.workerIndex}.${process.pid}@example.com`;
  const password = 'password123';

  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(APP);
  await page.evaluate(() => sessionStorage.setItem('pb-splash-seen', '1'));
  await page.goto(`${APP}/login`);

  // Exact name: "Create an account" is the mode switch, "Create account" is the submit.
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible({ timeout: 20_000 });

  // Fill EVERYTHING except gender — the form must still refuse to submit.
  await page.getByLabel('Name').fill('Gender E2E');
  await page.getByLabel('Email').fill(email);
  // Exact: the show/hide eye carries an aria-label of "Show password".
  await page.getByLabel('Password', { exact: true }).fill(password);

  const submit = page.getByRole('button', { name: /create account/i });
  await expect(submit).toBeDisabled();

  // Picking a gender is the only thing that releases it.
  await page.getByRole('button', { name: 'Gender' }).click();
  // Exact: "Male" is a substring of "Female".
  await page.getByRole('option', { name: 'Male', exact: true }).click();
  await expect(submit).toBeEnabled();

  const registered = page.waitForResponse(
    (r) => r.url().includes('/api/v1/auth/register') && r.request().method() === 'POST' && r.ok(),
  );
  await submit.click();
  await registered;

  // The account really carries it — read it back from the server, not the UI.
  expect(await readGender(email, password)).toBe('male');
});
