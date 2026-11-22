// Itqān · Tests zum Service Worker: sw.js läuft unverändert in einer abgeschirmten Umgebung mit Attrappen für caches und fetch.
// Geprüft wird das Verhalten bei Erfolg, Störung des Servers (5xx), Netzfehler, hängendem Netz und Seitenaufrufen (Audit 1.99: H10, P03, P07, P16, S16).
// Nach-Audit 2.00 (Plattform N3 bis N6): der Vorrat bleibt eine geschlossene Fassung, das Zeitlimit zählt je Start einmal, 404 mit Vorrat, HTML statt Datei.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const QUELLE = readFileSync(join(APP, 'sw.js'), 'utf8');
const URSPRUNG = 'https://app.itqan.at';
const TEILER = 100;   // die Uhr des Workers läuft im Test hundertmal schneller
const LIMIT = +QUELLE.match(/const ZEITLIMIT = (\d+)/)[1];
const warte = ms => new Promise(r => setTimeout(r, ms));

class Antwort {
  constructor(body, status = 200, typ = 'text/plain', art = 'basic') {
    this.body = body; this.status = status; this.ok = status >= 200 && status < 300; this.typ = typ; this.type = art;
    this.headers = new Map([...(status === 200 ? [['etag', 'W/"' + String(body).length + '-' + String(body).slice(0, 60) + '"']] : []), ['content-type', typ]]);
  }
  clone() { return Object.assign(new Antwort(this.body, this.status, this.typ, this.type), { headers: this.headers }); }
  async text() { return String(this.body); }
}
const typVon = p => p.endsWith('.js') ? 'application/javascript' : p.endsWith('.json') ? 'application/json' : p.endsWith('.css') ? 'text/css' : /\.html$|\/$/.test(p) ? 'text/html' : 'application/octet-stream';

// Eine frische Umgebung: Netz mit einstellbarem Verhalten, Speicher als Map je Cache
function umgebung() {
  // je: Verhalten einzelner Pfade, geht vor netz: 'haengt' | 'aus' | '503' | '404' | 'html' (Status 200 mit einer HTML-Seite) | { verzug: ms } (antwortet verspätet)
  const u = { netz: 'an', anfragen: [], abgebrochen: 0, schreiben: 0, lager: new Map(), hoerer: {}, stand: '', je: {} };
  const abs = x => new URL(typeof x === 'string' ? x : x.url, URSPRUNG + '/').href;
  const ohneSuche = x => { const y = new URL(x); y.search = ''; return y.href; };
  const datei = url => {
    let p = new URL(url).pathname; if (p === '/') p = '/index.html';
    if (!existsSync(join(APP, p))) return new Antwort('<html>404</html>', 404, 'text/html');
    return new Antwort(p.endsWith('.css') ? readFileSync(join(APP, p), 'utf8') : 'INHALT:' + p + u.stand, 200, typVon(p));
  };
  const holen = (x, opt = {}) => new Promise((gut, schlecht) => {
    const url = abs(x); u.anfragen.push(url);
    const eigen = u.je[new URL(url).pathname], art = typeof eigen === 'string' ? eigen : u.netz;
    if (eigen?.verzug) { setTimeout(() => gut(datei(url)), eigen.verzug / TEILER); return; }
    if (art === 'aus') return schlecht(new TypeError('Failed to fetch'));
    if (art === '503') return gut(new Antwort('<html>503</html>', 503, 'text/html'));
    if (art === '404') return gut(new Antwort('<html>404</html>', 404, 'text/html'));
    if (art === 'html') return gut(new Antwort('<html>Bitte anmelden</html>', 200, 'text/html; charset=utf-8'));
    if (art === 'umleitung') return gut(new Antwort('', 0, '', 'opaqueredirect'));
    if (art === 'haengt' || art === 'langsam') {   // „haengt“ antwortet nie, „langsam“ erst nach dem Zeitlimit
      opt.signal?.addEventListener('abort', () => { u.abgebrochen++; schlecht(new DOMException('abgebrochen', 'AbortError')); });
      if (art === 'langsam') setTimeout(() => gut(datei(url)), LIMIT / TEILER * 3);
      return;
    }
    gut(datei(url));
  });
  const cacheObj = name => {
    if (!u.lager.has(name)) u.lager.set(name, new Map());
    const m = u.lager.get(name);
    return {
      put: async (req, r) => { u.schreiben++; m.set(abs(req), r); },
      match: async (req, opt) => { const a = abs(req); if (m.has(a)) return m.get(a).clone(); if (opt?.ignoreSearch) for (const [k, v] of m) if (ohneSuche(k) === ohneSuche(a)) return v.clone(); return undefined; }
    };
  };
  const caches = {
    open: async n => cacheObj(n), keys: async () => [...u.lager.keys()], delete: async n => u.lager.delete(n),
    match: async (req, opt) => { for (const n of u.lager.keys()) { const r = await cacheObj(n).match(req, opt); if (r) return r; } return undefined; }
  };
  const self = { addEventListener: (t, f) => { u.hoerer[t] = f; }, skipWaiting: () => {}, clients: { claim: async () => {} } };
  const kontext = { self, caches, fetch: holen, location: new URL(URSPRUNG + '/sw.js'), URL, Promise, Set, console, Error, AbortController,
    Response: { error: () => new Antwort(null, 0, '', 'error') }, setTimeout: (f, ms) => setTimeout(f, ms / TEILER), clearTimeout };
  // Worker einrichten (install + activate), wahlweise mit anderem Namen der Schale
  u.einrichten = async (code = QUELLE) => {
    vm.runInNewContext(code, { ...kontext });
    let p; await u.hoerer.install({ waitUntil: x => { p = x; } }); await p; await u.hoerer.activate({ waitUntil: x => { p = x; } }); await p;
  };
  // Eine Anfrage durch den Worker schicken. Ergebnis: Antwort, 'vorbei' (nicht abgefangen) oder der Fehler.
  // seite: Kennung der geladenen Seite (Client). Ein Seitenaufruf trägt sie als resultingClientId, alles Weitere als clientId; ohne Angabe ist jede Anfrage ein eigener Start.
  let laufend = 0;
  u.frage = async (pfad, mode = 'cors', method = 'GET', seite = 'einzel-' + (++laufend)) => {
    let p; const offen = [];
    u.hoerer.fetch({ request: { url: pfad.startsWith('http') ? pfad : URSPRUNG + pfad, method, mode }, clientId: mode === 'navigate' ? '' : seite, resultingClientId: mode === 'navigate' ? seite : '', respondWith: x => { p = x; }, waitUntil: x => offen.push(x) });
    if (!p) return 'vorbei';
    const r = await p; await Promise.all(offen);
    return r;
  };
  u.schale = () => u.lager.get([...u.lager.keys()].find(k => k.startsWith('itqan-schale-')));
  return u;
}
const schaleName = QUELLE.match(/itqan-schale-v\d+/)[0];

test('Einrichten: der ganze Vorrat liegt im Speicher, keine Schrift wird doppelt geholt', async () => {
  const u = umgebung(); await u.einrichten();
  assert.deepEqual([...u.lager.keys()], [schaleName]);
  assert.equal(new Set(u.anfragen).size + 1, u.anfragen.length, 'nur css/schriften.css wird ein zweites Mal gelesen');
  for (const s of ['ar', 'de', 'en', 'es', 'fr', 'tr', 'ur']) assert.ok(u.schale().has(`${URSPRUNG}/js/sprache/${s}.js`), `Sprache ${s} fehlt im Vorrat`);
  assert.ok(u.schale().has(URSPRUNG + '/schriften/latein/Alegreya-500-latin.woff2'));
});

test('Netz in Ordnung: Antwort aus dem Netz, im Vorrat nur ein Eintrag je Datei, gleich mit welchem Suchteil', async () => {
  const u = umgebung(); await u.einrichten();
  const vorher = u.schale().size;
  u.stand = ' neu';
  const r = await u.frage('/css/itqan.css?v=140');
  assert.equal(r.status, 200);
  await u.frage('/css/itqan.css?v=141'); await u.frage('/?sprache=en', 'navigate'); await u.frage('/index.html?umzug');
  assert.equal(u.schale().size, vorher, 'Suchteile legen keine weiteren Einträge an');
  assert.equal((await u.frage('/js/app.js')).body, 'INHALT:/js/app.js neu', 'mit Netz kommt die neue Fassung an');
  assert.equal(u.schale().get(URSPRUNG + '/js/app.js').body, 'INHALT:/js/app.js', 'der Vorrat bleibt die installierte Fassung: einzelne Dateien werden nie ersetzt');
});

test('Unveränderte Datei (gleiches ETag) wird nicht erneut in den Vorrat geschrieben', async () => {
  const u = umgebung(); await u.einrichten();
  u.schreiben = 0;
  for (const p of ['/js/app.js', '/daten/verse.json', '/', '/css/itqan.css?v=139']) assert.equal((await u.frage(p, p === '/' ? 'navigate' : 'cors')).status, 200);
  assert.equal(u.schreiben, 0);
});

test('Störung des Servers (503) bei gefülltem Vorrat: die gespeicherte Datei kommt, nicht die Fehlerseite', async () => {
  const u = umgebung(); await u.einrichten();
  u.netz = '503';
  for (const [p, mode] of [['/', 'navigate'], ['/js/app.js', 'cors'], ['/daten/verse.json', 'cors'], ['/css/itqan.css?v=139', 'no-cors']]) {
    const r = await u.frage(p, mode);
    assert.equal(r.status, 200, p); assert.notEqual(r.body, '<html>503</html>', p);
  }
  assert.equal((await u.frage('/js/app.js')).typ, 'application/javascript');
});

test('Störung des Servers (503) ohne Eintrag im Vorrat: die Fehlerantwort wird durchgereicht, nie die Startseite', async () => {
  const u = umgebung(); await u.einrichten();
  u.netz = '503';
  const r = await u.frage('/js/gibtsnicht.js');
  assert.equal(r.status, 503);
  const vorher = u.schale().size; await u.frage('/daten/nichtda.json');
  assert.equal(u.schale().size, vorher, 'Fehlerantworten landen nicht im Vorrat');
});

test('Netzfehler: Dateien aus dem Vorrat; was fehlt, endet als echter Fehler und nicht als index.html', async () => {
  const u = umgebung(); await u.einrichten();
  u.netz = 'aus';
  assert.equal((await u.frage('/js/app.js')).body, 'INHALT:/js/app.js');
  assert.equal((await u.frage('/js/sprache/en.js')).typ, 'application/javascript');
  assert.equal((await u.frage('/daten/titel/ur.json')).typ, 'application/json');
  assert.equal((await u.frage('/daten/titel/aehnlich_ar.json')).typ, 'application/json');
  for (const p of ['/js/gibtsnicht.js', '/daten/nichtda.json', '/icons/nichtda.png']) {
    const r = await u.frage(p);
    assert.equal(r.type, 'error', p + ' darf nicht mit der Startseite beantwortet werden');
  }
});

test('Seitenaufruf ohne Netz: immer die Startseite, auch mit Suchteil und für unbekannte Pfade', async () => {
  const u = umgebung(); await u.einrichten();
  u.netz = 'aus';
  for (const p of ['/', '/?sprache=en', '/index.html', '/irgendwas']) {
    const r = await u.frage(p, 'navigate');
    assert.equal(r.status, 200, p); assert.equal(r.typ, 'text/html', p); assert.equal(r.body, 'INHALT:/index.html', p);
  }
});

test('Netz hängt: nach dem Zeitlimit antwortet der Vorrat, die hängende Anfrage wird abgebrochen', async () => {
  const u = umgebung(); await u.einrichten();
  u.netz = 'haengt';
  const t = Date.now();
  const r = await u.frage('/js/app.js');
  assert.equal(r.body, 'INHALT:/js/app.js');
  assert.ok(Date.now() - t < LIMIT / TEILER * 10, 'Antwort kurz nach dem Zeitlimit');
  assert.equal(u.abgebrochen, 1);
  assert.equal((await u.frage('/', 'navigate')).body, 'INHALT:/index.html');
});

test('Netz langsam und nichts im Vorrat: es wird weiter gewartet und die Antwort des Netzes geliefert', async () => {
  const u = umgebung(); await u.einrichten();
  u.schale().delete(URSPRUNG + '/daten/text.json');
  u.netz = 'langsam';
  const r = await u.frage('/daten/text.json');
  assert.equal(r.status, 200); assert.equal(r.body, 'INHALT:/daten/text.json');
  assert.equal(u.abgebrochen, 0, 'ohne Ersatz im Vorrat wird die Anfrage nicht abgebrochen');
  assert.ok(u.schale().has(URSPRUNG + '/daten/text.json'), 'die späte Antwort füllt den Vorrat');
});

test('Netz antwortet knapp vor dem Vorrat: die Antwort des Netzes wird nicht nachträglich abgebrochen', async () => {
  const u = umgebung(); await u.einrichten();
  u.netz = 'an';
  const r = await u.frage('/js/app.js'); await warte(LIMIT / TEILER * 2);
  assert.equal(r.status, 200); assert.equal(u.abgebrochen, 0);
});

test('Nach einem Update ohne Netz: die gewählte Sprache und ihre Titel sind da (P07, B-10)', async () => {
  const u = umgebung();
  await u.einrichten(QUELLE.replace(schaleName, 'itqan-schale-v1'));
  await u.einrichten();
  assert.deepEqual([...u.lager.keys()], [schaleName], 'die alte Schale ist gelöscht');
  u.netz = 'aus';
  for (const p of ['/js/sprache/en.js', '/js/sprache/ar.js', '/js/sprache/ur.js', '/daten/titel/en.json', '/daten/titel/de.json', '/daten/titel/aehnlich_tr.json']) {
    const r = await u.frage(p);
    assert.equal(r.status, 200, p); assert.notEqual(r.typ, 'text/html', p);
  }
});

test('404 und Umleitungen gehen unverändert durch und werden nicht gespeichert', async () => {
  const u = umgebung(); await u.einrichten();
  const vorher = u.schale().size;
  assert.equal((await u.frage('/js/gibtsnicht.js')).status, 404);
  u.netz = 'umleitung';
  assert.equal((await u.frage('/', 'navigate')).type, 'opaqueredirect');
  assert.equal(u.schale().size, vorher);
});

test('Seitenschriften und Übersetzungen: einmal laden, dann aus dem eigenen Speicher; Fehler bleiben Fehler', async () => {
  const u = umgebung(); await u.einrichten();
  assert.equal((await u.frage('/schriften/v2/p5.woff2')).status, 200);
  assert.ok(u.lager.get('itqan-seiten-v1').has(URSPRUNG + '/schriften/v2/p5.woff2'));
  u.netz = 'aus';
  assert.equal((await u.frage('/schriften/v2/p5.woff2')).status, 200);
  await assert.rejects(u.frage('/schriften/v2/p6.woff2'));
});

test('Fremde Adressen und alles außer GET fasst der Worker nicht an', async () => {
  const u = umgebung(); await u.einrichten();
  assert.equal(await u.frage('https://cmhhkibcfzjdftitxxpy.supabase.co/rest/v1/profile'), 'vorbei');
  assert.equal(await u.frage('/js/app.js', 'cors', 'POST'), 'vorbei');
});

// ---------- Nach-Audit 2.00: Plattform N3 bis N6 ----------
const START = ['/js/start.js', '/js/huelle.js', '/js/sprache.js', '/js/sprache/de.js', '/js/app.js', '/js/zustand.js', '/js/abgleich.js', '/js/konto.js', '/daten/verse.json', '/daten/titel/de.json'];
const alleAlt = u => { for (const [k, v] of u.schale()) if (!k.includes('/css/') && !k.includes('/schriften/')) assert.ok(!String(v.body).endsWith(' neu'), 'neue Datei im alten Vorrat: ' + k); };
const offlineStart = async (u, seite) => { u.netz = 'aus'; u.je = {}; const r = [await u.frage('/', 'navigate', 'GET', seite)]; for (const p of START) r.push(await u.frage(p, 'cors', 'GET', seite)); return r; };

test('N3: Update, ein Modul hängt: der Vorrat bleibt die alte Fassung ohne ein einziges neues Modul, offline startet danach die alte Fassung geschlossen', async () => {
  const u = umgebung(); await u.einrichten();
  u.stand = ' neu'; u.je['/js/konto.js'] = 'haengt';                  // im Netz liegt eine neue Fassung, ein Modul antwortet nicht
  assert.equal((await u.frage('/', 'navigate', 'GET', 's1')).body, 'INHALT:/index.html neu');
  assert.equal((await u.frage('/js/abgleich.js', 'cors', 'GET', 's1')).body, 'INHALT:/js/abgleich.js neu');
  // dieser Start hat schon Neues bekommen: das hängende Modul wird nicht nach dem Zeitlimit durch das alte ersetzt (keine Mischung aus Langsamkeit)
  let fertig = false; const haengt = u.frage('/js/konto.js', 'cors', 'GET', 's1').then(r => { fertig = true; return r; });
  await warte(LIMIT / TEILER * 3);
  assert.equal(fertig, false, 'das alte konto.js darf nicht neben dem neuen abgleich.js ausgeliefert werden');
  alleAlt(u);
  assert.equal(u.schale().get(URSPRUNG + '/index.html').body, 'INHALT:/index.html');
  // danach ohne Netz: alles aus einer Fassung
  for (const r of await offlineStart(u, 's2')) { assert.equal(r.status, 200); assert.ok(!String(r.body).endsWith(' neu')); }
  void haengt;
});

test('N3: hängt beim Update zuerst ein Modul, läuft der ganze Start aus dem Vorrat: auch Dateien, die das Netz neu liefern würde oder gerade liefert', async () => {
  const u = umgebung(); await u.einrichten();
  u.stand = ' neu'; u.je['/js/konto.js'] = 'haengt'; u.je['/js/zustand.js'] = { verzug: LIMIT * 0.8 };
  const erste = u.frage('/js/konto.js', 'cors', 'GET', 's1');          // hängt
  await warte(LIMIT / TEILER * 0.5);
  const unterwegs = u.frage('/js/zustand.js', 'cors', 'GET', 's1');    // ist unterwegs, wenn das Zeitlimit der ersten abläuft, und käme danach neu an
  assert.equal((await erste).body, 'INHALT:/js/konto.js');
  assert.equal((await unterwegs).body, 'INHALT:/js/zustand.js', 'die verspätete neue Datei wird nicht mehr untergemischt');
  const n = u.anfragen.length;
  assert.equal((await u.frage('/js/abgleich.js', 'cors', 'GET', 's1')).body, 'INHALT:/js/abgleich.js');
  assert.equal(u.anfragen.length, n, 'ohne neue Anfrage ans Netz');
  alleAlt(u);
  // ein neuer Seitenaufruf beginnt frisch: mit gutem Netz kommt die neue Fassung geschlossen
  u.je = {};
  assert.equal((await u.frage('/', 'navigate', 'GET', 's2')).body, 'INHALT:/index.html neu');
  for (const p of START) assert.equal((await u.frage(p, 'cors', 'GET', 's2')).body, 'INHALT:' + p + ' neu');
  alleAlt(u);
});

test('N3: bricht das Netz mitten im Update ab (Netzfehler), kommt der Rest aus dem Vorrat und der Vorrat bleibt unverändert', async () => {
  const u = umgebung(); await u.einrichten();
  u.stand = ' neu';
  assert.equal((await u.frage('/', 'navigate', 'GET', 's1')).body, 'INHALT:/index.html neu');
  u.netz = 'aus';
  assert.equal((await u.frage('/js/app.js', 'cors', 'GET', 's1')).body, 'INHALT:/js/app.js');
  alleAlt(u);
  for (const r of await offlineStart(u, 's2')) assert.ok(r.status === 200 && !String(r.body).endsWith(' neu'));
});

test('N5: Netz hängt bei vollem Vorrat: das Zeitlimit läuft je Start einmal, alle weiteren Ladestufen kommen sofort aus dem Vorrat', async () => {
  const u = umgebung(); await u.einrichten();
  u.netz = 'haengt';
  let t = Date.now();
  assert.equal((await u.frage('/', 'navigate', 'GET', 's1')).body, 'INHALT:/index.html');
  assert.ok(Date.now() - t >= LIMIT / TEILER * 0.8, 'die erste Anfrage wartet das Zeitlimit ab');
  const n = u.anfragen.length; t = Date.now();
  for (const p of START) assert.equal((await u.frage(p, 'cors', 'GET', 's1')).body, 'INHALT:' + p);   // nacheinander, wie die Ladestufen der App
  assert.ok(Date.now() - t < LIMIT / TEILER * 0.8, `zehn weitere Dateien zusammen schneller als ein Zeitlimit (${Date.now() - t} ms)`);
  assert.equal(u.anfragen.length, n, 'keine weitere Anfrage ans hängende Netz');
  // was nicht im Vorrat liegt, wird weiter im Netz versucht (und endet dort)
  u.netz = 'aus';
  assert.equal((await u.frage('/js/gibtsnicht.js', 'cors', 'GET', 's1')).type, 'error');
  // der nächste Seitenaufruf (Neu laden) versucht das Netz wieder
  u.netz = 'an'; u.stand = ' neu';
  assert.equal((await u.frage('/', 'navigate', 'GET', 's1b')).body, 'INHALT:/index.html neu');
  assert.equal((await u.frage('/js/app.js', 'cors', 'GET', 's1b')).body, 'INHALT:/js/app.js neu');
});

test('N5: gleichzeitige Anfragen eines Starts bei hängendem Netz sind zusammen nach einem Zeitlimit beantwortet', async () => {
  const u = umgebung(); await u.einrichten();
  u.netz = 'haengt';
  const t = Date.now();
  const r = await Promise.all(START.map(p => u.frage(p, 'cors', 'GET', 's1')));
  r.forEach((x, i) => assert.equal(x.body, 'INHALT:' + START[i]));
  assert.ok(Date.now() - t < LIMIT / TEILER * 5);
});

test('N6: 404 für eine Datei, die im Vorrat liegt: der Vorrat antwortet; ohne Vorrat geht das 404 durch', async () => {
  const u = umgebung(); await u.einrichten();
  u.je['/js/zustand.js'] = '404'; u.je['/'] = '404';
  const r = await u.frage('/js/zustand.js', 'cors', 'GET', 's1');
  assert.equal(r.status, 200); assert.equal(r.body, 'INHALT:/js/zustand.js'); assert.equal(r.typ, 'application/javascript');
  assert.equal((await u.frage('/', 'navigate', 'GET', 's2')).body, 'INHALT:/index.html', 'auch die Startseite');
  assert.equal((await u.frage('/js/gibtsnicht.js', 'cors', 'GET', 's1')).status, 404);
  assert.equal((await u.frage('/irgendwas', 'navigate', 'GET', 's3')).status, 404, 'ein unbekannter Seitenpfad wird bei 404 nicht durch die Startseite ersetzt');
});

test('N6: Status 200 mit HTML statt der Datei: nie als Skript, JSON oder Schrift in den Vorrat, der Vorrat antwortet', async () => {
  const u = umgebung(); await u.einrichten();
  for (const p of ['/js/zustand.js', '/daten/verse.json', '/schriften/uthmanic_hafs.woff2', '/css/itqan.css']) {
    u.je[p] = 'html';
    const vorher = u.schale().get(URSPRUNG + p).body, r = await u.frage(p);
    assert.equal(r.body, vorher, p + ': die gespeicherte Datei kommt'); assert.ok(!/html/.test(r.typ), p);
    assert.equal(u.schale().get(URSPRUNG + p).body, vorher, p + ': der Eintrag im Vorrat bleibt');
  }
  // fehlt die Datei im Vorrat, wird die Ersatzseite durchgereicht, aber nicht gespeichert
  u.schale().delete(URSPRUNG + '/daten/text.json'); u.je['/daten/text.json'] = 'html';
  assert.match((await u.frage('/daten/text.json')).typ, /html/);
  assert.ok(!u.schale().has(URSPRUNG + '/daten/text.json'));
  // Seitenschriften und Übersetzungen (eigener Speicher): ebenso
  u.je['/schriften/v2/p7.woff2'] = 'html'; await u.frage('/schriften/v2/p7.woff2');
  assert.ok(!u.lager.get('itqan-seiten-v1')?.has(URSPRUNG + '/schriften/v2/p7.woff2'));
  // eine echte HTML-Seite bleibt erlaubt
  assert.equal((await u.frage('/index.html', 'navigate')).typ, 'text/html');
});

test('N6: die Installation scheitert, wenn statt einer Datei eine HTML-Seite kommt; der bisherige Vorrat bleibt', async () => {
  const u = umgebung();
  await u.einrichten(QUELLE.replace(schaleName, 'itqan-schale-v1'));
  u.je['/js/app.js'] = 'html';
  await assert.rejects(u.einrichten());
  assert.equal(u.lager.get('itqan-schale-v1').get(URSPRUNG + '/js/app.js').body, 'INHALT:/js/app.js', 'die alte Schale ist unberührt');
  assert.ok(!/html/.test(u.lager.get(schaleName)?.get(URSPRUNG + '/js/app.js')?.typ || ''));
});

test('Lücke im Vorrat: eine fehlende Datei wird nachgetragen, eine vorhandene nie überschrieben', async () => {
  const u = umgebung(); await u.einrichten();
  u.schale().delete(URSPRUNG + '/daten/text.json'); u.stand = ' neu';
  await u.frage('/daten/text.json'); await u.frage('/daten/verse.json');
  assert.equal(u.schale().get(URSPRUNG + '/daten/text.json').body, 'INHALT:/daten/text.json neu');
  assert.equal(u.schale().get(URSPRUNG + '/daten/verse.json').body, 'INHALT:/daten/verse.json');
});
