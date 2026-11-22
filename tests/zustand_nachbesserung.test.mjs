// Itqān · Nachbesserungen in zustand.js nach dem Nach-Audit von 2.00 (konzept/audit_1.99/nachaudit):
// Logik B2 (Übungstage mit Uhr weit in der Zukunft löschen keine echten Tage), Heute neu aufbauen nach teilweise erledigtem Wird.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Z, D, frisch, naechsterTag, tagSetzen, tagSetzenZurueck, wirdErfuellen } from './umgebung.mjs';

after(() => { tagSetzen('2026-01-05'); tagSetzenZurueck(); });
const kopie = x => JSON.parse(JSON.stringify(x));
const ueben = n => { for (let i = 0; i < n; i++) { wirdErfuellen(); naechsterTag(); } };
const echteTage = () => Object.keys(Z.P.tage).filter(d => Z.P.tage[d].fertig.length).sort();

// ---------- Logik B2 ----------
test('B2 Reproduktion 1: 20 Tage üben, Uhr 2028-06-01 bis 09 an neun Tagen üben, Uhr zurück: kein echter Tag fehlt', () => {
  for (const tage of [7, 9, 12]) {
    frisch({ pensum: 3 }); ueben(20);
    const echte = echteTage(); assert.equal(echte.length, 20);
    for (let i = 1; i <= tage; i++) {
      Z.uhrSetzen(() => new Date(2028, 5, i, 12)); Z.tagesplan(); wirdErfuellen();
      for (const d of echte) assert.ok(Z.P.tage[d]?.fertig.length, `Zukunftstag ${i}: der echte Tag ${d} fehlt`);
    }
    tagSetzenZurueck();
    for (let i = 0; i < 8; i++) {
      assert.ok(Z.tagesplan().plan.length > 0);
      wirdErfuellen();
      for (const d of echte) assert.ok(Z.P.tage[d]?.fertig.length, `danach: der echte Tag ${d} fehlt`);
      naechsterTag();
    }
  }
});

test('B2 Reproduktion 2 (Konto): ein zweites Gerät mit Uhr 2031 übt 6, 7 oder 10 Tage, zusammenführen: kein echter Tag fehlt', () => {
  for (const n of [6, 7, 10]) {
    frisch({ pensum: 3 });
    const sockel = kopie({ ...Z.P, log: [] });
    ueben(30);
    const echte = echteTage(), eigen = kopie(Z.P.log); assert.equal(echte.length, 30);
    const bekannt = new Set(eigen.map(e => e.i));
    for (let i = 1; i <= n; i++) { Z.uhrSetzen(() => new Date(2031, 2, i, 12)); Z.tagesplan(); wirdErfuellen(); }
    const fremd = kopie(Z.P.log).filter(e => !bekannt.has(e.i));
    assert.ok(fremd.some(e => e.d?.startsWith('2031')));
    tagSetzenZurueck();
    const { profil } = Z.zusammenfuehren(sockel, eigen, fremd);
    for (const d of echte) assert.ok(profil.tage[d]?.fertig.length, `${n} Tage: der echte Tag ${d} fehlt`);
    assert.ok(profil.tage['2031-03-01'], 'der Zukunftstag ist eingebaut');
    for (const d of echte) assert.ok(profil.verlauf[d] > 0, 'Verlauf bleibt');
  }
});

test('B2: eine lange Pause ist kein Zukunftstag: nach 30 Übungstagen danach weichen die alten Tage, vorher nicht', () => {
  frisch({ pensum: 1 }); ueben(12);
  const alt = echteTage(); assert.equal(alt.length, 12);
  tagSetzen('2028-01-10');                                            // zwei Jahre Pause, die Uhr stimmt
  for (let i = 0; i < 29; i++) { Z.tagesplan(); wirdErfuellen(); naechsterTag(); }
  assert.ok(alt.every(d => Z.P.tage[d]), 'bis zum dreißigsten Tag bleiben die alten Tage');
  Z.tagesplan(); wirdErfuellen(); naechsterTag();
  for (let i = 0; i < 3; i++) { Z.tagesplan(); wirdErfuellen(); naechsterTag(); }
  assert.ok(alt.some(d => !Z.P.tage[d]), 'danach wird verdichtet');
  assert.ok(alt.every(d => Z.P.verlauf[d] > 0), 'der Verlauf der Punkte bleibt');
});

// ---------- Heute neu aufbauen ----------
test('Reihenfolge ändern nach teilweise erledigtem Wird: erledigte Abschnitte bleiben und zählen, nur die offenen Plätze werden neu aufgebaut', () => {
  frisch({ pensum: 3 });
  const t = Z.tagesplan(), [a, b, c] = t.plan;
  for (const id of [a, b]) Z.abschnittAbschliessen(id, Array.from({ length: D.A[id].ayat }, () => 'ok'));
  const punkte = Z.tagesplan().punkte; assert.ok(punkte > 0);
  assert.deepEqual(Z.heuteZyklus(), { n: 3, fertig: 2, voll: false });
  Z.P.einst.reihenfolge = 'rueckwaerts';
  assert.equal(Z.heuteNeuAufbauen(), 1);
  const n = Z.tagesplan();
  assert.equal(n.plan.length, 3);
  assert.deepEqual([...n.fertig].sort(), [a, b].sort(), 'die zwei erledigten Abschnitte zählen weiter');
  assert.ok(n.plan.includes(a) && n.plan.includes(b) && !n.plan.includes(c));
  assert.equal(n.punkte, punkte);
  const neu = n.plan.find(id => ![a, b].includes(id));
  assert.equal(Z.karte(neu).n, 0); assert.ok(neu > 100, 'von hinten'); assert.equal(n.art[neu], 'zyklus');
  assert.deepEqual(Z.heuteZyklus(), { n: 3, fertig: 2, voll: false });
  // der neue Platz wird geübt: Wird erfüllt, alles zählt
  Z.abschnittAbschliessen(neu, Array.from({ length: D.A[neu].ayat }, () => 'ok'));
  assert.equal(Z.tagesplan().voll, true); assert.equal(Z.tagesplan().fertig.length, 3);
  // ein zweiter Aufruf ändert nichts mehr
  assert.equal(Z.heuteNeuAufbauen(), 0);
});

test('Reihenfolge ändern nach teilweise erledigtem Wird: derselbe Stand entsteht auch aus dem Protokoll (Nachbau)', () => {
  frisch({ pensum: 3 });
  const sockel = kopie({ ...Z.P, log: [] }), [a] = Z.tagesplan().plan;
  Z.abschnittAbschliessen(a, Array.from({ length: D.A[a].ayat }, () => 'ok'));
  Z.P.einst.reihenfolge = 'rueckwaerts'; Z.heuteNeuAufbauen();
  const nach = Z.nachbau(sockel, kopie(Z.P.log)), h = Z.heute();
  assert.deepEqual(nach.tage[h].plan, Z.P.tage[h].plan); assert.deepEqual(nach.tage[h].fertig, [a]);
});
