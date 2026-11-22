// Itqān · Regressionstests zu den Nachbesserungen nach dem Nach-Audit von 2.00 (konzept/audit_1.99/nachaudit):
// Logik NB1 (Zukunftstag, Uhr in der Vergangenheit, Zukunftseintrag vom Konto), NB2 (Bereich von einem Gerät mit 1.99),
// NB3 und NB4 (zwei Reiter), Sicherheit N1 (Einträge vom Konto werden geprüft), Plattform N2 und N7, Oberfläche N-1, N-2, N-5, N-6, N-7.
// Service Worker (Plattform N3 bis N6): tests/sw.test.mjs. Abgleich (Sicherheit N1, N3): tests/abgleich_schutz.test.mjs. Forschung (N2): tests/forschung.test.mjs.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Z, D, frisch, naechsterTag, tagSetzenZurueck, wirdErfuellen, lies } from './umgebung.mjs';

after(() => { tagSetzenZurueck(); Z.fremdeAenderungHakenSetzen(null); });
const ok = id => Array.from({ length: D.A[id].ayat }, () => 'ok');
const kopie = x => JSON.parse(JSON.stringify(x));
const ueben = n => { for (let i = 0; i < n; i++) { wirdErfuellen(); naechsterTag(); } };
const echteTage = () => Object.keys(Z.P.tage).filter(d => Z.P.tage[d].fertig.length).sort();
function planLaeuft(tage, echte, wo) {
  for (let i = 0; i < tage; i++) {
    const t = Z.tagesplan();
    assert.ok(t && Array.isArray(t.plan) && t.plan.length > 0, `${wo}, ${Z.heute()}: tagesplan() liefert einen Plan`);
    wirdErfuellen();
    for (const d of echte) assert.ok(Z.P.tage[d]?.fertig.length, `${wo}, ${Z.heute()}: der echte Tag ${d} fehlt`);
    naechsterTag();
  }
}

// ---------- Logik NB1 ----------
test('NB1 a: ein einziger Übungstag in der Zukunft, danach Uhr zurück: der Plan läuft, nichts wird gelöscht (auch mit nur einem Tag Bestand)', () => {
  for (const vorlauf of [1, 20]) {
    frisch({ pensum: 3 }); ueben(vorlauf);
    const echte = echteTage(); assert.equal(echte.length, vorlauf);
    Z.uhrSetzen(() => new Date(2028, 5, 1, 12)); wirdErfuellen();     // mehr als 400 Tage voraus, dort wird geübt
    tagSetzenZurueck();
    planLaeuft(8, echte, 'Vorlauf ' + vorlauf);
    assert.ok(Z.P.tage['2028-06-01'], 'der Zukunftstag bleibt stehen, er ist kein Bezug zum Löschen');
  }
});

test('NB1 b: ein fremder Abschluss mit Zukunftsdatum kommt über das Konto: die anderen Geräte planen weiter und behalten ihre Tage', () => {
  frisch({ pensum: 3 }); ueben(11);
  const echte = echteTage(), id = Z.reihe()[40];
  const fremd = { i: 'fremd1-000001', z: Z.jetzt().getTime() + 1, y: 'ab', d: '2031-03-01', id, v: [...D.A[id].v], e: 'o'.repeat(D.A[id].ayat), q: 'frei', p: 10, m: 2 };
  const sockel = kopie({ ...Z.P, log: [] });
  const { profil, log } = Z.zusammenfuehren(sockel, [], [fremd]);
  assert.ok(profil.tage['2031-03-01']?.fertig.includes(id), 'der fremde Eintrag ist eingebaut');
  Z.standUebernehmen(profil, log);
  planLaeuft(6, echte, 'nach dem Abgleich');
  // derselbe Stand, aus dem Protokoll neu gebaut (so sieht ihn jedes weitere Gerät): nichts fehlt
  const nach = Z.nachbau(sockel, [fremd, ...Z.P.log]);
  for (const d of echte) assert.ok(nach.tage[d]?.fertig.length, 'Nachbau: ' + d);
  assert.equal(Object.keys(nach.tage).length, Object.keys(Z.P.tage).length);
});

test('NB1 c: Uhr weit in der Vergangenheit (leere Batterie): tagesplan() liefert einen Plan, kein Tag geht verloren, danach geht es normal weiter', () => {
  for (const falsch of [new Date(2024, 0, 10, 12), new Date(2000, 0, 1, 12)]) {
    frisch({ pensum: 3 }); ueben(20);
    const echte = echteTage(), n = Object.keys(Z.P.tage).length;
    Z.uhrSetzen(() => falsch);
    assert.ok(Z.uhrSprung() < -400);
    const t = Z.tagesplan();
    assert.ok(t && Array.isArray(t.plan), 'Plan am falschen Tag');
    assert.equal(Z.tagesplan(), t);
    assert.equal(Object.keys(Z.P.tage).length, n + 1);
    wirdErfuellen();                                                    // selbst wenn dort geübt wird
    for (const d of echte) assert.ok(Z.P.tage[d]?.fertig.length, 'echter Tag ' + d);
    tagSetzenZurueck();
    planLaeuft(5, echte, 'nach dem Richtigstellen');
  }
});

test('NB1: das Verdichten selbst bleibt: nach mehr als 400 Übungstagen weichen die ältesten Tage, der Verlauf der Punkte bleibt', () => {
  frisch({ pensum: 1 });
  const erster = Z.heute();
  for (let i = 0; i < 430; i++) { wirdErfuellen(); naechsterTag(); }
  const tage = Object.keys(Z.P.tage).sort();
  assert.ok(!Z.P.tage[erster], 'der erste Tag ist verdichtet');
  assert.ok(tage.length >= 400 && tage.length <= 410, 'rund 400 Tage bleiben: ' + tage.length);
  assert.ok(Z.P.verlauf[erster] > 0, 'die Punkte des Tages stehen weiter im Verlauf');
  assert.ok(Z.P.tage[Z.plusTage(Z.heute(), -1)].fertig.length);
});

// ---------- Logik NB2 ----------
function mitLektion() {
  frisch({ bereich: D.A.slice(-30).map(e => e.id) });
  const id = Z.lernVorschlag(); assert.ok(Z.lernBeginnen(id));
  for (let i = 0; i < 3; i++) { Z.abschnittAbschliessen(id, ok(id), 'lern'); naechsterTag(); }
  assert.ok(Z.imBereich(id) && Z.P.einst.bereich.includes(id) && Z.P.lern[id].ph === 2);
  return id;
}
test('NB2: ein Bereichs-Eintrag eines Geräts mit 1.99 (ohne Modellmarke) wirft den in 2.00 gelernten Abschnitt nicht aus dem Bestand', () => {
  const id = mitLektion(), sockel = kopie({ ...Z.P, log: [] }), z = Z.jetzt().getTime();
  const alt = sockel.einst.bereich.filter(x => x !== id).slice(0, -2);       // 1.99 führt gelernte Abschnitte nie in der Liste, hier nimmt es zwei weitere heraus
  const altAuswahl = [[D.A[alt[0]].v[0], D.A[alt.at(-1)].v[1]]];
  for (const eintraege of [
    [{ i: 'alt199-000001', z, y: 'ei', k: 'einst.bereich', w: alt }, { i: 'alt199-000002', z: z + 1, y: 'ei', k: 'einst.auswahl', w: altAuswahl }],
    [{ i: 'alt199-000001', z, y: 'ei', k: 'einst.auswahl', w: altAuswahl }, { i: 'alt199-000002', z: z + 1, y: 'ei', k: 'einst.bereich', w: alt }]
  ]) {
    const p = Z.nachbau(sockel, eintraege);
    Z.mitProfil(p, () => {
      assert.ok(Z.imBereich(id), 'der gelernte Abschnitt bleibt im Bestand');
      assert.ok(Z.reihe().includes(id), 'und in der Reihe der Wiederholung');
      assert.ok(!Z.lernbar(id), 'er gilt nicht wieder als lernbar');
      assert.deepEqual(p.einst.bereich, [...alt, id].sort((a, b) => a - b), 'sonst gilt die Wahl des anderen Geräts');
      assert.ok(p.einst.auswahl.some(([a, b]) => a <= D.A[id].v[0] && b >= D.A[id].v[1]), 'auch in der Auswahl steht er');
    });
    assert.doesNotThrow(() => Z.profilPruefen(p));
  }
});
test('NB2: eine Abwahl in 2.00 trägt die Modellmarke und gilt, auch nach dem Nachbau', () => {
  const id = mitLektion(), sockel = kopie({ ...Z.P, log: [] }), n = Z.P.log.length;
  Z.P.einst.bereich = Z.P.einst.bereich.filter(x => x !== id);
  Z.P.einst.auswahl = [[D.A[Z.P.einst.bereich[0]].v[0], D.A[Z.P.einst.bereich.at(-1)].v[1]]];
  assert.equal(Z.speichern(), true);
  const neu = Z.P.log.slice(n);
  assert.deepEqual(neu.map(e => e.k).sort(), ['einst.auswahl', 'einst.bereich']);
  assert.ok(neu.every(e => e.m === Z.MODELL_STAND), 'Bereich und Auswahl aus 2.00 tragen m');
  const p = Z.nachbau(sockel, neu);
  Z.mitProfil(p, () => { assert.ok(!Z.imBereich(id)); assert.ok(!Z.reihe().includes(id)); assert.ok(Z.lernbar(id)); });
});

// ---------- Logik NB3, NB4 ----------
test('NB3: derselbe Abschnitt im veralteten zweiten Reiter zählt als zweiter Durchgang (keine Punkte ein zweites Mal)', async () => {
  frisch({ pensum: 2 });
  const [a] = Z.tagesplan().plan;
  const Z2 = await import('../js/zustand.js?reiter=nb3');
  Z2.uhrSetzen(() => Z.jetzt()); Z2.laden();
  const r1 = Z.abschnittAbschliessen(a, ok(a));
  assert.ok(r1.punkte > 0 && !r1.wiederholung);
  const r2 = Z2.abschnittAbschliessen(a, ok(a));                       // Reiter 2 hat kein storage-Ereignis bekommen
  assert.equal(r2.wiederholung, true); assert.equal(r2.punkte, 0);
  const g = JSON.parse(localStorage.getItem('itqan-profil-v1'));
  assert.equal(g.summe.punkte, r1.punkte); assert.equal(g.karten[a].st, 1); assert.equal(g.summe.abschnitte, 2);
});
test('NB4: nach dem Löschen im einen Reiter schreibt der andere das Profil nicht wieder in den Speicher', async () => {
  frisch({ pensum: 2 });
  const [a, b] = Z.tagesplan().plan, meldungen = [];
  const Z2 = await import('../js/zustand.js?reiter=nb4');
  Z2.uhrSetzen(() => Z.jetzt()); Z2.laden();
  Z.fremdeAenderungHakenSetzen(x => meldungen.push(x.art));
  Z2.loeschen();
  Z.abschnittAbschliessen(a, ok(a));                                   // Reiter 1 weiß noch nichts vom Löschen
  assert.deepEqual(meldungen, ['geloescht']);
  assert.equal(localStorage.getItem('itqan-profil-v1'), null, 'das Profil bleibt gelöscht');
  assert.equal(Z.speichern(), false); Z.unterscheidenMerken('1-2', true);
  assert.equal(localStorage.getItem('itqan-profil-v1'), null);
  // ein bewusst neu angelegtes oder geladenes Profil wird wieder geschrieben
  Z.neuesProfil({ name: 'Neu' });
  assert.ok(localStorage.getItem('itqan-profil-v1')); assert.equal(Z.speichern(), true);
  Z.abschnittAbschliessen(Z.tagesplan().plan[0], ok(Z.tagesplan().plan[0]));
  assert.equal(JSON.parse(localStorage.getItem('itqan-profil-v1')).summe.abschnitte, 1);
  Z.fremdeAenderungHakenSetzen(null); void b;
});

// ---------- Sicherheit N1 ----------
const BILD = '<img src=x onerror=alert(1)>';
// Angriffs- und Fehleinträge: die aus dem Nach-Audit (eintraege.mjs) und je Art falsche Typen und Wertebereiche
function angriffe(z) {
  const e = (nr, y, rest) => ({ i: 'boese1-' + String(nr).padStart(6, '0'), z: z + nr, y, ...rest });
  const d = '2026-01-07';
  return [
    e(1, 'ab', { d: BILD, id: 3, q: BILD, e: 'ooo', p: 5 }),
    e(2, 'ab', { d, id: 3, q: BILD, e: 'ooo', p: 5 }),
    e(3, 'ab', { d, id: 99999, e: 'ooo', q: 'frei', p: 5 }),
    e(4, 'ab', { d, id: '3', e: 'ooo', q: 'frei', p: 5 }),
    e(5, 'ab', { d, id: 3, e: 'ooo', q: 'frei', p: BILD }),
    e(6, 'ab', { d, id: 3, e: 'ooo', q: 'frei', p: 1e9 }),
    e(7, 'ab', { d, id: 3, e: 'ooo', q: 'frei' }),
    e(8, 'ab', { d, id: 3, q: 'frei', p: 5 }),
    e(9, 'ab', { d, id: 3, e: ['o', 'o'], q: 'frei', p: 5 }),
    e(10, 'ab', { d, id: -1, e: 'o', q: 'frei', p: 5 }),
    e(11, 'ab', { d, id: 3.5, e: 'o', q: 'frei', p: 5 }),
    e(12, 'ab', { d, id: 3, e: 'o', q: 'frei', p: 5, s: BILD }),
    e(13, 'ab', { d, id: 3, e: 'o', q: 'frei', p: 5, v: BILD }),
    e(14, 'lb', { d, id: BILD }),
    e(15, 'lb', { d: BILD, id: 5 }),
    e(16, 'lb', { d, id: 99999 }),
    e(17, 'lx', { id: BILD }),
    e(18, 'pl', { d, t: { plan: [BILD], art: {}, fertig: [], punkte: 0 } }),
    e(19, 'pl', { d, t: { plan: [0], art: { 0: BILD }, fertig: [], punkte: BILD } }),
    e(20, 'pl', { d, t: { plan: [99999], art: { 99999: 'zyklus' }, fertig: [], punkte: 0, hasanat: 0, r: 0, f: 0, h: 0 } }),
    e(21, 'pl', { d, t: BILD }),
    e(22, 'pl', { d: BILD, t: { plan: [], art: {}, fertig: [] } }),
    e(23, 'pl', { d, t: { plan: [1], art: { 1: 'zyklus' }, ma: { 1: BILD }, fertig: [], punkte: 0 } }),
    e(24, 'pl', { d, t: { plan: [1], art: { 1: 'zyklus' }, fertig: [], punkte: 0, ruhe: BILD } }),
    e(25, 'pl', { d, t: { plan: [1], art: { 1: 'zyklus' }, fertig: [], punkte: 0 }, kn: BILD }),
    e(26, 'pa', { d, plus: BILD }),
    e(27, 'pa', { d, ers: [BILD], raus: [1] }),
    e(28, 'pa', { d, minus: 99999 }),
    e(29, 'pa', { d: BILD, plus: 1 }),
    e(30, 'fm', { d, w: [BILD] }),
    e(31, 'fm', { d, w: ['12.3'], a: BILD }),
    e(32, 'fm', { d, w: ['12.3'], m: BILD }),
    e(33, 'fm', { d, w: BILD }),
    e(34, 'fm', { d: BILD, w: ['12.3'] }),
    e(35, 'fm', { d, w: [] }),
    e(36, 'fl', { s: BILD }),
    e(37, 'fg', { vi: BILD, e: 1 }),
    e(38, 'mu', { d, k: BILD, ok: 1 }),
    e(39, 'mu', { d: BILD, k: '1-2', ok: 1 }),
    e(40, 'ku', { d, a: BILD, p: 5 }),
    e(41, 'ku', { d, a: 'zeile', p: 1e7 }),
    e(42, 'ku', { d, a: 'zeile', p: BILD }),
    e(43, 'pb', { d, n: 99999 }),
    e(44, 'pb', { d, n: BILD }),
    e(45, 'pb', { d: BILD, n: 3 }),
    e(46, 'pe', { d: BILD }),
    e(47, 'on', { d: BILD }),
    e(48, 'rk', { ids: BILD }),
    e(49, 'rk', { ids: [BILD] }),
    e(50, 'ei', { k: 'einst.modus', w: BILD }),
    e(51, 'ei', { k: 'einst.' + BILD, w: 1 }),
    e(52, 'ei', { k: 'einst.__proto__', w: { x: 1 } }),
    e(53, 'ei', { k: 'einst.pensum', w: [1, 2, 3] }),
    e(54, 'zz', { d }),
    e(61, 'ab', { d: '2026-13-45', id: 3, e: 'ooo', q: 'frei', p: 5 }),
    e(62, 'ab', { d: '2026-02-31', id: 3, e: 'ooo', q: 'frei', p: 5 }),
    e(63, 'ab', { d: '9999-12-31', id: 3, e: 'ooo', q: 'frei', p: 5 }),
    e(64, 'pl', { d: '0000-00-00', t: { plan: [1], art: { 1: 'zyklus' }, fertig: [], punkte: 0 } }),
    e(65, 'pb', { d: '1969-12-31', n: 3 }),
    e(55, 'ab', { d, id: 3, e: 'o', q: 'frei', p: 5, fremd: BILD }),
    e(56, 'toString', { d }),
    e(57, '__proto__', { d }),
    { i: BILD, z, y: 'pe', d },
    { i: 'boese1-000059', z: BILD, y: 'pe', d },
    { i: 'boese1-000060', y: 'pe', d },
    null, 5, 'text', [], { y: 'ab' }
  ];
}
test('N1: eintragGut lehnt jeden Angriffseintrag ab und nimmt jeden echten Eintrag an', () => {
  frisch({ pensum: 3 });
  for (const e of angriffe(Z.jetzt().getTime())) assert.equal(Z.eintragGut(e), false, JSON.stringify(e)?.slice(0, 120));
  // echte Einträge aller Arten: ein Verlauf mit Plan, Abschluss, Fehlerstellen, Pause, Lektion, Kurzübung, Einstellung, Rücknahme
  const t = Z.tagesplan(), id = t.plan[0], v0 = D.A[id].v[0];
  const stand = Z.fehlerstellenStand();
  Z.fehlerstellenMerken([v0 + '.1', v0 + '.2'], 'haraka', v0 + 5); Z.fehlerstellenSetzen(stand);
  Z.fehlerstellenMerken([v0 + '.1'], 'verwechslung'); Z.fehlerstelleGeuebt(v0, 'ok'); Z.fehlerstelleLoeschen(v0 + '.1');
  Z.abschnittAbschliessen(id, D.A[id].ayat > 1 ? ['fehler', ...ok(id).slice(1)] : ok(id), undefined, 42);
  Z.abschnittAbhaken(t.plan[1]); Z.pensumHeuteAendern(1); Z.pensumHeuteAendern(-1);
  Z.unterscheidenMerken('1-2', true); Z.kurzBuchen('zeile', 1); Z.ornamenteNachtragen();
  Z.P.name = 'Ali & "Söhne" <3 O\'Neil'; Z.P.einst.pensum = [2, 2, 2, 2, 2, 0, 2]; Z.P.einst.reihenfolge = 'zufall'; Z.speichern();
  Z.heuteNeuAufbauen(); naechsterTag(); wirdErfuellen(); Z.pauseBeginnen(3); Z.pauseBeenden(); naechsterTag(); naechsterTag(); Z.tagesplan();
  Z.P.einst.bereich = D.A.slice(0, 30).map(x => x.id); Z.speichern(); Z.heuteAnBereichAnpassen();
  const lid = Z.lernVorschlag(); Z.lernBeginnen(lid); Z.abschnittAbschliessen(lid, ok(lid), 'lern'); Z.lernAbbrechen(lid);
  const arten = new Set(Z.P.log.map(e => e.y));
  for (const y of ['pl', 'pa', 'ab', 'fm', 'fl', 'fg', 'mu', 'ku', 'pb', 'pe', 'lb', 'lx', 'rk', 'ei']) assert.ok(arten.has(y), 'der Verlauf enthält keinen Eintrag ' + y);
  for (const e of Z.P.log) assert.equal(Z.eintragGut(e), true, JSON.stringify(e).slice(0, 200));
  assert.equal(Z.eintragGut({ i: 'a-000001', z: 5, y: 'on', d: '2026-01-07' }), true);
  assert.equal(Z.eintragGut({ i: 'a-000002', z: 5, y: 'pe', d: '1970-01-01' }), true, 'ein Gerät mit zurückgesetzter Uhr schreibt gültige Einträge');
  // echte Einträge älterer Fassungen (Protokoll eines Stands aus 1.98)
  const alt = lies('tests/fixtures/profil_1.98_klassisch.json'), log = (alt.profil || alt).log || [];
  for (const e of log) assert.equal(Z.eintragGut(e), true, JSON.stringify(e).slice(0, 200));
});

test('N1: Angriffseinträge vom Konto werden beim Nachbau übersprungen: kein Fremdtext im Profil, der Stand besteht die Profilprüfung, echte Einträge wirken', () => {
  frisch({ pensum: 3 });
  const sockel = kopie({ ...Z.P, log: [] }), z = Z.jetzt().getTime();
  ueben(3); wirdErfuellen(); Z.unterscheidenMerken('1-2', true);
  const echt = kopie(Z.P.log), soll = kopie({ ...Z.P, log: [] });
  const boese = angriffe(z + 5000);
  // jeder Angriffseintrag einzeln und alle zusammen, gemischt mit den echten
  for (const liste of [...boese.map(b => [b, ...echt]), [...boese, ...echt], [...echt, ...boese]]) {
    let p;
    assert.doesNotThrow(() => { p = Z.nachbau(sockel, liste); }, 'ein Fehleintrag darf den Nachbau nicht aufhalten');
    assert.ok(!JSON.stringify(p).includes('<img'), 'Fremdtext im Profil');
    assert.doesNotThrow(() => Z.profilPruefen(p));
    assert.deepEqual(kopie(p), soll, 'das Ergebnis ist der Stand aus den echten Einträgen allein');
  }
  const { profil, log } = Z.zusammenfuehren(sockel, echt, boese);
  assert.deepEqual(kopie(profil), soll); assert.equal(log.length, echt.length, 'Fehleinträge kommen nicht ins Protokoll des Geräts');
});

// ---------- Plattform N1, N2, N7 (was sich ohne Browser prüfen lässt; der Rest steht als Browserbeleg im Protokoll) ----------
const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const quelle = pfad => readFileSync(join(APP, pfad), 'utf8');

test('Plattform N2: „Neue Version bereit“ nur, wenn im Netz eine andere Version liegt, als die Seite ausführt', async () => {
  const V = await import('../js/version.js'), text = quelle('js/version.js');
  assert.equal(V.andereVersion(text), false, 'dieselbe Fassung: kein Hinweis (gewöhnliches Update, die Seite hat schon neu geladen)');
  assert.equal(V.andereVersion(text.replace(`VERSION = '${V.VERSION}'`, "VERSION = '9.99'")), true, 'andere Fassung im Netz: Hinweis');
  for (const leer of ['', null, undefined, '<html>Bitte anmelden</html>', 'export const X = 1;']) assert.equal(V.andereVersion(leer), false, 'ohne lesbare Version kein Hinweis');
  const app = quelle('js/app.js'), start = quelle('js/start.js');
  assert.ok(/neueVersionWartet\(\)\.then\(ja => \{\s*if \(!ja\)/.test(app), 'app.js zeigt den Hinweis, ohne die Version zu vergleichen');
  assert.ok(app.includes("fetch('js/version.js', { cache: 'no-store' })") && app.includes('.then(andereVersion)'));
  assert.equal((app.match(/leiste\('neue-version'/g) || []).length, 1, 'der Hinweis hat genau eine Stelle, hinter der Prüfung');
  assert.ok(/if \(gesteuert\) \{ wurzel\.dataset\.neueVersion = '1'/.test(start), 'beim ersten Start (noch kein Worker) vermerkt start.js keinen Wechsel');
});

test('Plattform N7: die Rauchprobe im Workflow lässt einen Fehlschlag nicht still grün enden', () => {
  const yml = quelle('.github/workflows/pages.yml'), i = yml.indexOf('- name: Rauchprobe');
  assert.ok(i > 0, 'Schritt Rauchprobe fehlt');
  const schritt = yml.slice(i);
  assert.ok(!/continue-on-error/.test(schritt), 'continue-on-error macht den Fehlschlag unsichtbar');
  assert.ok(/exit 1\s*$/.test(schritt.trimEnd()), 'ohne Treffer endet der Schritt mit Fehler');
  for (const f of ['sw.js', 'js/version.js', 'index.html', 'js/app.js']) assert.ok(schritt.includes(f), f + ' wird nicht geprüft');
  assert.ok(!/curl[^\n|]*\|\s*grep -q/.test(schritt), 'curl | grep -q scheitert unter pipefail, wenn grep früh aufhört');
});

// ---------- Oberfläche ----------
test('Oberfläche N-1: ein nie geprüfter Abschnitt, der durch einen Planumbau dazukam, trägt die Marke Erstprüfung', () => {
  frisch({ pensum: 3 });
  const t = Z.tagesplan();
  for (const id of t.plan) assert.equal(Z.platzMarke(t, id), t.ma[id], 'mit Angabe im Plan gilt die Angabe');
  Z.pensumHeuteAendern(1);                                             // ein Abschnitt mehr: ohne Angabe im Plan
  const neu = Z.P.tage[Z.heute()].plan.at(-1);
  assert.equal(Z.P.tage[Z.heute()].ma[neu], undefined);
  assert.equal(Z.platzMarke(Z.P.tage[Z.heute()], neu), 'erst');
  Z.abschnittAbschliessen(neu, ok(neu));
  assert.equal(Z.platzMarke(Z.P.tage[Z.heute()], neu), 'erst', 'auch nachdem er heute zum ersten Mal geprüft wurde');
  // Reihenfolge geändert: die ersetzten Abschnitte
  Z.P.einst.reihenfolge = 'rueckwaerts'; Z.speichern(); assert.ok(Z.heuteNeuAufbauen() > 0);
  const h = Z.P.tage[Z.heute()];
  for (const id of h.plan.filter(x => !h.fertig.includes(x))) assert.equal(Z.platzMarke(h, id), 'erst');
  // am nächsten Tag ist ein schon geprüfter Abschnitt ohne Angabe eine Runde
  wirdErfuellen(); naechsterTag();
  assert.equal(Z.platzMarke({ plan: [neu], fertig: [], ma: {} }, neu), 'zyklus');
  assert.ok(quelle('js/app.js').includes("MARKE[Z.platzMarke(t, id)] || tx('heute.runde')"));
});

test('Oberfläche N-7: Einzahl bei 1 in allen sieben Sprachen (Āya richtig, Āya gekonnt, Tag Kette)', async () => {
  const { tx } = await import('../js/sprache.js');
  assert.equal(tx('zustand.ayat_richtig', { r: 1 }), '1 Āya richtig'); assert.equal(tx('zustand.ayat_richtig', { r: 2 }), '2 Āyāt richtig'); assert.equal(tx('zustand.ayat_richtig', { r: 0 }), '0 Āyāt richtig');
  assert.equal(tx('ueben.ayat_gekonnt', { n: 1 }), 'Āya gekonnt'); assert.equal(tx('ueben.ayat_gekonnt', { n: 7 }), 'Āyāt gekonnt');
  assert.equal(tx('fertig.ayat_gekonnt', { n: 1 }), 'Āya gekonnt');
  assert.equal(tx('heute.tage_kette', { n: 1 }), 'Tag Kette'); assert.equal(tx('heute.tage_kette', { n: 0 }), 'Tage Kette'); assert.equal(tx('fertig.tage_kette', { n: 12 }), 'Tage Kette');
  for (const code of ['de', 'en', 'tr', 'ar', 'ur', 'fr', 'es']) {
    const s = (await import(`../js/sprache/${code}.js`)).default;
    for (const [b, k, n] of [['zustand', 'ayat_richtig', 'r'], ['ueben', 'ayat_gekonnt', 'n'], ['fertig', 'ayat_gekonnt', 'n'], ['heute', 'tage_kette', 'n'], ['fertig', 'tage_kette', 'n']]) {
      assert.match(s[b][k], new RegExp(`^\\{${n}, plural, .*one \\{.+\\}.* other \\{.+\\}\\}$`), `${code} ${b}.${k}`);
      assert.ok(!/[–—]/.test(s[b][k]));
    }
  }
  const app = quelle('js/app.js');
  for (const aufruf of ["tx('heute.tage_kette', { n", "tx('ueben.ayat_gekonnt', { n: ayat.length })", "tx('fertig.ayat_gekonnt', { n:", "tx('fertig.tage_kette', { n: P.kette.n })"]) assert.ok(app.includes(aufruf), aufruf);
  assert.ok(!/tx\('(heute|fertig)\.tage_kette'\)|tx\('(ueben|fertig)\.ayat_gekonnt'\)/.test(app), 'ein Aufruf ohne Zahl zeigt immer die Mehrzahl');
});

test('Oberfläche N-2, N-5, N-6 und Sicherheit N4, N5, N8, Abl. 27 am Quelltext', () => {
  const app = quelle('js/app.js');
  // N-2: nach „Abschnitt abschließen“ kurz kein Aufdecken
  assert.ok(/tippSperre = Date\.now\(\) \+ \d+;\s*pos = ayat\.length; rundeFertig\(\);/.test(app) && app.includes("querySelector('#auf').onclick = () => { if (Date.now() < tippSperre) return; aufdecken(); };"));
  // N-5: der Datenfehler-Bildschirm hat einen Knopf
  assert.ok(/die_daten_konnten_nicht_geladen_werden'\)\}<\/p><button[^>]*id="df-neu"/.test(app) && app.includes("querySelector('#df-neu').onclick = neuLadenFrisch"));
  // N-6: nur eine abgebrochene Auswahl endet stumm, eine leere Datei bekommt die Meldung
  assert.ok(!app.includes('const [text] = await dateiWaehlen(); if (!text) return;') && app.includes('if (!dateien.length) return;'));
  // Sicherheit N4, N5, N8
  assert.ok(app.includes('data-zeit="${esc(x.zeit)}"') && !app.includes('data-zeit="${x.zeit}"'));
  assert.ok(!app.includes("querySelector('#hf-' + z)"));
  assert.ok(app.includes('return Array.isArray(l) ? l : [];') && app.includes('x?.profil?.erstellt === r.profil.erstellt'));
  // B-18: sehr schmale Bildschirme
  const css = quelle('css/itqan.css'), schmal = css.slice(css.lastIndexOf('@media (max-width:359px){'));
  for (const regel of ['.nav a{flex:1 1 0;min-width:0;', '[data-ansicht=heute] .kopfzeile .marke{font-size:min(var(--s-seite),34px)}', '.mushaf-leiste .knopf{font-size:min(var(--s-text),16px)']) assert.ok(schmal.includes(regel), regel);
  // Abl. 27: „Āyāt sicher“ kommt überall aus derselben Funktion
  assert.equal((app.match(/const sicherAnteil = /g) || []).length, 1);
  for (const zeile of app.split('\n').filter(z => z.includes("tx('allg.ayat_sicher')"))) assert.ok(/prozent\((quote|q)\)/.test(zeile), 'Āyāt sicher ohne sicherAnteil: ' + zeile.slice(0, 80));
  assert.ok(app.includes('const quote = t.r + t.f + t.h ? sicherAnteil(t) : null;') && app.includes('const quote = sicherAnteil(s);') && app.includes('q = sicherAnteil(s)'));
});
