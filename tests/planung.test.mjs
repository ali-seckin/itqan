// Itqān · Tests zu Etappe 3: Regler für schwache Abschnitte, Ruhetage, Pause, Auswertung
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Z, D, frisch, naechsterTag, tagSetzen, wirdErfuellen } from './umgebung.mjs';
import { simulieren } from './simulation.mjs';

test('Regler: „Schwächen zuerst“ verlängert die Ḫatma höchstens um 10 %, schwache Abschnitte kommen mindestens doppelt so oft', () => {
  const basis = simulieren('khatma'), schwach = simulieren('schwaechen');
  assert.ok(schwach.khatma <= basis.khatma * 1.10, `Ḫatma ${schwach.khatma} statt ${basis.khatma}`);
  assert.ok(schwach.regulaerSchwach >= 2 * basis.regulaerSchwach, `×${(schwach.regulaerSchwach / basis.regulaerSchwach).toFixed(2)}`);
});

test('Regler: Festigen holt einen schwachen Abschnitt nach einer Vierteljahresrunde zurück, nie einen fehlerfreien', () => {
  frisch({ pensum: 5 });
  Z.P.einst.schwaechen = 'schwaechen'; Z.P.zyklus.konto = 1;
  const alt = Z.plusTage(Z.heute(), -60);
  Z.P.karten[100] = { st: 1, n: 2, fe: 3, zul: alt, fz: alt, fae: null, fs: 0, fa: [], lf: 0 };   // schwach, lange her
  Z.P.karten[101] = { st: 3, n: 3, fe: 0, zul: alt, fae: null, fs: 0, fa: [], lf: 0 };            // fehlerfrei
  const t = Z.tagesplan();
  assert.equal(t.art[100], 'festigen');
  assert.equal(t.art[101], undefined);
  assert.equal(t.plan.length, 5);
});

test('Regler: „Ḫatma zuerst“ plant kein Festigen ein', () => {
  frisch({ pensum: 5 });
  Z.P.einst.schwaechen = 'khatma'; Z.P.zyklus.konto = 3;
  const alt = Z.plusTage(Z.heute(), -60);
  Z.P.karten[100] = { st: 0, n: 2, fe: 4, zul: alt, fz: alt, fae: null, fs: 0, fa: [], lf: 0 };
  assert.ok(!Object.values(Z.tagesplan().art).includes('festigen'));
});

test('Ruhetag: kein Wird, die Kette läuft über den Ruhetag weiter', () => {
  frisch({ datum: '2026-01-05', pensum: 3 });          // Montag
  Z.P.einst.pensum[1] = 0;                              // Dienstag Ruhetag
  wirdErfuellen(); assert.equal(Z.P.kette.n, 1);
  naechsterTag();                                       // Dienstag
  const t = Z.tagesplan();
  assert.equal(t.ruhe, 'ruhetag'); assert.equal(t.plan.length, 0);
  assert.ok(Z.ketteAktiv());
  naechsterTag();                                       // Mittwoch
  assert.equal(Z.tagesplan().qadaa, 0);
  wirdErfuellen(); assert.equal(Z.P.kette.n, 2);
});

test('Ruhetag: trotzdem üben zählt für die Kette, der nächste Wird-Tag setzt sie fort', () => {
  frisch({ datum: '2026-01-05', pensum: 3 });
  Z.P.einst.pensum[1] = 0;
  wirdErfuellen();
  naechsterTag(); Z.tagesplan();
  const t = Z.trotzdemUeben();
  assert.equal(t.plan.length, 3); assert.ok(t.freiwillig);
  wirdErfuellen(); assert.equal(Z.P.kette.n, 2);
  naechsterTag(); wirdErfuellen(); assert.equal(Z.P.kette.n, 3);
});

test('Ruhetag: fällt der Wird-Tag davor aus, gibt es Qaḍāʾ über den Ruhetag hinweg', () => {
  frisch({ datum: '2026-01-05', pensum: 2 });          // Montag
  Z.P.einst.pensum[2] = 0;                              // Mittwoch Ruhetag
  wirdErfuellen();                                      // Montag
  tagSetzen('2026-01-08');                              // Dienstag ausgelassen, Mittwoch Ruhetag, jetzt Donnerstag
  const t = Z.tagesplan();
  assert.equal(t.qadaa, 2);
  wirdErfuellen(); assert.equal(Z.P.kette.n, 3);
});

test('Pause: höchstens 30 Tage, keine Wird-Tage, Kette und Fehlerwiederholung warten', () => {
  frisch({ datum: '2026-01-05', pensum: 3 });
  wirdErfuellen(); naechsterTag(); wirdErfuellen();     // Kette 2
  naechsterTag();
  Z.P.karten[5] = { ...Z.karte(5), n: 1, fae: Z.plusTage(Z.heute(), 2) };
  const p = Z.pauseBeginnen(45);
  assert.equal(Z.tageZwischen(p.von, p.bis), Z.PAUSE_MAX - 1);
  assert.equal(Z.karte(5).fae, Z.plusTage(Z.heute(), 2 + Z.PAUSE_MAX));
  assert.equal(Z.tagesplan().ruhe, 'pause');
  naechsterTag(Z.PAUSE_MAX);                            // erster Tag nach der Pause
  assert.ok(!Z.inPause()); assert.ok(Z.ketteAktiv());
  assert.equal(Z.tagesplan().qadaa, 0);
  wirdErfuellen(); assert.equal(Z.P.kette.n, 3);
});

test('Pause: vorzeitig beenden gibt die übrigen Tage an die Fehlerwiederholung zurück', () => {
  frisch({ datum: '2026-01-05', pensum: 3 });
  wirdErfuellen(); naechsterTag();
  Z.P.karten[5] = { ...Z.karte(5), n: 1, fae: Z.plusTage(Z.heute(), 1) };
  Z.pauseBeginnen(10);                                  // heute bis +9, fae +11
  naechsterTag(3);
  assert.ok(Z.pauseBeenden());
  assert.ok(!Z.inPause());
  assert.equal(Z.karte(5).fae, Z.plusTage(Z.heute(), 1));    // ursprünglich 2 Tage vor heute fällig, um die 3 genutzten Pausentage später
  assert.ok(Z.ketteAktiv());
  const t = Z.tagesplan(); assert.ok(!t.ruhe); assert.ok(t.plan.length >= 3);
});

test('Pause: heute schon geübt, dann beginnt sie morgen', () => {
  frisch({ datum: '2026-01-05', pensum: 2 });
  wirdErfuellen();
  const p = Z.pauseBeginnen(7);
  assert.equal(p.von, Z.plusTage(Z.heute(), 1));
  assert.ok(Z.tagesplan().voll);
});

test('Auswertung: Fehlerarten, Sūren, Quote und Zeit stimmen', () => {
  frisch({ datum: '2026-01-05', pensum: 1 });
  const id = Z.tagesplan().plan[0], e = D.A[id];          // al-Fātiḥah, 7 Āyāt
  Z.fehlerstellenMerken([`${e.v[0] + 1}.0`], 'haraka');
  Z.fehlerstellenMerken([`${e.v[0] + 2}.1`, `${e.v[0] + 2}.2`], 'verwechslung');
  Z.fehlerstellenMerken([`${e.v[0] + 3}.0`], 'haraka');
  const erg = Array.from({ length: e.ayat }, (_, i) => [1, 2, 3, 4].includes(i) ? 'fehler' : 'ok');   // 4 Fehler, 3 sicher
  Z.abschnittAbschliessen(id, erg, undefined, 140);
  naechsterTag();
  const id2 = Z.tagesplan().plan.find(x => x !== id) ?? 1, e2 = D.A[id2];
  Z.abschnittAbschliessen(id2, Array(e2.ayat).fill('ok'), 'frei', 100);
  const a = Z.auswertung();
  assert.equal(a.arten.find(x => x.art === 'haraka').n, 2);
  assert.equal(a.arten.find(x => x.art === 'verwechslung').n, 1);
  assert.equal(a.ohneArt, 1);                              // 4 Fehler-Āyāt, 3 davon mit Art
  const f = a.suren.find(x => x.s === 1);
  assert.deepEqual([f.ayat, f.sicher], [7, 3]);
  assert.equal(a.suren[0].s, 1);                           // schwächste Sūra zuerst
  assert.equal(a.zeit.summe, 240); assert.equal(a.zeit.abschnitte, 2);
  assert.equal(a.zeit.jeAbschnitt, 120); assert.equal(a.zeit.jeAya, 240 / (7 + e2.ayat));
  const w = a.wochen.at(-1); assert.equal(w.ayat, 7 + e2.ayat); assert.equal(Math.round(w.quote), Math.round(100 * (3 + e2.ayat) / (7 + e2.ayat)));
  assert.equal(a.quoteGeprueft, 100 * (3 + e2.ayat) / (7 + e2.ayat));
  assert.equal(a.quote, Z.kennzahlen().quote);             // über den ganzen Bereich, nie geübte Āyāt zählen nicht als sicher
});
