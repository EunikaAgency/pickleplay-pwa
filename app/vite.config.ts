import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
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
