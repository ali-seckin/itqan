// Itqān · Protokoll: Nachbau aus Einträgen, Zusammenführen zweier Geräte, Umzug in eine neuere Generation, Speicher
// Beschreibung des Modells: konzept/datenmodell.md
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Z, D, frisch, gliederungSetzen, tagSetzenZurueck } from './umgebung.mjs';

const rund = x => JSON.parse(JSON.stringify(x));
const stand = () => rund({ ...Z.P, log: [] });
function zufall(start) { let h = start >>> 0; return () => { h = Math.imul(h ^ h >>> 15, 2246822507) + 0x9e3779b9 >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }; }
function uhrAuf(datum, stunde = 12, minute = 0) { const [y, m, d] = datum.split('-').map(Number); Z.uhrSetzen(() => new Date(y, m - 1, d, stunde, minute)); }
const ARTEN = Z.FEHLERARTEN.map(x => x[0]);
after(() => { Z.logGrenze(0); Z.speicherSetzen(null); gliederungSetzen('fort'); tagSetzenZurueck(); });

// Ein Tag auf einem Gerät: alles, was die Oberfläche am Lernstand auslösen kann, über die öffentlichen Funktionen
function tagSpielen(z, datum, stunde) {
  uhrAuf(datum, stunde);
  if (z() < 0.04 && !Z.inPause()) Z.pauseBeginnen(1 + Math.floor(z() * 4));
  if (Z.inPause() && z() < 0.35) Z.pauseBeenden();
  if (z() < 0.08) { Z.P.einst.schwaechen = ['khatma', 'ausgewogen', 'schwaechen'][Math.floor(z() * 3)]; Z.speichern(); }
  if (z() < 0.04) { Z.P.einst.pensum = Z.P.einst.pensum.map((x, i) => i === 4 ? 0 : 2 + Math.floor(z() * 3)); Z.speichern(); }
  if (z() < 0.03) { Z.P.name = 'Test ' + Math.floor(z() * 100); Z.P.einst.textGroesse = [100, 112, 125][Math.floor(z() * 3)]; Z.speichern(); }
  let t = Z.tagesplan();
  if (t.ruhe) { if (z() < 0.3) t = Z.trotzdemUeben(); else if (z() < 0.8) return; }
  if (z() < 0.07) return;                                   // Tag ausgelassen
  if (z() < 0.15) t = Z.pensumHeuteAendern(1);
  if (z() < 0.1) t = Z.pensumHeuteAendern(-1);
  const offen = t.plan.filter(x => !t.fertig.includes(x));
  for (const id of z() < 0.1 ? offen.slice(0, 1) : offen) abschliessen(z, id);
  if (z() < 0.12) { const b = Z.bonusVorschlag(); if (b != null) abschliessen(z, b, 'bonus'); }
  if (z() < 0.12) abschliessen(z, Math.floor(z() * D.A.length), 'frei');
  const keys = () => Object.keys(Z.P.fstellen);
  if (z() < 0.4 && keys().length) Z.fehlerstelleGeuebt(+keys()[Math.floor(z() * keys().length)].split('.')[0], z() < 0.8 ? 'ok' : 'fehler');
  if (z() < 0.05 && keys().length) Z.fehlerstelleLoeschen(keys()[Math.floor(z() * keys().length)]);
  if (z() < 0.2) Z.unterscheidenMerken(`${10 + Math.floor(z() * 3)}-${400 + Math.floor(z() * 3)}`, z() < 0.6);
  Z.ornamenteNachtragen();
}
function abschliessen(z, id, quelle) {
  const e = D.A[id];
  const erg = Array.from({ length: e.ayat }, () => { const x = z(); return x < 0.05 ? 'fehler' : x < 0.1 ? 'hilfe' : 'ok'; });
  erg.forEach((x, i) => {
    if (x !== 'fehler') return;
    const vi = e.v[0] + i, wort = [`${vi}.${Math.floor(z() * 3)}`];
    if (z() < 0.25) {                                       // „Vorige Āya neu bewerten“: merken, zurücknehmen, neu merken
      const vorher = Z.fehlerstellenStand();
      Z.fehlerstellenMerken([`${vi}.7`, `${vi}.8`], 'haraka');
      Z.fehlerstellenSetzen(vorher);
    }
    const art = ARTEN[Math.floor(z() * ARTEN.length)];
    Z.fehlerstellenMerken(wort, art, art === 'verwechslung' && z() < 0.7 ? Math.floor(z() * 6236) : undefined);
  });
  return Z.abschnittAbschliessen(id, erg, quelle, z() < 0.7 ? 30 + Math.floor(z() * 200) : 0);
}
function tageSpielen(z, von, tage, stunde) {
  for (let i = 0; i < tage; i++) tagSpielen(z, Z.plusTage(von, i), stunde);
}
const zaehle = (log, y, f = () => 1) => log.filter(e => e.y === y).reduce((s, e) => s + f(e), 0);

for (const [name, modus, tage, saat] of [['fort, 150 Tage', 'fort', 150, 11], ['anf, 150 Tage', 'anf', 150, 23], ['fort, 460 Tage (alte Tage werden verdichtet)', 'fort', 460, 5]]) {
  test(`Nachbau: Sockel und Einträge ergeben genau den gespeicherten Stand (${name})`, () => {
    Z.geraetSetzen('aaa'); Z.logGrenze(1e9);
    frisch({ pensum: 3, modus });
    const sockel = stand();
    tageSpielen(zufall(saat), '2026-01-05', tage, 12);
    const arten = new Set(Z.P.log.map(e => e.y));
    for (const y of ['pl', 'pa', 'ab', 'fm', 'fl', 'fg', 'mu', 'pb', 'pe', 'rk', 'ei']) assert.ok(arten.has(y), `Der Lauf enthält keinen Eintrag der Art ${y}`);
    assert.ok(Z.P.summe.abschnitte > tage, 'Der Lauf hat zu wenig geübt');
    assert.deepEqual(rund(Z.nachbau(sockel, Z.P.log)), stand());
    // Die Reihenfolge der übergebenen Einträge spielt keine Rolle
    assert.deepEqual(rund(Z.nachbau(sockel, [...Z.P.log].reverse())), stand());
    Z.logGrenze(0);
  });
}

test('Nachbau: ein Sockel mitten im Verlauf und die Einträge danach ergeben denselben Stand', () => {
  Z.geraetSetzen('aaa'); Z.logGrenze(1e9);
  frisch({ pensum: 4 });
  const z = zufall(77);
  tageSpielen(z, '2026-01-05', 40, 12);
  const sockel = stand(), n0 = Z.P.log.length;
  tageSpielen(z, '2026-02-14', 40, 12);
  assert.deepEqual(rund(Z.nachbau(sockel, Z.P.log.slice(n0))), stand());
  Z.logGrenze(0);
});

test('Protokoll: Kennungen sind eindeutig und laufen je Gerät in der Reihenfolge der Entstehung', () => {
  Z.geraetSetzen('aaa'); Z.logGrenze(1e9);
  frisch({ pensum: 3 });
  tageSpielen(zufall(3), '2026-01-05', 30, 12);
  const ids = Z.P.log.map(e => e.i);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), ids);
  assert.ok(Z.P.log.every((e, i, l) => !i || l[i - 1].z <= e.z));
  // Uhr zurückgestellt: die Zeit der Einträge läuft trotzdem nicht rückwärts
  const letzte = Z.P.log.at(-1).z;
  uhrAuf('2025-12-01'); Z.unterscheidenMerken('1-2', true);
  assert.ok(Z.P.log.at(-1).z >= letzte);
  Z.logGrenze(0);
});

test('Protokoll: ohne Server bleibt die Liste auf dem Gerät begrenzt, der Stand bleibt vollständig', () => {
  Z.geraetSetzen('aaa'); Z.logGrenze(1e9);
  frisch({ pensum: 3 });
  tageSpielen(zufall(9), '2026-01-05', 120, 12);
  const voll = stand(), lang = Z.P.log.length;
  Z.geraetSetzen('aaa'); Z.logGrenze(0);
  frisch({ pensum: 3 });
  tageSpielen(zufall(9), '2026-01-05', 120, 12);
  assert.ok(lang > 300 && Z.P.log.length === 300);
  assert.deepEqual(stand(), voll);
  assert.equal(JSON.parse(localStorage.getItem('itqan-profil-v1')).log.length, 300);
});

// Zwei Geräte beginnen mit demselben Sockel und üben an denselben Tagen, ohne voneinander zu wissen
function zweiGeraete(saat, tage = 14) {
  Z.geraetSetzen('aaa'); Z.logGrenze(1e9);
  frisch({ pensum: 3 });
  tageSpielen(zufall(saat), '2026-01-05', 30, 12);                     // gemeinsame Vorgeschichte
  const sockel = stand(), n0 = Z.P.log.length, beginn = '2026-02-04';
  tageSpielen(zufall(saat + 1), beginn, tage, 8);                      // Gerät A am Morgen
  const A = { log: rund(Z.P.log.slice(n0)), p: stand() };
  Z.geraetSetzen('bbb'); Z.standUebernehmen(sockel);
  tageSpielen(zufall(saat + 2), beginn, tage, 20);                     // Gerät B am Abend
  const B = { log: rund(Z.P.log), p: stand() };
  Z.logGrenze(0);
  return { sockel, A, B, beginn, tage };
}

for (const saat of [101, 202, 303, 404]) {
  test(`Zusammenführen: zwei Gerätestände, nichts geht verloren (Lauf ${saat})`, () => {
    const { sockel, A, B, beginn, tage } = zweiGeraete(saat);
    assert.ok(A.log.length > 40 && B.log.length > 40);
    assert.deepEqual(rund(Z.nachbau(sockel, A.log)), A.p);
    assert.deepEqual(rund(Z.nachbau(sockel, B.log)), B.p);
    const m = Z.zusammenfuehren(sockel, A.log, B.log), p = rund(m.profil), beide = [...A.log, ...B.log];
    // Reihenfolge und Wiederholung der Listen ändern nichts
    assert.deepEqual(rund(Z.zusammenfuehren(sockel, B.log, A.log).profil), p);
    assert.deepEqual(rund(Z.zusammenfuehren(sockel, A.log, B.log, A.log, m.log).profil), p);
    assert.equal(m.log.length, beide.length);
    // Jeder Abschluss beider Geräte zählt: Abschnitte, Āyāt, Punkte, Ḥasanāt
    const zahl = c => [...c].filter(x => 'ohf'.includes(x)).length;
    assert.equal(p.summe.abschnitte, sockel.summe.abschnitte + zaehle(beide, 'ab'));
    assert.equal(p.summe.punkte, sockel.summe.punkte + zaehle(beide, 'ab', e => e.p));
    assert.equal(p.summe.hasanat, sockel.summe.hasanat + zaehle(beide, 'ab', e => D.A[e.id].buchstaben * 10));
    assert.equal(p.summe.r + p.summe.f + p.summe.h, sockel.summe.r + sockel.summe.f + sockel.summe.h + zaehle(beide, 'ab', e => zahl(e.e)));
    assert.equal(p.summe.f, sockel.summe.f + zaehle(beide, 'ab', e => [...e.e].filter(x => x === 'f').length));
    for (const [id, k] of Object.entries(p.karten)) {
      const n = (sockel.karten[id]?.n || 0) + beide.filter(e => e.y === 'ab' && e.id === +id).length;
      assert.equal(k.n, n, `Durchgänge von Abschnitt ${id}`);
    }
    // Je Tag: was auf einem Gerät geübt wurde, steht im gemeinsamen Tag; die Zahlen des Tages addieren sich
    const mehr = new Set(beide.filter(e => (e.y === 'pa' && e.plus != null) || (e.y === 'pl' && !e.t.ruhe)).map(e => e.i.slice(0, 3) + e.d));
    for (let i = 0; i < tage; i++) {
      const d = Z.plusTage(beginn, i), a = A.p.tage[d], b = B.p.tage[d], t = p.tage[d];
      for (const x of [a, b]) for (const id of x?.fertig || []) assert.ok(t.fertig.includes(id), `${d}: Abschnitt ${id} fehlt`);
      const pkt = beide.filter(e => e.y === 'ab' && e.d === d).reduce((s, e) => s + e.p, 0);
      if (pkt) assert.equal(t.punkte, pkt, `${d}: Punkte des Tages`);
      // Wird erfüllt auf einem Gerät gilt gemeinsam. Ausnahme wie auf einem einzelnen Gerät: das andere Gerät
      // hat an dem Tag ein eigenes oder erweitertes Pensum begonnen und nicht beendet.
      if (a?.voll && !mehr.has('bbb' + d)) assert.ok(t.voll, `${d}: Wird von Gerät A`);
      if (b?.voll && !mehr.has('aaa' + d)) assert.ok(t.voll, `${d}: Wird von Gerät B`);
    }
    assert.ok(p.kette.zuletzt >= (A.p.kette.zuletzt || '') && p.kette.zuletzt >= (B.p.kette.zuletzt || ''));
    // Fehlerarten und Verwechslungen: jede gemerkte, nicht zurückgenommene Fehlerstelle zählt
    const weg = new Set(beide.filter(e => e.y === 'rk').flatMap(e => e.ids)), fm = beide.filter(e => e.y === 'fm' && !weg.has(e.i));
    const summe = o => Object.values(o || {}).reduce((s, x) => s + x, 0);
    assert.equal(summe(p.statistik.arten), summe(sockel.statistik.arten) + fm.filter(e => e.a).length);
    assert.equal(summe(p.statistik.vw), summe(sockel.statistik.vw) + fm.filter(e => e.m != null).length);
    const mu = o => Object.values(o || {}).reduce((s, x) => s + x.n, 0);
    assert.equal(mu(p.mutash), mu(sockel.mutash) + zaehle(beide, 'mu'));
    // Einstellungen: der spätere Eintrag gilt
    const ei = beide.filter(e => e.y === 'ei').sort((x, y) => x.z - y.z || (x.i < y.i ? -1 : 1)), letzte = {};
    for (const e of ei) letzte[e.k] = e;
    for (const [k, e] of Object.entries(letzte)) assert.deepEqual(k === 'name' ? p.name : p.einst[k.slice(6)], e.w, `Einstellung ${k}`);
    // Ein Gerät kann den gemeinsamen Stand übernehmen und weiterüben
    Z.geraetSetzen('aaa'); Z.logGrenze(1e9);
    Z.standUebernehmen(m.profil, m.log);
    tageSpielen(zufall(saat + 9), Z.plusTage(beginn, tage), 5, 12);
    assert.deepEqual(rund(Z.nachbau(sockel, Z.P.log)), stand());
    Z.logGrenze(0);
  });
}

test('Zusammenführen: derselbe Abschnitt, dieselbe Fehlerstelle und dieselbe Einstellung auf beiden Geräten', () => {
  Z.geraetSetzen('aaa'); Z.logGrenze(1e9);
  frisch({ pensum: 2 });
  const sockel = stand(), d = '2026-01-05', ok = id => Array(D.A[id].ayat).fill('ok');
  uhrAuf(d, 8);
  const planA = [...Z.tagesplan().plan];
  Z.abschnittAbschliessen(planA[0], ok(planA[0]));
  Z.fehlerstellenMerken(['3.1'], 'verwechslung', 900);
  Z.P.einst.schwaechen = 'khatma'; Z.P.einst.textGroesse = 125; Z.speichern();
  Z.unterscheidenMerken('3-900', true);
  const A = { log: rund(Z.P.log), p: stand() };
  Z.geraetSetzen('bbb'); Z.standUebernehmen(sockel);
  uhrAuf(d, 20);
  const planB = [...Z.tagesplan().plan];
  assert.deepEqual(planB, planA);
  for (const id of planB) Z.abschnittAbschliessen(id, ok(id));
  Z.fehlerstellenMerken(['3.1'], 'verwechslung', 900);
  Z.fehlerstellenMerken(['3.1'], 'haraka');
  Z.P.einst.schwaechen = 'schwaechen'; Z.speichern();
  Z.unterscheidenMerken('3-900', false);
  const B = { log: rund(Z.P.log), p: stand() };
  assert.equal(A.p.tage[d].voll, false);
  assert.equal(B.p.tage[d].voll, true);
  const p = rund(Z.zusammenfuehren(sockel, A.log, B.log).profil);
  assert.equal(p.summe.abschnitte, 3);
  assert.equal(p.karten[planA[0]].n, 2);                       // auf beiden Geräten geübt: zwei Durchgänge
  assert.equal(p.karten[planA[1]].n, 1);
  assert.deepEqual(p.tage[d].fertig, planA);                   // im Tag steht jeder Abschnitt einmal
  assert.equal(p.tage[d].voll, true);
  assert.deepEqual(p.kette, { n: 1, beste: 1, zuletzt: d });   // die Kette zählt den Tag einmal
  assert.equal(p.tage[d].punkte, A.p.tage[d].punkte + B.p.tage[d].punkte);
  assert.equal(p.fstellen['3.1'].n, 3);
  assert.deepEqual(p.fstellen['3.1'].t, { verwechslung: 2, haraka: 1 });
  assert.deepEqual(p.fstellen['3.1'].m, { 900: 2 });
  assert.equal(p.statistik.vw['3-900'], 2);
  assert.deepEqual(p.statistik.arten, { verwechslung: 2, haraka: 1 });
  assert.equal(p.einst.schwaechen, 'schwaechen');              // gleiche Einstellung: die spätere gilt
  assert.equal(p.einst.textGroesse, 125);                      // andere Einstellung: bleibt erhalten
  assert.deepEqual({ n: p.mutash['3-900'].n, ok: p.mutash['3-900'].ok, letzt: p.mutash['3-900'].letzt }, { n: 2, ok: 1, letzt: 0 });
  Z.logGrenze(0);
});

test('Rücknahme: „Vorige Āya neu bewerten“ nimmt nur die eigenen Fehlerstellen dieses Geräts zurück', () => {
  Z.geraetSetzen('aaa'); Z.logGrenze(1e9);
  frisch({ pensum: 2 });
  const sockel = stand();
  uhrAuf('2026-01-05', 8);
  Z.fehlerstellenMerken(['5.0'], 'haenger');
  const vorher = Z.fehlerstellenStand();
  Z.fehlerstellenMerken(['5.2', '5.3'], 'ausgelassen');
  Z.fehlerstellenSetzen(vorher);
  Z.fehlerstellenMerken(['5.4'], 'haraka');
  assert.deepEqual(Object.keys(Z.P.fstellen).sort(), ['5.0', '5.4']);
  const A = rund(Z.P.log);
  Z.geraetSetzen('bbb'); Z.standUebernehmen(sockel);
  uhrAuf('2026-01-05', 8);
  Z.fehlerstellenMerken(['5.2'], 'ausgelassen');
  const p = rund(Z.zusammenfuehren(sockel, A, Z.P.log).profil);
  assert.deepEqual(Object.keys(p.fstellen).sort(), ['5.0', '5.2', '5.4']);
  assert.equal(p.fstellen['5.2'].n, 1);
  assert.deepEqual(p.statistik.arten, { haenger: 1, haraka: 1, ausgelassen: 1 });
  Z.logGrenze(0);
});

test('Generationen: eine geladene Sicherung gewinnt, spätere Einträge des alten Geräts ziehen um', async () => {
  Z.geraetSetzen('aaa'); Z.logGrenze(1e9);
  frisch({ pensum: 3 });
  const z = zufall(31);
  tageSpielen(z, '2026-01-05', 20, 12);
  uhrAuf('2026-01-25', 9);
  const datei = await Z.exportDatei(), alt = rund(Z.P.sockel), nVor = Z.P.log.length;
  // Gerät A übt nach dem Sichern weiter
  uhrAuf('2026-01-25', 10);
  const ok = id => Array(D.A[id].ayat).fill('ok');
  const plan = [...Z.tagesplan().plan];
  Z.abschnittAbschliessen(plan[0], ok(plan[0]));
  Z.fehlerstellenMerken(['20.1'], 'haraka');
  const logA = rund(Z.P.log), spaeter = logA.slice(nVor);
  // Gerät B lädt die Sicherung zwei Stunden später
  Z.geraetSetzen('bbb');
  uhrAuf('2026-01-25', 12);
  const r = await Z.importDatei(datei);
  Z.ersetzeProfil(r.profil, r.exportiert);
  assert.equal(Z.P.sockel.n, alt.n + 1);
  assert.equal(Z.P.sockel.g, 'bbb');
  assert.equal(Z.P.sockel.z, Date.parse(r.exportiert));         // Sockelzeit ist der Zeitpunkt des Sicherns
  assert.ok(Z.sockelNeuer(Z.P.sockel, alt) && !Z.sockelNeuer(alt, Z.P.sockel));
  assert.deepEqual(Z.P.log, []);
  const sockelB = stand();
  const u = Z.umziehen(logA, sockelB);
  assert.equal(u.verworfen, logA.length - spaeter.filter(e => e.y !== 'pl' && e.y !== 'pa').length);
  assert.deepEqual(u.uebernommen.map(e => e.y).sort(), spaeter.filter(e => e.y !== 'pl' && e.y !== 'pa').map(e => e.y).sort());
  assert.equal(u.offen.length, 0);
  const p = rund(Z.zusammenfuehren(sockelB, Z.P.log, u.uebernommen).profil);
  assert.equal(p.summe.abschnitte, sockelB.summe.abschnitte + 1);
  assert.ok(p.tage['2026-01-25'].fertig.includes(plan[0]));
  assert.equal(p.fstellen['20.1'].n, (sockelB.fstellen['20.1']?.n || 0) + 1);
  // Nach einem Wechsel der Gliederung: Abschlüsse finden ihren Abschnitt über den Āya-Bereich, sonst bleiben sie offen
  const abs = logA.filter(e => e.y === 'ab').map(e => ({ ...e, z: sockelB.sockel.z + 1 }));
  gliederungSetzen('anf');
  const g = Z.umziehen(abs, sockelB);
  assert.equal(g.uebernommen.length + g.offen.length, abs.length);
  assert.ok(g.uebernommen.length > 0 && g.offen.length > 0);
  for (const e of g.uebernommen) assert.deepEqual(D.A[e.id].v, e.v);
  gliederungSetzen('fort');
  Z.logGrenze(0);
});

test('Generationen: Schnappschuss zurückholen und Gliederung wechseln beginnen einen neuen Sockel', async () => {
  Z.geraetSetzen('aaa');
  frisch({ pensum: 3 });
  tageSpielen(zufall(4), '2026-01-05', 5, 12);
  assert.ok(Z.P.log.length > 0);
  const n = Z.P.sockel.n;
  Z.schnappschuss('Test');
  const s = Z.schnappschuesse()[0];
  assert.deepEqual(JSON.parse(s.daten).log, []);
  tageSpielen(zufall(5), '2026-01-10', 2, 12);
  Z.schnappschussZurueck(s.zeit);
  assert.equal(Z.P.sockel.n, n + 1);
  assert.deepEqual(Z.P.log, []);
  const alt = D.A.map(x => x.v);
  gliederungSetzen('anf');
  Z.gliederungUmstellen(alt);
  assert.equal(Z.P.sockel.n, n + 2);
  assert.deepEqual(Z.P.log, []);
  gliederungSetzen('fort');
});

test('Lehreransicht: ein fremdes Profil wird ausgewertet, ohne dass etwas protokolliert oder gespeichert wird', () => {
  Z.geraetSetzen('aaa');
  frisch({ pensum: 3 });
  tageSpielen(zufall(6), '2026-01-05', 3, 12);
  const eigenes = stand(), n = Z.P.log.length, gespeichert = localStorage.getItem('itqan-profil-v1');
  const fremd = rund(eigenes); fremd.name = 'Schüler';
  uhrAuf('2026-01-20');
  const plan = Z.mitProfil(fremd, () => { const t = Z.tagesplan(); Z.abschnittAbschliessen(t.plan[0], Array(D.A[t.plan[0]].ayat).fill('ok')); return t.plan; });
  assert.ok(plan.length > 0);
  assert.deepEqual(stand(), eigenes);
  assert.equal(Z.P.log.length, n);
  assert.equal(localStorage.getItem('itqan-profil-v1'), gespeichert);
});

test('Speicher: die Ablage ist austauschbar (Vorbereitung der App-Hülle)', () => {
  const ablage = new Map(), aufrufe = [];
  Z.speicherSetzen({
    lesen: k => ablage.has(k) ? ablage.get(k) : null,
    schreiben: (k, v) => { aufrufe.push(k); ablage.set(k, v); },
    entfernen: k => ablage.delete(k)
  });
  localStorage.clear(); tagSetzenZurueck();
  Z.neuesProfil({ name: 'Hülle', pensum: 2 });
  const t = Z.tagesplan();
  Z.abschnittAbschliessen(t.plan[0], Array(D.A[t.plan[0]].ayat).fill('ok'));
  Z.schnappschuss('Test');
  assert.equal(localStorage.getItem('itqan-profil-v1'), null);           // nichts geht am Speicher vorbei
  assert.equal(localStorage.getItem('itqan-geraet'), null);
  assert.deepEqual([...ablage.keys()].sort(), ['itqan-geraet', 'itqan-profil-v1', 'itqan-schnappschuesse']);
  const vorher = stand(), kennung = Z.geraetKennung();
  assert.match(kennung, /^[0-9a-z]{6}$/);
  Z.speicherSetzen({ lesen: k => ablage.has(k) ? ablage.get(k) : null, schreiben: (k, v) => ablage.set(k, v), entfernen: k => ablage.delete(k) });
  Z.laden();
  assert.equal(Z.geraetKennung(), kennung);                               // die Gerätekennung bleibt über den Neustart
  assert.equal(Z.P.summe.abschnitte, 1);
  assert.deepEqual(rund({ ...Z.P, log: [], einst: vorher.einst }), { ...vorher });
  const n = Z.P.log.length;
  Z.unterscheidenMerken('1-2', true);
  assert.equal(Z.P.log.length, n + 1);
  assert.ok(Z.P.log.at(-1).i > Z.P.log.at(-2).i);                         // der Zähler läuft nach dem Neustart weiter
  Z.speicherSetzen(null);
});
