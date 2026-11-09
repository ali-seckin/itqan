// Itqān · Logiktests: Tagesplan, Kette, Qaḍāʾ, Punkte, Fehlerwiederholung, Ränge, Ornamente, Gliederungswechsel, Sicherung, Schnappschüsse
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Z, D, frisch, naechsterTag, wirdErfuellen, gliederungSetzen } from './umgebung.mjs';

test('Tagesplan: drei Abschnitte ab al-Fātiḥah', () => {
  frisch({ pensum: 3 });
  const t = Z.tagesplan();
  assert.deepEqual(t.plan, [0, 1, 2]);
  assert.ok(t.plan.every(id => t.art[id] === 'zyklus'));
});

test('Tagesplan: ab an-Nās beginnt mit der letzten Sūra', () => {
  frisch({ pensum: 2, reihenfolge: 'rueckwaerts' });
  const t = Z.tagesplan();
  assert.equal(D.A[t.plan[0]].bis[0], 114);
});

test('Kette: zwei Tage in Folge ergeben 2', () => {
  frisch();
  wirdErfuellen(); assert.equal(Z.P.kette.n, 1);
  naechsterTag(); wirdErfuellen(); assert.equal(Z.P.kette.n, 2);
});

test('Qaḍāʾ: ein verpasster Tag wird nachgeholt, die Kette bleibt und wächst um 2', () => {
  frisch({ pensum: 3 });
  wirdErfuellen(); naechsterTag(); wirdErfuellen();          // Kette 2
  naechsterTag(2);                                          // einen Tag ausgelassen
  const t = Z.tagesplan();
  assert.equal(t.qadaa, 3);
  assert.equal(t.plan.length, 6);
  wirdErfuellen();
  assert.equal(Z.P.kette.n, 4);
});

test('Kette: zwei verpasste Tage beginnen neu', () => {
  frisch();
  wirdErfuellen(); naechsterTag(); wirdErfuellen();
  naechsterTag(3);
  assert.equal(Z.tagesplan().qadaa, 0);
  wirdErfuellen();
  assert.equal(Z.P.kette.n, 1);
});

test('Punkte: 10 je Āya, 25 % fehlerfrei, 5 mit Hilfe', () => {
  frisch({ pensum: 1 });
  const id = Z.tagesplan().plan[0], n = D.A[id].ayat;
  const r = Z.abschnittAbschliessen(id, Array(n).fill('ok'));
  assert.equal(r.punkte, 10 * n + Math.round(10 * n * 0.25));
  frisch({ pensum: 1 });
  const r2 = Z.abschnittAbschliessen(id, ['hilfe', ...Array(n - 1).fill('ok')]);
  assert.equal(r2.punkte, 10 * (n - 1) + 5);
});

test('Fehler: Stufe sinkt, Abschnitt kommt am nächsten Tag als Wiederholung', () => {
  frisch({ pensum: 1 });
  const id = Z.tagesplan().plan[0], n = D.A[id].ayat;
  Z.P.karten[id] = { ...Z.karte(id), st: 3 };
  Z.abschnittAbschliessen(id, ['fehler', ...Array(n - 1).fill('ok')]);
  assert.equal(Z.karte(id).st, 2);
  naechsterTag();
  const t = Z.tagesplan();
  assert.ok(t.plan.includes(id));
  assert.equal(t.art[id], 'fehler');
});

test('Stufen: viermal fehlerfrei ergibt mutqan', () => {
  frisch({ pensum: 1 });
  const id = 0, n = D.A[id].ayat;
  for (let i = 0; i < 4; i++) { Z.abschnittAbschliessen(id, Array(n).fill('ok'), 'frei'); naechsterTag(); }
  assert.equal(Z.karte(id).st, 4);
});

test('Ränge: neues Profil ist Mubtadiʾ, 1.000 Punkte ergeben Murīd', () => {
  frisch();
  assert.equal(Z.rangJetzt(), 0);
  Z.P.summe.punkte = 1000;
  assert.equal(Z.rangJetzt(), 1);
});

test('Ornamente: auch Sūren in einer Sammelkarte bekommen ihr Ornament', () => {
  frisch();
  const bundle = D.A.find(e => e.von[0] !== e.bis[0]);
  assert.ok(bundle, 'es gibt Sammelkarten');
  Z.P.karten[bundle.id] = { ...Z.karte(bundle.id), st: 2, n: 2 };
  Z.ornamenteNachtragen();
  for (let s = bundle.von[0]; s <= bundle.bis[0]; s++) {
    if (Z.sureAbschnitte(s).every(e => Z.karte(e.id).st >= 2)) assert.ok(Z.P.meilen.includes(`sure-gefestigt-${s}`), `Ornament für Sūra ${s}`);
  }
});

test('Ornamente: Sūra außerhalb des Bereichs bekommt keines', () => {
  frisch();
  const ids = Z.sureAbschnitte(2).map(e => e.id);
  ids.forEach(id => { Z.P.karten[id] = { ...Z.karte(id), st: 4, n: 4 }; });
  Z.P.einst.bereich = ids.slice(1);
  Z.ornamenteNachtragen();
  assert.ok(!Z.P.meilen.includes('sure-gefestigt-2'));
  Z.P.einst.bereich = null; Z.ornamenteNachtragen();
  assert.ok(Z.P.meilen.includes('sure-mutqan-2'));
});

test('Gliederungswechsel: Anfänger-Abschnitte erben die Stufe', async () => {
  frisch({ modus: 'fort' });
  const alt = D.A.find(e => e.von[0] === 2 && e.nr === 3);
  Z.P.karten[alt.id] = { ...Z.karte(alt.id), st: 3, n: 5 };
  Z.speichern();
  gliederungSetzen('anf');
  assert.equal(await Z.gliederungAbgleichen(), true);
  const neu = D.A.filter(e => e.v[0] >= alt.v[0] && e.v[1] <= alt.v[1]);
  assert.ok(neu.length >= 1);
  for (const e of neu) assert.equal(Z.karte(e.id).st, 3);
  assert.equal(Z.P.gliederung, 'anf-1');
});

test('Sicherung: Datei hin und zurück ergibt dasselbe Profil, Veränderung wird erkannt', async () => {
  frisch(); wirdErfuellen();
  const text = await Z.exportDatei();
  const r = await Z.importDatei(text);
  assert.equal(r.echt, true);
  assert.deepEqual(r.profil, JSON.parse(JSON.stringify(Z.P)));
  const o = JSON.parse(text); o.profil.summe.punkte += 1000;
  assert.equal((await Z.importDatei(JSON.stringify(o))).echt, false);
  await assert.rejects(() => Z.importDatei('{"x":1}'));
});

test('Schnappschüsse: höchstens zwei tägliche und drei andere, Zurückholen stellt den Stand her', () => {
  frisch();
  for (let i = 0; i < 4; i++) { Z.tagesSchnappschuss(); naechsterTag(); }
  for (const g of ['vor A', 'vor B', 'vor C', 'vor D']) Z.schnappschuss(g);
  const l = Z.schnappschuesse();
  assert.equal(l.filter(x => x.grund === 'täglich').length, 2);
  assert.equal(l.filter(x => x.grund !== 'täglich').length, 3);
  const punkte = Z.P.summe.punkte;
  Z.schnappschuss('Probe');
  const probe = Z.schnappschuesse().find(x => x.grund === 'Probe');
  Z.P.summe.punkte = 99999; Z.speichern();
  Z.schnappschussZurueck(probe.zeit);
  assert.equal(Z.P.summe.punkte, punkte);
});

test('Schnappschuss täglich nur einmal am Tag', () => {
  frisch();
  assert.equal(Z.tagesSchnappschuss(), true);
  assert.equal(Z.tagesSchnappschuss(), false);
});

test('Profilüberblick zeigt den letzten Übungstag', () => {
  frisch({ datum: '2026-03-01' }); wirdErfuellen();
  const u = Z.profilUeberblick(Z.P);
  assert.equal(u.letzterTag, '2026-03-01');
  assert.ok(u.abschnitte >= 3);
});
