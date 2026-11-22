// Itqān · Logiktests zur Blätter-Pipeline (js/blaettern.js): Entscheidung Einzel- oder Doppelseite, Paarbildung, Nachbarn, Zustandsautomat.
// Reine Logik ohne DOM; die Bewegung selbst prüft werkzeuge/ui/ablaeufe/08_blaettern.mjs im Browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEITEN, MAX_WARTEND, paarVon, einheitVon, nachbar, gleich, doppelEntscheid, neuerAutomat } from '../js/blaettern.js';

const M = (breite, hoehe, schirmKurz) => ({ breite, hoehe, schirmKurz });

test('Entscheidung Einzel- oder Doppelseite: Handy hoch einzeln, Handy quer doppelt, Tablet und PC doppelt', () => {
  assert.equal(doppelEntscheid(M(390, 844, 390)), false, 'Handy hoch');
  assert.equal(doppelEntscheid(M(844, 390, 390)), true, 'Handy quer');
  assert.equal(doppelEntscheid(M(667, 375, 375)), true, 'kleines Handy quer (667 breit)');
  assert.equal(doppelEntscheid(M(568, 320, 320)), false, 'sehr kleines Handy quer unter 600');
  assert.equal(doppelEntscheid(M(820, 1180, 820)), true, 'Tablet hoch');
  assert.equal(doppelEntscheid(M(1180, 820, 820)), true, 'Tablet quer');
  assert.equal(doppelEntscheid(M(1366, 768, 768)), true, 'PC');
  assert.equal(doppelEntscheid(M(650, 900, 1080)), false, 'schmales Fenster am PC, hoch');
  assert.equal(doppelEntscheid(M(650, 500, 1080)), true, 'schmales, aber breiteres als hohes Fenster am PC');
  assert.equal(doppelEntscheid(M(700, 900, 1080)), true, 'genau an der Schwelle 700');
  assert.equal(doppelEntscheid(M(699, 900, 1080)), false);
});

test('Entscheidung: kein Hin und Her an der Schwelle (24 px Spielraum nach unten)', () => {
  assert.equal(doppelEntscheid(M(690, 900, 1080), null), false);
  assert.equal(doppelEntscheid(M(690, 900, 1080), false), false);
  assert.equal(doppelEntscheid(M(690, 900, 1080), true), true, 'wer doppelt zeigt, behält es knapp unter der Schwelle');
  assert.equal(doppelEntscheid(M(670, 900, 1080), true), false, 'deutlich darunter geht es zurück');
  assert.equal(doppelEntscheid(M(390, 844, 390), true), false, 'Handy hoch bleibt einzeln, auch wenn vorher doppelt');
  // eine Größenfolge beim Ziehen des Fensters: je Schwelle genau ein Wechsel
  let d = null, wechsel = 0, vor = null;
  for (let w = 760; w >= 640; w -= 4) { d = doppelEntscheid(M(w, 900, 1080), d); if (vor !== null && d !== vor) wechsel++; vor = d; }
  for (let w = 640; w <= 760; w += 4) { d = doppelEntscheid(M(w, 900, 1080), d); if (d !== vor) wechsel++; vor = d; }
  assert.equal(wechsel, 2, 'ein Wechsel nach unten, einer nach oben');
});

test('Paarbildung: ungerade Seite rechts, Paare 1-2, 3-4 … 603-604', () => {
  assert.deepEqual(paarVon(1), [1, 2]); assert.deepEqual(paarVon(2), [1, 2]);
  assert.deepEqual(paarVon(3), [3, 4]); assert.deepEqual(paarVon(4), [3, 4]);
  assert.deepEqual(paarVon(603), [603, 604]); assert.deepEqual(paarVon(604), [603, 604]);
  for (let p = 1; p <= SEITEN; p++) { const e = paarVon(p); assert.ok(e.includes(p) && e.length === 2 && e[0] % 2 === 1 && e[1] === e[0] + 1, String(p)); }
});

test('Einheit: einzeln oder als Paar, Seitenzahl wird auf 1 bis 604 begrenzt', () => {
  assert.deepEqual(einheitVon(5, false), [5]); assert.deepEqual(einheitVon(5, true), [5, 6]); assert.deepEqual(einheitVon(6, true), [5, 6]);
  assert.deepEqual(einheitVon(0, false), [1]); assert.deepEqual(einheitVon(9999, true), [603, 604]); assert.deepEqual(einheitVon('x', false), [1]);
  assert.ok(gleich([1, 2], [1, 2]) && !gleich([1, 2], [1]) && !gleich(null, [1]));
});

test('Nachbarn: weiter im Buch heißt höhere Seiten, am Rand null, Paare springen um zwei', () => {
  assert.deepEqual(nachbar([21], 1, false), [22]); assert.deepEqual(nachbar([21], -1, false), [20]);
  assert.equal(nachbar([1], -1, false), null); assert.equal(nachbar([604], 1, false), null);
  assert.deepEqual(nachbar([21, 22], 1, true), [23, 24]); assert.deepEqual(nachbar([21, 22], -1, true), [19, 20]);
  assert.equal(nachbar([1, 2], -1, true), null); assert.equal(nachbar([603, 604], 1, true), null);
  assert.deepEqual(nachbar([601, 602], 1, true), [603, 604]);
  // Hin und zurück führt zum selben Blatt
  for (const dop of [false, true]) for (let p = 1; p <= SEITEN; p += 7) { const e = einheitVon(p, dop), n = nachbar(e, 1, dop); if (n) assert.ok(gleich(nachbar(n, -1, dop), e)); }
});

test('Automat: ein Blatt vor, Bewegung beginnt, Ende befördert', () => {
  const a = neuerAutomat(21, false);
  assert.deepEqual(a.jetzt, [21]); assert.equal(a.phase, 'ruhe');
  const [s] = a.anfrage(1);
  assert.equal(s.art, 'start'); assert.equal(s.lauf.richtung, 1); assert.deepEqual(s.lauf.ziel, [22]); assert.equal(a.phase, 'wartet');
  assert.deepEqual(a.jetzt, [21], 'bis zur Landung gilt noch das alte Blatt');
  assert.equal(a.bereit(s.lauf.id), true); assert.equal(a.phase, 'laeuft');
  const f = a.fertig(s.lauf.id);
  assert.deepEqual(f.befoerdert, [22]); assert.equal(f.weiter, null); assert.deepEqual(a.jetzt, [22]); assert.equal(a.phase, 'ruhe');
  const [z] = a.anfrage(-1);
  assert.deepEqual(z.lauf.ziel, [21]); a.bereit(z.lauf.id); assert.deepEqual(a.fertig(z.lauf.id).befoerdert, [21]);
});

test('Automat: am Rand des Buches keine Bewegung', () => {
  assert.deepEqual(neuerAutomat(1, false).anfrage(-1), [{ art: 'rand' }]);
  assert.deepEqual(neuerAutomat(604, false).anfrage(1), [{ art: 'rand' }]);
  assert.deepEqual(neuerAutomat(2, true).anfrage(-1), [{ art: 'rand' }]);
  assert.deepEqual(neuerAutomat(603, true).anfrage(1), [{ art: 'rand' }]);
  const a = neuerAutomat(603, false); const [s] = a.anfrage(1); a.bereit(s.lauf.id); a.fertig(s.lauf.id);   // 604
  assert.deepEqual(a.anfrage(1), [{ art: 'rand' }]);
});

test('Automat: schnelles zweites Blättern in dieselbe Richtung reiht sich an und beschleunigt, die Bewegung bleibt stetig', () => {
  const a = neuerAutomat(21, false);
  const [s] = a.anfrage(1); a.bereit(s.lauf.id);
  const b = a.anfrage(1);
  assert.equal(b[0].art, 'beschleunigen'); assert.ok(b[0].rate > 1); assert.equal(a.wartend, 1);
  const c = a.anfrage(1); assert.ok(c[0].rate > b[0].rate, 'je mehr wartet, desto schneller');
  const f1 = a.fertig(s.lauf.id);
  assert.deepEqual(f1.befoerdert, [22]); assert.equal(f1.weiter.richtung, 1); assert.deepEqual(f1.weiter.ziel, [23]);
  assert.equal(a.phase, 'wartet'); assert.equal(a.wartend, 1, 'eines wartet noch');
  a.bereit(f1.weiter.id); const f2 = a.fertig(f1.weiter.id);
  assert.deepEqual(f2.befoerdert, [23]); assert.deepEqual(f2.weiter.ziel, [24]);
  a.bereit(f2.weiter.id); const f3 = a.fertig(f2.weiter.id);
  assert.deepEqual(f3.befoerdert, [24]); assert.equal(f3.weiter, null); assert.equal(a.phase, 'ruhe'); assert.deepEqual(a.jetzt, [24]);
});

test('Automat: die Warteschlange ist begrenzt und endet am Rand des Buches', () => {
  const a = neuerAutomat(10, false); const [s] = a.anfrage(1); a.bereit(s.lauf.id);
  const arten = []; for (let i = 0; i < 8; i++) arten.push(a.anfrage(1)[0].art);
  assert.equal(arten.filter(x => x === 'beschleunigen').length, MAX_WARTEND); assert.ok(arten.slice(MAX_WARTEND).every(x => x === 'rand'));
  const b = neuerAutomat(602, false); const [t] = b.anfrage(1); b.bereit(t.lauf.id);
  assert.equal(b.anfrage(1)[0].art, 'beschleunigen', 'nach 603 kommt noch 604'); assert.equal(b.anfrage(1)[0].art, 'rand', 'danach ist das Buch zu Ende');
});

test('Automat: Gegenrichtung mitten in der Bewegung kehrt um, das Blatt bleibt, danach geht es in die neue Richtung weiter', () => {
  const a = neuerAutomat(21, false);
  const [s] = a.anfrage(1); a.bereit(s.lauf.id);
  assert.deepEqual(a.anfrage(-1), [{ art: 'umkehren' }]); assert.equal(a.phase, 'zurueck');
  assert.deepEqual(a.anfrage(1), [{ art: 'vormerken' }], 'während der Umkehr nur vormerken');
  const f = a.fertig(s.lauf.id, true);
  assert.equal(f.befoerdert, null); assert.deepEqual(a.jetzt, [21], 'umgekehrt: nichts hat sich geändert');
  assert.ok(f.weiter && f.weiter.richtung === 1 && gleich(f.weiter.ziel, [22]), 'das Vorgemerkte beginnt jetzt');
  const b = neuerAutomat(21, false); const [t] = b.anfrage(1); b.bereit(t.lauf.id); b.anfrage(-1);
  const g = b.fertig(t.lauf.id, true); assert.equal(g.weiter, null); assert.equal(b.phase, 'ruhe');
});

test('Automat: Gegenrichtung, solange das Nachbarblatt noch gebaut wird, verwirft den Wunsch', () => {
  const a = neuerAutomat(21, false);
  const [s] = a.anfrage(1);
  assert.deepEqual(a.anfrage(-1), [{ art: 'verwerfen' }]); assert.equal(a.phase, 'ruhe'); assert.equal(a.bereit(s.lauf.id), false, 'der verworfene Lauf wird nicht mehr bereit');
  assert.deepEqual(a.jetzt, [21]);
  const [n] = a.anfrage(-1); assert.deepEqual(n.lauf.ziel, [20]);
});

test('Automat: veraltete Meldungen (falsche Kennung) ändern nichts', () => {
  const a = neuerAutomat(21, false); const [s] = a.anfrage(1);
  assert.equal(a.bereit(s.lauf.id + 7), false); assert.deepEqual(a.fertig(s.lauf.id + 7), { befoerdert: null, weiter: null }); assert.deepEqual(a.jetzt, [21]); assert.equal(a.phase, 'wartet');
  a.verwerfen(); assert.equal(a.phase, 'ruhe'); assert.deepEqual(a.fertig(s.lauf.id), { befoerdert: null, weiter: null });
});

test('Automat: stopp (Zoom) verwirft angereihte Blätter, die laufende Bewegung endet normal', () => {
  const a = neuerAutomat(21, false); const [s] = a.anfrage(1); a.bereit(s.lauf.id);
  a.anfrage(1); a.anfrage(1); assert.equal(a.wartend, 2);
  a.stopp(); assert.equal(a.wartend, 0);
  const f = a.fertig(s.lauf.id); assert.deepEqual(f.befoerdert, [22]); assert.equal(f.weiter, null); assert.equal(a.phase, 'ruhe');
  const b = neuerAutomat(21, false); const [t] = b.anfrage(1); b.bereit(t.lauf.id); b.anfrage(-1); b.anfrage(1); b.stopp();
  assert.equal(b.fertig(t.lauf.id, true).weiter, null, 'auch ein vorgemerktes Blatt fällt weg');
});

test('Automat: Sprung (Regler, Gehe zu) und Wechsel Einzel/Doppel setzen alles zurück', () => {
  const a = neuerAutomat(21, false); const [s] = a.anfrage(1); a.bereit(s.lauf.id); a.anfrage(1);
  a.springen(300); assert.deepEqual(a.jetzt, [300]); assert.equal(a.phase, 'ruhe'); assert.equal(a.wartend, 0); assert.equal(a.lauf, null);
  a.springen(300, true); assert.deepEqual(a.jetzt, [299, 300]); assert.equal(a.doppel, true);
  const [d] = a.anfrage(1); assert.deepEqual(d.lauf.ziel, [301, 302]);
  a.springen(5, false); assert.deepEqual(a.jetzt, [5]); assert.deepEqual(a.anfrage(1)[0].lauf.ziel, [6]);
});

test('Automat: zufällige Folgen von Anfragen und Meldungen halten die Zustände ein', () => {
  let z = 12345; const zufall = () => (z = (z * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let runde = 0; runde < 60; runde++) {
    const dop = zufall() < 0.5, a = neuerAutomat(1 + Math.floor(zufall() * SEITEN), dop);
    let laufend = null;
    for (let i = 0; i < 80; i++) {
      const w = zufall();
      if (w < 0.45) {
        for (const x of a.anfrage(zufall() < 0.5 ? 1 : -1)) if (x.art === 'start') laufend = x.lauf;
      } else if (w < 0.7 && laufend) { if (a.bereit(laufend.id) === false) laufend = null; }
      else if (w < 0.9 && laufend) {
        const f = a.fertig(laufend.id, a.phase === 'zurueck'); laufend = f.weiter;
        if (f.befoerdert) assert.ok(gleich(f.befoerdert, a.jetzt));
      } else if (w < 0.95) { a.verwerfen(); laufend = null; }
      else { a.springen(1 + Math.floor(zufall() * SEITEN)); laufend = null; }
      // Grundregeln: aktuelle Einheit gültig, Phase bekannt, ohne Lauf auch keine Phase außer ruhe
      assert.ok(a.jetzt.length === (dop ? paarVon(a.jetzt[0]).length : 1) && a.jetzt.every(p => p >= 1 && p <= SEITEN), 'Einheit gültig');
      assert.ok(['ruhe', 'wartet', 'laeuft', 'zurueck'].includes(a.phase));
      assert.equal(a.phase === 'ruhe', a.lauf === null, 'Phase ruhe genau dann, wenn kein Lauf');
      assert.ok(a.wartend >= 0 && a.wartend <= MAX_WARTEND);
      if (a.lauf) assert.ok(a.lauf.ziel.length >= 1 && a.lauf.ziel.every(p => p >= 1 && p <= SEITEN));
    }
  }
});
