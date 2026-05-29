import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Dadagiri Unlimited',
        short_name: 'Dadagiri',
        description: 'দাদাগিরি Unlimited — Live Quiz Competition',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/dadagiri/',
        start_url: '/dadagiri/',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff,woff2}'],
        navigateFallback: '/dadagiri/index.html',
        navigateFallbackDenylist: [/^\/dadagiri\/api\//],
        runtimeCaching: [
          {
            // API calls — network first, fall back to cache for 5 min
            urlPattern: /\/dadagiri\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
        ],
      },
    }),
  ],
  base: '/dadagiri/',
  build: {
    outDir: '/opt/lampp/htdocs/dadagiri',
    emptyOutDir: false,
  },
  server: {
    port: 5173,
    proxy: {
      '/dadagiri/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
