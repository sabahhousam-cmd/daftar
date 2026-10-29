/* Offline shell for دفتر الديون. Firebase data traffic is never touched here; Firestore keeps its own offline copy. */
const VERSION = 'daftar-v23';
const RUNTIME = 'daftar-runtime-v1';
const SHELL = ['./', './index.html', './app.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-256.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/wordmark.png', './icons/badge-96.png'];
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

/* Phone notifications, sent through Firebase Cloud Messaging by the owner's Google Apps Script. The message carries its
   text (t, b) and where tapping it leads (go: approvals | customer | customers, id). Every push shows a notification:
   phones require it. */
self.addEventListener('push', event => {
  let d = {};
  try { const j = event.data ? event.data.json() : {}; d = j.data || j.notification || j || {}; } catch (err) { d = {}; }
  const tag = d.tag ? String(d.tag) : '';
  event.waitUntil(self.registration.showNotification(String(d.t || d.title || 'دفتر الديون'), Object.assign({
    body: String(d.b || d.body || ''), icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', dir: 'rtl', lang: 'ar',
    data: {go: String(d.go || ''), id: String(d.id || '')}
  }, tag ? {tag, renotify: true} : null)));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(openFromPush(event.notification.data || {}));
});
// the app already open: bring it forward and let it go there; otherwise open it at #go=…
async function openFromPush(t){
  const scope = self.registration.scope;
  const wins = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
  const w = wins.find(c => c.url.startsWith(scope));
  if (w) { try { await w.focus(); } catch (err) {} w.postMessage({type: 'open', go: t.go || '', id: t.id || ''}); return; }
  await self.clients.openWindow(scope + (t.go ? `#go=${encodeURIComponent(t.go)}${t.id ? `&id=${encodeURIComponent(t.id)}` : ''}` : ''));
}
