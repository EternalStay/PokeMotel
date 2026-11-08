// =============================================================================
// Service worker : met en cache l'application (et les polices) pour qu'elle
// s'ouvre hors-ligne. Pensez à incrémenter VERSION à chaque mise à jour.
// =============================================================================
const VERSION = 'pokemotel-v0.12.0';

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './confidentialite.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './src/client/main.js',
  './src/client/storage.js',
  './src/client/art.js',
  './src/client/icons.js',
  './src/client/insight.js',
  './src/client/camera.js',
  './src/client/decor.js',
  './src/client/furniture.js',
  './src/client/sprites.js',
  './src/client/sound.js',
  './src/client/online.js',
  './src/engine/index.js',
  './src/engine/data.js',
  './src/engine/rng.js',
  './src/engine/time.js',
  './src/engine/model.js',
  './src/engine/satisfaction.js',
  './src/engine/sim.js',
  './src/engine/actions.js',
  './src/engine/progression.js',
  './src/engine/deco.js',
  './src/engine/meta.js',
  './src/engine/achievements.js',
  './src/engine/api.js',
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Polices Google : cache d'abord (elles ne changent jamais).
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((cache) => cache.put(req, copy));
      return res;
    })));
    return;
  }
  if (url.origin !== location.origin) return;

  // Application : réseau d'abord (mises à jour), cache en secours hors-ligne.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))),
  );
});
