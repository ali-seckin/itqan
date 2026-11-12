// Itqān · Rhythmus „Langzeit“: Stabilität, Fälligkeit, Auswahl
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Z, D, frisch, naechsterTag, tagSetzenZurueck } from './umgebung.mjs';

after(() => { Z.logGrenze(0); tagSetzenZurueck(); });
const ok = id => Array.from({ length: D.A[id].ayat }, () => 'ok');

test('Stabilität: erster Erfolg 4 Tage, später wächst sie, ein Fehler lässt sie fallen', () => {
  frisch({ pensum: 1 });
  const id = Z.tagesplan().plan[0];
  Z.abschnittAbschliessen(id, ok(id));
  assert.equal(Z.karte(id).S, 4);
  naechsterTag(4);                                  // genau nach 4 Tagen: R = 0,9
  Z.abschnittAbschliessen(id, ok(id), 'frei');
  const S2 = Z.karte(id).S; assert.ok(S2 > 4 * 1.5);
  naechsterTag(3);
  const e = D.A[id], r = ok(id); r[0] = 'fehler';
  Z.abschnittAbschliessen(id, r, 'frei');
  assert.ok(Z.karte(id).S < S2 * 0.5);
});

test('Abrufwahrscheinlichkeit: nach S Tagen 90 Prozent', () => {
  assert.ok(Math.abs(Z.abruf(10, 10) - 0.9) < 1e-9);
  assert.ok(Z.abruf(0, 10) === 1 && Z.abruf(100, 10) < Z.abruf(10, 10));
});

test('Langzeit: ein sicherer Abschnitt kommt nicht am nächsten Tag wieder, ein fälliger vor einem ungeübten', () => {
  frisch({ pensum: 2 });
  Z.P.einst.rhythmus = 'langzeit';
  const t1 = Z.tagesplan(); const [a, b] = t1.plan;
  Z.abschnittAbschliessen(a, ok(a)); Z.abschnittAbschliessen(b, ok(b));
  Z.karte(a); Z.P.karten[a].S = 100;                // a ist sehr stabil
  Z.P.karten[b].S = 1;                              // b ist wackelig
  naechsterTag(10);
  const t2 = Z.tagesplan();
  assert.ok(t2.plan.includes(b), 'der wackelige Abschnitt ist fällig');
  assert.ok(!t2.plan.includes(a), 'der stabile Abschnitt ist noch nicht dran');
  assert.equal(t2.plan[0], b);                      // fällig vor ungeübt
});

test('Klassisch bleibt unverändert: der Plan folgt der Reihenfolge des Bereichs', () => {
  frisch({ pensum: 3 });
  const t = Z.tagesplan();
  assert.deepEqual(t.plan, Z.reihe().slice(0, 3));
});
