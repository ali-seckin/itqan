// Itqān · Service Worker: App-Gerüst offline, Seitenschriften bei Bedarf
const SCHALE = 'itqan-schale-v160';
const SEITEN = 'itqan-seiten-v1';
const DATEIEN = ['./', 'index.html', 'manifest.webmanifest', 'css/itqan.css', 'css/schriften.css', 'js/start.js', 'js/huelle.js', 'js/nativ.js', 'js/lernmodell.js', 'js/forschung.js', 'js/sprache.js', 'js/sprache/de.js', 'js/sprache/ar.js', 'js/sprache/en.js', 'js/sprache/es.js', 'js/sprache/fr.js', 'js/sprache/tr.js', 'js/sprache/ur.js', 'js/app.js', 'js/uebersetzung.js', 'js/daten.js', 'js/zustand.js', 'js/abfragen.js', 'js/auswahl.js', 'js/lichtkarte.js', 'js/sperre.js', 'js/mushaf.js', 'js/ziffern.js', 'js/abgleich.js', 'js/konto.js', 'js/server.js', 'js/ornamente.js', 'js/fuehrung.js', 'js/version.js', 'js/suche.js', 'js/aehnlich.js', 'js/rueckblick.js', 'js/hilfe.js', 'daten/text.json', 'daten/mutashabihat.json', 'daten/aehnlich.json',
  'daten/layout_v1.json', 'daten/layout_v2.json', 'daten/verse.json', 'daten/abschnitte.json', 'daten/abschnitte_anf.json', 'daten/abschnitte_seite_v1.json', 'daten/abschnitte_seite_v2.json',
  'daten/gliederungen/fort-1.json', 'daten/gliederungen/fort-2.json', 'daten/gliederungen/anf-1.json', 'daten/gliederungen/seite-v1.json', 'daten/gliederungen/seite-v2.json', 'daten/suren.json', 'schriften/uthmanic_hafs.woff2',
  // Titel der Abschnitte und der ähnlichen Stellen in allen Sprachen: sonst stehen sie nach einem Update ohne Netz wieder auf Deutsch
  'daten/titel/de.json', 'daten/titel/ar.json', 'daten/titel/en.json', 'daten/titel/es.json', 'daten/titel/fr.json', 'daten/titel/tr.json', 'daten/titel/ur.json',
  'daten/titel/aehnlich_de.json', 'daten/titel/aehnlich_ar.json', 'daten/titel/aehnlich_en.json', 'daten/titel/aehnlich_es.json', 'daten/titel/aehnlich_fr.json', 'daten/titel/aehnlich_tr.json', 'daten/titel/aehnlich_ur.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png', 'icons/kalligraphie-gold.webp', 'icons/kalligraphie-tinte.webp'];
const ZEITLIMIT = 4000;   // so lange darf das Netz schweigen, bevor der Speicher antwortet
// einzeln laden und speichern: cache.addAll meldet in der Android-Hülle fälschlich doppelte Anfragen
const sammeln = (c, liste) => Promise.all(liste.map(async u => { const r = await fetch(u, { cache: 'no-cache' }); if (!r.ok) throw new Error(u); await c.put(u, r); }));
self.addEventListener('install', e => e.waitUntil((async () => {
  const c = await caches.open(SCHALE);
  await sammeln(c, DATEIEN);
  const css = await (await fetch('css/schriften.css')).text();
  await sammeln(c, [...new Set([...css.matchAll(/url\(\.\.\/(schriften\/latein\/[^)]+)\)/g)].map(m => m[1]))]);
  self.skipWaiting();
})()));
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (![SCHALE, SEITEN].includes(k)) await caches.delete(k);
  await self.clients.claim();
})()));
// Antwort im Vorrat ablegen: unter der Adresse ohne Suchteil (sonst läge jede Variante ?v=, ?sprache= eigens im Speicher),
// nur vollständige Antworten (200) und nur, wenn sich die Datei gegenüber dem Vorrat geändert hat (ETag)
async function ablegen(schluessel, r) {
  const c = await caches.open(SCHALE), marke = r.headers?.get?.('etag');
  if (marke) { const alt = await c.match(schluessel); if (alt?.headers?.get?.('etag') === marke) return; }
  await c.put(schluessel, r);
}
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (/\/schriften\/v[12]\//.test(url.pathname) || /\/daten\/uebersetzung\//.test(url.pathname)) {      // Seitenschriften: einmal laden, dann aus dem Speicher
    e.respondWith(caches.open(SEITEN).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { if (r.status === 200) c.put(e.request, r.clone()); return r; })));
    return;
  }
  // App-Gerüst: erst Netz (für Updates), sonst Speicher
  // immer beim Server nachfragen (ETag), damit nie alte und neue Programmdateien gemischt werden
  // Seitenaufrufe: eine Umleitung (Umzug an eine neue Adresse) nicht selbst abholen, sondern dem Browser überlassen, sonst zeigt er eine Fehlerseite
  const seite = e.request.mode === 'navigate', schluessel = url.origin + url.pathname;
  const vorrat = async () => (await caches.match(e.request, { ignoreSearch: true })) || (seite ? caches.match('index.html') : undefined);
  e.respondWith((async () => {
    const abbruch = new AbortController();
    const netz = fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin', redirect: seite ? 'manual' : 'follow', signal: abbruch.signal }).then(r => r, () => null);
    // Schweigt das Netz zu lange und liegt die Datei im Vorrat, antwortet der Vorrat; liegt nichts vor, wird weiter gewartet
    let uhr, da = false, alt = null;
    const frist = new Promise(fertig => { uhr = setTimeout(async () => { const a = await vorrat().catch(() => null); if (a && !da) { alt = a; abbruch.abort(); fertig(); } }, ZEITLIMIT); });
    const r = await Promise.race([netz.then(x => { da = true; return x; }), frist]);
    clearTimeout(uhr);
    if (alt) return alt;
    if (r && r.status === 200) { e.waitUntil(ablegen(schluessel, r.clone()).catch(() => {})); return r; }
    // Netzfehler oder Störung des Servers (5xx): aus dem Vorrat. Die Startseite ersetzt nur Seitenaufrufe, nie Skripte, Daten oder Bilder
    if (!r || r.status >= 500) return (await vorrat().catch(() => null)) || r || Response.error();
    return r;
  })());
});
