/* No Man's Weather service worker — offline app shell */
const V = 'nmw-v7';
const SHELL = ['./', './index.html', './style.css', './app.js', './manifest.json', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  // Live weather/location APIs: always network (the app saves the last scan itself)
  if (/open-meteo\.com|weather\.gov|bigdatacloud\.net/.test(u.hostname)) return;
  // Pixel fonts: cache-first so they work offline
  if (/fonts\.(googleapis|gstatic)\.com/.test(u.hostname)) {
    e.respondWith(caches.open(V).then(async c => { const hit = await c.match(e.request); if (hit) return hit; try { const r = await fetch(e.request); c.put(e.request, r.clone()); return r; } catch (err) { return Response.error(); } }));
    return;
  }
  // App files: serve cache instantly, update in background
  if (u.origin === location.origin) {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => {
      const net = fetch(e.request).then(r => { if (r.ok) { const cl = r.clone(); caches.open(V).then(c => c.put(e.request, cl)); } return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});
