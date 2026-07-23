/**
 * Remembers which admin-console sidebar sections ("Directory", "Moderation",
 * "System") the admin has opened or closed by hand, so the nav tree survives a
 * reload. Shared by the desktop `Sidebar` and the mobile `AdminDrawer` — both
 * render the same sections, so they read/write the same preference.
 *
 * Only sections the admin explicitly toggled are stored. Untouched sections
 * fall back to `collapsedByDefault()`, which opens the one holding the current
 * screen — so a reload, or a cold deep-link into `/admin/*`, lands with the
 * active tab visible instead of buried under a closed section.
 */
const STORAGE_KEY = 'pb-admin-sections';

export function readAdminSectionPrefs(): Record<string, boolean> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function writeAdminSectionPrefs(prefs: Record<string, boolean>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode / quota — the tree just won't be remembered */
  }
}

/** Whether `label` renders collapsed: an explicit choice, else "closed unless it holds the active screen". */
export function isSectionCollapsed(prefs: Record<string, boolean>, label: string, holdsActive: boolean): boolean {
  return prefs[label] ?? !holdsActive;
}
