/**
 * sw.js — Service worker for the Krea 2 Turbo Style Explorer.
 * Enables offline caching when served over HTTP(S).
 *
 * Strategy:
 *  - Precache the app shell (HTML/CSS/core JS) on install (stale-while-revalidate)
 *  - Runtime-cache images with cache-first, network fallback
 *  - Never cache cross-origin (CDN/Supabase) — let the browser handle those
 *
 * NOTE: During the migration, this manual sw.js serves the legacy vanilla-JS pages.
 * The Vite PWA plugin also generates its own service worker for the React/Preact build
 * in the dist/ folder. Both can coexist during transition.
 */

const CACHE_NAME = 'krea-style-explorer-v5';
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// App shell files - essential for offline functionality
const APP_SHELL = [
  './',
  './index.html',
  './app/style.css',
  './sw.js',
];

// Data files that should be stale-while-revalidate
const DATA_FILES = [
  './app/data.js',
];

// Runtime caching patterns
const RUNTIME_PATTERNS = {
  images: /^\/images\/.*/i,
  cdn: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Add app shell files (priority)
        return Promise.all(
          APP_SHELL.map(url => cache.add(url).catch(err => {
            console.warn('[SW] Failed to cache app shell:', url, err);
          }))
        );
      })
      .then(() => {
        // Skip waiting to activate immediately
        self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => {
        // Delete old caches
        return Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        );
      })
      .then(() => {
        // Claim all clients
        self.clients.claim();
      })
  );
});

/**
 * Check if a request should be cached (same-origin only, exclude certain hostnames)
 */
function shouldCache(request) {
  const url = new URL(request.url);
  
  // Only handle same-origin GET requests
  if (request.method !== 'GET') return false;
  if (url.origin !== self.location.origin) return false;
  
  // Never cache Supabase, analytics, or external resources
  if (url.hostname.includes('supabase') || url.hostname.includes('googletagmanager')) return false;
  
  return true;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  if (!shouldCache(request)) return;
  
  const url = new URL(request.url);
  
  // Data files: stale-while-revalidate (always check network first)
  if (DATA_FILES.some(pattern => url.pathname === pattern.slice(2))) {
    event.respondWith(
      fetch(request)
        .then(networkResponse => {
          // Update cache with fresh response
          if (networkResponse && networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(request);
        })
    );
    return;
  }
  
  // Images: cache-first with network fallback
  if (RUNTIME_PATTERNS.images.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(networkResponse => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return networkResponse;
        }).catch(() => {
          // Offline fallback for navigation
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
    );
    return;
  }
  
  // Other same-origin assets: cache-first with network fallback
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(networkResponse => {
        if (networkResponse && networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return networkResponse;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

/**
 * Clean up expired cache entries on message
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});