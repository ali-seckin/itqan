// Itqān · Tests zum Service Worker: sw.js läuft unverändert in einer abgeschirmten Umgebung mit Attrappen für caches und fetch.
// Geprüft wird das Verhalten bei Erfolg, Störung des Servers (5xx), Netzfehler, hängendem Netz und Seitenaufrufen (Audit 1.99: H10, P03, P07, P16, S16).
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
    this.headers = new Map(status === 200 ? [['etag', 'W/"' + String(body).length + '-' + String(body).slice(0, 60) + '"']] : []);
  }
  clone() { return Object.assign(new Antwort(this.body, this.status, this.typ, this.type), { headers: this.headers }); }
  async text() { return String(this.body); }
}
const typVon = p => p.endsWith('.js') ? 'application/javascript' : p.endsWith('.json') ? 'application/json' : p.endsWith('.css') ? 'text/css' : /\.html$|\/$/.test(p) ? 'text/html' : 'application/octet-stream';

// Eine frische Umgebung: Netz mit einstellbarem Verhalten, Speicher als Map je Cache
function umgebung() {
  const u = { netz: 'an', anfragen: [], abgebrochen: 0, schreiben: 0, lager: new Map(), hoerer: {}, stand: '' };
  const abs = x => new URL(typeof x === 'string' ? x : x.url, URSPRUNG + '/').href;
  const ohneSuche = x => { const y = new URL(x); y.search = ''; return y.href; };
  const datei = url => {
    let p = new URL(url).pathname; if (p === '/') p = '/index.html';
    if (!existsSync(join(APP, p))) return new Antwort('<html>404</html>', 404, 'text/html');
    return new Antwort(p.endsWith('.css') ? readFileSync(join(APP, p), 'utf8') : 'INHALT:' + p + u.stand, 200, typVon(p));
  };
  const holen = (x, opt = {}) => new Promise((gut, schlecht) => {
    const url = abs(x); u.anfragen.push(url);
    if (u.netz === 'aus') return schlecht(new TypeError('Failed to fetch'));
    if (u.netz === '503') return gut(new Antwort('<html>503</html>', 503, 'text/html'));
    if (u.netz === 'umleitung') return gut(new Antwort('', 0, '', 'opaqueredirect'));
    if (u.netz === 'haengt' || u.netz === 'langsam') {   // „haengt“ antwortet nie, „langsam“ erst nach dem Zeitlimit
      opt.signal?.addEventListener('abort', () => { u.abgebrochen++; schlecht(new DOMException('abgebrochen', 'AbortError')); });
      if (u.netz === 'langsam') setTimeout(() => gut(datei(url)), LIMIT / TEILER * 3);
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
  // Eine Anfrage durch den Worker schicken. Ergebnis: Antwort, 'vorbei' (nicht abgefangen) oder der Fehler
  u.frage = async (pfad, mode = 'cors', method = 'GET') => {
    let p; const offen = [];
    u.hoerer.fetch({ request: { url: pfad.startsWith('http') ? pfad : URSPRUNG + pfad, method, mode }, respondWith: x => { p = x; }, waitUntil: x => offen.push(x) });
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
  assert.equal((await u.frage('/js/app.js')).body, 'INHALT:/js/app.js neu');
  assert.equal(u.schale().get(URSPRUNG + '/js/app.js').body, 'INHALT:/js/app.js neu', 'die neue Fassung ersetzt die alte im Vorrat');
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
