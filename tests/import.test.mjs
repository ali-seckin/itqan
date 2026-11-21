// Itqān · Profildatei und fremde Stände: strenge Prüfung von Form und Typ (Audit H3, Sicherheit S1, S9; Abläufe Nr. 11)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { Z, D, frisch, naechsterTag, wirdErfuellen, gliederungSetzen, lies } from './umgebung.mjs';

const kopie = x => JSON.parse(JSON.stringify(x));
const BOESE = '<img src=x onerror=alert(document.domain)>';
async function datei(profil) {   // Datei mit richtig berechneter Prüfsumme, wie sie jemand mit etwas Geschick herstellt
  const b = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(profil)));
  const pruef = [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  return JSON.stringify({ format: 'itqan-profil', version: 1, exportiert: '2026-11-21T00:00:00.000Z', pruef, profil });
}
// ein Profil mit allem, was im Betrieb entsteht
function reich() {
  frisch({ pensum: 3, bereich: D.A.slice(-40).map(e => e.id), name: 'Schülerin O\'Brien <3' });
  const fehler = (i, id) => i === 0 ? 'fehler' : i === 1 ? 'hilfe' : i === 2 ? 'zoegern' : 'ok';
  wirdErfuellen(fehler); Z.fehlerstellenMerken(['6200.1', '6201.0'], 'verwechslung', 6100); Z.unterscheidenMerken('6100-6200', true);
  naechsterTag(); wirdErfuellen(); Z.kurzBuchen('seite', 1);
  const id = Z.lernVorschlag(); Z.lernBeginnen(id); Z.abschnittAbschliessen(id, Array(D.A[id].ayat).fill('ok'), 'lern');
  naechsterTag(); Z.pauseBeginnen(3); Z.tagesplan(); Z.pauseBeenden(); wirdErfuellen();
  Z.P.einst.pensum[4] = 0; Z.P.einst.erinnerung = '06:15'; Z.speichern();
  naechsterTag(5); wirdErfuellen(); Z.comebackBeenden();
  return Z.P;
}

test('profilPruefen: ein Profil aus dem Betrieb, ein frisches und ein Stand aus 1.98 bestehen', () => {
  assert.equal(Z.profilPruefen(kopie(reich())).name, 'Schülerin O\'Brien <3');
  frisch(); assert.ok(Z.profilPruefen(kopie(Z.P)));
  const F = lies('tests/fixtures/profil_1.98_klassisch.json');
  assert.ok(Z.profilPruefen(F.ende)); assert.ok(Z.profilPruefen(F.sockel));
  assert.ok(Z.profilPruefen({ ...F.sockel, log: F.log }), 'auch mit Protokoll, wie der Stand vom Konto');
});

test('profilPruefen: Stand nach einem Wechsel der Gliederung besteht', async () => {
  reich();
  gliederungSetzen('seite'); await Z.gliederungAbgleichen();
  assert.ok(Z.profilPruefen(kopie(Z.P)));
  gliederungSetzen('fort');
});

test('importDatei: Sicherung hin und zurück, echt nur bei unveränderter Datei', async () => {
  const p = kopie(reich()), text = await Z.exportDatei();
  const r = await Z.importDatei(text);
  assert.equal(r.echt, true); assert.ok(Date.parse(r.exportiert) > 0);
  assert.deepEqual(r.profil, { ...p, log: [] });
  const o = JSON.parse(text); o.profil.summe.punkte += 1000;
  assert.equal((await Z.importDatei(JSON.stringify(o))).echt, false);
  // Die Prüfsumme hat kein Geheimnis: wer sie neu berechnet, bekommt wieder „echt“. Sie ist kein Echtheitsnachweis (Audit S9).
  assert.equal((await Z.importDatei(await datei(o.profil))).echt, true);
});

test('importDatei: Text statt Zahl, Markup und fremde Formen werden abgelehnt (Audit S1)', async () => {
  const gut = kopie(reich()); gut.log = [];
  assert.ok(await Z.importDatei(await datei(gut)));
  const faelle = {
    'Kette als Text': p => { p.kette.n = BOESE; },
    'Ḫatma als Text': p => { p.zyklus.khatma = BOESE; },
    'Punkte als Text': p => { p.summe.punkte = BOESE; },
    'Abschnitte als Text': p => { p.summe.abschnitte = '7'; },
    'Erinnerung mit Markup': p => { p.einst.erinnerung = BOESE; },
    'erstellt mit Markup': p => { p.erstellt = BOESE; },
    'Zeitpunkt, der keiner ist': p => { p.erstellt = 'gestern'; },
    'Attribut im Text': p => { p.einst.thema = 'x" onmouseover="alert(1)'; },
    'unbekanntes Feld mit Markup': p => { p.neuesFeld = { tief: [BOESE] }; },
    'unbekannte Einstellung mit Markup': p => { p.einst.irgendwas = BOESE; },
    'Tag mit falschem Schlüssel': p => { p.tage[BOESE] = { plan: [], art: {}, fertig: [] }; },
    'Art mit Markup': p => { const t = Object.values(p.tage)[0]; t.art[t.plan[0]] = BOESE; },
    'Plan mit Text': p => { Object.values(p.tage)[0].plan = ['1']; },
    'Stufe außerhalb': p => { Object.values(p.karten)[0].st = 9; },
    'Stabilität als Text': p => { Object.values(p.karten)[0].S = '25'; },
    'Datum der Karte': p => { Object.values(p.karten)[0].zul = BOESE; },
    'Karte mit falscher Nummer': p => { p.karten['__proto__x'] = { st: 0, n: 0 }; },
    'Pensum mit sechs Tagen': p => { p.einst.pensum = [3, 3, 3, 3, 3, 3]; },
    'Pensum mit Text': p => { p.einst.pensum[0] = '3'; },
    'Bestand als Text': p => { p.einst.bereich = 'alles'; },
    'Modus unbekannt': p => { p.einst.modus = 'irgendwie'; },
    'Gliederung unbekannt': p => { p.gliederung = '../boese'; },
    'Meile mit Markup': p => { p.meilen.push(BOESE); },
    'Rang als Text': p => { p.rangBeste = { r: BOESE, d: '2026-01-05' }; },
    'Fehlerstelle mit Text': p => { Object.values(p.fstellen)[0].n = 'viele'; },
    'Name mit Steuerzeichen': p => { p.name = 'a\u0000b'; },
    'Name zu lang': p => { p.name = 'x'.repeat(500); },
    'ohne Tage': p => { delete p.tage; },
    'ohne Karten': p => { delete p.karten; },
    'ohne Summe': p => { delete p.summe; },
    'ohne Kette': p => { delete p.kette; },
    'Zyklus leer': p => { p.zyklus = {}; },
    'ohne Pensum': p => { delete p.einst.pensum; },
  };
  for (const [name, aendern] of Object.entries(faelle)) {
    const p = kopie(gut); aendern(p);
    await assert.rejects(async () => Z.importDatei(await datei(p)), e => e instanceof Error && !e.message.includes('<'), name);
    assert.throws(() => Z.profilPruefen(p), name);
  }
  // die Datei aus dem Audit (S1) und die Minimaldatei (Abläufe Nr. 11)
  await assert.rejects(Z.importDatei('{"format":"itqan-profil","version":1,"exportiert":"2026-11-21T00:00:00Z","pruef":"x","profil":{"format":"itqan","name":"Schüler","kette":{"n":"<img src=x onerror=alert(document.domain)>"},"summe":{"abschnitte":1},"zyklus":{"khatma":0},"tage":{}}}'));
  await assert.rejects(Z.importDatei(JSON.stringify({ format: 'itqan-profil', profil: { format: 'itqan', einst: { pensum: [3, 3, 3, 3, 3, 3, 3] }, zyklus: {} } })));
  for (const unsinn of ['', 'kein json', '5', 'null', '[]', '{}', '{"format":"itqan-profil"}', '{"format":"itqan-profil","profil":5}', 'x'.repeat(9e6)])
    await assert.rejects(Z.importDatei(unsinn), Error, unsinn.slice(0, 20));
  await assert.rejects(Z.importDatei(5)); await assert.rejects(Z.importDatei(undefined));
});

test('importDatei: nennt das Feld, verändert nichts, der geprüfte Stand läuft', async () => {
  const p = kopie(reich()); p.log = [];
  const vorher = JSON.stringify(p);
  Z.profilPruefen(p); assert.equal(JSON.stringify(p), vorher);
  p.kette.n = 'x';
  try { Z.profilPruefen(p); assert.fail('hätte werfen müssen'); } catch (e) { assert.equal(e.feld, 'kette'); }
  const r = await Z.importDatei(await datei(JSON.parse(vorher)));
  Z.ersetzeProfil(r.profil, r.exportiert);
  assert.doesNotThrow(() => { naechsterTag(); wirdErfuellen(); Z.kennzahlen(); Z.rueckblick(); });
});

test('Einstellungs-Einträge aus dem Protokoll: Werte falscher Form werden beim Nachbau übergangen (Audit S1)', () => {
  frisch({ pensum: 3 });
  const sockel = kopie({ ...Z.P, log: [] });
  const e = (n, k, w) => ({ i: 'fremd-' + String(n).padStart(6, '0'), z: 1000 + n, y: 'ei', k, ...(w === undefined ? {} : { w }) });
  const p = Z.nachbau(sockel, [
    e(1, 'einst.modus', '<img>'), e(2, 'einst.pensum', [1, 2]), e(3, 'einst.pensum', 'viel'), e(4, 'einst.bereich', { a: 1 }), e(5, 'einst.thema', BOESE),
    e(6, 'name', 'a\u0001b'), e(7, 'einst.__proto__.x', 1), e(8, 'karten', {}), e(9, 'einst.tagesbeginn', 99),
    e(10, 'einst.textGroesse', 125), e(11, 'name', 'Neuer Name'), e(12, 'einst.pensum', [2, 2, 2, 2, 2, 0, 0]), e(13, 'einst.bereich', [1, 2, 3]),
  ]);
  assert.equal(p.einst.modus, 'fort'); assert.equal(p.einst.thema, 'auto'); assert.equal(p.einst.tagesbeginn, 3);
  assert.equal(p.einst.textGroesse, 125); assert.equal(p.name, 'Neuer Name');
  assert.deepEqual(p.einst.pensum, [2, 2, 2, 2, 2, 0, 0]); assert.deepEqual(p.einst.bereich, [1, 2, 3]);
  assert.ok(!('karten' in p.einst) && ({}).x === undefined);
});
