// Itqān · Üben-Leiste 2.05: feste Rasterstruktur der Leiste im Querformat, gezeichnete Symbole der runden Knöpfe, Übersetzung in „Erst ansehen“.
// Reine Quelltext- und Sprachprüfungen (die Messung der Lage im Browser steht in werkzeuge/ui/ablaeufe/10_ueben_leiste.mjs, außerhalb von app).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const quelle = pfad => readFileSync(join(APP, pfad), 'utf8');
const js = quelle('js/app.js'), css = quelle('css/itqan.css');
const CODES = ['de', 'en', 'tr', 'ar', 'fr', 'es', 'ur'];

test('runde Knöpfe: Symbole sind gezeichnet, keine Schriftzeichen, die je nach Schrift verschieden breit sind', () => {
  for (const z of ['▶', '❚❚', '■', '●']) assert.ok(!js.includes(`'${z}'`) && !js.includes(`>${z}</button>`), `${z} steht nicht mehr als Knopfbeschriftung`);
  assert.match(js, /const IKONEN = \{ auf:.*stopp:.*play:.*pause:/s, 'vier Symbole');
  assert.ok((js.match(/ikon\(nimmt \? 'stopp' : 'auf'\)/g) || []).length >= 2, 'beide Aufnahmeknöpfe (Üben und ganzer Abschnitt) zeichnen das Symbol');
  assert.ok((js.match(/hoerenZeichen\(hb2?, (true|false)\)/g) || []).length >= 6, 'beide Wiedergabeknöpfe wechseln über hoerenZeichen');
  assert.match(js, /function hoerenZeichen\(b, spielt\) \{[^}]*aria-label[^}]*uebenleiste\.pause/s, 'die Beschriftung wechselt mit dem Zeichen');
});

test('Leiste im Querformat: feste Spalten, runder Knopf in einer eigenen Spalte, Punkte linksbündig', () => {
  const i = css.indexOf('/* Üben-Leiste 2.05 */');
  assert.ok(i > 0, 'Abschnitt Üben-Leiste 2.05 im Stylesheet');
  const neu = css.slice(i);
  assert.match(neu, /#knoepfe\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\) 44px/, 'drei Spalten der Mitte und eine feste Spalte für den runden Knopf');
  assert.match(neu, /\.knopf\.rund\{grid-column:var\(--r\)/, 'der runde Knopf liegt in der festen Spalte');
  assert.match(neu, /\[dir=rtl\] \.steuerung #knoepfe\{grid-template-columns:44px repeat\(3/, 'rtl spiegelt die Spalten');
  assert.match(neu, /\.punkte\{justify-content:flex-start\}/, 'Punkte linksbündig');
  assert.match(neu, /#hinweis\{min-height:calc\(3 \* 1\.3 \* 12\.5px\)\}/, 'drei Zeilen Hinweis reserviert');
  // die Spalte rechts hat eine feste Breite, nicht auto (sonst hängt die Lage der Punkte an der Länge der Beschriftungen)
  const innen = css.match(/\.steuerung \.innen\{[^}]*\}/g).find(r => r.includes('grid-template-areas'));
  assert.match(innen, /grid-template-columns:minmax\(0,1fr\) calc\(var\(--kb\) \* 3 \+ 30px \+ 44px\)/);
  assert.ok(!/grid-template-columns:minmax\(0,1fr\) auto/.test(innen));
});

test('Erst ansehen: ein Tipp auf eine Āya zeigt die Übersetzung, der zweite blendet sie aus', () => {
  const klick = js.match(/seitenEl\.addEventListener\('click', ev => \{   \/\/ aufgedeckte Āya antippen[\s\S]*?\n  \}\);/)?.[0] || '';
  assert.ok(klick.indexOf('if (vorschau)') > 0 && klick.indexOf('if (vorschau)') < klick.indexOf('!offen'), 'die Vorschau wird vor dem Üben-Zweig behandelt');
  assert.match(js, /async function vorschauTipp\(vi, w\) \{\s*if \(document\.querySelector\('\.uebs-blase'\) && document\.querySelector\('\.w\.uebs'\)\?\.dataset\.v === String\(vi\)\) \{ blaseSchliessen\(\)/, 'zweiter Tipp auf dieselbe Āya schließt');
  assert.match(js, /ansage\.dataset\.t = '1'/, 'der Text geht in die feste Live-Region für Bildschirmleser');
  assert.match(js, /const wahlWoerter = \(\) => !seitenEl\.isConnected \? \[\] : vorschau \? \(uebersetzungSprache\(\)/, 'Āyāt sind in der Vorschau über Tastatur erreichbar, nur wenn eine Übersetzung gilt');
  // im Üben-Modus (nach dem Aufdecken) bleibt es beim bisherigen Verhalten
  assert.match(klick, /if \(!offen \|\| markieren \|\| abhoeren\) return;[\s\S]*uebersetzungZeigen/);
});

test('Sprachen: neue Schlüssel der Üben-Leiste in allen sieben Sprachen, mit demselben Platzhalter', async () => {
  for (const c of CODES) {
    const t = (await import(`../js/sprache/${c}.js`)).default.uebenleiste;
    assert.ok(t, `${c}: Abschnitt uebenleiste`);
    for (const k of ['tipp_hinweis', 'aya_uebersetzung', 'pause']) assert.ok(typeof t[k] === 'string' && t[k].length > 3, `${c}.${k}`);
    assert.ok(t.aya_uebersetzung.includes('{a}'), `${c}: Platzhalter {a}`);
    assert.ok(!/[–—]/.test(Object.values(t).join('')), `${c}: keine Gedankenstriche`);
  }
});
