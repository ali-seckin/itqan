// Itqān · Modus „Ganze Seiten“: Seiten-Gliederung je Druck, Zählung nach Seiten, Wechsel hin und zurück, Nachbau aus dem Protokoll
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Z, D, lies, frisch, gliederungSetzen, naechsterTag, wirdErfuellen, tagSetzenZurueck } from './umgebung.mjs';

const daten = await import('../js/daten.js');
const { tx } = await import('../js/sprache.js');
const rund = x => JSON.parse(JSON.stringify(x));
const stand = () => rund({ ...Z.P, log: [] });
const ayat = (bereiche, ids) => new Set(ids.flatMap(id => { const [a, b] = bereiche[id]; return Array.from({ length: b - a + 1 }, (_, i) => a + i); }));
const alleFa = () => [...new Set(Object.values(Z.P.karten).flatMap(k => k.fa || []))].sort((a, b) => a - b);
after(() => { Z.logGrenze(0); gliederungSetzen('fort'); tagSetzenZurueck(); });

// einige Tage üben, mit Fehlern und markierten Wörtern
function tageUeben(tage) {
  for (let t = 0; t < tage; t++) {
    const plan = Z.tagesplan();
    for (const id of plan.plan.filter(x => !plan.fertig.includes(x))) {
      const e = D.A[id], fehler = (id + t) % 3 === 0;
      if (fehler) Z.fehlerstellenMerken([`${e.v[0]}.0`], 'haraka');
      Z.abschnittAbschliessen(id, Array.from({ length: e.ayat }, (_, i) => fehler && i === 0 ? 'fehler' : i === 2 ? 'hilfe' : 'ok'), undefined, 60);
    }
    naechsterTag();
  }
}

for (const ausgabe of ['v1', 'v2']) {
  test(`Seiten-Gliederung ${ausgabe}: 604 Seiten, alle 6236 Āyāt genau einmal, jede Seite endet mit einem Āya-Ende`, () => {
    const A = lies(`daten/abschnitte_seite_${ausgabe}.json`), G = lies(`daten/gliederungen/seite-${ausgabe}.json`), L = lies(`daten/layout_${ausgabe}.json`), V = lies('daten/verse.json');
    assert.equal(A.length, 604);
    assert.deepEqual(G, A.map(e => e.v));
    assert.deepEqual(A.flatMap(e => Array.from({ length: e.v[1] - e.v[0] + 1 }, (_, i) => e.v[0] + i)), Array.from({ length: 6236 }, (_, i) => i));
    A.forEach((e, i) => {
      assert.equal(e.id, i); assert.equal(e.seite, i + 1); assert.equal(e.ayat, e.v[1] - e.v[0] + 1);
      // die Wörter der Seite im Layout gehören genau zu den Āyāt der Einheit: keine Āya läuft über den Seitenrand
      const vs = L[i].filter(z => z?.w).flatMap(z => z.w.map(w => w[1]));
      assert.equal(Math.min(...vs), e.v[0]); assert.equal(Math.max(...vs), e.v[1]);
      assert.deepEqual(e.von, V[e.v[0]].slice(0, 2)); assert.deepEqual(e.bis, V[e.v[1]].slice(0, 2));
    });
  });
}

test('Seiten-Modus: Einheiten heißen nach der Seitenzahl, die Meldungen zählen Seiten', () => {
  frisch({ modus: 'seite' });
  assert.equal(D.gliederung, 'seite-v2'); assert.equal(Z.P.gliederung, 'seite-v2'); assert.equal(Z.P.einst.modus, 'seite');
  assert.equal(D.A[4].titel, 'Seite 5');
  assert.equal(daten.abschnittName(D.A[4]), daten.sureName(2));
  assert.match(daten.abschnittName(D.A[603]), / bis /);          // letzte Seite: drei Sūren
  assert.equal(tx('allg.abschnitte'), 'Seiten');
  assert.equal(tx('heute.von_abschnitten', { fertig: 1, gesamt: 3 }), '1 von 3 Seiten');
  assert.equal(tx('allg.seiten'), 'Seiten');                      // Meldungen ohne eigene Fassung bleiben
  const t = Z.tagesplan();
  assert.equal(t.plan.length, 3); assert.deepEqual(t.plan, [0, 1, 2]);
  gliederungSetzen('fort');
  assert.equal(tx('allg.abschnitte'), 'Abschnitte');
  assert.equal(tx('heute.von_abschnitten', { fertig: 1, gesamt: 3 }), '1 von 3 Abschnitten');
});

test('Wechsel Abschnitte → Seiten → Abschnitte: Karten, Zyklus, Bereich, Tagesplan, Lektion und Fehlerstellen ziehen mit', async () => {
  frisch({ modus: 'fort', pensum: 5 });
  const fort = lies('daten/gliederungen/fort-2.json'), seiten = lies('daten/gliederungen/seite-v2.json');
  Z.P.einst.bereich = D.A.filter(e => e.juz <= 2).map(e => e.id); Z.speichern();
  const lektion = D.A.find(e => e.juz === 3).id;
  assert.equal(Z.lernBeginnen(lektion), true);
  tageUeben(8);
  Z.tagesplan();
  const vor = { karten: rund(Z.P.karten), fstellen: rund(Z.P.fstellen), summe: rund(Z.P.summe), kette: rund(Z.P.kette), bereich: [...Z.P.einst.bereich], erledigt: [...Z.P.zyklus.erledigt], fa: alleFa() };
  assert.ok(Object.keys(vor.fstellen).length > 0 && vor.fa.length > 0 && vor.erledigt.length > 0);

  gliederungSetzen('seite');
  assert.equal(await Z.gliederungAbgleichen(), true);
  assert.equal(Z.P.gliederung, 'seite-v2');
  assert.deepEqual(rund(Z.P.fstellen), vor.fstellen); assert.deepEqual(rund(Z.P.summe), vor.summe); assert.deepEqual(rund(Z.P.kette), vor.kette);
  assert.deepEqual(alleFa(), vor.fa);
  // eine Seite, die ganz in einem alten Abschnitt liegt, erbt dessen Stufe
  let geerbt = 0;
  seiten.forEach(([a, b], p) => { const o = fort.findIndex(([x, y]) => x <= a && y >= b); if (o >= 0 && vor.karten[o]) { assert.equal(Z.karte(p).st, vor.karten[o].st, `Seite ${p + 1}`); geerbt++; } });
  assert.ok(geerbt > 0);
  // der Bereich deckt alle bisherigen Āyāt, der Zyklus nennt nur Seiten, deren Abschnitte alle erledigt waren
  const neuB = ayat(seiten, Z.P.einst.bereich); for (const vi of ayat(fort, vor.bereich)) assert.ok(neuB.has(vi));
  const erlAlt = ayat(fort, vor.erledigt); for (const vi of ayat(seiten, Z.P.zyklus.erledigt)) assert.ok(erlAlt.has(vi));
  assert.ok(Z.P.zyklus.erledigt.length > 0);
  // die Lektion liegt jetzt auf den Seiten ihres Abschnitts
  const lSeiten = seiten.map((s, p) => p).filter(p => seiten[p][0] <= fort[lektion][1] && seiten[p][1] >= fort[lektion][0]);
  for (const p of lSeiten) assert.ok(Z.P.lern[p], `Lektion fehlt auf Seite ${p + 1}`);
  // im Seiten-Modus weiterüben: der Tagesplan zählt Seiten
  const t = Z.tagesplan(); assert.ok(t.plan.length > 0); for (const id of t.plan) assert.ok(id >= 0 && id < 604);
  const offen = t.plan.filter(x => !t.fertig.includes(x)).length;
  wirdErfuellen();
  assert.equal(Z.P.summe.abschnitte, vor.summe.abschnitte + offen);

  const mitte = { fstellen: rund(Z.P.fstellen), fa: alleFa() };
  gliederungSetzen('fort');
  assert.equal(await Z.gliederungAbgleichen(), true);
  assert.equal(Z.P.gliederung, 'fort-2');
  assert.deepEqual(rund(Z.P.fstellen), mitte.fstellen); assert.deepEqual(alleFa(), mitte.fa);
  const zurueckB = ayat(fort, Z.P.einst.bereich); for (const vi of ayat(fort, vor.bereich)) assert.ok(zurueckB.has(vi));
  assert.ok(Object.keys(Z.P.lern).length > 0);
  assert.ok(Z.tagesplan().plan.length > 0);
});

test('Wechsel hin und zurück: ein durchgehend gleich sicherer Bereich behält seine Stufe', async () => {
  frisch({ modus: 'fort' });
  const ids = D.A.filter(e => e.juz === 1).map(e => e.id);
  for (const id of ids) Z.P.karten[id] = { ...Z.karte(id), st: 3, n: 4 };
  Z.speichern();
  gliederungSetzen('seite'); await Z.gliederungAbgleichen();
  for (let p = 0; p < 20; p++) assert.equal(Z.karte(p).st, 3, `Seite ${p + 1}`);
  gliederungSetzen('fort'); await Z.gliederungAbgleichen();
  for (const id of ids.slice(0, -1)) { assert.equal(Z.karte(id).st, 3); assert.equal(Z.karte(id).n, 4); }
});

test('Wechsel der Druckausgabe im Seiten-Modus: gleiche Seiten behalten ihren Stand, andere bekommen den schwächsten ihrer Teile', async () => {
  frisch({ modus: 'seite' });
  const v2 = lies('daten/gliederungen/seite-v2.json'), v1 = lies('daten/gliederungen/seite-v1.json');
  for (let p = 0; p < 604; p++) Z.P.karten[p] = { ...Z.karte(p), st: 1 + p % 4, n: 2 };
  Z.speichern();
  gliederungSetzen('seite', 'v1');
  assert.equal(await Z.gliederungAbgleichen(), true);
  assert.equal(Z.P.gliederung, 'seite-v1');
  let anders = 0;
  v1.forEach(([a, b], p) => {
    const teile = v2.map((s, q) => q).filter(q => v2[q][0] <= b && v2[q][1] >= a);
    if (teile.length > 1 || teile[0] !== p || v2[p][0] !== a || v2[p][1] !== b) anders++;
    assert.equal(Z.karte(p).st, Math.min(...teile.map(q => 1 + q % 4)), `Seite ${p + 1}`);
  });
  assert.ok(anders > 0 && anders < 80);
});

test('Nachbau im Seiten-Modus: Sockel nach dem Wechsel und Einträge ergeben den gespeicherten Stand', async () => {
  Z.geraetSetzen('aaa'); Z.logGrenze(1e9);
  frisch({ modus: 'fort', pensum: 4 });
  Z.P.einst.bereich = D.A.filter(e => e.juz <= 3).map(e => e.id); Z.speichern();
  tageUeben(5);
  gliederungSetzen('seite'); await Z.gliederungAbgleichen();
  const sockel = stand();
  assert.equal(Z.P.log.length, 0);
  assert.equal(Z.lernBeginnen(D.A.find(e => e.juz === 4).id), true);
  tageUeben(12);
  assert.ok(Z.P.log.length > 30);
  assert.deepEqual(rund(Z.nachbau(sockel, Z.P.log)), stand());
  assert.deepEqual(rund(Z.nachbau(sockel, [...Z.P.log].reverse())), stand());
  Z.logGrenze(0);
});
