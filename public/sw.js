const CACHE = 'electricity-monitor-offline-v1';
const OFFLINE = '/offline.html';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(OFFLINE)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('electricity-monitor-offline-') && key !== CACHE)
      .map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
// Only document navigations get an offline fallback. Never cache API responses,
// authenticated pages, OAuth redirects, or consumption data.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate' ||
      url.origin !== self.location.origin || url.pathname.startsWith('/api/') ||
      url.pathname === '/login') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});
