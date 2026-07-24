/* Service worker : app disponible hors ligne.
   Strategie : reseau d'abord pour tout (l'app se met a jour seule), cache en secours. */
const CACHE = 'todo-v1';
const ASSETS = [
  './', './index.html', './manifest.json',
  './css/styles.css',
  './js/nlp.js', './js/store.js', './js/sync.js', './js/app.js',
  './icon-180.png', './icon-192.png', './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  /* On ne touche jamais aux appels API (github) ni aux autres origines */
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return r;
      })
      .catch(() =>
        caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined))
      )
  );
});
