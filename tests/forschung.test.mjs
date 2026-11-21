// Itqān · Freiwilliges Lernprotokoll: nichts ohne Zustimmung, danach eine anonyme Zeile je Übung, Widerruf leert alles
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Z, D, frisch, naechsterTag, tagSetzenZurueck } from './umgebung.mjs';
import * as F from '../js/forschung.js';

after(() => { Z.abschlussHakenSetzen(null); tagSetzenZurueck(); });
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
  const erlaubt = new Set(['pid', 't', 's', 'o', 'g', 'st', 'r', 'v', 'f', 'z', 'h', 'a', 'n', 'm']);
  for (const z of q) for (const k of Object.keys(z)) assert.ok(erlaubt.has(k), 'unerwartetes Feld ' + k);
  assert.ok(!JSON.stringify(q).includes('@') && !/20\d\d-\d\d-\d\d/.test(JSON.stringify(q)), 'weder E-Mail noch Datum');
  await F.widerrufen();
  assert.equal(F.an(), false); assert.equal(F.warteschlange().length, 0);
});
