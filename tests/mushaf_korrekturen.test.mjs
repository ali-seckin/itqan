// Itqān · Muṣḥaf-Korrekturen 2.02 (Vollbild und Doppelseite). Prüft die Bauweise im Quelltext, weil Gesten und Animationen nur auf dem Gerät laufen:
// Zoom nach dem Blättern sichtbar (Animation behält die Endstellung nicht), Regler blendet beim Zoomen aus, Nachbarpaar wird nach dem Gleiten vorgeladen,
// neue Seite beim nahtlosen Blättern nach der echten Lage der alten Seite ausgerichtet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const lies = p => readFileSync(join(wurzel, p), 'utf8').replace(/\r\n/g, '\n');
const app = lies('js/app.js'), css = lies('css/itqan.css'), mushaf = lies('js/mushaf.js');

test('Vollbild: die Blätteranimation der neuen Seite behält ihre Endstellung nicht (sonst überdeckt sie den Zoom)', () => {
  const zeile = app.split('\n').find(l => l.includes('neuEl.animate('));
  assert.ok(zeile, 'neuEl.animate gefunden');
  assert.match(zeile, /fill: 'backwards'/);
  assert.doesNotMatch(zeile, /fill: 'both'/);
});

test('Vollbild: Zoom beendet ein laufendes Gleiten und der Zoomzustand wird erst mit der neuen Seite zurückgesetzt', () => {
  assert.match(app, /if \(s > 1\) el\.getAnimations\?\.\(\)\.forEach\(a => a\.finish\(\)\)/);
  const zeige = app.slice(app.indexOf('async function zeige(neu, richtung = 0)'), app.indexOf('const gleiten = (alt, neuEl, richtung)'));
  assert.ok(zeige.indexOf('await schriftenLaden(seiten)') < zeige.indexOf("Z0.s = 1; Z0.x = 0; Z0.y = 0; v.classList.remove('gezoomt')"), 'Zurücksetzen erst nach dem Laden');
});

test('Vollbild: Seitenregler blendet bei Zoom aus und bei 100 % wieder ein', () => {
  const teil = css.slice(css.indexOf('/* Muṣḥaf-Korrekturen 2.02 */'));
  assert.match(teil, /\.vollbild\.gezoomt \.vb-regler[^{]*\{[^}]*opacity:0[^}]*pointer-events:none/);
  assert.match(teil, /\.vb-regler\{transition:opacity/);
});

test('Vollbild: Nachbarseiten werden nach dem Gleiten vorgeladen, bei der Doppelseite das ganze Paar', () => {
  const zeile = app.split('\n').find(l => l.includes('vorladen = setTimeout('));
  assert.ok(zeile);
  assert.match(zeile, /doppel \? 2 : 1/);
  assert.match(zeile, /richtung \? 450 : 0/);
  assert.ok(app.includes('clearTimeout(vorladen)'));
});

test('Nahtloses Blättern: die neue Seite wird nach der tatsächlichen Lage der alten ausgerichtet (Doppelseite, dunkler Modus, Halbpixel)', () => {
  assert.match(app, /nr\.style\.left = \(parseFloat\(nr\.style\.left\) \+ A\.left - B\.left\) \+ 'px'/);
  assert.match(app, /nr\.style\.top = \(parseFloat\(nr\.style\.top\) \+ A\.top - B\.top\) \+ 'px'/);
});

test('Zeilen einpassen: erst alle zurücksetzen, dann alle messen, dann alle setzen (ein Layout statt eines je Zeile)', () => {
  const f = mushaf.slice(mushaf.indexOf('export function zeilenEinpassen'), mushaf.indexOf('// Abschnittsgrenzen'));
  assert.match(f, /const mass = zeilen\.map\(/);
  assert.doesNotMatch(f, /for \(const z of el\.querySelectorAll\('\.mz'\)\)[^]*scrollWidth[^]*style\.fontSize = `/);
});
