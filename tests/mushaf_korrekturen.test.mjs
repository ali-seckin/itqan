// Itqān · Muṣḥaf-Korrekturen 2.02 und Blätter-Pipeline (Vollbild und Doppelseite). Prüft die Bauweise im Quelltext, weil Gesten und Animationen nur auf dem Gerät laufen:
// Zoom nach dem Blättern sichtbar (Animation behält die Endstellung nicht), Regler blendet beim Zoomen aus, Nachbarblätter fertig im DOM, nur transform,
// goldener Rahmen nie abgeschnitten, Doppelseite zentriert, Drehen bewertet neu. (Das Verhalten prüft werkzeuge/ui/ablaeufe/08_blaettern.mjs im Browser.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const lies = p => readFileSync(join(wurzel, p), 'utf8').replace(/\r\n/g, '\n');
const app = lies('js/app.js'), css = lies('css/itqan.css'), mushaf = lies('js/mushaf.js'), blaettern = lies('js/blaettern.js');

test('Blättern: die Animation behält ihre Endstellung nicht (sonst überdeckt sie den Zoom): Endzustand setzen, Animationen im selben Bild löschen', () => {
  const f = blaettern.slice(blaettern.indexOf('  befoerdern() {'), blaettern.indexOf('  abbruchEnde() {'));
  assert.match(f, /e\.style\.transform = ''/);
  assert.match(f, /an\?\.forEach\(a => a\.cancel\(\)\)/);
  assert.ok(f.indexOf("this.rolle(neu, 'jetzt')") < f.indexOf('a.cancel()'), 'erst der Endzustand, dann das Löschen der Animation');
});

test('Vollbild: Zoom beendet ein laufendes Blättern zuerst und setzt den Zoom dann auf die neue Seite; der Zoom endet mit dem Blättern', () => {
  const zoom = app.slice(app.indexOf('const zoomSetzen = (s, x, y) => {'), app.indexOf('const mitteVon = () =>'));
  assert.match(zoom, /if \(s > 1\.02\) stapel\?\.sofort\(\)/);
  assert.ok(zoom.indexOf('stapel?.sofort()') < zoom.indexOf('const el = aktuell()'), 'erst ankommen lassen, dann die aktuelle Seite holen');
  const start = app.slice(app.indexOf('beiStart: (cur, ziel) =>'), app.indexOf('beiBefoerdert: (ss, el2, r) =>'));
  assert.match(start, /Z0\.s = 1; Z0\.x = 0; Z0\.y = 0;/);
  assert.match(start, /v\.classList\.remove\('gezoomt'\)/);
});

test('Vollbild: Seitenregler blendet bei Zoom aus und bei 100 % wieder ein', () => {
  const teil = css.slice(css.indexOf('/* Muṣḥaf-Korrekturen 2.02 */'));
  assert.match(teil, /\.vollbild\.gezoomt \.vb-regler[^{]*\{[^}]*opacity:0[^}]*pointer-events:none/);
  assert.match(teil, /\.vb-regler\{transition:opacity/);
});

test('Blättern: Nachbarblätter stehen fertig im DOM, Schriften laden nie während der Bewegung', () => {
  assert.doesNotMatch(blaettern, /schriftenLaden|document\.fonts|FontFace/, 'blaettern.js lädt selbst keine Schriften');
  const vorb = blaettern.slice(blaettern.indexOf('  vorbereiten(zuerst = 1) {'), blaettern.indexOf('  bereit(r) {'));
  assert.match(vorb, /leerlauf\(/);
  assert.match(vorb, /this\.a\.phase !== 'ruhe'/, 'nur im Ruhezustand, nie während einer Bewegung');
  assert.match(app, /bauen: async ss => \{\s*await schriftenLaden\(ss\);/, 'Muṣḥaf-Ansicht: Schriften vor dem Bauen des Nachbarblattes');
  assert.match(app, /const blattBauen = async ss => \{\s*await schriftenLaden\(ss\);/, 'Vollbild: Schriften vor dem Bauen des Nachbarblattes');
  assert.match(blaettern, /this\.vorbereiten\(r\)/, 'nach der Landung wird das nächste Nachbarblatt vorbereitet');
});

test('Blättern: nur transform auf dem Compositor, will-change nur während der Bewegung, kein Neuaufbau am Ende', () => {
  const st = blaettern.slice(blaettern.indexOf('  async starten('), blaettern.indexOf('  animFertig(id) {'));
  assert.match(st, /translate3d\(/);
  assert.match(st, /style\.willChange = 'transform'/);
  assert.doesNotMatch(st, /getBoundingClientRect|offsetWidth|offsetHeight|clientWidth|getComputedStyle/, 'keine Layout-Messung beim Start der Bewegung');
  assert.match(blaettern, /style\.willChange = ''/, 'will-change wird danach entfernt');
  const bef = blaettern.slice(blaettern.indexOf('  befoerdern() {'), blaettern.indexOf('  abbruchEnde() {'));
  assert.doesNotMatch(bef, /innerHTML|createElement|bauen\(/, 'am Ende wird nichts neu gerendert');
  assert.doesNotMatch(css, /\.vb-seiten\{will-change:transform\}/, 'kein dauerhaftes will-change');
  const alt = app.slice(app.indexOf('async function mushaf(pText, aText)'), app.indexOf('// ---------- Vollbild: nur die Seite'));
  assert.doesNotMatch(alt, /location\.replace\('#mushaf\/' \+ ziel\)|blaetterNahtlos = !ruhig/, 'Blättern baut die Ansicht nicht mehr über die Adresse neu auf');
  assert.match(alt, /history\.replaceState\(history\.state, '', '#mushaf\/' \+ p\)/);
});

test('Blättern: der goldene Rahmen wird nie abgeschnitten (Beschneidung am Fensterrand, nicht am Rand der Seite) und gehört zur Seite', () => {
  assert.match(css, /\[data-ansicht=mushaf\] #app\{overflow-x:clip\}/);
  assert.doesNotMatch(app, /seiteEl\.style\.overflowX = 'clip'/, 'keine Beschneidung am Rand der Seite während der Bewegung');
  assert.match(css, /\.seite\{contain:layout paint style\}/);
  assert.match(css, /\.blatt-nb\{visibility:hidden;pointer-events:none\}/);
  assert.match(css, /\[data-modus=dunkel\] \.seite\{outline:3px double/, 'der Rahmen hängt an der Seite selbst');
});

test('Doppelseite: zentriert mit Safe-Area, Rahmen der Ansicht schließt den Umbruch ein (Wrapper .blatt-feld nimmt die Breite nicht auf 760 px)', () => {
  assert.match(css, /body\.doppelt\[data-ansicht=mushaf\] #app>:not\(\.blatt-feld\)\{max-width:760px/);
  assert.match(css, /html body\.doppelt #app\{padding-left:max\(18px,env\(safe-area-inset-left,0px\)\);padding-right:max\(18px,env\(safe-area-inset-right,0px\)\)/);
});

test('Drehen: Einzel- oder Doppelseite wird bei jedem Anlass neu bewertet (nicht nur beim zweiten Mal)', () => {
  assert.doesNotMatch(app, /warDoppelt/, 'die alte Merkvariable, die das erste Ereignis verschluckte, ist weg');
  const f = app.slice(app.indexOf('function ansichtPruefen() {'), app.indexOf('const ansichtAnlass'));
  assert.match(f, /doppelseitig\(\) === document\.body\.classList\.contains\('doppelt'\)/);
  assert.match(f, /blaetterNahtlos = true/);
  for (const ev of ["addEventListener('resize', ansichtAnlass)", "addEventListener('orientationchange', ansichtAnlass)", "?.('change', ansichtAnlass)", "visualViewport?.addEventListener?.('resize', ansichtAnlass)"]) assert.ok(app.includes(ev), ev);
  assert.match(app, /\[150, 500\]\.map\(ms => setTimeout\(ansichtPruefen, ms\)\)/, 'Nachprüfungen für Geräte, die ihre Maße spät melden');
});

test('Zeilen einpassen: erst alle zurücksetzen, dann alle messen, dann alle setzen (ein Layout statt eines je Zeile)', () => {
  const f = mushaf.slice(mushaf.indexOf('export function zeilenEinpassen'), mushaf.indexOf('// Abschnittsgrenzen'));
  assert.match(f, /const mass = zeilen\.map\(/);
  assert.doesNotMatch(f, /for \(const z of el\.querySelectorAll\('\.mz'\)\)[^]*scrollWidth[^]*style\.fontSize = `/);
});
