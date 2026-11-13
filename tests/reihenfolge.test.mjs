// Itqān · Reihenfolge wechseln gilt sofort
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Z, D, frisch, tagSetzenZurueck, wirdErfuellen } from './umgebung.mjs';

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

test('Wird schon erfüllt: eine neue Reihenfolge gilt erst ab morgen, der Tag bleibt erfüllt', () => {
  frisch({ pensum: 2 });
  wirdErfuellen(); assert.equal(Z.tagesplan().voll, true); assert.equal(Z.heuteZyklus().voll, true);
  const vorher = [...Z.tagesplan().plan];
  Z.P.einst.reihenfolge = 'rueckwaerts';
  assert.equal(Z.heuteNeuAufbauen(), 0);
  assert.deepEqual(Z.tagesplan().plan, vorher); assert.equal(Z.tagesplan().voll, true);
});

test('Abhaken gilt auch für Qaḍāʾ-, Festigen- und Fehler-Abschnitte im Plan', () => {
  frisch({ pensum: 2 });
  const t = Z.tagesplan(), [a, b] = t.plan; t.art[a] = 'fehler'; t.art[b] = 'qadaa';
  assert.deepEqual(Z.heuteAbhakbar(), [a, b]);
  assert.ok(Z.abschnittAbhaken(a)); assert.ok(Z.abschnittAbhaken(b));
  assert.equal(Z.tagesplan().voll, true);
});

test('Kurzübungen bringen Itqān-Punkte nach Schwierigkeit, mit Hilfe die Hälfte, höchstens 50 am Tag', () => {
  frisch({ pensum: 1 });
  assert.deepEqual(Z.kurzBuchen('seite', 1), { punkte: 5, gedeckelt: false });
  assert.equal(Z.kurzBuchen('zeile', 1).punkte, 2); assert.equal(Z.kurzBuchen('mitte', 0.5).punkte, 2);
  assert.equal(Z.kurzBuchen('juz', 0).punkte, 0);
  assert.equal(Z.tagesplan().punkte, 9); assert.equal(Z.tagesplan().kp, 9);
  for (let i = 0; i < 9; i++) Z.kurzBuchen('seite', 1);                  // 45 + 9 = 54 > 50
  const r = Z.kurzBuchen('seite', 1); assert.equal(r.punkte, 0); assert.equal(r.gedeckelt, true);
  assert.equal(Z.tagesplan().kp, 50);
  for (const p of Object.values(Z.KURZ_PUNKTE)) assert.ok(p >= 1 && p <= 5);
});

test('Kettenbonus: 3 Tage 3 %, 7 Tage 10 %, 40 Tage 50 % als Höchstwert, Kette weg heißt Bonus weg', () => {
  assert.deepEqual([0, 2, 3, 6, 7, 11, 12, 20, 21, 29, 30, 39, 40, 365].map(n => Z.kettenBonus(n).p), [0, 0, 3, 3, 10, 10, 15, 15, 25, 25, 35, 35, 50, 50]);
  assert.equal(Z.kettenBonus(40).naechst, null); assert.equal(Z.kettenBonus(7).naechst, 12);
  const punkte = n => {
    frisch({ pensum: 1 });
    Z.P.kette = { n, zuletzt: n ? Z.heute() : null, beste: n };
    const id = Z.tagesplan().plan[0];
    return Z.abschnittAbschliessen(id, Array.from({ length: D.A[id].ayat }, () => 'ok')).punkte;
  };
  const basis = punkte(0), p7 = punkte(7), p40 = punkte(40);
  assert.equal(p7, basis + Math.round(basis * 0.10)); assert.equal(p40, basis + Math.round(basis * 0.50));
  assert.ok(p40 <= Math.round(basis * 1.5));
});
