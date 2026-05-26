import { registerSW } from 'virtual:pwa-register';

const RELOAD_FLAG = 'pickleplay-sw-reloading';

registerSW({
  immediate: true,
  onNeedReload() {
    if (sessionStorage.getItem(RELOAD_FLAG) === '1') return;
    sessionStorage.setItem(RELOAD_FLAG, '1');
    window.location.reload();
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;

    const checkForUpdate = () => {
      registration.update().catch(() => {
        // Update checks are best-effort; the app should keep running offline.
      });
    };

    window.addEventListener('pageshow', checkForUpdate);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    });

    window.setInterval(checkForUpdate, 30 * 60 * 1000);
    window.addEventListener('load', () => {
      sessionStorage.removeItem(RELOAD_FLAG);
      checkForUpdate();
    });
  },
});
