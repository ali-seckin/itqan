// Projekt unterstützen (js/unterstuetzen.js): Schalter, nur Android-App, Freitagsregel, Texte in allen Sprachen, Einbindung
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SPENDE, spendeMoeglich, istAndroidApp, tagKey, freitagFaellig, ruheRoute } from '../js/unterstuetzen.js';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const lies = p => readFileSync(join(APP, p), 'utf8');
const geraet = platform => ({ Capacitor: platform ? { isNativePlatform: () => true, getPlatform: () => platform } : { isNativePlatform: () => false, getPlatform: () => 'web' } });

test('Schalter: im ersten Paket aus (Entscheidung 24.11.2026), Link auf PayPal.Me', () => {
  assert.equal(SPENDE.an, false, 'der Schalter steht auf aus; Einschalten ist eine bewusste Entscheidung');
  assert.equal(SPENDE.url, 'https://www.paypal.me/aliseckin1');
});

test('Sichtbarkeit: nur Android-App und nur mit eingeschaltetem Schalter', () => {
  const an = { an: true, url: SPENDE.url }, aus = { an: false, url: SPENDE.url };
  assert.equal(spendeMoeglich(geraet('android'), aus), false, 'Schalter aus: auch auf Android unsichtbar');
  assert.equal(spendeMoeglich(geraet('android')), false, 'mit dem eingecheckten Schalter unsichtbar');
  assert.equal(spendeMoeglich(geraet('android'), an), true);
  assert.equal(spendeMoeglich(geraet('ios'), an), false, 'iPhone: nie');
  assert.equal(spendeMoeglich(geraet(null), an), false, 'Browser: nie');
  assert.equal(spendeMoeglich({}, an), false, 'ohne Capacitor: nie');
  assert.equal(istAndroidApp({ Capacitor: { isNativePlatform: () => false, getPlatform: () => 'android' } }), false, 'Android-Browser ist keine App');
});

test('Freitag: einmal je Freitag, an jedem anderen Tag nie', () => {
  const tag = (y, m, d) => new Date(y, m - 1, d, 9, 0);
  assert.equal(tagKey(tag(2026, 11, 27)), '2026-11-27');
  assert.equal(tagKey(tag(2026, 1, 5)), '2026-01-05');
  assert.equal(freitagFaellig(tag(2026, 11, 27), ''), true, 'Freitag, noch nicht gezeigt');
  assert.equal(freitagFaellig(tag(2026, 11, 27), '2026-11-27'), false, 'am selben Freitag nicht noch einmal');
  assert.equal(freitagFaellig(tag(2026, 12, 4), '2026-11-27'), true, 'nächster Freitag wieder');
  for (const d of [23, 24, 25, 26, 28, 29]) assert.equal(freitagFaellig(tag(2026, 11, d), ''), false, `kein Freitag: ${d}.11.`);
  assert.equal(freitagFaellig(new Date(2026, 10, 27, 23, 59), ''), true, 'bis Mitternacht Ortszeit');
});

test('Ansicht: nur auf ruhigen Ansichten, nicht im Üben oder in der Einführung', () => {
  for (const h of ['', '#', '#heute', '#karte', '#mushaf', '#mushaf/32', '#uebungen', '#profil', '#profil?x=1']) assert.equal(ruheRoute(h), true, h);
  for (const h of ['#ueben/ab12', '#kurz', '#einfuehrung', '#sprachwahl', '#start', '#lernen']) assert.equal(ruheRoute(h), false, h);
  assert.equal(ruheRoute(undefined), true);
});

test('Texte: Abschnitt spende und gruppe_mehr_t_spende in allen sieben Sprachen, gleiche Schlüssel, ohne Gedankenstriche', () => {
  const codes = readdirSync(join(APP, 'js/sprache')).filter(f => f.endsWith('.js')).map(f => f.slice(0, -3));
  assert.equal(codes.length, 7);
  const block = c => lies(`js/sprache/${c}.js`).match(/^  spende: \{([\s\S]*?)^  \},/m);
  const schluessel = [...block('de')[1].matchAll(/^\s+(\w+):/gm)].map(m => m[1]);
  assert.deepEqual(schluessel, ['eintrag', 'titel', 'text_1', 'text_2', 'knopf', 'schliessen', 'freitag_titel', 'freitag_1', 'freitag_2', 'freitag_dua']);
  for (const c of codes) {
    const m = block(c); assert.ok(m, `${c}: Abschnitt spende fehlt`);
    assert.deepEqual([...m[1].matchAll(/^\s+(\w+): '([^']+)'/gm)].map(x => x[1]), schluessel, c);
    assert.ok(!/[–—]/.test(m[1]), `${c}: Gedankenstrich`);
    assert.match(lies(`js/sprache/${c}.js`), /^    gruppe_mehr_t_spende: '[^']+',$/m, `${c}: gruppe_mehr_t_spende fehlt`);
  }
  const de = block('de')[1];
  assert.ok(de.includes('eine große Ṣadaqah') && de.includes('Möge Allāh (swt) jede Spende annehmen und großzügig entlohnen!') && de.includes('einen gesegneten Ǧumuʿah!'), 'deutsche Texte nach Vorgabe');
});

test('Einbindung: Eintrag nur mit Schalter, Freitagsfenster nach dem Start, Knopf öffnet PayPal im neuen Fenster, Modul im Vorrat', () => {
  const app = lies('js/app.js');
  assert.ok(app.includes("import { SPENDE, spendeMoeglich, freitagFaellig, tagKey, SPENDE_MERKER, ruheRoute } from './unterstuetzen.js'"));
  assert.match(app, /\$\{spendeMoeglich\(\) \? `<button type="button" class="karte" id="spende-oeffnen">/, 'der Eintrag hängt am Schalter');
  assert.ok(app.includes('setTimeout(freitagPruefen, 5500)'));
  assert.match(app, /href="\$\{esc\(SPENDE\.url\)\}" target="_blank" rel="noopener"/, 'Link nur aus SPENDE.url, im neuen Fenster');
  assert.ok(/function freitagPruefen[\s\S]*?if \(!spendeMoeglich\(\) \|\| !Z\.P\) return;/.test(app), 'Freitagsfenster nur mit Schalter und Profil');
  assert.ok(lies('sw.js').includes("'js/unterstuetzen.js'"));
  assert.ok(!/[–—]/.test(lies('js/unterstuetzen.js')), 'Gedankenstrich im Modul');
});
