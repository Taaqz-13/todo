/* Service worker : app disponible hors ligne.
   Strategie : reseau d'abord pour tout (l'app se met a jour seule), cache en secours.

   Point important : GitHub Pages renvoie Cache-Control max-age=600. Sans precaution,
   un rechargement juste apres un deploiement peut melanger d'anciens et de nouveaux
   fichiers (index.html a jour avec un js perime), ce qui casse l'app. On force donc
   la revalidation aupres du serveur ('no-cache' = compare l'ETag, 304 si inchange),
   pour toujours obtenir un jeu de fichiers coherent. */
const CACHE = 'todo-v2';
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

/* Revalidation forcee, avec repli si le navigateur refuse l'option sur cette requete. */
function fetchFrais(request) {
  try {
    return fetch(request, { cache: 'no-cache' });
  } catch (e) {
    return fetch(request);
  }
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  /* On ne touche jamais aux appels API (github) ni aux autres origines */
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  e.respondWith(
    fetchFrais(e.request)
      .then(r => {
        if (r && r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return r;
      })
      .catch(() =>
        caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined))
      )
  );
});
