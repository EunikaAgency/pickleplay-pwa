/**
 * Installed-app hand-off.
 *
 * A page running in an ordinary browser tab cannot *force* the installed PWA
 * open — no web API does that. What it can do is:
 *   1. find out whether this device already has the app installed, and
 *   2. hand the current URL to Android's intent resolver, which routes an
 *      in-scope https link to the installed WebAPK when one is registered
 *      (the WebAPK auto-verifies our host, so it wins the intent).
 * Anything else (iOS Safari, desktop) has no launch path, so it stays in the
 * browser — which is exactly the "kung hindi naka-install, browser lang" half
 * of the behaviour.
 *
 * The declarative half lives in the manifest (`handle_links: 'preferred'` +
 * `launch_handler`), which is what makes Chrome open in-scope *links* in the
 * app without any of this code running at all.
 */

/** Set once this device installs the app; the only signal iOS/Firefox give us. */
const INSTALLED_KEY = 'pb-app-installed';
/** Per-tab guard so a failed hand-off can't bounce us in a loop. */
const HANDOFF_TRIED_KEY = 'pb-open-in-app-tried';
/** User explicitly chose the browser — respected until they clear site data. */
const STAY_IN_BROWSER_KEY = 'pb-stay-in-browser';

interface RelatedApp {
  platform?: string;
  url?: string;
  id?: string;
}

interface NavigatorWithRelatedApps extends Navigator {
  getInstalledRelatedApps?: () => Promise<RelatedApp[]>;
  standalone?: boolean;
}

function readLocal(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeLocal(key: string, value: boolean) {
  try {
    if (value) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable (private mode / blocked cookies); the checks
    // above already treat a missing value as "unknown", so we just lose memory.
  }
}

/** True when we're already running *as* the app, not in browser chrome. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as NavigatorWithRelatedApps;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    nav.standalone === true
  );
}

export function markAppInstalled() {
  writeLocal(INSTALLED_KEY, true);
}

/**
 * Clears the remembered install. Called when `beforeinstallprompt` fires —
 * that event only fires when the app is *not* installed, so it's a reliable
 * self-heal after the user uninstalls.
 */
export function markAppNotInstalled() {
  writeLocal(INSTALLED_KEY, false);
  writeLocal(STAY_IN_BROWSER_KEY, false);
}

export function stayInBrowser(): boolean {
  return readLocal(STAY_IN_BROWSER_KEY);
}

export function setStayInBrowser() {
  writeLocal(STAY_IN_BROWSER_KEY, true);
}

/**
 * Is the app installed on this device?
 *
 * `getInstalledRelatedApps()` (Chromium, Android + desktop) is authoritative
 * in both directions — it only answers for apps declared in the manifest's
 * `related_applications`, which is why the manifest self-references its own
 * URL. Where the API doesn't exist we fall back to our own remembered flag.
 */
export async function detectInstalledApp(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as NavigatorWithRelatedApps;
  if (typeof nav.getInstalledRelatedApps !== 'function') return readLocal(INSTALLED_KEY);
  try {
    const related = await nav.getInstalledRelatedApps();
    const installed = related.some((app) => app.platform === 'webapp');
    writeLocal(INSTALLED_KEY, installed);
    if (!installed) writeLocal(STAY_IN_BROWSER_KEY, false);
    return installed;
  } catch {
    // The call rejects on non-secure origins and in some embedded webviews.
    return readLocal(INSTALLED_KEY);
  }
}

export function isAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android/i.test(window.navigator.userAgent || '');
}

/**
 * The Android intent URL that hands this exact page to the installed WebAPK.
 * `browser_fallback_url` sends us back here if nothing claims the intent, so a
 * miss is a no-op rather than an error page.
 */
export function androidHandoffUrl(): string | null {
  if (typeof window === 'undefined' || !isAndroid()) return null;
  const { host, pathname, search, hash, href, protocol } = window.location;
  if (protocol !== 'https:') return null; // WebAPKs only claim https links
  const target = `${pathname}${search}${hash}`;
  return (
    `intent://${host}${target}#Intent;scheme=https;` +
    'action=android.intent.action.VIEW;' +
    'category=android.intent.category.BROWSABLE;' +
    `S.browser_fallback_url=${encodeURIComponent(href)};end`
  );
}

export function handoffTried(): boolean {
  try {
    return sessionStorage.getItem(HANDOFF_TRIED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markHandoffTried() {
  try {
    sessionStorage.setItem(HANDOFF_TRIED_KEY, '1');
  } catch {
    // Without sessionStorage we simply retry once per page load.
  }
}

/**
 * Keeps the remembered install flag honest for browsers with no
 * `getInstalledRelatedApps`. Returns an unsubscribe.
 */
export function observeInstallState(): () => void {
  const onInstalled = () => markAppInstalled();
  const onPromptable = () => markAppNotInstalled();
  window.addEventListener('appinstalled', onInstalled);
  window.addEventListener('beforeinstallprompt', onPromptable);
  return () => {
    window.removeEventListener('appinstalled', onInstalled);
    window.removeEventListener('beforeinstallprompt', onPromptable);
  };
}
