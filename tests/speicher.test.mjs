// Itqān · Speichern und Laden nach dem Audit 1.99: Schreibfehler melden, zwei Reiter, beschädigter Stand, falsche Uhr
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Z, D, frisch, naechsterTag, wirdErfuellen, tagSetzenZurueck } from './umgebung.mjs';

after(() => { Z.speicherSetzen(null); Z.speicherFehlerHakenSetzen(null); Z.fremdeAenderungHakenSetzen(null); Z.logGrenze(0); tagSetzenZurueck(); });
const ok = id => Array(D.A[id].ayat).fill('ok');
const PROFIL = 'itqan-profil-v1';
// Ablage mit begrenztem Platz (Summe aller Werte), wie localStorage bei vollem Speicher
function ablage(grenze = Infinity) {
  const m = new Map(), a = {
    grenze, m, summe: () => [...m.values()].reduce((s, v) => s + v.length, 0),
    lesen: k => m.has(k) ? m.get(k) : null,
    schreiben: (k, v) => { if (a.summe() - (m.get(k)?.length || 0) + v.length > a.grenze) throw new DOMException('voll', 'QuotaExceededError'); m.set(k, v); },
    entfernen: k => m.delete(k)
  };
  return a;
}

test('Speichern scheitert: Rückgabe false, der Haken wird einmal gerufen, nichts wirft (Audit H4)', () => {
  const a = ablage(), rufe = []; let warnungen = 0;
  Z.speicherSetzen(a); tagSetzenZurueck();
  Z.neuesProfil({ name: 'Voll', pensum: 1 });
  Z.speicherFehlerHakenSetzen(x => rufe.push(x));
  assert.equal(Z.speichern(), true); assert.equal(rufe.length, 0);
  const warn = console.warn; console.warn = () => { warnungen++; };
  try {
    a.grenze = 10;                                   // ab jetzt passt nichts mehr
    assert.equal(Z.speichern(), false);
    assert.equal(rufe.length, 1); assert.equal(rufe[0].art, 'profil'); assert.equal(rufe[0].fehler.name, 'QuotaExceededError');
    const id = Z.P.tage[Z.heute()]?.plan[0] ?? 0;
    assert.doesNotThrow(() => Z.abschnittAbschliessen(id, ok(id), 'frei'));
    assert.ok(rufe.length >= 2, 'auch der Abschluss meldet, dass er nicht gespeichert ist');
    assert.equal(Z.zwischenstandSpeichern(1, '', ['ok']), false); assert.equal(rufe.at(-1).art, 'zwischenstand');
    assert.equal(Z.schnappschuss('Test'), false); assert.equal(rufe.at(-1).art, 'schnappschuss');
  } finally { console.warn = warn; Z.speicherFehlerHakenSetzen(null); Z.speicherSetzen(null); }
  assert.ok(warnungen > 0);
});

test('Speicher voll: ältere Schnappschüsse weichen, der jüngste bleibt, das Profil wird geschrieben (Audit H4)', () => {
  const a = ablage(), rufe = [];
  Z.speicherSetzen(a); tagSetzenZurueck();
  Z.neuesProfil({ name: 'Eng', pensum: 1 });
  for (const g of ['eins', 'zwei', 'drei']) { Z.schnappschuss(g); naechsterTag(); }
  assert.equal(Z.schnappschuesse().length, 3);
  Z.speicherFehlerHakenSetzen(x => rufe.push(x));
  try {
    a.grenze = a.summe() - Math.round(Z.schnappschuesse()[0].daten.length / 2);   // ein halber Schnappschuss zu viel
    assert.equal(Z.speichern(), true);
    assert.equal(rufe.length, 0);
    assert.equal(Z.schnappschuesse().length, 2);
    assert.equal(Z.schnappschuesse()[0].grund, 'drei', 'der jüngste bleibt');
    assert.equal(JSON.parse(a.lesen(PROFIL)).name, 'Eng');
  } finally { Z.speicherFehlerHakenSetzen(null); Z.speicherSetzen(null); }
});

test('Zwei Reiter: kein Abschluss geht verloren, keine Kennung wird doppelt vergeben (Audit H5)', async () => {
  frisch({ pensum: 2 });
  const [a, b] = Z.tagesplan().plan, d = Z.heute(), meldungen = [];
  const Z2 = await import('../js/zustand.js?reiter=2');
  Z2.uhrSetzen(() => Z.jetzt()); Z2.laden();
  Z2.fremdeAenderungHakenSetzen(x => meldungen.push(x));
  Z.abschnittAbschliessen(a, ok(a));                 // Reiter 1
  Z2.abschnittAbschliessen(b, ok(b));                // Reiter 2 kennt den Abschluss von Reiter 1 nicht
  let g = JSON.parse(localStorage.getItem(PROFIL));
  assert.deepEqual([...g.tage[d].fertig].sort((x, y) => x - y), [a, b].sort((x, y) => x - y));
  assert.equal(g.summe.abschnitte, 2); assert.ok(g.karten[a] && g.karten[b]);
  assert.equal(new Set(g.log.map(e => e.i)).size, g.log.length, 'jede Kennung einmal');
  assert.deepEqual(meldungen.map(x => x.art), ['nachgeladen']);
  // Reiter 1 schreibt wieder: er holt zuerst den Stand von Reiter 2
  Z.unterscheidenMerken('1-2', true);
  assert.equal(Z.P.summe.abschnitte, 2);
  // storage-Ereignis: Reiter 2 lädt nach
  assert.equal(Z2.speicherEreignis('fremder-schluessel'), false);
  assert.equal(Z2.speicherEreignis(PROFIL), true);
  assert.ok(Z2.P.mutash['1-2']);
  assert.equal(Z2.speicherEreignis(PROFIL), false, 'nichts Neues');
  // eine noch nicht gespeicherte Einstellung in Reiter 2 überlebt das Nachladen
  Z2.P.einst.textGroesse = 125;
  Z.unterscheidenMerken('1-3', true);
  assert.equal(Z2.speichern(), true);
  g = JSON.parse(localStorage.getItem(PROFIL));
  assert.equal(g.einst.textGroesse, 125); assert.ok(g.mutash['1-3']);
  assert.equal(new Set(g.log.map(e => e.i)).size, g.log.length);
  // Löschen in Reiter 1: Reiter 2 erfährt es über das Ereignis
  Z.loeschen();
  assert.equal(Z2.speicherEreignis(null), true); assert.equal(Z2.P, null);
  Z2.fremdeAenderungHakenSetzen(null);
});

test('Beschädigter Stand: laden wirft nie, die Rohdaten werden beiseitegelegt (Audit M9)', () => {
  const warn = console.warn; console.warn = () => {};
  try {
    for (const roh of ['{"format":"itqan","einst":{"pens', '5', '"text"', '[]', '{}', '{"einst":{"pensum":[3,3,3,3,3,3,3]}}']) {
      localStorage.clear(); localStorage.setItem(PROFIL, roh);
      assert.doesNotThrow(() => Z.laden(), roh);
      assert.equal(Z.P, null, roh);
      assert.equal(Z.ladeMeldung().art, 'defekt'); assert.equal(Z.ladeMeldung().gesichert, true);
      assert.equal(Z.defektLesen().roh, roh);
      // ein neues Profil überschreibt den Schlüssel, die Rohdaten bleiben
      Z.neuesProfil({ pensum: 1 });
      assert.equal(Z.defektLesen().roh, roh);
      Z.defektVerwerfen(); assert.equal(Z.defektLesen(), null);
    }
  } finally { console.warn = warn; }
  // gültiges JSON mit Lücken: der Stand wird aufgefüllt, alle Kernfunktionen laufen
  for (const roh of ['{"format":"itqan","einst":{}}', '{"format":"itqan","einst":{"pensum":[2,2,2,2,2,2,2]},"zyklus":{}}', '{"format":"itqan","einst":{"pensum":"viel"},"tage":{"2026-01-05":5},"kette":7,"summe":{"punkte":"x"}}']) {
    localStorage.clear(); localStorage.setItem(PROFIL, roh);
    assert.doesNotThrow(() => Z.laden(), roh);
    assert.ok(Z.P, roh); assert.equal(Z.ladeMeldung(), null);
    assert.doesNotThrow(() => { Z.tagesplan(); Z.kennzahlen(); Z.heuteAusserhalb(); Z.schnappschuss('Test'); Z.rueckblick(); wirdErfuellen(); }, roh);
    assert.ok(Z.P.kette.n >= 1);
  }
  localStorage.clear(); assert.equal(Z.laden(), null); assert.equal(Z.ladeMeldung(), null);
});

test('Lehreransicht: ergaenzen macht auch ein lückenhaftes fremdes Profil auswertbar (Audit Abl. 11)', () => {
  frisch();
  const fremd = Z.ergaenzen({ format: 'itqan', einst: { pensum: [3, 3, 3, 3, 3, 3, 3] }, zyklus: {} });
  assert.doesNotThrow(() => Z.mitProfil(fremd, () => { Z.kennzahlen(); Z.rueckblick(); Z.schwaechste(); Z.profilUeberblick(fremd); }));
});

test('Profil löschen nimmt den Zwischenstand mit (Audit N9)', () => {
  frisch();
  Z.zwischenstandSpeichern(4, '', ['ok']);
  assert.ok(Z.zwischenstand());
  Z.loeschen();
  assert.equal(localStorage.getItem('itqan-zwischenstand'), null);
  assert.equal(localStorage.getItem(PROFIL), null);
});

test('Falsch gestellte Uhr: der Tagesverlauf bleibt, die Zeit des Geräts lässt sich zurückholen (Audit M4, S13)', () => {
  frisch({ pensum: 2 });
  for (let i = 0; i < 20; i++) { wirdErfuellen(); naechsterTag(); }
  const vorher = Object.keys(Z.P.tage).length, echt = Z.jetzt().getTime();
  assert.equal(Z.uhrSprung(), 1);
  Z.uhrSetzen(() => new Date(2031, 2, 1, 12));
  assert.ok(Z.uhrSprung() > 1500, 'der Sprung ist vor dem Planen erkennbar');
  Z.tagesplan();                                     // die App wird nur geöffnet
  assert.equal(Object.keys(Z.P.tage).length, vorher + 1, 'kein Tag gelöscht');
  wirdErfuellen();                                   // selbst wenn geübt wird, gehen höchstens sieben Tage je Plan
  Z.uhrSetzen(() => new Date(2031, 2, 2, 12)); Z.tagesplan();
  assert.ok(Object.keys(Z.P.tage).length >= vorher + 2 - 7);
  tagSetzenZurueck();
  assert.ok(Z.behaltensquote(30).n > 0);
  // die Zeit des Geräts steht in der Zukunft; kennt der Abgleich die Zeit des Servers, zieht er sie zurück
  Z.unterscheidenMerken('1-2', true);
  assert.equal(new Date(Z.P.log.at(-1).z).getFullYear(), 2031);
  assert.equal(Z.geraetUhrKorrigieren(echt), true);
  Z.unterscheidenMerken('1-3', true);
  assert.equal(new Date(Z.P.log.at(-1).z).getFullYear(), 2026);
  assert.equal(Z.geraetUhrKorrigieren(echt), false, 'liegt die Zeit nicht voraus, bleibt sie');
});
