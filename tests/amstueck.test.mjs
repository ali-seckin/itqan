// Itqān · Tests: Am Stück üben (Sitzung: Abschlussgrenzen, Speichern, Zählung) und die gemeinsame Mikrofon-Verwaltung (Attrappe für getUserMedia)
// Aufruf aus dem Ordner app: node --test tests/amstueck.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { frisch, Z, D } from './umgebung.mjs';
const AS = await import('../js/amstueck.js');
const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const quelle = f => readFileSync(join(APP, f), 'utf8');

// ---------- Sitzung ----------
const alle = (s, x = 'ok') => { let ev; while (!s.beendet && s.e && s.pos < s.e.ayat) { s.aufdecken(); ev = s.bewerten(x); if (ev.art !== 'aya') break; } return ev; };
const bis = (s, n, x = 'ok') => { for (let i = 0; i < n; i++) { s.aufdecken(); s.bewerten(x); } };
const nutzbar = () => D.A.findIndex(e => e.ayat >= 3 && D.A[e.id + 1]?.ayat >= 2);   // ein Abschnitt mit mindestens 3 Āyāt, dahinter noch einer

test('am Rand des Abschnitts wird gespeichert und weitergeblättert, der Zwischenstand verschwindet', () => {
  frisch(); const id = nutzbar(), n = D.A[id].ayat;
  const s = new AS.Sitzung(id);
  bis(s, n - 1);
  assert.deepEqual(Z.zwischenstandLaden(id, 'frei').erg, Array(n - 1).fill('ok'), 'jede Bewertung steht sofort im Zwischenstand');
  assert.equal(Z.P.summe.abschnitte, 0, 'vor der Grenze ist noch nichts gebucht');
  s.aufdecken(); const ev = s.bewerten('ok');
  assert.equal(ev.art, 'abschnitt'); assert.equal(ev.id, id); assert.equal(ev.naechster, id + 1);
  assert.equal(Z.P.summe.abschnitte, 1); assert.equal(Z.karte(id).n, 1);
  assert.equal(Z.zwischenstandLaden(id, 'frei'), null, 'nach dem Abschluss kein Zwischenstand mehr');
  assert.equal(s.id, id + 1); assert.equal(s.pos, 0); assert.equal(s.offen, false); assert.deepEqual(s.erg, []);
  assert.equal(s.stand.abschnitte, 1); assert.equal(s.stand.punkte, ev.res.punkte); assert.ok(ev.res.punkte > 0);
});

test('der Abschluss geht mit Quelle frei und der Übungszeit an die Logik', () => {
  frisch(); const id = nutzbar(), n = D.A[id].ayat, aufrufe = [];
  let t = 1_000_000; const jetzt = () => t;
  const spion = { ...Z, abschnittAbschliessen: (...a) => { aufrufe.push(a); return Z.abschnittAbschliessen(...a); }, zwischenstandSpeichern: Z.zwischenstandSpeichern, zwischenstandLaden: Z.zwischenstandLaden, zwischenstandLoeschen: Z.zwischenstandLoeschen };
  const s = new AS.Sitzung(id, { Z: spion, jetzt });
  bis(s, 1); t += 20_000;
  s.sichtbarkeit(true); t += 600_000;   // im Hintergrund: zählt nicht
  s.sichtbarkeit(false); t += 10_000;
  s.aufdecken(); s.bewerten('zoegern'); bis(s, n - 2);
  assert.equal(aufrufe.length, 1);
  const [aid, erg, q, dauer] = aufrufe[0];
  assert.equal(aid, id); assert.equal(q, 'frei'); assert.equal(erg.length, n); assert.equal(erg[1], 'zoegern');
  assert.equal(dauer, 30, 'nur die sichtbare Zeit zählt (20 s + 10 s)');
});

test('der Zähler stimmt: aufgedeckt, richtig, gezögert, Fehler', () => {
  frisch(); const id = nutzbar(), s = new AS.Sitzung(id);
  s.aufdecken(); s.bewerten('ok'); s.aufdecken(); s.bewerten('fehler'); s.aufdecken(); s.bewerten('zoegern'); s.aufdecken();
  assert.deepEqual({ ...s.stand, punkte: 0 }, { aufgedeckt: 4, richtig: 1, zoegern: 1, fehler: 1, abschnitte: 0, punkte: 0, hasanat: 0 });
  assert.equal(s.zusammenfassung().geuebt, 3, 'bewertet sind drei, die vierte ist nur aufgedeckt');
});

test('Reihenfolge: ohne Aufdecken keine Bewertung, kein doppeltes Aufdecken, nur bekannte Werte', () => {
  frisch(); const s = new AS.Sitzung(nutzbar());
  assert.equal(s.bewerten('ok'), null);
  assert.equal(s.aufdecken(), s.e.v[0]); assert.equal(s.aufdecken(), null);
  assert.equal(s.bewerten('hilfe'), null); assert.equal(s.bewerten('x'), null);
  assert.equal(s.bewerten('ok').art, 'aya'); assert.equal(s.stand.aufgedeckt, 1);
});

test('Vorige Āya neu bewerten: nur im Abschnitt, Zähler und Zwischenstand gehen zurück', () => {
  frisch(); const id = nutzbar(), s = new AS.Sitzung(id);
  assert.equal(s.zuruecknehmen(), null, 'am Anfang gibt es nichts zurückzunehmen');
  bis(s, 2, 'fehler');
  assert.equal(s.zuruecknehmen(), s.e.v[0] + 1); assert.equal(s.pos, 1); assert.equal(s.offen, true);
  assert.equal(s.stand.fehler, 1); assert.deepEqual(Z.zwischenstandLaden(id, 'frei').erg, ['fehler']);
  assert.equal(s.zuruecknehmen(), null, 'solange die Āya offen ist, bleibt es dabei');
  assert.equal(s.bewerten('ok').art, 'aya'); assert.deepEqual(s.erg, ['fehler', 'ok']);
  // nach der Grenze ist der Abschnitt gebucht: kein Zurücknehmen mehr über die Grenze
  const n = D.A[id].ayat; bis(s, n - 2);
  assert.equal(s.id, id + 1); assert.equal(s.zuruecknehmen(), null);
});

test('Beenden mitten im Abschnitt sichert den Stand; Weitermachen übernimmt ihn, Neu beginnen nicht', () => {
  frisch(); const id = nutzbar(), n = D.A[id].ayat;
  const s = new AS.Sitzung(id); bis(s, 2); s.aufdecken();
  const z = s.beenden();
  assert.deepEqual(z.offen, { id, a: 3, n }); assert.equal(z.geuebt, 2); assert.equal(z.stelle, id); assert.equal(z.abschnitte, 0);
  assert.deepEqual(Z.zwischenstandLaden(id, 'frei').erg, ['ok', 'ok']);
  assert.equal(s.aufdecken(), null, 'nach dem Beenden geht nichts mehr');
  assert.equal(AS.stelleLesen(), id, 'der Merkzettel für „Dort weitermachen“ zeigt auf den Abschnitt');
  const w = new AS.Sitzung(id, { weiter: true });
  assert.equal(w.pos, 2); assert.deepEqual(w.erg, ['ok', 'ok']); assert.equal(w.zeitGanz, false, 'fortgesetzte Übungen werden nicht gemessen');
  assert.equal(w.stand.richtig, 0, 'der Zähler zählt nur diese Sitzung');
  const v = new AS.Sitzung(id, { weiter: false });
  assert.equal(v.pos, 0); assert.deepEqual(v.erg, []);
  assert.deepEqual(Z.zwischenstandLaden(id, 'frei').erg, ['ok', 'ok'], 'ein Neubeginn ohne Bewertung löscht nichts');
});

test('Beenden ohne eine Bewertung lässt einen vorhandenen Zwischenstand stehen', () => {
  frisch(); const id = nutzbar(), s = new AS.Sitzung(id); bis(s, 1);
  const w = new AS.Sitzung(id, { weiter: false }); w.beenden();
  assert.deepEqual(Z.zwischenstandLaden(id, 'frei').erg, ['ok']);
});

test('Weiterblättern in einen schon angefangenen Abschnitt setzt dort fort, nichts wird überschrieben', () => {
  frisch(); const id = nutzbar(), n = D.A[id].ayat;
  Z.zwischenstandSpeichern(id + 1, 'frei', ['fehler']);
  const s = new AS.Sitzung(id); const ev = alle(s);
  assert.equal(ev.art, 'abschnitt'); assert.equal(ev.fortgesetzt, 1); assert.equal(s.pos, 1); assert.deepEqual(s.erg, ['fehler']);
  s.aufdecken(); s.bewerten('ok');
  assert.deepEqual(Z.zwischenstandLaden(id + 1, 'frei').erg, ['fehler', 'ok']);
  assert.ok(n > 0);
});

test('mehrere Abschnitte nacheinander: alle gebucht, Summen stimmen', () => {
  frisch(); const id = nutzbar(), s = new AS.Sitzung(id); let summe = 0, aya = 0;
  for (let i = 0; i < 3; i++) { aya += s.e.ayat; const ev = alle(s, i === 1 ? 'zoegern' : 'ok'); assert.equal(ev.art, 'abschnitt'); summe += ev.res.punkte; }
  assert.equal(s.stand.abschnitte, 3); assert.equal(s.stand.punkte, summe); assert.equal(s.fertig.length, 3);
  assert.equal(Z.P.summe.abschnitte, 3); assert.equal(s.zusammenfassung().geuebt, aya);
  assert.equal(s.stand.zoegern, D.A[id + 1].ayat);
});

test('der letzte Abschnitt des Qurʾān beendet die Sitzung', () => {
  frisch(); const letzter = D.A.length - 1, s = new AS.Sitzung(letzter);
  const ev = alle(s);
  assert.equal(ev.art, 'ende'); assert.equal(s.beendet, true); assert.equal(s.quranEnde, true);
  assert.equal(s.zusammenfassung().quranEnde, true); assert.equal(s.aufdecken(), null);
  assert.equal(Z.P.summe.abschnitte, 1);
});

test('scheitert der Abschluss, bleiben alle Bewertungen im Zwischenstand und die Sitzung endet sauber', () => {
  frisch(); const id = nutzbar(), n = D.A[id].ayat;
  const kaputt = { ...Z, abschnittAbschliessen: () => { throw new Error('ergebnis-ungueltig'); }, zwischenstandSpeichern: Z.zwischenstandSpeichern, zwischenstandLaden: Z.zwischenstandLaden, zwischenstandLoeschen: Z.zwischenstandLoeschen };
  const s = new AS.Sitzung(id, { Z: kaputt }); const ev = alle(s);
  assert.equal(ev.art, 'fehler'); assert.match(ev.fehler.message, /ergebnis/); assert.equal(s.beendet, true);
  assert.equal(Z.zwischenstandLaden(id, 'frei').erg.length, n, 'nichts ging verloren: die gewöhnliche Übung holt den Abschluss nach');
  assert.equal(Z.P.summe.abschnitte, 0);
  const z = s.beenden(); assert.ok(z.fehler); assert.equal(z.offen, null);
});

test('ein Zwischenstand der gewöhnlichen Übung mit Hilfe wird akzeptiert, ein kaputter ignoriert', () => {
  frisch(); const id = nutzbar();
  Z.zwischenstandSpeichern(id, 'frei', ['hilfe', 'ok']);
  assert.equal(new AS.Sitzung(id, { weiter: true }).pos, 2);
  Z.zwischenstandSpeichern(id, 'frei', ['ok', 'quatsch']);
  assert.equal(new AS.Sitzung(id, { weiter: true }).pos, 0);
  Z.zwischenstandSpeichern(id, 'frei', Array(D.A[id].ayat).fill('ok'));
  assert.equal(new AS.Sitzung(id, { weiter: true }).pos, 0, 'ein voller Zwischenstand (Abschluss gescheitert) gehört der gewöhnlichen Übung');
});

test('Merkzettel: nur ein vorhandener Abschnitt zählt', () => {
  frisch(); localStorage.setItem('itqan-amstueck', JSON.stringify({ id: 999999, d: '2026-01-05' })); assert.equal(AS.stelleLesen(), null);
  localStorage.setItem('itqan-amstueck', 'kaputt'); assert.equal(AS.stelleLesen(), null);
  AS.stelleMerken(3); assert.equal(AS.stelleLesen(), 3);
});

// ---------- Mikrofon-Verwaltung ----------
function strom() { const spuren = [{ gestoppt: false, stop() { this.gestoppt = true; } }]; return { spuren, getTracks: () => spuren }; }
// Attrappe für getUserMedia und die Uhr: Anfragen und Wartezeiten sammeln sich und werden vom Test aufgelöst
function aufbau(opt = {}) {
  const anfragen = [], zeiten = []; let t = 5000;
  const gum = () => new Promise((ok, nein) => { const a = { ok: () => { a.strom = strom(); ok(a.strom); return a.strom; }, nein }; anfragen.push(a); });
  const warte = ms => ms === 0 ? Promise.resolve() : new Promise(r => zeiten.push({ ms, r }));
  const M = AS.mikroKoordinator({ gum, warte, jetzt: () => t, ...opt });
  return { M, anfragen, zeiten, uhr: x => { t += x; }, zeit: ms => { const z = zeiten.find(q => q.ms === ms && !q.fertig); assert.ok(z, 'keine Wartezeit von ' + ms); z.fertig = true; z.r(); } };
}
const tick = () => new Promise(r => setImmediate(r));
const stirbt = async (p, name) => { try { await p; } catch (e) { assert.equal(e.name, name); return e; } assert.fail('hätte ' + name + ' sein müssen'); };

test('Mikrofon: eine Anfrage liefert den Strom, Abgeben beendet ihn', async () => {
  const { M, anfragen } = aufbau(), w = M.besitzer();
  const p = M.holen(w); await tick(); assert.equal(anfragen.length, 1);
  const s = anfragen[0].ok(); assert.equal(await p, s); assert.equal(M.laeuft(), true);
  M.abgeben(w); assert.equal(s.spuren[0].gestoppt, true); assert.equal(M.laeuft(), false);
});

test('Mikrofon: die neue Übung stellt keine zweite Anfrage neben die offene der alten, sondern wartet', async () => {
  const { M, anfragen, zeiten, zeit } = aufbau(), alt = M.besitzer(), neu = M.besitzer();
  const pAlt = M.holen(alt); await tick(); assert.equal(anfragen.length, 1);
  const pNeu = M.holen(neu); await tick();
  assert.equal(anfragen.length, 1, 'keine zweite Anfrage, solange die erste offen ist');
  M.beenden(alt);   // die alte Übung wird verlassen
  const spaet = anfragen[0].ok();   // die Erlaubnis kommt erst jetzt
  await stirbt(pAlt, 'Abgebrochen');
  assert.equal(spaet.spuren[0].gestoppt, true, 'der späte Strom der verlassenen Übung wird sofort beendet');
  await tick(); await tick(); zeit(350);   // Ruhezeit nach dem Beenden
  await tick(); assert.equal(anfragen.length, 2);
  const s = anfragen[1].ok(); assert.equal(await pNeu, s); assert.equal(s.spuren[0].gestoppt, false);
  assert.ok(zeiten.length >= 1);
});

test('Mikrofon: antwortet das Gerät nie, endet die Anfrage nach der Frist, der späte Strom wird beendet, die nächste wartet nicht darauf', async () => {
  const { M, anfragen, zeit } = aufbau(), w = M.besitzer();
  const p = M.holen(w); await tick(); zeit(12000);
  await stirbt(p, 'TimeoutError');
  const spaet = anfragen[0].ok(); await tick();
  assert.equal(spaet.spuren[0].gestoppt, true, 'ein Strom nach der Frist bleibt nicht offen');
  const p2 = M.holen(w); await tick(); await tick();
  assert.equal(anfragen.length, 1, 'zuerst die Ruhezeit nach dem späten Strom, dann erst die neue Anfrage');
  zeit(350); await tick(); assert.equal(anfragen.length, 2, 'der Knopf ist nicht tot: die neue Anfrage geht ans Gerät, ohne auf die hängende zu warten');
  const s = anfragen[1].ok(); assert.equal(await p2, s);
});

test('Mikrofon: NotReadableError bekommt einen zweiten Versuch, NotAllowedError nicht', async () => {
  const a = aufbau(), w = a.M.besitzer();
  const p = a.M.holen(w); await tick();
  a.anfragen[0].nein(Object.assign(new Error('x'), { name: 'NotReadableError' })); await tick(); await tick();
  a.zeit(400); await tick(); assert.equal(a.anfragen.length, 2);
  const s = a.anfragen[1].ok(); assert.equal(await p, s);
  const b = aufbau(), v = b.M.besitzer(), q = b.M.holen(v); await tick();
  b.anfragen[0].nein(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
  await stirbt(q, 'NotAllowedError'); assert.equal(b.anfragen.length, 1);
});

test('Mikrofon: nach dem Freigeben vergeht eine Ruhezeit, bevor das Gerät wieder gefragt wird', async () => {
  const { M, anfragen, zeiten, zeit, uhr } = aufbau(), w = M.besitzer();
  let p = M.holen(w); await tick(); anfragen[0].ok(); await p; M.abgeben(w);
  p = M.holen(w); await tick(); assert.equal(anfragen.length, 1, 'sofort nach dem Freigeben noch keine neue Anfrage');
  assert.ok(zeiten.some(z => z.ms === 350 && !z.fertig)); zeit(350); await tick();
  assert.equal(anfragen.length, 2); anfragen[1].ok(); await p; M.abgeben(w); uhr(1000);
  p = M.holen(w); await tick(); assert.equal(anfragen.length, 3, 'Ruhezeit schon vorbei: ohne Verzögerung'); anfragen[2].ok(); await p;
});

test('Mikrofon: Abgeben während einer Anfrage bricht sie ab und beendet den Strom, der dann doch noch kommt', async () => {
  const { M, anfragen } = aufbau(), w = M.besitzer();
  const p = M.holen(w); await tick(); M.abgeben(w);
  const s = anfragen[0].ok(); await stirbt(p, 'Abgebrochen'); assert.equal(s.spuren[0].gestoppt, true); assert.equal(M.laeuft(), false);
});

test('Mikrofon: wer die Übung verlassen hat, fragt nie wieder an; alleFrei räumt auf', async () => {
  const { M, anfragen } = aufbau(), w = M.besitzer(), x = M.besitzer();
  M.beenden(w); await stirbt(M.holen(w), 'Abgebrochen'); assert.equal(anfragen.length, 0);
  const p = M.holen(x); await tick(); const s = anfragen[0].ok(); await p;
  M.alleFrei(); assert.equal(s.spuren[0].gestoppt, true); assert.equal(M.laeuft(), false);
});

test('Mikrofon: ein Strom einer früheren Übung wird bei der nächsten Anfrage nicht mitgenommen', async () => {
  const { M, anfragen, zeit } = aufbau(), a = M.besitzer(), b = M.besitzer();
  let p = M.holen(a); await tick(); const sa = anfragen[0].ok(); await p;
  p = M.holen(b); await tick(); assert.equal(sa.spuren[0].gestoppt, true);
  zeit(350); await tick(); anfragen[1].ok(); await p;
});

// ---------- Verdrahtung ----------
test('app.js: das Mikrofon kommt nur noch über die gemeinsame Verwaltung, der Knopf richtet sich nach dem wirklichen Stand', () => {
  const app = quelle('js/app.js');
  assert.ok(!/mediaDevices\.getUserMedia\(/.test(app), 'getUserMedia wird nur noch in js/amstueck.js aufgerufen');
  assert.ok(app.includes('AS.Mikro.holen(mikroBesitzer)') && app.includes('AS.Mikro.beenden(mikroBesitzer)') && app.includes('AS.Mikro.alleFrei()'));
  assert.equal((app.match(/mb\.onclick = aufnahmeKnopf;/g) || []).length, 2, 'beide Aufnahmeknöpfe nutzen den Stand von jetzt');
  assert.ok(/const aufnahmeKnopf = \(\) => \{ if \(rec\?\.state === 'recording'\) aufnahmeStopp\(\); else aufnahmeStart\(\); \};/.test(app));
  assert.ok(/startet && Date\.now\(\) - startZeit < 1500/.test(app), 'ein hängender Start sperrt den Knopf nicht für immer');
  assert.ok(app.includes('einmalBeiWechsel(mikroAus)') && app.includes("beiWechsel.forEach(f => removeEventListener('hashchange', f))"), 'Adresswechsel-Behandler melden sich nach der Übung ab');
  assert.ok(!/addEventListener\('hashchange', mikroAus/.test(app));
});

test('Verdrahtung: Route, Titel, Einstieg im Üben-Reiter, Offline-Vorrat, Stilanhang', () => {
  const app = quelle('js/app.js'), sw = quelle('sw.js'), css = quelle('css/itqan.css');
  assert.ok(app.includes('amstueck: amstueckWahl') && app.includes("amstueck: tx('amstueck.titel')"));
  assert.ok(app.includes("if (idText === 'amstueck') return AS.lauf(asHelfer(), quelle, fokusText);"));
  assert.ok(app.includes('href="#amstueck"'));
  assert.ok(sw.includes("'js/amstueck.js'"));
  assert.ok(css.includes('/* Am Stück üben 2.02 */'));
});

test('Texte: der Abschnitt amstueck steht in allen sieben Sprachen mit denselben Schlüsseln und Platzhaltern, ohne Gedankenstriche', async () => {
  const de = (await import('../js/sprache/de.js')).default.amstueck;
  assert.ok(de && Object.keys(de).length >= 18);
  for (const c of ['de', 'en', 'tr', 'ar', 'fr', 'es', 'ur']) {
    const T = (await import(`../js/sprache/${c}.js`)).default.amstueck;
    assert.deepEqual(Object.keys(T), Object.keys(de), c);
    for (const k of Object.keys(de)) {
      assert.deepEqual((T[k].match(/\{\w+\}/g) || []).sort(), (de[k].match(/\{\w+\}/g) || []).sort(), `${c}.${k}: Platzhalter`);
      assert.ok(!/[–—]/.test(T[k]), `${c}.${k}: Gedankenstrich`);
      assert.ok(T[k].trim().length > 0);
    }
  }
});
