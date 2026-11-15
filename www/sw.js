/* Solo per la versione web di Simple Score: rende l'app disponibile offline. Nell'app Android non viene usato.
   Quando aggiorni i file della versione web, aumenta il numero di versione qui sotto. */
const CACHE = 'simple-score-v5';
const FILES = [
  './', 'index.html', 'privacy.html', 'manifest.webmanifest',
  'js/i18n.js', 'js/native.js', 'js/app.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
  'fonts/barlow-latin-400-normal.woff2', 'fonts/barlow-latin-500-normal.woff2',
  'fonts/barlow-latin-600-normal.woff2', 'fonts/barlow-latin-700-normal.woff2',
  'fonts/big-shoulders-display-latin-600-normal.woff2', 'fonts/big-shoulders-display-latin-800-normal.woff2',
  'fonts/big-shoulders-display-latin-900-normal.woff2',
  'fonts/barlow-latin-ext-400-normal.woff2', 'fonts/barlow-latin-ext-500-normal.woff2',
  'fonts/barlow-latin-ext-600-normal.woff2', 'fonts/barlow-latin-ext-700-normal.woff2',
  'fonts/big-shoulders-display-latin-ext-600-normal.woff2', 'fonts/big-shoulders-display-latin-ext-800-normal.woff2',
  'fonts/big-shoulders-display-latin-ext-900-normal.woff2'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, {ignoreSearch: true}).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match('index.html')))
  );
});
