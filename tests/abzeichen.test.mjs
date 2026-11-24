// Abzeichen der Ränge (js/abzeichen.js): 13 verschiedene, wohlgeformte SVG ohne fremde Verweise, eigene Kennungen je Abfrage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { abzeichen, ANZAHL } from '../js/abzeichen.js';
import * as Z from '../js/zustand.js';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const alle = () => Array.from({ length: ANZAHL }, (_, i) => abzeichen(i));
const ids = s => [...s.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
const verweise = s => [...s.matchAll(/url\(#([^)]+)\)/g)].map(m => m[1]);

test('Abzeichen: eines je Rang, so viele wie Ränge, alle verschieden und ohne NaN', () => {
  assert.equal(ANZAHL, Z.RAENGE.length);
  const a = alle();
  assert.equal(new Set(a.map(s => s.replace(/abz\d+-/g, 'abz-'))).size, ANZAHL, 'jedes Abzeichen sieht anders aus');
  for (const [i, s] of a.entries()) {
    assert.ok(s.startsWith('<svg ') && s.trimEnd().endsWith('</svg>'), `Rang ${i + 1}: eine Wurzel`);
    assert.equal((s.match(/<svg/g) || []).length, 1);
    assert.ok(!/NaN|undefined|null|Infinity/.test(s), `Rang ${i + 1}: keine ungültigen Zahlen`);
    assert.ok(!/[–—]/.test(s), 'keine Gedankenstriche');
    assert.ok(s.length < 9000, `Rang ${i + 1}: ${s.length} Zeichen, klein genug`);
    assert.ok(!/<script|on\w+=|href=|xlink|http(?!:\/\/www\.w3\.org)/i.test(s), 'keine Skripte, Ereignisse oder Verweise nach außen');
  }
});

test('Abzeichen: Verläufe und Masken haben eigene Kennungen, jede Abfrage neue, jeder Verweis trifft', () => {
  const x = abzeichen(11), y = abzeichen(11);
  assert.equal(new Set(ids(x)).size, ids(x).length, 'Kennungen im Abzeichen eindeutig');
  assert.equal(ids(x).filter(k => ids(y).includes(k)).length, 0, 'zwei Abfragen teilen keine Kennung');
  for (const s of alle()) for (const v of verweise(s)) assert.ok(ids(s).includes(v), `Verweis ${v} hat sein Ziel`);
  assert.equal((x.match(/<mask /g) || []).length, 2, 'der Knoten (Rang 12) hat zwei Masken für über und unter');
});

test('Abzeichen: Farben des Grundes kommen aus CSS-Variablen (hell und dunkel), nur als style, nie doppelt', () => {
  const css = readFileSync(join(APP, 'css/itqan.css'), 'utf8');
  for (const v of ['n0', 'n1', 'n2', 'e0', 'e1', 'e2']) {
    assert.match(css, new RegExp(String.raw`:root,\[data-modus=hell\]\{[^}]*--abz-${v}:#`), `hell: --abz-${v}`);
    assert.match(css, new RegExp(String.raw`\[data-modus=dunkel\],\.rf\{[^}]*--abz-${v}:#`), `dunkel und Freischaltung: --abz-${v}`);
  }
  for (const [i, s] of alle().entries()) {
    assert.ok(/style="stop-color:var\(--abz-[ne]\d,#[0-9A-Fa-f]{6}\)"/.test(s), `Rang ${i + 1}: Verlauf des Grundes folgt dem Modus`);
    assert.ok(!/(fill|stroke|stop-color)="var\(/.test(s), 'var() nur in style');
    for (const tag of s.match(/<[a-z]+ [^>]*>/g) || []) assert.ok((tag.match(/ style="/g) || []).length <= 1, `Rang ${i + 1}: doppeltes style in ${tag.slice(0, 60)}`);
  }
});

test('Abzeichen: Name macht es zum Bild mit Beschriftung, ohne Name ist es Schmuck; falsche Eingaben fallen auf Rang 1', () => {
  assert.match(abzeichen(4, 'Murābiṭ'), /role="img" aria-label="Murābiṭ"/);
  assert.match(abzeichen(4), /aria-hidden="true"/);
  assert.ok(!/role=/.test(abzeichen(4)));
  assert.match(abzeichen(5, 'a"><script>'), /aria-label="ascript"/, 'Anführungszeichen und Klammern fallen aus dem Namen');
  for (const schlecht of [-1, 13, 1.5, 'x', null, undefined]) assert.equal(abzeichen(schlecht).replace(/abz\d+-/g, 'abz-'), abzeichen(0).replace(/abz\d+-/g, 'abz-'));
});

test('Abzeichen: Einbindung in Ränge, Rangkarte, Rang-Band und Freischaltung; Modul steht im Vorrat des Service Workers', () => {
  const app = readFileSync(join(APP, 'js/app.js'), 'utf8'), rf = readFileSync(join(APP, 'js/rangfeier.js'), 'utf8'), sw = readFileSync(join(APP, 'sw.js'), 'utf8');
  assert.ok(app.includes("import { abzeichen } from './abzeichen.js'"));
  assert.equal((app.match(/\$\{abzeichen\(/g) || []).length, 4, 'Rang-Band, Rangkarte (ohne und mit Rang) und Liste der Ränge');
  assert.ok(rf.includes("abzeichen(r)") && rf.includes('rf-abz'));
  assert.ok(sw.includes("'js/abzeichen.js'"));
  const css = readFileSync(join(APP, 'css/itqan.css'), 'utf8');
  assert.match(css, /\.rangstufe:not\(\.erreicht\):not\(\.jetzt\) \.abz,\.abz-leer\{opacity:\.4/);
  assert.match(css, /\.rf-ruhig \.rf-z,\.rf-ruhig \.rf-fuell,\.rf-ruhig \.rf-abz\{animation:none\}/);
});
