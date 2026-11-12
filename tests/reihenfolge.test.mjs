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
