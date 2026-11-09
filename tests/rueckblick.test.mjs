// Itqān · Tests zum Rückblick (Woche und Monat als Bild): Zeiträume, Zahlen, Tagesstände, Texte, Zeichnung
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Z, D, frisch, tagSetzen, naechsterTag, wirdErfuellen } from './umgebung.mjs';
const RB = await import('../js/rueckblick.js');
const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const staende = R => R.tage.map(t => t.stand).join(' ');
// nur den ersten Abschnitt des heutigen Plans abschließen
const einenAbschnitt = () => { const t = Z.tagesplan(), id = t.plan[0]; Z.abschnittAbschliessen(id, Array.from({ length: D.A[id].ayat }, () => 'ok')); };

test('Zeitraum: Woche von Montag bis Sonntag, auch über Monat und Jahr hinweg', () => {
  assert.deepEqual(Z.zeitraum('woche', 0, '2026-11-10'), { art: 'woche', von: '2026-11-09', bis: '2026-11-15' });
  assert.deepEqual(Z.zeitraum('woche', 0, '2026-11-09'), { art: 'woche', von: '2026-11-09', bis: '2026-11-15' });
  assert.deepEqual(Z.zeitraum('woche', 0, '2026-11-15'), { art: 'woche', von: '2026-11-09', bis: '2026-11-15' });
  assert.deepEqual(Z.zeitraum('woche', 1, '2026-11-10'), { art: 'woche', von: '2026-11-02', bis: '2026-11-08' });
  assert.deepEqual(Z.zeitraum('woche', 0, '2026-01-01'), { art: 'woche', von: '2025-12-29', bis: '2026-01-04' });
  assert.deepEqual(Z.zeitraum('woche', 2, '2026-03-03'), { art: 'woche', von: '2026-02-16', bis: '2026-02-22' });
});

test('Zeitraum: Kalendermonat mit Februar, Schaltjahr und Jahreswechsel', () => {
  assert.deepEqual(Z.zeitraum('monat', 0, '2026-03-15'), { art: 'monat', von: '2026-03-01', bis: '2026-03-31' });
  assert.deepEqual(Z.zeitraum('monat', 1, '2026-03-31'), { art: 'monat', von: '2026-02-01', bis: '2026-02-28' });
  assert.deepEqual(Z.zeitraum('monat', 1, '2028-03-31'), { art: 'monat', von: '2028-02-01', bis: '2028-02-29' });
  assert.deepEqual(Z.zeitraum('monat', 1, '2026-01-10'), { art: 'monat', von: '2025-12-01', bis: '2025-12-31' });
  assert.deepEqual(Z.zeitraum('monat', 14, '2026-03-15'), { art: 'monat', von: '2025-01-01', bis: '2025-01-31' });
});

test('Frisches Profil: leerer, laufender Rückblick ohne Zeitraum davor', () => {
  frisch();
  const R = Z.rueckblick('woche', 0);
  assert.equal(R.von, '2026-01-05'); assert.equal(R.bis, '2026-01-11');
  assert.equal(R.leer, true); assert.equal(R.laufend, true); assert.equal(R.frueher, false);
  assert.equal(R.kette, 0); assert.equal(R.ayat, 0); assert.equal(R.quote, null);
  assert.equal(staende(R), 'offen offen offen offen offen offen offen');
  assert.equal(staende(Z.rueckblick('woche', 1)), 'vor vor vor vor vor vor vor');
  assert.deepEqual(RB.beschreibung(R).slice(1), ['In diesem Zeitraum wurde nicht geübt.']);
});

test('Summen: die Wochen ergeben zusammen genau die Zahlen des Profils', () => {
  frisch();
  for (let i = 0; i < 10; i++) { wirdErfuellen((j, id) => (j + id) % 9 === 0 ? 'fehler' : (j + id) % 7 === 0 ? 'hilfe' : 'ok'); if (i < 9) naechsterTag(); }
  const a = Z.rueckblick('woche', 1), b = Z.rueckblick('woche', 0), S = Z.P.summe;
  assert.equal(a.r + b.r, S.r); assert.equal(a.f + b.f, S.f); assert.equal(a.h + b.h, S.h);
  assert.equal(a.punkte + b.punkte, S.punkte); assert.equal(a.hasanat + b.hasanat, S.hasanat);
  assert.equal(a.abschnitte + b.abschnitte, S.abschnitte);
  assert.equal(a.ayat, a.r + a.f + a.h);
  assert.equal(a.ayat, a.tage.reduce((s, t) => s + t.ayat, 0));
  assert.equal(a.geuebt, 7); assert.equal(a.voll, 7); assert.equal(a.wird, 7); assert.equal(a.folge, 7);
  assert.equal(b.geuebt, 3); assert.equal(b.vor.ayat, a.ayat); assert.equal(b.vor.abschnitte, a.abschnitte);
  assert.equal(a.laufend, false); assert.equal(a.kette, null); assert.equal(b.laufend, true); assert.equal(b.kette, 10);
  assert.equal(a.frueher, false); assert.equal(b.frueher, true);
  assert.ok(Math.abs(a.quote - 100 * a.r / a.ayat) < 1e-9);
  assert.ok(Math.abs(a.seiten - a.zeilen / 15) < 1e-9);
  assert.equal(a.bester.ayat, Math.max(...a.tage.map(t => t.ayat)));
  // der Monat enthält beide Wochen
  const m = Z.rueckblick('monat', 0);
  assert.equal(m.ayat, a.ayat + b.ayat); assert.equal(m.tage.length, 31);
});

test('Tagesstände: erfüllt, zum Teil, nachgeholt, ausgefallen, Ruhetag, offen', () => {
  frisch();
  Z.P.einst.pensum[4] = 0;                 // Freitag ist Ruhetag
  wirdErfuellen();                         // Montag: erfüllt
  naechsterTag(); einenAbschnitt();        // Dienstag: nur ein Abschnitt von dreien
  assert.equal(staende(Z.rueckblick('woche', 0)), 'voll teil offen offen offen offen offen');
  naechsterTag();
  const mi = Z.tagesplan();
  assert.ok(mi.qadaa > 0, 'am Mittwoch steht der Dienstag als Qaḍāʾ im Plan');
  wirdErfuellen();                         // Mittwoch: erfüllt samt Qaḍāʾ, der Dienstag gilt als nachgeholt
  naechsterTag(3);                         // Donnerstag ausgefallen, Freitag Ruhetag, heute ist Samstag
  const R = Z.rueckblick('woche', 0);
  assert.equal(staende(R), 'voll nach voll aus ruhe offen offen');
  assert.equal(R.voll, 3); assert.equal(R.nach, 1); assert.equal(R.wird, 4); assert.equal(R.geuebt, 3); assert.equal(R.folge, 3);
  assert.deepEqual(RB.kacheln(R)[0], ['3 von 4', 'Wird erfüllt']);
  assert.ok(RB.beschreibung(R).some(s => s.includes('an 3 von 4 Tagen erfüllt, davon 1 am Tag danach nachgeholt')));
  // ein halber Tag, der nicht nachgeholt wird, bleibt „zum Teil“
  einenAbschnitt(); naechsterTag(2);       // Samstag halb, Sonntag nichts, heute Montag
  assert.equal(staende(Z.rueckblick('woche', 1)), 'voll nach voll aus ruhe teil aus');
});

test('Erreichtes: Rang, Ḫatma, Kette und Ornamente zählen nur im eigenen Zeitraum', () => {
  frisch();
  for (let i = 0; i < 9; i++) { wirdErfuellen(); naechsterTag(); }
  wirdErfuellen();
  Object.assign(Z.P.meilenD, { 'sure-gefestigt-112': '2026-01-06', 'sure-gefestigt-113': '2026-01-07', 'sure-mutqan-114': '2026-01-08', 'khatma-1': '2026-01-09', 'kette-7': '2026-01-11', 'kette-3': '2026-01-07', 'sure-gefestigt-1': '2026-01-13' });
  Z.P.rangBeste = { r: 2, d: '2026-01-10' };
  const a = Z.rueckblick('woche', 1), b = Z.rueckblick('woche', 0);
  assert.deepEqual(a.neu, { ornamente: 2, vergoldet: 1, kette: 7, khatma: 1, rang: 2 });
  assert.deepEqual(b.neu, { ornamente: 1, vergoldet: 0, kette: 0, khatma: 0, rang: 0 });
  assert.deepEqual(RB.ereignisse(a), [`Neuer Rang: ${Z.RAENGE[2].n}`, 'Ḫatma vollendet', 'Kette von 7 Tagen erreicht', '2 neue Ornamente', '1 Ornament vergoldet']);
  assert.deepEqual(RB.ereignisse(b), ['1 neues Ornament']);
  assert.ok(RB.beschreibung(a).some(s => s.startsWith('Erreicht: Neuer Rang')));
  // die laufende Woche wird nicht als „weniger“ gemeldet, eine abgeschlossene schon
  assert.ok(!RB.beschreibung(b).some(s => s.includes('weniger')));
  naechsterTag(7);
  const c = Z.rueckblick('woche', 1);
  assert.ok(c.ayat < c.vor.ayat);
  assert.ok(RB.beschreibung(c).some(s => /Āyāt weniger als in der Woche davor \(\d/.test(s)));
});

test('Texte: Titel, Seiten, Dauer, Dateiname', () => {
  const T = (art, von, bis) => RB.zeitraumTitel({ art, von, bis });
  assert.equal(T('woche', '2026-01-05', '2026-01-11'), '5. bis 11. Januar 2026');
  assert.equal(T('woche', '2026-01-26', '2026-02-01'), '26. Januar bis 1. Februar 2026');
  assert.equal(T('woche', '2025-12-29', '2026-01-04'), '29. Dezember 2025 bis 4. Januar 2026');
  assert.equal(T('monat', '2026-08-01', '2026-08-31'), 'August 2026');
  assert.equal(RB.seitenText(0.5), 'weniger als 1 Seite');
  assert.equal(RB.seitenText(1.1), 'etwa 1 Seite');
  assert.equal(RB.seitenText(2.4), 'etwa 2,5 Seiten');
  assert.match(RB.seitenText(12.3), /^etwa 12 Seiten$/);
  assert.equal(RB.dauerText(20), '1 min');
  assert.equal(RB.dauerText(600), '10 min');
  assert.equal(RB.dauerText(3900), '1 h 5 min');
  assert.equal(RB.dateiName({ art: 'woche', von: '2026-01-05' }), 'Itqan-Rueckblick-2026-01-05.png');
  assert.equal(RB.dateiName({ art: 'monat', von: '2026-08-01' }, 'Ali S.'), 'Itqan-Rueckblick-2026-08-Ali_S_.png');
});

// Zeichenfläche nachbilden: jede Eigenschaft lässt sich setzen, jeder Aufruf geht ins Leere, Texte werden mitgeschrieben
function leinwand() {
  const texte = [], st = { font: '10px x', textAlign: 'left' };
  const breite = t => String(t).length * (parseFloat(st.font.match(/([\d.]+)px/)?.[1] || 10)) * 0.5;
  const c = new Proxy(st, {
    get: (o, k) => k in o ? o[k]
      : k === 'measureText' ? t => ({ width: breite(t) })
      : k === 'fillText' ? (t, x, y) => texte.push({ t: String(t), x, y, b: breite(t), a: o.textAlign })
      : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} })
      : () => {},
    set: (o, k, v) => { o[k] = v; return true; }
  });
  return { cv: { getContext: () => c, width: 0, height: 0 }, texte };
}
globalThis.Path2D ??= class { constructor() {} };
const FARBEN = { dunkel: false, bg: '#fff', licht: '#fff', text: '#000', leise: '#666', akzent: '#850', linie: '#850', auf: '#fff', z1: '#850', z2: '#530', flaeche: '#eee', rand: '#ccc' };
function bildPruefen(R, name) {
  const { cv, texte } = leinwand();
  assert.equal(RB.zeichnen(cv, R, FARBEN, name), cv);
  assert.equal(cv.width, 1080); assert.equal(cv.height, 1350);
  for (const x of texte) {
    const links = x.a === 'center' ? x.x - x.b / 2 : x.a === 'right' ? x.x - x.b : x.x, rechts = links + x.b;
    assert.ok(links >= 42 && rechts <= 1038, `„${x.t}“ ragt aus dem Rahmen (${Math.round(links)} bis ${Math.round(rechts)})`);
    assert.ok(x.y >= 60 && x.y <= 1290, `„${x.t}“ steht zu hoch oder zu tief (${Math.round(x.y)})`);
  }
  const fuss = texte.at(-1);
  assert.match(fuss.t, /^Itqān · die Murāǧaʿa/); assert.equal(fuss.y, 1272);
  // alles über dem Fuß endet oberhalb der Fußlinie
  for (const x of texte.slice(0, -1)) assert.ok(x.y <= 1228, `„${x.t}“ reicht in den Fuß (${Math.round(x.y)})`);
  return texte;
}
const viel = R => ({ ...R, neu: { ornamente: 12, vergoldet: 3, kette: 30, khatma: 2, rang: 3 } });

test('Bild: Woche und Monat mit fünf und sechs Kalenderzeilen bleiben im Rahmen, auch mit vielen Ereignissen', () => {
  frisch({ datum: '2026-07-27' });
  Z.P.einst.pensum[4] = 0;
  for (let i = 0; i < 68; i++) {            // bis Ende September, mit einem ausgefallenen und einem halben Tag je Woche
    const wt = i % 7;
    if (wt === 2) einenAbschnitt(); else if (wt !== 5) wirdErfuellen();
    naechsterTag();
  }
  assert.equal(Z.heute(), '2026-10-03');
  const woche = Z.rueckblick('woche', 1), august = Z.rueckblick('monat', 2), september = Z.rueckblick('monat', 1), leer = Z.rueckblick('monat', 5);
  assert.equal(august.von, '2026-08-01'); assert.equal(september.tage.length, 30); assert.equal(leer.leer, true);
  for (const [R, name] of [[woche, ''], [woche, 'Ein sehr langer Name mit vielen Wörtern, der nicht in eine Zeile passt'], [viel(woche), 'Ali'], [august, 'Ali'], [viel(august), 'Ali'], [september, ''], [viel(september), 'Ali'], [leer, '']]) {
    const texte = bildPruefen(R, name);
    assert.ok(texte.some(x => x.t === RB.zeitraumTitel(R)));
    if (!R.leer) assert.ok(texte.some(x => x.t === 'Wird erfüllt') && texte.some(x => x.t === 'Itqān-Punkte'));
  }
  // der August 2026 beginnt an einem Samstag: sechs Kalenderzeilen, und es bleibt Platz für mindestens ein Ereignis
  const texte = bildPruefen(viel(august), 'Ali');
  assert.ok(texte.some(x => x.t.startsWith('Neuer Rang')));
  assert.equal(texte.filter(x => /^\d+$/.test(x.t) && x.a === 'center' && +x.t >= 1 && +x.t <= 31).length >= 31, true);
});

test('Texte ohne Gedankenstriche, Rückblick im App-Gerüst und in den Neuigkeiten', async () => {
  frisch();
  for (let i = 0; i < 9; i++) { wirdErfuellen((j) => j % 11 === 0 ? 'fehler' : 'ok'); naechsterTag(); }
  for (const R of [Z.rueckblick('woche', 0), Z.rueckblick('woche', 1), Z.rueckblick('monat', 0)]) {
    const alles = [RB.zeitraumTitel(R), RB.unterzeile(R), ...RB.beschreibung(R, 'Test'), ...RB.ereignisse(R), ...RB.kacheln(R).flat()].join(' ');
    assert.ok(!/[–—]/.test(alles), alles);
  }
  const sw = readFileSync(join(APP, 'sw.js'), 'utf8');
  assert.ok(sw.includes("'js/rueckblick.js'"), 'rueckblick.js fehlt im App-Gerüst');
  const { NEUIGKEITEN } = await import('../js/version.js');
  assert.ok(NEUIGKEITEN.some(n => n.punkte.some(p => p.includes('Rückblick'))));
  const app = readFileSync(join(APP, 'js/app.js'), 'utf8');
  assert.ok(app.includes('rueckblick: rueckblickSeite') && app.includes('#rueckblick'));
});
