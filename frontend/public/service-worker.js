/* Jivdani Vegetable Suppliers — Service Worker v1 */
const CACHE_NAME = 'jivdani-v1';
const PRECACHE = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (evt) => {
  const url = new URL(evt.request.url);

  // API calls — network only, fallback error
  if (url.pathname.startsWith('/api')) {
    evt.respondWith(
      fetch(evt.request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline — check your connection' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }

  // HTML navigation — network first, fallback to cached index.html
  if (evt.request.mode === 'navigate') {
    evt.respondWith(
      fetch(evt.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(evt.request, clone));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets — stale-while-revalidate
  evt.respondWith(
    caches.match(evt.request).then(cached => {
      const fresh = fetch(evt.request).then(res => {
        if (res.ok) {
          caches.open(CACHE_NAME).then(c => c.put(evt.request, res.clone()));
        }
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
