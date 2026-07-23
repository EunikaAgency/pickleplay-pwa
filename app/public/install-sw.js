/*
 * Minimal service worker whose ONLY job is to make the app installable.
 *
 * Chrome dropped the service-worker requirement for installing from the menu
 * (108 mobile / 112 desktop), but the heuristic that fires `beforeinstallprompt`
 * — the event behind our own in-app Install popup — still wants a fetch
 * handler present. Without one the event never fires and the popup can never
 * appear, which is exactly the bug this fixes.
 *
 * It deliberately caches NOTHING and never calls `respondWith`, so every
 * request goes to the network untouched. That matters: production here serves
 * the Vite DEV server (see ecosystem.config.cjs), and the reason the team runs
 * dev instead of preview is that a precaching worker kept serving a stale,
 * hashed app shell after each rebuild — the "routing disappeared" bug. A
 * no-op worker cannot reintroduce it. Do not add caching here; if the app ever
 * wants offline support, that belongs in the Workbox worker the build emits.
 */

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Registering at scope "/" replaces any earlier worker (the old precaching
      // one), so drop whatever it left behind rather than orphaning it.
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (e) {
        // Cache access can be denied; nothing here depends on it succeeding.
      }
      await self.clients.claim();
    })(),
  );
});

// Present on purpose, empty on purpose. See the note above.
self.addEventListener('fetch', () => {});
