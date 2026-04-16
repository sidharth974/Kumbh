const CACHE_VERSION = 'yatri-v3';
const STATIC_CACHE = 'yatri-static-v3';
const API_CACHE = 'yatri-api-v3';
const IMG_CACHE = 'yatri-img-v3';

// Core shell — always cached for instant load
const SHELL = [
  '/',
  '/static/manifest.json',
  '/static/favicon.png',
  '/static/icon-192.png',
  '/static/icon-512.png',
  '/static/places_geo.json',
];

// External CDN assets to precache
const CDN_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/remixicon@4.1.0/fonts/remixicon.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then(cache =>
      cache.addAll(SHELL).catch(() => {})
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => ![STATIC_CACHE, API_CACHE, IMG_CACHE].includes(k))
            .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip non-GET requests (POST to API, etc.)
  if (e.request.method !== 'GET') return;

  // Strategy 1: Cache-first for static assets & CDN (fonts, icons, CSS, JS)
  if (url.pathname.startsWith('/static/') ||
      url.hostname.includes('fonts.') ||
      url.hostname.includes('cdn.') ||
      url.hostname.includes('unpkg.com') ||
      url.hostname.includes('basemaps.cartocdn.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(STATIC_CACHE).then(c => c.put(e.request, clone));
          }
          return resp;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Strategy 2: Cache-first for images (Unsplash, Wikimedia)
  if (url.hostname.includes('unsplash') ||
      url.hostname.includes('upload.wikimedia') ||
      url.hostname.includes('commons.wikimedia') ||
      e.request.destination === 'image') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(IMG_CACHE).then(c => c.put(e.request, clone));
          }
          return resp;
        }).catch(() => new Response('', { status: 404 }));
      })
    );
    return;
  }

  // Strategy 3: Network-first for API calls (with cache fallback for offline)
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(API_CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Strategy 4: Stale-while-revalidate for everything else (HTML pages)
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetching = fetch(e.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(STATIC_CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);
      return cached || fetching;
    })
  );
});
