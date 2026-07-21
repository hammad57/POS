// Service worker required to trigger install prompt
self.addEventListener('install', function(event) {
    console.log('[Service Worker] Installed');
});

self.addEventListener('fetch', function(event) {
    // Basic fetch event is required to pass PWA criteria
});
