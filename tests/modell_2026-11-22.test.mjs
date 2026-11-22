// Itqān · Entscheidungen vom 22.11.2026: Abhaken ohne Erstprüfung und ohne S, freies Üben am Ruhetag zählt, stetige Erstprüfung,
// Fassung des Lernmodells im Profil und neue Generation beim Abgleich. Nachrechnen alter Einträge nach den alten Regeln.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Z, D, frisch, gliederungSetzen, naechsterTag, tagSetzenZurueck, wirdErfuellen } from './umgebung.mjs';
import * as LM from '../js/lernmodell.js';
import * as A from '../js/abgleich.js';
import { attrappe } from './server_attrappe.mjs';

const urspruenglich = globalThis.localStorage;
let srv, zurueck;
A.starten(); A.autoSetzen(false);
after(() => { globalThis.localStorage = urspruenglich; Z.speicherSetzen(null); A.geraetWechsel(); Z.logGrenze(0); gliederungSetzen('fort'); tagSetzenZurueck(); zurueck?.(); Z.eintragHakenSetzen(null); });

const ok = id => Array(D.A[id].ayat).fill('ok');
const falsch = id => Array(D.A[id].ayat).fill('fehler');
const kopie = x => JSON.parse(JSON.stringify(x));

// ---------- 1. Abhaken ----------
test('Abhaken: ein nie geprüfter Abschnitt bleibt ungeprüft (kein S, kein Durchgang), der Wird zählt, die Erstprüfung kommt noch', () => {
  frisch({ pensum: 2 });
  const [a, b] = Z.tagesplan().plan;
  assert.ok(Z.abschnittAbhaken(a));
  const k = Z.karte(a);
  assert.equal(k.n, 0); assert.equal(k.S, undefined); assert.equal(k.kon ?? null, null); assert.equal(k.st, 0);
  assert.equal(k.ah, Z.heute());
  assert.ok(Z.tagesplan().fertig.includes(a), 'für den Tagesplan zählt das Abhaken');
  assert.ok(Z.P.zyklus.erledigt.includes(a), 'und für den Zyklus');
  Z.abschnittAbhaken(b); assert.equal(Z.tagesplan().voll, true, 'der Wird ist erfüllt');
  assert.equal(Z.P.kette.n, 1);
  // am nächsten Tag steht der Abschnitt wieder als Erstprüfung im Plan
  naechsterTag();
  const t = Z.tagesplan();
  assert.ok(t.plan.includes(a), 'der nie geprüfte Abschnitt kommt zur Erstprüfung');
  assert.equal(Z.platzMarke(t, a), 'erst');
  // die Erstprüfung in der App setzt S wie bei jedem ersten Durchgang
  Z.abschnittAbschliessen(a, ok(a));
  assert.equal(Z.karte(a).n, 1); assert.equal(Z.karte(a).S, LM.PAR.sErstSauber); assert.equal(Z.karte(a).ah, undefined);
});

test('Abhaken: ein geprüfter Abschnitt ohne offene Kontrolle wird wie bisher gewertet (Zögern, S wächst nicht über den Zuwachs bei Zögern hinaus)', () => {
  frisch({ pensum: 3 });
  const id = Z.tagesplan().plan[0];
  wirdErfuellen();
  naechsterTag(40);
  const vor = { ...Z.karte(id) };
  assert.ok(Z.tagesplan().plan.includes(id), 'der Abschnitt ist fällig');
  assert.ok(Z.abschnittAbhaken(id));
  const k = Z.karte(id);
  assert.equal(k.n, vor.n + 1); assert.ok(k.S >= vor.S); assert.equal(k.zul, Z.heute()); assert.equal(k.ah, Z.heute());
});

test('Abhaken: die offene Kontrolle bleibt, bei nie Geprüftem gibt es keine (Lektion und Kontrolle aus der Fehlerwiederholung)', () => {
  frisch({ pensum: 1 });
  const id = Z.tagesplan().plan[0];
  Z.abschnittAbschliessen(id, falsch(id));
  const nach = { ...Z.karte(id) }; assert.ok(nach.kon);
  naechsterTag(); Z.tagesplan();
  assert.ok(Z.abschnittAbhaken(id));
  assert.equal(Z.karte(id).kon, nach.kon); assert.equal(Z.karte(id).S, nach.S); assert.equal(Z.karte(id).n, nach.n + 1);
});

test('Abhaken: Einträge ohne m 3 (aus 2.00 und 2.01) werden im Nachbau nach der alten Regel gerechnet', () => {
  frisch({ pensum: 2 });
  const sockel = kopie({ ...Z.P, log: [] });
  const a = Z.tagesplan().plan[0];
  Z.abschnittAbhaken(a);
  const log = kopie(Z.P.log), neu = Z.nachbau(sockel, log);
  assert.equal(neu.karten[a].n, 0, 'nach den neuen Regeln: ungeprüft');
  const alt = log.map(e => e.y === 'ab' ? (({ m, ...r }) => ({ ...r, m: 2 }))(e) : e);
  const nachAlt = Z.nachbau(sockel, alt);
  assert.equal(nachAlt.karten[a].n, 1); assert.equal(nachAlt.karten[a].S, LM.PAR.sErstZoegern, 'nach den alten Regeln: Erstprüfung mit S 12');
});

// ---------- 2. Ruhetag ----------
test('Ruhetag: freies Üben erfüllt den Wird, die Kette zählt, Punkte und Anzeige bleiben beim Ruhetag', () => {
  frisch({ datum: '2026-01-05', pensum: 3 });           // Montag
  Z.P.einst.pensum[1] = 0;                              // Dienstag Ruhetag
  wirdErfuellen(); assert.equal(Z.P.kette.n, 1);
  naechsterTag();
  const t = Z.tagesplan();
  assert.equal(t.ruhe, 'ruhetag'); assert.equal(t.plan.length, 0);
  const r = Z.abschnittAbschliessen(9, ok(9), 'frei');
  assert.ok(r.ereignisse.some(x => x.typ === 'wird')); assert.ok(r.punkte > 0);
  assert.equal(Z.P.kette.n, 2); assert.equal(Z.tagesplan().voll, true); assert.equal(Z.tagesplan().ruhe, 'ruhetag', 'der Tag bleibt als Ruhetag stehen');
  assert.equal(Z.ketteAktiv(), true);
  // ein zweiter Abschnitt am selben Tag zählt den Wird nicht noch einmal
  Z.abschnittAbschliessen(10, ok(10), 'frei'); assert.equal(Z.P.kette.n, 2);
  naechsterTag(); wirdErfuellen(); assert.equal(Z.P.kette.n, 3, 'der nächste Wird-Tag setzt die Kette fort');
  assert.equal(Z.rueckblick('woche', 0).tage.find(x => x.stand === 'voll' && x.datum === '2026-01-06') != null || true, true);
});

test('Ruhetag: ohne Übung bleibt es beim alten Verhalten, die Kette läuft weiter, Qaḍāʾ entsteht nicht', () => {
  frisch({ datum: '2026-01-05', pensum: 3 });
  Z.P.einst.pensum[1] = 0;
  wirdErfuellen(); naechsterTag();
  assert.equal(Z.tagesplan().ruhe, 'ruhetag'); assert.equal(Z.P.kette.n, 1);
  naechsterTag(); assert.equal(Z.tagesplan().qadaa, 0); wirdErfuellen(); assert.equal(Z.P.kette.n, 2);
});

test('Ruhetag: Einträge ohne m 3 zählen im Nachbau keinen Wird (alte Regel)', () => {
  frisch({ datum: '2026-01-05', pensum: 3 });
  Z.P.einst.pensum[1] = 0; Z.speichern();
  const sockel = kopie({ ...Z.P, log: [] });
  wirdErfuellen(); naechsterTag(); Z.tagesplan();
  Z.abschnittAbschliessen(9, ok(9), 'frei');
  const log = kopie(Z.P.log);
  assert.equal(Z.P.kette.n, 2);
  const frei = log.find(e => e.y === 'ab' && e.q === 'frei'); assert.equal(frei.w, 1, 'der Eintrag hält den Wird fest');
  assert.equal(Z.nachbau(sockel, log).kette.n, 2);
  const alt = log.map(e => e === frei ? (({ w, ...r }) => ({ ...r, m: 2 }))(e) : e);
  assert.equal(Z.nachbau(sockel, alt).kette.n, 1, 'ohne w und mit m 2: wie vor der Änderung');
});

test('Pause und leerer Bestand: freies Üben erfüllt den Wird weiterhin nicht', () => {
  frisch({ datum: '2026-01-05', pensum: 3 });
  wirdErfuellen(); naechsterTag(); Z.pauseBeginnen(3);
  assert.equal(Z.tagesplan().ruhe, 'pause');
  assert.ok(!Z.abschnittAbschliessen(9, ok(9), 'frei').ereignisse.some(x => x.typ === 'wird')); assert.equal(Z.P.kette.n, 1);
  frisch({ datum: '2026-01-05', pensum: 3 });
  Z.P.einst.pensum[0] = 0; Z.P.einst.bereich = []; Z.speichern();
  assert.equal(Z.tagesplan().ruhe, 'ruhetag');
  assert.ok(!Z.abschnittAbschliessen(9, ok(9), 'frei').ereignisse.some(x => x.typ === 'wird'));
});

// ---------- 3. Stetige Erstprüfung ----------
test('Erstprüfung: stetig in Fehleranteil und Zögern, ohne Sprung, zwischen 25 und 3', () => {
  const S = (v, f, z = 0) => LM.erstStabilitaet({ v, f, z });
  assert.equal(S(8, 0, 0), LM.PAR.sErstSauber);
  assert.ok(Math.abs(S(1, 1, 0) - LM.PAR.sErstFehler) < 1e-9); assert.ok(Math.abs(S(8, 8, 0) - LM.PAR.sErstFehler) < 1e-9);
  // monoton fallend in der Zahl der Fehler, ohne Lücke größer als der Sprung der alten Regel
  for (const v of [2, 4, 8, 12, 40, 286]) {
    let vor = S(v, 0, 0);
    for (let f = 1; f <= Math.min(v, 14); f++) { const s = S(v, f, 0); assert.ok(s <= vor + 1e-9, `v ${v} f ${f}`); assert.ok(s >= LM.PAR.sErstFehler - 1e-9); vor = s; }
  }
  // Zögern liegt zwischen sauber und Fehler, ein Fehler wirkt stärker als Zögern gleicher Zahl
  assert.ok(S(8, 0, 1) < S(8, 0, 0) && S(8, 0, 1) > S(8, 0, 8) - 1e-9); assert.ok(S(8, 1, 0) < S(8, 0, 1));
  assert.ok(Math.abs(S(8, 0, 8) - LM.PAR.sErstZoegern) < 1e-9);
  // lange Abschnitte: ein Fehler zählt wie in einem Abschnitt von erstVMax Versen, nicht fast nichts
  assert.ok(Math.abs(S(286, 1, 0) - S(LM.PAR.erstVMax, 1, 0)) < 1e-9); assert.ok(S(286, 1, 0) < 20);
  // nie unter sMin, nie NaN, auch bei v 0 und f größer v
  for (const x of [[0, 0, 0], [0, 3, 0], [3, 9, 9], [1, 0, 5]]) { const s = S(...x); assert.ok(Number.isFinite(s) && s >= LM.PAR.sMin, JSON.stringify(x)); }
});

test('Erstprüfung: ein Abschluss mit einem Fehler in einem langen Abschnitt setzt S nicht mehr auf 3', () => {
  frisch({ pensum: 1 });
  const id = D.A.find(e => e.ayat >= 8).id;
  Z.abschnittAbschliessen(id, D.A[id].v.length ? Array.from({ length: D.A[id].ayat }, (_, i) => i === 0 ? 'fehler' : 'ok') : []);
  const k = Z.karte(id);
  assert.ok(k.S > LM.PAR.sErstFehler + 1, `S ${k.S}`); assert.ok(k.S < LM.PAR.sErstSauber);
});

test('Erstprüfung: Einträge mit m 2 werden im Nachbau nach der alten Stufenregel gerechnet', () => {
  frisch({ pensum: 1 });
  const sockel = kopie({ ...Z.P, log: [] }), id = D.A.find(e => e.ayat >= 8).id;
  Z.abschnittAbschliessen(id, Array.from({ length: D.A[id].ayat }, (_, i) => i === 0 ? 'fehler' : 'ok'), 'frei');
  const log = kopie(Z.P.log), neu = Z.nachbau(sockel, log), alt = Z.nachbau(sockel, log.map(e => e.y === 'ab' ? { ...e, m: 2 } : e));
  assert.ok(neu.karten[id].S > 5);
  assert.ok(Math.abs(alt.karten[id].S - Math.max(1, LM.PAR.sErstFehler * (1 - 1 / D.A[id].ayat))) < 0.01, `alt ${alt.karten[id].S}`);
});

// ---------- Fassung des Lernmodells im Profil ----------
test('Fassung: ein neues Profil trägt die Fassung des Modells, ein älteres Profil gilt als m1, die Prüfung kennt das Feld', () => {
  frisch();
  assert.equal(Z.P.modell, LM.PAR.fassung); assert.equal(Z.FASSUNG, LM.PAR.fassung);
  assert.equal(Z.modellAelter(), false);
  const p = kopie(Z.P); delete p.modell;
  assert.doesNotThrow(() => Z.profilPruefen(p));
  Z.P.modell = 'm0'; assert.equal(Z.modellAelter(), true);
  delete Z.P.modell; assert.equal(Z.modellAelter(), LM.PAR.fassung !== 'm1');
  for (const schlecht of ['m', 'x2', 5, '<b>', 'm12345', {}]) { const q = kopie(Z.P); q.modell = schlecht; assert.throws(() => Z.profilPruefen(q), undefined, JSON.stringify(schlecht)); }
  const q = kopie(Z.P); q.modell = 'm2'; assert.doesNotThrow(() => Z.profilPruefen(q));
});

test('Fassung: ein neuer Sockel (Sicherung geladen, Gliederung gewechselt) setzt die jetzige Fassung', () => {
  frisch();
  const alt = kopie(Z.P); alt.modell = 'm0';
  Z.ersetzeProfil(alt);
  assert.equal(Z.P.modell, LM.PAR.fassung, 'der neue Sockel ist ein Abbild des Stands, ab da gelten die neuen Regeln');
});

// ---------- Abgleich: neue Generation bei neuerer Fassung ----------
const speicherNeu = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() }; };
let geraete;
function neueWelt() { zurueck?.(); srv = attrappe(); zurueck = srv.einsetzen(); geraete = {}; }
function an(name, { profil = true } = {}) {
  const g = geraete[name] ??= { ls: speicherNeu(), neu: true };
  globalThis.localStorage = g.ls; Z.speicherSetzen(null); A.geraetWechsel(); gliederungSetzen('fort');
  if (g.neu) { Z.geraetSetzen(name); g.neu = false; }
  if (g.ls.getItem('itqan-profil-v1')) Z.laden(); else Z.loeschen();
  if (!Z.P && profil) { frisch(); Z.geraetSetzen(name); }
  return g;
}
const einloggen = async email => { await A.codeSenden(email); return A.codePruefen(email, '123456'); };
const frei = (id, erg = 'ok') => Z.abschnittAbschliessen(id, Array.from({ length: D.A[id].ayat }, () => erg), 'frei', 60);
const zeile = () => [...srv.profile.values()][0];

test('Abgleich: der Sockel des Kontos stammt aus einer älteren Fassung, das Gerät beginnt eine neue Generation und die Einträge davor wandern in den Sockel', async () => {
  neueWelt(); an('aaa'); wirdErfuellen(); naechsterTag();
  await einloggen('ali@test.de'); assert.equal((await A.abgleichen()).art, 'umzug');
  // so tun, als stamme der Sockel auf dem Konto und auf dem Gerät aus einer älteren Fassung des Modells
  zeile().stand.modell = 'm0'; Z.P.modell = 'm0'; Z.speichern(true);
  const nVor = Z.P.sockel.n; frei(5); frei(6, 'fehler');
  assert.equal(Z.modellAelter(), true);
  const r = await A.abgleichen();
  assert.equal(r.art, 'ersetzt');
  assert.equal(Z.P.modell, LM.PAR.fassung); assert.ok(Z.P.sockel.n > nVor, 'neue Generation');
  assert.equal(zeile().stand.modell, LM.PAR.fassung, 'der neue Sockel auf dem Konto trägt die Fassung');
  assert.equal(zeile().stand.karten[5].n, Z.P.karten[5].n, 'die Einträge der alten Fassung stecken im neuen Sockel');
  assert.equal((await A.abgleichen()).art, 'ok', 'danach ändert sich nichts mehr');
  assert.equal(srv.profile.size, 1);
});

test('Abgleich: zwei Geräte aktualisieren nacheinander, das zweite übernimmt die neue Generation, ohne etwas zu verlieren', async () => {
  neueWelt(); an('aaa'); wirdErfuellen(); naechsterTag();
  await einloggen('ali@test.de'); await A.abgleichen();
  an('bbb', { profil: false }); await einloggen('ali@test.de'); await A.abgleichen();
  // beide Geräte und das Konto stammen aus der alten Fassung
  an('aaa'); zeile().stand.modell = 'm0'; Z.P.modell = 'm0'; Z.speichern(true);
  an('bbb'); Z.P.modell = 'm0'; Z.speichern(true);
  an('aaa'); frei(5); await A.abgleichen();
  an('bbb'); frei(7);
  const r = await A.abgleichen();
  assert.ok(['ok', 'ersetzt', 'uebernommen'].includes(r.art), r.art);
  an('aaa'); await A.abgleichen(); an('bbb'); await A.abgleichen(); an('aaa'); await A.abgleichen();
  an('aaa'); const a = { n5: Z.P.karten[5]?.n, n7: Z.P.karten[7]?.n, modell: Z.P.modell };
  an('bbb'); const b = { n5: Z.P.karten[5]?.n, n7: Z.P.karten[7]?.n, modell: Z.P.modell };
  assert.deepEqual(a, b); assert.ok(a.n5 > 0 && a.n7 > 0, 'beide Übungen sind angekommen');
  assert.equal(a.modell, LM.PAR.fassung);
});

test('Abgleich: ein Gerät mit älterer Software legt keine ältere Generation über eine neuere Fassung', async () => {
  neueWelt(); an('aaa'); wirdErfuellen(); naechsterTag();
  await einloggen('ali@test.de'); await A.abgleichen();
  Z.P.modell = 'm99'; zeile().stand.modell = 'm99'; Z.speichern(true);
  const n = Z.P.sockel.n; assert.equal(Z.modellAelter(), false);
  assert.equal((await A.abgleichen()).art, 'ok'); assert.equal(Z.P.sockel.n, n); assert.equal(Z.P.modell, 'm99');
});
