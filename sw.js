// Network first, cache fallback: always fresh when online, still works offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open('colorbook').then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request)));
});
