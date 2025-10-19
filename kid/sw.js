const CACHE_NAME = 'family-chores-kid-v3.0';
const urlsToCache = [
  '/kid/index.html',
  '/kid/kid.css',
  '/kid/kid.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});