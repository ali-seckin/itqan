// Itqān · Service Worker: App-Gerüst offline, Seitenschriften bei Bedarf
const SCHALE = 'itqan-schale-v170';
const SEITEN = 'itqan-seiten-v1';
const DATEIEN = ['./', 'index.html', 'manifest.webmanifest', 'css/itqan.css', 'css/schriften.css', 'js/start.js', 'js/huelle.js', 'js/nativ.js', 'js/rangfeier.js', 'js/abzeichen.js', 'js/lernmodell.js', 'js/forschung.js', 'js/fehler.js', 'js/sprache.js', 'js/sprache/de.js', 'js/sprache/ar.js', 'js/sprache/en.js', 'js/sprache/es.js', 'js/sprache/fr.js', 'js/sprache/tr.js', 'js/sprache/ur.js', 'js/app.js', 'js/uebersetzung.js', 'js/daten.js', 'js/zustand.js', 'js/abfragen.js', 'js/auswahl.js', 'js/lichtkarte.js', 'js/sperre.js', 'js/mushaf.js', 'js/blaettern.js', 'js/ziffern.js', 'js/abgleich.js', 'js/konto.js', 'js/server.js', 'js/ornamente.js', 'js/fuehrung.js', 'js/version.js', 'js/suche.js', 'js/aehnlich.js', 'js/rueckblick.js', 'js/hilfe.js', 'js/amstueck.js', 'js/evidenz.js', 'daten/text.json', 'daten/mutashabihat.json', 'daten/aehnlich.json',
  'daten/layout_v1.json', 'daten/layout_v2.json', 'daten/verse.json', 'daten/abschnitte.json', 'daten/abschnitte_anf.json', 'daten/abschnitte_seite_v1.json', 'daten/abschnitte_seite_v2.json',
  'daten/gliederungen/fort-1.json', 'daten/gliederungen/fort-2.json', 'daten/gliederungen/anf-1.json', 'daten/gliederungen/seite-v1.json', 'daten/gliederungen/seite-v2.json', 'daten/suren.json', 'schriften/uthmanic_hafs.woff2',
  // Titel der Abschnitte und der ähnlichen Stellen in allen Sprachen: sonst stehen sie nach einem Update ohne Netz wieder auf Deutsch
  'daten/titel/de.json', 'daten/titel/ar.json', 'daten/titel/en.json', 'daten/titel/es.json', 'daten/titel/fr.json', 'daten/titel/tr.json', 'daten/titel/ur.json',
  'daten/titel/aehnlich_de.json', 'daten/titel/aehnlich_ar.json', 'daten/titel/aehnlich_en.json', 'daten/titel/aehnlich_es.json', 'daten/titel/aehnlich_fr.json', 'daten/titel/aehnlich_tr.json', 'daten/titel/aehnlich_ur.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png', 'icons/kalligraphie-gold.webp', 'icons/kalligraphie-tinte.webp'];
const ZEITLIMIT = 4000;   // so lange darf das Netz schweigen, bevor der Speicher antwortet
// Eine Antwort mit HTML-Typ ist nur für Seiten und .html-Dateien die Datei selbst. Sonst ist sie eine Ersatzseite (Hoster, Anmeldeseite eines WLAN)
// und gilt als Fehlschlag: Sie wird nie als Skript, JSON oder Schrift in einen Vorrat geschrieben.
const fremd = (pfad, r) => /text\/html/i.test(r.headers?.get?.('content-type') || '') && !/(\/|\.html?)$/i.test(pfad);
// einzeln laden und speichern: cache.addAll meldet in der Android-Hülle fälschlich doppelte Anfragen
const sammeln = (c, liste) => Promise.all(liste.map(async u => { const r = await fetch(u, { cache: 'no-cache' }); if (!r.ok || fremd(u, r)) throw new Error(u); await c.put(u, r); }));
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
// Der Vorrat der Schale ist immer eine geschlossene Fassung: Nur die Installation schreibt ihn, vollständig und unter eigenem Namen.
// Der fetch-Behandler ersetzt darin nie eine Datei (sonst lägen nach einem halben Update neue und alte Module nebeneinander),
// er füllt nur eine Lücke (Datei fehlt im Vorrat). Abgelegt wird unter der Adresse ohne Suchteil.
async function ablegen(schluessel, r) {
  const c = await caches.open(SCHALE);
  if (!(await c.match(schluessel))) await c.put(schluessel, r);
}
// Lage je Start, also je geladener Seite (Kennung des Clients):
//   'vorrat'  Bei einer Datei dieses Starts hat das Netz geschwiegen oder versagt, sie kam aus dem Vorrat. Alle weiteren Dateien dieses Starts
//             kommen sofort aus dem Vorrat: kein zweites Warten (das Zeitlimit zählt je Start einmal) und keine Mischung mit Neuerem aus dem Netz.
//   'neu'     Dieser Start hat schon eine Datei bekommen, die neuer ist als die im Vorrat (Update). Dann antwortet der Vorrat nicht mehr wegen
//             bloßer Langsamkeit, das Netz darf zu Ende liefern. Versagt das Netz bei einer weiteren Datei ganz (Abbruch, 5xx, Ersatzseite),
//             wird nie eine alte Datei neben die neuen gelegt, sondern der Start verworfen: Lage 'zurueck' und Rückfall (siehe unten).
//   'zurueck' Dieser Start wird gerade verworfen: seine weiteren Anfragen scheitern, kein Modul läuft mehr aus gemischten Fassungen.
// Die erste Lage eines Starts gilt bis zum nächsten Seitenaufruf („Neu laden“ beginnt frisch).
// Rückfall: Danach beantwortet der Vorrat jeden Seitenaufruf ganz aus der installierten Fassung (Startseite und alle Module, 'vorrat'), und die
// Seite wird sofort neu geladen. So läuft entweder die vollständige neue oder die vollständige alte Fassung, nie eine Mischung. Die neue Fassung
// kommt, sobald ihre Installation gelingt (der Browser versucht sie bei jedem Seitenaufruf neu) oder nach Ablauf der Frist wieder aus dem Netz.
const RUECKFALL = 10 * 60 * 1000;
let rueckfall = -Infinity;
const lage = new Map();
function merken(id, wert) {
  if (!id || lage.has(id)) return;
  if (lage.size >= 40) lage.delete(lage.keys().next().value);
  lage.set(id, wert);
}
async function verwerfen(e, id) {
  if (!(await caches.match('index.html').catch(() => undefined))) return false;     // ohne ganzen Vorrat gibt es nichts, worauf man zurückfallen könnte
  rueckfall = Date.now(); lage.set(id, 'zurueck');
  e.waitUntil((async () => { const c = await self.clients.get(e.clientId); if (c) await c.navigate(c.url); })().catch(() => {}));
  return true;
}
const marke = r => (r?.headers?.get?.('etag') || '').replace(/^W\//, '');
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (/\/schriften\/v[12]\//.test(url.pathname) || /\/daten\/uebersetzung\//.test(url.pathname)) {      // Seitenschriften: einmal laden, dann aus dem Speicher
    e.respondWith(caches.open(SEITEN).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { if (r.status === 200 && !fremd(url.pathname, r)) c.put(e.request, r.clone()); return r; })));
    return;
  }
  // App-Gerüst: erst Netz (für Updates), sonst Speicher
  // immer beim Server nachfragen (ETag), damit nie alte und neue Programmdateien gemischt werden
  // Seitenaufrufe: eine Umleitung (Umzug an eine neue Adresse) nicht selbst abholen, sondern dem Browser überlassen, sonst zeigt er eine Fehlerseite
  const seite = e.request.mode === 'navigate', schluessel = url.origin + url.pathname, id = e.resultingClientId || e.clientId || '';
  const genau = () => caches.match(e.request, { ignoreSearch: true }).catch(() => undefined);
  const vorrat = async () => (await genau()) || (seite ? caches.match('index.html').catch(() => undefined) : undefined);
  e.respondWith((async () => {
    if (seite && Date.now() - rueckfall < RUECKFALL) { const a = await vorrat(); if (a) { merken(id, 'vorrat'); return a; } }
    if (lage.get(id) === 'zurueck') return Response.error();
    if (lage.get(id) === 'vorrat') { const a = await genau(); if (a) return a; }
    const abbruch = new AbortController();
    const netz = fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin', redirect: seite ? 'manual' : 'follow', signal: abbruch.signal }).then(r => r, () => null);
    // Schweigt das Netz zu lange und liegt die Datei im Vorrat, antwortet der Vorrat; liegt nichts vor, wird weiter gewartet
    let uhr, da = false, alt = null;
    const frist = new Promise(fertig => { uhr = setTimeout(async () => { if (lage.get(id) === 'neu') return; const a = await vorrat(); if (a && !da) { alt = a; abbruch.abort(); fertig(); } }, ZEITLIMIT); });
    const r = await Promise.race([netz.then(x => { da = true; return x; }), frist]);
    clearTimeout(uhr);
    if (alt) { merken(id, 'vorrat'); return alt; }
    if (r && r.type === 'opaqueredirect') return r;
    if (r && r.status === 200 && (seite || !fremd(url.pathname, r))) {
      const a = await genau();
      if (!a) { e.waitUntil(ablegen(schluessel, r.clone()).catch(() => {})); return r; }
      if (lage.get(id) === 'vorrat') return a;                       // inzwischen läuft dieser Start aus dem Vorrat: auch diese Datei
      if (marke(r) && marke(a) && marke(r) !== marke(a)) merken(id, 'neu');
      return r;
    }
    // Hat dieser Start schon Neues bekommen und versagt das Netz jetzt (Abbruch, 5xx, Ersatzseite statt Datei): nicht mit dem Alten mischen, sondern Rückfall
    if (!seite && lage.get(id) === 'neu' && (!r || r.status >= 500 || (r.status === 200 && fremd(url.pathname, r))) && await verwerfen(e, id)) return r || Response.error();
    // Netzfehler oder Störung des Servers (5xx): aus dem Vorrat; die Startseite ersetzt dabei nur Seitenaufrufe, nie Skripte, Daten oder Bilder.
    // Andere Fehlantworten (404, Ersatzseite statt Datei): die Datei aus dem Vorrat, wenn sie dort liegt, sonst geht die Antwort unverändert durch.
    const a = !r || r.status >= 500 ? await vorrat() : await genau();
    if (a) { merken(id, 'vorrat'); return a; }
    return r || Response.error();
  })());
});
