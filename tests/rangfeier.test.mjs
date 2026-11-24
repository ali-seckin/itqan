// Itqān · Tests zur Freischaltung eines neuen Ranges (js/rangfeier.js): erscheint je Rang genau einmal, auch nach Neuladen und Abgleich;
// Reihenfolge, Fehlerfälle, Merker im Profil (abwärtskompatibel), Texte in allen Sprachen, Regeln für reduzierte Bewegung
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Z, D, frisch } from './umgebung.mjs';
const RF = await import('../js/rangfeier.js');
const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const lies = p => readFileSync(join(APP, p), 'utf8');
const rang = r => ({ typ: 'rang', r });
// Attrappe für die Ansicht: merkt sich die Reihenfolge, endet wie die echte erst nach dem „Schließen“
const attrappe = (fehlerBei = []) => { const g = []; return { g, zeigen: async r => { g.push(['auf', r]); await Promise.resolve(); if (fehlerBei.includes(r)) throw new Error('Ansicht kaputt'); g.push(['zu', r]); } }; };
const stumm = async fn => { const w = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = w; } };

test('ausstehend: nur gültige Ränge über dem gemerkten, aufsteigend, ohne Doppelte', () => {
  assert.deepEqual(RF.ausstehend([rang(3), rang(1), rang(3), { typ: 'wird' }, { typ: 'ornament', s: 5 }], 0), [1, 3]);
  assert.deepEqual(RF.ausstehend([rang(1), rang(2), rang(3)], 2), [3]);
  assert.deepEqual(RF.ausstehend([rang(2)], 2), []);
  assert.deepEqual(RF.ausstehend([rang(0), rang(-1), rang(1.5), rang('2'), rang(NaN), rang(Z.RAENGE.length), rang(Z.RAENGE.length - 1)], 0), [Z.RAENGE.length - 1]);
  assert.deepEqual(RF.ausstehend(undefined, 0), []); assert.deepEqual(RF.ausstehend(null), []); assert.deepEqual(RF.ausstehend('rang'), []);
  assert.deepEqual(RF.ausstehend([null, undefined, 5, 'x', rang(1)], undefined), [1]);
  assert.deepEqual(RF.ausstehend([rang(1)], 'viel'), [1], 'ein kaputter Merker zählt wie 0');
});

test('Merker: nur aufwärts, fehlendes Feld gilt als 0, Unsinn wird nie geschrieben', () => {
  const P = {};
  assert.equal(RF.gesehenLesen(P), -1); assert.equal(RF.gesehenLesen(null), -1); assert.equal(RF.gesehenLesen({ rangGesehen: 'x' }), -1); assert.equal(RF.gesehenLesen({ rangGesehen: -3 }), -1); assert.equal(RF.gesehenLesen({ rangGesehen: 0 }), 0);
  assert.equal(RF.gesehenMerken(P, 2), true); assert.equal(P.rangGesehen, 2);
  assert.equal(RF.gesehenMerken(P, 2), false); assert.equal(RF.gesehenMerken(P, 1), false); assert.equal(P.rangGesehen, 2);
  assert.equal(RF.gesehenMerken(P, 4), true); assert.equal(P.rangGesehen, 4);
  for (const x of ['5', 1.5, NaN, null, undefined]) { assert.equal(RF.gesehenMerken(P, x), false); assert.equal(P.rangGesehen, 4); }
  assert.equal(RF.gesehenMerken(null, 1), false); assert.equal(RF.gesehenMerken(undefined, 1), false);
});

test('Echter Aufstieg: das Ereignis entsteht einmal, die Freischaltung wird einmal gezeigt', async () => {
  frisch({ pensum: 3 });
  Z.P.summe.punkte = 990;                       // knapp unter Rang 2 (Murīd, 1000 Punkte)
  assert.equal(Z.rangJetzt(), -1);
  const id = Z.tagesplan().plan[0];
  const res = Z.abschnittAbschliessen(id, Array.from({ length: D.A[id].ayat }, () => 'ok'));
  const rangs = res.ereignisse.filter(x => x.typ === 'rang');
  assert.deepEqual(rangs, [rang(1)], 'ein Rang-Ereignis');
  assert.equal(Z.P.rangBeste.r, 1);
  assert.equal(Z.P.rangGesehen, undefined, 'das Profil trägt den Merker erst, wenn die Freischaltung gezeigt wird');
  const a = attrappe(); let gespeichert = 0;
  const gezeigt = await RF.feiern(res.ereignisse, { P: Z.P, speichern: () => { gespeichert++; Z.speichern(); }, zeigen: a.zeigen });
  assert.deepEqual(gezeigt, [1]); assert.deepEqual(a.g, [['auf', 1], ['zu', 1]]);
  assert.equal(Z.P.rangGesehen, 1); assert.equal(gespeichert, 1);
  // der Merker steht im gespeicherten Profil
  assert.equal(JSON.parse(localStorage.getItem('itqan-profil-v1')).rangGesehen, 1);
  // dieselben Ereignisse noch einmal (zweiter Aufruf, zweite Abschlussseite): nichts
  const b = attrappe();
  assert.deepEqual(await RF.feiern(res.ereignisse, { P: Z.P, speichern: () => Z.speichern(), zeigen: b.zeigen }), []); assert.deepEqual(b.g, []);
  // Neuladen der App: das Profil kommt aus dem Speicher, der Merker bleibt
  Z.laden(); assert.equal(Z.P.rangGesehen, 1);
  assert.deepEqual(await RF.feiern(res.ereignisse, { P: Z.P, speichern: () => Z.speichern(), zeigen: b.zeigen }), []);
  // weiteres Üben auf demselben Rang erzeugt kein neues Ereignis
  const id2 = Z.tagesplan().plan[1];
  const res2 = Z.abschnittAbschliessen(id2, Array.from({ length: D.A[id2].ayat }, () => 'ok'));
  assert.equal(res2.ereignisse.some(x => x.typ === 'rang'), false);
});

test('Nach einem Abgleich mit dem Konto: ein Profil ohne oder mit älterem Merker zeigt nur, was höher ist', async () => {
  const a = attrappe();
  // Stand vom Konto ohne das Feld (anderes Gerät, älteres Profil): der Aufstieg wird einmal gezeigt, danach nicht mehr
  const P = { rangBeste: { r: 1, d: '2026-01-05' } };
  assert.deepEqual(await RF.feiern([rang(1)], { P, speichern() {}, zeigen: a.zeigen }), [1]);
  assert.deepEqual(await RF.feiern([rang(1)], { P, speichern() {}, zeigen: a.zeigen }), []);
  // senkt ein Abgleich den Rang und wird er später wieder erreicht, bleibt es dabei: rangGesehen wird nie gesenkt
  P.rangBeste = { r: 0, d: null };
  assert.deepEqual(await RF.feiern([rang(1)], { P, speichern() {}, zeigen: a.zeigen }), []);
  assert.deepEqual(await RF.feiern([rang(2)], { P, speichern() {}, zeigen: a.zeigen }), [2]);
  assert.equal(P.rangGesehen, 2);
});

test('Mehrere Ränge in einem Abschluss: nacheinander, aufsteigend, der nächste erst nach dem Schließen des vorigen', async () => {
  const P = {}, a = attrappe();
  const g = await RF.feiern([rang(3), { typ: 'wird' }, rang(1), rang(2), rang(2)], { P, speichern() {}, zeigen: a.zeigen });
  assert.deepEqual(g, [1, 2, 3]);
  assert.deepEqual(a.g, [['auf', 1], ['zu', 1], ['auf', 2], ['zu', 2], ['auf', 3], ['zu', 3]]);
  assert.equal(P.rangGesehen, 3);
});

test('Fehlerfälle: kaputte Ansicht, kaputtes Speichern, fehlendes Profil, leere Ereignisse: kein Absturz, der Rest läuft weiter', async () => {
  await stumm(async () => {
    const P = {}, a = attrappe([1]);
    assert.deepEqual(await RF.feiern([rang(1), rang(2)], { P, speichern() {}, zeigen: a.zeigen }), [2], 'die kaputte Ansicht stoppt den zweiten Rang nicht');
    assert.equal(P.rangGesehen, 2);
    const Q = {}, b = attrappe();
    assert.deepEqual(await RF.feiern([rang(1)], { P: Q, speichern() { throw new Error('Speicher voll'); }, zeigen: b.zeigen }), [1], 'Speichern scheitert: gezeigt wird trotzdem');
    assert.deepEqual(await RF.feiern([rang(1)], { P: null, speichern() {}, zeigen: b.zeigen }), []);
    assert.deepEqual(await RF.feiern([], { P: {}, zeigen: b.zeigen }), []);
    assert.deepEqual(await RF.feiern(undefined, { P: {}, zeigen: b.zeigen }), []);
    assert.deepEqual(await RF.feiern([rang(1)], { P: {}, zeigen: () => { throw new Error('sofort'); } }), [], 'synchron werfende Ansicht');
    assert.deepEqual(await RF.feiern([rang(1)], { P: {}, zeigen: () => Promise.reject(new Error('abgelehnt')) }), []);
    // die echte Ansicht ohne Dokument (Node) oder mit ungültigem Rang endet ohne Fehler mit false
    for (const r of [1, 0, 99, 'x', undefined]) assert.equal(await RF.zeigen(r), false, String(r));
  });
});

test('Profilformat: rangGesehen darf fehlen, gültige Werte gehen durch, Unsinn wird abgelehnt', () => {
  frisch(); const kopie = x => JSON.parse(JSON.stringify(x));
  assert.equal('rangGesehen' in Z.P, false, 'ein neues Profil trägt das Feld nicht');
  assert.doesNotThrow(() => Z.profilPruefen(kopie(Z.P)));
  for (const gut of [0, 1, 12]) { const p = kopie(Z.P); p.rangGesehen = gut; assert.doesNotThrow(() => Z.profilPruefen(p), String(gut)); }
  for (const schlecht of ['2', -1, 1.5, 101, [], {}, '<b>x</b>']) { const p = kopie(Z.P); p.rangGesehen = schlecht; assert.throws(() => Z.profilPruefen(kopie(p)), JSON.stringify(schlecht)); }
  // ältere Dateien ohne das Feld laden sich unverändert
  const alt = kopie(Z.P); delete alt.rangGesehen; Z.profilPruefen(alt); assert.equal(RF.gesehenLesen(Z.ergaenzen(alt)), -1);
});

test('Emblem: zwölf Bögen für die Ränge 1 bis 12 (Rang 1 den ersten), bei Rang 13 alle und der innere Kreis; höhere Ränge bekommen mehr Gold', () => {
  for (let r = 0; r < Z.RAENGE.length; r++) {
    const s = RF.emblem(r), an = Math.min(r + 1, 12);
    assert.equal((s.match(/class="rf-z rf-bogen an"/g) || []).length, an, `Rang ${r + 1}: Bögen an`);
    assert.equal((s.match(/class="rf-z rf-bogen"/g) || []).length, 12 - an);
    assert.equal((s.match(/rf-rand dunn an"/g) || []).length, r === 12 ? 1 : 0, `Rang ${r + 1}: der innere Kreis leuchtet nur bei Rang 13`);
    assert.equal((s.match(/rf-stern/g) || []).length, RF.stufeVon(r) >= 3 ? 4 : RF.stufeVon(r) >= 2 ? 2 : 0, `Sterne bei Rang ${r}`);
    assert.ok(!/NaN|undefined/.test(s));
  }
  assert.deepEqual([1, 3, 4, 6, 7, 9, 10, 12].map(RF.stufeVon), [1, 1, 2, 2, 3, 3, 4, 4]);
});

test('Mubtadiʾ: das erste erfüllte Tagesziel (alle geplanten Abschnitte) ist das Rang-Ereignis, vorher kein Rang; die Freischaltung merkt Rang 0', async () => {
  frisch({ pensum: 3 });
  assert.equal(Z.P.rangBeste, undefined); assert.equal(RF.gesehenLesen(Z.P), -1); assert.equal(Z.rangJetzt(), -1);
  const plan = Z.tagesplan().plan, abschl = id => Z.abschnittAbschliessen(id, Array.from({ length: D.A[id].ayat }, () => 'ok'));
  assert.ok(plan.length >= 2, 'das Pensum hat mehrere Abschnitte');
  for (const id of plan.slice(0, -1)) assert.deepEqual(abschl(id).ereignisse.filter(x => x.typ === 'rang'), [], 'noch kein Rang vor dem Ende des Tagesziels');
  assert.equal(Z.rangJetzt(), -1); assert.equal(Z.P.rangBeste, undefined);
  const res = abschl(plan[plan.length - 1]);
  assert.deepEqual(res.ereignisse.filter(x => x.typ === 'rang'), [rang(0)], 'der letzte geplante Abschnitt erfüllt das Tagesziel: Mubtadiʾ');
  assert.equal(Z.rangJetzt(), 0); assert.equal(Z.P.rangBeste.r, 0);
  const a = attrappe();
  assert.deepEqual(await RF.feiern(res.ereignisse, { P: Z.P, speichern: () => Z.speichern(), zeigen: a.zeigen }), [0]);
  assert.deepEqual(a.g, [['auf', 0], ['zu', 0]]); assert.equal(Z.P.rangGesehen, 0);
  assert.deepEqual(await RF.feiern([rang(0)], { P: Z.P, zeigen: a.zeigen }), [], 'nicht noch einmal');
});

test('Texte: der Abschnitt rangfeier steht in allen sieben Sprachen, gleiche Schlüssel, ohne Gedankenstriche', () => {
  const codes = readdirSync(join(APP, 'js/sprache')).filter(f => f.endsWith('.js')).map(f => f.slice(0, -3));
  assert.equal(codes.length, 7);
  const block = c => lies(`js/sprache/${c}.js`).match(/^  rangfeier: \{([\s\S]*?)^  \},/m);
  const schluessel = [...block('de')[1].matchAll(/^\s+(\w+):/gm)].map(m => m[1]);
  assert.deepEqual(schluessel, ['titel', 'ueberspringen', 'ansehen']);
  for (const c of codes) {
    const m = block(c); assert.ok(m, `${c}: Abschnitt rangfeier fehlt`);
    assert.deepEqual([...m[1].matchAll(/^\s+(\w+): '([^']+)'/gm)].map(x => x[1]), schluessel, c);
    assert.ok(!/[–—]/.test(m[1]), `${c}: Gedankenstrich`);
  }
  assert.ok(!/[–—]/.test(lies('js/rangfeier.js')), 'Gedankenstrich in js/rangfeier.js');
});

test('Bewegung reduziert: eigene Regeln ohne Zeichnen, Aufsteigen und Wellen; Endzustand beim Überspringen; nur transform und opacity bewegt', () => {
  const css = lies('css/itqan.css'), teil = css.slice(css.indexOf('/* Rangfeier 2.05 */'));
  assert.ok(teil.length > 500);
  assert.match(teil, /\.rf-ruhig \.rf-z,\.rf-ruhig \.rf-fuell,\.rf-ruhig \.rf-abz\{animation:none\}/);
  assert.match(teil, /\.rf-ruhig \.rf-funken,\.rf-ruhig \.rf-welle[^{]*\{display:none\}/);
  assert.match(teil, /@media \(prefers-reduced-motion:reduce\)\{[^@]*\.rf-funken[^@]*display:none/);
  assert.match(teil, /\.rf\.rf-fertig \.rf-emblem[^{]*\{animation-duration:\.001s!important/);
  const alle = [...teil.matchAll(/@keyframes (rf\w+)\{((?:[^{}]|\{[^{}]*\})*)\}/g)];
  assert.ok(alle.length >= 8, 'Keyframes gefunden');
  for (const [, name, inhalt] of alle) {
    for (const e of new Set([...inhalt.matchAll(/([a-z-]+):/g)].map(m => m[1]))) assert.ok(['opacity', 'transform', 'stroke-dashoffset'].includes(e), `${name} animiert ${e}`);
  }
});

test('Verdrahtung: Datei im Offline-Vorrat, dynamisch geladen, nicht statisch importiert', () => {
  assert.match(lies('sw.js'), /'js\/rangfeier\.js'/);
  assert.match(lies('js/app.js'), /import\('\.\/rangfeier\.js'\)/);
  assert.doesNotMatch(lies('js/app.js'), /^import .*rangfeier/m);
  assert.doesNotMatch(lies('index.html'), /rangfeier/);
});
