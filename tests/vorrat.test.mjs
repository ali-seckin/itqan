// Itqān · Tests zum Offline-Vorrat: die Liste DATEIEN in sw.js gegen den Code (Audit 1.99: P07, P09, P11, B-10, S3).
// Fehlt eine Datei im Vorrat, läuft die App nach einem Update ohne Netz nicht mehr; steht eine Datei in der Liste, die es nicht gibt,
// scheitert die Einrichtung des Service Workers bei allen still. Beides fällt hier auf, bevor es veröffentlicht wird.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const lies = p => readFileSync(join(APP, p), 'utf8');
const gibt = p => existsSync(join(APP, p));
const ordner = p => readdirSync(join(APP, p)).filter(f => statSync(join(APP, p, f)).isFile()).map(f => `${p}/${f}`);
const ohneSuche = u => u.replace(/[?#].*$/, '');

const SW = lies('sw.js');
const DATEIEN = [...SW.match(/const DATEIEN = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const LATEIN = [...new Set([...lies('css/schriften.css').matchAll(/url\(\.\.\/(schriften\/latein\/[^)]+)\)/g)].map(m => m[1]))];   // holt der Worker beim Einrichten aus dem Stilblatt
const VORRAT = new Set([...DATEIEN, ...LATEIN]);
// Was bewusst nicht im Vorrat liegt: Seitenschriften und Übersetzungen kommen bei Bedarf in den eigenen Speicher itqan-seiten-v1
const BEI_BEDARF = p => /^schriften\/v[12]\//.test(p) || /^daten\/uebersetzung\//.test(p);

// Importgraph: statische Importe und dynamische mit fester Adresse
const MODULE = [...ordner('js'), ...ordner('js/sprache')];
const QUELLE = Object.fromEntries(MODULE.map(f => [f, lies(f)]));
const ziel = (von, pfad) => posix.normalize(posix.join(posix.dirname(von), pfad));
const statisch = f => [...QUELLE[f].matchAll(/^\s*(?:import|export)\s[^;'"]*?from\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gm)].map(m => ziel(f, m[1] || m[2]));
const dynamisch = f => [...QUELLE[f].matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => ziel(f, m[1]));
function erreichbar(start, kanten) {
  const da = new Set();
  const geh = f => { if (da.has(f)) return; da.add(f); assert.ok(QUELLE[f] !== undefined, `Import zeigt auf eine Datei, die es nicht gibt: ${f}`); kanten(f).forEach(geh); };
  start.forEach(geh);
  return da;
}
const GRAPH = erreichbar(['js/start.js'], f => [...statisch(f), ...dynamisch(f)]);

test('Vorrat: jede gelistete Datei gibt es, keine steht doppelt', () => {
  assert.deepEqual(DATEIEN.filter((x, i) => DATEIEN.indexOf(x) !== i), [], 'doppelte Einträge in DATEIEN');
  assert.deepEqual(DATEIEN.filter(f => f !== './' && !gibt(f)), [], 'in sw.js gelistet, aber nicht vorhanden (die Einrichtung des Workers würde scheitern)');
  assert.deepEqual(LATEIN.filter(f => !gibt(f)), [], 'Schrift aus css/schriften.css fehlt');
  assert.ok(DATEIEN.includes('./') && DATEIEN.includes('index.html'));
});

test('Vorrat: alle Module ab js/start.js sind gelistet', () => {
  assert.ok(GRAPH.has('js/app.js') && GRAPH.has('js/sprache.js') && GRAPH.has('js/huelle.js'), 'der Importgraph ab js/start.js erreicht die App nicht');
  assert.deepEqual([...GRAPH].filter(f => !VORRAT.has(f)), [], 'Modul wird geladen, steht aber nicht in DATEIEN (sw.js)');
});

test('Vorrat: alle Sprachdateien sind gelistet und passen zur Liste der Sprachen', () => {
  const dateien = ordner('js/sprache').filter(f => f.endsWith('.js'));
  assert.deepEqual(dateien.filter(f => !VORRAT.has(f)), [], 'Sprachdatei fehlt in DATEIEN: nach einem Update ohne Netz stünde die App auf Deutsch');
  assert.match(QUELLE['js/sprache.js'], /import\(`\.\/sprache\/\$\{code\}\.js`\)/, 'die Sprache wird nicht mehr über ./sprache/<code>.js geladen: diesen Test anpassen');
  const codes = [...QUELLE['js/sprache.js'].matchAll(/code: '([a-z]{2})'/g)].map(m => m[1]);
  assert.ok(codes.length >= 7, 'Liste SPRACHEN in js/sprache.js nicht gefunden');
  assert.deepEqual(codes.filter(c => !VORRAT.has(`js/sprache/${c}.js`)), [], 'Sprache ohne Datei im Vorrat');
});

test('Vorrat: alle Daten, die der Code über feste oder zusammengesetzte Adressen lädt, sind gelistet', () => {
  const fehlt = new Set();
  // feste Adressen in den Modulen
  for (const f of MODULE.filter(f => !f.startsWith('js/sprache/'))) {
    for (const m of QUELLE[f].matchAll(/['"`]((?:daten|schriften|icons|css|js)\/[^'"`$]+\.[a-z0-9]+)(?:\?[^'"`]*)?['"`]/g)) {
      const p = ohneSuche(m[1]);
      if (!BEI_BEDARF(p) && !VORRAT.has(p)) fehlt.add(`${p} (aus ${f})`);
    }
  }
  // zusammengesetzte Adressen: daten/titel/<code>.json, daten/titel/aehnlich_<code>.json, daten/gliederungen/<name>.json
  for (const p of [...ordner('daten/titel'), ...ordner('daten/gliederungen'), ...ordner('daten')]) if (!VORRAT.has(p)) fehlt.add(p);
  assert.deepEqual([...fehlt], [], 'Datei wird geladen, steht aber nicht in DATEIEN (sw.js)');
  // der Zweig für Seitenschriften und Übersetzungen besteht noch
  assert.ok(SW.includes('schriften\\/v[12]') && SW.includes('daten\\/uebersetzung'), 'sw.js behandelt Seitenschriften und Übersetzungen nicht mehr gesondert: BEI_BEDARF in diesem Test anpassen');
});

test('Vorrat: alles, was index.html, die Stilblätter und das Manifest einbinden, ist gelistet', () => {
  const index = lies('index.html'), fehlt = [];
  for (const m of index.matchAll(/(?:href|src)="([^"#:]+)"/g)) { const p = ohneSuche(m[1]); if (p !== './' && !VORRAT.has(p)) fehlt.push(`${p} (index.html)`); }
  for (const css of ['css/itqan.css', 'css/schriften.css']) {
    for (const m of lies(css).matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      if (/^data:/.test(m[1])) continue;
      const p = ohneSuche(ziel(css, m[1]));
      if (!gibt(p)) fehlt.push(`${p} (${css}, Datei fehlt)`); else if (!VORRAT.has(p)) fehlt.push(`${p} (${css})`);
    }
  }
  const manifest = JSON.parse(lies('manifest.webmanifest'));
  for (const i of manifest.icons) { const p = ohneSuche(i.src); if (!gibt(p)) fehlt.push(`${p} (Manifest, Datei fehlt)`); else if (!VORRAT.has(p)) fehlt.push(`${p} (Manifest)`); }
  assert.deepEqual(fehlt, []);
  // Manifest: Pflichtangaben für die Installation
  assert.ok(manifest.id, 'Manifest ohne id');
  for (const g of ['192x192', '512x512']) assert.ok(manifest.icons.some(i => i.sizes === g && !i.purpose), `Manifest ohne Icon ${g}`);
  assert.ok(manifest.icons.some(i => i.purpose === 'maskable'), 'Manifest ohne maskierbares Icon');
});

test('Vorrat bleibt klein genug für das Mobilfunknetz', () => {
  const summe = [...VORRAT].filter(f => f !== './').reduce((a, f) => a + statSync(join(APP, f)).size, 0);
  assert.ok(summe < 9 * 1024 * 1024, `Vorrat hat ${(summe / 1048576).toFixed(2)} MB roh, Obergrenze 9 MB: prüfen, was wirklich offline gebraucht wird`);
});

test('index.html: modulepreload nennt genau die statisch eingebundenen Module des Startpfads', () => {
  const vorab = [...lies('index.html').matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map(m => m[1]);
  // start.js lädt huelle.js, sprache.js und app.js nacheinander; alles, was diese statisch einbinden, kann der Browser gleichzeitig holen
  const soll = erreichbar(dynamisch('js/start.js'), statisch);
  assert.deepEqual(vorab.filter(f => !soll.has(f)), [], 'modulepreload für ein Modul, das der Start nicht braucht (oder das es nicht gibt)');
  assert.deepEqual([...soll].filter(f => !vorab.includes(f)), [], 'Modul des Startpfads ohne modulepreload in index.html');
});

test('js/start.js bleibt ohne statische Importe, die Vorlagen der Notansicht stehen in index.html', () => {
  assert.deepEqual(statisch('js/start.js'), [], 'ein statischer Import in start.js verhindert die Notansicht, wenn dieses Modul nicht lädt');
  const index = lies('index.html');
  for (const m of QUELLE['js/start.js'].matchAll(/notansicht\('([a-z]+)'/g)) assert.ok(index.includes(`<template id="not-${m[1]}">`), `Vorlage not-${m[1]} fehlt in index.html`);
  for (const m of QUELLE['js/start.js'].matchAll(/spaeterPruefen\([A-Z_]+, '([a-z]+)'\)/g)) assert.ok(index.includes(`<template id="not-${m[1]}">`), `Vorlage not-${m[1]} fehlt in index.html`);
  assert.ok(index.includes('class="lade-logo"'), 'start.js erkennt das Ladebild an .lade-logo');
  assert.ok(!/[–—]/.test(index), 'Gedankenstrich in index.html');
});

test('index.html: die Content Security Policy erlaubt genau den eigenen Ursprung und den Server aus js/server.js', () => {
  const csp = lies('index.html').match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1];
  assert.ok(csp, 'keine Content Security Policy in index.html');
  const regel = Object.fromEntries(csp.split(';').map(r => r.trim().split(/\s+/)).map(([n, ...w]) => [n, w]));
  const server = lies('js/server.js').match(/url: '(https:\/\/[^']+)'/)[1];
  assert.deepEqual(regel['default-src'], ["'self'"]);
  assert.deepEqual(regel['connect-src'].filter(w => /^https?:/.test(w)), [server], 'connect-src nennt nicht (nur) den Server aus js/server.js');
  assert.deepEqual(regel['object-src'], ["'none'"]);
  assert.deepEqual(regel['base-uri'], ["'self'"]);
  assert.deepEqual(regel['form-action'], ["'none'"]);
  for (const n of ['script-src', 'style-src', 'img-src', 'media-src', 'font-src', 'worker-src']) assert.ok(regel[n]?.includes("'self'"), `${n} ohne 'self'`);
  for (const [n, w] of Object.entries(regel)) assert.ok(!w.includes('*') && !w.some(x => /^https?:$/.test(x)), `${n} ist zu weit gefasst`);
  // Skripte: kein 'unsafe-inline', kein 'unsafe-eval'; das eine Inline-Skript in index.html ist über seinen Hash erlaubt
  assert.ok(!regel['script-src'].includes("'unsafe-inline'") && !regel['script-src'].includes("'unsafe-eval'"), 'script-src erlaubt Inline-Skripte');
  const inline = [...lies('index.html').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  for (const s of inline) assert.ok(regel['script-src'].includes(`'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`), 'Inline-Skript in index.html passt nicht zum Hash in der Policy');
  assert.ok(!/\son[a-z]+\s*=\s*["']/i.test(lies('index.html')), 'Inline-Behandler in index.html');
});

test('Vorlagen ohne Inline-Behandler: kein onclick= und Ähnliches in js/ (die Policy würde sie stumm verwerfen)', () => {
  for (const f of readdirSync(join(APP, 'js')).filter(x => x.endsWith('.js'))) {
    const t = lies('js/' + f);
    assert.ok(!/[\s"'`]on(click|change|error|load|input|submit|key\w+|pointer\w+|touch\w+|mouse\w+)\s*=\s*\?["']/.test(t), `Inline-Behandler in js/${f}`);
    assert.ok(!/javascript:/i.test(t), `javascript:-Adresse in js/${f}`);
  }
});
