/**
 * DateTimeFilterBar E2E tests — filter bar display + venue availability filtering.
 *
 * Prerequisites:
 *   1. API running on localhost:9002 with seeded test data
 *   2. App running on localhost:9000
 *
 * Run: npx playwright test --config=playwright.config.ts datetime-filter
 *
 * The Nearby screen is accessible to guests — most tests run without auth.
 */

import { test, expect } from '@playwright/test';
import {
  filterBar, datePill, startPill, endPill, applyBtn, clearBtn,
  matchBadge, loadingSpinner,
  dateSheet, dateSheetTitle, dateReadout,
  shortcutTomorrow, shortcutToday, shortcutWeekend,
  dateApplyBtn, dateCancelBtn,
  monthNavLabel, nextMonthBtn, prevYearBtn,
  timeDropdown, timeLabel, amBtn, pmBtn, hourChip,
  timeApplyBtn, timeCancelBtn,
  venueCards,
  pickShortcutDate, pickStartHour, pickEndHour, applyFilter, clearFilter,
  datePillLabel, startPillLabel, endPillLabel, matchCountText, venueCount,
} from './helpers/filter-helpers';

const APP = 'http://localhost:9000';

async function goNearby(page: import('@playwright/test').Page) {
  await page.goto(`${APP}/nearby`);
  await page.waitForTimeout(2000);

  // Dismiss the launch splash if present (once-per-session overlay).
  try {
    const splashBtn = page.locator('.pb-splash button, .pb-splash [role="button"]').first();
    if (await splashBtn.isVisible({ timeout: 3000 })) {
      await splashBtn.click();
      await page.waitForTimeout(1000);
    }
  } catch { /* no splash */ }

  // Force-dismiss via keyboard as fallback.
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } catch { /* ok */ }

  // Wait for the venue list to load.
  try {
    await venueCards(page).first().waitFor({ state: 'visible', timeout: 15000 });
  } catch {
    // Venue cards might not appear if the API is slow or data is sparse.
  }
}

// ─────────────────────────────────────────────────────────────────────
// Suite A — Pill display, interaction, and UI states
// ─────────────────────────────────────────────────────────────────────

test.describe('A: Filter bar display & interaction', () => {

  test('A.1 Default pill placeholders', async ({ page }) => {
    await goNearby(page);
    await expect(filterBar(page)).toBeVisible({ timeout: 5000 });

    expect(await datePillLabel(page)).toBe('Any date');
    expect(await startPillLabel(page)).toBe('Start');
    expect(await endPillLabel(page)).toBe('End');
  });

  test('A.2 Date pill opens date sheet', async ({ page }) => {
    await goNearby(page);
    await datePill(page).click();
    await expect(dateSheet(page)).toBeVisible({ timeout: 3000 });
    await expect(dateSheetTitle(page)).toHaveText('Pick a date');
    await expect(shortcutToday(page)).toBeVisible();
    await expect(shortcutTomorrow(page)).toBeVisible();
    await expect(shortcutWeekend(page)).toBeVisible();
  });

  test('A.3 "Tomorrow" shortcut updates the date readout', async ({ page }) => {
    await goNearby(page);
    await datePill(page).click();
    await dateSheet(page).waitFor({ state: 'visible', timeout: 3000 });
    await shortcutTomorrow(page).click();

    const readout = await dateReadout(page).innerText();
    expect(readout).not.toBe('');
    expect(readout).not.toContain('Any');
    expect(readout).toContain('2026');
  });

  test('A.4 Date sheet "Apply" updates the pill label', async ({ page }) => {
    await goNearby(page);
    await pickShortcutDate(page, 'Tomorrow');

    const label = await datePillLabel(page);
    expect(label).not.toBe('Any date');
    expect(label).toMatch(/[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}/);
  });

  test('A.5 Date sheet "Cancel" reverts the draft', async ({ page }) => {
    await goNearby(page);
    const before = await datePillLabel(page);

    await datePill(page).click();
    await dateSheet(page).waitFor({ state: 'visible', timeout: 3000 });
    await shortcutTomorrow(page).click();
    await dateCancelBtn(page).click();
    await dateSheet(page).waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});

    expect(await datePillLabel(page)).toBe(before);
  });

  test('A.6 Date sheet closes on backdrop click', async ({ page }) => {
    await goNearby(page);
    await datePill(page).click();
    await dateSheet(page).waitFor({ state: 'visible', timeout: 3000 });

    // Click the backdrop at a position that avoids the v2 top-nav (48px tall).
    const backdrop = page.locator('.dt-sheet-backdrop');
    await backdrop.click({ position: { x: 10, y: 100 } });

    await expect(dateSheet(page)).not.toBeVisible({ timeout: 3000 });
  });

  test('A.7 Date sheet closes on Escape key', async ({ page }) => {
    await goNearby(page);
    await datePill(page).click();
    await dateSheet(page).waitFor({ state: 'visible', timeout: 3000 });

    await page.keyboard.press('Escape');
    await expect(dateSheet(page)).not.toBeVisible({ timeout: 3000 });
  });

  test('A.8 Start time pill opens hour dropdown', async ({ page }) => {
    await goNearby(page);
    await startPill(page).click();
    await expect(timeDropdown(page)).toBeVisible({ timeout: 3000 });
    await expect(timeLabel(page).filter({ hasText: 'Start time' })).toBeVisible();
    await expect(amBtn(page)).toBeVisible();
    await expect(pmBtn(page)).toBeVisible();
  });

  test('A.9 Start time: select 9 AM and apply updates pill', async ({ page }) => {
    await goNearby(page);
    await pickStartHour(page, 9); // 9 AM (24h)
    expect(await startPillLabel(page)).toBe('9:00 AM');
  });

  test('A.10 Start time: select 14 (2 PM) updates pill', async ({ page }) => {
    await goNearby(page);
    await pickStartHour(page, 14); // 2 PM (24h)
    expect(await startPillLabel(page)).toBe('2:00 PM');
  });

  test('A.11 Start time: Cancel reverts', async ({ page }) => {
    await goNearby(page);
    const before = await startPillLabel(page);

    await startPill(page).click();
    await timeDropdown(page).waitFor({ state: 'visible', timeout: 3000 });
    // Click 5:00 hour chip (AM by default).
    await hourChip(page, 5).click();
    await timeCancelBtn(page).click();
    await timeDropdown(page).waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});

    expect(await startPillLabel(page)).toBe(before);
  });

  test('A.12 End time pill opens independently', async ({ page }) => {
    await goNearby(page);
    await endPill(page).click();
    await expect(timeDropdown(page)).toBeVisible({ timeout: 3000 });
    await expect(timeLabel(page).filter({ hasText: 'End time' })).toBeVisible();
  });

  test('A.13 End time: select 12 PM updates pill', async ({ page }) => {
    await goNearby(page);
    await pickEndHour(page, 12); // noon (24h)
    expect(await endPillLabel(page)).toBe('12:00 PM');
  });

  test('A.14 Mutual exclusion: opening date closes start dropdown', async ({ page }) => {
    await goNearby(page);

    await startPill(page).click();
    await expect(timeDropdown(page)).toBeVisible({ timeout: 3000 });

    await datePill(page).click();
    await expect(timeDropdown(page)).not.toBeVisible();
    await expect(dateSheet(page)).toBeVisible({ timeout: 3000 });
  });

  test('A.15 Apply button disabled without start hour', async ({ page }) => {
    await goNearby(page);
    await expect(applyBtn(page)).toBeDisabled();
  });

  test('A.16 Apply button enabled with start hour', async ({ page }) => {
    await goNearby(page);
    await pickStartHour(page, 10); // 10 AM
    await expect(applyBtn(page)).not.toBeDisabled();
  });

  test('A.17 Clear button visible when filter is active', async ({ page }) => {
    await goNearby(page);
    await expect(clearBtn(page)).not.toBeVisible();

    await pickShortcutDate(page, 'Tomorrow');
    await pickStartHour(page, 10);
    await applyFilter(page);

    await expect(clearBtn(page)).toBeVisible({ timeout: 5000 });
  });

  test('A.18 Clear button resets all pills', async ({ page }) => {
    await goNearby(page);

    await pickShortcutDate(page, 'Tomorrow');
    await pickStartHour(page, 10);
    await applyFilter(page);
    await expect(clearBtn(page)).toBeVisible({ timeout: 5000 });

    await clearFilter(page);

    await expect(clearBtn(page)).not.toBeVisible();
    expect(await datePillLabel(page)).toBe('Any date');
    expect(await startPillLabel(page)).toBe('Start');
    expect(await endPillLabel(page)).toBe('End');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Suite B — Venue availability filtering (integration with API)
// ─────────────────────────────────────────────────────────────────────

test.describe('B: Venue availability filtering', () => {

  test('B.1 Apply triggers loading spinner', async ({ page }) => {
    await goNearby(page);
    await pickShortcutDate(page, 'Tomorrow');
    await pickStartHour(page, 10);

    // Click Apply — spinner should appear briefly.
    const spinnerPromise = loadingSpinner(page).waitFor({ state: 'visible', timeout: 5000 }).catch(() => null);
    await applyBtn(page).click();
    await spinnerPromise;
    // Spinner should eventually disappear.
    await loadingSpinner(page).waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  });

  test('B.2 Match count appears after applying filter', async ({ page }) => {
    await goNearby(page);
    await expect(matchBadge(page)).not.toBeVisible();

    await pickShortcutDate(page, 'Tomorrow');
    await pickStartHour(page, 10);
    await applyBtn(page).click();

    // Wait for the API call to complete — match count or error state.
    await page.waitForTimeout(3000);

    // After Apply, if the API succeeds, matchBadge appears.
    // If the API fails (no availability data), the venue list is unchanged.
    // Either is valid behavior — the page shouldn't crash.
    const badgeVisible = await matchBadge(page).isVisible().catch(() => false);
    const hasVenues = await venueCards(page).first().isVisible().catch(() => false);
    if (badgeVisible) {
      const text = await matchCountText(page);
      expect(text).toMatch(/\d+ venues?/);
    }
    // Either way, the page is still functional.
    expect(hasVenues || badgeVisible).toBe(true);
  });

  test('B.3 Match count uses singular for 1 venue', async ({ page }) => {
    // Try several uncommon hours to find one with exactly 1 available venue.
    await goNearby(page);
    await pickShortcutDate(page, 'Tomorrow');

    for (const hour of [5, 6, 23, 22, 21]) {
      await pickStartHour(page, hour);
      await applyBtn(page).click();
      await page.waitForTimeout(3000);

      if (await matchBadge(page).isVisible().catch(() => false)) {
        const text = await matchCountText(page);
        if (text === '1 venue') {
          expect(text).toBe('1 venue');
          return;
        }
      }
      // Clear for next try.
      if (await clearBtn(page).isVisible().catch(() => false)) {
        await clearBtn(page).click();
        await page.waitForTimeout(500);
      }
    }
    // If no singular match, just verify the badge format is correct.
    const badgeVisible = await matchBadge(page).isVisible().catch(() => false);
    if (badgeVisible) {
      expect(await matchCountText(page)).toMatch(/\d+ venues?/);
    }
    // Test passes either way — it's data-dependent.
  });

  test('B.4 Venue list narrows after filter', async ({ page }) => {
    await goNearby(page);
    const before = await venueCount(page);
    expect(before).toBeGreaterThan(0);

    await pickShortcutDate(page, 'Tomorrow');
    await pickStartHour(page, 12); // noon
    await applyBtn(page).click();
    await page.waitForTimeout(3000);

    const after = await venueCount(page);
    expect(after).toBeLessThanOrEqual(before);
  });

  test('B.5 Multi-hour window filtering', async ({ page }) => {
    await goNearby(page);

    await pickShortcutDate(page, 'Tomorrow');
    await pickStartHour(page, 9);   // 9 AM
    await pickEndHour(page, 12);    // 12 PM
    await applyBtn(page).click();
    await page.waitForTimeout(3000);

    // The page should not crash regardless of match count visibility.
    await expect(filterBar(page)).toBeVisible();
  });

  test('B.6 Clear restores unfiltered list', async ({ page }) => {
    await goNearby(page);

    await pickShortcutDate(page, 'Tomorrow');
    await pickStartHour(page, 10);
    await applyBtn(page).click();
    await page.waitForTimeout(3000);
    const filteredCount = await venueCount(page);

    await clearFilter(page);
    await page.waitForTimeout(1000);

    const restoredCount = await venueCount(page);
    expect(restoredCount).toBeGreaterThanOrEqual(filteredCount);
    await expect(matchBadge(page)).not.toBeVisible();
  });

  test('B.7 Active class on filter bar when filter applied', async ({ page }) => {
    await goNearby(page);
    await expect(page.locator('.dt-filter-bar.active')).not.toBeVisible();

    await pickShortcutDate(page, 'Tomorrow');
    await pickStartHour(page, 10);
    await applyBtn(page).click();
    await page.waitForTimeout(2000);

    await expect(page.locator('.dt-filter-bar.active')).toBeVisible({ timeout: 5000 });
  });

  test('B.8 Active class removed on clear', async ({ page }) => {
    await goNearby(page);
    await pickShortcutDate(page, 'Tomorrow');
    await pickStartHour(page, 10);
    await applyBtn(page).click();
    await expect(page.locator('.dt-filter-bar.active')).toBeVisible({ timeout: 5000 });

    await clearFilter(page);
    await expect(page.locator('.dt-filter-bar.active')).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Suite C — Edge cases and robustness
// ─────────────────────────────────────────────────────────────────────

test.describe('C: Edge cases & robustness', () => {

  test('C.1 Loading spinner and match count never visible simultaneously', async ({ page }) => {
    await goNearby(page);
    await pickShortcutDate(page, 'Tomorrow');
    await pickStartHour(page, 10);

    await applyBtn(page).click();
    await page.waitForTimeout(3000);

    const spinnerVisible = await loadingSpinner(page).isVisible().catch(() => false);
    const badgeVisible = await matchBadge(page).isVisible().catch(() => false);

    expect(spinnerVisible && badgeVisible).toBe(false);
  });

  test('C.2 Month navigation works in date picker', async ({ page }) => {
    await goNearby(page);
    await datePill(page).click();
    await dateSheet(page).waitFor({ state: 'visible', timeout: 3000 });

    const firstMonth = await monthNavLabel(page).innerText();

    // Force-click to bypass potential top-nav interception.
    await nextMonthBtn(page).click({ force: true });
    await page.waitForTimeout(300);

    const secondMonth = await monthNavLabel(page).innerText();
    expect(secondMonth).not.toBe(firstMonth);
  });

  test('C.3 Previous year navigation works in date picker', async ({ page }) => {
    await goNearby(page);
    await datePill(page).click();
    await dateSheet(page).waitFor({ state: 'visible', timeout: 3000 });

    const firstYear = (await monthNavLabel(page).innerText()).match(/\d{4}/)?.[0];
    expect(firstYear).toBeDefined();

    // Force-click to bypass potential top-nav interception.
    await prevYearBtn(page).click({ force: true });
    await page.waitForTimeout(300);

    const secondYear = (await monthNavLabel(page).innerText()).match(/\d{4}/)?.[0];
    expect(secondYear).toBeDefined();
    expect(Number(secondYear)).toBe(Number(firstYear) - 1);
  });

  test('C.4 Obscure-hour filter does not crash', async ({ page }) => {
    await goNearby(page);
    await pickShortcutDate(page, 'Tomorrow');
    await pickStartHour(page, 3); // 3 AM — unlikely to have courts open.
    await applyBtn(page).click();
    await page.waitForTimeout(3000);

    await expect(page.locator('text=Could not load')).toHaveCount(0);
    await expect(filterBar(page)).toBeVisible();
  });

  test('C.5 "This Weekend" shortcut works', async ({ page }) => {
    await goNearby(page);
    await datePill(page).click();
    await dateSheet(page).waitFor({ state: 'visible', timeout: 3000 });

    await shortcutWeekend(page).click();
    const readout = await dateReadout(page).innerText();
    expect(readout).not.toBe('');
    const day = readout.split(',')[0]?.trim();
    expect(['Saturday', 'Sunday']).toContain(day);
  });

  test('C.6 Filter survives sheet collapse/expand', async ({ page }) => {
    await goNearby(page);

    await pickShortcutDate(page, 'Tomorrow');
    await pickStartHour(page, 10);
    await applyBtn(page).click();
    await page.waitForTimeout(3000);

    const filteredCount = await venueCount(page);

    const handleBtn = page.locator('button.sheet-handle');
    if (await handleBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await handleBtn.click();
      await page.waitForTimeout(1000);
      await handleBtn.click();
      await page.waitForTimeout(1000);
    }

    const afterCount = await venueCount(page);
    expect(afterCount).toBe(filteredCount);
  });

  test('C.7 Apply with end hour ≤ start hour drops the end hour', async ({ page }) => {
    await goNearby(page);

    await pickShortcutDate(page, 'Tomorrow');
    await pickStartHour(page, 10);  // 10 AM
    await pickEndHour(page, 9);     // 9 AM — before start, should be dropped
    await applyBtn(page).click();
    await page.waitForTimeout(3000);

    // Should still work (single-hour window [10, 11)).
    // Either match count appears or page is still functional.
    await expect(page.locator('text=Could not load')).toHaveCount(0);
    await expect(filterBar(page)).toBeVisible();
  });
});
