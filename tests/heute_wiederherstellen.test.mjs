// Itqān · Heute schon geübt, dann Profil auf einem anderen Gerät oder Ursprung aus dem Konto wiederherstellen:
// die heutigen Abschlüsse und der Tagesplan müssen da sein (Zähler „3/3“, nicht „0/0“).
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
function an(name, { profil = true } = {}) {
  const g = geraete[name] ??= { ls: speicherNeu(), neu: true };
  globalThis.localStorage = g.ls; Z.speicherSetzen(null); A.geraetWechsel(); gliederungSetzen('fort');
  if (g.neu) { Z.geraetSetzen(name); g.neu = false; }
  if (g.ls.getItem('itqan-profil-v1')) Z.laden(); else Z.loeschen();
  if (!Z.P && profil) { frisch(); Z.geraetSetzen(name); }
  return g;
}
const einloggen = async email => { await A.codeSenden(email); return A.codePruefen(email, '123456'); };
const ueben = (n = 1) => { for (let i = 0; i < n; i++) { wirdErfuellen(); naechsterTag(); } };
const heuteStand = () => { const t = Z.tagesplan(), pflicht = t.plan.filter(id => t.art[id] !== 'bonus'); return { plan: t.plan.length, pflicht: pflicht.length, erledigt: pflicht.filter(id => t.fertig.includes(id)).length, fertig: t.fertig.length, punkte: t.punkte, hasanat: t.hasanat }; };

test('Heute schon geübt, dann Konto anlegen (Umzug) und auf zweitem Gerät wiederherstellen', async () => {
  neueWelt(); an('aaa'); ueben(3);
  wirdErfuellen();                         // heute ist der Wird erfüllt
  const vorher = heuteStand(); assert.ok(vorher.plan > 0 && vorher.fertig > 0, 'Vorbedingung: Plan und Abschlüsse heute');
  await einloggen('ali@test.de'); await A.abgleichen();
  an('bbb', { profil: false }); await einloggen('ali@test.de');
  const r = await A.abgleichen(); assert.ok(r.aufgebaut);
  assert.deepEqual(heuteStand(), vorher, 'heute: gleicher Plan, gleiche Abschlüsse');
});

test('Konto besteht schon, dann heute geübt (Einträge) und auf zweitem Gerät wiederherstellen', async () => {
  neueWelt(); an('aaa'); ueben(3);
  await einloggen('ali@test.de'); await A.abgleichen();
  wirdErfuellen();                         // erst nach dem Konto: Plan und Abschlüsse entstehen als Einträge
  const vorher = heuteStand(); assert.ok(vorher.plan > 0 && vorher.fertig > 0);
  await A.abgleichen();
  an('bbb', { profil: false }); await einloggen('ali@test.de');
  const r = await A.abgleichen(); assert.ok(r.aufgebaut);
  assert.deepEqual(heuteStand(), vorher, 'heute: gleicher Plan, gleiche Abschlüsse');
});

test('Plan von heute entstand VOR dem Konto, Abschlüsse danach', async () => {
  neueWelt(); an('aaa'); ueben(3);
  Z.tagesplan();                           // Plan für heute besteht (Heute wurde geöffnet), noch nichts geübt
  await einloggen('ali@test.de'); await A.abgleichen();
  wirdErfuellen();
  const vorher = heuteStand(); assert.ok(vorher.fertig > 0);
  await A.abgleichen();
  an('bbb', { profil: false }); await einloggen('ali@test.de');
  await A.abgleichen();
  assert.deepEqual(heuteStand(), vorher, 'heute: gleicher Plan, gleiche Abschlüsse');
});

test('Plan-Eintrag von heute fehlt auf dem Konto, die Abschlüsse sind da: Wiederherstellung zeigt 3/3 statt 0/0', async () => {
  neueWelt(); an('aaa'); ueben(3);
  await einloggen('ali@test.de'); await A.abgleichen();
  wirdErfuellen();                                         // Plan und Abschlüsse von heute entstehen als Einträge
  const vorher = heuteStand(), heuteD = Z.heute();
  assert.ok(vorher.pflicht > 0 && vorher.erledigt === vorher.pflicht, 'Vorbedingung: heute erfüllt');
  await A.abgleichen();
  const vor = srv.eintraege.length;
  const weg = srv.eintraege.filter(e => e.y === 'pl' && e.daten.d === heuteD);
  assert.ok(weg.length > 0, 'es gibt einen Plan-Eintrag für heute auf dem Konto');
  for (const e of weg) srv.eintraege.splice(srv.eintraege.indexOf(e), 1);   // z. B. nie angekommen oder verworfen
  assert.equal(srv.eintraege.length, vor - weg.length);
  an('bbb', { profil: false }); await einloggen('ali@test.de');
  const r = await A.abgleichen(); assert.ok(r.aufgebaut);
  const nachher = heuteStand();
  assert.ok(nachher.pflicht > 0, 'heute steht nicht auf 0/0');
  assert.equal(nachher.erledigt, nachher.pflicht, 'die heutigen Abschlüsse sind sichtbar');
  assert.equal(nachher.fertig, vorher.fertig);
  assert.equal(nachher.hasanat, vorher.hasanat);
});
