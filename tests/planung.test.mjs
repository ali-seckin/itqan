// Itqān · Tests zu Etappe 3: Regler für schwache Abschnitte, Ruhetage, Pause, Auswertung
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Z, D, frisch, naechsterTag, tagSetzen, wirdErfuellen } from './umgebung.mjs';

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

// Abschnitt 5 mit einer offenen Kontrolle nach Fehler (kon), fällig in n Tagen
const kontrolleIn = n => { Z.P.karten[5] = { st: 0, n: 1, fe: 3, zul: Z.heute(), fa: [], lf: 3, S: 1, kon: Z.plusTage(Z.heute(), n) }; };

test('Pause: höchstens 30 Tage, keine Wird-Tage, die Kette wartet, die Kontrolle nach Fehler steht am ersten Tag danach im Plan', () => {
  frisch({ datum: '2026-01-05', pensum: 3 });
  wirdErfuellen(); naechsterTag(); wirdErfuellen();     // Kette 2
  naechsterTag();
  kontrolleIn(2);
  const p = Z.pauseBeginnen(45);
  assert.equal(Z.tageZwischen(p.von, p.bis), Z.PAUSE_MAX - 1);
  assert.equal(Z.tagesplan().ruhe, 'pause');
  naechsterTag(Z.PAUSE_MAX);                            // erster Tag nach der Pause
  assert.ok(!Z.inPause()); assert.ok(Z.ketteAktiv());
  const t = Z.tagesplan();
  assert.equal(t.qadaa, 0);
  assert.equal(t.art[5], 'fehler', 'die Kontrolle hat gewartet und ist jetzt dran');
  wirdErfuellen(); assert.equal(Z.P.kette.n, 3); assert.equal(Z.karte(5).kon, null);
});

test('Pause: vorzeitig beenden, die Kette läuft weiter und die Kontrolle nach Fehler ist sofort dran', () => {
  frisch({ datum: '2026-01-05', pensum: 3 });
  wirdErfuellen(); naechsterTag();
  kontrolleIn(1);
  Z.pauseBeginnen(10);
  naechsterTag(3);
  assert.ok(Z.pauseBeenden());
  assert.ok(!Z.inPause());
  assert.ok(Z.ketteAktiv());
  const t = Z.tagesplan(); assert.ok(!t.ruhe); assert.ok(t.plan.length >= 3);
  assert.equal(t.art[5], 'fehler');
});

test('Pause beenden: was am Pausentag frei geübt wurde, bleibt im Tag stehen (Audit Abl. 25)', () => {
  frisch({ datum: '2026-01-05', pensum: 2 });
  Z.pauseBeginnen(5);
  assert.equal(Z.tagesplan().ruhe, 'pause');
  const r = Z.abschnittAbschliessen(7, Array(D.A[7].ayat).fill('ok'), 'frei');
  assert.ok(r.punkte > 0);
  assert.ok(!r.ereignisse.some(x => x.typ === 'wird'), 'in der Pause gibt es keinen Wird');
  assert.ok(Z.pauseBeenden());
  const t = Z.tagesplan();
  assert.ok(!t.ruhe); assert.equal(t.plan.length, 2);
  assert.equal(t.punkte, r.punkte); assert.ok(t.fertig.includes(7));
});

test('Ruhetag, Pause, leerer Bestand: freies Üben erfüllt keinen Wird und zählt die Kette nicht (Audit Abl. 8)', () => {
  frisch({ datum: '2026-01-05', pensum: 3 });           // Montag
  Z.P.einst.pensum[1] = 0;                              // Dienstag Ruhetag
  wirdErfuellen(); assert.equal(Z.P.kette.n, 1);
  naechsterTag();
  assert.equal(Z.tagesplan().ruhe, 'ruhetag');
  const r = Z.abschnittAbschliessen(9, Array(D.A[9].ayat).fill('ok'), 'frei');
  assert.ok(!r.ereignisse.some(x => x.typ === 'wird'));
  assert.equal(Z.P.kette.n, 1); assert.equal(Z.P.tage[Z.heute()].voll, false);
  naechsterTag(); wirdErfuellen(); assert.equal(Z.P.kette.n, 2, 'die Kette läuft über den Ruhetag weiter');
  // leerer Bestand: kein Plan, kein Wird, keine Ḫatma (Audit N9)
  frisch({ datum: '2026-01-05', pensum: 3 });
  Z.P.einst.bereich = []; Z.speichern();
  assert.equal(Z.tagesplan().plan.length, 0);
  const b = Z.abschnittAbschliessen(9, Array(D.A[9].ayat).fill('ok'), 'bonus');
  assert.ok(!b.ereignisse.some(x => x.typ === 'wird' || x.typ === 'khatma'));
  assert.equal(Z.P.kette.n, 0); assert.equal(Z.P.zyklus.khatma, 0);
});

test('Ruhetage wirken ab dem Tag der Änderung, nicht rückwirkend auf Kette und Rückblick (Audit Abl. 22)', () => {
  frisch({ datum: '2026-01-05', pensum: 3 });           // Montag
  wirdErfuellen(); naechsterTag(); wirdErfuellen();     // Montag, Dienstag erfüllt
  naechsterTag(3);                                      // Mittwoch, Donnerstag verpasst, heute Freitag
  assert.equal(Z.ketteAktiv(), false);
  Z.P.einst.pensum[2] = 0; Z.P.einst.pensum[3] = 0; Z.speichern();
  assert.equal(Z.ketteAktiv(), false, 'die gerissene Kette lebt nicht wieder auf');
  assert.deepEqual(Z.rueckblick('woche', 0).tage.slice(2, 4).map(t => t.stand), ['aus', 'aus']);
  assert.equal(Z.ruhetag('2026-01-07'), false); assert.equal(Z.ruhetag('2026-01-14'), true);
  wirdErfuellen(); assert.equal(Z.P.kette.n, 1);
  // der Nachbau aus dem Protokoll kommt zum selben Ergebnis
  assert.deepEqual(Z.P.pensumVor.map(x => x.bis), ['2026-01-09']);
});

test('Fehlerarten: je markierte Āya zählt die gewählte Art einmal, ältere Einträge bleiben, wie sie waren (Audit Abl. 20)', () => {
  frisch({ datum: '2026-01-05', pensum: 1 });
  const sockel = JSON.parse(JSON.stringify({ ...Z.P, log: [] }));
  Z.fehlerstellenMerken(['3.0', '4.1', '5.2', '5.3'], 'haraka');
  assert.equal(Z.P.statistik.arten.haraka, 3);
  const alt = { i: 'alt-000001', z: 1, y: 'fm', d: '2026-01-05', w: ['3.0', '4.1', '5.2'], a: 'haraka' };
  assert.equal(Z.nachbau(sockel, [alt]).statistik.arten.haraka, 1);
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
