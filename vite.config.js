import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'react': 'preact/compat',
      'react-dom': 'preact/compat',
    },
  },
  build: {
    outDir: 'dist',
    copyPublicDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
      },
    },
  },
  publicDir: 'public',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'Visual Prompt Explorer',
        short_name: 'VPE',
        description: 'Explore and discover AI-generated visual styles with prompt-based search and filtering.',
        theme_color: '#151520',
        background_color: '#151520',
        display: 'standalone',
        icons: [
          {
            src: 'favicon.ico',
            sizes: '64x64',
            type: 'image/x-icon',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /images\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 5000, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
});