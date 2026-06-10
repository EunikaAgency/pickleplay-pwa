/* Web Push handlers, imported into the Workbox-generated service worker via
   `workbox.importScripts` in vite.config. Keeps the generated precache/runtime
   caching intact while adding OS-level push for the app (e.g. "your lobby is
   full"). Payload shape (sent by the API): { title, body, url, tag }. */

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_e) { data = {}; }

  const title = data.title || 'PickleBallers';
  const options = {
    body: data.body || '',
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    tag: data.tag,
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus an already-open app window if there is one; otherwise open a new one.
      for (const client of clients) {
        if ('focus' in client) {
          if ('navigate' in client) { try { client.navigate(url); } catch (_e) { /* keep focus */ } }
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
