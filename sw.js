const CACHE_NAME = 'pension-net-leads-v1';
const ASSETS = [
    'pensionet-leads.html',
    'favicon.png',
    'js/config.js',
    'supabaseClient.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
