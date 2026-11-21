// Itqān · Abläufe nach dem Audit 1.99: zweiter Durchgang am selben Tag, Ḫatma, Wiedereinstieg, Ergebnisprüfung, Gliederungswechsel
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Z, D, frisch, naechsterTag, tagSetzen, wirdErfuellen, gliederungSetzen, tagSetzenZurueck } from './umgebung.mjs';

after(() => { gliederungSetzen('fort'); tagSetzenZurueck(); });
const ok = id => Array(D.A[id].ayat).fill('ok');
const einFehler = id => ok(id).map((x, i) => i === 0 ? 'fehler' : x);

test('Zweiter Durchgang am selben Tag: kein Aufstieg, keine Punkte; ein Fehler senkt weiter und bleibt sichtbar (Audit H9)', () => {
  frisch({ pensum: 1 });
  const id = Z.tagesplan().plan[0];
  const r1 = Z.abschnittAbschliessen(id, ok(id));
  assert.equal(Z.karte(id).st, 1); assert.ok(r1.punkte > 0); assert.equal(r1.wiederholung, false);
  for (let i = 0; i < 4; i++) {
    const r = Z.abschnittAbschliessen(id, ok(id), 'frei');
    assert.equal(r.wiederholung, true); assert.equal(r.punkte, 0); assert.deepEqual(r.teile, []); assert.ok(r.hasanat > 0);
    assert.ok(!r.ereignisse.some(x => x.typ === 'stufe'));
  }
  assert.equal(Z.karte(id).st, 1, 'nach fünf Durchgängen an einem Tag eine Stufe, nicht Mutqan');
  assert.equal(Z.P.summe.punkte, r1.punkte); assert.equal(Z.karte(id).S, Z.MODELL.sErstSauber);
  // ein Fehler in der Wiederholung senkt die Stufe und bleibt bis zum nächsten Tag als letzter Stand stehen
  Z.abschnittAbschliessen(id, einFehler(id), 'frei');
  assert.equal(Z.karte(id).st, 0); assert.equal(Z.karte(id).lf, 1); assert.deepEqual(Z.karte(id).fa, [D.A[id].v[0]]);
  Z.abschnittAbschliessen(id, ok(id), 'frei');
  assert.equal(Z.karte(id).st, 0); assert.equal(Z.karte(id).lf, 1); assert.equal(Z.abschnittStand(id), 'fehler');
  // am nächsten Tag zählt wieder ein Durchgang voll
  naechsterTag();
  const r2 = Z.abschnittAbschliessen(id, ok(id), 'frei');
  assert.equal(Z.karte(id).st, 1); assert.ok(r2.punkte > 0); assert.equal(Z.karte(id).lf, 0); assert.deepEqual(Z.karte(id).fa, []);
});

test('Abgehakt und danach in der App geübt: der Durchgang in der App zählt als erster des Tages', () => {
  frisch({ pensum: 1 });
  const id = Z.tagesplan().plan[0];
  assert.ok(Z.abschnittAbhaken(id)); assert.equal(Z.karte(id).st, 0);
  const r = Z.abschnittAbschliessen(id, ok(id), 'frei');
  assert.equal(r.wiederholung, false); assert.ok(r.punkte > 0); assert.equal(Z.karte(id).st, 1);
  assert.equal(Z.abschnittAbschliessen(id, ok(id), 'frei').wiederholung, true);
});

test('Protokoll: der Nachbau wertet zwei Durchgänge am selben Tag wie das Gerät', () => {
  frisch({ pensum: 1 });
  const sockel = JSON.parse(JSON.stringify({ ...Z.P, log: [] })), id = Z.tagesplan().plan[0];
  Z.logGrenze(1e9);
  Z.abschnittAbschliessen(id, ok(id)); Z.abschnittAbschliessen(id, ok(id), 'frei'); Z.abschnittAbschliessen(id, einFehler(id), 'frei');
  const p = Z.nachbau(sockel, Z.P.log);
  assert.deepEqual(JSON.parse(JSON.stringify(p.karten)), JSON.parse(JSON.stringify(Z.P.karten)));
  assert.deepEqual(p.summe, Z.P.summe);
  Z.logGrenze(0);
});

test('Ergebnis passt nicht zum Abschnitt: abgelehnt, der Stand bleibt unverändert (Audit N2)', () => {
  frisch({ pensum: 1 });
  const id = Z.tagesplan().plan[0], n = D.A[id].ayat, vorher = JSON.stringify(Z.P);
  for (const erg of [[], ['ok'], Array(n + 3).fill('fehler'), Array(n).fill('prima'), Array(n).fill(undefined), 'ok'.repeat(n), null])
    assert.throws(() => Z.abschnittAbschliessen(id, erg), /ergebnis-ungueltig/);
  for (const nr of [99999, -1, 'abc', undefined]) assert.throws(() => Z.abschnittAbschliessen(nr, ['ok']), /ergebnis-ungueltig/);
  assert.equal(JSON.stringify(Z.P), vorher);
  // ein fremder Eintrag mit zu vielen Werten schreibt keine Āyāt des Nachbarabschnitts
  const sockel = JSON.parse(vorher); sockel.log = [];
  const p = Z.nachbau(sockel, [{ i: 'fremd-000001', z: 5, y: 'ab', d: Z.heute(), id, v: [...D.A[id].v], e: 'f'.repeat(n + 3), q: 'frei', p: 0 }]);
  assert.equal(p.karten[id].fa.length, n); assert.ok(p.karten[id].fa.every(v => v <= D.A[id].v[1]));
  assert.ok(Z.mitProfil(p, () => Z.kennzahlen().quote) >= 0);
});

test('Ḫatma: nach einem verkleinerten Bestand bleibt die Runde nicht bei 100 % stehen (Audit Abl. 6)', () => {
  frisch({ pensum: 2, bereich: [0, 1, 2, 3] });
  wirdErfuellen();
  assert.equal(Z.khatmaFortschritt().fertig, 2);
  Z.P.einst.bereich = [...Z.P.zyklus.erledigt]; Z.speichern();
  assert.equal(Z.khatmaFortschritt().anteil, 1);
  naechsterTag(); wirdErfuellen();
  assert.equal(Z.P.zyklus.khatma, 1);
  const f = Z.khatmaFortschritt(); assert.ok(f.fertig < f.gesamt);
});

test('Wiedereinstieg: „wie sonst weitermachen“ gilt auch am nächsten Tag (Audit Abl. 17)', () => {
  frisch({ pensum: 4 });
  wirdErfuellen(); naechsterTag(4);
  assert.equal(Z.tagesplan().cb, 1); assert.equal(Z.tagesplan().plan.length, 2);
  Z.comebackBeenden();
  assert.equal(Z.tagesplan().plan.length, 4);
  wirdErfuellen(); naechsterTag();
  const t = Z.tagesplan(); assert.equal(t.cb, undefined); assert.equal(t.plan.length, 4);
  // auch wenn der aufgefüllte Tag nicht erfüllt wurde
  frisch({ pensum: 4 });
  wirdErfuellen(); naechsterTag(4); Z.tagesplan(); Z.comebackBeenden(); naechsterTag();
  assert.equal(Z.tagesplan().cb, undefined);
});

test('Wiedereinstieg: wer täglich übt, ohne den Wird zu erfüllen, ist nicht „zurück“ (Audit Abl. 17)', () => {
  frisch({ pensum: 4 });
  wirdErfuellen();
  for (let i = 0; i < 8; i++) {
    naechsterTag();
    const t = Z.tagesplan();
    assert.equal(t.cb, undefined, `Tag ${i + 2}`); assert.ok(t.plan.length >= 4);
    Z.abschnittAbschliessen(t.plan[0], ok(t.plan[0]));
  }
});

test('Wiedereinstieg: ein Ruhetag unterbricht die drei Tage nicht (Audit M6)', () => {
  frisch({ datum: '2026-01-05', pensum: 6 });          // Montag
  Z.P.einst.pensum[5] = 0;                             // Samstag Ruhetag
  wirdErfuellen();
  tagSetzen('2026-01-16');                             // Freitag der zweiten Woche: acht Wird-Tage versäumt
  let t = Z.tagesplan(); assert.equal(t.cb, 1); assert.equal(t.plan.length, 3);
  wirdErfuellen(); naechsterTag();
  assert.equal(Z.tagesplan().ruhe, 'ruhetag');
  naechsterTag(); t = Z.tagesplan(); assert.equal(t.cb, 2); assert.equal(t.plan.length, 3);
  wirdErfuellen(); naechsterTag(); t = Z.tagesplan(); assert.equal(t.cb, 3); assert.equal(t.plan.length, 3);
  wirdErfuellen(); naechsterTag(); t = Z.tagesplan(); assert.equal(t.cb, undefined); assert.equal(t.plan.length, 6);
});

test('Wiedereinstieg: das halbe Pensum kippt nicht in den Umlauf, Fälliges wird wiederholt (Audit M6)', () => {
  frisch({ pensum: 4 });
  for (let i = 0; i < 6; i++) { wirdErfuellen(); naechsterTag(); }
  naechsterTag(40);
  const t = Z.tagesplan();
  assert.equal(t.cb, 1); assert.equal(t.plan.length, 2); assert.ok(t.fl > 10);
  assert.ok(t.plan.some(id => Z.karte(id).n > 0), 'am Tag der Rückkehr steht schon Geprüftes im Plan');
});

test('„Ein Abschnitt mehr“ folgt dem üblichen Pensum, auch im großen Bestand (Audit N3)', () => {
  frisch({ pensum: 4 });
  for (let i = 0; i < 6; i++) { wirdErfuellen(); naechsterTag(); }
  naechsterTag(40); wirdErfuellen(); naechsterTag(); wirdErfuellen(); naechsterTag(); wirdErfuellen(); naechsterTag();
  const t = Z.tagesplan(), vorher = new Set(t.plan);
  assert.ok(t.fl > 4);
  const mehr = Z.pensumHeuteAendern(1).plan.find(id => !vorher.has(id));
  assert.ok(Z.karte(mehr).n > 0, 'der zusätzliche Abschnitt ist ein fälliger, keine Erstprüfung');
});

test('Gliederungswechsel: Kontrolle und Felder des Modells ziehen mit (Audit N1)', async () => {
  frisch({ pensum: 2 });
  const id = Z.tagesplan().plan[0];
  Z.abschnittAbschliessen(id, Array(D.A[id].ayat).fill('fehler'));
  const alt = { ...Z.karte(id) };
  assert.ok(alt.kon && alt.lt != null && alt.lf === D.A[id].ayat);
  gliederungSetzen('seite'); assert.equal(await Z.gliederungAbgleichen(), true);
  const neu = Object.values(Z.P.karten).find(k => k.n);
  assert.equal(neu.kon, alt.kon); assert.equal(neu.lt, alt.lt); assert.equal(neu.S, alt.S);
  assert.ok(neu.lf > 1, 'die Zahl der Fehler wird nicht auf 1 gekappt'); assert.ok(!('fae' in neu) && !('fs' in neu));
  gliederungSetzen('fort'); assert.equal(await Z.gliederungAbgleichen(), true);
  const zurueck = Z.karte(id);
  assert.equal(zurueck.kon, alt.kon); assert.equal(zurueck.n, alt.n); assert.equal(zurueck.S, alt.S);
  naechsterTag();
  assert.equal(Z.tagesplan().art[id], 'fehler');
});
