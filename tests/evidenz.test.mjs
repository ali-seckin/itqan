// Itqān · Tests zur Seite „Evidenz und Grenzen“ (js/evidenz.js, Route #evidenz, Texte in allen Sprachen).
// Geprüft wird: alle Schlüssel in allen Sprachen mit denselben Platzhaltern und Marken, die Zahlen der Seite gegen die Quelldatei der
// Simulation (werkzeuge/lernmodell/final_ergebnis_9000.md), die Verdrahtung in app.js und sw.js, keine Gedankenstriche.
import './umgebung.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const WURZEL = join(APP, '..');
const SPRACHEN = ['de', 'en', 'tr', 'ar', 'fr', 'es', 'ur'];
const lies = p => readFileSync(join(APP, p), 'utf8');

// Quelle der Zahlen
// Die Datei liegt außerhalb des App-Repos (werkzeuge/): in der Veröffentlichung auf GitHub fehlt sie, dann entfällt nur der Zahlenvergleich
const QUELLE = join(WURZEL, 'werkzeuge', 'lernmodell', 'final_ergebnis_9000.md');
const quelle = existsSync(QUELLE) ? readFileSync(QUELLE, 'utf8') : null;
const zahlenIn = zeile => [...zeile.matchAll(/(-?\d+\.\d)(?= ±)/g)].map(m => +m[1]);
const bereich = abschnitt => { const i = quelle.indexOf(abschnitt); assert.ok(i >= 0, abschnitt); return quelle.slice(i); };
const zeileMit = (text, anfang) => text.split('\n').find(z => z.startsWith(anfang));

// Sprachen laden: erst Deutsch (bleibt die Grundsprache), dann der Reihe nach die anderen
globalThis.document = { documentElement: {}, querySelectorAll: () => [] };
globalThis.location = { search: '' };
const { ladeSprache, tx } = await import('../js/sprache.js');
const { evidenzHTML, ZAHLEN } = await import('../js/evidenz.js');
const sprachDatei = {};
for (const c of SPRACHEN) sprachDatei[c] = (await import(`../js/sprache/${c}.js`)).default;

test('Zahlen der Seite stimmen mit der Endprüfung der Simulation überein', { skip: !quelle && 'ohne werkzeuge/lernmodell (nur im Projektordner)' }, () => {
  assert.equal(+quelle.match(/= (\d+),/)[1], ZAHLEN.welten, 'Zahl der Testwelten');
  const paar = bereich('## Gepaarter Unterschied');
  const kl = zahlenIn(zeileMit(paar, '| Klassisch |')), lz = zahlenIn(zeileMit(paar, '| Langzeit (alt) |'));
  assert.equal(kl.length, 4); assert.equal(lz.length, 4);
  assert.deepEqual([Math.min(...kl), Math.max(...kl)], ZAHLEN.klassisch, 'Vorsprung gegenüber Klassisch');
  assert.deepEqual([Math.min(...lz), Math.max(...lz)], ZAHLEN.langzeit, 'Vorsprung gegenüber Langzeit');
  const typ = bereich('## Nach Welttyp').split('\n').filter(z => /^\| [a-zäöü]+ \|/.test(z) && !z.startsWith('| Typ'))
    .flatMap(z => z.split('|').slice(2, 6).map(s => +s));
  assert.equal(typ.length, 44, 'elf Welttypen mal vier Pensen');
  assert.equal(-Math.min(...typ), ZAHLEN.schwach, 'größter Rückstand');
});

test('alle Sprachen haben den Abschnitt evidenz mit denselben Schlüsseln, Platzhaltern und Marken', () => {
  const de = sprachDatei.de.evidenz;
  const form = t => ({ p: [...t.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(), m: (t.match(/<\/?[a-z]+>/g) || []).join() });
  for (const c of SPRACHEN) {
    const e = sprachDatei[c].evidenz;
    assert.ok(e, c);
    assert.deepEqual(Object.keys(e), Object.keys(de), `${c}: Schlüssel`);
    for (const k of Object.keys(de)) {
      assert.ok(typeof e[k] === 'string' && e[k].trim(), `${c}.${k} leer`);
      assert.deepEqual(form(e[k]), form(de[k]), `${c}.${k}: Platzhalter oder Marken weichen ab`);
      assert.ok(!/[–—]/.test(e[k]), `${c}.${k}: Gedankenstrich`);
    }
  }
});

test('die Seite erscheint in jeder Sprache vollständig, mit den Zahlen der Quelle und ohne offene Platzhalter', async () => {
  for (const c of SPRACHEN) {
    localStorage.setItem('itqan-sprache', c);
    await ladeSprache();
    const h = evidenzHTML('<svg></svg>');
    assert.ok(!/evidenz\.\w+/.test(h), `${c}: ein Schlüssel fehlt`);
    assert.ok(!/\{\w+\}/.test(h) && !/undefined|NaN/.test(h), `${c}: offener Platzhalter`);
    assert.ok(!/[–—]/.test(h), `${c}: Gedankenstrich`);
    assert.ok(h.includes('data-ziel="#profil"') && h.includes('href="#rueckmeldung"'), `${c}: Zurück oder Rückmeldung fehlt`);
    const dez = n => n.toLocaleString(sprachDatei[c]._.zahl, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    for (const n of [...ZAHLEN.klassisch, ...ZAHLEN.langzeit, ZAHLEN.schwach]) assert.ok(h.includes(dez(n)), `${c}: ${n} fehlt`);
    assert.ok(h.includes(String(ZAHLEN.welten)), `${c}: Zahl der Welten fehlt`);
    // Evidenzaussage: nie „bewiesen“ als Versprechen, nie eine Garantie
    assert.equal((h.match(/<li>/g) || []).length, 16);
  }
  localStorage.setItem('itqan-sprache', 'de');
});

test('die Seite ist verdrahtet: Route, Titel, Eintrag im Profil, Datei im Service Worker', () => {
  const app = lies('js/app.js'), sw = lies('sw.js');
  assert.match(app, /await import\('\.\/evidenz\.js'\)/);   // erst bei Bedarf, nicht im Startpfad (index.html)
  assert.match(app, /const ROUTEN = \{[^\n]*evidenz: evidenzSeite/);
  assert.match(app, /hilfe: tx\('titel\.hilfe_und_glossar'\), evidenz: tx\('evidenz\.titel'\) \};/);
  assert.match(app, /href="#evidenz"[^\n]*tx\('evidenz\.eintrag'\)/);
  assert.match(sw, /'js\/evidenz\.js'/);
  assert.ok(existsSync(join(APP, 'js', 'evidenz.js')));
});

test('die Website zeigt dieselben Zahlen, falls die Seite gebaut ist', () => {
  for (const [datei, dez] of [['evidenz.html', n => String(n).replace('.', ',')], [join('en', 'evidence.html'), n => String(n)]]) {
    const p = join(WURZEL, 'website', datei);
    if (!existsSync(p)) continue;
    const h = readFileSync(p, 'utf8');
    for (const n of [...ZAHLEN.klassisch, ...ZAHLEN.langzeit, ZAHLEN.schwach]) assert.ok(h.includes(dez(n)), `${datei}: ${n} fehlt`);
    assert.ok(h.includes(String(ZAHLEN.welten)), `${datei}: Zahl der Welten fehlt`);
    assert.ok(!/[–—]/.test(h.replace(/<script[\s\S]*?<\/script>/g, '')), `${datei}: Gedankenstrich`);
  }
});
