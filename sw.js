/**
 * CocinaFÃ¡cil â Service Worker
 * Provides offline support via Cache-First strategy for static assets,
 * and Network-First for API calls.
 */

const CACHE_NAME = 'cocinafacil-v2';
const STATIC_ASSETS = [
  '/cocinafacil/',
  '/cocinafacil/index.html',
  '/cocinafacil/styles.css',
  '/cocinafacil/app.js',
  '/cocinafacil/manifest.json',
  '/cocinafacil/icons/icon-192.png',
  '/cocinafacil/icons/icon-512.png',
];

// âââ Install: cache static shell âââââââââââââââââââââââââââââââââââââââââââââ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// âââ Activate: clean up old caches âââââââââââââââââââââââââââââââââââââââââââ
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// âââ Fetch: strategy by request type âââââââââââââââââââââââââââââââââââââââââ
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Network-First for TheMealDB API
  if (url.hostname === 'www.themealdb.com') {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  // Cache-First for everything else (static assets, images)
  event.respondWith(cacheFirstWithNetwork(request));
});

/** Network-First: try network, fall back to cache */
async function networkFirstWithCache(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response(JSON.stringify({ meals: null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/** Cache-First: serve from cache, update in background */
async function cacheFirstWithNetwork(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // Return offline fallback for navigation requests
    if (request.mode === 'navigate') {
      const cache = await caches.open(CACHE_NAME);
      return cache.match('/cocinafacil/index.html');
    }
    return new Response('Sin conexiÃ³n', { status: 503 });
  }
}
