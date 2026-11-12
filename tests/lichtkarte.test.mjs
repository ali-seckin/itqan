// Itqān · Lichtkarte: Modell
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Z, D, frisch, tagSetzenZurueck, naechsterTag } from './umgebung.mjs';
import { modell, juzMittel, katVon } from '../js/lichtkarte.js';

after(() => { Z.logGrenze(0); tagSetzenZurueck(); });

test('Lichtkarte: frisches Profil, alle Seiten ungeprüft, nach einem Durchgang heller', () => {
  frisch({ pensum: 1 });
  let m = modell(); const imBer = m.seiten.filter(s => s && !s.aus);
  assert.equal(imBer.length, 604); assert.ok(imBer.every(s => s.k === 0));
  const id = Z.tagesplan().plan[0];
  Z.abschnittAbschliessen(id, Array.from({ length: D.A[id].ayat }, () => 'ok'));
  m = modell(); const p = D.A[id].seiten[0];
  assert.equal(m.seiten[p].k, 1);            // geprüft, im Aufbau
  assert.equal(m.seiten[p].f, 4);            // frisch geübt
  assert.ok(m.seiten[p].w);                  // diese Woche geübt
  assert.equal(katVon({ n: 0, st: 0 }), 0); assert.equal(katVon({ n: 2, st: 0 }), 1); assert.equal(katVon({ n: 5, st: 4 }), 4);
});

test('Lichtkarte: eine Seite zeigt ihren schwächsten Abschnitt, die beste Stelle als Ecke', () => {
  frisch({ pensum: 1 });
  const e = D.A.find(x => D.A.filter(y => y.seiten.some(p => x.seiten.includes(p))).length > 1);   // Abschnitt, dessen Seite noch einen anderen berührt
  const p = e.seiten[0], ids = D.A.filter(x => x.seiten.includes(p)).map(x => x.id);
  Z.karte(ids[0]); Z.P.karten[ids[0]] = { st: 4, n: 5, fe: 0, zul: Z.heute(), fae: null, fs: 0, fa: [], S: 90 };
  const s = modell().seiten[p];
  assert.equal(s.k, 0); assert.equal(s.b, 4);
});

test('Lichtkarte: Frische sinkt mit der Zeit, fällig wird sichtbar', () => {
  frisch({ pensum: 1 });
  const id = Z.tagesplan().plan[0], p = D.A[id].seiten[0];
  Z.abschnittAbschliessen(id, Array.from({ length: D.A[id].ayat }, () => 'ok'));
  const f0 = modell().seiten[p].f; assert.ok(f0 >= 3 && !modell().seiten[p].fa);
  naechsterTag(40);
  const m = modell().seiten[p]; assert.ok(m.f <= 2 && m.fa);
  assert.equal(juzMittel().length, 30);
});
