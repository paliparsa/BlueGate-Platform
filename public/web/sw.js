const CACHE = 'bluegate-platform-v2.5.1';
const ASSETS = [
  './',
  './index.html',
  './css/store.css',
  './css/account.css',
  './css/dashboard.css',
  './css/ui-overhaul.css',
  './css/admin-v18.css',
  './js/config.js',
  './js/api.js',
  './js/rates.js',
  './js/pricing.js',
  './js/account.js',
  './js/admin.js',
  './js/dashboard.js',
  './js/checkout.js',
  './js/app.js',
  './assets/logo.png',
  './assets/logo-mark.png',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(hit => hit || caches.match('./index.html')))
  );
});
