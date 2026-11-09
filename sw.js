// Itqān · Service Worker: App-Gerüst offline, Seitenschriften bei Bedarf
const SCHALE = 'itqan-schale-v35';
const SEITEN = 'itqan-seiten-v1';
const DATEIEN = ['./', 'index.html', 'manifest.webmanifest', 'css/itqan.css', 'css/schriften.css', 'js/app.js', 'js/daten.js', 'js/zustand.js', 'js/mushaf.js', 'js/ornamente.js',
  'daten/layout_v1.json', 'daten/layout_v2.json', 'daten/verse.json', 'daten/abschnitte.json', 'daten/abschnitte_anf.json', 'daten/suren.json', 'schriften/uthmanic_hafs.woff2',
  'icons/icon-192.png', 'icons/laterne.png', 'icons/laterne_hell.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'];
self.addEventListener('install', e => e.waitUntil((async () => {
  const c = await caches.open(SCHALE);
  await c.addAll(DATEIEN);
  const css = await (await fetch('css/schriften.css')).text();
  await c.addAll([...css.matchAll(/url\(\.\.\/(schriften\/latein\/[^)]+)\)/g)].map(m => m[1]));
  self.skipWaiting();
})()));
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (![SCHALE, SEITEN].includes(k)) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (/\/schriften\/v[12]\//.test(url.pathname)) {      // Seitenschriften: einmal laden, dann aus dem Speicher
    e.respondWith(caches.open(SEITEN).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; })));
    return;
  }
  // App-Gerüst: erst Netz (für Updates), sonst Speicher
  // immer beim Server nachfragen (ETag), damit nie alte und neue Programmdateien gemischt werden
  e.respondWith(fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then(r => { if (r.ok) { const k = r.clone(); caches.open(SCHALE).then(c => c.put(e.request, k)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
