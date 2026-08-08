import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'favicon-32.png'],
      manifest: {
        name: 'Collections Ultimate',
        short_name: 'Collections',
        description: 'Catalogue, organise and verify your household library.',
        theme_color: '#1e293b',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],

        // The API is same-origin in production (Caddy serves the SPA and proxies
        // /api on one domain), so the SPA navigation fallback would otherwise
        // swallow API routes and hand back index.html on a cold start.
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/proxy/, /^\/uploads/, /^\/health/],

        // Deliberately NO runtime caching of /api. This app is multi-tenant and
        // Auth0-authenticated: a cached response served to a different account,
        // household, or after a role change is a data-disclosure bug, not a stale
        // read. Real offline data is the job of the sync layer (local SQLite in
        // the native client), not of an opportunistic HTTP cache.
        // This service worker caches the app SHELL only.
        runtimeCaching: [],

        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // Keep the service worker out of `npm run dev`; a stale precache during
        // development is a confusing way to lose an afternoon.
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5173,
    open: true
  }
})
