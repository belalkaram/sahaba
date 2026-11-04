const CACHE_NAME = 'sahaba-cache-v2';
const OFFLINE_URL = '/offline.html';

// Only static offline assets. API responses, proofs, reports and credentials are never cached:
// the fetch handler below only answers page navigations (Master §69).
const urlsToCache = [
  OFFLINE_URL,
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Don't fail install if caching offline resources fails.
      return cache.addAll(urlsToCache).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests for navigation (HTML)
  if (event.request.mode === 'navigate' && event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL).then((response) => {
          if (response) return response;
          // Return a basic fallback response if offline.html is missing
          return new Response(
            '<html><head><meta charset="utf-8"><title>سحابة — وضع عدم الاتصال</title></head><body style="text-align:center;font-family:sans-serif;padding-top:50px;background:#F8F8F6;color:#121A18;"><h2>أنت غير متصل بالإنترنت</h2><p>يرجى التحقق من اتصال الشبكة الخاص بك.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        });
      })
    );
    return;
  }
});
