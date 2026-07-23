import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import {
  detectInstalledApp,
  isAndroid,
  isMobileDevice,
  isStandalone,
  markAppInstalled,
  markAppNotInstalled,
  registerInstallWorker,
} from '../../lib/appLaunch';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Remembered across reloads so the popup asks once, not on every visit. */
const DISMISSED_KEY = 'pb-install-dismissed';
/** How long to wait for `beforeinstallprompt` before offering manual steps. */
const NATIVE_PROMPT_GRACE_MS = 2500;

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * "Install the app" popup, shown on Android phones that don't have it yet.
 *
 * Scoped to Android on purpose: iOS is out for now (Safari has no install
 * event — the user would have to be walked through Share → Add to Home Screen),
 * and desktop visitors are fine in a tab.
 *
 * Chrome hands us a `beforeinstallprompt` event that turns Install into one
 * tap. It only fires once the page has a service worker with a fetch handler
 * (see public/install-sw.js) and Chrome is satisfied the app is installable, so
 * we wait a beat for it — and if it never arrives, we still show the popup and
 * point at the browser menu rather than pretending nothing is possible.
 */
export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const eligible = useRef(false);

  useEffect(() => {
    if (isStandalone()) {
      markAppInstalled();
      return;
    }
    if (!isMobileDevice() || !isAndroid()) return; // Android phones only, for now.
    if (wasDismissed()) return;

    let cancelled = false;
    let timer: number | undefined;

    const onBeforeInstall = (e: Event) => {
      // Chrome only fires this when the app is NOT installed — so it doubles as
      // the signal that clears a stale "installed" flag.
      e.preventDefault();
      markAppNotInstalled();
      if (cancelled) return;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (eligible.current) setVisible(true);
    };
    const onInstalled = () => {
      markAppInstalled();
      if (cancelled) return;
      setDeferredPrompt(null);
      setVisible(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    registerInstallWorker();

    detectInstalledApp().then((installed) => {
      if (cancelled || installed) return; // Already has it — OpenInAppGate's job.
      eligible.current = true;
      // Show as soon as Chrome offers the one-tap prompt; otherwise fall back
      // to the manual instructions after a short grace period.
      timer = window.setTimeout(() => {
        if (!cancelled) setVisible(true);
      }, NATIVE_PROMPT_GRACE_MS);
    });

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    if (deferredPrompt && eligible.current) setVisible(true);
  }, [deferredPrompt]);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Without storage the popup simply asks again next visit.
    }
    setVisible(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        markAppInstalled();
        setVisible(false);
      }
    } catch {
      // A prompt can only be shown once; if it's spent, leave the popup up so
      // the manual route below is still reachable.
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[1900] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Install PickleBallers">
      <div className="absolute inset-0 bg-black/45" onClick={dismiss} aria-hidden="true" />
      <div
        className="relative w-full max-w-[440px] m-3 p-5 rounded-[24px] text-center"
        style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-pop)', marginBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-[var(--surface-2)] text-[var(--ink-2)] flex items-center justify-center"
        >
          <Icon name="close" size={14} />
        </button>

        <img src="/pwa-192.png" alt="" width={64} height={64} className="mx-auto rounded-[16px]" />
        <div className="mt-3 font-heading font-bold text-[18px] text-[var(--ink)]">Install PickleBallers</div>
        <div className="mt-1.5 text-[13px] text-[var(--muted)] max-w-[300px] mx-auto">
          {deferredPrompt
            ? 'Add it to your home screen for a full-screen app, faster loads, and game notifications.'
            : 'Open your browser menu (⋮) and tap “Install app” to add PickleBallers to your home screen.'}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {deferredPrompt && (
            <button
              onClick={handleInstall}
              disabled={installing}
              className="h-12 rounded-2xl bg-[var(--ink)] text-white font-heading font-semibold text-[15px] disabled:opacity-60"
            >
              {installing ? 'Installing…' : 'Install app'}
            </button>
          )}
          <button onClick={dismiss} className="h-11 rounded-2xl font-heading font-semibold text-[14px] text-[var(--muted)]">
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
