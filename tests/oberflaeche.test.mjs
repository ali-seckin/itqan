// Itqān · Oberfläche, soweit ohne Browser prüfbar (Audit 1.99: H3 / S1 Schadcode über Profildateien, S3 Inline-Behandler, B-03, B-05)
// Geprüft wird die Kette, über die fremde Inhalte auf die Seite kommen: importDatei und profilPruefen (Vorschau, Lehreransicht),
// die Maskierung der Platzhalter in tx und die Ausdrücke, mit denen app.js Zahlen aus fremden Profilen ausgibt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Z, frisch } from './umgebung.mjs';
import { tx, alsHtml } from '../js/sprache.js';
import { zahl, esc } from '../js/daten.js';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOESE = '<img src=x onerror=alert(document.domain)>';
const harmlos = s => !/[<>]/.test(s.replace(/<\/?(b|br|strong|em|span|small|p|i)\b[^<>]*>/g, ''));   // nur die Marken der Sprachdatei selbst

test('tx maskiert Platzhalterwerte: aus fremdem Text wird kein HTML (H3)', () => {
  for (const [k, w] of [['profilladen.tage', { kette: BOESE }], ['lehrer.hatma', { a: BOESE }], ['profil.hatmat_vollendet', { khatma: BOESE }],
    ['konto.karte_verbunden', { email: BOESE }], ['konto.fehler_allg', { text: BOESE }], ['lehrer.stand', { a: BOESE }], ['heute.hatma', { a: BOESE }]]) {
    const s = tx(k, w);
    assert.ok(harmlos(s), `${k}: ${s}`);
    assert.ok(s.includes('&lt;img'), `${k}: der Wert fehlt oder ist nicht maskiert`);
  }
  assert.equal(tx('konto.karte_verbunden', { email: 'a"b&c' }).includes('a&quot;b&amp;c'), true);
});

test('tx: Zahlen und Mehrzahlformen bleiben, alsHtml setzt bewusst fertiges HTML ein', () => {
  assert.ok(tx('profilladen.tage', { kette: 1 }).includes('1'));
  assert.notEqual(tx('profilladen.tage', { kette: 1 }), tx('profilladen.tage', { kette: 5 }));
  assert.ok(tx('konto.fehler_allg', { text: alsHtml('<b>x</b>') }).includes('<b>x</b>'));
  // schon maskierter Text wird, als HTML gekennzeichnet, nicht doppelt maskiert
  assert.ok(tx('konto.karte_verbunden', { email: alsHtml(esc('a&b')) }).includes('a&amp;b'));
  assert.ok(!tx('konto.karte_verbunden', { email: alsHtml(esc('a&b')) }).includes('&amp;amp;'));
  // ein Objekt ohne html-Text ist kein Freibrief
  assert.ok(harmlos(tx('lehrer.hatma', { a: { html: 5, toString: () => BOESE } })));
});

test('Manipulierte Datei aus dem Audit: Vorschau und Lehreransicht bekommen sie nie zu sehen', async () => {
  const boese = JSON.stringify({ format: 'itqan-profil', version: 1, exportiert: '2026-11-21T00:00:00Z', pruef: 'x',
    profil: { format: 'itqan', name: 'Schüler', kette: { n: BOESE }, summe: { abschnitte: 1 }, zyklus: { khatma: 0 }, tage: {} } });
  await assert.rejects(() => Z.importDatei(boese));
  // ein sonst gültiges Profil mit einem einzigen vergifteten Feld: abgelehnt beim Import und bei der Prüfung abgelegter Schülerdateien
  frisch();
  for (const gift of [p => { p.kette.n = BOESE; }, p => { p.zyklus.khatma = BOESE; }, p => { p.summe.punkte = BOESE; }, p => { p.erstellt = BOESE; }, p => { p.einst.erinnerung = BOESE; }]) {
    const p = JSON.parse(JSON.stringify(Z.P)); gift(p);
    assert.throws(() => Z.profilPruefen(p));
    await assert.rejects(() => Z.importDatei(JSON.stringify({ format: 'itqan-profil', version: 1, exportiert: '2026-11-21T00:00:00Z', pruef: 'x', profil: p })));
  }
});

test('Lehreransicht: die Ausdrücke für Zahlen machen aus fremdem Text eine Zahl, Namen laufen durch esc', () => {
  assert.equal(zahl(+BOESE || 0), zahl(0));
  assert.equal((+BOESE || 0) + 1, 1);
  assert.ok(harmlos(esc(BOESE)));
  const app = readFileSync(join(APP, 'js/app.js'), 'utf8');
  assert.ok(app.includes('zahl(+x.profil.kette?.n || 0)') && app.includes("(+x.profil.zyklus?.khatma || 0) + 1"), 'Lehreransicht gibt Zahlen nicht mehr als Zahl aus');
  assert.ok(/const gut = x => \{ try \{ return .*Z\.profilPruefen\(x\.profil\)/.test(app), 'Lehreransicht prüft abgelegte Dateien nicht');
  assert.ok(app.includes('esc(x.profil.name ||') && app.includes('esc(u.name ||'), 'Name ohne esc');
});

test('app.js: Tastenkürzel nur ohne Zusatztaste, asynchrone Ansichten prüfen ihre Laufnummer', () => {
  const app = readFileSync(join(APP, 'js/app.js'), 'utf8');
  assert.ok(app.includes('if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.repeat) return;'), 'Kürzel beim Üben ohne Prüfung der Zusatztasten');
  for (const f of ['ueben', 'mushaf', 'sucheSeite', 'aehnlichSeite', 'vergleichSeite', 'lehrer']) {
    const i = app.indexOf(`async function ${f}(`); assert.ok(i > 0, f);
    const j = app.indexOf('\nasync function ', i + 10), k = app.indexOf('\nfunction ', i + 10), ende = Math.min(...[j, k].filter(x => x > 0));
    assert.ok(/ansichtGilt\(lauf0?\)/.test(app.slice(i, ende)), `${f} prüft nach dem Laden nicht, ob die Ansicht noch gilt`);
  }
  // Nach-Audit 2.00, Plattform N1: „Neu laden“ löscht keinen Vorrat und meldet den Worker nicht ab (sonst startet die App danach offline nicht mehr)
  assert.ok(!app.includes('caches.delete') && !app.includes('.unregister('), '„Neu laden“ löscht einen Vorrat oder meldet den Worker ab');
  assert.ok(/async function neuLadenFrisch\(\) \{[^}]*\.update\?\.\(\)[\s\S]{0,200}location\.reload\(\)/.test(app) && app.includes("querySelector('#fe-neu').onclick = neuLadenFrisch"), '„Neu laden“ prüft den Worker und lädt neu');
});
