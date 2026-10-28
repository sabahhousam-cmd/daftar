/* Offline shell for دفتر الديون. Firebase data traffic is never touched here; Firestore keeps its own offline copy. */
const VERSION = 'daftar-v14';
const RUNTIME = 'daftar-runtime-v1';
const SHELL = ['./', './index.html', './app.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-256.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/wordmark.png'];
// The app cannot start without these, so they are saved on the first visit, not the second.
const FIREBASE = ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map(f => `https://www.gstatic.com/firebasejs/12.19.0/${f}`);

self.addEventListener('install', event => {
  event.waitUntil(Promise.all([
    caches.open(VERSION).then(c => c.addAll(SHELL)),
    caches.open(RUNTIME).then(c => Promise.all(FIREBASE.map(u => c.match(u).then(hit => hit || c.add(new Request(u, {mode: 'cors'})).catch(() => {})))))
  ]).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== RUNTIME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    // app files: network first so updates arrive, the saved copy when offline
    event.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, {ignoreSearch: true}).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
    return;
  }
  const pinned = (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) ||
    url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' || url.hostname === 'cdnjs.cloudflare.com';
  if (pinned) {
    // pinned library versions and fonts never change: saved copy first
    event.respondWith(caches.open(RUNTIME).then(c => c.match(req, {ignoreVary: true}).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }))));
  }
});
