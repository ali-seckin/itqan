// Itqān · Abgleich, Regressionstests zum Audit 1.99 (konzept/audit_1.99): K1/S2 Profil löschen, H6 Einbau nur mit Erlaubnis,
// S4 Konflikt und Fehler sichtbar, verlorene Antwort, S6 Fehlversuch ändert nichts, S12 gleichzeitiges Hochladen und Zeigerlücke,
// S13 Geräteuhr, S14 Aufräumen, Stand vom Konto wird geprüft, Abl. 29.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Z, D, frisch, gliederungSetzen, naechsterTag, tagSetzenZurueck, wirdErfuellen } from './umgebung.mjs';
import * as A from '../js/abgleich.js';
import { attrappe } from './server_attrappe.mjs';

const urspruenglich = globalThis.localStorage;
let srv, zurueck;
A.starten(); A.autoSetzen(false);
after(() => { globalThis.localStorage = urspruenglich; Z.speicherSetzen(null); A.geraetWechsel(); A.autoSetzen(false); A.ergebnisHakenSetzen(null); Z.logGrenze(0); gliederungSetzen('fort'); tagSetzenZurueck(); zurueck?.(); Z.eintragHakenSetzen(null); });

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
const kanon = x => JSON.stringify(x, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : 1)) : v);
const kern = () => { const p = JSON.parse(JSON.stringify(Z.P)); delete p.log; return kanon(p); };
const ueben = (n = 1) => { for (let i = 0; i < n; i++) { wirdErfuellen(); naechsterTag(); } };
const frei = (id, erg = 'ok') => Z.abschnittAbschliessen(id, Array.from({ length: D.A[id].ayat }, () => erg), 'frei', 60);
const zeile = () => [...srv.profile.values()][0];
const serverBild = () => JSON.stringify(zeile());
const sicherungLaden = async text => { const imp = await Z.importDatei(text); Z.ersetzeProfil(imp.profil, imp.exportiert); };
const mitFrist = (p, ms = 3000) => { let t; return Promise.race([p, new Promise((_, nein) => { t = setTimeout(() => nein(new Error('Frist abgelaufen')), ms); })]).finally(() => clearTimeout(t)); };
// Gerät aaa mit geübtem Stand, angemeldet und abgeglichen
async function verbunden(tage = 3, rpc = false) { neueWelt(); srv.rpc = rpc; an('aaa'); ueben(tage); await einloggen('ali@test.de'); assert.equal((await A.abgleichen()).art, 'umzug'); }

// ---------- K1 / S2 / Abl. 1 ----------
test('K1: Profil gelöscht, Gerät noch verbunden: abgleichen() holt den Stand vom Konto zurück', async () => {
  await verbunden(); const stand = kern(), bild = serverBild();
  Z.schnappschuss('vor dem Löschen'); Z.loeschen();
  const r = await A.abgleichen();
  assert.equal(r.art, 'uebernommen'); assert.ok(r.aufgebaut);
  assert.equal(kern(), stand, 'der Stand des Kontos ist wieder da');
  assert.equal(serverBild(), bild, 'der Server blieb unberührt');
});

test('K1: Profil gelöscht und neu angelegt: das neue Profil ersetzt den Kontostand nie ohne Wahl, auch nicht nach der ersten Übung', async () => {
  await verbunden(); const bild = serverBild(), abschnitte = zeile().stand.summe.abschnitte;
  assert.ok(abschnitte > 0);
  Z.loeschen(); Z.neuesProfil({ name: 'Neu' });
  for (const opt of [{ neuAufbauen: false }, {}, { still: true, darfAufbauen: () => true }]) {
    const r = await A.abgleichen(opt);
    assert.equal(r.art, 'konflikt', JSON.stringify(opt));
    assert.equal(r.server.abschnitte, abschnitte); assert.equal(r.lokal.abschnitte, 0);
  }
  assert.equal(serverBild(), bild, 'Server unverändert'); assert.equal(Z.P.name, 'Neu', 'das neue Profil auch');
  frei(5); frei(6);                                               // jetzt hat das neue Profil geübte Abschnitte
  assert.equal((await A.abgleichen()).art, 'konflikt', 'ein anderes Profil bleibt eine Frage der Wahl');
  assert.equal(serverBild(), bild);
  const st = A.status();
  assert.equal(st.konflikt, true); assert.equal(st.verbunden, false); assert.equal(st.zustand, 'konflikt');
  // zweites Gerät sieht weiter den alten Stand
  an('bbb', { profil: false }); await einloggen('ali@test.de'); await A.abgleichen();
  assert.equal(Z.P.summe.abschnitte, abschnitte);
  // ausdrückliche Wahl: jetzt darf ersetzt werden
  an('aaa'); const l = await A.abgleichen({ wahl: 'lokal' });
  assert.equal(l.art, 'ersetzt'); assert.equal(zeile().stand.name, 'Neu'); assert.equal(A.status().konflikt, false);
});

test('K1: beimProfilLoeschen() löst die Verbindung, die Anmeldung bleibt; ohne Profil kommt der Kontostand zurück, mit neuem Profil wird gefragt', async () => {
  await verbunden(); const stand = kern(), bild = serverBild();
  A.beimProfilLoeschen(); Z.loeschen();
  assert.equal(A.status().angemeldet, true); assert.equal(A.status().verknuepft, false);
  assert.equal(localStorage.getItem('itqan-abgleich'), null); assert.equal(localStorage.getItem('itqan-abgleich-sockel'), null);
  Z.neuesProfil({ name: 'Neu' });
  const r = await A.abgleichen({ neuAufbauen: false });
  assert.equal(r.art, 'konflikt'); assert.equal(serverBild(), bild); assert.equal(Z.P.name, 'Neu', 'weder Konto noch neues Profil wurden ersetzt');
  const s = await A.abgleichen({ wahl: 'server' });
  assert.equal(s.art, 'uebernommen'); assert.equal(kern(), stand);
  // zweiter Weg: gleich nach dem Löschen abgleichen
  A.beimProfilLoeschen(); Z.loeschen();
  assert.equal((await A.abgleichen()).art, 'uebernommen'); assert.equal(kern(), stand); assert.equal(serverBild(), bild);
});

test('K1: ein Stand ohne geübte Abschnitte ersetzt nie einen Kontostand mit geübten Abschnitten (auch dasselbe Profil)', async () => {
  neueWelt(); an('aaa'); const leer = await Z.exportDatei();
  ueben(3); await einloggen('ali@test.de'); await A.abgleichen(); const bild = serverBild();
  await sicherungLaden(leer);                                     // dieselbe Person lädt eine leere Sicherung: eigene neue Generation
  assert.equal(Z.P.summe.abschnitte, 0);
  const r = await A.abgleichen();
  assert.equal(r.art, 'konflikt'); assert.equal(serverBild(), bild);
  assert.equal(srv.anrufe('POST /rest/v1/profile'), 1, 'kein zweiter Upload');
});

// ---------- H6 / Abl. 4 ----------
test('H6: neue Generation auf dem Konto wird ohne Erlaubnis nicht eingebaut, sondern vorgemerkt', async () => {
  await verbunden(2); const text = await Z.exportDatei();
  an('bbb', { profil: false }); await einloggen('ali@test.de'); await A.abgleichen();
  an('aaa'); ueben(1); await sicherungLaden(text); assert.equal((await A.abgleichen()).art, 'ersetzt');
  an('bbb'); frei(7);
  const sockel = JSON.stringify(Z.P.sockel), stand = kern();
  const r = await A.abgleichen({ neuAufbauen: false });
  assert.equal(r.art, 'wartet'); assert.equal(r.wartet, true);
  assert.equal(JSON.stringify(Z.P.sockel), sockel, 'Sockel unverändert'); assert.equal(kern(), stand, 'Profil unverändert');
  assert.equal(A.status().wartet, true);
  let fragen = 0;
  const r2 = await A.abgleichen({ darfAufbauen: () => { fragen++; return false; } });
  assert.equal(r2.art, 'wartet'); assert.ok(fragen >= 1); assert.equal(kern(), stand);
  const r3 = await A.abgleichen({ darfAufbauen: () => true });
  assert.equal(r3.art, 'uebernommen'); assert.equal(Z.P.sockel.n, zeile().sockel_n); assert.equal(A.status().wartet, false);
});

test('H6: darfAufbauen wird im Augenblick des Einbaus gefragt (nach dem Netz), auch bei fremden Einträgen und beim ersten Verbinden', async () => {
  await verbunden(2);
  an('bbb', { profil: false }); await einloggen('ali@test.de'); await A.abgleichen();
  an('aaa'); frei(5); await A.abgleichen();
  an('bbb'); const stand = kern(), vorher = srv.anfragen.length; let gefragtBei = 0;
  const r = await A.abgleichen({ darfAufbauen: () => { gefragtBei = srv.anfragen.length; return false; } });
  assert.equal(r.art, 'ok'); assert.equal(r.wartet, true); assert.ok(!r.aufgebaut);
  assert.ok(gefragtBei > vorher, 'gefragt wurde erst nach den Anfragen an den Server');
  assert.equal(kern(), stand, 'nichts getauscht');
  const r2 = await A.abgleichen({ darfAufbauen: () => true });
  assert.ok(r2.aufgebaut); assert.notEqual(kern(), stand);
  // erstes Verbinden mit leerem Profil: ohne Erlaubnis bleibt das Profil stehen
  an('ccc'); await einloggen('ali@test.de'); const eigen = kern();
  const r3 = await A.abgleichen({ darfAufbauen: () => false });
  assert.equal(r3.art, 'wartet'); assert.equal(kern(), eigen); assert.equal(A.status().wartet, true);
  assert.equal((await A.abgleichen()).art, 'uebernommen');
});

test('H6: der selbsttätige Lauf nach einem Eintrag meldet sein Ergebnis über ergebnisHakenSetzen', async () => {
  await verbunden(2);
  an('bbb', { profil: false }); await einloggen('ali@test.de'); await A.abgleichen();
  an('aaa'); frei(5); await A.abgleichen();
  an('bbb');
  try {
    A.autoSetzen(true, 5);
    let p = new Promise(ja => A.ergebnisHakenSetzen(ja));           // ohne Erlaubnisfunktion: nie einbauen
    const stand = (frei(6), kern());
    let r = await mitFrist(p);
    assert.equal(r.art, 'ok'); assert.equal(r.wartet, true); assert.ok(!r.aufgebaut); assert.equal(kern(), stand);
    p = new Promise(ja => A.ergebnisHakenSetzen(ja, () => true));  // mit Erlaubnis: einbauen und melden
    frei(8);
    r = await mitFrist(p);
    assert.ok(r.aufgebaut, JSON.stringify(r));
  } finally { A.autoSetzen(false); A.ergebnisHakenSetzen(null); }
});

// ---------- S4 ----------
for (const rpc of [false, true]) test(`S4: Upload mit verlorener Antwort (${rpc ? 'mit' : 'ohne'} sockel_setzen): kein Konflikt mit sich selbst, der nächste Abgleich läuft`, async () => {
  await verbunden(2, rpc);
  const text = await Z.exportDatei(); ueben(1);
  await sicherungLaden(text);
  srv.stoeren(rpc ? 'rpc/sockel_setzen' : 'POST /rest/v1/profile', { verloren: true });
  assert.equal((await A.abgleichen()).art, 'offline');
  assert.equal(zeile().sockel_g, 'aaa', 'der Server hat den neuen Sockel');
  frei(3);                                                        // danach wird weiter geübt
  const r = await A.abgleichen();
  assert.equal(r.art, 'ok', JSON.stringify(r));
  assert.equal(A.status().offen, 0); assert.equal(A.status().konflikt, false); assert.equal(A.status().verbunden, true);
  assert.equal(Z.P.sockel.n, zeile().sockel_n);
  assert.equal(srv.anrufe(rpc ? 'rpc/sockel_setzen' : 'POST /rest/v1/profile'), 2, 'kein weiterer Upload (Umzug und der eine mit verlorener Antwort)');
  assert.equal((await A.abgleichen()).art, 'ok');
  const a = kern(); an('bbb', { profil: false }); await einloggen('ali@test.de'); await A.abgleichen();
  assert.equal(kern(), a, 'das zweite Gerät hat denselben Stand, samt der Übung nach dem Upload');
});

test('S4: verlorene Antwort beim Umzug (Gerät war noch nicht verbunden) und Stand aus älterer Fassung: nachziehen statt Konflikt', async () => {
  neueWelt(); an('aaa'); ueben(2); await einloggen('ali@test.de');
  srv.stoeren('POST /rest/v1/profile', { verloren: true });
  assert.equal((await A.abgleichen()).art, 'offline');
  assert.equal(srv.profile.size, 1);
  assert.equal((await A.abgleichen()).art, 'ok'); assert.equal(A.status().verbunden, true);
  // ältere Fassung: lokal gilt schon der neue Sockel, der Abgleichstand kennt noch den alten
  const text = await Z.exportDatei(); await sicherungLaden(text); frei(4);
  const z = zeile(); Object.assign(z, { sockel_n: Z.P.sockel.n, sockel_z: Z.P.sockel.z, sockel_g: Z.P.sockel.g, stand: JSON.parse(JSON.stringify({ ...Z.P, log: [] })) });
  const r = await A.abgleichen();
  assert.equal(r.art, 'ok', JSON.stringify(r)); assert.equal(A.status().offen, 0);
  assert.equal(srv.anrufe('POST /rest/v1/profile'), 1, 'kein erneuter Upload');
});

test('S4 / Abl. 29: Konflikt und Fehler stehen im Status, wiederholte Fehler bremsen den stillen Lauf', async () => {
  await verbunden();
  an('ccc'); ueben(1); frei(10); await einloggen('ali@test.de');
  assert.equal((await A.abgleichen({ still: true, darfAufbauen: () => false })).art, 'konflikt');
  let st = A.status();
  assert.deepEqual([st.angemeldet, st.verknuepft, st.verbunden, st.konflikt, st.zustand], [true, false, false, true, 'konflikt'], 'angemeldet, nicht verbunden, Entscheidung offen');
  assert.equal((await A.abgleichen({ wahl: 'server' })).art, 'uebernommen');
  st = A.status(); assert.deepEqual([st.verbunden, st.konflikt, st.fehler, st.zustand], [true, false, '', 'verbunden']);
  // Fehler des Servers
  srv.stoeren('GET /rest/v1/profile', { status: 503, json: { message: 'wartung' }, mal: 2 });
  assert.equal((await A.abgleichen()).art, 'fehler');
  st = A.status(); assert.match(st.fehler, /503/); assert.equal(st.fehlerFolge, 1); assert.equal(st.verbunden, true, 'ein einzelner Fehler stockt noch nicht');
  assert.equal((await A.abgleichen()).art, 'fehler');
  st = A.status(); assert.deepEqual([st.fehlerFolge, st.stockt, st.verbunden, st.zustand], [2, true, false, 'fehler']);
  const n = srv.anfragen.length, still = await A.abgleichen({ still: true });
  assert.equal(still.art, 'fehler'); assert.equal(still.pause, true); assert.equal(srv.anfragen.length, n, 'der stille Lauf wartet, statt sofort wieder anzufragen');
  assert.equal(A.status().fehlerFolge, 2, 'die Pause zählt nicht als weiterer Fehler');
  assert.equal((await A.abgleichen()).art, 'ok');
  st = A.status(); assert.deepEqual([st.fehler, st.stockt, st.verbunden], ['', false, true]);
  // ohne Netz ist kein Fehler des Abgleichs
  srv.offline = true; assert.equal((await A.abgleichen()).art, 'offline'); srv.offline = false;
  assert.equal(A.status().fehler, '');
});

// ---------- S6 ----------
test('S6: abgelehnter Upload ändert lokal nichts: Generation, Schnappschüsse und Protokoll bleiben', async () => {
  await verbunden(2); const text = await Z.exportDatei(); ueben(1);
  Z.schnappschuss('vor dem Löschen');
  await sicherungLaden(text); frei(3);
  const n = Z.P.sockel.n, log = Z.P.log.length, stand = kern(); assert.ok(log > 0);
  srv.stoeren('POST /rest/v1/profile', { status: 400, json: { message: 'stand_klein' }, mal: 4 });
  const r = await A.abgleichen();
  assert.equal(r.art, 'fehler'); assert.match(r.text, /stand_klein/);
  const bilder = Z.schnappschuesse().map(x => x.grund + x.zeit);
  for (let i = 0; i < 3; i++) assert.equal((await A.abgleichen()).art, 'fehler');
  assert.equal(Z.P.sockel.n, n, 'die Generation zählt nicht hoch');
  assert.equal(Z.P.log.length, log, 'das Protokoll bleibt');
  assert.equal(kern(), stand);
  assert.deepEqual(Z.schnappschuesse().map(x => x.grund + x.zeit), bilder, 'kein neuer Schnappschuss je Fehlversuch');
  assert.ok(Z.schnappschuesse().some(x => x.grund === 'vor dem Löschen'), 'der Rettungsstand wurde nicht verdrängt');
  assert.equal(localStorage.getItem('itqan-abgleich-versuch'), null);
  const ok = await A.abgleichen();
  assert.equal(ok.art, 'ersetzt'); assert.equal(Z.P.sockel.n, n + 1);
});

// ---------- S12 ----------
test('S12: zwei Geräte laden fast gleichzeitig eine neue Generation hoch: das zweite überschreibt nicht, es bekommt einen Konflikt', async () => {
  await verbunden(2, true); const text = await Z.exportDatei();
  an('bbb', { profil: false }); await einloggen('ali@test.de'); await A.abgleichen();
  frei(9); await sicherungLaden(text);
  const sockel = JSON.stringify(Z.P.sockel), echt = globalThis.fetch; let einmal = true;
  // zwischen dem Lesen und dem Schreiben von bbb legt aaa seine Generation ab
  globalThis.fetch = (url, opt) => { if (einmal && String(url).includes('rpc/sockel_setzen')) { einmal = false; Object.assign(zeile(), { sockel_n: zeile().sockel_n + 1, sockel_z: zeile().sockel_z + 5, sockel_g: 'aaa' }); } return echt(url, opt); };
  let r; try { r = await A.abgleichen(); } finally { globalThis.fetch = echt; }
  assert.equal(r.art, 'konflikt', JSON.stringify(r));
  assert.equal(zeile().sockel_g, 'aaa', 'der Stand des anderen Geräts liegt noch auf dem Konto');
  assert.equal(JSON.stringify(Z.P.sockel), sockel, 'lokal nichts verändert');
});

test('S12 / S14: mit dem Nachtrag räumt ein neuer Sockel die Einträge älterer Generationen vom Server', async () => {
  await verbunden(2, true); frei(3); frei(4); await A.abgleichen();
  const alt = zeile().sockel_n; assert.ok(srv.eintraege.some(e => e.sockel_n === alt));
  const text = await Z.exportDatei(); await sicherungLaden(text);
  assert.equal((await A.abgleichen()).art, 'ersetzt');
  assert.ok(zeile().sockel_n > alt); assert.equal(srv.eintraege.filter(e => e.sockel_n < zeile().sockel_n).length, 0);
});

test('S12: eine Zeile, die erst später sichtbar wird als eine mit höherer Nummer, geht nicht verloren', async () => {
  await verbunden(2);
  for (const g of ['bbb', 'ccc']) { an(g, { profil: false }); await einloggen('ali@test.de'); await A.abgleichen(); }
  an('aaa'); const seq = Math.max(0, ...srv.eintraege.map(e => e.seq)); frei(2); await A.abgleichen();
  for (const e of srv.eintraege) if (e.seq > seq) srv.verborgen.add(e.seq);       // vergeben, aber für andere noch nicht sichtbar
  an('bbb'); frei(3); await A.abgleichen();
  an('ccc'); await A.abgleichen();                                 // der Zeiger von ccc steht jetzt hinter der Zeile von aaa
  srv.verborgen.clear();
  for (let i = 0; i < 2; i++) for (const g of ['aaa', 'bbb', 'ccc']) { an(g); await A.abgleichen(); }
  an('aaa'); const a = kern(); an('bbb'); assert.equal(kern(), a); an('ccc'); assert.equal(kern(), a, 'ccc hat die Zeile von aaa nachgeholt');
});

// ---------- S13, S14, Stand prüfen ----------
test('S13: die Abweichung der Geräteuhr von der Serveruhr steht im Status', async () => {
  await verbunden(1);
  assert.equal(A.status().uhrFalsch, false);
  srv.uhrVersatz = 20 * 60000; await A.abgleichen();
  const st = A.status();
  assert.equal(st.uhrFalsch, true); assert.ok(Math.abs(st.uhrAbweichung - 20 * 60000) < 5000, String(st.uhrAbweichung));
});

test('S14: passt die Liste der Einträge nicht mehr in den Speicher, gibt sie ihren Platz frei und der Abgleich bleibt richtig', async () => {
  await verbunden(2);
  const g = an('bbb', { profil: false }); await einloggen('ali@test.de'); await A.abgleichen();
  an('aaa'); frei(5); await A.abgleichen();
  an('bbb'); const echt = g.ls.setItem;
  g.ls.setItem = (k, v) => { if (k === 'itqan-abgleich-eintraege') throw new Error('QuotaExceededError'); echt(k, v); };
  assert.ok((await A.abgleichen()).aufgebaut);
  assert.equal(g.ls.getItem('itqan-abgleich-eintraege'), null, 'die alte Liste belegt keinen Platz mehr');
  an('aaa'); frei(6); await A.abgleichen(); const a = kern();
  an('bbb'); assert.ok((await A.abgleichen()).aufgebaut); assert.equal(kern(), a);
  assert.equal((await A.abgleichen()).neu, 0, 'ohne Liste gilt der Zeiger genau, es wird nicht bei jedem Lauf neu aufgebaut');
});

test('Ein ungültiger Stand vom Konto wird nicht eingebaut', async () => {
  await verbunden(2);
  zeile().stand.format = 'fremd';
  an('bbb', { profil: false }); await einloggen('ali@test.de');
  const r = await A.abgleichen();
  assert.equal(r.art, 'fehler'); assert.equal(r.text, 'stand-ungueltig'); assert.equal(Z.P, null);
  an('ccc'); const eigen = kern(); await einloggen('ali@test.de');
  assert.equal((await A.abgleichen()).art, 'fehler'); assert.equal(kern(), eigen, 'das eigene Profil bleibt');
});

// ---------- S10 (Abgleich-Teil) ----------
test('S10: Abmelden sendet vorher den Ausgang; wieder anmelden führt nicht in einen Konflikt mit sich selbst', async () => {
  await verbunden(2); frei(2);
  assert.ok(A.status().offen > 0); const vorher = srv.eintraege.length;
  assert.equal(await A.abmelden(), true);
  assert.ok(srv.eintraege.length > vorher, 'der Ausgang kam noch an');
  assert.equal(A.status().angemeldet, false); assert.equal(localStorage.getItem('itqan-abgleich'), null);
  frei(3);                                                        // abgemeldet weiter geübt
  await einloggen('ali@test.de');
  const r = await A.abgleichen();
  assert.equal(r.art, 'ok', JSON.stringify(r)); assert.equal(A.status().verbunden, true);
  const a = kern(); an('bbb', { profil: false }); await einloggen('ali@test.de'); await A.abgleichen();
  assert.equal(kern(), a, 'auch die Übung aus der abgemeldeten Zeit ist auf dem Konto');
});

// ---------- Nach-Audit Sicherheit N1 ----------
test('N1 (Nach-Audit): vergiftete Einträge auf dem Konto halten den Abgleich nicht auf und erreichen das Profil nicht', async () => {
  await verbunden(2);
  const uid = zeile().user_id, n = zeile().sockel_n, d = Z.heute(), BILD = '<img src=x onerror=alert(1)>';
  const gift = [
    { y: 'ab', d: BILD, id: 3, q: BILD, e: 'ooo', p: 5 }, { y: 'lb', d, id: BILD }, { y: 'pl', d, t: { plan: [BILD], art: {}, fertig: [], punkte: BILD } },
    { y: 'ab', d, id: 99999, e: 'ooo', q: 'frei', p: 5 }, { y: 'fm', d, w: [BILD], a: BILD }, { y: 'mu', d, k: BILD, ok: 1 }, { y: 'zz', d }
  ].map((e, k) => ({ ...e, i: 'boese1-00000' + k, z: Date.now() + k }));
  let seq = Math.max(0, ...srv.eintraege.map(e => e.seq));
  for (const e of gift) srv.eintraege.push({ seq: ++seq + 1000, user_id: uid, i: e.i, sockel_n: n, z: e.z, y: e.y, daten: e });
  // Gerät aaa: läuft weiter, auch über mehrere Durchläufe, und bleibt verbunden
  for (let k = 0; k < 3; k++) { wirdErfuellen(); const r = await A.abgleichen(); assert.equal(r.art, 'ok', 'Durchlauf ' + k + ': ' + JSON.stringify(r)); naechsterTag(); }
  assert.equal(A.status().zustand, 'verbunden'); assert.equal(A.status().fehler, '');
  assert.ok(!JSON.stringify(Z.P).includes('<img'), 'Fremdtext im Profil von aaa');
  assert.doesNotThrow(() => Z.profilPruefen(JSON.parse(JSON.stringify({ ...Z.P, log: [] }))));
  const stand = kern();
  // ein zweites Gerät holt denselben Kontostand: gleicher Stand, kein Fremdtext, kein Fehler
  an('bbb', { profil: false }); await einloggen('ali@test.de');
  const r = await A.abgleichen();
  assert.equal(r.art, 'uebernommen'); assert.ok(r.aufgebaut);
  assert.ok(!JSON.stringify(Z.P).includes('<img'), 'Fremdtext im Profil von bbb');
  assert.doesNotThrow(() => Z.profilPruefen(JSON.parse(JSON.stringify({ ...Z.P, log: [] }))));
  assert.equal(kern(), stand, 'beide Geräte stehen auf dem Stand der echten Einträge');
  assert.ok(Z.tagesplan().plan.length > 0); wirdErfuellen();
  assert.equal((await A.abgleichen()).art, 'ok');
});

// ---------- Nach-Audit Sicherheit N3 ----------
test('N3 (Nach-Audit): nach „Profil löschen“ und neuem Profil meldet schon der erste Eintrag, dass eine Entscheidung aussteht (nicht erst der nächste Start)', async () => {
  await verbunden(); const bild = serverBild(), ergebnisse = [];
  A.beimProfilLoeschen(); Z.loeschen(); Z.neuesProfil({ name: 'Neu' });
  assert.equal(A.status().zustand, 'unverbunden');
  A.ergebnisHakenSetzen(r => ergebnisse.push(r), () => true); A.autoSetzen(true, 5);
  try {
    frei(5);                                                        // der erste Eintrag des neuen Profils
    await mitFrist((async () => { while (!ergebnisse.length) await new Promise(r => setTimeout(r, 5)); })());
    assert.equal(ergebnisse[0].art, 'konflikt');
    assert.equal(A.status().zustand, 'konflikt');
    assert.equal(serverBild(), bild, 'der Kontostand bleibt unberührt'); assert.equal(Z.P.name, 'Neu');
    // ist die Lage bekannt, löst ein weiterer Eintrag keinen weiteren Abruf aus
    const n = srv.anfragen.length; frei(6);
    await new Promise(r => setTimeout(r, 60));
    assert.equal(srv.anfragen.length, n); assert.equal(ergebnisse.length, 1);
  } finally { A.autoSetzen(false); A.ergebnisHakenSetzen(null); }
});
