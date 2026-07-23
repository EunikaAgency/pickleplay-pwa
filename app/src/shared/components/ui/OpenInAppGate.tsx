import { useEffect, useState } from 'react';
import {
  androidHandoffUrl,
  detectInstalledApp,
  handoffTried,
  isMobileDevice,
  isStandalone,
  markAppInstalled,
  markHandoffTried,
  observeInstallState,
  setStayInBrowser,
  stayInBrowser,
} from '../../lib/appLaunch';

/**
 * Sends a browser visitor to the installed app.
 *
 * Runs only when all of these hold: we're in browser chrome (not already the
 * app), the app *is* installed on this device, and the platform gives us a way
 * to launch it (today: Android's intent resolver → the WebAPK). Anyone without
 * the app installed never sees this — they just keep browsing.
 *
 * The hand-off is attempted automatically once per tab. Chrome can refuse an
 * external-protocol navigation that has no user gesture behind it, so the
 * overlay stays up as a one-tap fallback instead of leaving a dead page.
 */
export function OpenInAppGate() {
  const [visible, setVisible] = useState(false);
  const [launching, setLaunching] = useState(true);
  const [handoff, setHandoff] = useState<string | null>(null);

  useEffect(() => observeInstallState(), []);

  useEffect(() => {
    if (isStandalone()) {
      // Reaching this code from inside the app proves it's installed — worth
      // recording for browsers that can't answer getInstalledRelatedApps().
      markAppInstalled();
      return;
    }
    if (stayInBrowser()) return;
    // Phone/tablet only — a desktop visitor keeps their browser tab.
    if (!isMobileDevice()) return;

    const url = androidHandoffUrl();
    if (!url) return; // No launch path on this platform — stay in the browser.

    let cancelled = false;
    let timer: number | undefined;

    detectInstalledApp().then((installed) => {
      if (cancelled || !installed) return;
      setHandoff(url);
      setVisible(true);
      if (handoffTried()) {
        setLaunching(false);
        return;
      }
      markHandoffTried();
      window.location.href = url;
      // If the WebAPK took over, this tab is backgrounded and the timer never
      // matters. If it didn't, drop to the manual button.
      timer = window.setTimeout(() => {
        if (!cancelled) setLaunching(false);
      }, 1500);
    });

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  if (!visible || !handoff) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex flex-col items-center justify-center gap-5 px-8 text-center"
      style={{ background: 'var(--bg)' }}
      role="dialog"
      aria-live="polite"
      aria-label="Open in the PickleBallers app"
    >
      <img
        src="/pwa-192.png"
        alt=""
        width={72}
        height={72}
        className="rounded-[18px] shadow-[var(--shadow-pop)]"
      />
      <div>
        <div className="font-heading font-bold text-[19px] text-[var(--ink)]">
          {launching ? 'Opening the app…' : 'You have the app installed'}
        </div>
        <div className="mt-1.5 text-[13px] text-[var(--muted)] max-w-[300px] mx-auto">
          {launching
            ? 'Taking you to PickleBallers.'
            : 'PickleBallers runs better in the app. Open it to pick up where you left off.'}
        </div>
      </div>

      {!launching && (
        <div className="flex flex-col items-stretch gap-2.5 w-full max-w-[280px]">
          <a
            href={handoff}
            className="h-12 rounded-2xl bg-[var(--ink)] text-white font-heading font-semibold text-[15px] flex items-center justify-center"
          >
            Open app
          </a>
          <button
            onClick={() => {
              setStayInBrowser();
              setVisible(false);
            }}
            className="h-11 rounded-2xl font-heading font-semibold text-[14px] text-[var(--muted)]"
          >
            Continue in browser
          </button>
        </div>
      )}
    </div>
  );
}
