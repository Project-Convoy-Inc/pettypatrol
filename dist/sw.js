/**
 * Petty Patrol Service Worker
 * Provides offline caching and background sync capabilities
 * 
 * Supports: iOS 11.3+ Safari, Android Chrome 66+, and modern browsers
 */

const CACHE_NAME = 'petty-patrol-v1';
const RUNTIME_CACHE = 'petty-patrol-runtime-v1';

// Assets to cache on install (app shell)
// Note: CSS files are bundled by Vite, so we don't precache /index.css directly
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Icons
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

// External resources to cache
const EXTERNAL_CACHE_URLS = [
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;600;700&family=Inter:wght@400;600;800&display=swap',
];

// Install event - cache app shell
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        // Cache precache assets, but don't fail if some are missing
        return Promise.allSettled(
          PRECACHE_ASSETS.map(url => 
            cache.add(url).catch(err => {
              console.warn(`[SW] Failed to cache ${url}:`, err);
            })
          )
        );
      })
      .then(() => {
        console.log('[SW] App shell cached');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Handle different types of requests differently
  
  // 1. API requests - network first, no caching (for Gemini API, etc.)
  if (url.pathname.startsWith('/api/') || url.hostname.includes('generativelanguage.googleapis.com')) {
    event.respondWith(networkOnly(request));
    return;
  }
  
  // 2. Map tiles - cache first with network fallback (OpenStreetMap)
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE, 7 * 24 * 60 * 60)); // 7 days
    return;
  }
  
  // 3. Google Fonts and CDN resources - cache first
  if (url.hostname.includes('fonts.googleapis.com') || 
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('cdn.tailwindcss.com') ||
      url.hostname.includes('esm.sh') ||
      url.hostname.includes('unpkg.com')) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE, 30 * 24 * 60 * 60)); // 30 days
    return;
  }
  
  // 4. App shell and static assets - stale while revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
    return;
  }
  
  // 5. Everything else - network first
  event.respondWith(networkFirst(request, RUNTIME_CACHE));
});

// Network only strategy (for API calls)
async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch (error) {
    console.warn('[SW] Network request failed:', request.url);
    // Return a generic error response for API calls
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Cache first strategy (for static assets that rarely change)
async function cacheFirst(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.warn('[SW] Cache first failed for:', request.url);
    return new Response('Offline', { status: 503 });
  }
}

// Network first strategy (with cache fallback)
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    console.warn('[SW] Network first failed for:', request.url);
    return new Response('Offline', { status: 503 });
  }
}

// Stale while revalidate strategy (serve cached, update in background)
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  // Fetch in background regardless
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch((error) => {
      console.warn('[SW] Background fetch failed:', request.url);
      return null;
    });
  
  // Return cached response immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Otherwise wait for network
  const networkResponse = await fetchPromise;
  
  if (networkResponse) {
    return networkResponse;
  }
  
  // Final fallback for navigation requests
  if (request.mode === 'navigate') {
    return cache.match('/');
  }
  
  return new Response('Offline', { status: 503 });
}

// Handle messages from the main app
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});

