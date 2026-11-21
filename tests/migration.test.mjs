// Itqān · Umstellung älterer Stände auf das eine Lernmodell (Audit M1, M2, M3). Prüfdaten: tests/fixtures/profil_1.98_klassisch.json,
// erzeugt mit dem Code von 1.98 (Commit c130eb7): 40 Tage Pensum 3 mit erfundenen Fehlern, Sockel nach 20 Tagen, Protokoll der zweiten 20 Tage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Z, D, lies, gliederungSetzen, tagSetzen, tagSetzenZurueck, naechsterTag, wirdErfuellen } from './umgebung.mjs';

const F = lies('tests/fixtures/profil_1.98_klassisch.json'), kopie = x => JSON.parse(JSON.stringify(x));
function altLaden() {
  localStorage.clear(); gliederungSetzen('fort'); tagSetzen(F.letzterTag); tagSetzenZurueck();
  localStorage.setItem('itqan-profil-v1', JSON.stringify(F.ende));
  return Z.laden();
}

test('Die Prüfdaten sind ein Stand aus 1.98: alte Fehlerwiederholung, entfernte Einstellungen, keine Schemamarke', () => {
  assert.ok(Object.values(F.ende.karten).filter(k => k.fae).length > 10);
  assert.equal(F.ende.einst.schwaechen, 'ausgewogen'); assert.equal(F.ende.zyklus.konto != null, true); assert.equal(F.ende.schema, undefined);
});

test('Laden eines Stands aus 1.98: fae wird aufgeräumt, Reste entfernter Einstellungen verschwinden, nichts wird NaN (Audit M1, M2)', () => {
  const p = altLaden();
  assert.equal(p.schema, Z.SCHEMA);
  const karten = Object.values(p.karten);
  assert.equal(karten.length, Object.keys(F.ende.karten).length, 'kein Lernstand geht verloren');
  assert.ok(karten.every(k => !('fae' in k) && !('fs' in k)));
  assert.ok(karten.every(k => Number.isFinite(Z.stabilitaet(k)) && Z.stabilitaet(k) > 0));
  for (const [id, k] of Object.entries(p.karten)) { const a = F.ende.karten[id]; assert.deepEqual([k.st, k.n, k.fe, k.zul, k.S], [a.st, a.n, a.fe, a.zul, a.S]); }
  assert.ok(!('schwaechen' in p.einst) && !('rhythmus' in p.einst) && !('zielQuote' in p.einst) && !('konto' in p.zyklus));
  assert.equal(p.umgestellt, karten.map(k => k.zul).sort().at(-1));
  assert.deepEqual(p.summe, F.ende.summe); assert.deepEqual(p.kette, F.ende.kette);
  assert.equal(Z.kennzahlen().offen, 0, 'keine offene Fehlerwiederholung aus der alten Zeit');
  assert.ok(Z.schwaechste(8).every(x => Number.isFinite(x.w)));
  // zweites Laden ändert nichts mehr
  Z.speichern(); const einmal = JSON.stringify(Z.P); Z.laden(); assert.equal(JSON.stringify(Z.P), einmal);
});

test('Nach dem Update: der erste Plan ist plausibel, neue Lektionen sind nicht dauerhaft gesperrt (Audit M2)', () => {
  altLaden();
  assert.equal(Z.lernErlaubt().ok, true, 'Altbestand zählt nicht als Rückstau');
  const t = Z.tagesplan();
  assert.ok(t.plan.length >= 2 && new Set(t.plan).size === t.plan.length && t.plan.every(id => D.A[id]));
  // Mit 1.99 ohne Umstellung war an jedem Tag gesperrt (Audit: 120 von 120). Jetzt zählt nur, was im neuen Modell geübt und wieder fällig ist.
  let frei = 0;
  for (let i = 0; i < 10; i++) { wirdErfuellen(); naechsterTag(); if (Z.lernErlaubt().ok) frei++; else assert.equal(Z.lernErlaubt().grund, 'rueckstau'); if (i < 3) assert.equal(Z.lernErlaubt().ok, true, `Tag ${i + 1}`); }
  assert.ok(frei >= 5, `an ${frei} von 10 Tagen frei`);
  assert.ok(Object.values(Z.P.karten).every(k => !('fae' in k) && Number.isFinite(k.S)));
  assert.equal(Z.kennzahlen().offen, 0);
  assert.ok(Z.profilPruefen(kopie(Z.P)));
});

test('Karte mit alter Fehlerwiederholung: fehlerfrei geübt, danach ist nichts mehr offen (Audit M1)', () => {
  localStorage.clear(); gliederungSetzen('fort'); tagSetzen('2026-11-20'); tagSetzenZurueck();
  const alt = kopie(F.ende);
  alt.karten = { 3: { st: 1, n: 3, fe: 2, zul: '2026-11-10', fae: '2026-11-19', fs: 1, fa: [], S: 10 } };
  localStorage.setItem('itqan-profil-v1', JSON.stringify(alt)); Z.laden();
  assert.equal(Z.abschnittStand(3), 'fehler', 'ohne lf bleibt die Anzeige bis zum nächsten Durchgang');
  Z.abschnittAbschliessen(3, Array(D.A[3].ayat).fill('ok'), 'frei');
  assert.equal(Z.kennzahlen().offen, 0); assert.notEqual(Z.abschnittStand(3), 'fehler');
  assert.ok(!('fae' in Z.karte(3)));
});

test('Nachbau aus Sockel und Protokoll von 1.98: kein fae entsteht neu, Punkte und Stufen bleiben, der Stand ist umgestellt (Audit M3)', () => {
  localStorage.clear(); gliederungSetzen('fort'); tagSetzen(F.letzterTag); tagSetzenZurueck();
  const p = Z.nachbau(F.sockel, F.log);
  assert.equal(p.schema, Z.SCHEMA);
  assert.ok(Object.values(p.karten).every(k => !('fae' in k) && !('fs' in k) && Number.isFinite(k.S)));
  assert.deepEqual(p.summe, F.ende.summe); assert.deepEqual(p.kette, F.ende.kette);
  for (const [id, k] of Object.entries(p.karten)) assert.equal(k.st, F.ende.karten[id].st, `Stufe von Abschnitt ${id}`);
  assert.ok(!('schwaechen' in p.einst));
  // derselbe Nachbau ergibt immer dasselbe (die Umstellung rechnet nicht mit der Uhr)
  tagSetzen('2027-03-01'); tagSetzenZurueck();
  assert.deepEqual(kopie(Z.nachbau(F.sockel, F.log)), kopie(p));
  // neue Abschlüsse tragen den Stand der Regeln
  localStorage.setItem('itqan-profil-v1', JSON.stringify(F.ende)); Z.laden();
  Z.abschnittAbschliessen(0, Array(D.A[0].ayat).fill('ok'), 'frei');
  assert.equal(Z.P.log.at(-1).m, Z.MODELL_STAND);
});
