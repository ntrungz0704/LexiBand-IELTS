const CACHE_NAME = 'lexiband-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

// Install event - precache basic assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - Stale-While-Revalidate strategy
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  
  // Skip cross-origin or non-HTTP protocols (e.g. chrome-extension://, firebase auth/db)
  if (!url.protocol.startsWith('http')) return;

  // Don't cache hot module reload, chrome extensions, firestore, or auth requests
  if (
    url.hostname.includes('firebase') || 
    url.hostname.includes('firestore') || 
    url.pathname.includes('/__/auth') ||
    url.pathname.includes('/api/') ||
    url.pathname.includes('@vite') ||
    url.pathname.includes('ws') ||
    url.search.includes('token')
  ) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchedResponse = fetch(event.request).then((networkResponse) => {
          // Cache the response if it is valid
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Silently ignore network failures (will use cached response)
        });

        // Return the cached response immediately if we have it, otherwise wait for network
        return cachedResponse || fetchedResponse;
      });
    })
  );
});
