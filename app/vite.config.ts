import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Dev-only: neutralise any service worker left behind by a previous production
// (`vite preview`) build. The PWA SW precaches a hashed app shell; after a
// rebuild the bundle it points at is deleted, so on reload the SW serves an
// index.html referencing a script that no longer exists and the app fails to
// mount — the "routing disappeared" symptom. We now serve from the Vite dev
// server (no SW of its own), and answer the old SW's update check at /sw.js
// with a self-destroying worker that clears caches, unregisters, and reloads
// each open tab onto the live (SW-free) dev server. Once it has run, browsers
// hold no SW and load straight from the dev server.
function killStaleServiceWorker(): Plugin {
  const selfDestroyingSW = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) {}
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => c.navigate(c.url));
  })());
});
`
  return {
    name: 'kill-stale-service-worker',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] === '/sw.js') {
          res.setHeader('Content-Type', 'text/javascript')
          res.setHeader('Cache-Control', 'no-store')
          res.end(selfDestroyingSW)
          return
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [
    killStaleServiceWorker(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'PickleBallers',
        short_name: 'PickleBallers',
        description: 'Find pickleball games near you, meet players at your skill level, and turn your local courts into a community.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Pulls our Web Push handlers (public/push-sw.js) into the generated SW.
        importScripts: ['push-sw.js'],
        // Serve the app shell for deep links (e.g. /games/<id> from a notification
        // click) so they load the SPA; the in-app screen-stack then resolves the
        // path. API requests bypass the fallback so they hit the network.
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 9000,
    host: '0.0.0.0',
    allowedHosts: ['pickleballer-pwa.eunika.xyz', 'pickleplay-pwa.eunika.xyz', '.eunika.xyz'],
    proxy: {
      '/api': 'http://localhost:9002',
    },
  },
  preview: {
    port: 9000,
    host: '0.0.0.0',
    allowedHosts: ['pickleballer-pwa.eunika.xyz', 'pickleplay-pwa.eunika.xyz', '.eunika.xyz'],
  },
})
