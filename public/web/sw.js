const CACHE = 'bluegate-platform-v2.9.2';
const ASSETS = [
  './',
  './index.html',
  './css/store.css',
  './css/account.css',
  './css/dashboard.css',
  './css/ui-overhaul.css',
  './css/admin-v18.css',
  './css/admin-unified.css',
  './css/mobile-v281.css',
  './js/config.js',
  './js/api.js',
  './js/rates.js',
  './js/pricing.js',
  './js/account.js',
  './js/admin.js',
  './js/dashboard.js',
  './js/checkout.js',
  './js/mobile-v281.js',
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
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});

function isStatic(url){
  return /\.(?:css|js|png|jpe?g|gif|webp|svg|ico|woff2?|json)$/i.test(url.pathname) && !/\/api\.php$/i.test(url.pathname);
}

self.addEventListener('fetch', event => {
  const req=event.request;
  if(req.method !== 'GET') return;
  const url=new URL(req.url);
  if(url.origin !== self.location.origin) return;
  if(/\/api\.php$/i.test(url.pathname)) return;

  if(req.mode === 'navigate'){
    event.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }

  if(isStatic(url)){
    event.respondWith(caches.match(req,{ignoreSearch:true}).then(hit => {
      const fresh=fetch(req).then(res => {
        if(res.ok) caches.open(CACHE).then(cache => cache.put(req,res.clone()));
        return res;
      }).catch(() => hit);
      return hit || fresh;
    }));
    return;
  }

  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
