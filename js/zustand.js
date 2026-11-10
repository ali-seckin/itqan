// Itqān · Profil, Tagesplan (Wird), Karteisystem, Punkte, Kette
import { D, gliederungVon } from './daten.js';
import { tx, gebiet } from './sprache.js';

const SCHLUESSEL = 'itqan-profil-v1';
export const STUFEN = [tx('allg.neu'), tx('zustand.im_aufbau'), tx('allg.gefestigt'), tx('allg.sicher'), tx('allg.mutqan')];
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

// ---------- Speicher ----------
// Austauschbar: im Browser localStorage, in der App-Hülle später der Gerätespeicher (gleiche drei Aufrufe).
const SPEICHER_STANDARD = { lesen: k => localStorage.getItem(k), schreiben: (k, v) => localStorage.setItem(k, v), entfernen: k => localStorage.removeItem(k) };
let speicher = SPEICHER_STANDARD;
export function speicherSetzen(s) { speicher = s || SPEICHER_STANDARD; geraet = null; }
const kopie = x => x === undefined ? undefined : JSON.parse(JSON.stringify(x));

// ---------- Laden / Speichern ----------
export function laden() {
  try { const t = speicher.lesen(SCHLUESSEL); if (t) P = JSON.parse(t); } catch (e) { P = null; }
  if (P) ergaenzen(P);
  schattenNeu();
  return P;
}
// ältere Profile um neue Felder ergänzen
export function ergaenzen(p) {
  p.einst.zufall ??= 'einzeln'; p.einst.vorueben ??= true; p.fstellen ??= {};
  if (!['v1', 'v2'].includes(p.einst.ausgabe)) p.einst.ausgabe = 'v2';   // frühere Mischform wird Druck 1421
  p.einst.modus ??= 'fort'; p.gliederung ??= 'fort-1'; p.meilenD ??= {};
  p.einst.sofort ??= true; p.einst.abhoeren ??= true;
  // Tageswechsel: Vorgabe 3 Uhr (Entscheidung 10.11.2026). Wer noch die alte Vorgabe Mitternacht hat, wird einmal umgestellt, danach gilt die eigene Wahl.
  if (!p.einst.tb3) { if (!p.einst.tagesbeginn) p.einst.tagesbeginn = 3; p.einst.tb3 = 1; }
  p.einst.schwaechen ??= 'ausgewogen'; p.pausen ??= []; p.zyklus.konto ??= 0; p.mutash ??= {};
  p.lern ??= {}; p.statistik ??= { arten: artenAusStellen(p.fstellen) };
  p.einst.seitenGroesse ??= 100; p.einst.textGroesse ??= 100;   // Lesbarkeit: Seite 100, 125, 150 %; Schrift 100, 112, 125 %
  // Protokoll: Sockel (Generation, Zeit, Gerät) und Liste der Einträge seit dem Sockel
  p.sockel ??= { n: 1, z: Date.parse(p.erstellt) || 0, g: '' }; p.log ??= [];
  return p;
}
export function speichern() {
  if (fremd) return;    // ein fremdes Profil (Lehreransicht, Nachbau) wird nie gespeichert
  einstAbgleichen();
  try { speicher.schreiben(SCHLUESSEL, JSON.stringify(P)); } catch (e) { console.warn('Speichern fehlgeschlagen', e); }
}
export function neuesProfil({ name = '', pensum = 3, reihenfolge = 'vorwaerts', bereich = null, thema = 'auto', modus = 'fort' } = {}) {
  P = {
    format: 'itqan', version: 1, erstellt: uhr().toISOString(), name,
    einst: { pensum: Array(7).fill(pensum), reihenfolge, bereich, thema, erinnerung: '05:30', hilfe: true, zufall: 'einzeln', vorueben: true, ausgabe: 'v2', modus, seitenGroesse: 100, textGroesse: 100 }, gliederung: gliederungVon(modus, 'v2')?.name || 'fort-2',
    karten: {}, zyklus: { erledigt: [], khatma: 0, beginn: heute() },
    tage: {}, kette: { n: 0, beste: 0, zuletzt: null }, summe: { punkte: 0, hasanat: 0, r: 0, f: 0, h: 0, abschnitte: 0 },
    meilen: [], meilenD: {}, fstellen: {}, pausen: [], statistik: { arten: {} }, mutash: {}
  };
  P.einst.schwaechen = 'ausgewogen'; P.zyklus.konto = 0;
  ergaenzen(P); P.sockel.n = 0;    // ein neues Profil hat sofort alle Felder, nicht erst nach dem nächsten Laden
  sockelWechsel();
  speichern(); return P;
}
// stand: Zeitpunkt, zu dem der geladene Stand entstanden ist (bei einer Sicherung der Zeitpunkt des Sicherns).
// Einträge anderer Geräte, die danach entstanden sind, lassen sich später in diesen Stand holen (umziehen).
export function ersetzeProfil(neu, stand) { P = ergaenzen(neu); sockelWechsel(stand); speichern(); }
// Einen Stand unverändert übernehmen (nach dem Zusammenführen, später nach dem Abgleich mit dem Server):
// kein neuer Sockel, log sind die Einträge, die noch nicht abgeglichen sind.
export function standUebernehmen(profil, log = []) { P = ergaenzen(kopie(profil)); P.log = kopie(log); schattenNeu(); speichern(); return P; }

// ---------- Protokoll (Beschreibung: konzept/datenmodell.md) ----------
// Jede Änderung am Lernstand ist ein Eintrag { i: 'Gerät-Zähler', z: Zeit in ms, y: Art, ... }.
// Der Lernstand ergibt sich aus dem Sockel und den Einträgen in der Reihenfolge (z, i). Zwei Geräte legen ihre
// Einträge zusammen und bauen den Stand neu auf: so geht beim Zusammenführen nichts verloren.
// Arten: pl Tagesplan, pa Pensum heute, ab Abschnitt abgeschlossen, fm Fehlerstellen gemerkt, fl Fehlerstelle gelöscht,
// fg Fehlerstelle geübt, mu Mutašābih unterschieden, pb Pause beginnt, pe Pause endet, on Ornamente nachgetragen,
// rk Rücknahme, ei Einstellung.
const GERAET = 'itqan-geraet', LOG_GRENZE = 300;
let geraet = null, fremd = 0, schatten = null, grenze = LOG_GRENZE;
export function logGrenze(n) { grenze = n > 0 ? n : LOG_GRENZE; }
function geraetLesen() {
  if (geraet) return geraet;
  try { const g = JSON.parse(speicher.lesen(GERAET) || 'null'); if (g && typeof g.g === 'string' && g.g) geraet = { g: g.g, n: g.n || 0, z: g.z || 0 }; } catch (e) {}
  if (!geraet) {
    geraet = { g: [...crypto.getRandomValues(new Uint8Array(6))].map(x => (x % 36).toString(36)).join(''), n: 0, z: 0 };
    geraetSichern();
  }
  return geraet;
}
function geraetSichern() { try { speicher.schreiben(GERAET, JSON.stringify(geraet)); } catch (e) {} }
export function geraetSetzen(g) { geraet = { g, n: 0, z: 0 }; geraetSichern(); }
export const geraetKennung = () => geraetLesen().g;
// Kennung und Zeit eines neuen Eintrags. Die Zeit läuft je Gerät nie rückwärts, der Zähler hat feste Breite:
// so bleibt die Reihenfolge eines Geräts auch bei verstellter Uhr erhalten.
function marke() {
  const g = geraetLesen(); g.n++; g.z = Math.max(uhr().getTime(), g.z);
  return { i: g.g + '-' + g.n.toString(36).padStart(6, '0'), z: g.z };
}
function logAnhaengen(e) {
  (P.log ??= []).push(e);
  if (P.log.length > grenze) P.log.splice(0, P.log.length - grenze);
}
// Neuer Sockel: neues Profil, geladene Sicherung, zurückgeholter Schnappschuss, Wechsel der Gliederung.
// Die höhere Generation gewinnt, ihre Einträge beginnen von vorn.
function sockelWechsel(stand) {
  const g = geraetLesen(); g.z = Math.max(uhr().getTime(), g.z);
  const z = Date.parse(stand ?? '');
  P.sockel = { n: (P.sockel?.n || 0) + 1, z: z > 0 && z < g.z ? z : g.z, g: g.g }; P.log = [];
  schattenNeu(); geraetSichern();
}
export const sockelNeuer = (a, b) => (a.n - b.n || a.z - b.z || (a.g < b.g ? -1 : a.g > b.g ? 1 : 0)) > 0;
// Einstellungen (Name und einst.*) schreibt die Oberfläche direkt. Ein Schattenbild erkennt die Änderungen
// und legt je geändertem Wert einen Eintrag an. Beim Zusammenführen gilt der spätere Wert.
const einstBild = p => { const b = { name: JSON.stringify(p.name ?? '') }; for (const [k, w] of Object.entries(p.einst || {})) if (w !== undefined) b['einst.' + k] = JSON.stringify(w); return b; };
function schattenNeu() { schatten = P ? einstBild(P) : null; }
function einstAbgleichen() {
  if (fremd || !P) return;
  if (!schatten) { schattenNeu(); return; }
  const neu = einstBild(P); let n = 0;
  for (const k of new Set([...Object.keys(schatten), ...Object.keys(neu)])) {
    if (schatten[k] === neu[k]) continue;
    logAnhaengen({ ...marke(), y: 'ei', k, ...(k in neu ? { w: JSON.parse(neu[k]) } : {}) }); n++;
  }
  schatten = neu; if (n) geraetSichern();
}
// Der einzige Weg, den Lernstand zu ändern: Eintrag bilden, anwenden, anhängen, speichern.
function eintrag(y, daten, extra) {
  if (fremd) return anwenden({ y, ...daten }, extra);
  einstAbgleichen();
  const e = { ...marke(), y, ...daten };
  const erg = anwenden(e, extra);
  if (y === 'ab' && erg.ereignisse.some(x => x.typ === 'wird')) e.w = 1;   // dieser Abschluss hat den Wird erfüllt
  logAnhaengen(e); geraetSichern(); speichern();
  return erg;
}
// Wendet einen Eintrag auf P an. Rechnet nur mit den Daten des Eintrags, nie mit der Uhr.
function anwenden(e, extra) {
  switch (e.y) {
    case 'pl': return planAnwenden(e);
    case 'pa': return pensumAnwenden(e);
    case 'ab': return abschlussAnwenden(e);
    case 'fm': return merkenAnwenden(e);
    case 'fl': delete P.fstellen[e.s]; return;
    case 'fg': return geuebtAnwenden(e);
    case 'mu': return unterscheidenAnwenden(e);
    case 'pb': return pauseBeginnAnwenden(e);
    case 'pe': return pauseEndeAnwenden(e);
    case 'on': ornamentePruefen(Array.from({ length: 114 }, (_, i) => i + 1), e.d); return;
    case 'lb': if (!(P.lern ??= {})[e.id]) P.lern[e.id] = { b: e.d, ph: 0, ft: [], s: 0 }; return;
    case 'lx': if (P.lern?.[e.id]?.ph < 2) delete P.lern[e.id]; return;
    case 'rk': return ruecknahmeAnwenden(extra?.stand);
    case 'ei':
      if (e.k === 'name') P.name = e.w ?? '';
      else if (e.k.startsWith('einst.')) { if ('w' in e) P.einst[e.k.slice(6)] = kopie(e.w); else delete P.einst[e.k.slice(6)]; }
      return;
  }
}
const ordnung = (a, b) => a.z - b.z || (a.i < b.i ? -1 : a.i > b.i ? 1 : 0);
// Stand aus Sockel und Einträgen neu aufbauen. Zurückgenommene Einträge (rk) werden übersprungen.
// D muss zur Gliederung des Sockels passen.
export function nachbau(sockel, eintraege) {
  const p = ergaenzen(kopie(sockel)); p.log = [];
  const weg = new Set(eintraege.filter(e => e.y === 'rk').flatMap(e => e.ids || []));
  const liste = eintraege.filter(e => !weg.has(e.i)).sort(ordnung);
  return mitProfil(p, () => { for (const e of liste) anwenden(e); return p; });
}
// Zwei oder mehr Gerätestände mit demselben Sockel: Einträge vereinen (jede Kennung einmal), Stand neu aufbauen.
export function zusammenfuehren(sockel, ...logs) {
  const alle = new Map();
  for (const l of logs) for (const e of l) if (!alle.has(e.i)) alle.set(e.i, e);
  const log = [...alle.values()].sort(ordnung);
  return { profil: nachbau(sockel, log), log };
}
// Einträge einer älteren Generation in die neuere holen: nur was nach dem neuen Sockel entstanden ist.
// Abschlüsse werden über ihren Āya-Bereich dem heutigen Abschnitt zugeordnet, Pläne entstehen neu.
export function umziehen(eintraege, profilNeu) {
  const ab = profilNeu.sockel?.z ?? 0, uebernommen = [], offen = []; let verworfen = 0;
  for (const e of eintraege) {
    if (e.z <= ab || e.y === 'pl' || e.y === 'pa' || (e.y === 'ei' && e.k === 'einst.bereich')) { verworfen++; continue; }
    if (e.y !== 'ab' && e.y !== 'lb' && e.y !== 'lx') { uebernommen.push(e); continue; }
    const a = D.A.find(x => x.v[0] === e.v[0] && x.v[1] === e.v[1]);
    if (a) uebernommen.push({ ...e, id: a.id }); else offen.push(e);
  }
  return { uebernommen, offen, verworfen };
}

// ---------- Schnappschüsse: automatische Kopien des Profils auf diesem Gerät ----------
// Bis zu zwei tägliche und drei vor wichtigen Schritten (Gliederungswechsel, Laden einer Sicherung, Löschen).
// Sie schützen vor eigenen Fehlgriffen, nicht vor dem Löschen der App: dafür ist „Profil sichern“ da.
const SCHNAPP = 'itqan-schnappschuesse';
export function schnappschuesse() { try { return JSON.parse(speicher.lesen(SCHNAPP) || '[]'); } catch (e) { return []; } }
export function schnappschuss(grund) {
  if (!P) return false;
  const neu = { zeit: uhr().toISOString(), tag: heute(), grund, name: P.name, abschnitte: P.summe.abschnitte, daten: JSON.stringify({ ...P, log: [] }) };
  const alle = [neu, ...schnappschuesse()];
  let liste = [...alle.filter(x => x.grund === 'täglich').slice(0, 2), ...alle.filter(x => x.grund !== 'täglich').slice(0, 3)]
    .sort((a, b) => b.zeit.localeCompare(a.zeit));
  while (liste.length) { try { speicher.schreiben(SCHNAPP, JSON.stringify(liste)); return true; } catch (e) { liste = liste.slice(0, -1); } }
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
  P = ergaenzen(daten); sockelWechsel(); speichern(); return true;
}
// Kurzer Überblick über ein Profil, z. B. vor dem Laden einer Sicherung
export function profilUeberblick(p) {
  const tage = Object.entries(p.tage || {}).filter(([, t]) => t.fertig?.length).map(([d]) => d).sort();
  return { name: p.name || '', erstellt: p.erstellt, abschnitte: p.summe?.abschnitte || 0, punkte: p.summe?.punkte || 0,
    kette: p.kette?.n || 0, khatma: p.zyklus?.khatma || 0, letzterTag: tage.at(-1) || null, fstellen: Object.keys(p.fstellen || {}).length };
}
export function loeschen() { P = null; schatten = null; try { speicher.entfernen(SCHLUESSEL); } catch (e) {} }

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
  // Lektionen ziehen mit: bei mehreren alten Abschnitten gilt der schwächste Stand
  const altL = P.lern || {}; P.lern = {};
  neu.forEach((n, nid) => { const ls = M[nid].map(o => altL[o]).filter(Boolean); if (ls.length) P.lern[nid] = kopie(ls.reduce((a, b) => b.ph < a.ph ? b : a)); });
  P.gliederung = ziel; if (sichern && !fremd) { sockelWechsel(); speichern(); }
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
// Zum Bereich gehört auch, was auf dem Weg des Neulernens den Itqān erreicht hat
export function imBereich(id) { return !P.einst.bereich || P.einst.bereich.includes(id) || P.lern?.[id]?.ph === 2; }
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
  return eintrag('pb', { d: heute(), n: Math.max(1, Math.min(PAUSE_MAX, Math.round(tage))) });
}
function pauseBeginnAnwenden(e) {
  const tage = e.n, d = e.d, t = P.tage[d];
  const von = t && !t.ruhe && t.fertig.length ? plusTage(d, 1) : d;   // heute schon geübt: Pause ab morgen
  if (P.tage[von] && !P.tage[von].fertig.length) delete P.tage[von];
  const bis = plusTage(von, tage - 1);
  P.pausen = [...(P.pausen || []).filter(x => x.bis < von), { von, bis }].slice(-12);
  faeVerschieben(von, tage);
  return { von, bis };
}
export function pauseBeenden() {
  const d = heute(); if (!pauseJetzt(d)) return false;
  return eintrag('pe', { d });
}
function pauseEndeAnwenden(e) {
  const d = e.d, p = pauseJetzt(d); if (!p) return false;
  faeVerschieben(d, -(tageZwischen(d, p.bis) + 1));   // nicht genutzte Pausentage zurückgeben
  if (p.von >= d) P.pausen = P.pausen.filter(x => x !== p); else p.bis = plusTage(d, -1);
  if (P.tage[d]?.ruhe) delete P.tage[d];
  return true;
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
    eintrag('pl', { d: datum, t: { plan: [], art: {}, fertig: [], punkte: 0, hasanat: 0, r: 0, f: 0, h: 0, voll: false, qadaa: 0, ruhe: inPause(datum) ? 'pause' : 'ruhetag' } });
    return P.tage[datum];
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
  let konto = P.zyklus.konto || 0;    // der Plan wird erst berechnet, dann als Eintrag angewendet
  if (anteil > 0) {
    konto += n * anteil;
    const runde = tageProKhatma(), grenze = plusTage(datum, -Math.max(14, Math.round(runde / 4))), seit = plusTage(datum, -2 * runde);
    const platz = n + qadaa - plan.length - 1;    // mindestens ein Abschnitt der Runde bleibt
    const kand = Object.entries(P.karten).map(([id, k]) => [+id, k])
      .filter(([id, k]) => !plan.includes(id) && !k.fae && k.zul && k.zul <= grenze && istSchwach(k, seit) && imBereich(id))
      .sort((a, b) => schwachWert(b[1]) - schwachWert(a[1]) || a[1].zul.localeCompare(b[1].zul));
    const zahl = Math.max(0, Math.min(Math.floor(konto), platz, kand.length));
    for (const [id] of kand.slice(0, zahl)) { plan.push(id); art[id] = 'festigen'; }
    konto = kand.length > zahl ? konto - zahl : Math.min(konto - zahl, 1);   // ohne Kandidaten kein Stau
  }
  const naechste = naechsteImZyklus(n + qadaa - plan.length, new Set(plan), datum);
  naechste.forEach((id, i) => { plan.push(id); art[id] = i >= naechste.length - qadaa && qadaa ? 'qadaa' : 'zyklus'; });
  eintrag('pl', { d: datum, t: { plan, art, fertig: [], punkte: 0, hasanat: 0, r: 0, f: 0, h: 0, voll: false, qadaa, ...(frei ? { freiwillig: true } : {}) }, ...(anteil > 0 ? { k: konto } : {}) });
  return P.tage[datum];
}
// Tagesplan anwenden. Gibt es für den Tag schon einen Plan (zweites Gerät), bleibt der erste;
// nur ein Ruhetag-Eintrag weicht einem echten Plan („trotzdem üben“), was an dem Tag schon geübt wurde, bleibt stehen.
function planAnwenden(e) {
  const alt = P.tage[e.d], neu = kopie(e.t);
  if (alt && !(alt.ruhe && !neu.ruhe)) return;
  if (alt?.fertig.length) for (const f of ['fertig', 'punkte', 'hasanat', 'r', 'f', 'h', 'zeit', 'zn', 'za']) if (alt[f] != null) neu[f] = alt[f];
  P.tage[e.d] = neu;
  if (e.k != null) P.zyklus.konto = e.k;
  if (!neu.ruhe) aufraeumen(e.d);
}
// Tag für einen Abschluss, zu dem es keinen Plan gibt (Einträge aus einer älteren Generation)
function tagSicher(d) {
  return P.tage[d] ??= { plan: [], art: {}, fertig: [], punkte: 0, hasanat: 0, r: 0, f: 0, h: 0, voll: false, qadaa: 0, ohne: 1 };
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
  const d = heute(), t = tagesplan(d); const offen = t.plan.filter(id => !t.fertig.includes(id));
  const id = delta > 0 ? fortsetzung(t) : offen.length && t.plan.length > 1 ? offen[offen.length - 1] : null;
  if (id != null) eintrag('pa', delta > 0 ? { d, plus: id } : { d, minus: id }); else speichern();
  return P.tage[d];
}
function pensumAnwenden(e) {
  const t = P.tage[e.d]; if (!t) return;
  if (e.plus != null) { if (!t.plan.includes(e.plus)) { t.plan.push(e.plus); t.art[e.plus] = 'zyklus'; t.voll = false; } }
  else if (t.plan.includes(e.minus) && !t.fertig.includes(e.minus) && t.plan.length > 1) { t.plan = t.plan.filter(x => x !== e.minus); delete t.art[e.minus]; }
}
export function bonusVorschlag() { return fortsetzung(tagesplan()); }

// ---------- Fehlerstellen (einzelne Wörter) ----------
// P.fstellen['vi.i'] = { n: Anzahl, t: { Art: Anzahl }, d: zuletzt, m: { vi der verwechselten Āya: Anzahl } }
// P.statistik.vw['viA-viB'] = Anzahl: dauerhafte Zählung der Verwechslungen je Āya-Paar (Grundlage der lernenden Liste)
export const FEHLERARTEN = [['verwechslung', tx('zustand.verwechslung')], ['abweichung', tx('zustand.abweichung')], ['ausgelassen', tx('zustand.ausgelassen')], ['haraka', tx('zustand.haraka')], ['haenger', tx('zustand.haenger')]];
// kurze Erklärung, die beim Antippen einer Fehlerart erscheint
export const FEHLERARTEN_TEXT = {
  verwechslung: tx('zustand.mit_einer_aehnlichen_stelle_verwechselt'),
  abweichung: tx('zustand.kleine_abweichung_im_wort_z_b_ohne_waw'),
  ausgelassen: tx('zustand.ein_wort_oder_ein_stueck_uebersprungen'),
  haraka: tx('zustand.falscher_vokal_oder_falsches_zeichen'),
  haenger: tx('zustand.haengen_geblieben_erst_nach_einer_pause')
};
function artenAusStellen(fst) {
  const a = {}; for (const f of Object.values(fst || {})) for (const [x, n] of Object.entries(f.t || {})) a[x] = (a[x] || 0) + n;
  return a;
}
// je markierte Āya zählt die gewählte Fehlerart einmal (dauerhaft, auch wenn die Stelle später erledigt ist)
// mit: freiwillig die Āya (vi), mit der verwechselt wurde
export function fehlerstellenMerken(schluessel, art, mit) {
  if (!schluessel.length) { speichern(); return; }
  eintrag('fm', { d: heute(), w: [...schluessel], ...(art ? { a: art } : {}), ...(mit != null ? { m: mit } : {}) });
}
function merkenAnwenden(e) {
  P.statistik ??= { arten: {} };
  if (e.a) (P.statistik.arten ??= {})[e.a] = (P.statistik.arten[e.a] || 0) + 1;
  for (const s of e.w) {
    const f = P.fstellen[s] || { n: 0, t: {}, d: null };
    f.n++; f.d = e.d; if (e.a) f.t[e.a] = (f.t[e.a] || 0) + 1;
    if (e.m != null) (f.m ??= {})[e.m] = (f.m[e.m] || 0) + 1;
    P.fstellen[s] = f;
  }
  if (e.m != null) {
    const a = +e.w[0].split('.')[0], key = a <= e.m ? `${a}-${e.m}` : `${e.m}-${a}`;
    (P.statistik.vw ??= {})[key] = (P.statistik.vw[key] || 0) + 1;
  }
}
export function fehlerstelleLoeschen(s) { if (P.fstellen[s]) eintrag('fl', { s }); else speichern(); }
// Stand der Fehlerstellen merken und wiederherstellen (für „Vorige Āya neu bewerten“).
// m: Zähler dieses Geräts beim Merken. Die Rücknahme nennt alle danach gemerkten Fehlerstellen dieses Geräts,
// beim Nachbau werden sie übersprungen.
export const fehlerstellenStand = () => ({ ...kopie({ f: P.fstellen || {}, a: P.statistik?.arten || {}, vw: P.statistik?.vw }), m: geraetLesen().n });
export function fehlerstellenSetzen(stand) {
  stand = kopie(stand || {});
  const vor = geraetLesen().g + '-';
  const ids = stand.m == null ? [] : (P.log || []).filter(x => x.y === 'fm' && x.i.startsWith(vor) && parseInt(x.i.slice(vor.length), 36) > stand.m).map(x => x.i);
  eintrag('rk', { ids }, { stand });
}
function ruecknahmeAnwenden(stand) {
  if (!stand) return;    // beim Nachbau sind die zurückgenommenen Einträge schon übersprungen
  if (stand.f && stand.a) {
    P.fstellen = stand.f; (P.statistik ??= {}).arten = stand.a;
    if (stand.vw) P.statistik.vw = stand.vw; else delete P.statistik.vw;
  } else P.fstellen = stand;
}
// Mutašābihāt unterscheiden: je Paar (Schlüssel 'viA-viB') Anzahl, richtig, letztes Ergebnis, Tag
export function unterscheidenMerken(key, ok) { return eintrag('mu', { d: heute(), k: key, ok: ok ? 1 : 0 }); }
function unterscheidenAnwenden(e) {
  const x = (P.mutash ??= {})[e.k] || { n: 0, ok: 0 };
  x.n++; if (e.ok) x.ok++; x.letzt = e.ok ? 1 : 0; x.d = e.d;
  P.mutash[e.k] = x; return x;
}
// Abhören: jede Āya mit mindestens einem markierten Wort zählt als Fehler, alle anderen als richtig
export const abhoerErgebnis = (ayat, fehlerVi) => ayat.map(vi => fehlerVi.has(vi) ? 'fehler' : 'ok');

// ---------- Zwischenstand einer angefangenen Übung (gilt nur am selben Tag und für dieselbe Gliederung) ----------
const ZWISCHEN = 'itqan-zwischenstand';
export function zwischenstand() { try { const z = JSON.parse(speicher.lesen(ZWISCHEN) || 'null'); return z && z.tag === heute() && z.gliederung === D.gliederung ? z : null; } catch (e) { return null; } }
export function zwischenstandLaden(id, quelle = '') { const z = zwischenstand(); return z && z.id === id && (z.quelle || '') === (quelle || '') ? z : null; }
export function zwischenstandSpeichern(id, quelle, erg) { try { speicher.schreiben(ZWISCHEN, JSON.stringify({ id, quelle: quelle || '', erg, tag: heute(), gliederung: D.gliederung })); } catch (e) {} }
export function zwischenstandLoeschen() { try { speicher.entfernen(ZWISCHEN); } catch (e) {} }
// Gezieltes Üben einer Fehlerstelle: dreimal in Folge richtig, dann ist sie erledigt
export const STELLE_ZIEL = 3;
export function fehlerstelleGeuebt(vi, ergebnis) {
  if (!Object.keys(P.fstellen).some(s => +s.split('.')[0] === vi)) { speichern(); return { erledigt: 0, gut: 0, rest: 0 }; }
  return eintrag('fg', { vi, e: ergebnis === 'ok' ? 1 : 0 });
}
function geuebtAnwenden(e) {
  const keys = Object.keys(P.fstellen).filter(s => +s.split('.')[0] === e.vi);
  let erledigt = 0, gut = 0;
  for (const s of keys) {
    const f = P.fstellen[s];
    if (e.e) { f.gut = (f.gut || 0) + 1; gut = Math.max(gut, f.gut); if (f.gut >= STELLE_ZIEL) { delete P.fstellen[s]; erledigt++; } }
    else f.gut = 0;
  }
  return { erledigt, gut, rest: keys.length - erledigt };
}
export const fehlerstellenSet = () => new Set(Object.keys(P.fstellen || {}));
export function fehlerstellenListe(n = 12) {
  return Object.entries(P.fstellen || {}).map(([s, f]) => ({ s, vi: +s.split('.')[0], i: +s.split('.')[1], ...f }))
    .sort((a, b) => b.n - a.n || (b.d || '').localeCompare(a.d || '')).slice(0, n);
}
function aufraeumen(bezug) { // alte Tage verdichten, Statistik behalten
  for (const d of Object.keys(P.tage)) if (tageZwischen(d, bezug) > 400) delete P.tage[d];
}

// ---------- Neu lernen: Ḥifẓ, Ḍabṭ, Itqān ----------
// Eine Lektion ist ein Abschnitt außerhalb des Bereichs. P.lern[id] = { b: Beginn, ph: 0 Ḥifẓ | 1 Ḍabṭ | 2 Itqān,
// ft: Tage mit fehlerfreiem Durchgang (Ḥifẓ), s: fehlerfreie Durchgänge in Folge (Ḍabṭ), zul: letzter Durchgang,
// d: Tag des Übergangs in den Ḍabṭ, e: Tag des Itqān }. Fehlerfrei heißt: ohne Fehler und ohne Hilfe.
// Die drei Stufen sind das Dach über den fünf Schritten der Karte: Ḥifẓ = 0 und 1, Ḍabṭ = 2 und 3, Itqān = 4.
export const LERN = { hifzTage: 2, dabtSerie: 4 };
export const dach = st => st >= 4 ? 2 : st >= 2 ? 1 : 0;
export const lernbar = id => !!D.A[id] && !imBereich(id) && !P.lern?.[id];
// Offene Fehlerstellen eines Abschnitts (je Stelle die Āya)
export function offeneStellen(id) {
  const [a, b] = D.A[id].v;
  return Object.keys(P.fstellen || {}).map(s => +s.split('.')[0]).filter(v => v >= a && v <= b);
}
export function lernBeginnen(id) { if (!lernbar(id)) return false; eintrag('lb', { d: heute(), id, v: [...D.A[id].v] }); return true; }
export function lernAbbrechen(id) { if (P.lern?.[id]?.ph < 2) eintrag('lx', { id, v: [...D.A[id].v] }); }
export function lektionen() {
  const d = heute();
  return Object.entries(P.lern || {}).filter(([, L]) => L.ph < 2).map(([id, L]) => {
    const st = offeneStellen(+id);
    return { id: +id, ph: L.ph, tage: L.ft.length, serie: L.s, seit: L.b, zul: L.zul || null, heute: L.zul === d, offen: st.length, stellen: [...new Set(st)] };
  }).sort((a, b) => a.seit.localeCompare(b.seit) || a.id - b.id);
}
export const lernFertig = () => Object.entries(P.lern || {}).filter(([, L]) => L.ph === 2).map(([id, L]) => ({ id: +id, e: L.e }));
// Vorschlag für die nächste Lektion: die Sūra der jüngsten Lektion zu Ende, sonst der Abschnitt nach dem Bereich,
// und wenn der Bereich bis ans Ende reicht (etwa Ǧuzʾ 30), die Sūra davor von ihrem ersten Abschnitt an
export function lernVorschlag() {
  const frei = D.A.map(e => e.id).filter(lernbar); if (!frei.length) return null;
  const ls = Object.keys(P.lern || {}).map(Number).sort((a, b) => P.lern[b].b.localeCompare(P.lern[a].b) || b - a);
  if (ls.length) { const s = D.A[ls[0]].bis[0], n = frei.find(x => x > ls[0] && D.A[x].von[0] === s); if (n != null) return n; }
  const im = D.A.map(e => e.id).filter(id => imBereich(id) || P.lern?.[id]); if (!im.length) return frei[0];
  const nach = frei.find(x => x > im[im.length - 1]); if (nach != null) return nach;
  const vor = frei.filter(x => x < im[0]); if (!vor.length) return frei[0];
  const s = D.A[vor[vor.length - 1]].von[0]; return vor.find(x => D.A[x].von[0] === s);
}
// Wie viele geübte Abschnitte (Bereich und offene Lektionen) stehen auf welcher der drei Stufen
export function dachZahlen() {
  const z = [0, 0, 0];
  for (const id of reihe()) { const k = karte(id); if (k.n) z[dach(k.st)]++; }
  for (const L of Object.values(P.lern || {})) if (L.ph < 2) z[L.ph]++;
  return z;
}
function lernSchritt(L, k, id, datum, f, h, ereignisse) {
  const vor = L.ph, rein = !f && !h;
  if (!rein) { L.s = 0; if (f) k.fz = datum; }
  else if (L.ph === 0) { if (!L.ft.includes(datum)) L.ft.push(datum); if (L.ft.length >= LERN.hifzTage) { L.ph = 1; L.s = 0; L.d = datum; } }
  else { L.s++; if (L.s >= LERN.dabtSerie && !offeneStellen(id).length) { L.ph = 2; L.e = datum; } }
  L.zul = datum;
  k.st = L.ph === 2 ? 4 : L.ph === 1 ? (L.s >= 2 ? 3 : 2) : Math.min(1, L.ft.length);
  if (L.ph > vor) ereignisse.push({ typ: 'lernstufe', id, ph: L.ph });
  return { vor, ph: L.ph, tage: L.ft.length, s: L.s, offen: offeneStellen(id).length, rein };
}

// ---------- Ergebnis eines Abschnitts ----------
// ergebnisse: Array von 'ok' | 'hilfe' | 'fehler' je Āya (in Reihenfolge v[0]..v[1])
// dauer: aktive Übungszeit in Sekunden (ohne Zeit im Hintergrund), fehlt bei fortgesetzten Übungen
export function abschnittAbschliessen(id, ergebnisse, quelle, dauer) {
  const datum = heute(), t = tagesplan(datum);
  const r = ergebnisse.filter(x => x === 'ok').length, h = ergebnisse.filter(x => x === 'hilfe').length, f = ergebnisse.filter(x => x === 'fehler').length;
  if (quelle === 'lern' && !(P.lern?.[id]?.ph < 2)) quelle = 'frei';
  const art = quelle || t.art[id] || 'frei';
  // Punkte: Rückmeldung über Können
  let punkte = 10 * r + 5 * h, teile = [[tx('zustand.ayat_richtig', { r }), 10 * r]];
  if (h) teile.push([tx('zustand.mit_hilfe', { h }), 5 * h]);
  if (!f && !h) { const b = Math.round(punkte * 0.25); punkte += b; teile.push([tx('zustand.fehlerfrei'), b]); }
  if (art === 'bonus') { const b = Math.round(punkte * 0.5); punkte += b; teile.push([tx('zustand.bonusabschnitt_50'), b]); }
  const kp = Math.min(20, Math.floor(P.kette.n / 7) * 2);
  if (kp) { const b = Math.round(punkte * kp / 100); punkte += b; teile.push([tx('zustand.kette', { kp }), b]); }
  // Der Eintrag hält fest, was geübt wurde und welche Punkte dafür angezeigt wurden (p)
  const erg = eintrag('ab', { d: datum, id, v: [...D.A[id].v], e: ergebnisse.map(x => ERG_KURZ[x] || '-').join(''), q: art, ...(dauer > 0 ? { s: Math.round(dauer) } : {}), p: punkte });
  return { punkte, teile, hasanat: erg.hasanat, r, f, h, ereignisse: erg.ereignisse, stufe: erg.stufe, vorher: erg.vorher, lern: erg.lern };
}
const ERG_KURZ = { ok: 'o', hilfe: 'h', fehler: 'f' };
function abschlussAnwenden(e0) {
  const datum = e0.d, id = e0.id, t = tagSicher(datum), e = D.A[id], k = { ...karte(id) };
  const ergebnisse = [...e0.e], art = e0.q, punkte = e0.p, dauer = e0.s || 0;
  const r = ergebnisse.filter(x => x === 'o').length, h = ergebnisse.filter(x => x === 'h').length, f = ergebnisse.filter(x => x === 'f').length;
  const hasanat = e.buchstaben * 10;
  // Karteisystem
  const vorher = k.st, ereignisse = [];
  // Neu lernen: eine offene Lektion folgt ihren eigenen Regeln, nicht dem Karteisystem
  const L = art === 'lern' && P.lern?.[id]?.ph < 2 ? P.lern[id] : null;
  const lern = L ? lernSchritt(L, k, id, datum, f, h, ereignisse) : null;
  if (L) { /* Stufe steht schon */ }
  else if (f) { k.fz = datum; k.st = Math.max(0, k.st - (f / ergebnisse.length > 0.3 ? 2 : 1)); k.fae = plusTage(datum, FEHLER_ABSTAND[0]); k.fs = 0; }
  else if (h) { k.fae = k.fae && k.fae <= plusTage(datum, 3) ? k.fae : plusTage(datum, 3); }
  else {
    k.st = Math.min(4, k.st + 1);
    if (k.fae) { k.fs = (k.fs || 0) + 1; k.fae = k.fs < FEHLER_ABSTAND.length ? plusTage(datum, FEHLER_ABSTAND[k.fs]) : null; if (!k.fae) k.fs = 0; }
  }
  k.n++; k.fe += f; k.zul = datum; k.lf = f;   // lf: Fehler im letzten Durchgang
  if (dauer > 0) { k.z = Math.round(dauer); t.zeit = (t.zeit || 0) + k.z; t.zn = (t.zn || 0) + 1; t.za = (t.za || 0) + ergebnisse.length; }
  k.fa = ergebnisse.map((x, i) => x !== 'o' ? e.v[0] + i : -1).filter(i => i >= 0);
  P.karten[id] = k;
  // Tag und Summen
  if (!t.fertig.includes(id)) t.fertig.push(id);
  if (art === 'bonus' && !t.plan.includes(id)) { t.plan.push(id); t.art[id] = 'bonus'; }
  Object.assign(t, { punkte: t.punkte + punkte, hasanat: t.hasanat + hasanat, r: t.r + r, f: t.f + f, h: t.h + h });
  Object.assign(P.summe, { punkte: P.summe.punkte + punkte, hasanat: P.summe.hasanat + hasanat, r: P.summe.r + r, f: P.summe.f + f, h: P.summe.h + h, abschnitte: P.summe.abschnitte + 1 });
  // Zyklus / Ḫatma
  if (art !== 'frei' && art !== 'lern' && !P.zyklus.erledigt.includes(id)) {
    P.zyklus.erledigt.push(id);
    if (reihe().every(x => P.zyklus.erledigt.includes(x))) {
      P.zyklus.khatma++; P.zyklus.erledigt = []; P.zyklus.beginn = datum; (P.meilenD ??= {})['khatma-' + P.zyklus.khatma] = datum;
      if (!P.einst.bereich) P.zyklus.voll = (P.zyklus.voll || 0) + 1;   // Ḫatma über den ganzen Qurʾān
      ereignisse.push({ typ: 'khatma', n: P.zyklus.khatma });
    }
  }
  // Wird erfüllt → Kette
  const pflicht = t.plan.filter(x => t.art[x] !== 'bonus');
  if (art !== 'lern' && !t.voll && ((!t.ohne && pflicht.every(x => t.fertig.includes(x))) || e0.w)) {
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
  return { hasanat, ereignisse, stufe: k.st, vorher, lern };
}

// ---------- Ornamente: eines je Sūra, sobald alle ihre Abschnitte gefestigt sind; vergoldet, wenn alle mutqan sind ----------
export const sureAbschnitte = s => D.A.filter(x => x.von[0] <= s && x.bis[0] >= s);
// probe: nichts eintragen, nur zählen, was fehlt
function ornamentePruefen(suren, datum, ereignisse, probe = false) {
  let fehlt = 0;
  for (const s of suren) {
    const ids = sureAbschnitte(s).map(x => x.id);
    if (!ids.length || !ids.every(imBereich)) continue;   // nur Sūren, die ganz im eigenen Bereich liegen
    for (const [st, name] of [[2, 'gefestigt'], [4, 'mutqan']]) {
      const key = `sure-${name}-${s}`;
      if (!P.meilen.includes(key) && ids.every(x => karte(x).st >= st)) {
        fehlt++; if (probe) continue;
        P.meilen.push(key); (P.meilenD ??= {})[key] = datum; ereignisse?.push({ typ: 'ornament', s, stufe: name });
      }
    }
  }
  return fehlt;
}
// verpasste Ornamente nachtragen (früher bekamen Sūren in Sammelkarten keines)
export function ornamenteNachtragen() {
  if (ornamentePruefen(Array.from({ length: 114 }, (_, i) => i + 1), heute(), null, true)) eintrag('on', { d: heute() });
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
  { n: tx('zustand.mubtadi'), ar: 'مُبْتَدِئ', de: tx('zustand.der_beginnende'), hifz: tx('zustand.du_hast_mit_der_geordneten_muragaa'), b: {} },
  { n: tx('zustand.murid'), ar: 'مُرِيد', de: tx('zustand.der_wollende_der_strebende'), hifz: tx('zustand.die_absicht_ist_gefasst_und_durch_taten'), b: { punkte: 1000 } },
  { n: tx('zustand.muwazib'), ar: 'مُوَاظِب', de: tx('zustand.der_bestaendige'), hifz: tx('zustand.die_wiederholung_hat_einen_festen_platz'), b: { punkte: 5000, kette: 7 } },
  { n: tx('zustand.mutaahid'), ar: 'مُتَعَاهِد', de: tx('zustand.der_der_den_quran_pflegt'), hifz: tx('zustand.nach_dem_hadit_taahadu_hada_l_quran_er'), b: { punkte: 15000, kette: 40 } },
  { n: tx('zustand.murabit'), ar: 'مُرَابِط', de: tx('zustand.der_auf_seinem_posten_ausharrende'), hifz: tx('zustand.du_haeltst_deinen_bereich_gegen_das'), b: { punkte: 30000, quote: 75 } },
  { n: tx('zustand.hatim'), ar: 'خَاتِم', de: tx('zustand.der_vollendende'), hifz: tx('zustand.eine_ganze_runde_durch_deinen_bereich'), b: { punkte: 60000, khatma: 1, quote: 85 } },
  { n: tx('zustand.mustahdir'), ar: 'مُسْتَحْضِر', de: tx('zustand.der_den_quran_gegenwaertig_hat'), hifz: tx('zustand.der_ganze_quran_ist_einmal_vollstaendig'), b: { punkte: 100000, ganz: 1, voll: 1, quote: 88 } },
  { n: tx('zustand.dabit'), ar: 'ضَابِط', de: tx('zustand.der_genaue'), hifz: tx('zustand.dabt_heisst_in_den_haditwissenschaften'), b: { punkte: 180000, ganz: 1, voll: 2, quote: 92, st2: 50 } },
  { n: tx('zustand.hadiq'), ar: 'حَاذِق', de: tx('zustand.der_geuebte_der_kundige'), hifz: tx('zustand.in_den_alten_quranschulen_hiess_der'), b: { punkte: 270000, ganz: 1, voll: 3, quote: 94, st2: 75 } },
  { n: tx('zustand.rasih'), ar: 'رَاسِخ', de: tx('zustand.der_fest_verwurzelte'), hifz: tx('zustand.wie_ar_rasihuna_fi_l_ilm_3_7_fehler_sind'), b: { punkte: 360000, ganz: 1, voll: 4, quote: 96, st3: 50 } },
  { n: tx('zustand.mutqin'), ar: 'مُتْقِن', de: tx('zustand.der_meisterhafte'), hifz: tx('zustand.vom_selben_stamm_wie_itqan_der_quran'), b: { punkte: 450000, ganz: 1, voll: 5, quote: 98, st3: 80, st4: 30 } },
  { n: tx('zustand.tabt'), ar: 'ثَبْت', de: tx('zustand.der_verlaessliche'), hifz: tx('zustand.tiqa_tabt_ist_das_hoechste_lob_fuer'), b: { punkte: 630000, ganz: 1, voll: 7, quote: 99, st4: 75 } },
  { n: tx('zustand.mutqin_mutlaq'), ar: 'مُتْقِنٌ مُطْلَق', de: tx('zustand.der_uneingeschraenkt_meisterhafte'), hifz: tx('zustand.jede_stelle_des_ganzen_quran_sitzt_ohne'), b: { punkte: 900000, ganz: 1, voll: 10, quote: 100, st4: 100, offen0: 1 } }
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
  punkte: (s, z) => [tx('zustand.itqan_punkte', { s: s.toLocaleString(gebiet('zahl')) }), z.punkte, s],
  kette: (s, z) => [tx('zustand.tage_kette_laengste', { s }), z.kette, s],
  khatma: (s, z) => [tx('zustand.runden_durch_deinen_bereich', { s }), z.khatma, s],
  ganz: (s, z) => [tx('zustand.ganzer_quran_gewaehlt_alle_30_agza'), z.ganz, 1],
  voll: (s, z) => [tx('zustand.hatmat_ueber_den_ganzen_quran', { s }), z.voll, s],
  quote: (s, z) => [tx('zustand.fehlerfrei_beim_letzten_durchgang', { s }), Math.floor(z.quote * 10) / 10, s],
  st2: (s, z) => [tx('zustand.der_abschnitte_mindestens_gefestigt', { s }), Math.floor(z.st2), s],
  st3: (s, z) => [tx('zustand.der_abschnitte_mindestens_sicher', { s }), Math.floor(z.st3), s],
  st4: (s, z) => [tx('zustand.der_abschnitte_mutqan', { s }), Math.floor(z.st4), s],
  offen0: (s, z) => [tx('zustand.keine_fehlerwiederholung_offen'), z.offen ? 0 : 1, 1]
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
// Solange ein fremdes Profil eingesetzt ist, wird nichts gespeichert und nichts protokolliert.
export function mitProfil(profil, fn) { const eigenes = P; P = profil; fremd++; try { return fn(); } finally { P = eigenes; fremd--; } }

// ---------- Profildatei (Sicherung und Lehreransicht) ----------
async function pruefsumme(text) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export async function exportDatei(profil = P) {
  profil = { ...profil, log: [] };    // die Sicherung ist ein Stand, kein Protokoll
  const daten = JSON.stringify(profil);
  return JSON.stringify({ format: 'itqan-profil', version: 1, exportiert: uhr().toISOString(), pruef: await pruefsumme(daten), profil }, null, 0);
}
export async function importDatei(text) {
  const o = JSON.parse(text);
  if (o.format !== 'itqan-profil' || !o.profil || o.profil.format !== 'itqan') throw new Error(tx('zustand.keine_itqan_profildatei'));
  const echt = (await pruefsumme(JSON.stringify(o.profil))) === o.pruef;
  return { profil: o.profil, echt, exportiert: o.exportiert };
}
