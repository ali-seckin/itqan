// Itqān · Tests zu Etappe 7: Neu lernen in drei Stufen (Ḥifẓ, Ḍabṭ, Itqān)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Z, D, frisch, naechsterTag } from './umgebung.mjs';

const ende = () => D.A.slice(-30).map(e => e.id);
const lauf = (id, wert = 'ok') => Z.abschnittAbschliessen(id, Array(D.A[id].v[1] - D.A[id].v[0] + 1).fill('ok').map((x, i) => i === 0 ? wert : x), 'lern');
function lektion() { frisch({ bereich: ende() }); const id = Z.lernVorschlag(); assert.ok(Z.lernBeginnen(id)); return id; }
function bisDabt(id) { lauf(id); naechsterTag(); lauf(id); assert.equal(Z.P.lern[id].ph, 1); }

test('Vorschlag: reicht der Bereich bis ans Ende, beginnt die Sūra davor mit ihrem ersten Abschnitt', () => {
  frisch({ bereich: ende() });
  const v = Z.lernVorschlag(), min = ende()[0];
  assert.ok(v < min && Z.lernbar(v));
  assert.notEqual(D.A[v - 1].von[0], D.A[v].von[0]);
  assert.ok(!Z.lernbar(min), 'Abschnitt im Bereich ist keine Lektion');
  frisch({});
  assert.equal(Z.lernVorschlag(), null, 'ganzer Qurʾān im Bereich: nichts zu lernen');
});

test('Ḥifẓ: zwei fehlerfreie Durchgänge am selben Tag zählen einmal, am zweiten Tag beginnt der Ḍabṭ', () => {
  const id = lektion();
  assert.equal(lauf(id).lern.tage, 1); assert.equal(lauf(id).lern.tage, 1);
  assert.equal(Z.P.lern[id].ph, 0); assert.equal(Z.karte(id).st, 1);
  naechsterTag();
  assert.equal(lauf(id, 'fehler').lern.ph, 0, 'Fehler zählt nicht');
  assert.equal(lauf(id, 'hilfe').lern.ph, 0, 'Hilfe zählt nicht');
  const r = lauf(id);
  assert.equal(r.lern.ph, 1); assert.ok(r.ereignisse.some(x => x.typ === 'lernstufe' && x.ph === 1));
  assert.equal(Z.karte(id).st, 2); assert.equal(Z.dach(Z.karte(id).st), 1);
  assert.ok(!Z.imBereich(id), 'im Ḍabṭ noch nicht im Bereich');
});

test('Ḍabṭ: vier fehlerfreie Durchgänge in Folge führen zum Itqān, Hilfe beginnt die Folge neu', () => {
  const id = lektion(); bisDabt(id);
  for (let i = 0; i < 3; i++) { naechsterTag(); lauf(id); }
  assert.equal(Z.P.lern[id].s, 3); assert.equal(Z.karte(id).st, 3);
  naechsterTag(); assert.equal(lauf(id, 'hilfe').lern.s, 0);
  for (let i = 0; i < 3; i++) { naechsterTag(); lauf(id); }
  assert.equal(Z.P.lern[id].ph, 1);
  naechsterTag(); const r = lauf(id);
  assert.equal(r.lern.ph, 2); assert.equal(Z.karte(id).st, 4);
  assert.ok(Z.imBereich(id) && Z.reihe().includes(id), 'mit dem Itqān im Bereich');
  assert.equal(Z.lektionen().length, 0); assert.equal(Z.lernFertig().length, 1);
});

test('Ḍabṭ: eine offene Fehlerstelle hält den Itqān auf, bis sie erledigt ist', () => {
  const id = lektion(); bisDabt(id);
  Z.fehlerstellenMerken([D.A[id].v[0] + '.0'], 'haenger');
  for (let i = 0; i < 4; i++) { naechsterTag(); lauf(id); }
  assert.equal(Z.P.lern[id].ph, 1); assert.equal(Z.lektionen()[0].offen, 1);
  Z.fehlerstelleLoeschen(D.A[id].v[0] + '.0');
  naechsterTag(); assert.equal(lauf(id).lern.ph, 2);
});

test('Lektionen zählen nicht zum Wird und nicht zur Ḫatma; beenden macht den Abschnitt wieder frei', () => {
  const id = lektion(); lauf(id);
  assert.ok(!Z.P.zyklus.erledigt.includes(id)); assert.ok(!Z.tagesplan().voll); assert.equal(Z.P.kette.n, 0);
  Z.lernAbbrechen(id);
  assert.equal(Z.P.lern[id], undefined); assert.ok(Z.lernbar(id));
  assert.equal(Z.abschnittAbschliessen(id, ['ok'], 'lern').lern, null, 'ohne Lektion ist es freies Üben');
});

test('Protokoll: der Stand der Lektionen entsteht aus den Einträgen neu', () => {
  const id = lektion(); bisDabt(id); naechsterTag(); lauf(id);
  const live = JSON.stringify([Z.P.lern, Z.P.karten[id]]);
  const typen = Z.P.log.map(e => e.y);
  assert.ok(typen.includes('lb') && typen.filter(y => y === 'ab').length === 3);
  Z.lernAbbrechen(id); assert.equal(Z.P.log.at(-1).y, 'lx');
  assert.ok(live.includes('"ph":1'));
});
