// Itqān · Wiedereinstieg nach Pause, Gezögert und Behaltensquote
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Z, D, frisch, naechsterTag, wirdErfuellen, tagSetzenZurueck } from './umgebung.mjs';

after(() => { Z.logGrenze(0); tagSetzenZurueck(); });

test('Wiedereinstieg: nach drei versäumten Tagen drei Tage lang das halbe Pensum, dann wieder voll', () => {
  frisch({ pensum: 4 });
  wirdErfuellen();                       // Tag 1 erfüllt
  naechsterTag(4);                        // drei Tage versäumt (Tag 2, 3, 4), heute ist Tag 5
  const t5 = Z.tagesplan();
  assert.equal(t5.cb, 1); assert.equal(t5.plan.length, 2);
  wirdErfuellen(); naechsterTag();
  const t6 = Z.tagesplan(); assert.equal(t6.cb, 2); assert.equal(t6.plan.length, 2);
  wirdErfuellen(); naechsterTag();
  const t7 = Z.tagesplan(); assert.equal(t7.cb, 3); assert.equal(t7.plan.length, 2);
  wirdErfuellen(); naechsterTag();
  const t8 = Z.tagesplan(); assert.equal(t8.cb, undefined); assert.equal(t8.plan.length, 4);
});

test('Wiedereinstieg: zwei versäumte Tage lösen ihn nicht aus', () => {
  frisch({ pensum: 4 });
  wirdErfuellen(); naechsterTag(3);
  const t = Z.tagesplan(); assert.equal(t.cb, undefined); assert.equal(t.plan.length, 4);
});

test('Wiedereinstieg beenden füllt das übliche Pensum auf', () => {
  frisch({ pensum: 4 });
  wirdErfuellen(); naechsterTag(4);
  assert.equal(Z.tagesplan().plan.length, 2);
  Z.comebackBeenden();
  assert.equal(Z.tagesplan().plan.length, 4);
});

test('Gezögert zählt halb, senkt die Stufe nicht und kommt nach spätestens 3 Tagen wieder', () => {
  frisch({ pensum: 1 });
  const id = Z.tagesplan().plan[0], e = D.A[id];
  const res = Z.abschnittAbschliessen(id, Array.from({ length: e.ayat }, (_, i) => i === 0 ? 'zoegern' : 'ok'));
  const k = Z.karte(id);
  assert.equal(k.st, 0);                                 // keine Stufe hinzu, keine verloren
  assert.equal(k.fae, Z.plusTage(Z.heute(), 3));
  assert.equal(res.punkte, 10 * (e.ayat - 1) + 5);       // kein Fehlerfrei-Bonus
  assert.equal(res.f, 0);
});

test('Behaltensquote: nur Āyāt beim ersten Versuch ohne Fehler, Hilfe und Zögern', () => {
  frisch({ pensum: 1 });
  assert.equal(Z.behaltensquote(30).quote, null);       // zu wenig Daten
  const id = Z.tagesplan().plan[0], e = D.A[id], n = e.ayat;
  Z.abschnittAbschliessen(id, Array.from({ length: n }, (_, i) => i < 2 ? 'zoegern' : 'ok'));
  const b = Z.behaltensquote(30);
  assert.ok(Math.abs(b.quote - 100 * (n - 2) / n) < 1e-9 || b.quote === null);
  assert.equal(b.ziel, 95);
});
