// Itqān · Tests zur Textfassung für Bildschirmleser und zu den wählbaren Wörtern beim Üben (Version 1.13)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { D, lies } from './umgebung.mjs';
import { TASTEN } from '../js/hilfe.js';
const daten = await import('../js/daten.js');
const M = await import('../js/mushaf.js');
const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const U = lies('daten/text.json').u.map(x => x.split('|'));

for (const [datei, ausgabe] of [['daten/layout_v1.json', 'v1'], ['daten/layout_v2.json', 'v2']]) {
  test(`Textfassung ${ausgabe}: Alle 604 Seiten zusammen ergeben jede Āya vollständig und in der Reihenfolge des Qurʾān`, () => {
    daten.layoutSetzen(lies(datei)); D.ausgabe = ausgabe; M.textSetzen(U);
    const woerter = U.map(() => []); let letzte = -1, koepfe = 0, basmala = 0;
    for (let p = 1; p <= 604; p++) {
      for (const x of M.seiteAlsText(p)) {
        if (x.art === 'kopf') { koepfe++; assert.match(x.text, /[؀-ۿ]/); continue; }
        if (x.art === 'basmala') { basmala++; continue; }
        assert.ok(x.vi >= letzte, `Seite ${p}: Āya ${x.vi} steht vor ${letzte}`);
        letzte = x.vi;
        assert.deepEqual([x.s, x.a], [D.V[x.vi][0], D.V[x.vi][1]]);
        woerter[x.vi].push(...x.woerter);
      }
    }
    assert.equal(koepfe, 114);
    assert.equal(basmala, 112);                                   // ohne al-Fātiḥah (dort ist sie Āya 1) und at-Taubah
    U.forEach((w, vi) => assert.deepEqual(woerter[vi], w, `Āya ${vi}`));
  });
}

test('Textfassung: Seite 1 beginnt mit dem Sūrenkopf und hat sieben Āyāt mit Nummer', () => {
  daten.layoutSetzen(lies('daten/layout_v1.json')); D.ausgabe = 'v1'; M.textSetzen(U);
  const t = M.seiteAlsText(1);
  assert.equal(t[0].art, 'kopf'); assert.equal(t[0].s, 1);
  const ayat = t.filter(x => x.art === 'aya');
  assert.deepEqual(ayat.map(x => `${x.s}:${x.a}`), ['1:1', '1:2', '1:3', '1:4', '1:5', '1:6', '1:7']);
  assert.equal(ayat[0].woerter.join(' '), U[0].join(' '));
});

test('Textfassung: ohne geladenen Text gibt es keine Fassung, das Endzeichen hat keinen Wortlaut', () => {
  M.textSetzen(null);
  assert.equal(M.seiteAlsText(1), null);
  assert.equal(M.wortText(0, 0), undefined);
  M.textSetzen(U);
  assert.equal(M.wortText(0, 0), U[0][0]);
  assert.equal(M.wortText(0, U[0].length), null);
});

test('Seite beim Üben: Gruppe statt Bild, jedes Wort zunächst stumm, Textfassung daneben', () => {
  daten.layoutSetzen(lies('daten/layout_v1.json')); D.ausgabe = 'v1'; M.textSetzen(U);
  const bild = M.seiteHTML(3), wahl = M.seiteHTML(3, { wahl: true });
  assert.match(bild, /class="seite-innen" role="img"/);
  assert.doesNotMatch(bild, /class="(w|mz)[^"]*"[^>]*aria-hidden/);
  assert.match(wahl, /class="seite-innen" role="group"/);
  const worte = wahl.match(/<span class="w( [^"]*)?" data-v[^>]*>/g);
  assert.ok(worte.length > 50);
  for (const w of worte) assert.match(w, /aria-hidden="true"/);
  for (const html of [bild, wahl]) assert.match(html, /<div class="stext nur-leser" data-st="3" role="group" aria-label="[^"]+"><\/div>/);
  // Kopf und Basmala sind beim Üben ebenfalls stumm (sie stehen in der Textfassung)
  assert.match(M.seiteHTML(2, { wahl: true }), /class="mz kopfz" aria-hidden="true"/);
  assert.match(M.seiteHTML(2, { wahl: true }), /class="mz bas" aria-hidden="true"/);
});

test('Tastatur: Die Kürzel zum Markieren des Fehlerworts stehen in der Hilfe und im Programm', () => {
  const app = readFileSync(join(APP, 'js/app.js'), 'utf8');
  const ueben = TASTEN[0].kuerzel;
  assert.ok(ueben.some(([k]) => k.includes('W')), 'W fehlt in der Hilfe');
  assert.ok(ueben.filter(([k]) => k.includes('←')).length >= 2, 'Pfeiltasten zum Wählen fehlen in der Hilfe');
  assert.match(app, /ev\.key === 'w'/);
  assert.match(app, /aria-pressed/);
  assert.match(app, /function seiteHolen\(/);
});
