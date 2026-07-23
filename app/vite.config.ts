import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readdirSync, statSync, existsSync, createReadStream } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { basename, join } from 'node:path'

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

// Serve the sibling `plan/` directory's PDFs to the app (read live, no build
// step). Powers the /operational-gap viewer: `/__plan/list.json` enumerates the
// PDFs currently in ../plan, and `/__plan/file/<name>` streams one for inline
// preview. Not under `/api` (that prefix is proxied to the Hono backend), and
// filenames are `basename`-sanitised so no path traversal can escape plan/.
function planPdfServer(): Plugin {
  const planDir = fileURLToPath(new URL('../plan', import.meta.url))
  return {
    name: 'plan-pdf-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0]
        if (url === '/__plan/list.json') {
          try {
            const files = existsSync(planDir)
              ? readdirSync(planDir).filter((f) => f.toLowerCase().endsWith('.pdf'))
              : []
            const items = files
              .map((name) => {
                const st = statSync(join(planDir, name))
                return { name, size: st.size, mtime: st.mtimeMs }
              })
              .sort((a, b) => b.mtime - a.mtime)
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'no-store')
            res.end(JSON.stringify({ items }))
          } catch {
            res.statusCode = 500
            res.end(JSON.stringify({ items: [], error: 'read_failed' }))
          }
          return
        }
        if (url.startsWith('/__plan/file/')) {
          const raw = decodeURIComponent(url.slice('/__plan/file/'.length))
          const name = basename(raw) // strip any traversal segments
          const full = join(planDir, name)
          if (!name.toLowerCase().endsWith('.pdf') || !existsSync(full)) {
            res.statusCode = 404
            res.end('Not found')
            return
          }
          res.setHeader('Content-Type', 'application/pdf')
          res.setHeader('Content-Disposition', `inline; filename="${name}"`)
          res.setHeader('Cache-Control', 'no-store')
          createReadStream(full).pipe(res)
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
    planPdfServer(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.png', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'PickleBallers',
        short_name: 'PickleBallers',
        description: 'Find pickleball games near you, meet players at your skill level, and turn your local courts into a community.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        // Ask the OS to route in-scope links straight to the installed app
        // instead of a browser tab, and to reuse an already-open app window
        // rather than stacking a new one. This is what makes "tapped a link,
        // landed in the app" work without any client-side redirect.
        handle_links: 'preferred',
        launch_handler: { client_mode: 'navigate-existing' },
        // Self-reference so `navigator.getInstalledRelatedApps()` can tell a
        // page running in the browser that this device already has the app
        // (see shared/lib/appLaunch.ts). Chrome only reports apps listed here,
        // and matches them by manifest URL — hence one entry per public host.
        related_applications: [
          { platform: 'webapp', url: 'https://pickleballer-pwa.eunika.xyz/manifest.webmanifest' },
          { platform: 'webapp', url: 'https://pickleplay-pwa.eunika.xyz/manifest.webmanifest' },
        ],
        prefer_related_applications: false,
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
    // This host serves the live PWA from Vite, but the app directory also
    // contains large agent/report trees that are never application modules.
    // Watching them exhausts Linux inotify handles and crashes the origin with
    // ENOSPC/Cloudflare 502. Keep HMR on source/config files only.
    watch: {
      ignored: ['**/.agents/**', '**/.claude/**', '**/report/**', '**/dist/**'],
    },
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
