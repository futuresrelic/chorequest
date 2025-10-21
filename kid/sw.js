// Fetch version from central system
let CACHE_VERSION = 'v1.0.0';
let CACHE_NAME = `chores-app-${CACHE_VERSION}`;

const urlsToCache = [
  '/kid/',
  '/kid/index.html',
  '/kid/kid.css',
  '/kid/manifest.json',
  '/assets/kid-icon-192.png',
  '/assets/kid-icon-512.png'
];

// Get current version from server
async function getCacheVersion() {
  try {
    const response = await fetch('/api/version.php');
    const data = await response.json();
    CACHE_VERSION = `v${data.version}`;
    CACHE_NAME = `chores-app-${CACHE_VERSION}`;
    return CACHE_VERSION;
  } catch (error) {
    console.error('Failed to fetch version:', error);
    return CACHE_VERSION;
  }
}

// Install - cache files
self.addEventListener('install', (event) => {
  event.waitUntil(
    getCacheVersion()
      .then(() => caches.open(CACHE_NAME))
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    getCacheVersion()
      .then(() => caches.keys())
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName.startsWith('chores-app-')) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch - Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // IMPORTANT: Only cache GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Don't cache chrome extensions or non-http requests
  if (!event.request.url.startsWith('http')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful responses
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        
        const responseToCache = response.clone();
        
        getCacheVersion().then(() => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        });
        
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request);
      })
  );
});

// Listen for message to skip waiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});