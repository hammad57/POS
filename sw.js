const cacheName = 'mart-v3-offline-fixed'; // Version update kiya
const assets = [
  './',
  './index.html',
  './manager.html',
  './order.html',
  './manifest.json',
  './sw.js',
  // Firebase Scripts (Version 8 for Index/Manager)
  'https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js',
  // Firebase Scripts (Version 9 for Order Page)
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js',
  // Libraries
  'https://unpkg.com/html5-qrcode',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js',
  'https://cdn.tailwindcss.com'
];

// Install Event - Cache all files
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(cacheName).then(cache => {
      console.log('Caching files...');
      return cache.addAll(assets);
    })
  );
});

// Activate Event - Clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(keyList.map(key => {
        if (key !== cacheName) return caches.delete(key);
      }));
    })
  );
  return self.clients.claim();
});

// Fetch Event - Network First, fallback to Cache (Best for dynamic data apps)
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Clone response to store in cache for next time
        const resClone = res.clone();
        caches.open(cacheName).then(cache => {
          cache.put(e.request, resClone);
        });
        return res;
      })
      .catch(() => caches.match(e.request)) // If offline, serve from cache
  );
});
