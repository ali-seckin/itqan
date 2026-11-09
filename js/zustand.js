// Itqān · Profil, Tagesplan (Wird), Karteisystem, Punkte, Kette
import { D, GLIEDERUNG } from './daten.js';

const SCHLUESSEL = 'itqan-profil-v1';
export const STUFEN = ['neu', 'im Aufbau', 'gefestigt', 'sicher', 'mutqan'];
export const KETTEN_MEILEN = [7, 40, 66, 100, 200, 365, 604];
const FEHLER_ABSTAND = [1, 3, 7];      // Tage bis zur nächsten Fehlerwiederholung
export let P = null;

// ---------- Datum (lokal) ----------
// Die Uhr ist austauschbar: Tests stellen damit Tage vor, später kommt der eigene Tageswechsel dazu
let uhr = () => new Date();
export function uhrSetzen(f) { uhr = f || (() => new Date()); }
export const jetzt = () => uhr();
// Ohne Datum: der heutige Tag nach dem eigenen Tageswechsel (z. B. 3 Uhr: ein Wird um 1 Uhr nachts zählt zum Vortag)
export function heute(d) {
  if (!d) { d = uhr(); const v = P?.einst?.tagesbeginn || 0; if (v) d = new Date(d.getTime() - v * 36e5); }
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
export function plusTage(datum, n) {
  const [y, m, t] = datum.split('-').map(Number);
  return heute(new Date(y, m - 1, t + n));
}
export const wochentag = datum => { const [y, m, t] = datum.split('-').map(Number); return (new Date(y, m - 1, t).getDay() + 6) % 7; }; // 0 = Montag
export const tageZwischen = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

// ---------- Laden / Speichern ----------
export function laden() {
  try { const t = localStorage.getItem(SCHLUESSEL); if (t) P = JSON.parse(t); } catch (e) { P = null; }
  if (P) ergaenzen(P);
  return P;
}
// ältere Profile um neue Felder ergänzen
export function ergaenzen(p) {
  p.einst.zufall ??= 'einzeln'; p.einst.vorueben ??= true; p.fstellen ??= {};
  if (!['v1', 'v2'].includes(p.einst.ausgabe)) p.einst.ausgabe = 'v2';   // frühere Mischform wird Druck 1421
  p.einst.modus ??= 'fort'; p.gliederung ??= 'fort-1'; p.meilenD ??= {};
  p.einst.sofort ??= true; p.einst.abhoeren ??= true; p.einst.tagesbeginn ??= 0;
  p.einst.schwaechen ??= 'ausgewogen'; p.pausen ??= []; p.zyklus.konto ??= 0; p.mutash ??= {};
  p.statistik ??= { arten: artenAusStellen(p.fstellen) };
  return p;
}
export function speichern() {
  try { localStorage.setItem(SCHLUESSEL, JSON.stringify(P)); } catch (e) { console.warn('Speichern fehlgeschlagen', e); }
}
export function neuesProfil({ name = '', pensum = 3, reihenfolge = 'vorwaerts', bereich = null, thema = 'auto', modus = 'fort' } = {}) {
  P = {
    format: 'itqan', version: 1, erstellt: uhr().toISOString(), name,
    einst: { pensum: Array(7).fill(pensum), reihenfolge, bereich, thema, erinnerung: '05:30', hilfe: true, zufall: 'einzeln', vorueben: true, ausgabe: 'v2', modus }, gliederung: GLIEDERUNG[modus]?.name || 'fort-2',
    karten: {}, zyklus: { erledigt: [], khatma: 0, beginn: heute() },
    tage: {}, kette: { n: 0, beste: 0, zuletzt: null }, summe: { punkte: 0, hasanat: 0, r: 0, f: 0, h: 0, abschnitte: 0 },
    meilen: [], meilenD: {}, fstellen: {}, pausen: [], statistik: { arten: {} }, mutash: {}
  };
  P.einst.schwaechen = 'ausgewogen'; P.zyklus.konto = 0;
  speichern(); return P;
}
export function ersetzeProfil(neu) { P = ergaenzen(neu); speichern(); }

// ---------- Schnappschüsse: automatische Kopien des Profils auf diesem Gerät ----------
// Bis zu zwei tägliche und drei vor wichtigen Schritten (Gliederungswechsel, Laden einer Sicherung, Löschen).
// Sie schützen vor eigenen Fehlgriffen, nicht vor dem Löschen der App: dafür ist „Profil sichern“ da.
const SCHNAPP = 'itqan-schnappschuesse';
export function schnappschuesse() { try { return JSON.parse(localStorage.getItem(SCHNAPP) || '[]'); } catch (e) { return []; } }
export function schnappschuss(grund) {
  if (!P) return false;
  const neu = { zeit: uhr().toISOString(), tag: heute(), grund, name: P.name, abschnitte: P.summe.abschnitte, daten: JSON.stringify(P) };
  const alle = [neu, ...schnappschuesse()];
  let liste = [...alle.filter(x => x.grund === 'täglich').slice(0, 2), ...alle.filter(x => x.grund !== 'täglich').slice(0, 3)]
    .sort((a, b) => b.zeit.localeCompare(a.zeit));
  while (liste.length) { try { localStorage.setItem(SCHNAPP, JSON.stringify(liste)); return true; } catch (e) { liste = liste.slice(0, -1); } }
  return false;
}
export function tagesSchnappschuss() {
  if (!P || schnappschuesse().some(x => x.grund === 'täglich' && x.tag === heute())) return false;
  return schnappschuss('täglich');
}
export function schnappschussZurueck(zeit) {
  const s = schnappschuesse().find(x => x.zeit === zeit); if (!s) return false;
  const daten = JSON.parse(s.daten);
  if (P) schnappschuss('vor dem Zurückholen');
  P = ergaenzen(daten); speichern(); return true;
}
// Kurzer Überblick über ein Profil, z. B. vor dem Laden einer Sicherung
export function profilUeberblick(p) {
  const tage = Object.entries(p.tage || {}).filter(([, t]) => t.fertig?.length).map(([d]) => d).sort();
  return { name: p.name || '', erstellt: p.erstellt, abschnitte: p.summe?.abschnitte || 0, punkte: p.summe?.punkte || 0,
    kette: p.kette?.n || 0, khatma: p.zyklus?.khatma || 0, letzterTag: tage.at(-1) || null, fstellen: Object.keys(p.fstellen || {}).length };
}
export function loeschen() { P = null; try { localStorage.removeItem(SCHLUESSEL); } catch (e) {} }

// ---------- Wechsel der Gliederung (neue Fassung oder Anfänger/Fortgeschritten) ----------
// Der Fortschritt wird über die Āya-Bereiche übertragen: ein geteilter Abschnitt erbt den Stand des alten,
// ein zusammengelegter bekommt den schwächsten Stand seiner Teile.
const gliederungen = new Map();
export function gliederungLaden(name) {
  if (!gliederungen.has(name)) gliederungen.set(name, fetch(`daten/gliederungen/${name}.json`).then(r => { if (!r.ok) throw new Error(name); return r.json(); }));
  return gliederungen.get(name);
}
export function gliederungUmstellen(alt, ziel = D.gliederung, sichern = true) {
  const neu = D.A, M = neu.map(n => { const r = []; alt.forEach(([a, b], i) => { if (a <= n.v[1] && b >= n.v[0]) r.push(i); }); return r; });
  const R = alt.map(() => []); M.forEach((os, nid) => os.forEach(o => R[o].push(nid)));
  const altK = P.karten, karten = {};
  neu.forEach((n, nid) => {
    const os = M[nid], ks = os.map(o => altK[o]).filter(Boolean);
    if (!ks.length) return;
    const fa = [...new Set(ks.flatMap(k => k.fa || []))].filter(v => v >= n.v[0] && v <= n.v[1]);
    const faes = ks.map(k => k.fae).filter(Boolean).sort();
    karten[nid] = { st: os.some(o => !altK[o]) ? 0 : Math.min(...ks.map(k => k.st)), n: Math.max(...ks.map(k => k.n)), fe: Math.max(...ks.map(k => k.fe || 0)),
      zul: ks.map(k => k.zul).filter(Boolean).sort().pop() || null, fae: fa.length ? (faes[0] || null) : null, fs: 0, fa, lf: fa.length && ks.some(k => (k.lf ?? 1) > 0) ? 1 : 0 };
  });
  P.karten = karten;
  const erl = new Set(P.zyklus.erledigt);
  P.zyklus.erledigt = neu.map((n, nid) => nid).filter(nid => M[nid].length && M[nid].every(o => erl.has(o)));
  if (P.einst.bereich) { const b = new Set(P.einst.bereich); P.einst.bereich = neu.map((n, nid) => nid).filter(nid => M[nid].some(o => b.has(o))); }
  for (const t of Object.values(P.tage)) {
    const plan = [...new Set(t.plan.flatMap(o => R[o] || []))], fertig = new Set(t.fertig), art = {};
    for (const nid of plan) { const o = M[nid].find(x => t.plan.includes(x)); art[nid] = t.art[o] || 'zyklus'; }
    t.fertig = plan.filter(nid => M[nid].every(o => !t.plan.includes(o) || fertig.has(o)));
    t.plan = plan; t.art = art;
  }
  P.gliederung = ziel; if (sichern) speichern();
}
export async function gliederungAbgleichen() {
  if (!P || P.gliederung === D.gliederung) return false;
  gliederungUmstellen(await gliederungLaden(P.gliederung)); return true;
}

// ---------- Karteikarten ----------
export const karte = id => P.karten[id] || { st: 0, n: 0, fe: 0, zul: null, fae: null, fs: 0, fa: [] };
// Stand eines Abschnitts für die Anzeige: nie gelesen, Fehler im letzten Durchgang, sonst die Stufe
export function abschnittStand(id) {
  const k = karte(id);
  if (!k.n) return 'nie';
  if ((k.lf ?? (k.fae ? 1 : 0)) > 0) return 'fehler';
  return ['neu', 'aufbau', 'gefestigt', 'sicher', 'mutqan'][k.st];
}
export function imBereich(id) { return !P.einst.bereich || P.einst.bereich.includes(id); }
export function reihe() {
  const ids = D.A.map(e => e.id).filter(imBereich);
  if (P.einst.reihenfolge !== 'rueckwaerts') return ids;
  // Sūren rückwärts (an-Nās zuerst), innerhalb der Sūra vorwärts. Bei Zufall bleibt die Grundreihe vorwärts.
  const gruppen = []; let g = [], s = null;
  for (const id of ids) { const e = D.A[id]; if (e.von[0] !== s) { if (g.length) gruppen.push(g); g = []; s = e.von[0]; } g.push(id); }
  if (g.length) gruppen.push(g);
  return gruppen.reverse().flat();
}

// ---------- Ruhetage und Pause ----------
// Ruhetag: Wochentag mit 0 Abschnitten. Pause: höchstens 30 Tage am Stück. An beiden Tagen gibt es keinen Wird,
// die Kette ruht und läuft danach weiter, Qaḍāʾ bezieht sich auf den letzten echten Wird-Tag.
export const PAUSE_MAX = 30;
export const pauseJetzt = (datum = heute()) => (P.pausen || []).find(x => datum >= x.von && datum <= x.bis) || null;
export const inPause = (datum = heute()) => !!pauseJetzt(datum);
export const ruhetag = (datum = heute()) => !(P.einst.pensum[wochentag(datum)] > 0) || inPause(datum);
export function vorigerWirdTag(datum) {
  for (let i = 1; i <= 60; i++) { const d = plusTage(datum, -i); if (!ruhetag(d)) return d; }
  return plusTage(datum, -1);
}
function faeVerschieben(ab, n) {
  for (const k of Object.values(P.karten)) if (k.fae && k.fae >= ab) k.fae = plusTage(k.fae, n);
}
export function pauseBeginnen(tage) {
  tage = Math.max(1, Math.min(PAUSE_MAX, Math.round(tage)));
  const d = heute(), t = P.tage[d];
  const von = t && !t.ruhe && t.fertig.length ? plusTage(d, 1) : d;   // heute schon geübt: Pause ab morgen
  if (P.tage[von] && !P.tage[von].fertig.length) delete P.tage[von];
  const bis = plusTage(von, tage - 1);
  P.pausen = [...(P.pausen || []).filter(x => x.bis < von), { von, bis }].slice(-12);
  faeVerschieben(von, tage);
  speichern(); return { von, bis };
}
export function pauseBeenden() {
  const d = heute(), p = pauseJetzt(d); if (!p) return false;
  faeVerschieben(d, -(tageZwischen(d, p.bis) + 1));   // nicht genutzte Pausentage zurückgeben
  if (p.von >= d) P.pausen = P.pausen.filter(x => x !== p); else p.bis = plusTage(d, -1);
  if (P.tage[d]?.ruhe) delete P.tage[d];
  speichern(); return true;
}

// ---------- Tagesplan ----------
export function pensumAm(datum) { return ruhetag(datum) ? 0 : Math.max(1, P.einst.pensum[wochentag(datum)] || 1); }
// übliches Pensum, wenn man an einem Ruhetag trotzdem übt
function pensumUeblich() { const t = P.einst.pensum.filter(x => x > 0); return Math.max(1, Math.round(t.reduce((a, b) => a + b, 0) / Math.max(1, t.length))); }
export function ketteAktiv(datum = heute()) {
  const z = P.kette.zuletzt; if (!z || !P.kette.n) return false;
  return z >= vorigerWirdTag(vorigerWirdTag(datum));
}
// Anteil des Pensums für zusätzliches Festigen schwacher Abschnitte (Regler in den Einstellungen).
// Eingestellt mit tests/simulation.mjs (200 Tage, 8 Läufe): „Schwächen zuerst“ verlängert die Ḫatma um etwa 7 %,
// schwache Abschnitte kommen außerhalb der Fehlerwiederholung gut doppelt so oft dran.
export const SCHWAECHEN = { khatma: 0, ausgewogen: 0.03, schwaechen: 0.065 };
// schwach: ein Fehler innerhalb der letzten zwei Runden (fz: Tag des letzten Fehlers) oder im Schnitt viele Fehler je Durchgang
const istSchwach = (k, seit) => k.n > 0 && k.fe > 0 && ((k.fz && k.fz >= seit) || k.fe / k.n >= 0.5);
export const schwachWert = k => (k.fe / k.n) * 2 + (4 - k.st) + (k.fae ? 1 : 0);
export function tagesplan(datum = heute(), trotzdem = false) {
  if (P.tage[datum] && !(trotzdem && P.tage[datum].ruhe)) return P.tage[datum];
  if (ruhetag(datum) && !trotzdem) {
    P.tage[datum] = { plan: [], art: {}, fertig: [], punkte: 0, hasanat: 0, r: 0, f: 0, h: 0, voll: false, qadaa: 0, ruhe: inPause(datum) ? 'pause' : 'ruhetag' };
    speichern(); return P.tage[datum];
  }
  const frei = ruhetag(datum);
  let n = frei ? pensumUeblich() : pensumAm(datum), qadaa = 0;
  // Qaḍāʾ: der letzte Wird-Tag ist ausgefallen, der davor war erfüllt, die Kette läuft → dessen Pensum nachholen
  const w1 = vorigerWirdTag(datum), w2 = vorigerWirdTag(w1), z = P.kette.zuletzt;
  if (!frei && P.kette.n > 0 && z && z >= w2 && z < w1) qadaa = pensumAm(w1);
  const plan = [], art = {};
  const faellig = Object.entries(P.karten)
    .filter(([id, k]) => k.fae && k.fae <= datum && imBereich(+id))
    .sort((a, b) => a[1].fae.localeCompare(b[1].fae) || a[1].st - b[1].st)
    .map(([id]) => +id);
  for (const id of faellig.slice(0, Math.ceil((n + qadaa) / 2))) { plan.push(id); art[id] = 'fehler'; }
  // Festigen: schwache Abschnitte, deren letzte Wiederholung mindestens eine halbe Runde zurückliegt
  const anteil = SCHWAECHEN[P.einst.schwaechen] ?? SCHWAECHEN.ausgewogen;
  if (anteil > 0) {
    P.zyklus.konto = (P.zyklus.konto || 0) + n * anteil;
    const runde = tageProKhatma(), grenze = plusTage(datum, -Math.max(14, Math.round(runde / 4))), seit = plusTage(datum, -2 * runde);
    const platz = n + qadaa - plan.length - 1;    // mindestens ein Abschnitt der Runde bleibt
    const kand = Object.entries(P.karten).map(([id, k]) => [+id, k])
      .filter(([id, k]) => !plan.includes(id) && !k.fae && k.zul && k.zul <= grenze && istSchwach(k, seit) && imBereich(id))
      .sort((a, b) => schwachWert(b[1]) - schwachWert(a[1]) || a[1].zul.localeCompare(b[1].zul));
    const zahl = Math.max(0, Math.min(Math.floor(P.zyklus.konto), platz, kand.length));
    for (const [id] of kand.slice(0, zahl)) { plan.push(id); art[id] = 'festigen'; }
    P.zyklus.konto = kand.length > zahl ? P.zyklus.konto - zahl : Math.min(P.zyklus.konto - zahl, 1);   // ohne Kandidaten kein Stau
  }
  const naechste = naechsteImZyklus(n + qadaa - plan.length, new Set(plan), datum);
  naechste.forEach((id, i) => { plan.push(id); art[id] = i >= naechste.length - qadaa && qadaa ? 'qadaa' : 'zyklus'; });
  P.tage[datum] = { plan, art, fertig: [], punkte: 0, hasanat: 0, r: 0, f: 0, h: 0, voll: false, qadaa, ...(frei ? { freiwillig: true } : {}) };
  aufraeumen(); speichern();
  return P.tage[datum];
}
// an einem Ruhetag oder in der Pause trotzdem üben
export function trotzdemUeben() { return tagesplan(heute(), true); }
// Zufallszahlen mit Startwert: derselbe Tag ergibt denselben Vorschlag
function zufall(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) { h = Math.imul(h ^ text.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
export function naechsteImZyklus(anzahl, ausser = new Set(), datum = heute()) {
  const erl = new Set(P.zyklus.erledigt), aus = [];
  if (P.einst.reihenfolge === 'zufall') {
    const r = reihe(), rnd = zufall(`${datum}|${P.erstellt}|${erl.size}|${[...ausser].join(',')}`);
    const offen = r.filter(id => !erl.has(id) && !ausser.has(id));
    const pool = offen.length ? offen : r.filter(id => !ausser.has(id));
    if (P.einst.zufall === 'block') {  // eine zufällige Stelle, dann am Stück weiter (ohne Sprung vom Ende an den Anfang)
      const k = Math.floor(rnd() * (Math.max(0, pool.length - anzahl) + 1));
      aus.push(...pool.slice(k, k + anzahl));
    } else {
      const a = [...pool]; while (aus.length < anzahl && a.length) aus.push(a.splice(Math.floor(rnd() * a.length), 1)[0]);
    }
    if (aus.length < anzahl) for (const id of r) { if (aus.length >= anzahl) break; if (!ausser.has(id) && !aus.includes(id)) aus.push(id); }
    return aus;
  }
  for (const id of reihe()) { if (aus.length >= anzahl) break; if (!erl.has(id) && !ausser.has(id)) aus.push(id); }
  if (aus.length < anzahl) { // Runde fast fertig: von vorne weiter
    for (const id of reihe()) { if (aus.length >= anzahl) break; if (!ausser.has(id) && !aus.includes(id)) aus.push(id); }
  }
  return aus;
}
// nächster Abschnitt nach dem heutigen Plan: bei „Zufall am Stück“ direkt im Anschluss
function fortsetzung(t) {
  if (P.einst.reihenfolge === 'zufall' && P.einst.zufall === 'block') {
    const letzte = [...t.plan].reverse().find(id => t.art[id] !== 'fehler');
    if (letzte != null) {
      const r = reihe(), erl = new Set(P.zyklus.erledigt), i0 = r.indexOf(letzte);
      for (let k = 1; k < r.length; k++) { const id = r[(i0 + k) % r.length]; if (!t.plan.includes(id) && !erl.has(id)) return id; }
    }
  }
  return naechsteImZyklus(1, new Set(t.plan))[0];
}
export function pensumHeuteAendern(delta) {
  const t = tagesplan(); const offen = t.plan.filter(id => !t.fertig.includes(id));
  if (delta > 0) { const id = fortsetzung(t); if (id != null) { t.plan.push(id); t.art[id] = 'zyklus'; t.voll = false; } }
  else if (offen.length && t.plan.length > 1) { const id = offen[offen.length - 1]; t.plan = t.plan.filter(x => x !== id); delete t.art[id]; }
  speichern(); return t;
}
export function bonusVorschlag() { return fortsetzung(tagesplan()); }

// ---------- Fehlerstellen (einzelne Wörter) ----------
// P.fstellen['vi.i'] = { n: Anzahl, t: { Art: Anzahl }, d: zuletzt }
export const FEHLERARTEN = [['verwechslung', 'Verwechslung'], ['abweichung', 'Abweichung'], ['ausgelassen', 'Ausgelassen'], ['haraka', 'Ḥaraka'], ['haenger', 'Hänger']];
// kurze Erklärung, die beim Antippen einer Fehlerart erscheint
export const FEHLERARTEN_TEXT = {
  verwechslung: 'Mit einer ähnlichen Stelle verwechselt (Mutašābih).',
  abweichung: 'Kleine Abweichung im Wort, z. B. ohne Wāw gelesen oder Fāʾ statt Wāw.',
  ausgelassen: 'Ein Wort oder ein Stück übersprungen.',
  haraka: 'Falscher Vokal oder falsches Zeichen.',
  haenger: 'Hängen geblieben, erst nach einer Pause weiter.'
};
function artenAusStellen(fst) {
  const a = {}; for (const f of Object.values(fst || {})) for (const [x, n] of Object.entries(f.t || {})) a[x] = (a[x] || 0) + n;
  return a;
}
// je markierte Āya zählt die gewählte Fehlerart einmal (dauerhaft, auch wenn die Stelle später erledigt ist)
export function fehlerstellenMerken(schluessel, art) {
  if (art && schluessel.length) { P.statistik ??= { arten: {} }; P.statistik.arten[art] = (P.statistik.arten[art] || 0) + 1; }
  for (const s of schluessel) {
    const f = P.fstellen[s] || { n: 0, t: {}, d: null };
    f.n++; f.d = heute(); if (art) f.t[art] = (f.t[art] || 0) + 1;
    P.fstellen[s] = f;
  }
  speichern();
}
export function fehlerstelleLoeschen(s) { delete P.fstellen[s]; speichern(); }
// Stand der Fehlerstellen merken und wiederherstellen (für „Vorige Āya neu bewerten“)
export const fehlerstellenStand = () => JSON.parse(JSON.stringify({ f: P.fstellen || {}, a: P.statistik?.arten || {} }));
export function fehlerstellenSetzen(stand) {
  stand = JSON.parse(JSON.stringify(stand || {}));
  if (stand.f && stand.a) { P.fstellen = stand.f; (P.statistik ??= {}).arten = stand.a; } else P.fstellen = stand;
  speichern();
}
// Mutašābihāt unterscheiden: je Paar (Schlüssel 'viA-viB') Anzahl, richtig, letztes Ergebnis, Tag
export function unterscheidenMerken(key, ok) {
  const x = (P.mutash ??= {})[key] || { n: 0, ok: 0 };
  x.n++; if (ok) x.ok++; x.letzt = ok ? 1 : 0; x.d = heute();
  P.mutash[key] = x; speichern(); return x;
}
// Abhören: jede Āya mit mindestens einem markierten Wort zählt als Fehler, alle anderen als richtig
export const abhoerErgebnis = (ayat, fehlerVi) => ayat.map(vi => fehlerVi.has(vi) ? 'fehler' : 'ok');

// ---------- Zwischenstand einer angefangenen Übung (gilt nur am selben Tag und für dieselbe Gliederung) ----------
const ZWISCHEN = 'itqan-zwischenstand';
export function zwischenstand() { try { const z = JSON.parse(localStorage.getItem(ZWISCHEN) || 'null'); return z && z.tag === heute() && z.gliederung === D.gliederung ? z : null; } catch (e) { return null; } }
export function zwischenstandLaden(id, quelle = '') { const z = zwischenstand(); return z && z.id === id && (z.quelle || '') === (quelle || '') ? z : null; }
export function zwischenstandSpeichern(id, quelle, erg) { try { localStorage.setItem(ZWISCHEN, JSON.stringify({ id, quelle: quelle || '', erg, tag: heute(), gliederung: D.gliederung })); } catch (e) {} }
export function zwischenstandLoeschen() { try { localStorage.removeItem(ZWISCHEN); } catch (e) {} }
// Gezieltes Üben einer Fehlerstelle: dreimal in Folge richtig, dann ist sie erledigt
export const STELLE_ZIEL = 3;
export function fehlerstelleGeuebt(vi, ergebnis) {
  const keys = Object.keys(P.fstellen).filter(s => +s.split('.')[0] === vi);
  let erledigt = 0, gut = 0;
  for (const s of keys) {
    const f = P.fstellen[s];
    if (ergebnis === 'ok') { f.gut = (f.gut || 0) + 1; gut = Math.max(gut, f.gut); if (f.gut >= STELLE_ZIEL) { delete P.fstellen[s]; erledigt++; } }
    else f.gut = 0;
  }
  speichern();
  return { erledigt, gut, rest: keys.length - erledigt };
}
export const fehlerstellenSet = () => new Set(Object.keys(P.fstellen || {}));
export function fehlerstellenListe(n = 12) {
  return Object.entries(P.fstellen || {}).map(([s, f]) => ({ s, vi: +s.split('.')[0], i: +s.split('.')[1], ...f }))
    .sort((a, b) => b.n - a.n || (b.d || '').localeCompare(a.d || '')).slice(0, n);
}
function aufraeumen() { // alte Tage verdichten, Statistik behalten
  for (const [d, t] of Object.entries(P.tage)) if (tageZwischen(d, heute()) > 400) delete P.tage[d];
}

// ---------- Ergebnis eines Abschnitts ----------
// ergebnisse: Array von 'ok' | 'hilfe' | 'fehler' je Āya (in Reihenfolge v[0]..v[1])
// dauer: aktive Übungszeit in Sekunden (ohne Zeit im Hintergrund), fehlt bei fortgesetzten Übungen
export function abschnittAbschliessen(id, ergebnisse, quelle, dauer) {
  const datum = heute(), t = tagesplan(datum), e = D.A[id], k = { ...karte(id) };
  const r = ergebnisse.filter(x => x === 'ok').length, h = ergebnisse.filter(x => x === 'hilfe').length, f = ergebnisse.filter(x => x === 'fehler').length;
  const art = quelle || t.art[id] || 'frei';
  // Punkte: Rückmeldung über Können
  let punkte = 10 * r + 5 * h, teile = [[`${r} Āyāt richtig`, 10 * r]];
  if (h) teile.push([`${h} mit Hilfe`, 5 * h]);
  if (!f && !h) { const b = Math.round(punkte * 0.25); punkte += b; teile.push(['Fehlerfrei', b]); }
  if (art === 'bonus') { const b = Math.round(punkte * 0.5); punkte += b; teile.push(['Bonusabschnitt +50 %', b]); }
  const kp = Math.min(20, Math.floor(P.kette.n / 7) * 2);
  if (kp) { const b = Math.round(punkte * kp / 100); punkte += b; teile.push([`Kette +${kp} %`, b]); }
  const hasanat = e.buchstaben * 10;
  // Karteisystem
  const vorher = k.st;
  if (f) { k.fz = datum; k.st = Math.max(0, k.st - (f / ergebnisse.length > 0.3 ? 2 : 1)); k.fae = plusTage(datum, FEHLER_ABSTAND[0]); k.fs = 0; }
  else if (h) { k.fae = k.fae && k.fae <= plusTage(datum, 3) ? k.fae : plusTage(datum, 3); }
  else {
    k.st = Math.min(4, k.st + 1);
    if (k.fae) { k.fs = (k.fs || 0) + 1; k.fae = k.fs < FEHLER_ABSTAND.length ? plusTage(datum, FEHLER_ABSTAND[k.fs]) : null; if (!k.fae) k.fs = 0; }
  }
  k.n++; k.fe += f; k.zul = datum; k.lf = f;   // lf: Fehler im letzten Durchgang
  if (dauer > 0) { k.z = Math.round(dauer); t.zeit = (t.zeit || 0) + k.z; t.zn = (t.zn || 0) + 1; t.za = (t.za || 0) + ergebnisse.length; }
  k.fa = ergebnisse.map((x, i) => x !== 'ok' ? e.v[0] + i : -1).filter(i => i >= 0);
  P.karten[id] = k;
  // Tag und Summen
  if (!t.fertig.includes(id)) t.fertig.push(id);
  if (art === 'bonus' && !t.plan.includes(id)) { t.plan.push(id); t.art[id] = 'bonus'; }
  Object.assign(t, { punkte: t.punkte + punkte, hasanat: t.hasanat + hasanat, r: t.r + r, f: t.f + f, h: t.h + h });
  Object.assign(P.summe, { punkte: P.summe.punkte + punkte, hasanat: P.summe.hasanat + hasanat, r: P.summe.r + r, f: P.summe.f + f, h: P.summe.h + h, abschnitte: P.summe.abschnitte + 1 });
  const ereignisse = [];
  // Zyklus / Ḫatma
  if (art !== 'frei' && !P.zyklus.erledigt.includes(id)) {
    P.zyklus.erledigt.push(id);
    if (reihe().every(x => P.zyklus.erledigt.includes(x))) {
      P.zyklus.khatma++; P.zyklus.erledigt = []; P.zyklus.beginn = datum; (P.meilenD ??= {})['khatma-' + P.zyklus.khatma] = datum;
      if (!P.einst.bereich) P.zyklus.voll = (P.zyklus.voll || 0) + 1;   // Ḫatma über den ganzen Qurʾān
      ereignisse.push({ typ: 'khatma', n: P.zyklus.khatma });
    }
  }
  // Wird erfüllt → Kette
  const pflicht = t.plan.filter(x => t.art[x] !== 'bonus');
  if (!t.voll && pflicht.every(x => t.fertig.includes(x))) {
    t.voll = true;
    const z = P.kette.zuletzt, w1 = vorigerWirdTag(datum);
    if (z === datum) { /* schon gezählt */ }
    else if (z && z >= w1) P.kette.n++;
    else if (z && t.qadaa && z >= vorigerWirdTag(w1)) P.kette.n += 2;
    else P.kette.n = 1;
    P.kette.zuletzt = datum; P.kette.beste = Math.max(P.kette.beste, P.kette.n);
    ereignisse.push({ typ: 'wird' });
    for (const m of KETTEN_MEILEN) if (P.kette.n >= m && !P.meilen.includes('kette-' + m)) { P.meilen.push('kette-' + m); P.meilenD['kette-' + m] = datum; ereignisse.push({ typ: 'kette', n: m }); }
  }
  // Ornamente: ganze Sūra gefestigt / mutqan (alle Sūren, die der Abschnitt berührt, auch in Sammelkarten)
  ornamentePruefen(Array.from({ length: e.bis[0] - e.von[0] + 1 }, (_, i) => e.von[0] + i), datum, ereignisse);
  if (k.st > vorher) ereignisse.push({ typ: 'stufe', st: k.st });
  // Rang: neu erreicht, wenn er höher ist als der bisher höchste
  const rg = rangJetzt();
  if (rg > (P.rangBeste?.r ?? 0)) { P.rangBeste = { r: rg, d: datum }; ereignisse.push({ typ: "rang", r: rg }); }
  speichern();
  return { punkte, teile, hasanat, r, f, h, ereignisse, stufe: k.st, vorher };
}

// ---------- Ornamente: eines je Sūra, sobald alle ihre Abschnitte gefestigt sind; vergoldet, wenn alle mutqan sind ----------
export const sureAbschnitte = s => D.A.filter(x => x.von[0] <= s && x.bis[0] >= s);
function ornamentePruefen(suren, datum, ereignisse) {
  for (const s of suren) {
    const ids = sureAbschnitte(s).map(x => x.id);
    if (!ids.length || !ids.every(imBereich)) continue;   // nur Sūren, die ganz im eigenen Bereich liegen
    for (const [st, name] of [[2, 'gefestigt'], [4, 'mutqan']]) {
      const key = `sure-${name}-${s}`;
      if (!P.meilen.includes(key) && ids.every(x => karte(x).st >= st)) { P.meilen.push(key); (P.meilenD ??= {})[key] = datum; ereignisse?.push({ typ: 'ornament', s, stufe: name }); }
    }
  }
}
// verpasste Ornamente nachtragen (früher bekamen Sūren in Sammelkarten keines)
export function ornamenteNachtragen() {
  const n = P.meilen.length;
  ornamentePruefen(Array.from({ length: 114 }, (_, i) => i + 1), heute());
  if (P.meilen.length !== n) speichern();
}
export function ornamentStand(s) {
  const ids = sureAbschnitte(s).map(x => x.id), st = ids.map(x => karte(x).st);
  const g = `sure-gefestigt-${s}`, m = `sure-mutqan-${s}`;
  return { gesamt: ids.length, imBereich: ids.every(imBereich), gefestigt: st.filter(x => x >= 2).length, mutqan: st.filter(x => x >= 4).length,
    stufe: P.meilen.includes(m) ? 4 : P.meilen.includes(g) ? 2 : 0, datum: P.meilenD?.[m] || P.meilenD?.[g] || null, erst: P.meilenD?.[g] || null };
}

// ---------- Ränge (Stufen des Itqān) ----------
// Bedingungen: punkte (Itqān-Punkte gesamt), kette (längste Kette), khatma (Runden im eigenen Bereich),
// ganz (ganzer Qurʾān gewählt), voll (Ḫatmāt über den ganzen Qurʾān), quote (% der Āyāt beim letzten Durchgang
// ohne Fehler und ohne Hilfe, gemessen über den ganzen gewählten Bereich), st2/st3/st4 (% der Abschnitte
// mindestens gefestigt / sicher / mutqan), offen0 (keine Fehlerwiederholung offen)
export const RAENGE = [
  { n: 'Mubtadiʾ', ar: 'مُبْتَدِئ', de: 'der Beginnende', hifz: 'Du hast mit der geordneten Murāǧaʿa begonnen. Gemessen wird noch nichts, jeder Anfang zählt.', b: {} },
  { n: 'Murīd', ar: 'مُرِيد', de: 'der Wollende, der Strebende', hifz: 'Die Absicht ist gefasst und durch Taten bestätigt. Die ersten Abschnitte sind wiederholt.', b: { punkte: 1000 } },
  { n: 'Muwāẓib', ar: 'مُوَاظِب', de: 'der Beständige', hifz: 'Die Wiederholung hat einen festen Platz im Tag. Eine ganze Woche ohne Unterbrechung.', b: { punkte: 5000, kette: 7 } },
  { n: 'Mutaʿāhid', ar: 'مُتَعَاهِد', de: 'der, der den Qurʾān pflegt', hifz: 'Nach dem Ḥadīṯ „Taʿāhadū hāḏā l-Qurʾān“: Er entkommt leichter als Kamele aus ihren Fußfesseln, darum pflegt man ihn. Vierzig Tage Beständigkeit, die Murāǧaʿa ist zur Gewohnheit geworden.', b: { punkte: 15000, kette: 40 } },
  { n: 'Murābiṭ', ar: 'مُرَابِط', de: 'der auf seinem Posten Ausharrende', hifz: 'Du hältst deinen Bereich gegen das Vergessen. Drei von vier Āyāt sitzen beim letzten Durchgang.', b: { punkte: 30000, quote: 75 } },
  { n: 'Ḫātim', ar: 'خَاتِم', de: 'der Vollendende', hifz: 'Eine ganze Runde durch deinen Bereich ist vollbracht. Mehr als vier von fünf Āyāt kommen ohne Fehler.', b: { punkte: 60000, khatma: 1, quote: 85 } },
  { n: 'Mustaḥḍir', ar: 'مُسْتَحْضِر', de: 'der den Qurʾān gegenwärtig hat', hifz: 'Der ganze Qurʾān ist einmal vollständig wiederholt. Du findest in jede Stelle hinein, auch wenn es noch manchmal stockt.', b: { punkte: 100000, ganz: 1, voll: 1, quote: 88 } },
  { n: 'Ḍābiṭ', ar: 'ضَابِط', de: 'der Genaue', hifz: 'Ḍabṭ heißt in den Ḥadīṯwissenschaften das genaue Bewahren des Wortlauts. Fehler sind Einzelfälle, die Hälfte aller Abschnitte ist gefestigt.', b: { punkte: 180000, ganz: 1, voll: 2, quote: 92, st2: 50 } },
  { n: 'Ḥāḏiq', ar: 'حَاذِق', de: 'der Geübte, der Kundige', hifz: 'In den alten Qurʾānschulen hieß der Abschluss des Auswendiglernens Ḥiḏāq. Alle Teile sitzen, ähnliche Stellen (Mutašābihāt) werden meist sicher unterschieden.', b: { punkte: 270000, ganz: 1, voll: 3, quote: 94, st2: 75 } },
  { n: 'Rāsiḫ', ar: 'رَاسِخ', de: 'der fest Verwurzelte', hifz: 'Wie „ar-rāsiḫūna fī l-ʿilm“ (3:7). Fehler sind selten, die Hälfte aller Abschnitte ist mehrere Runden in Folge fehlerfrei.', b: { punkte: 360000, ganz: 1, voll: 4, quote: 96, st3: 50 } },
  { n: 'Mutqin', ar: 'مُتْقِن', de: 'der Meisterhafte', hifz: 'Vom selben Stamm wie Itqān. Der Qurʾān sitzt fast überall ohne Fehler, ein Drittel der Abschnitte ist schon vier Runden in Folge fehlerfrei.', b: { punkte: 450000, ganz: 1, voll: 5, quote: 98, st3: 80, st4: 30 } },
  { n: 'Ṯabt', ar: 'ثَبْت', de: 'der Verlässliche', hifz: 'Ṯiqa ṯabt ist das höchste Lob für einen Überlieferer. Auf jede deiner Rezitationen ist Verlass, drei Viertel aller Abschnitte sind vier Runden in Folge fehlerfrei.', b: { punkte: 630000, ganz: 1, voll: 7, quote: 99, st4: 75 } },
  { n: 'Mutqin Muṭlaq', ar: 'مُتْقِنٌ مُطْلَق', de: 'der uneingeschränkt Meisterhafte', hifz: 'Jede Stelle des ganzen Qurʾān sitzt ohne Fehler und ohne Hilfe. Jeder Abschnitt war in den letzten vier Durchgängen fehlerfrei, keine Fehlerwiederholung steht offen.', b: { punkte: 900000, ganz: 1, voll: 10, quote: 100, st4: 100, offen0: 1 } }
];
export function kennzahlen() {
  const ids = reihe(); let ay = 0, ok = 0, offen = 0; const st = [0, 0, 0, 0, 0];
  for (const id of ids) {
    const e = D.A[id], k = karte(id);
    ay += e.ayat; if (k.n) ok += e.ayat - (k.fa?.length || 0);
    st[k.st]++; if (k.fae) offen++;
  }
  const ab = x => ids.length ? 100 * st.slice(x).reduce((a, b) => a + b, 0) / ids.length : 0;
  return { punkte: P.summe.punkte, kette: P.kette.beste, khatma: P.zyklus.khatma, voll: P.zyklus.voll || 0, ganz: P.einst.bereich ? 0 : 1,
    quote: ay ? 100 * ok / ay : 0, st2: ab(2), st3: ab(3), st4: ab(4), offen };
}
const BED = {
  punkte: (s, z) => [`${s.toLocaleString('de-DE')} Itqān-Punkte`, z.punkte, s],
  kette: (s, z) => [`${s} Tage Kette (längste)`, z.kette, s],
  khatma: (s, z) => [`${s} ${s === 1 ? 'Runde' : 'Runden'} durch deinen Bereich`, z.khatma, s],
  ganz: (s, z) => ['Ganzer Qurʾān gewählt (alle 30 Aǧzāʾ)', z.ganz, 1],
  voll: (s, z) => [`${s} ${s === 1 ? 'Ḫatma' : 'Ḫatmāt'} über den ganzen Qurʾān`, z.voll, s],
  quote: (s, z) => [`${s} % fehlerfrei beim letzten Durchgang`, Math.floor(z.quote * 10) / 10, s],
  st2: (s, z) => [`${s} % der Abschnitte mindestens gefestigt`, Math.floor(z.st2), s],
  st3: (s, z) => [`${s} % der Abschnitte mindestens sicher`, Math.floor(z.st3), s],
  st4: (s, z) => [`${s} % der Abschnitte mutqan`, Math.floor(z.st4), s],
  offen0: (s, z) => ['Keine Fehlerwiederholung offen', z.offen ? 0 : 1, 1]
};
// je Bedingung: { text, ist, soll, ok }
export function bedingungen(i, z = kennzahlen()) {
  return Object.entries(RAENGE[i].b).map(([k, s]) => { const [text, ist, soll] = BED[k](s, z); return { k, text, ist, soll, ok: ist >= soll }; });
}
export function rangJetzt(z = kennzahlen()) {
  let r = 0;
  for (let i = 1; i < RAENGE.length; i++) { if (bedingungen(i, z).every(b => b.ok)) r = i; else break; }
  return r;
}

// ---------- Auswertungen ----------
export function seitenStufe(p) {
  const ids = D.A.filter(e => e.seiten.includes(p) && imBereich(e.id));
  if (!ids.length) return null;
  const ks = ids.map(e => karte(e.id)).filter(k => k.n);
  if (!ks.length) return 0;
  return ks.reduce((s, k) => s + k.st + 0.6, 0) / ids.length;
}
export function letzteTage(n = 30) {
  const aus = [];
  for (let i = n - 1; i >= 0; i--) { const d = plusTage(heute(), -i); aus.push({ d, t: P.tage[d] || null }); }
  return aus;
}
// Auswertung: Fehlerarten, Sūren, Quote, Zeit
export function auswertung(tage = 30) {
  const arten = FEHLERARTEN.map(([w, l]) => ({ art: w, name: l, n: P.statistik?.arten?.[w] || 0 }));
  const getippt = arten.reduce((s, x) => s + x.n, 0);
  // Sūren: letzter Durchgang je Abschnitt, Āya für Āya der jeweiligen Sūra zugeordnet
  const su = new Map();
  for (const [id, k] of Object.entries(P.karten)) {
    if (!k.n || !imBereich(+id)) continue;
    const e = D.A[+id], fa = new Set(k.fa || []);
    for (let vi = e.v[0]; vi <= e.v[1]; vi++) {
      const s = D.V[vi][0], x = su.get(s) || { s, ayat: 0, sicher: 0 };
      x.ayat++; if (!fa.has(vi)) x.sicher++; su.set(s, x);
    }
  }
  const suren = [...su.values()].map(x => ({ ...x, quote: 100 * x.sicher / x.ayat })).sort((a, b) => a.quote - b.quote || b.ayat - a.ayat || a.s - b.s);
  // Quote: letzter Durchgang über den Bereich, dazu je Woche (die letzten 8, Āyāt ohne Fehler und ohne Hilfe)
  const wochen = [];
  for (let w = 7; w >= 0; w--) {
    let r = 0, f = 0, h = 0;
    for (let i = 0; i < 7; i++) { const t = P.tage[plusTage(heute(), -(w * 7 + i))]; if (t) { r += t.r; f += t.f; h += t.h; } }
    wochen.push({ bis: plusTage(heute(), -w * 7), ayat: r + f + h, quote: r + f + h ? 100 * r / (r + f + h) : null });
  }
  // Zeit: gemessene Übungen der letzten Tage
  let zeit = 0, zn = 0, za = 0;
  for (let i = 0; i < tage; i++) { const t = P.tage[plusTage(heute(), -i)]; if (t?.zn) { zeit += t.zeit; zn += t.zn; za += t.za; } }
  const langsam = Object.entries(P.karten).filter(([id, k]) => k.z && imBereich(+id))
    .map(([id, k]) => ({ id: +id, z: k.z, jeZeile: k.z / D.A[+id].zeilen })).sort((a, b) => b.jeZeile - a.jeZeile).slice(0, 5);
  const geprueft = suren.reduce((s, x) => s + x.ayat, 0), sicher = suren.reduce((s, x) => s + x.sicher, 0);
  return { arten, ohneArt: Math.max(0, P.summe.f - getippt), suren, quote: kennzahlen().quote, quoteGeprueft: geprueft ? 100 * sicher / geprueft : null, geprueft, wochen,
    zeit: { summe: zeit, abschnitte: zn, ayat: za, jeAbschnitt: zn ? zeit / zn : null, jeAya: za ? zeit / za : null, langsam } };
}
export function schwaechste(n = 8) {
  return Object.entries(P.karten).filter(([id, k]) => k.n && imBereich(+id))
    .map(([id, k]) => ({ id: +id, k, w: schwachWert(k) }))
    .sort((a, b) => b.w - a.w).slice(0, n);
}
export function khatmaFortschritt() {
  const r = reihe(); const erl = new Set(P.zyklus.erledigt);
  const zeilen = r.reduce((s, id) => s + D.A[id].zeilen, 0), fertig = r.filter(id => erl.has(id)).reduce((s, id) => s + D.A[id].zeilen, 0);
  return { anteil: zeilen ? fertig / zeilen : 0, fertig: r.filter(id => erl.has(id)).length, gesamt: r.length };
}
// Dauer einer Ḫatma in Tagen; mit Regler: Zuschlag für das Festigen (Simulation: etwa 1,1 × Anteil)
export function tageProKhatma(mitRegler = false) {
  const woche = P.einst.pensum.reduce((a, b) => a + b, 0) / 7;
  return Math.ceil(reihe().length / Math.max(0.1, woche) * (mitRegler ? 1 + 1.1 * (SCHWAECHEN[P.einst.schwaechen] ?? 0) : 1));
}

// ---------- Rückblick: eine Woche (Montag bis Sonntag) oder ein Kalendermonat in Zahlen ----------
// versatz: 0 = der laufende Zeitraum, 1 = der davor und so weiter
export function zeitraum(art = 'woche', versatz = 0, bezug = heute()) {
  if (art === 'monat') {
    const [y, m] = bezug.split('-').map(Number);
    return { art, von: heute(new Date(y, m - 1 - versatz, 1)), bis: heute(new Date(y, m - versatz, 0)) };
  }
  const von = plusTage(bezug, -wochentag(bezug) - 7 * versatz);
  return { art: 'woche', von, bis: plusTage(von, 6) };
}
// Stand eines Tages: voll (Wird erfüllt), teil (geübt, Wird nicht erfüllt), aus (Wird-Tag ohne Übung),
// nach (nicht erfüllt, am nächsten Wird-Tag als Qaḍāʾ nachgeholt: die Kette zählt ihn mit),
// ruhe (Ruhetag oder Pause), offen (heute noch nichts oder Zukunft), vor (vor dem Beginn des Profils)
function nachgeholt(d, h) {
  for (let i = 1; i <= 60; i++) {
    const e = plusTage(d, i), t = P.tage[e];
    if (e > h) return false;
    if (t ? t.ruhe && !t.fertig.length : ruhetag(e)) continue;
    return !!(t && t.qadaa && t.voll);
  }
  return false;
}
function tagStand(d, h, beginn) {
  const t = P.tage[d];
  if (t?.fertig.length && (t.voll || d === h)) return t.voll ? 'voll' : 'teil';
  if (d > h) return 'offen';
  if (!t?.fertig.length) {
    if (d < beginn) return 'vor';
    if (t ? t.ruhe : ruhetag(d)) return 'ruhe';
    if (d === h) return 'offen';
  }
  return nachgeholt(d, h) ? 'nach' : t?.fertig.length ? 'teil' : 'aus';
}
function zeitraumZahlen(von, bis) {
  const h = heute(), beginn = heute(new Date(P.erstellt)), tage = [];
  const z = { ayat: 0, r: 0, f: 0, h: 0, punkte: 0, hasanat: 0, abschnitte: 0, zeilen: 0, zeit: 0, geuebt: 0, voll: 0, nach: 0, wird: 0, folge: 0 };
  let lauf = 0;
  for (let d = von; d <= bis; d = plusTage(d, 1)) {
    const t = P.tage[d], stand = tagStand(d, h, beginn), ayat = t?.fertig.length ? t.r + t.f + t.h : 0;
    if (ayat || t?.fertig.length) {
      z.geuebt++; z.r += t.r; z.f += t.f; z.h += t.h; z.punkte += t.punkte; z.hasanat += t.hasanat; z.zeit += t.zeit || 0;
      z.abschnitte += t.fertig.length; z.zeilen += t.fertig.reduce((s, id) => s + (D.A[id]?.zeilen || 0), 0);
    }
    if (stand === 'voll' || stand === 'nach') { z.voll++; lauf++; z.folge = Math.max(z.folge, lauf); if (stand === 'nach') z.nach++; }
    else if (stand === 'aus' || (stand === 'teil' && d < h)) lauf = 0;
    if (stand === 'voll' || stand === 'nach' || stand === 'teil' || stand === 'aus') z.wird++;
    tage.push({ d, stand, ayat, punkte: t?.punkte || 0 });
  }
  z.ayat = z.r + z.f + z.h;
  z.quote = z.ayat ? 100 * z.r / z.ayat : null;      // Āyāt ohne Fehler und ohne Hilfe
  z.seiten = z.zeilen / 15;
  return { ...z, tage };
}
// Rückblick über einen Zeitraum. neu: was in diesem Zeitraum erreicht wurde. vor: dieselben Zahlen des Zeitraums davor.
export function rueckblick(art = 'woche', versatz = 0) {
  const { von, bis } = zeitraum(art, versatz), h = heute(), z = zeitraumZahlen(von, bis);
  const v = zeitraum(art, versatz + 1), vz = zeitraumZahlen(v.von, v.bis);
  const drin = d => !!d && d >= von && d <= bis, md = Object.entries(P.meilenD || {}).filter(([, d]) => drin(d)).map(([k]) => k);
  const neu = {
    ornamente: md.filter(k => k.startsWith('sure-gefestigt-')).length,
    vergoldet: md.filter(k => k.startsWith('sure-mutqan-')).length,
    kette: Math.max(0, ...md.filter(k => k.startsWith('kette-')).map(k => +k.slice(6))),
    khatma: md.filter(k => k.startsWith('khatma-')).length,
    rang: drin(P.rangBeste?.d) ? P.rangBeste.r : 0
  };
  const beste = z.tage.reduce((a, t) => t.ayat > (a?.ayat || 0) ? t : a, null);
  return { art, versatz, von, bis, laufend: bis >= h, ...z, leer: z.geuebt === 0,
    kette: bis >= h ? (ketteAktiv() ? P.kette.n : 0) : null, bester: beste ? { d: beste.d, ayat: beste.ayat } : null, neu,
    vor: { von: v.von, bis: v.bis, ayat: vz.ayat, quote: vz.quote, geuebt: vz.geuebt, abschnitte: vz.abschnitte },
    frueher: von > heute(new Date(P.erstellt)) };   // es gibt einen Zeitraum davor, in dem das Profil schon bestand
}

// Auswertung eines fremden Profils (Lehreransicht), ohne das eigene zu verändern
export function mitProfil(profil, fn) { const eigenes = P; P = profil; try { return fn(); } finally { P = eigenes; } }

// ---------- Profildatei (Sicherung und Lehreransicht) ----------
async function pruefsumme(text) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export async function exportDatei(profil = P) {
  const daten = JSON.stringify(profil);
  return JSON.stringify({ format: 'itqan-profil', version: 1, exportiert: uhr().toISOString(), pruef: await pruefsumme(daten), profil }, null, 0);
}
export async function importDatei(text) {
  const o = JSON.parse(text);
  if (o.format !== 'itqan-profil' || !o.profil || o.profil.format !== 'itqan') throw new Error('Keine Itqān-Profildatei');
  const echt = (await pruefsumme(JSON.stringify(o.profil))) === o.pruef;
  return { profil: o.profil, echt, exportiert: o.exportiert };
}
