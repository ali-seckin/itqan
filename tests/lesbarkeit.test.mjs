// Etappe 6: Lesbarkeit, Barrierefreiheit, Hilfe (Gutachten Teil A, Punkte 19 bis 21)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Z, frisch } from './umgebung.mjs';
import { FRAGEN, GLOSSAR, TASTEN } from '../js/hilfe.js';
import { VERSION, NEUIGKEITEN } from '../js/version.js';

const datei = n => readFileSync(new URL('../' + n, import.meta.url), 'utf8');
const css = datei('css/itqan.css'), app = datei('js/app.js'), index = datei('index.html'), sw = datei('sw.js'), hilfe = datei('js/hilfe.js');

// ---------- Kontrast nach WCAG 2.1 ----------
// Farbwert lesen: #rgb, #rrggbb oder rgba(r,g,b,a); Durchsichtiges wird auf den Grund gelegt
const hex = (h, grund) => {
  const m = /^rgba?\(([^)]+)\)$/.exec(h);
  if (m) { const [r, g, b, a = 1] = m[1].split(',').map(Number), u = grund ? hex(grund) : [0, 0, 0]; return [r, g, b].map((v, i) => v * a + u[i] * (1 - a)); }
  h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
};
const hell = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const kontrast = (a, b, grund) => { const [x, y] = [hell(hex(a, grund)), hell(hex(b, grund))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// Farbwerte eines Erscheinungsbildes aus dem Stylesheet lesen (Verweise wie var(--akzent) werden aufgelöst)
function farben(kopf) {
  const roh = {};
  for (const block of css.split('}')) {
    const [vor, inhalt] = block.split('{'); if (!inhalt) continue;
    const sel = vor.replace(/\/\*[\s\S]*?\*\//g, '').trim(); if (!kopf.test(sel)) continue;
    for (const m of inhalt.matchAll(/(--[\w-]+):([^;]+)/g)) roh[m[1]] = m[2].trim();
  }
  const wert = n => { let v = roh[n]; for (let i = 0; v && v.startsWith('var(') && i < 5; i++) v = roh[v.slice(4, -1)]; return v; };
  return new Proxy({}, { get: (_, n) => wert('--' + n) });
}
const HELL = farben(/^:root,\[data-modus=hell\]$/), DUNKEL = farben(/^\[data-modus=dunkel\]$/);

test('Farben: beide Erscheinungsbilder sind im Stylesheet lesbar hinterlegt', () => {
  for (const [name, F] of [['hell', HELL], ['dunkel', DUNKEL]])
    for (const n of ['bg', 'karte', 'karte2', 'text', 'leise', 'akzentT', 'akzentF', 'akzentF2', 'gutT', 'gutF', 'schlechtT', 'aufAkzent', 'aufGut', 'aufSchlecht', 'schlecht'])
      assert.match(F[n] || '', /^#[0-9a-f]{3,6}$|^rgba\(/i, `${name}: --${n} fehlt oder ist kein Farbwert`);
});

test('Kontrast AA: Text auf Grund und Karte mindestens 4,5 zu 1, in Hell und Dunkel', () => {
  for (const [name, F] of [['hell', HELL], ['dunkel', DUNKEL]])
    for (const grund of ['bg', 'karte', 'karte2'])
      for (const schrift of ['text', 'leise', 'akzentT', 'gutT', 'schlechtT']) {
        const k = kontrast(F[schrift], F[grund], F.bg);
        assert.ok(k >= 4.5, `${name}: --${schrift} auf --${grund} hat nur ${k.toFixed(2)}`);
      }
});

test('Kontrast AA: Schrift auf farbigen Flächen mindestens 4,5 zu 1', () => {
  for (const [name, F] of [['hell', HELL], ['dunkel', DUNKEL]])
    for (const [schrift, flaeche] of [['aufAkzent', 'akzentF'], ['aufAkzent', 'akzentF2'], ['aufGut', 'gutF'], ['aufSchlecht', 'schlecht']]) {
      const k = kontrast(F[schrift], F[flaeche]);
      assert.ok(k >= 4.5, `${name}: --${schrift} auf --${flaeche} hat nur ${k.toFixed(2)}`);
    }
});

test('Kontrast: Standfarben der Abschnittsnummern mindestens 4,5 zu 1, große Überschrift in Gold mindestens 3 zu 1', () => {
  for (const [name, F] of [['hell', HELL], ['dunkel', DUNKEL]]) {
    for (const st of ['st-hellblau', 'st-dunkelblau', 'st-gruen', 'st-rot'])
      for (const grund of ['bg', 'karte']) { const k = kontrast(F[st], F[grund], F.bg); assert.ok(k >= 4.5, `${name}: --${st} auf --${grund} hat nur ${k.toFixed(2)}`); }
    assert.ok(kontrast(F.akzent, F.bg) >= 3, `${name}: Gold der großen Überschrift unter 3 zu 1`);
  }
});

test('Auswahllisten: die aufgeklappte Liste hat einen deckenden Grund und lesbare Schrift', () => {
  // am Computer zeichnet der Browser die Liste selbst auf Weiß; ein durchscheinender Grund ließe helle Schrift auf Weiß stehen
  assert.match(css, /select option,select optgroup\{background-color:var\(--liste\);color:var\(--text\)\}/);
  for (const [name, F] of [['hell', HELL], ['dunkel', DUNKEL]]) {
    assert.match(F.liste || '', /^#[0-9a-f]{6}$/i, `${name}: --liste muss eine deckende Farbe sein`);
    const k = kontrast(F.text, F.liste);
    assert.ok(k >= 4.5, `${name}: --text auf --liste hat nur ${k.toFixed(2)}`);
  }
});

test('Zoom ist erlaubt, die Größen wirken schon vor dem Laden der App', () => {
  const sicht = index.match(/<meta name="viewport" content="([^"]+)"/)[1];
  assert.doesNotMatch(sicht, /user-scalable|maximum-scale/);
  assert.match(index, /seitenGroesse/); assert.match(index, /textGroesse/);
  assert.match(css, /--s-text:calc\(18px \* var\(--tm,1\)\)/);
  assert.match(css, /html\[data-gross\] \.roller\{[^}]*overflow-x:auto/);
});

test('Einstellungen: Seitengröße und Schriftgröße haben Vorgaben, auch in älteren Profilen', () => {
  frisch();
  assert.equal(Z.P.einst.seitenGroesse, 100); assert.equal(Z.P.einst.textGroesse, 100);
  const alt = JSON.parse(JSON.stringify(Z.P)); delete alt.einst.seitenGroesse; delete alt.einst.textGroesse;
  Z.ergaenzen(alt);
  assert.equal(alt.einst.seitenGroesse, 100); assert.equal(alt.einst.textGroesse, 100);
  assert.ok(app.includes('[100, 125, 150].map'), 'Wahl der Seitengröße fehlt');
});

test('Bedienhilfen: Navigation, Ansage, Fokus und weniger Bewegung sind verdrahtet', () => {
  assert.match(index, /<nav[^>]*aria-label="Hauptnavigation"/);
  assert.match(index, /<main id="app" tabindex="-1">/);
  assert.match(app, /aria-live="polite"/);
  assert.match(app, /aria-pressed/);
  assert.match(app, /aria-current/);
  assert.match(css, /:focus-visible\{outline:2px solid/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /\.nur-leser\{/);
  // kein Knopf ohne Inhalt und ohne Namen im Quelltext der Ansichten
  const stumm = [...app.matchAll(/<button([^>]*)><\/button>/g)].filter(m => !/aria-label|aria-hidden/.test(m[1]));
  assert.deepEqual(stumm.map(m => m[0]), []);
});

test('Hilfe: Seite ist erreichbar, offline dabei und in „Was ist neu“ genannt', () => {
  assert.match(app, /hilfe: hilfeSeite/);
  assert.match(app, /href="#hilfe"/);
  assert.match(sw, /'js\/hilfe\.js'/);
  assert.equal(VERSION, NEUIGKEITEN[0].v);
  assert.ok(NEUIGKEITEN.some(n => n.v === '1.10' && n.punkte.some(p => /Hilfe und Glossar/.test(p))));
});

test('Hilfe: jede Testfrage hat eine Antwort', () => {
  const THEMEN = ['wird', 'qadaa', 'ruhetag', 'fehler', 'stufen', 'punkte', 'hilfe', 'stelle', 'abhoeren', 'aehnlich', 'groesse', 'sicherung', 'offline', 'bereich', 'modus', 'farben', 'erinnerung', 'mushaf', 'leser'];
  for (const th of THEMEN) {
    const x = FRAGEN.find(f => f.th === th);
    assert.ok(x, `Frage zum Thema ${th} fehlt`);
    assert.ok(x.f.trim().endsWith('?'), `${th}: keine Frage`);
    assert.ok(x.a.replace(/<[^>]+>/g, '').length >= 60, `${th}: Antwort zu kurz`);
  }
  assert.equal(new Set(FRAGEN.map(f => f.th)).size, FRAGEN.length, 'Thema doppelt');
});

test('Glossar: alle Begriffe der App, geordnet, ohne Doppelte', () => {
  const namen = GLOSSAR.map(g => g.b);
  for (const b of ['Abschnitt', 'Āya', 'Fehlerstelle', 'Ǧuzʾ', 'Ḥasanāt', 'Ḫatma', 'Itqān', 'Itqān-Punkte', 'Kette', 'Lichtkarte', 'Murāǧaʿa', 'Muṣḥaf', 'Mutašābihāt', 'mutqan', 'Ornament', 'Pause', 'Qaḍāʾ', 'Rang', 'Rückblick', 'Ruhetag', 'Sicherung', 'Stufe', 'Sūra', 'Tasmīʿ', 'Wird'])
    assert.ok(namen.includes(b), `Begriff ${b} fehlt`);
  assert.equal(new Set(namen).size, namen.length);
  const schlicht = s => s.normalize('NFD').replace(/[̀-ͯʾʿ]/g, '').toLowerCase();
  assert.deepEqual(namen, [...namen].sort((a, b) => schlicht(a).localeCompare(schlicht(b), 'de')));
  for (const g of GLOSSAR) { assert.ok(g.t.length >= 30, `${g.b}: Erklärung zu kurz`); if (g.ar) assert.match(g.ar, /[؀-ۿ]/); }
  // die Stufen im Glossar sind die Stufen der App
  const stufe = GLOSSAR.find(g => g.b === 'Stufe'); for (const s of Z.STUFEN) assert.ok((stufe.t + (stufe.mehr || '')).includes(s), `Stufe ${s} fehlt im Glossar`);
});

test('Hilfe: Tastenkürzel entsprechen dem Programm, Texte ohne Gedankenstriche', () => {
  const alle = TASTEN.flatMap(t => t.kuerzel.flatMap(([k]) => k));
  for (const k of ['Leertaste', 'Enter', 'S', 'R', 'F', 'Esc', 'Tab']) assert.ok(alle.includes(k), `Taste ${k} fehlt`);
  for (const [taste, muster] of [['s', /ev\.key === 's'/], ['r', /ev\.key === 'r'/], ['f', /ev\.key === 'f'/]]) assert.match(app, muster, `Kürzel ${taste} nicht im Programm`);
  assert.doesNotMatch(hilfe, /[–—]/);
  for (const n of NEUIGKEITEN) assert.doesNotMatch(JSON.stringify(n), /[–—]/);
});
