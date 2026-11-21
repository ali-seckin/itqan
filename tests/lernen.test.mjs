// Itqān · Tests zu Neu lernen: Lernplan in drei Schritten (Ḥifẓ, Ḍabṭ, Itqān), danach in der Wiederholung
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Z, D, frisch, naechsterTag, wirdErfuellen } from './umgebung.mjs';

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
  assert.equal(Z.karte(id).st, 2); assert.equal(Z.stabilitaet(Z.karte(id)), Z.MODELL.sLern);
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
  assert.equal(Z.abschnittAbschliessen(id, Array(D.A[id].ayat).fill('ok'), 'lern').lern, null, 'ohne Lektion ist es freies Üben');
});

test('Protokoll: der Stand der Lektionen entsteht aus den Einträgen neu', () => {
  const id = lektion(); lauf(id); naechsterTag(); lauf(id);
  const live = JSON.stringify([Z.P.lern, Z.P.karten[id]]);
  const typen = Z.P.log.map(e => e.y);
  assert.ok(typen.includes('lb') && typen.filter(y => y === 'ab').length === 2);
  Z.lernAbbrechen(id); assert.equal(Z.P.log.at(-1).y, 'lx');
  assert.ok(live.includes('"ft":['));
});

// viel Fälliges: zehn Abschnitte des Bestands, vor 30 Tagen geübt, mit kleiner Stabilität
const rueckstau = () => { for (const x of ende().slice(0, 10)) Z.P.karten[x] = { st: 1, n: 1, fe: 0, zul: Z.plusTage(Z.heute(), -30), fa: [], lf: 0, S: 2 }; };

test('Ḥifẓ-Tempo: bei viel Fälligem beginnen neue Lektionen nicht, angefangene laufen weiter', () => {
  const id = lektion();
  assert.ok(Z.lernErlaubt().ok); assert.ok(Z.lernHeute().some(l => l.id === id));
  rueckstau();
  assert.deepEqual(Z.lernErlaubt(), { ok: false, grund: 'rueckstau' }); assert.ok(!Z.lernHeute().some(l => l.id === id), 'eine noch nicht begonnene Lektion wartet');
  lauf(id, 'fehler');
  assert.ok(Z.lernHeute().some(l => l.id === id), 'eine angefangene Lektion läuft weiter, auch ohne fehlerfreien Durchgang (Audit M7)');
});

test('Ḥifẓ-Tempo: die Sperre rechnet mit dem jetzigen Stand und löst sich am selben Tag (Audit Abl. 16)', () => {
  lektion(); rueckstau();
  const tage = Object.keys(Z.P.tage).length;
  assert.equal(Z.lernErlaubt().ok, false);
  assert.equal(Object.keys(Z.P.tage).length, tage, 'die Abfrage legt keinen Plan an');
  for (const x of ende().slice(0, 10)) Z.abschnittAbschliessen(x, Array(D.A[x].ayat).fill('ok'), 'frei');
  assert.equal(Z.lernErlaubt().ok, true, 'alles Fällige ist geübt: Neues darf beginnen');
});

test('Ḥifẓ-Tempo: nach der Umstellung eines älteren Stands zählt als Rückstau nur, was im neuen Modell schon geübt wurde (Audit M2)', () => {
  lektion(); rueckstau();
  Z.P.umgestellt = Z.plusTage(Z.heute(), -1);
  assert.equal(Z.lernErlaubt().ok, true);
});

test('Lektion fertig: der Abschnitt steht am Folgetag im Plan, bei jedem Pensum und ohne Fehlermarke (Audit H2)', () => {
  for (const pensum of [1, 2, 3, 5]) {
    frisch({ bereich: ende(), pensum }); const id = Z.lernVorschlag(); assert.ok(Z.lernBeginnen(id));
    for (let i = 0; i < 3; i++) { if (i) naechsterTag(); lauf(id); wirdErfuellen(); }
    assert.equal(Z.karte(id).kon, Z.plusTage(Z.heute(), 1)); assert.equal(Z.karte(id).S, Z.MODELL.sLern);
    naechsterTag();
    const t = Z.tagesplan();
    assert.ok(t.plan.includes(id), `Pensum ${pensum}: der gelernte Abschnitt ist am Folgetag dran`);
    assert.equal(t.art[id], 'zyklus'); assert.equal(t.ma[id], 'lektion');
    Z.abschnittAbschliessen(id, Array(D.A[id].ayat).fill('ok'));
    assert.equal(Z.karte(id).kon, null); assert.ok(Z.karte(id).S > Z.MODELL.sLern);
  }
});

test('Gelernter Abschnitt steht in Bestand und Auswahl und lässt sich wieder abwählen (Audit Abl. 14)', () => {
  frisch({ bereich: ende() });
  const von = D.A[ende()[0]].v[0], bis = D.A.at(-1).v[1];
  Z.P.einst.auswahl = [[von, bis]]; Z.speichern();
  const id = Z.lernVorschlag(); assert.ok(Z.lernBeginnen(id));
  for (let i = 0; i < 3; i++) { if (i) naechsterTag(); lauf(id); }
  assert.ok(Z.P.einst.bereich.includes(id), 'in einst.bereich');
  assert.ok(Z.P.einst.auswahl.some(([a, b]) => a <= D.A[id].v[0] && b >= D.A[id].v[1]), 'in einst.auswahl');
  assert.ok(!Z.P.log.some(e => e.y === 'ei' && e.k === 'einst.bereich'), 'die Aufnahme steckt im Abschluss, kein eigener Eintrag');
  Z.P.einst.bereich = Z.P.einst.bereich.filter(x => x !== id); Z.speichern();
  assert.equal(Z.imBereich(id), false); assert.ok(!Z.reihe().includes(id));
  assert.ok(Z.lernbar(id), 'wieder abgewählt: lässt sich neu lernen');
  assert.ok(Z.lernBeginnen(id)); assert.equal(Z.P.lern[id].ph, 0);
});

test('Ältere Stände: fertige Lektionen zählen weiter zum Bestand und werden einmal übernommen', () => {
  frisch({ bereich: ende() });
  const id = Z.lernVorschlag();
  delete Z.P.lernIm; Z.P.lern[id] = { b: '2026-01-01', ph: 2, ft: ['2026-01-01', '2026-01-02', '2026-01-03'], e: '2026-01-03' };
  assert.ok(Z.imBereich(id) && !Z.P.einst.bereich.includes(id));
  assert.equal(Z.lernUebernehmen(), true);
  assert.ok(Z.P.einst.bereich.includes(id)); assert.equal(Z.P.lernIm, 1);
  assert.equal(Z.lernUebernehmen(), false);
});

test('Offene Lektion im Bestand: der Abschnitt gehört noch nicht zur Reihe, die Ḫatma bleibt erreichbar (Audit Abl. 15)', () => {
  frisch({ bereich: ende(), pensum: 30 });
  const id = Z.lernVorschlag(); assert.ok(Z.lernBeginnen(id));
  Z.P.einst.bereich = [id, ...ende()]; Z.speichern();
  assert.ok(Z.imBereich(id) && !Z.reihe().includes(id));
  assert.equal(Z.khatmaFortschritt().gesamt, 30);
  wirdErfuellen();
  assert.equal(Z.P.zyklus.khatma, 1);
});
