/**
 * Shared locators and actions for DateTimeFilterBar tests.
 *
 * All selectors are based on the component's rendered CSS classes
 * (dt-* namespace) from DateTimeFilterBar.tsx and its v2.css styles.
 */

import type { Page, Locator } from '@playwright/test';

// ── Locators ──────────────────────────────────────────────────────────

export const filterBar = (page: Page) => page.locator('.dt-filter-bar');
export const datePill = (page: Page) => page.locator('button.dt-pill[aria-label="Pick a date"]');
export const startPill = (page: Page) => page.locator('button.dt-pill[aria-label="Pick start time"]');
export const endPill = (page: Page) => page.locator('button.dt-pill[aria-label="Pick end time"]');
export const applyBtn = (page: Page) => page.locator('button.dt-action.dt-apply');
export const clearBtn = (page: Page) => page.locator('button.dt-action.dt-clear');
export const matchBadge = (page: Page) => page.locator('.dt-match-count');
export const loadingSpinner = (page: Page) => page.locator('.dt-loading');

// Date sheet
export const dateSheet = (page: Page) => page.locator('.dt-sheet-backdrop[role="dialog"]');
export const dateSheetTitle = (page: Page) => page.locator('h3.dt-sheet-title');
export const dateReadout = (page: Page) => page.locator('.dt-date-readout');
export const shortcutToday = (page: Page) => page.locator('button.dt-shortcut-chip').filter({ hasText: 'Today' });
export const shortcutTomorrow = (page: Page) => page.locator('button.dt-shortcut-chip').filter({ hasText: 'Tomorrow' });
export const shortcutWeekend = (page: Page) => page.locator('button.dt-shortcut-chip').filter({ hasText: 'This Weekend' });
export const dateApplyBtn = (page: Page) => page.locator('button.dt-sheet-btn.dt-sheet-apply');
export const dateCancelBtn = (page: Page) => page.locator('button.dt-sheet-btn.dt-sheet-cancel');
export const monthNavLabel = (page: Page) => page.locator('.dt-monthnav-label');
export const nextMonthBtn = (page: Page) => page.locator('button.dt-monthnav-btn[aria-label="Next month"]');
export const prevMonthBtn = (page: Page) => page.locator('button.dt-monthnav-btn[aria-label="Previous month"]');
export const prevYearBtn = (page: Page) => page.locator('button.dt-monthnav-btn[aria-label="Previous year"]');
export const nextYearBtn = (page: Page) => page.locator('button.dt-monthnav-btn[aria-label="Next year"]');

// Time dropdown
export const timeDropdown = (page: Page) => page.locator('div.dt-time-drop[role="dialog"]');
export const timeLabel = (page: Page) => page.locator('.dt-time-label');
export const amBtn = (page: Page) => page.locator('button.dt-ampm-btn').filter({ hasText: 'AM' });
export const pmBtn = (page: Page) => page.locator('button.dt-ampm-btn').filter({ hasText: 'PM' });
/** Hour chip by display text — uses exact match to avoid "2:00" matching "12:00". */
export function hourChip(page: Page, hour: number) {
  return page.locator('button.dt-hour-chip').filter({ hasText: new RegExp(`^${hour}:00$`) });
}
export const timeApplyBtn = (page: Page) => page.locator('button.dt-time-btn.dt-time-apply');
export const timeCancelBtn = (page: Page) => page.locator('button.dt-time-btn.dt-time-cancel');

// Venue list
export const venueCards = (page: Page) => page.locator('.court-card');
export const venueNames = (page: Page) => page.locator('.court-name');
export const featuredName = (page: Page) => page.locator('.feat-name');

// ── Actions ───────────────────────────────────────────────────────────

/** Pick a date using the shortcut chips (Today / Tomorrow / This Weekend). */
export async function pickShortcutDate(page: Page, shortcut: 'Today' | 'Tomorrow' | 'This Weekend') {
  await datePill(page).click();
  await dateSheet(page).waitFor({ state: 'visible', timeout: 3000 });
  const chip = shortcut === 'Today' ? shortcutToday(page)
    : shortcut === 'Tomorrow' ? shortcutTomorrow(page)
    : shortcutWeekend(page);
  await chip.click();
  await dateApplyBtn(page).click();
  await dateSheet(page).waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
}

/** Convert 24h hour to 12h display hour (the grid shows 12, 1, 2, ..., 11). */
function to12hDisplay(hour24: number): number {
  const h = hour24 % 12;
  return h === 0 ? 12 : h;
}

/** Determine AM/PM from a 24h hour value. */
function toAmpm(hour24: number): 'AM' | 'PM' {
  return hour24 < 12 ? 'AM' : 'PM';
}

/** Pick a start hour in 24h: tap the start pill → set AM/PM automatically → tap hour chip → Apply. */
export async function pickStartHour(page: Page, hour: number) {
  const h12 = to12hDisplay(hour);
  const ampm = toAmpm(hour);
  await startPill(page).click();
  await timeDropdown(page).waitFor({ state: 'visible', timeout: 3000 });
  if (ampm === 'AM') {
    await amBtn(page).click();
  } else {
    await pmBtn(page).click();
  }
  await hourChip(page, h12).click();
  await timeApplyBtn(page).click();
  await timeDropdown(page).waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
}

/** Pick an end hour in 24h: tap the end pill → set AM/PM automatically → tap hour chip → Apply. */
export async function pickEndHour(page: Page, hour: number) {
  const h12 = to12hDisplay(hour);
  const ampm = toAmpm(hour);
  await endPill(page).click();
  await timeDropdown(page).waitFor({ state: 'visible', timeout: 3000 });
  if (ampm === 'AM') {
    await amBtn(page).click();
  } else {
    await pmBtn(page).click();
  }
  await hourChip(page, h12).click();
  await timeApplyBtn(page).click();
  await timeDropdown(page).waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
}

/** Click the filter bar's Apply button and wait for the API call to settle. */
export async function applyFilter(page: Page) {
  await applyBtn(page).click();
  // Wait for the loading spinner to appear and disappear, or for match count to appear.
  try {
    await matchBadge(page).waitFor({ state: 'visible', timeout: 10000 });
  } catch {
    // If match badge never appears, that's fine — the test will assert the state.
  }
}

/** Click the Clear (X) button. */
export async function clearFilter(page: Page) {
  await clearBtn(page).click();
}

/** Get the text of the date pill's label span. */
export async function datePillLabel(page: Page): Promise<string> {
  return datePill(page).locator('.dt-pill-label').innerText();
}

/** Get the text of the start pill's label span. */
export async function startPillLabel(page: Page): Promise<string> {
  return startPill(page).locator('.dt-pill-label').innerText();
}

/** Get the text of the end pill's label span. */
export async function endPillLabel(page: Page): Promise<string> {
  return endPill(page).locator('.dt-pill-label').innerText();
}

/** Get the match count text (e.g. "5 venues"). */
export async function matchCountText(page: Page): Promise<string> {
  return matchBadge(page).innerText();
}

/** Count visible venue cards in the list. */
export async function venueCount(page: Page): Promise<number> {
  return venueCards(page).count();
}

/** Get all visible venue names as an array of strings. */
export async function getVenueNames(page: Page): Promise<string[]> {
  const els = await venueNames(page).all();
  const names = await Promise.all(els.map((el) => el.innerText()));
  // Also include featured name if present.
  try {
    const feat = await featuredName(page).innerText();
    return [feat, ...names];
  } catch {
    return names;
  }
}
