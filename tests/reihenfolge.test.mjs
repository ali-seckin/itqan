// Itqān · Reihenfolge wechseln gilt sofort
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Z, D, frisch, tagSetzenZurueck } from './umgebung.mjs';

after(() => { Z.logGrenze(0); tagSetzenZurueck(); });

test('Reihenfolge wechseln: Plan von heute wird sofort neu aufgebaut, Punkte bleiben, Zähler beginnt neu', () => {
  frisch({ pensum: 3 });
  const t = Z.tagesplan(), erster = t.plan[0];
  Z.abschnittAbschliessen(erster, Array.from({ length: D.A[erster].ayat }, () => 'ok'));
  const punkte = Z.tagesplan().punkte;
  assert.equal(Z.heuteZyklus().fertig, 1);
  Z.P.einst.reihenfolge = 'rueckwaerts';
  assert.equal(Z.heuteNeuAufbauen(), 3);
  const n = Z.tagesplan();
  assert.equal(n.plan.length, 3); assert.equal(n.fertig.length, 0); assert.equal(n.punkte, punkte);
  assert.ok(!n.plan.includes(erster)); assert.ok(n.plan.every(id => Z.karte(id).n === 0));
  assert.ok(Math.min(...n.plan) > 100);   // von hinten
});

test('Ganzer Abschnitt am Stück: Fehler gehen vor Zögern, gezögert wird je Vers gewählt', () => {
  assert.deepEqual(Z.ganzErgebnis([10, 11, 12, 13], new Set([11, 12]), new Set([12, 13])), ['ok', 'fehler', 'fehler', 'zoegern']);
});

test('Ǧuzʾ richtet sich nach der Āya, nicht nach der Seite (Aǧzāʾ beginnen teils mitten auf der Seite)', async () => {
  const { juzVonVers } = await import('../js/daten.js');
  const vi = (s, a) => D.V.findIndex(v => v[0] === s && v[1] === a);
  assert.equal(juzVonVers(vi(45, 33)), 25); assert.equal(juzVonVers(vi(46, 1)), 26);
  assert.equal(juzVonVers(vi(3, 92)), 3); assert.equal(juzVonVers(vi(3, 93)), 4);
  assert.equal(juzVonVers(vi(5, 81)), 6); assert.equal(juzVonVers(vi(5, 82)), 7);
  assert.equal(juzVonVers(vi(9, 92)), 10); assert.equal(juzVonVers(vi(9, 93)), 11);
  assert.equal(juzVonVers(0), 1); assert.equal(juzVonVers(D.V.length - 1), 30);
});

test('Abhaken: zählt für Plan und Zyklus, aber ohne Punkte, Hasanat und Stufenänderung', () => {
  frisch({ pensum: 2 });
  const [a, b] = Z.tagesplan().plan, vorher = { ...Z.karte(a) };
  assert.deepEqual(Z.heuteAbhakbar(), [a, b]);
  const r = Z.abschnittAbhaken(a);
  assert.ok(r); assert.equal(Z.abschnittAbhaken(a), null);       // nur einmal
  const t = Z.tagesplan(), k = Z.karte(a);
  assert.ok(t.fertig.includes(a)); assert.equal(t.punkte, 0); assert.equal(t.hasanat, 0);
  assert.equal(k.st, vorher.st); assert.equal(k.n, 1); assert.ok(Z.P.zyklus.erledigt.includes(a));
  assert.deepEqual(Z.heuteAbhakbar(), [b]);
  Z.abschnittAbhaken(b); assert.equal(Z.tagesplan().voll, true);
});
