// Itqān · Lernprotokoll und Profiltausch über das Konto (Nach-Audit Sicherheit N7): Ersetzt der Abgleich das Profil dieses Geräts
// durch ein anderes vom Konto, endet die Zustimmung des alten Profils. Behält das Gerät sein Profil, läuft sie weiter.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Z, frisch, gliederungSetzen, naechsterTag, tagSetzenZurueck, wirdErfuellen } from './umgebung.mjs';
import * as A from '../js/abgleich.js';
import * as F from '../js/forschung.js';
import { attrappe } from './server_attrappe.mjs';

const urspruenglich = globalThis.localStorage;
let srv, zurueck;
A.starten(); A.autoSetzen(false);
after(() => { globalThis.localStorage = urspruenglich; Z.speicherSetzen(null); A.geraetWechsel(); gliederungSetzen('fort'); tagSetzenZurueck(); zurueck?.(); Z.eintragHakenSetzen(null); });

const speicherNeu = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() }; };
let geraete;
function neueWelt() { zurueck?.(); srv = attrappe(); zurueck = srv.einsetzen(); geraete = {}; }
function an(name) {
  const g = geraete[name] ??= { ls: speicherNeu(), neu: true };
  globalThis.localStorage = g.ls; Z.speicherSetzen(null); A.geraetWechsel(); gliederungSetzen('fort');
  if (g.neu) { Z.geraetSetzen(name); g.neu = false; }
  if (g.ls.getItem('itqan-profil-v1')) Z.laden(); else Z.loeschen();
  if (!Z.P) { frisch(); Z.geraetSetzen(name); Z.P.erstellt = new Date(Date.UTC(2026, 0, 1, 0, 0, Object.keys(geraete).length)).toISOString(); Z.speichern(); }   // jedes Gerät legt sein Profil zu einem eigenen Zeitpunkt an
  return g;
}
const einloggen = async email => { await A.codeSenden(email); return A.codePruefen(email, '123456'); };
const ueben = (n = 1) => { for (let i = 0; i < n; i++) { wirdErfuellen(); naechsterTag(); } };
const zeile = pid => ({ pid, t: 0, s: 1, o: 'fort-2', g: null, st: null, r: null, v: 5, f: 0, z: 0, h: 0, a: 'frei', n: 3, m: 'm1' });
const kontoSeite = () => { const q = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n'), i = q.indexOf('  async function abgleichen(wahl) {'); return q.slice(i, q.indexOf('\n  }\n', i)); };

test('N7: nach dem Abgleich mit dem Konto beendet die Kontoseite das Lernprotokoll, wenn ein anderes Profil eingebaut wurde (Quelltext)', () => {
  const f = kontoSeite();
  const a = f.indexOf('Ab.abgleichen({ wahl })'), z = f.indexOf('Forschung.zuruecksetzen()'), r = f.indexOf('return');
  assert.ok(a > 0 && z > a, 'der Aufruf steht nach dem Abgleich');
  assert.ok(z < r, 'und vor jedem vorzeitigen return (Ansicht gewechselt, Konflikt, neu laden)');
  assert.match(f, /erstellt0 = Z\.P\?\.erstellt/); assert.match(f, /if \(Z\.P\?\.erstellt !== erstellt0\) Forschung\.zuruecksetzen\(\)/);
});

test('N7: ein vom Konto übernommenes Profil hat einen anderen Anlegezeitpunkt, beim Behalten des eigenen Stands bleibt er gleich', async () => {
  neueWelt(); an('aaa'); ueben(3); await einloggen('ali@test.de'); await A.abgleichen();
  an('ccc'); ueben(2);
  const eigen = Z.P.erstellt; F.einschalten(); const pid = JSON.parse(localStorage.getItem('itqan-forschung')).pid;
  localStorage.setItem('itqan-forschung-q', JSON.stringify([zeile(pid)]));
  await einloggen('ali@test.de');
  assert.equal((await A.abgleichen()).art, 'konflikt');
  // eigenen Stand behalten: dasselbe Profil, die Zustimmung bleibt (die Kontoseite ruft nichts auf)
  assert.equal((await A.abgleichen({ wahl: 'lokal' })).art, 'ersetzt');
  assert.equal(Z.P.erstellt, eigen); assert.equal(F.an(), true); assert.equal(F.warteschlange().length, 1);
  // Gegenstück: Gerät aaa nimmt das Profil des Kontos an (ccc hat es überschrieben, deshalb jetzt umgekehrt)
  neueWelt(); an('aaa'); ueben(3); await einloggen('ali@test.de'); await A.abgleichen();
  an('ccc'); ueben(2); const vorher = Z.P.erstellt; F.einschalten();
  const p2 = JSON.parse(localStorage.getItem('itqan-forschung')).pid; localStorage.setItem('itqan-forschung-q', JSON.stringify([zeile(p2)]));
  await einloggen('ali@test.de'); assert.equal((await A.abgleichen()).art, 'konflikt');
  const r = await A.abgleichen({ wahl: 'server' });
  assert.equal(r.art, 'uebernommen'); assert.notEqual(Z.P.erstellt, vorher, 'ein anderes Profil');
  // genau das prüft die Kontoseite (Z.P.erstellt !== erstellt0) und ruft dann zuruecksetzen()
  assert.equal(F.an(), true, 'ohne den Aufruf liefe die alte Nummer weiter');
  await F.zuruecksetzen();
  assert.equal(F.an(), false); assert.equal(F.warteschlange().length, 0);
  assert.equal(srv.forschung.filter(x => x.pid === p2).length, 0);
});
