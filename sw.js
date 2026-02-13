self.addEventListener('install', (e) => {
  console.log('Service Worker Installed');
});

self.addEventListener('fetch', (e) => {
  // Yeh file abhi sirf basic installation ke liye hai
  e.respondWith(fetch(e.request));
});
