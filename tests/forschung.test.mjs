// Itqān · Freiwilliges Lernprotokoll: nichts ohne Zustimmung, danach eine anonyme Zeile je Übung, Widerruf leert alles
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { Z, D, frisch, naechsterTag, tagSetzenZurueck } from './umgebung.mjs';
import * as F from '../js/forschung.js';
import { attrappe } from './server_attrappe.mjs';

let zurueck;
after(() => { Z.abschlussHakenSetzen(null); tagSetzenZurueck(); zurueck?.(); });
const ok = id => Array.from({ length: D.A[id].ayat }, () => 'ok');

test('Ohne Zustimmung wird nichts aufgezeichnet', () => {
  frisch({ pensum: 2 }); Z.abschlussHakenSetzen(F.eintragen);
  assert.equal(F.an(), false);
  const id = Z.tagesplan().plan[0]; Z.abschnittAbschliessen(id, ok(id));
  assert.equal(F.warteschlange().length, 0);
});

test('Nach Zustimmung: je Übung eine Zeile ohne Namen und Datum, mit Abstand und vorhergesagter Sicherheit', async () => {
  frisch({ pensum: 2 }); Z.abschlussHakenSetzen(F.eintragen);
  F.einschalten(); assert.equal(F.an(), true);
  const id = Z.tagesplan().plan[0], n = D.A[id].ayat;
  Z.abschnittAbschliessen(id, ok(id));
  naechsterTag(3);
  const r = ok(id); r[0] = 'fehler';
  Z.abschnittAbschliessen(id, r, 'frei');
  const q = F.warteschlange();
  assert.equal(q.length, 2);
  assert.equal(q[0].g, null); assert.equal(q[0].v, n); assert.equal(q[0].f, 0);
  assert.equal(q[1].g, 3); assert.ok(q[1].r > 0 && q[1].r <= 1); assert.equal(q[1].f, 1); assert.equal(q[1].a, 'frei');
  // S7: genau die Felder, die der Datenschutztext und der Zustimmungsdialog nennen (Liste F.FELDER)
  assert.deepEqual(F.FELDER, ['pid', 't', 's', 'o', 'g', 'st', 'r', 'v', 'f', 'z', 'h', 'a', 'n', 'm']);
  for (const z of q) assert.deepEqual(Object.keys(z), F.FELDER, 'die Zeile hat genau die genannten Felder');
  assert.ok(!JSON.stringify(q).includes('@') && !/20\d\d-\d\d-\d\d/.test(JSON.stringify(q)), 'weder E-Mail noch Datum');
  await F.widerrufen();
  assert.equal(F.an(), false); assert.equal(F.warteschlange().length, 0);
});

// ---------- Audit 1.99: S7, S15, Abl. 12 ----------
const zeile = (pid, extra = {}) => ({ pid, t: 0, s: 1, o: 'fort-2', g: null, st: null, r: null, v: 5, f: 0, z: 0, h: 0, a: 'frei', n: 3, m: 'm1', ...extra });
const schlange = l => localStorage.setItem('itqan-forschung-q', JSON.stringify(l));
function welt() { zurueck?.(); const srv = attrappe(); zurueck = srv.einsetzen(); localStorage.clear(); return srv; }
const pid = () => JSON.parse(localStorage.getItem('itqan-forschung')).pid;

test('S7: der Datenschutztext nennt jedes gesendete Feld (deutsch und englisch)', { skip: !existsSync(new URL('../../werkzeuge/website/rechtstexte.py', import.meta.url)) && 'ohne Website-Werkzeuge (nur im Gesamtprojekt)' }, () => {
  const text = readFileSync(new URL('../../werkzeuge/website/rechtstexte.py', import.meta.url), 'utf8');
  const de = text.split("DS_DE = '''")[1].split("'''")[0], en = text.split("DS_EN = '''")[1].split("'''")[0];
  const worte = {
    pid: ['zufällige Nummer', 'random number'], t: ['Tage seit deiner Zustimmung', 'days since your consent'], s: ['Nummer des Abschnitts', 'number of the section'],
    o: ['Gliederung', 'division'], g: ['Abstand in Tagen', 'interval in days'], st: ['geschätzte Stabilität', 'stability estimated'],
    r: ['vorhergesagte Sicherheit', 'predicted certainty'], v: ['Zahl der Verse', 'number of verses'], f: ['Fehler', 'mistake'], z: ['Zögern', 'hesitation'],
    h: ['Hilfe', 'help'], a: ['Art der Übung', 'type of exercise'], n: ['Pensum', 'daily amount'], m: ['Fassung des Lernmodells', 'version of the learning model']
  };
  assert.deepEqual(Object.keys(worte), F.FELDER, 'für jedes Feld der Zeile steht hier, wie der Text es nennt');
  for (const [k, [d, e]] of Object.entries(worte)) { assert.ok(de.includes(d), `DE nennt ${k}: ${d}`); assert.ok(en.includes(e), `EN nennt ${k}: ${e}`); }
  assert.ok(!/[–—]/.test(de), 'deutscher Text ohne Gedankenstriche');
});

test('S15: lehnt der Server Zeilen ab, blockieren sie die Warteschlange nicht: Gültiges kommt an, Unzustellbares wird verworfen', async () => {
  const srv = welt(); F.einschalten(); const p = pid();
  schlange([zeile(p, { s: 1 }), zeile(p, { s: 2, v: 500 }), zeile(p, { s: 3 }), zeile(p, { s: 4, n: 400 }), zeile(p, { s: 5 })]);
  assert.equal(await F.senden(), true);
  assert.deepEqual(srv.forschung.map(z => z.s), [1, 3, 5]);
  assert.equal(F.warteschlange().length, 0);
});

test('S15: vorübergehende Fehler (kein Netz, 5xx, 429) behalten die Warteschlange', async () => {
  const srv = welt(); F.einschalten(); const p = pid();
  schlange([zeile(p), zeile(p, { s: 2 })]);
  srv.offline = true; assert.equal(await F.senden(), false); assert.equal(F.warteschlange().length, 2); srv.offline = false;
  for (const status of [503, 429, 401]) { srv.stoeren('/rest/v1/forschung', { status }); assert.equal(await F.senden(), false); assert.equal(F.warteschlange().length, 2, String(status)); }
  assert.equal(await F.senden(), true); assert.equal(srv.forschung.length, 2); assert.equal(F.warteschlange().length, 0);
});

test('Abl. 12: zuruecksetzen() beendet die Zustimmung, verwirft die Warteschlange und löscht die gesendeten Zeilen', async () => {
  const srv = welt(); F.einschalten(); const p = pid();
  schlange([zeile(p), zeile(p, { s: 2 })]); await F.senden(); schlange([zeile(p, { s: 3 })]);
  assert.equal(srv.forschung.length, 2);
  const lauf = F.zuruecksetzen();
  assert.equal(F.an(), false, 'sofort aus, ohne auf das Netz zu warten'); assert.equal(F.warteschlange().length, 0);
  assert.equal(await lauf, true); assert.equal(srv.forschung.length, 0);
  F.einschalten(); assert.notEqual(pid(), p, 'eine neue Zustimmung bekommt eine neue Nummer');
  // ohne Netz: vorgemerkt, beim nächsten Start nachgeholt
  const p2 = pid(); schlange([zeile(p2)]); await F.senden(); assert.equal(srv.forschung.length, 1);
  srv.offline = true; assert.equal(await F.zuruecksetzen(), false); assert.equal(F.an(), false);
  assert.deepEqual(JSON.parse(localStorage.getItem('itqan-forschung-loeschen')), [p2]);
  srv.offline = false; F.starten(); await new Promise(r => setTimeout(r, 20));
  assert.equal(srv.forschung.length, 0); assert.equal(localStorage.getItem('itqan-forschung-loeschen'), null);
  assert.equal(await F.zuruecksetzen(), true, 'ohne Zustimmung ist nichts zu tun');
});

test('S15: die zufällige Nummer kommt auch ohne randomUUID aus dem sicheren Zufall', () => {
  welt(); const alt = Object.getOwnPropertyDescriptor(globalThis, 'crypto'); let benutzt = 0;
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: b => { benutzt++; for (let i = 0; i < b.length; i++) b[i] = (i * 37 + 11) & 255; return b; } } });
  try { F.einschalten(); } finally { Object.defineProperty(globalThis, 'crypto', alt); }
  assert.equal(benutzt, 1);
  assert.match(pid(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
