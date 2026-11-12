// Itqān · Service Worker: App-Gerüst offline, Seitenschriften bei Bedarf
const SCHALE = 'itqan-schale-v89';
const SEITEN = 'itqan-seiten-v1';
const DATEIEN = ['./', 'index.html', 'manifest.webmanifest', 'css/itqan.css', 'css/schriften.css', 'js/start.js', 'js/huelle.js', 'js/sprache.js', 'js/sprache/de.js', 'js/app.js', 'js/daten.js', 'js/zustand.js', 'js/abfragen.js', 'js/auswahl.js', 'js/mushaf.js', 'js/ornamente.js', 'js/fuehrung.js', 'js/version.js', 'js/suche.js', 'js/aehnlich.js', 'js/rueckblick.js', 'js/hilfe.js', 'daten/text.json', 'daten/mutashabihat.json', 'daten/aehnlich.json',
  'daten/layout_v1.json', 'daten/layout_v2.json', 'daten/verse.json', 'daten/abschnitte.json', 'daten/abschnitte_anf.json', 'daten/abschnitte_seite_v1.json', 'daten/abschnitte_seite_v2.json',
  'daten/gliederungen/fort-1.json', 'daten/gliederungen/fort-2.json', 'daten/gliederungen/anf-1.json', 'daten/gliederungen/seite-v1.json', 'daten/gliederungen/seite-v2.json', 'daten/suren.json', 'schriften/uthmanic_hafs.woff2',
  'icons/icon-192.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'];
// einzeln laden und speichern: cache.addAll meldet in der Android-Hülle fälschlich doppelte Anfragen
const sammeln = (c, liste) => Promise.all(liste.map(async u => { const r = await fetch(u, { cache: 'no-cache' }); if (!r.ok) throw new Error(u); await c.put(u, r); }));
self.addEventListener('install', e => e.waitUntil((async () => {
  const c = await caches.open(SCHALE);
  await sammeln(c, DATEIEN);
  const css = await (await fetch('css/schriften.css')).text();
  await sammeln(c, [...css.matchAll(/url\(\.\.\/(schriften\/latein\/[^)]+)\)/g)].map(m => m[1]));
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
