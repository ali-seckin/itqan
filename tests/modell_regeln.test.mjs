// Itqān · Regeln des Lernmodells nach dem Audit 1.99: Kontrolle bei jedem Pensum, Umlauf, Regime, Numerik, Dauer einer Ḫatma
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as LM from '../js/lernmodell.js';
import { Z, D, frisch, naechsterTag, wirdErfuellen } from './umgebung.mjs';

const reihe = n => Array.from({ length: n }, (_, i) => i);
const karte = (zul, S = 25, kon = null) => ({ S, zul, n: 1, kon });
const ok = id => Array(D.A[id].ayat).fill('ok');

test('Kontrolle: außerhalb des Umlaufs bei jedem Pensum ein Platz innerhalb des Pensums (Audit H1)', () => {
  for (const n of [1, 2, 3]) {
    const e = LM.planen({ karten: { 5: karte(99, 1, 100) }, reihe: reihe(120), tag: 100, n });
    assert.equal(e.plan.length, n);
    assert.deepEqual(e.plan[0], { id: 5, art: 'kontrolle' });
  }
});

test('Kontrolle im Umlauf: sie kommt zum Pensum hinzu, die Erstprüfung behält ihre Plätze (Audit H1)', () => {
  for (const n of [1, 2]) {
    const karten = { 5: karte(99, 1, 100), 6: karte(99, 1, 100) };
    const e = LM.planen({ karten, reihe: reihe(739), tag: 100, n });
    assert.equal(e.plan.length, n + 1, 'ein Platz mehr');
    assert.deepEqual(e.plan[0], { id: 5, art: 'kontrolle' });
    assert.equal(e.plan.filter(x => x.art === 'erst').length, n);
    // ohne Zusatz („ein Abschnitt mehr“) bleibt es bei n, die Kontrolle hat trotzdem Vorrang
    const s = LM.planen({ karten, reihe: reihe(739), tag: 100, n, zusatz: false });
    assert.equal(s.plan.length, n); assert.equal(s.plan[0].id, 5);
    // ohne Kontrolle bleibt der Plan beim Pensum
    assert.equal(LM.planen({ karten: { 5: karte(99, 1) }, reihe: reihe(739), tag: 100, n }).plan.length, n);
  }
});

test('Kontrollen: die älteste zuerst', () => {
  const e = LM.planen({ karten: { 3: karte(99, 1, 100), 9: karte(97, 1, 98) }, reihe: reihe(120), tag: 100, n: 3 });
  assert.deepEqual(e.plan[0], { id: 9, art: 'kontrolle' });
  const acht = LM.planen({ karten: { 3: karte(99, 1, 100), 9: karte(97, 1, 98) }, reihe: reihe(120), tag: 100, n: 8 });
  assert.deepEqual(acht.plan.slice(0, 2).map(x => x.id), [9, 3], 'bei Pensum 8 haben zwei Kontrollen Vorrang');
});

test('Umlauf: Fälliges ohne Kontrolle bekommt keinen eigenen Platz, kommt aber nach dem Durchlauf als Ältestes zuerst', () => {
  const erst = LM.planen({ karten: { 0: karte(10, 3) }, reihe: reihe(739), tag: 400, n: 1 });
  assert.deepEqual(erst.plan, [{ id: 1, art: 'erst' }]);
  const alle = {}; for (const id of reihe(739)) alle[id] = karte(id === 0 ? 5 : 10 + id);
  const danach = LM.planen({ karten: alle, reihe: reihe(739), tag: 800, n: 1, kz: 0 });
  assert.equal(danach.plan[0].id, 0);
});

test('Regime: es hängt am üblichen Pensum, nicht am Pensum des einzelnen Tages (Audit M6, N3)', () => {
  const karten = { 0: karte(10, 3) };   // längst fällig
  const halb = LM.planen({ karten, reihe: reihe(739), tag: 400, n: 2, nRegime: 4 });
  assert.ok(halb.plan.some(x => x.id === 0), 'halbes Pensum im Wiedereinstieg: Fälliges bleibt im Plan');
  const einer = LM.planen({ karten, reihe: reihe(739), tag: 400, n: 1, nRegime: 5, zusatz: false });
  assert.equal(einer.plan[0].id, 0, 'ein Abschnitt mehr: der fällige, nicht die Erstprüfung');
  const umlauf = LM.planen({ karten, reihe: reihe(739), tag: 400, n: 2 });
  assert.ok(!umlauf.plan.some(x => x.id === 0));
});

test('Numerik: kein NaN bei S = 0 oder fehlendem S, ein Ausfall hebt die Stabilität nach einer Lektion nicht an (Audit N5)', () => {
  assert.equal(LM.abruf(0, 0), 0); assert.equal(LM.abruf(1, undefined), 0); assert.equal(LM.abruf(-5, 10), 1);
  for (const S of [0, undefined, NaN]) for (const f of [0, 3]) {
    const k = LM.nachUebung({ n: 2, S, zul: 90, kon: null }, 100, { v: 7, f, z: 0 });
    assert.ok(Number.isFinite(k.S) && k.S > 0, `S ${S}, Fehler ${f}: ${k.S}`);
  }
  const k = LM.nachUebung({ n: 1, S: LM.PAR.sLern, zul: 99, kon: 100 }, 100, { v: 7, f: 7, z: 0 });
  assert.ok(k.S <= LM.PAR.sLern);
  assert.equal(LM.nachLektion(100).kon, 101);
});

test('Zustand: Karten mit kaputter Stufe oder Stabilität bleiben planbar', () => {
  frisch({ pensum: 3 });
  Z.P.karten[0] = { st: 9, n: 1, fe: 0, zul: '2026-01-01', fa: [] };
  Z.P.karten[1] = { st: 1, n: 1, fe: 0, zul: '2026-01-01', fa: [], S: 0 };
  Z.P.karten[2] = { st: 1, n: 1, fe: 0, zul: '2026-01-01', fa: [], S: null };
  assert.ok([0, 1, 2].every(id => Z.stabilitaet(Z.P.karten[id]) > 0));
  const t = Z.tagesplan(); assert.equal(t.plan.length, 3);
  for (const id of [0, 1, 2]) { Z.abschnittAbschliessen(id, ok(id), 'frei'); assert.ok(Number.isFinite(Z.karte(id).S) && Z.karte(id).S > 0); }
  assert.ok(Number.isFinite(Z.kennzahlen().st2));
});

test('Kontrolle am Folgetag steht bei Pensum 1, 2 und 3 im Plan, mit der Marke „fehler“ (Audit H1, N6)', () => {
  for (const pensum of [1, 2, 3]) for (const bereich of [null, reihe(120)]) {
    frisch({ pensum, bereich });
    const id = Z.tagesplan().plan[0];
    Z.abschnittAbschliessen(id, Array(D.A[id].ayat).fill('fehler'));
    wirdErfuellen();
    assert.equal(Z.karte(id).kon, Z.plusTage(Z.heute(), 1));
    naechsterTag();
    const t = Z.tagesplan(), umlauf = !bereich && pensum < 3;
    assert.equal(t.art[id], 'fehler', `Pensum ${pensum}, Bestand ${bereich ? 120 : 'ganz'}`);
    assert.equal(t.ma[id], 'kontrolle');
    assert.equal(t.plan.length, pensum + (umlauf ? 1 : 0));
    assert.equal(new Set(t.plan).size, t.plan.length);
  }
});

test('Dauer einer Ḫatma: die Angabe passt zum Modell (fehlerfrei simuliert, höchstens 15 % Abweichung) (Audit M8)', () => {
  for (const [N, pensum] of [[60, 3], [300, 5], [26, 1]]) {
    frisch({ pensum, bereich: reihe(N) });
    const angabe = Z.tageProKhatma(), sp = Z.khatmaSpanne();
    let tage = 0;
    while (Z.P.zyklus.khatma < 1 && tage < 1000) { wirdErfuellen(); tage++; if (Z.P.zyklus.khatma < 1) naechsterTag(); }
    assert.ok(Math.abs(tage - angabe) <= 0.15 * tage, `${N} Abschnitte, Pensum ${pensum}: Angabe ${angabe}, tatsächlich ${tage}`);
    assert.ok(sp.von === angabe && sp.bis >= sp.von);
  }
  // Umlauf und ganz geprüfter Bestand: jeder Platz führt weiter
  frisch({ pensum: 2 });
  assert.equal(Z.tageProKhatma(), Math.ceil(739 / 2));
  frisch({ pensum: 3, bereich: reihe(30) });
  for (const id of reihe(30)) Z.P.karten[id] = { st: 1, n: 1, fe: 0, zul: '2026-01-01', fa: [], S: 25 };
  assert.equal(Z.tageProKhatma(), 10);
});

test('Lernmodell: die Kopie in der App und der Master im Werkzeugordner sind inhaltlich gleich', (t) => {
  const hier = dirname(fileURLToPath(import.meta.url)), master = join(hier, '..', '..', 'werkzeuge', 'lernmodell', 'lernmodell.mjs');
  if (!existsSync(master)) return t.skip('Master liegt außerhalb des App-Ordners und fehlt hier');
  const rumpf = (pfad, ab) => readFileSync(pfad, 'utf8').replace(/\r\n/g, '\n').split('\n').slice(ab).join('\n');
  assert.equal(rumpf(join(hier, '..', 'js', 'lernmodell.js'), 2), rumpf(master, 3));
});
