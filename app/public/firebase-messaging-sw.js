// Firebase Cloud Messaging service worker.
// Firebase SDK looks for this file at /firebase-messaging-sw.js and uses it
// to handle push events sent through FCM (Android + any browser that routes
// through Google's push infrastructure).
//
// This SW runs IN ADDITION to the Workbox-generated main service worker.
// Firebase's getToken() with serviceWorkerRegistration uses our existing
// Workbox SW for registration scope while this file handles background
// message events from FCM's push channel.

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCrrRUkReCER98hjXkBTN4Gdlrv2mcG1qM",
  authDomain: "pickleballers-da675.firebaseapp.com",
  projectId: "pickleballers-da675",
  storageBucket: "pickleballers-da675.firebasestorage.app",
  messagingSenderId: "333083213227",
  appId: "1:333083213227:web:4f45bdb8bf57121d5926ee",
});

const messaging = firebase.messaging();

// Handle push messages arriving while the app is in the background (or tab is
// closed). Foreground messages are handled by onMessage() in the app's push.ts.
messaging.onBackgroundMessage((payload) => {
  // Our backend sends { title, body, url, tag } inside data.payload (JSON).
  // Firebase wraps it in payload.data — the notification.title/body keys are
  // for when FCM itself constructs the notification (we do it ourselves).
  const data = payload.data || {};
  let parsed: any = {};
  if (data.payload) {
    try { parsed = JSON.parse(data.payload); } catch (_e) { /* use raw data */ }
  }

  const title = parsed.title || data.title || 'PickleBallers';
  const options = {
    body: parsed.body || data.body || '',
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    tag: parsed.tag || data.tag,
    data: { url: parsed.url || data.url || '/' },
  };

  self.registration.showNotification(title, options);
});

// Notification click — same behaviour as the VAPID push-sw.js: open/focus the
// deep-linked page inside the PWA.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          if ('navigate' in client) {
            try { client.navigate(url); } catch (_e) { /* keep focus */ }
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
