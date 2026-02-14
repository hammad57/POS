const cacheName = 'mart-v4-final';
const assets = [
  './',
  './index.html',
  './manager.html',
  './order.html',
  './manifest.json',
  'https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js',
  'https://unpkg.com/html5-qrcode',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js',
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(cacheName).then(cache => cache.addAll(assets)));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k !== cacheName && caches.delete(k)))));
  return self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(cacheName).then(cache => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
