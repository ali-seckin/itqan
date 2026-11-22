// Itqān · Fehlermeldung (js/fehler.js): Entprellung des Bandes, Inhalt der Meldung (keine Profildaten), Kürzung, Wiederholung bei Netzfehlern, Warteschlange.
// Gesendet wird nie von selbst: Ohne Aufruf von absenden() geht keine Anfrage hinaus.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

// Umgebung ohne Fenster: Speicher, Ereignisse, ein Fehler aus der Zeit vor dem Laden (wie ihn start.js sammelt)
const speicher = new Map();
globalThis.localStorage = { getItem: k => speicher.has(k) ? speicher.get(k) : null, setItem: (k, v) => speicher.set(k, String(v)), removeItem: k => speicher.delete(k), clear: () => speicher.clear() };
const hoerer = {};
globalThis.addEventListener = (t, f) => { (hoerer[t] ||= []).push(f); };
globalThis.itqanFehlerVor = [[new TypeError('vor dem Laden kaputt'), 'global']];
const aufrufe = [];
let antwort = () => ({ ok: true, status: 201, text: async () => '' });
// fetch mit Abbruch über signal, wie im Browser: ein Abbruch beendet auch eine Anfrage, die nie antwortet
globalThis.fetch = (url, opt) => new Promise((gut, schlecht) => {
  aufrufe.push({ url: String(url), opt });
  opt?.signal?.addEventListener('abort', () => schlecht(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  Promise.resolve(antwort()).then(a => a instanceof Error ? schlecht(a) : gut(a), schlecht);
});

const F = await import('../js/fehler.js');
const warte = ms => new Promise(r => setTimeout(r, ms));
const UMG = { browser: 'Safari 17', system: 'iOS 17', bildschirm: '390x844/390x664', sprache: 'de', umgebung: 'installiert' };
const http = (status, code, message = '') => () => ({ ok: status < 300, status, text: async () => JSON.stringify({ code, message }) });

beforeEach(() => {
  F.zuruecksetzen(); F.zeitenSetzen({ vorlauf: 5, pruefen: 5, pause: 0 });
  F.haken.zeigen = null; F.haken.ruhig = null; F.haken.unnoetig = () => false;
  speicher.clear(); aufrufe.length = 0; antwort = () => ({ ok: true, status: 201, text: async () => '' });
});

test('Fehler vor dem Laden werden nachgetragen, das Ereignis von start.js und app.js wird gehört', () => {
  // der Import weiter oben hat itqanFehlerVor abgeholt; der Speicher wurde danach geleert, das Ereignis soll wieder erfassen
  assert.equal(globalThis.itqanFehlerVor, null);
  assert.equal(hoerer['itqan-fehler'].length, 1);
  hoerer['itqan-fehler'][0]({ detail: { e: new RangeError('aus dem Ereignis'), wo: 'zusage' } });
  assert.match(F.letzte().fehlertext, /^RangeError: aus dem Ereignis/);
  assert.equal(F.letzte().wo, 'zusage');
});

test('Erfassen sendet nie von selbst (keine Anfrage ohne „Senden“)', async () => {
  const gezeigt = []; F.haken.zeigen = a => gezeigt.push(a); F.haken.ruhig = () => true;
  F.erfassen(new Error('kaputt'), 'global'); await warte(40);
  assert.equal(gezeigt.length, 1);
  assert.equal(aufrufe.length, 0);
  assert.equal(F.warteschlange().length, 0);
});

// ---------- Entprellung ----------
test('Derselbe Fehler lässt höchstens ein Band je Sitzung erscheinen, auch über verschiedene Stellen', async () => {
  const gezeigt = []; F.haken.zeigen = a => gezeigt.push(a); F.haken.ruhig = () => true;
  const e = new TypeError('x ist undefined');
  for (let i = 0; i < 6; i++) F.erfassen(e, i % 2 ? 'global' : 'sicher-a');
  await warte(40);
  assert.equal(gezeigt.length, 1);
  assert.equal(F.zustandBand().gesehen, 1);
});

test('Eine Serie verschiedener Fehler: Pause zwischen zwei Bändern, höchstens drei je Sitzung', async () => {
  const gezeigt = []; F.haken.zeigen = a => gezeigt.push(a); F.haken.ruhig = () => true;
  F.zeitenSetzen({ pause: 60000 });
  for (let i = 0; i < 5; i++) F.erfassen(new Error('anders ' + i), 'global');
  await warte(40);
  assert.equal(gezeigt.length, 1, 'innerhalb der Pause kein zweites Band');
  assert.equal(F.letzte().fehlertext, 'Error: anders 4', 'der letzte Fehler bleibt für „Letzten Fehler melden“ erhalten');
  F.zuruecksetzen(); F.zeitenSetzen({ pause: 0 }); gezeigt.length = 0;
  for (let i = 0; i < 8; i++) { F.erfassen(new Error('serie ' + i), 'global'); await warte(25); }
  assert.equal(gezeigt.length, 3, 'höchstens drei Bänder je Sitzung');
});

test('Nicht in einer Übung oder Aufnahme: das Band wartet auf den ruhigen Augenblick', async () => {
  const gezeigt = []; let ruhig = false; F.haken.zeigen = a => gezeigt.push(a); F.haken.ruhig = () => ruhig;
  F.erfassen(new Error('mitten in der Übung'), 'global'); await warte(40);
  assert.equal(gezeigt.length, 0);
  ruhig = true; await warte(30);
  assert.equal(gezeigt.length, 1);
});

test('Fehleransicht oder Notansicht (eigener Knopf zum Melden): kein zweites Band', async () => {
  const gezeigt = []; F.haken.zeigen = a => gezeigt.push(a); F.haken.ruhig = () => true; F.haken.unnoetig = () => true;
  F.erfassen(new Error('Ansicht kaputt'), 'heute'); await warte(40);
  assert.equal(gezeigt.length, 0);
  assert.ok(F.letzte(), 'der Fehler bleibt trotzdem für Profil und Dialog gemerkt');
});

test('Rauschen (kein Netz, Abbruch, Erweiterung, Layout) wird kein Band, „laden“ immer', async () => {
  const gezeigt = []; F.haken.zeigen = a => gezeigt.push(a); F.haken.ruhig = () => true;
  F.erfassen(new TypeError('Failed to fetch'), 'zusage');
  F.erfassen(new TypeError('Load failed'), 'zusage');
  F.erfassen(new Error('ResizeObserver loop limit exceeded'), 'global');
  F.erfassen(Object.assign(new Error('weg'), { name: 'AbortError' }), 'zusage');
  F.erfassen(Object.assign(new Error('Erweiterung'), { stack: 'Error: x\n    at f (chrome-extension://abc/inhalt.js:1:2)' }), 'global');
  await warte(40);
  assert.equal(gezeigt.length, 0);
  assert.equal(F.letzte(), null);
  F.erfassen(new TypeError('Failed to fetch dynamically imported module: https://app.itqan.at/js/app.js'), 'laden'); await warte(40);
  assert.equal(gezeigt.length, 1);
});

// ---------- Inhalt ----------
test('Die Meldung enthält genau die Felder der Tabelle und keine Profildaten', () => {
  // ein Profil mit Namen, E-Mail und Kommentaren liegt im Speicher: nichts davon darf in die Meldung
  localStorage.setItem('itqan-profil', JSON.stringify({ name: 'Zuleikha Hammerstein', email: 'zuleikha@example.org', notiz: 'geheim-1234' }));
  localStorage.setItem('itqan-konto', JSON.stringify({ email: 'zuleikha@example.org' }));
  const e = new TypeError('Cannot read properties of undefined (reading "id")');
  e.stack = `TypeError: Cannot read properties of undefined\n    at abschnittName (https://app.itqan.at/js/daten.js?v=2.01:120:9)\n    at heute (https://app.itqan.at/js/app.js:900:14)`;
  const akte = F.akteBauen(e, 'heute', { hash: '#ueben/12?suche=Zuleikha', tag: 20800 });
  const m = F.meldungBauen(akte, 'Ich habe auf Aufdecken getippt', { umg: UMG });
  assert.deepEqual(Object.keys(m), F.FELDER);
  assert.deepEqual(F.FELDER, ['nr', 'anfrage', 'tag', 'version', 'umgebung', 'browser', 'system', 'bildschirm', 'sprache', 'ansicht', 'quelle', 'fehlertext', 'stapel', 'kommentar']);
  const alles = JSON.stringify(m);
  for (const verboten of ['Zuleikha', 'Hammerstein', 'example.org', 'geheim-1234', 'https://', 'itqan.at']) assert.ok(!alles.includes(verboten), verboten);
  assert.equal(m.ansicht, 'ueben', 'nur der Name der Ansicht, ohne Parameter');
  assert.equal(m.tag, 20800); assert.equal(m.umgebung, 'installiert'); assert.equal(m.sprache, 'de');
  assert.match(m.stapel, /at abschnittName \(daten\.js:120:9\)/); assert.match(m.stapel, /at heute \(app\.js:900:14\)/);
  // Safari und Firefox schreiben „funktion@adresse“: das @ darf nicht als Mailadresse gelten
  const safari = ['heute@https://app.itqan.at/js/app.js:900:14', '@https://app.itqan.at/js/daten.js:5:1', '[native code]'].join('\n');
  assert.equal(F.stapelKuerzen(safari), ['heute app.js:900:14', 'daten.js:5:1'].join('\n'));
  assert.ok(!/\d{4}-\d\d-\d\d/.test(alles), 'kein Kalenderdatum');
  assert.match(m.nr, /^[0-9a-f-]{36}$/); assert.match(m.anfrage, /^[0-9a-f-]{36}$/);
  assert.equal(m.anfrage, F.meldungBauen(akte, '', { umg: UMG }).anfrage, 'die Gerätenummer bleibt gleich');
  assert.notEqual(m.nr, F.meldungBauen(akte, '', { umg: UMG }).nr, 'jede Meldung hat eine eigene Nummer');
});

test('Mailadressen, lange Kennungen, lange Zahlen und Datenausschnitte werden unkenntlich', () => {
  const e = new SyntaxError('Unexpected token \'Z\', "Zuleikha Hammerstein, 12345" is not valid JSON; schreib an ali@beispiel.at; Schlüssel abcdefghijklmnopqrstuvwxyz0123456789ABCD; Telefon +43 664 1234567');
  const a = F.akteBauen(e, 'konto', { tag: 1 });
  assert.ok(!/Hammerstein|ali@|abcdefghij|1234567/.test(a.fehlertext), a.fehlertext);
  assert.match(a.fehlertext, /is not valid JSON/);
  const m = F.meldungBauen(a, 'Meine Mail ist x@y.de und die Nummer 0664 123 45 67', { umg: UMG });
  assert.ok(!/x@y\.de|123 45 67/.test(m.kommentar), m.kommentar);
});

test('Kürzung: Fehlertext, Aufrufstapel und Kommentar bleiben unter den Grenzen des Servers', () => {
  const stapel = Array.from({ length: 40 }, (_, i) => `    at funktionMitLangemNamen${i} (https://app.itqan.at/js/sehr/langer/pfad/datei${i}.js?v=2.01&x=${'a'.repeat(80)}:${i}:7)`).join('\n');
  const e = Object.assign(new Error('wort '.repeat(500)), { stack: 'Error: x\n' + stapel });
  const a = F.akteBauen(e, 'w'.repeat(200), { tag: 20800, hash: '#' + 'h'.repeat(300) });
  const m = F.meldungBauen(a, 'k'.repeat(5000), { umg: UMG });
  assert.ok(m.fehlertext.length <= 300 && m.fehlertext.length > 100);
  assert.ok(m.stapel.length <= 1200); assert.ok(m.stapel.split('\n').length <= 8);
  assert.ok(m.kommentar.length <= 800);
  assert.ok(m.quelle.length <= 40); assert.ok(m.ansicht.length <= 40);
  assert.ok(m.fehlertext.length + m.stapel.length + m.kommentar.length <= 2800, 'Summe unter der Prüfregel des Servers');
  assert.ok(!/https?:|\?v=|aaaaaaaaaa/.test(m.stapel), m.stapel);
  assert.match(m.stapel.split('\n')[0], /^at funktionMitLangemNamen0 \(datei0\.js:0:7\)$/);
});

test('Browser, System und Ansicht aus dem User-Agent, ohne dessen Rest', () => {
  const sa = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
  assert.deepEqual(F.geraetInfo(sa), { browser: 'Safari 17', system: 'iOS 17' });
  assert.deepEqual(F.geraetInfo('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'), { browser: 'Chrome 120', system: 'Android 14' });
  assert.deepEqual(F.geraetInfo('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/119.0.0.0'), { browser: 'Edge 119', system: 'Windows' });
  assert.deepEqual(F.geraetInfo('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'), { browser: 'Firefox 121', system: 'macOS' });
  assert.deepEqual(F.geraetInfo('Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'), { browser: 'WebView', system: 'iOS 17' });
  assert.equal(F.ansichtName('#mushaf/2/3'), 'mushaf'); assert.equal(F.ansichtName('#suche?q=Ali'), 'suche'); assert.equal(F.ansichtName(''), 'heute'); assert.equal(F.ansichtName('#<script>'), 'heute');
  const u = F.umgebungLesen({ navigator: { userAgent: sa }, screen: { width: 390, height: 844 }, innerWidth: 390, innerHeight: 664, document: { documentElement: { lang: 'tr' } }, matchMedia: () => ({ matches: false }), Capacitor: { isNativePlatform: () => true } });
  assert.deepEqual(u, { browser: 'Safari 17', system: 'iOS 17', bildschirm: '390x844/390x664', sprache: 'tr', umgebung: 'store' });
});

// ---------- Übertragung, Wiederholung, Warteschlange ----------
const meldung = (extra = {}) => ({ ...F.meldungBauen(F.akteBauen(new Error('Fehler ' + Math.random()), 'heute', { tag: Math.floor(Date.now() / 864e5), hash: '#heute' }), 'k', { umg: UMG }), ...extra });

test('Senden: eine Anfrage an die Tabelle fehler, nur die Felder, Prefer return=minimal', async () => {
  const m = meldung();
  assert.equal(await F.absenden(m), 'ok');
  assert.equal(aufrufe.length, 1);
  assert.match(aufrufe[0].url, /\/rest\/v1\/fehler$/);
  assert.equal(aufrufe[0].opt.method, 'POST'); assert.equal(aufrufe[0].opt.headers.Prefer, 'return=minimal'); assert.ok(aufrufe[0].opt.headers.apikey);
  assert.deepEqual(Object.keys(JSON.parse(aufrufe[0].opt.body)), F.FELDER);
  assert.equal(F.warteschlange().length, 0);
});

test('Netzfehler: die Meldung bleibt in der Warteschlange und wird beim nächsten Versuch zugestellt (dieselbe Nummer)', async () => {
  const m = meldung();
  antwort = () => new TypeError('Failed to fetch');
  assert.equal(await F.absenden(m), 'spaeter');
  assert.equal(F.warteschlange().length, 1); assert.equal(F.warteschlange()[0].m.nr, m.nr);
  assert.equal(await F.absenden(m), 'spaeter'); assert.equal(F.warteschlange().length, 1, 'erneutes Tippen auf Senden legt keine zweite Zeile an');
  assert.equal(await F.nachsenden(), 0); assert.equal(F.warteschlange().length, 1);
  assert.equal(F.warteschlange()[0].versuche, 1);
  antwort = () => ({ ok: true, status: 201, text: async () => '' });
  aufrufe.length = 0;
  assert.equal(await F.nachsenden(), 1);
  assert.equal(F.warteschlange().length, 0);
  assert.equal(JSON.parse(aufrufe[0].opt.body).nr, m.nr);
});

test('Antworten des Servers: 409 (schon da) gilt als angekommen, 404 und Grenze bleiben in der Schlange, Prüfregel wird verworfen', async () => {
  const m = meldung();
  antwort = http(409, '23505', 'duplicate key value violates unique constraint'); assert.equal(await F.absenden(m), 'ok'); assert.equal(F.warteschlange().length, 0);
  antwort = http(404, 'PGRST205', 'Could not find the table'); assert.equal(await F.absenden(m), 'fehlt'); assert.equal(F.warteschlange().length, 1);
  antwort = http(400, 'P0001', 'fehler_grenze: zu viele Meldungen für diesen Tag'); assert.equal(await F.absenden(m), 'grenze'); assert.equal(F.warteschlange().length, 1);
  antwort = http(503, '', ''); assert.equal(await F.absenden(m), 'spaeter'); assert.equal(F.warteschlange().length, 1);
  antwort = http(401, '', ''); assert.equal(await F.absenden(m), 'spaeter'); assert.equal(F.warteschlange().length, 1);
  antwort = http(400, '23514', 'violates check constraint "fehler_summe"'); assert.equal(await F.absenden(m), 'abgelehnt'); assert.equal(F.warteschlange().length, 0, 'eine abgelehnte Meldung wird nicht wiederholt');
});

test('Die Warteschlange ist begrenzt (5), alte und oft gescheiterte Meldungen werden verworfen', async () => {
  antwort = () => new TypeError('offline');
  const ms = Array.from({ length: 7 }, () => meldung());
  for (const m of ms) await F.absenden(m);
  assert.equal(F.warteschlange().length, 5);
  assert.deepEqual(F.warteschlange().map(x => x.m.nr), ms.slice(2).map(m => m.nr), 'die neuesten bleiben');
  // zu alt: mehr als 30 Tage
  speicher.clear(); await F.absenden(meldung({ tag: Math.floor(Date.now() / 864e5) - 31 }));
  assert.equal(F.warteschlange().length, 1); await F.nachsenden(); assert.equal(F.warteschlange().length, 0);
  // zehn gescheiterte Versuche: dann ist Schluss
  const m = meldung(); await F.absenden(m);
  for (let i = 0; i < 10; i++) await F.nachsenden();
  assert.equal(F.warteschlange().length, 1); assert.equal(F.warteschlange()[0].versuche, 10);
  await F.nachsenden(); assert.equal(F.warteschlange().length, 0);
});

test('Nachsenden hält beim ersten Netzfehler an (nicht jede Meldung einzeln versuchen)', async () => {
  antwort = () => new TypeError('offline');
  for (let i = 0; i < 3; i++) await F.absenden(meldung());
  aufrufe.length = 0;
  await F.nachsenden();
  assert.equal(aufrufe.length, 1);
  assert.equal(F.warteschlange().length, 3);
});

test('Zeitüberschreitung des Servers gilt als später, nicht als Absturz', async () => {
  antwort = () => new Promise(() => {});   // antwortet nie
  const t0 = Date.now();
  assert.equal(await F.post(meldung(), 30), 'spaeter');
  assert.ok(Date.now() - t0 < 1000);
});

// ---------- Anschluss an Server und Worker ----------
test('Die Spalten der Tabelle in konzept/server/fehler.sql sind genau die FELDER', { skip: !existsSync(new URL('../../konzept/server/fehler.sql', import.meta.url)) && 'ohne konzept/server (nur im Gesamtprojekt)' }, () => {
  const sql = readFileSync(new URL('../../konzept/server/fehler.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const kopf = sql.match(/create table if not exists public\.fehler \(\n([\s\S]*?)\n\);/)[1];
  const spalten = kopf.split('\n').map(z => z.trim().match(/^([a-z_]+) (?:bigint|uuid|integer|text)\b/)?.[1]).filter(Boolean).filter(s => s !== 'id');
  assert.deepEqual(spalten, F.FELDER);
  assert.match(sql, /enable row level security/); assert.match(sql, /grant insert on public\.fehler to anon, authenticated/); assert.match(sql, /revoke all on public\.fehler from anon, authenticated/);
});

test('Der Worker legt js/fehler.js in den Vorrat, der Einstieg lädt keine Datei dieser Art statisch', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.ok(sw.includes("'js/fehler.js'"));
  const start = readFileSync(new URL('../js/start.js', import.meta.url), 'utf8');
  assert.ok(!/^\s*import\s/m.test(start), 'start.js bleibt ohne statische Importe');
  assert.match(start, /import\('\.\/fehler\.js'\)/);
});
