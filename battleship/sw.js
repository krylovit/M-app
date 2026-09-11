// Simple service worker for offline functionality
const CACHE_NAME = 'battleship-v1';
const urlsToCache = [
  '/mobile.html',
  '/index.html',
  '/css/styles.css',
  '/js/game.js',
  '/js/ai.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      }
    )
  );
});
