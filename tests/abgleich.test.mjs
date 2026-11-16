// Itqān · Abgleich mit dem Konto: Umzug, zweites Gerät, gleichzeitiges Üben, ohne Netz, Sitzung läuft ab,
// Konflikt, neue Generation, Konto löschen. Der Server ist eine Attrappe (tests/server_attrappe.mjs).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Z, D, frisch, gliederungSetzen, naechsterTag, tagSetzenZurueck, wirdErfuellen } from './umgebung.mjs';
import * as A from '../js/abgleich.js';
import { attrappe } from './server_attrappe.mjs';

const urspruenglich = globalThis.localStorage;
let srv, zurueck;
A.starten(); A.autoSetzen(false);
after(() => { globalThis.localStorage = urspruenglich; Z.speicherSetzen(null); A.geraetWechsel(); Z.logGrenze(0); gliederungSetzen('fort'); tagSetzenZurueck(); zurueck?.(); Z.eintragHakenSetzen(null); });

const speicherNeu = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() }; };
let geraete;
function neueWelt() { zurueck?.(); srv = attrappe(); zurueck = srv.einsetzen(); geraete = {}; }
// Zu einem Gerät wechseln: eigener Speicher, eigener Stand
function an(name, { profil = true } = {}) {
  const g = geraete[name] ??= { ls: speicherNeu(), neu: true };
  globalThis.localStorage = g.ls; Z.speicherSetzen(null); A.geraetWechsel(); gliederungSetzen('fort');
  if (g.neu) { Z.geraetSetzen(name); g.neu = false; }
  if (g.ls.getItem('itqan-profil-v1')) Z.laden(); else Z.loeschen();     // Z.laden() behielte sonst den Stand des vorigen Geräts
  if (!Z.P && profil) { frisch(); Z.geraetSetzen(name); }
  return g;
}
const einloggen = async email => { await A.codeSenden(email); return A.codePruefen(email, '123456'); };
const kanon = x => JSON.stringify(x, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : 1)) : v);
const kern = () => { const p = JSON.parse(JSON.stringify(Z.P)); delete p.log; return kanon(p); };
const ueben = (n = 1) => { for (let i = 0; i < n; i++) { wirdErfuellen(); naechsterTag(); } };
const frei = (id, erg = 'ok') => Z.abschnittAbschliessen(id, Array.from({ length: D.A[id].ayat }, () => erg), 'frei', 60);

test('Umzug: das lokale Profil wandert beim ersten Abgleich auf das Konto', async () => {
  neueWelt(); an('aaa'); ueben(3);
  const vorher = Z.P.summe.abschnitte; assert.ok(vorher > 0);
  const nVorher = Z.P.sockel.n;
  await einloggen('ali@test.de');
  const r = await A.abgleichen();
  assert.equal(r.art, 'umzug');
  assert.equal(srv.profile.size, 1);
  const zeile = [...srv.profile.values()][0];
  assert.equal(zeile.stand.summe.abschnitte, vorher, 'der Sockel enthält den ganzen Stand');
  assert.deepEqual(zeile.stand.log, [], 'der Sockel hat kein Protokoll');
  assert.ok(Z.P.sockel.n > nVorher, 'neue Generation');
  assert.ok(Z.schnappschuesse().some(x => x.grund === 'vor dem Konto'), 'Schnappschuss vor dem Umzug');
  assert.equal(A.status().verbunden, true);
  assert.equal((await A.abgleichen()).art, 'ok', 'ein zweiter Abgleich ändert nichts');
});

test('Zweites Gerät: meldet sich an und bekommt den Stand', async () => {
  neueWelt(); an('aaa'); ueben(3); await einloggen('ali@test.de'); await A.abgleichen();
  const stand = kern();
  an('bbb', { profil: false }); assert.equal(Z.P, null);
  assert.equal((await A.abgleichen()).art, 'abgemeldet', 'ohne Anmeldung nichts');
  await einloggen('ali@test.de');
  const r = await A.abgleichen();
  assert.equal(r.art, 'uebernommen'); assert.ok(r.aufgebaut);
  assert.equal(kern(), stand, 'dasselbe Profil');
});

test('Nach dem Üben auf einem Gerät hat das andere denselben Stand', async () => {
  neueWelt(); an('aaa'); ueben(2); await einloggen('ali@test.de'); await A.abgleichen();
  an('bbb', { profil: false }); await einloggen('ali@test.de'); await A.abgleichen();
  an('aaa'); ueben(2); frei(5); frei(9, 'fehler');
  assert.ok(A.status().offen > 0, 'noch nicht gesendet');
  assert.equal((await A.abgleichen()).art, 'ok'); assert.equal(A.status().offen, 0);
  const a = kern();
  an('bbb'); const r = await A.abgleichen();
  assert.ok(r.aufgebaut && r.neu > 0);
  assert.equal(kern(), a);
  assert.equal((await A.abgleichen()).neu, 0);
});

test('Gleichzeitig geübt: beide Stände vereinen sich ohne Verlust, auf beiden Geräten gleich', async () => {
  neueWelt(); an('aaa'); ueben(2); await einloggen('ali@test.de'); await A.abgleichen();
  an('bbb', { profil: false }); await einloggen('ali@test.de'); await A.abgleichen();
  an('aaa'); const base = Z.P.summe.abschnitte; frei(3); frei(4, 'fehler'); Z.fehlerstellenMerken([`${D.A[4].v[0]}.1`], 'haraka');
  an('bbb'); frei(3); frei(7); frei(8, 'hilfe');
  const summe = () => Z.P.summe.abschnitte;
  an('aaa'); const nA = summe(); await A.abgleichen();
  an('bbb'); const nB = summe(); await A.abgleichen();
  an('aaa'); await A.abgleichen();
  const a = kern(), nach = summe();
  an('bbb'); assert.equal(kern(), a, 'gleicher Stand auf beiden Geräten');
  assert.equal(summe(), nach);
  assert.equal(nach, nA + nB - base, 'nichts ging verloren, nichts kam doppelt');
});

test('Ohne Netz bleibt alles im Ausgang, danach kommt es an; eine verlorene Antwort erzeugt keine Doppelten', async () => {
  neueWelt(); an('aaa'); ueben(1); await einloggen('ali@test.de'); await A.abgleichen();
  frei(2); frei(3);
  srv.offline = true;
  assert.equal((await A.abgleichen()).art, 'offline');
  assert.ok(A.status().offen >= 2);
  frei(4); const offen = A.status().offen;
  srv.offline = false; srv.verlorene = 1;                      // gespeichert, aber die Antwort geht verloren
  assert.equal((await A.abgleichen()).art, 'offline');
  assert.equal(A.status().offen, offen, 'das Gerät weiß es nicht und behält den Ausgang');
  const aufServer = srv.eintraege.length;
  assert.equal((await A.abgleichen()).art, 'ok');
  assert.equal(srv.eintraege.length, aufServer, 'beim zweiten Senden entstehen keine Doppelten');
  assert.equal(A.status().offen, 0);
  const a = kern(); an('bbb', { profil: false }); await einloggen('ali@test.de'); await A.abgleichen();
  assert.equal(kern(), a);
});

test('Abgelaufene Sitzung wird erneuert; ungültige Erneuerung meldet ab', async () => {
  neueWelt(); an('aaa'); ueben(1); await einloggen('ali@test.de'); await A.abgleichen();
  srv.ablaufen(); frei(2);
  assert.equal((await A.abgleichen()).art, 'ok', 'erneuert und weiter');
  assert.ok(srv.eintraege.length > 0);
  // Zeit läuft ab und die Erneuerung ist ungültig
  const k = JSON.parse(localStorage.getItem('itqan-konto')); k.ablauf = 0; k.r = 'falsch'; localStorage.setItem('itqan-konto', JSON.stringify(k));
  assert.equal((await A.abgleichen()).art, 'abgemeldet');
  assert.equal(A.status().angemeldet, false);
  assert.ok(Z.P, 'das lokale Profil bleibt');
});

test('Konflikt: Konto hat schon Daten und dieses Gerät auch, es wird gefragt', async () => {
  neueWelt(); an('aaa'); ueben(3); await einloggen('ali@test.de'); await A.abgleichen();
  const stand = kern();
  an('ccc'); ueben(1); frei(10); const eigen = kern();
  await einloggen('ali@test.de');
  const r = await A.abgleichen();
  assert.equal(r.art, 'konflikt');
  assert.ok(r.server.abschnitte > 0 && r.lokal.abschnitte > 0);
  assert.equal(kern(), eigen, 'noch nichts verändert');
  const s = await A.abgleichen({ wahl: 'server' });
  assert.equal(s.art, 'uebernommen'); assert.equal(kern(), stand, 'Stand des Kontos übernommen');
  assert.ok(Z.schnappschuesse().some(x => x.grund === 'vor dem Abgleich'), 'eigener Stand als Schnappschuss gesichert');
});

test('Konflikt, eigenen Stand behalten: Konto wird ersetzt, das andere Gerät folgt und behält Neueres', async () => {
  neueWelt(); an('aaa'); ueben(3); await einloggen('ali@test.de'); await A.abgleichen();
  an('ccc'); ueben(2); frei(10); frei(11); await einloggen('ali@test.de');
  assert.equal((await A.abgleichen()).art, 'konflikt');
  const l = await A.abgleichen({ wahl: 'lokal' });
  assert.equal(l.art, 'ersetzt');
  const c = kern();
  an('aaa'); naechsterTag(); frei(20);                          // A übt noch auf der alten Generation
  const r = await A.abgleichen();
  assert.equal(r.art, 'uebernommen');
  assert.equal(Z.P.sockel.n, [...srv.profile.values()][0].sockel_n);
  assert.ok(Z.P.summe.abschnitte >= JSON.parse(c).summe.abschnitte, 'der neue Stand ist da');
});

test('Eigene neue Generation (Sicherung geladen) wird beim nächsten Abgleich hochgeladen', async () => {
  neueWelt(); an('aaa'); ueben(2); await einloggen('ali@test.de'); await A.abgleichen();
  const text = await Z.exportDatei(); ueben(2);
  const imp = await Z.importDatei(text); Z.ersetzeProfil(imp.profil, imp.exportiert);
  const r = await A.abgleichen();
  assert.equal(r.art, 'ersetzt');
  assert.equal([...srv.profile.values()][0].sockel_n, Z.P.sockel.n);
  an('bbb', { profil: false }); await einloggen('ali@test.de'); await A.abgleichen();
  assert.equal(Z.P.summe.abschnitte, [...srv.profile.values()][0].stand.summe.abschnitte);
});

test('Anmelden ohne Profil auf leerem Konto: kein Profil; Konto löschen räumt den Server ab', async () => {
  neueWelt(); an('bbb', { profil: false }); await einloggen('neu@test.de');
  assert.equal((await A.abgleichen()).art, 'kein_profil');
  an('aaa'); ueben(2); await einloggen('ali@test.de'); await A.abgleichen(); frei(2);
  await A.abgleichen();
  const ex = JSON.parse(await A.datenExport());
  assert.equal(ex.format, 'itqan-konto'); assert.ok(ex.profil && ex.eintraege.length > 0);
  const kernVor = kern();
  await A.kontoLoeschen();
  assert.equal(srv.profile.size, 0); assert.equal(srv.eintraege.length, 0);
  assert.equal(A.status().angemeldet, false); assert.equal(A.status().verbunden, false);
  assert.equal(kern(), kernVor, 'das lokale Profil bleibt erhalten');
  assert.equal(localStorage.getItem('itqan-abgleich'), null);
});

test('Zufallsprobe: drei Geräte üben, gleichen mal ab, mal nicht, mal ohne Netz; am Ende sind alle gleich', async () => {
  for (const saat of [3, 17, 99]) {
    neueWelt();
    let h = saat >>> 0; const z = () => { h = Math.imul(h ^ h >>> 15, 2246822507) + 0x9e3779b9 >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
    an('aaa'); ueben(2); await einloggen('ali@test.de'); await A.abgleichen();
    for (const n of ['bbb', 'ccc']) { an(n, { profil: false }); await einloggen('ali@test.de'); await A.abgleichen(); }
    for (let i = 0; i < 45; i++) {
      an(['aaa', 'bbb', 'ccc'][Math.floor(z() * 3)]);
      const w = z();
      if (w < 0.35) frei(Math.floor(z() * D.A.length), z() < 0.15 ? 'fehler' : z() < 0.3 ? 'hilfe' : 'ok');
      else if (w < 0.5) naechsterTag();
      else if (w < 0.6) { const id = Math.floor(z() * D.A.length); Z.fehlerstellenMerken([`${D.A[id].v[0]}.${Math.floor(z() * 3)}`], 'haraka'); }
      else if (w < 0.65) { Z.P.einst.pensum = Z.P.einst.pensum.map(() => 2 + Math.floor(z() * 3)); Z.speichern(); }
      srv.offline = z() < 0.15;
      if (z() < 0.45) await A.abgleichen({ neuAufbauen: z() < 0.7 });
      srv.offline = false;
    }
    for (let runde = 0; runde < 2; runde++) for (const n of ['aaa', 'bbb', 'ccc']) { an(n); const r = await A.abgleichen(); assert.ok(['ok', 'uebernommen'].includes(r.art), `${n}: ${r.art} ${r.text || ''}`); }
    assert.ok(srv.eintraege.length > 20, 'es wurde wirklich geübt');
    an('aaa'); const a = kern(); an('bbb'); const b = kern(); an('ccc'); const c = kern();
    assert.equal(b, a, `Saat ${saat}: bbb gleich aaa`); assert.equal(c, a, `Saat ${saat}: ccc gleich aaa`);
    // der Stand ist genau das, was aus Sockel und allen Einträgen des Servers entsteht
    const zeile = [...srv.profile.values()][0], liste = srv.eintraege.filter(e => e.sockel_n === zeile.sockel_n).map(e => e.daten);
    const p = Z.nachbau(zeile.stand, liste); delete p.log;
    assert.equal(kanon(p), a, `Saat ${saat}: Stand aus dem Server`);
  }
});
