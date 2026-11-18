// Itqān · Tests zu Neu lernen: Lernplan in drei Schritten (Ḥifẓ, Ḍabṭ, Itqān), danach in der Wiederholung
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Z, D, frisch, naechsterTag } from './umgebung.mjs';

const ende = () => D.A.slice(-30).map(e => e.id);
const lauf = (id, wert = 'ok') => Z.abschnittAbschliessen(id, Array(D.A[id].v[1] - D.A[id].v[0] + 1).fill('ok').map((x, i) => i === 0 ? wert : x), 'lern');
function lektion() { frisch({ bereich: ende() }); const id = Z.lernVorschlag(); assert.ok(Z.lernBeginnen(id)); return id; }

test('Vorschlag: reicht der Bereich bis ans Ende, beginnt die Sūra davor mit ihrem ersten Abschnitt', () => {
  frisch({ bereich: ende() });
  const v = Z.lernVorschlag(), min = ende()[0];
  assert.ok(v < min && Z.lernbar(v));
  assert.notEqual(D.A[v - 1].von[0], D.A[v].von[0]);
  assert.ok(!Z.lernbar(min), 'Abschnitt im Bereich ist keine Lektion');
  frisch({});
  assert.equal(Z.lernVorschlag(), null, 'ganzer Qurʾān im Bereich: nichts zu lernen');
});

test('Drei Schritte: ein fehlerfreier Durchgang zählt pro Tag einmal, nach dem dritten Tag geht der Abschnitt in die Wiederholung', () => {
  const id = lektion();
  let r = lauf(id); assert.equal(r.lern.schritte, 1); assert.ok(r.lern.neu);
  r = lauf(id); assert.equal(r.lern.schritte, 1); assert.ok(!r.lern.neu, 'am selben Tag zählt es nicht noch einmal');
  assert.equal(Z.karte(id).st, 1);
  naechsterTag();
  assert.equal(lauf(id, 'fehler').lern.schritte, 1, 'Fehler zählt nicht');
  assert.equal(lauf(id, 'hilfe').lern.schritte, 1, 'Hilfe zählt nicht');
  assert.equal(lauf(id).lern.schritte, 2); assert.equal(Z.lektionen()[0].st, 2);
  assert.ok(!Z.imBereich(id), 'vor dem dritten Schritt noch nicht im Bereich');
  naechsterTag(); r = lauf(id);
  assert.equal(r.lern.ph, 2); assert.ok(r.ereignisse.some(x => x.typ === 'lernstufe' && x.ph === 2));
  assert.ok(Z.imBereich(id) && Z.reihe().includes(id), 'nach dem dritten Schritt in der Wiederholung');
  assert.equal(Z.karte(id).st, 2); assert.equal(Z.stabilitaet(Z.karte(id)), 3);
  assert.equal(Z.lektionen().length, 0); assert.equal(Z.lernFertig().length, 1);
});

test('Heute zeigt so viele Lektionen, wie pro Tag eingestellt sind; was heute zählt, behält seinen Platz', () => {
  const id = lektion(); const zweite = D.A.find(e => Z.lernbar(e.id) && e.id !== id).id; assert.ok(Z.lernBeginnen(zweite));
  assert.equal(Z.lernProTag(), 1); assert.equal(Z.lernHeute().length, 1);
  lauf(zweite);
  assert.equal(Z.lernHeute()[0].id, zweite, 'die gezählte Lektion steht vorn');
  Z.P.einst.lernProTag = 2; assert.equal(Z.lernHeute().length, 2);
  Z.P.einst.lernProTag = 9; assert.equal(Z.lernProTag(), 5);
});

test('Lektionen zählen nicht zum Wird und nicht zur Ḫatma; beenden macht den Abschnitt wieder frei', () => {
  const id = lektion(); lauf(id);
  assert.ok(!Z.P.zyklus.erledigt.includes(id)); assert.ok(!Z.tagesplan().voll); assert.equal(Z.P.kette.n, 0);
  Z.lernAbbrechen(id);
  assert.equal(Z.P.lern[id], undefined); assert.ok(Z.lernbar(id));
  assert.equal(Z.abschnittAbschliessen(id, ['ok'], 'lern').lern, null, 'ohne Lektion ist es freies Üben');
});

test('Protokoll: der Stand der Lektionen entsteht aus den Einträgen neu', () => {
  const id = lektion(); lauf(id); naechsterTag(); lauf(id);
  const live = JSON.stringify([Z.P.lern, Z.P.karten[id]]);
  const typen = Z.P.log.map(e => e.y);
  assert.ok(typen.includes('lb') && typen.filter(y => y === 'ab').length === 2);
  Z.lernAbbrechen(id); assert.equal(Z.P.log.at(-1).y, 'lx');
  assert.ok(live.includes('"ft":['));
});
