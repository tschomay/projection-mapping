// Offline support: a show often happens where there's no reliable internet.
// The app shell is cached on install; fonts are cached the first time they load. Bump VERSION on release.
const VERSION = 'surface-mapper-v8';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './src/app.js', './src/renderer.js', './src/effects.js', './src/geometry.js', './src/editor.js', './src/audio.js', './src/media.js', './src/store.js', './src/link.js', './src/capture.js', './src/camera.js', './src/diagnostics.js', './src/show.js', './src/ai.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.url.startsWith('blob:')) return;
  const url = new URL(req.url);
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !isFont) return;
  // network first for the app itself (so updates arrive), cache as the fallback when offline
  e.respondWith(fetch(req).then((res) => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html'))));
});
