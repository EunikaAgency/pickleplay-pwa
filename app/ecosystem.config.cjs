module.exports = {
  apps: [
    {
      name: 'pickleplay-pwa',
      cwd: '/var/public/pickleplay/app',
      script: 'npm',
      // Run the Vite DEV server (HMR) — NOT `vite preview`. Preview serves a
      // static, pre-built `dist/`, so source edits never showed up without a
      // manual `npm run build`, and its service worker kept serving a stale,
      // hashed app shell after each rebuild — that's the recurring "routing
      // disappeared" bug. The dev server reflects source changes instantly,
      // ships no service worker, and keeps full URL routing via Vite's SPA
      // history fallback (every path -> index.html, the app routes client-side).
      // Port/host/proxy come from `server` in vite.config.ts.
      args: 'run dev -- --host 0.0.0.0 --port 9000',
      env: {
        NODE_ENV: 'development',
      },
      // No PM2 `watch` here: Vite's own HMR handles source changes, and Vite
      // restarts itself when vite.config.ts changes. The old `watch: ['src']`
      // just bounced `vite preview` (re-serving the same stale dist) on every
      // edit and burned through max_restarts.
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
}
