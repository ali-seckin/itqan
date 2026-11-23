// Itqān · Profil, Tagesplan (Wird), Karteisystem, Punkte, Kette
import { D, gliederungVon } from './daten.js';
import { tx, gebiet } from './sprache.js';
import * as LM from './lernmodell.js';

const SCHLUESSEL = 'itqan-profil-v1', DEFEKT = 'itqan-profil-defekt';
// Stand des Profilaufbaus: 2 = ein Lernmodell (ab 1.99). Ältere Stände stellt ergaenzen einmal um.
export const SCHEMA = 2;
export const STUFEN = [tx('allg.neu'), tx('zustand.im_aufbau'), tx('allg.gefestigt'), tx('allg.sicher'), tx('allg.mutqan')];
export const KETTEN_MEILEN = [7, 40, 66, 100, 200, 365, 604];
// Kettenbonus auf die Punkte jedes Abschnitts: [Tage in Folge, Prozent]. Überlieferte Zahlen der Reife, die vierzig als höchste (Sūra 7:142, 46:15); bricht die Kette ab, beginnt der Bonus von vorn.
export const KETTEN_BONUS = [[3, 3], [7, 10], [12, 15], [19, 25], [30, 35], [40, 50]];
export function kettenBonus(n) {
  let p = 0; for (const [t, b] of KETTEN_BONUS) if (n >= t) p = b;
  const nae = KETTEN_BONUS.find(([t]) => t > n);
  return { p, naechst: nae ? nae[0] : null };
}
export const kettenTage = () => ketteAktiv() ? P.kette.n : 0;
// Ein Lernmodell für alle (lernmodell.js, Begründung in konzept/lernmodell_einheitlich/DOSSIER.md): Stabilität je Abschnitt, Plätze für Modell, Zyklus und Erstprüfung.
// Tagesnummer für das Modell (Tage seit 2000-01-01). tageZwischen liest beide Daten als UTC-Mitternacht, plusTage rechnet in Ortszeit:
// für reine Datumsangaben passt beides zusammen, die Sommerzeit spielt keine Rolle.
const tagNr = d => tageZwischen('2000-01-01', d), nrTag = n => plusTage('2000-01-01', n);
// Haken nach jedem abgeschlossenen Abschnitt (freiwilliges Lernprotokoll, forschung.js)
let abschlussHaken = null, spiegelHaken = null;
export const abschlussHakenSetzen = f => { abschlussHaken = f; };
// Spiegel (Store-App): wird mit dem Profil als JSON gerufen, nach jedem erfolgreichen Schreiben, und mit null, wenn das Profil gelöscht wird
export const spiegelHakenSetzen = f => { spiegelHaken = f; };
export const PROFIL_SCHLUESSEL = 'itqan-profil-v1';
export let P = null;
// Haken für die Oberfläche. Speicherfehler: fn({ art: 'profil' | 'schnappschuss' | 'zwischenstand', fehler }), das Schreiben ist gescheitert.
// Fremde Änderung: fn({ art: 'nachgeladen' | 'geloescht', gliederung }), ein anderer Reiter hat den Stand geändert.
let speicherFehlerHaken = null, fremdeAenderungHaken = null;
export function speicherFehlerHakenSetzen(fn) { speicherFehlerHaken = fn || null; }
export function fremdeAenderungHakenSetzen(fn) { fremdeAenderungHaken = fn || null; }
const melden = (haken, x) => { if (haken) try { haken(x); } catch (e) { console.warn('Haken', e); } };
const istObj = x => !!x && typeof x === 'object' && !Array.isArray(x);

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
export function speicherSetzen(s) { speicher = s || SPEICHER_STANDARD; geraet = null; stempel = undefined; }
const kopie = x => x === undefined ? undefined : JSON.parse(JSON.stringify(x));

// ---------- Laden / Speichern ----------
// Wirft nie. Ein beschädigter Stand (kein JSON, falsche Struktur) wird unter einem eigenen Schlüssel beiseitegelegt, P bleibt leer,
// ladeMeldung() sagt, was war: null oder { art: 'defekt' | 'speicher', gesichert }.
let ladeFehler = null;
export const ladeMeldung = () => ladeFehler;
export function laden() {
  let t = null; P = null; ladeFehler = null; anderswoGeloescht = false;
  try { t = speicher.lesen(SCHLUESSEL); } catch (e) { ladeFehler = { art: 'speicher' }; }
  if (t) {
    try { const p = JSON.parse(t); if (p !== null) { if (!istObj(p) || p.format !== 'itqan') throw new Error('format'); P = ergaenzen(p); } }
    catch (e) { P = null; ladeFehler = { art: 'defekt', gesichert: defektSichern(t) }; console.warn('itqan-profil-defekt', e); }
  }
  stempel = stempelGespeichert();
  schattenNeu();
  return P;
}
function defektSichern(roh) {
  try { if (defektLesen()?.roh !== roh) speicher.schreiben(DEFEKT, JSON.stringify({ zeit: uhr().toISOString(), roh })); return true; } catch (e) { return false; }
}
// Rohdaten eines beschädigten Stands ({ zeit, roh }) für „Rohdaten sichern“ in der Oberfläche
export function defektLesen() { try { const x = JSON.parse(speicher.lesen(DEFEKT) || 'null'); return x && typeof x.roh === 'string' ? x : null; } catch (e) { return null; } }
export function defektVerwerfen() { try { speicher.entfernen(DEFEKT); } catch (e) {} }
// ältere Profile um neue Felder ergänzen; fehlende Kernfelder auffüllen, damit kein Aufruf an einem unvollständigen Stand scheitert
export function ergaenzen(p) {
  if (!istObj(p.einst)) p.einst = {};
  if (!Array.isArray(p.einst.pensum) || p.einst.pensum.length !== 7 || p.einst.pensum.some(x => !(x >= 0))) p.einst.pensum = Array(7).fill(3);
  p.format ??= 'itqan'; if (typeof p.name !== 'string') p.name = '';
  if (typeof p.erstellt !== 'string' || !(Date.parse(p.erstellt) > 0)) p.erstellt = uhr().toISOString();
  if (!istObj(p.karten)) p.karten = {}; if (!istObj(p.tage)) p.tage = {};
  for (const [d, t] of Object.entries(p.tage)) {
    if (!istObj(t)) { delete p.tage[d]; continue; }
    if (!Array.isArray(t.plan)) t.plan = []; if (!Array.isArray(t.fertig)) t.fertig = []; if (!istObj(t.art)) t.art = {};
  }
  if (!istObj(p.zyklus)) p.zyklus = {}; if (!Array.isArray(p.zyklus.erledigt)) p.zyklus.erledigt = []; p.zyklus.khatma = +p.zyklus.khatma || 0;
  if (!istObj(p.kette)) p.kette = {}; p.kette.n = +p.kette.n || 0; p.kette.beste = +p.kette.beste || 0; p.kette.zuletzt ??= null;
  if (!istObj(p.summe)) p.summe = {}; for (const f of ['punkte', 'hasanat', 'r', 'f', 'h', 'abschnitte']) p.summe[f] = +p.summe[f] || 0;
  if (!Array.isArray(p.meilen)) p.meilen = [];
  if (p.einst.bereich != null && !Array.isArray(p.einst.bereich)) p.einst.bereich = null;
  schemaUmstellen(p);
  p.einst.zufall ??= 'einzeln'; p.einst.vorueben ??= true; p.fstellen ??= {};
  if (!['v1', 'v2'].includes(p.einst.ausgabe)) p.einst.ausgabe = 'v2';   // frühere Mischform wird Druck 1421
  p.einst.modus ??= 'fort'; p.gliederung ??= 'fort-1'; p.meilenD ??= {};
  p.einst.sofort ??= true; p.einst.abhoeren ??= true;
  // Tageswechsel: Vorgabe 3 Uhr (Entscheidung 10.11.2026). Wer noch die alte Vorgabe Mitternacht hat, wird einmal umgestellt, danach gilt die eigene Wahl.
  if (!p.einst.tb3) { if (!p.einst.tagesbeginn) p.einst.tagesbeginn = 3; p.einst.tb3 = 1; }
  p.pausen ??= []; p.mutash ??= {};
  p.einst.lernProTag ??= 1;
  p.lern ??= {}; p.statistik ??= { arten: artenAusStellen(p.fstellen) };
  if (!p.verlauf) { p.verlauf = {}; for (const [d, t] of Object.entries(p.tage || {})) if (t?.punkte) p.verlauf[d] = t.punkte; }
  p.einst.seitenGroesse ??= 100; p.einst.textGroesse ??= 100;   // Lesbarkeit: Seite 100, 125, 150 %; Schrift 100, 112, 125 %
  // Protokoll: Sockel (Generation, Zeit, Gerät) und Liste der Einträge seit dem Sockel
  p.sockel ??= { n: 1, z: Date.parse(p.erstellt) || 0, g: '' }; p.log ??= [];
  return p;
}
// Einmalige Umstellung älterer Stände auf das eine Lernmodell (Schema 2). Rechnet nur mit dem Stand selbst, nie mit der Uhr:
// der Nachbau aus einem alten Sockel ergibt so auf jedem Gerät dasselbe.
function schemaUmstellen(p) {
  if ((p.schema || 1) >= SCHEMA) return;
  let letzter = null;
  for (const k of Object.values(p.karten)) {
    if (!istObj(k)) continue;
    if (k.fae && k.lf == null) k.lf = 1;    // Anzeige „Fehler im letzten Durchgang“ bleibt bis zum nächsten Durchgang
    delete k.fae; delete k.fs; delete k.fz;   // die alte Fehlerwiederholung gibt es nicht mehr, das Modell führt den Abschnitt über S und kon
    if (typeof k.zul === 'string' && (!letzter || k.zul > letzter)) letzter = k.zul;
  }
  for (const k of ['rhythmus', 'zielQuote', 'schwaechen']) delete p.einst[k];   // entfernte Einstellungen
  delete p.zyklus.konto;
  // Was bis hierher geübt wurde, stammt aus dem alten Modell: für das Ḥifẓ-Tempo zählt als Rückstau erst, was danach wieder geübt wurde
  if (letzter) p.umgestellt = letzter;
  p.schema = SCHEMA;
}
// Schreibt den Stand. Rückgabe true oder false; scheitert das Schreiben, wird der Haken für Speicherfehler gerufen.
// Hat ein anderer Reiter inzwischen geschrieben, wird dessen Stand zuerst geholt (nie blind überschrieben).
// erzwingen: bewusstes Ersetzen (neues Profil, Sicherung, Schnappschuss, Abgleich), ohne diese Prüfung.
export function speichern(erzwingen = false) {
  if (fremd || !P) return false;    // ein fremdes Profil (Lehreransicht, Nachbau) wird nie gespeichert
  if (erzwingen !== true) speicherAbgleichen(); else anderswoGeloescht = false;
  einstAbgleichen();
  return profilSchreiben();
}
function profilSchreiben() {
  if (anderswoGeloescht) return false;    // in einem anderen Reiter gelöscht: dieser Reiter legt das Profil nicht wieder an (die Oberfläche lädt neu)
  const text = JSON.stringify(P);
  for (;;) {
    try { speicher.schreiben(SCHLUESSEL, text); break; }
    catch (e) {
      if (schnappschussOpfern()) continue;    // Speicher voll: ältere Schnappschüsse weichen, der jüngste bleibt
      console.warn('Speichern fehlgeschlagen', e); melden(speicherFehlerHaken, { art: 'profil', fehler: e }); return false;
    }
  }
  melden(spiegelHaken, text);
  stempelNeu(); return true;
}
// ---------- Mehrere Reiter ----------
// Jedes Schreiben des Profils setzt einen Stempel (im Geräteeintrag). Weicht der gespeicherte Stempel vom zuletzt gesehenen ab,
// hat ein anderer Reiter geschrieben: sein Stand wird geholt, eigene noch nicht protokollierte Einstellungen werden darauf übertragen.
const REITER = Math.random().toString(36).slice(2, 8);
let stempel, stempelZahl = 0, anderswoGeloescht = false;    // undefined: noch nicht gelesen (Speicher gewechselt), der nächste Blick übernimmt, was dort steht
function geraetRoh() { try { const g = JSON.parse(speicher.lesen(GERAET) || 'null'); return istObj(g) ? g : null; } catch (e) { return null; } }
const stempelGespeichert = () => geraetRoh()?.s ?? null;
function stempelNeu() { stempel = REITER + '.' + (++stempelZahl).toString(36); geraetLesen(); geraetSichern(stempel); }
function fremdGeaendert() {
  const s = stempelGespeichert();
  if (stempel === undefined) { stempel = s; return false; }
  return s !== stempel;
}
// leerAuch: auch einen dort gelöschten Stand übernehmen (für das storage-Ereignis); beim Schreiben bleibt der eigene Stand
function speicherAbgleichen(leerAuch = false) {
  if (fremd || !fremdGeaendert()) return false;
  let neu = null, t = null;
  try { t = speicher.lesen(SCHLUESSEL); if (t) { const p = JSON.parse(t); if (istObj(p) && p.format === 'itqan') neu = ergaenzen(p); } } catch (e) { neu = null; }
  stempel = stempelGespeichert(); geraet = null;
  if (!neu) {
    if (leerAuch && !t && P) { P = null; schatten = null; return true; }
    if (!leerAuch) { if (!t && P) anderswoGeloescht = true; melden(fremdeAenderungHaken, { art: 'geloescht' }); }
    return false;
  }
  const offen = [];
  if (P && schatten) { const jetzt = einstBild(P); for (const k of new Set([...Object.keys(schatten), ...Object.keys(jetzt)])) if (schatten[k] !== jetzt[k]) offen.push([k, jetzt[k]]); }
  P = neu; schattenNeu();
  for (const [k, w] of offen) {
    if (k === 'name') P.name = JSON.parse(w ?? '""');
    else if (w === undefined) delete P.einst[k.slice(6)]; else P.einst[k.slice(6)] = JSON.parse(w);
  }
  const gliederung = P.gliederung !== D.gliederung;
  if (!leerAuch) melden(fremdeAenderungHaken, { art: 'nachgeladen', gliederung });
  return true;
}
// Für das storage-Ereignis der Oberfläche: addEventListener('storage', e => { if (Z.speicherEreignis(e.key)) neu zeichnen }).
// true: der Stand wurde aus dem Speicher nachgeladen (oder ist dort gelöscht worden, dann ist P leer).
export function speicherEreignis(schluessel) {
  if (schluessel != null && schluessel !== SCHLUESSEL && schluessel !== GERAET) return false;
  return speicherAbgleichen(true);
}
export function neuesProfil({ name = '', pensum = 3, reihenfolge = 'vorwaerts', bereich = null, thema = 'auto', modus = 'fort' } = {}) {
  P = {
    format: 'itqan', version: 1, erstellt: uhr().toISOString(), name,
    einst: { pensum: Array(7).fill(pensum), reihenfolge, bereich, thema, erinnerung: '05:30', hilfe: true, zufall: 'einzeln', vorueben: true, ausgabe: 'v2', modus, seitenGroesse: 100, textGroesse: 100 }, gliederung: gliederungVon(modus, 'v2')?.name || 'fort-2',
    karten: {}, zyklus: { erledigt: [], khatma: 0, beginn: heute() },
    tage: {}, kette: { n: 0, beste: 0, zuletzt: null }, summe: { punkte: 0, hasanat: 0, r: 0, f: 0, h: 0, abschnitte: 0 },
    meilen: [], meilenD: {}, fstellen: {}, pausen: [], statistik: { arten: {} }, mutash: {}
  };
  P.schema = SCHEMA; P.lernIm = 1;
  ergaenzen(P); P.sockel.n = 0;    // ein neues Profil hat sofort alle Felder, nicht erst nach dem nächsten Laden
  sockelWechsel();
  speichern(true); return P;
}
// stand: Zeitpunkt, zu dem der geladene Stand entstanden ist (bei einer Sicherung der Zeitpunkt des Sicherns).
// Einträge anderer Geräte, die danach entstanden sind, lassen sich später in diesen Stand holen (umziehen).
export function ersetzeProfil(neu, stand) { P = ergaenzen(neu); sockelWechsel(stand); speichern(true); }
// Einen Stand unverändert übernehmen (nach dem Zusammenführen, später nach dem Abgleich mit dem Server):
// kein neuer Sockel, log sind die Einträge, die noch nicht abgeglichen sind.
export function standUebernehmen(profil, log = []) { P = ergaenzen(kopie(profil)); P.log = kopie(log); geraetNachziehen(); schattenNeu(); speichern(true); return P; }
// Zähler und Zeit dieses Geräts hinter seine eigenen Einträge im übernommenen Protokoll setzen. Sonst bekäme ein neuer
// Eintrag eine schon vergebene Kennung, und eine Rücknahme („Vorige Āya neu bewerten“) erfasste alte Fehlerstellen mit.
function geraetNachziehen() {
  const g = geraetLesen(), vor = g.g + '-';
  for (const e of P.log || []) if (e.i?.startsWith(vor)) { g.n = Math.max(g.n, parseInt(e.i.slice(vor.length), 36) || 0); g.z = Math.max(g.z, e.z || 0); }
  geraetSichern();
}

// ---------- Protokoll (Beschreibung: konzept/datenmodell.md) ----------
// Jede Änderung am Lernstand ist ein Eintrag { i: 'Gerät-Zähler', z: Zeit in ms, y: Art, ... }.
// Der Lernstand ergibt sich aus dem Sockel und den Einträgen in der Reihenfolge (z, i). Zwei Geräte legen ihre
// Einträge zusammen und bauen den Stand neu auf: so geht beim Zusammenführen nichts verloren.
// Arten: pl Tagesplan, pa Pensum heute, ab Abschnitt abgeschlossen, fm Fehlerstellen gemerkt, fl Fehlerstelle gelöscht,
// fg Fehlerstelle geübt, mu Mutašābih unterschieden, pb Pause beginnt, pe Pause endet, on Ornamente nachgetragen,
// rk Rücknahme, ei Einstellung.
const GERAET = 'itqan-geraet', LOG_GRENZE = 300;
let geraet = null, fremd = 0, schatten = null, grenze = LOG_GRENZE, eintragHaken = null;
// Der Abgleich mit dem Konto (js/abgleich.js) hängt sich hier an: er bekommt jeden neuen Eintrag dieses Geräts.
export function eintragHakenSetzen(f) { eintragHaken = f; }
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
// Den Stempel setzt nur das Schreiben des Profils (stempelNeu); sonst bleibt stehen, was im Speicher steht: ein Reiter mit altem Stand verdeckt so nie die Änderung eines anderen
function geraetSichern(neuerStempel) {
  const s = neuerStempel ?? stempelGespeichert();
  try { speicher.schreiben(GERAET, JSON.stringify(s ? { ...geraet, s } : geraet)); } catch (e) {}
}
export function geraetSetzen(g) { geraet = { g, n: 0, z: 0 }; geraetSichern(); }
export const geraetKennung = () => geraetLesen().g;
// Kennung und Zeit eines neuen Eintrags. Die Zeit läuft je Gerät nie rückwärts, der Zähler hat feste Breite:
// so bleibt die Reihenfolge eines Geräts auch bei verstellter Uhr erhalten.
// Der Zähler wird vor jeder Vergabe mit dem Speicher abgeglichen und sofort gesichert: zwei Reiter vergeben nie dieselbe Kennung.
function marke() {
  const g = geraetLesen(), r = geraetRoh();
  if (r && r.g === g.g) { g.n = Math.max(g.n, +r.n || 0); g.z = Math.max(g.z, +r.z || 0); }
  g.n++; g.z = Math.max(uhr().getTime(), g.z); geraetSichern();
  return { i: g.g + '-' + g.n.toString(36).padStart(6, '0'), z: g.z };
}
// Nach einer falsch gestellten Uhr steht die Zeit des Geräts in der Zukunft und bliebe dort. Kennt der Abgleich die Zeit des Servers,
// zieht er sie damit zurück (true: korrigiert). Ohne verlässliche Zeit bleibt die Reihenfolge des Geräts unangetastet.
export function geraetUhrKorrigieren(serverZeit) {
  const r = geraetRoh(), g = geraetLesen(); if (r && r.g === g.g) g.z = Math.max(g.z, +r.z || 0);
  if (!(serverZeit > 0) || g.z <= serverZeit + 864e5) return false;
  g.z = serverZeit; geraetSichern(); return true;
}
// Tage zwischen dem jüngsten Tag mit Übung und heute: ein großer Sprung (falsch gestellte Uhr?) lässt sich so vor dem Planen erfragen
export function uhrSprung() {
  let letzter = null; for (const [d, t] of Object.entries(P?.tage || {})) if (t.fertig?.length && (!letzter || d > letzter)) letzter = d;
  return letzter ? tageZwischen(letzter, heute()) : 0;
}
function logAnhaengen(e) {
  (P.log ??= []).push(e);
  if (P.log.length > grenze) P.log.splice(0, P.log.length - grenze);
  if (eintragHaken) try { eintragHaken(e); } catch (x) { console.warn('Abgleich', x); }
}
// Neuer Sockel: neues Profil, geladene Sicherung, zurückgeholter Schnappschuss, Wechsel der Gliederung.
// Die höhere Generation gewinnt, ihre Einträge beginnen von vorn.
function sockelWechsel(stand) {
  const g = geraetLesen(); g.z = Math.max(uhr().getTime(), g.z);
  const z = Date.parse(stand ?? '');
  P.sockel = { n: (P.sockel?.n || 0) + 1, z: z > 0 && z < g.z ? z : g.z, g: g.g }; P.log = [];
  P.modell = FASSUNG;   // ein neuer Sockel ist ein Abbild des Stands, alles danach wird nach den Regeln dieser Fassung gerechnet
  schattenNeu(); geraetSichern();
}
// Eigener neuer Sockel aus dem jetzigen Stand (Umzug auf ein Konto). mindestens: die Generation muss höher sein als diese.
export function sockelNeu(mindestens = 0) { if (!P) return; speicherAbgleichen(); P.sockel.n = Math.max(P.sockel.n || 0, mindestens); sockelWechsel(); speichern(true); }
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
    const e = { ...marke(), y: 'ei', k, ...(k in neu ? { w: JSON.parse(neu[k]) } : {}) };
    if (k === 'einst.bereich' || k === 'einst.auswahl') e.m = MODELL_STAND;   // ab 2.00 stehen gelernte Abschnitte selbst im Bestand (siehe anwendenRoh)
    if (k === 'einst.pensum') { e.d = heute(); if (schatten[k]) pensumMerken(JSON.parse(schatten[k]), e); }   // d: ab diesem Tag gilt das neue Pensum
    logAnhaengen(e); n++;
  }
  schatten = neu;
}
// Der einzige Weg, den Lernstand zu ändern: Eintrag bilden, anwenden, anhängen, speichern.
function eintrag(y, daten, extra) {
  if (fremd) return anwenden({ y, ...daten }, extra);
  if (speicherAbgleichen() && P.gliederung !== D.gliederung) throw new Error('Gliederung in einem anderen Fenster gewechselt');   // der Eintrag passte nicht zum geholten Stand
  einstAbgleichen();
  const e = { ...marke(), y, ...daten };
  const erg = anwenden(e, extra);
  if (y === 'ab') { if (erg.ereignisse.some(x => x.typ === 'wird')) e.w = 1; schattenNeu(); }   // w: dieser Abschluss hat den Wird erfüllt. Schatten: eine fertige Lektion hat den Bestand erweitert, das ist keine Änderung der Oberfläche
  logAnhaengen(e); profilSchreiben();
  return erg;
}
// Wendet einen Eintrag auf P an. Rechnet nur mit den Daten des Eintrags, nie mit der Uhr.
// Punkte je Tag bleiben in P.verlauf stehen, auch wenn der Tag selbst später verdichtet wird (Statistik über Monate und Jahre)
function anwenden(e, extra) {
  const r = anwendenRoh(e, extra);
  const t = e.d && P?.tage?.[e.d];
  if (t && t.punkte) (P.verlauf ??= {})[e.d] = t.punkte;
  return r;
}
function anwendenRoh(e, extra) {
  switch (e.y) {
    case 'pl': return planAnwenden(e);
    case 'pa': return pensumAnwenden(e);
    case 'ab': return abschlussAnwenden(e);
    case 'fm': return merkenAnwenden(e);
    case 'fl': delete P.fstellen[e.s]; return;
    case 'fg': return geuebtAnwenden(e);
    case 'mu': return unterscheidenAnwenden(e);
    case 'ku': return kurzAnwenden(e);
    case 'pb': return pauseBeginnAnwenden(e);
    case 'pe': return pauseEndeAnwenden(e);
    case 'on': ornamentePruefen(Array.from({ length: 114 }, (_, i) => i + 1), e.d); return;
    case 'lb': if (!(P.lern ??= {})[e.id] || (P.lern[e.id].ph === 2 && !imBereich(e.id))) P.lern[e.id] = { b: e.d, ph: 0, ft: [], s: 0 }; return;   // auch erneut, wenn der gelernte Abschnitt wieder aus dem Bestand genommen wurde
    case 'lx': if (P.lern?.[e.id]?.ph < 2) delete P.lern[e.id]; return;
    case 'rk': return ruecknahmeAnwenden(extra?.stand);
    case 'ei':
      if (!einstEintragGut(e)) return;    // Einträge kommen auch vom Konto: nur Werte der erwarteten Form
      if (e.k === 'name') P.name = e.w ?? '';
      else {
        if (e.k === 'einst.pensum' && 'w' in e) pensumMerken(P.einst.pensum, e);
        if ('w' in e) P.einst[e.k.slice(6)] = kopie(e.w); else delete P.einst[e.k.slice(6)];
        // Bestand von einem Gerät mit 1.99 oder älter (ohne m): dort stehen gelernte Abschnitte nie in der Liste, sie zählen aber immer dazu.
        // Damit sie hier nicht aus dem Bestand fallen, werden die fertigen Lektionen wieder aufgenommen.
        if ((e.k === 'einst.bereich' || e.k === 'einst.auswahl') && !e.m) for (const [id, L] of Object.entries(P.lern || {})) if (L?.ph === 2) bereichAufnehmen(+id);
      }
      return;
  }
}
const ordnung = (a, b) => a.z - b.z || (a.i < b.i ? -1 : a.i > b.i ? 1 : 0);
// Stand aus Sockel und Einträgen neu aufbauen. Zurückgenommene Einträge (rk) werden übersprungen.
// D muss zur Gliederung des Sockels passen.
export function nachbau(sockel, eintraege) {
  const p = ergaenzen(kopie(sockel)); p.log = [];
  const weg = new Set(eintraege.filter(e => e?.y === 'rk' && eintragGut(e)).flatMap(e => e.ids || []));
  // Einträge kommen auch vom Konto: was nicht die erwartete Form hat oder einen unbekannten Abschnitt nennt, wird übersprungen (eintragGut)
  const liste = eintraege.filter(e => eintragGut(e) && !weg.has(e.i)).sort(ordnung);
  return mitProfil(p, () => { lernUebernehmen(); for (const e of liste) anwenden(e); return p; });
}
// Zwei oder mehr Gerätestände mit demselben Sockel: Einträge vereinen (jede Kennung einmal), Stand neu aufbauen.
export function zusammenfuehren(sockel, ...logs) {
  const alle = new Map();
  for (const l of logs) for (const e of l) if (eintragGut(e) && !alle.has(e.i)) alle.set(e.i, e);
  const log = [...alle.values()].sort(ordnung);
  return { profil: nachbau(sockel, log), log };
}
// Einträge einer älteren Generation in die neuere holen: nur was nach dem neuen Sockel entstanden ist.
// Abschlüsse werden über ihren Āya-Bereich dem heutigen Abschnitt zugeordnet, Pläne entstehen neu.
export function umziehen(eintraege, profilNeu) {
  const ab = profilNeu.sockel?.z ?? 0, uebernommen = [], offen = []; let verworfen = 0;
  const gestern = plusTage(heute(), -1), abschnittVon = e => e.v && D.A.find(x => x.v[0] === e.v[0] && x.v[1] === e.v[1]);
  // Abschlüsse von gestern und heute, die der neue Sockel noch nicht kennt (die Generation entstand auf einem anderen Gerät), gehen nicht verloren
  const frisch = e => e.y === 'ab' && e.d >= gestern && !profilNeu.tage?.[e.d]?.fertig?.includes(abschnittVon(e)?.id);
  for (const e of eintraege) {
    if ((e.z <= ab && !frisch(e)) || e.y === 'pl' || e.y === 'pa' || (e.y === 'ei' && e.k === 'einst.bereich')) { verworfen++; continue; }
    if (e.y !== 'ab' && e.y !== 'lb' && e.y !== 'lx') { uebernommen.push(e); continue; }
    const a = abschnittVon(e);
    if (a) uebernommen.push({ ...e, id: a.id }); else offen.push(e);
  }
  return { uebernommen, offen, verworfen };
}

// ---------- Schnappschüsse: automatische Kopien des Profils auf diesem Gerät ----------
// Bis zu zwei tägliche und drei vor wichtigen Schritten (Gliederungswechsel, Laden einer Sicherung, Löschen).
// Sie schützen vor eigenen Fehlgriffen, nicht vor dem Löschen der App: dafür ist „Profil sichern“ da.
const SCHNAPP = 'itqan-schnappschuesse';
export function schnappschuesse() { try { const l = JSON.parse(speicher.lesen(SCHNAPP) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
export function schnappschuss(grund) {
  if (!P) return false;
  const neu = { zeit: uhr().toISOString(), tag: heute(), grund, name: P.name, abschnitte: P.summe.abschnitte, daten: JSON.stringify({ ...P, log: [] }) };
  const alle = [neu, ...schnappschuesse()];
  let liste = [...alle.filter(x => x.grund === 'täglich').slice(0, 2), ...alle.filter(x => x.grund !== 'täglich').slice(0, 3)]
    .sort((a, b) => b.zeit.localeCompare(a.zeit));
  let fehler = null;
  while (liste.length) { try { speicher.schreiben(SCHNAPP, JSON.stringify(liste)); return true; } catch (e) { fehler = e; liste = liste.slice(0, -1); } }
  melden(speicherFehlerHaken, { art: 'schnappschuss', fehler });
  return false;
}
// Platz schaffen, wenn das Profil nicht mehr in den Speicher passt: den ältesten Schnappschuss verwerfen (true: einer ist gewichen)
function schnappschussOpfern() {
  const liste = schnappschuesse(); if (liste.length < 2) return false;
  try { speicher.schreiben(SCHNAPP, JSON.stringify(liste.slice(0, -1))); return true; } catch (e) { return false; }
}
export function tagesSchnappschuss() {
  if (!P || schnappschuesse().some(x => x.grund === 'täglich' && x.tag === heute())) return false;
  return schnappschuss('täglich');
}
export function schnappschussZurueck(zeit) {
  const s = schnappschuesse().find(x => x.zeit === zeit); if (!s) return false;
  let daten; try { daten = JSON.parse(s.daten); } catch (e) { return false; }
  if (!istObj(daten)) return false;
  if (P) schnappschuss('vor dem Zurückholen');
  P = ergaenzen(daten); sockelWechsel(); speichern(true); return true;
}
// Kurzer Überblick über ein Profil, z. B. vor dem Laden einer Sicherung
export function profilUeberblick(p) {
  const tage = Object.entries(p.tage || {}).filter(([, t]) => t.fertig?.length).map(([d]) => d).sort();
  return { name: p.name || '', erstellt: p.erstellt, abschnitte: p.summe?.abschnitte || 0, punkte: p.summe?.punkte || 0,
    kette: p.kette?.n || 0, khatma: p.zyklus?.khatma || 0, letzterTag: tage.at(-1) || null, fstellen: Object.keys(p.fstellen || {}).length };
}
// Mit dem Profil geht der Zwischenstand einer angefangenen Übung; die Schnappschüsse bleiben (Schutz vor Fehlgriffen)
export function loeschen() { P = null; schatten = null; anderswoGeloescht = false; try { speicher.entfernen(SCHLUESSEL); speicher.entfernen(ZWISCHEN); } catch (e) {} melden(spiegelHaken, null); stempelNeu(); }

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
    // Felder des Modells ziehen mit: die früheste Kontrolle und der jüngste Ausfall; die gemessene Zeit passt nicht mehr und entfällt
    const kons = ks.map(k => k.kon).filter(Boolean).sort(), lts = ks.map(k => k.lt).filter(x => x != null), lfMax = Math.max(0, ...ks.map(k => k.lf ?? 1));
    karten[nid] = { st: os.some(o => !altK[o]) ? 0 : Math.min(...ks.map(k => k.st)), n: Math.max(...ks.map(k => k.n)), fe: Math.max(...ks.map(k => k.fe || 0)),
      zul: ks.map(k => k.zul).filter(Boolean).sort().pop() || null, fa, lf: fa.length && lfMax > 0 ? Math.min(fa.length, lfMax) : 0, ...(ks.every(x => x.S != null) ? { S: Math.min(...ks.map(x => x.S)) } : {}),
      ...(kons.length ? { kon: kons[0] } : {}), ...(lts.length ? { lt: Math.max(...lts) } : {}) };
  });
  P.karten = karten;
  const erl = new Set(P.zyklus.erledigt);
  P.zyklus.erledigt = neu.map((n, nid) => nid).filter(nid => M[nid].length && M[nid].every(o => erl.has(o)));
  if (P.einst.bereich) { const b = new Set(P.einst.bereich); P.einst.bereich = neu.map((n, nid) => nid).filter(nid => M[nid].some(o => b.has(o))); }
  for (const t of Object.values(P.tage)) {
    const plan = [...new Set(t.plan.flatMap(o => R[o] || []))], fertig = new Set(t.fertig), art = {};
    for (const nid of plan) { const o = M[nid].find(x => t.plan.includes(x)); art[nid] = t.art[o] || 'zyklus'; }
    t.fertig = plan.filter(nid => M[nid].every(o => !t.plan.includes(o) || fertig.has(o)));
    t.plan = plan; t.art = art; t.gl = ziel; delete t.ma;
  }
  // Lektionen ziehen mit: bei mehreren alten Abschnitten gilt der schwächste Stand
  const altL = P.lern || {}; P.lern = {};
  neu.forEach((n, nid) => { const ls = M[nid].map(o => altL[o]).filter(Boolean); if (ls.length) P.lern[nid] = kopie(ls.reduce((a, b) => b.ph < a.ph ? b : a)); });
  P.gliederung = ziel; if (sichern && !fremd) { sockelWechsel(); speichern(true); }
}
// Pläne, die in einer anderen Gliederung gebaut wurden als der geladenen (etwa direkt nach dem Anlegen eines Profils im
// Modus „Ganze Seiten“, bevor die App neu geladen hat), verweisen auf falsche oder fehlende Einheiten. Ein unberührter Tag
// wird neu geplant, ein angefangener behält nur, was es gibt.
export function plaeneBereinigen() {
  if (!P) return 0;
  let n = 0;
  for (const [d, t] of Object.entries(P.tage)) {
    if (!t.plan?.length) continue;
    const fremd = (t.gl && t.gl !== D.gliederung) || t.plan.some(id => !D.A[id]);
    if (!fremd) continue;
    n++;
    if (!t.fertig?.length && !t.punkte) { delete P.tage[d]; continue; }
    t.plan = t.plan.filter(id => D.A[id]); t.fertig = (t.fertig || []).filter(id => D.A[id]);
    for (const id of Object.keys(t.art || {})) if (!D.A[id]) delete t.art[id];
    t.gl = D.gliederung;
  }
  if (lernUebernehmen() || n) speichern();
  return n;
}
export async function gliederungAbgleichen() {
  if (!P || P.gliederung === D.gliederung) return false;
  gliederungUmstellen(await gliederungLaden(P.gliederung)); return true;
}

// ---------- Karteikarten ----------
export const karte = id => P.karten[id] || { st: 0, n: 0, fe: 0, zul: null, fa: [] };
// Stand eines Abschnitts für die Anzeige: nie gelesen, Fehler im letzten Durchgang, sonst die Stufe
export function abschnittStand(id) {
  const k = karte(id);
  if (!k.n) return 'nie';
  if ((k.lf ?? 0) > 0) return 'fehler';
  return ['neu', 'aufbau', 'gefestigt', 'sicher', 'mutqan'][k.st] || 'neu';
}
// Was auf dem Weg des Neulernens den Itqān erreicht hat, gehört zum Bestand: der Abschnitt steht in einst.bereich und einst.auswahl
// und lässt sich dort wie jeder andere wieder abwählen. Ältere Stände, die noch nicht übernommen sind (lernIm fehlt), zählen fertige Lektionen wie bisher dazu.
export function imBereich(id) { return !P.einst.bereich || P.einst.bereich.includes(id) || (!P.lernIm && P.lern?.[id]?.ph === 2); }
function bereichAufnehmen(id) {
  const E = P.einst, a = D.A?.[id]; if (!E.bereich || !a) return;
  if (!E.bereich.includes(id)) E.bereich = [...E.bereich, id].sort((x, y) => x - y);
  if (Array.isArray(E.auswahl)) {
    const r = [...E.auswahl, [a.v[0], a.v[1]]].sort((x, y) => x[0] - y[0]), aus = [];
    for (const [von, bis] of r) { const l = aus[aus.length - 1]; if (l && von <= l[1] + 1) l[1] = Math.max(l[1], bis); else aus.push([von, bis]); }
    E.auswahl = aus;
  }
}
// Ältere Stände: fertige Lektionen einmal in den Bestand schreiben (braucht die geladene Gliederung des Stands). true: der Stand ist jetzt übernommen
export function lernUebernehmen() {
  if (!P || P.lernIm || !D.A || P.gliederung !== D.gliederung) return false;
  for (const [id, L] of Object.entries(P.lern || {})) if (L.ph === 2) bereichAufnehmen(+id);
  P.lernIm = 1; return true;
}
// Die Reihe der Wiederholung: der Bestand ohne Abschnitte, deren Lektion noch läuft (sie kämen nie in den Plan und hielten die Ḫatma auf)
export function reihe() {
  const ids = D.A.map(e => e.id).filter(id => imBereich(id) && !(P.lern?.[id]?.ph < 2));
  if (P.einst.reihenfolge !== 'rueckwaerts') return ids;
  // Sūren rückwärts (an-Nās zuerst), innerhalb der Sūra vorwärts. Bei Zufall bleibt die Grundreihe vorwärts.
  const gruppen = []; let g = [], s = null;
  for (const id of ids) { const e = D.A[id]; if (e.von[0] !== s) { if (g.length) gruppen.push(g); g = []; s = e.von[0]; } g.push(id); }
  if (g.length) gruppen.push(g);
  return gruppen.reverse().flat();
}

// ---------- Ruhetage und Pause ----------
// Ruhetag: Wochentag mit 0 Abschnitten. Pause: höchstens 30 Tage am Stück. An beiden Tagen gibt es keinen Wird,
// die Kette ruht und läuft danach weiter, Qaḍāʾ bezieht sich auf den letzten echten Wird-Tag. Freies Üben an einem solchen Tag
// erfüllt keinen Wird (nur „trotzdem üben“ mit eigenem Plan). Eine offene Kontrolle wartet: sie steht am ersten Tag danach im Plan.
export const PAUSE_MAX = 30;
export const pauseJetzt = (datum = heute()) => (P.pausen || []).find(x => datum >= x.von && datum <= x.bis) || null;
export const inPause = (datum = heute()) => !!pauseJetzt(datum);
// Das Pensum, das an einem Tag galt. Eine Änderung der Wochentage wirkt ab dem Tag der Änderung, nicht rückwirkend:
// P.pensumVor hält die früheren Pläne fest ([{ bis: erster Tag des neuen Plans, p: alter Plan }], älteste zuerst).
function pensumFuer(datum) { for (const x of P.pensumVor || []) if (datum < x.bis) return x.p; return P.einst.pensum; }
function pensumMerken(alt, e) {
  if (!Array.isArray(alt) || alt.length !== 7) return;
  const bis = DATUM_M.test(e.d || '') ? e.d : heute(new Date(e.z - (+P.einst.tagesbeginn || 0) * 36e5));   // ältere Einträge tragen kein Datum
  P.pensumVor = [...(P.pensumVor || []), { bis, p: [...alt] }].slice(-8);
}
export const ruhetag = (datum = heute()) => !(pensumFuer(datum)[wochentag(datum)] > 0) || inPause(datum);
export function vorigerWirdTag(datum) {
  for (let i = 1; i <= 60; i++) { const d = plusTage(datum, -i); if (!ruhetag(d)) return d; }
  return plusTage(datum, -1);
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
  return { von, bis };
}
// Beendet die laufende Pause oder nimmt eine eingetragene zurück, die erst morgen beginnt (heute schon geübt: Pause ab morgen)
const pauseOffen = d => pauseJetzt(d) || (P.pausen || []).find(x => x.von > d) || null;
export function pauseBeenden() {
  const d = heute(); if (!pauseOffen(d)) return false;
  return eintrag('pe', { d });
}
function pauseEndeAnwenden(e) {
  const d = e.d, p = pauseOffen(d); if (!p) return false;
  if (p.von >= d) P.pausen = P.pausen.filter(x => x !== p); else p.bis = plusTage(d, -1);
  if (P.tage[d]?.ruhe && !P.tage[d].fertig.length) delete P.tage[d];   // was an dem Tag frei geübt wurde, bleibt stehen (tagesplan legt den Plan dazu)
  return true;
}

// ---------- Tagesplan ----------
export function pensumAm(datum) { return ruhetag(datum) ? 0 : Math.max(1, pensumFuer(datum)[wochentag(datum)] || 1); }
// übliches Pensum je Kalendertag (Wochenmittel samt Ruhetagen): daran hängt die Wahl des Regimes im Modell, nicht am Pensum eines einzelnen Tages
const pensumRegime = () => P.einst.pensum.reduce((a, b) => a + (b > 0 ? b : 0), 0) / 7 || undefined;
// übliches Pensum, wenn man an einem Ruhetag trotzdem übt
function pensumUeblich() { const t = P.einst.pensum.filter(x => x > 0); return Math.max(1, Math.round(t.reduce((a, b) => a + b, 0) / Math.max(1, t.length))); }
export function ketteAktiv(datum = heute()) {
  const z = P.kette.zuletzt; if (!z || !P.kette.n) return false;
  return z >= vorigerWirdTag(vorigerWirdTag(datum));
}
// schwach (Anzeige in Auswertung und Profil): viele Fehler je Durchgang, niedrige Stufe, Kontrolle offen
export const schwachWert = k => (k.fe / k.n) * 2 + (4 - k.st) + (k.kon ? 1 : 0);
// versäumte Wird-Tage unmittelbar vor datum, zurück bis zum letzten erfüllten Tag oder zum letzten Tag mit Übung
// (Ruhetage und Pause zählen nicht; wer täglich übt, ohne den Wird zu erfüllen, ist nicht „zurück“)
function ausgefallenSeit(zuletzt, datum) {
  let n = 0;
  for (let d = plusTage(datum, -1), i = 0; d > zuletzt && i < 400; d = plusTage(d, -1), i++) {
    if (P.tage[d]?.fertig?.length) break;
    if (!ruhetag(d)) n++;
  }
  return n;
}
// den Wiedereinstieg beenden: das übliche Pensum für heute auffüllen; cbEnde hält fest, dass er auch morgen nicht weiterläuft
export function comebackBeenden() {
  const d = heute(), t = tagesplan(d); if (!t.cb) return;
  eintrag('pa', { d, cbEnde: 1 });
  for (let i = P.tage[d].plan.length; i < pensumAm(d); i++) pensumHeuteAendern(1);
}
// Marke eines Platzes für „Heute“: die Art aus dem Plan (t.ma). Fehlt sie, weil der Abschnitt erst durch einen Umbau in den Plan kam
// (Reihenfolge, Bereich, ein Abschnitt mehr, Wechsel der Abschnittslänge), heißt ein nie geprüfter Abschnitt „Erstprüfung“ und nicht „Runde“;
// das gilt auch noch, nachdem er heute zum ersten Mal geprüft wurde.
export function platzMarke(t, id, datum = heute()) {
  const m = t?.ma?.[id]; if (m) return m;
  const k = P.karten[id];
  return !k?.n || (k.n === 1 && k.zul === datum && !!t?.fertig?.includes(id)) ? 'erst' : 'zyklus';
}
// Abschnitt, dessen Lektion gerade fertig wurde und der seither nicht geübt ist: sein erstes Wiedersehen ist keine Fehlerwiederholung
const frischGelernt = id => { const L = P.lern?.[id]; return L?.ph === 2 && !!L.e && P.karten[id]?.zul === L.e; };
export function tagesplan(datum = heute(), trotzdem = false) {
  const da = P.tage[datum];
  // ein Pausentag, dessen Pause vorzeitig beendet wurde, weicht dem echten Plan; was an dem Tag geübt wurde, bleibt stehen (planAnwenden)
  if (da && !(da.ruhe && (trotzdem || (da.ruhe === 'pause' && !ruhetag(datum))))) return da;
  if (ruhetag(datum) && !trotzdem) {
    eintrag('pl', { d: datum, t: { plan: [], art: {}, fertig: [], punkte: 0, hasanat: 0, r: 0, f: 0, h: 0, voll: false, qadaa: 0, ruhe: inPause(datum) ? 'pause' : 'ruhetag' } });
    return P.tage[datum];
  }
  const frei = ruhetag(datum);
  let n = frei ? pensumUeblich() : pensumAm(datum), qadaa = 0;
  // Wiedereinstieg: nach drei oder mehr versäumten Wird-Tagen drei Tage lang das halbe Pensum, ohne Rückstau (cb zählt die Tage)
  let cb = 0;
  if (!frei) {
    const vortag = P.tage[vorigerWirdTag(datum)], zl = P.kette.zuletzt;   // der vorige Wird-Tag, nicht der Kalendertag: ein Ruhetag unterbricht den Wiedereinstieg nicht
    if (vortag?.cbEnde) cb = 0;                                         // „wie sonst weitermachen“ gilt auch für die folgenden Tage
    else if (vortag?.cb && vortag.cb < 3) cb = vortag.cb + 1;
    else if (zl && ausgefallenSeit(zl, datum) >= 3) cb = 1;
  }
  if (cb) n = Math.max(1, Math.ceil(n / 2));
  // Qaḍāʾ: der letzte Wird-Tag ist ausgefallen, der davor war erfüllt, die Kette läuft → dessen Pensum nachholen
  const w1 = vorigerWirdTag(datum), w2 = vorigerWirdTag(w1), z = P.kette.zuletzt;
  if (!frei && P.kette.n > 0 && z && z >= w2 && z < w1) qadaa = pensumAm(w1);
  const plan = [], art = {}, ma = {}, karten = modellKarten(), tag = tagNr(datum);
  const e = LM.planen({ karten, reihe: reiheFuerPlan(datum, new Set()), tag, n: n + qadaa, kn: P.zyklus.kn || 0, kz: P.zyklus.kz || 0, nRegime: pensumRegime() });
  // art (Anzeige): eine Kontrolle nach Fehler heißt „fehler“, gleich über welchen Platz sie kommt; Qaḍāʾ sind die letzten Plätze, die keine Kontrolle sind.
  // ma: Art des Platzes im Modell (kontrolle, faellig, erst, zyklus, vorgezogen, lektion), für eine genauere Marke in „Heute“.
  e.plan.forEach(({ id, art: x }, i) => {
    const kon = karten[id]?.kon != null && karten[id].kon <= tag, lek = kon && frischGelernt(id);
    plan.push(id); ma[id] = lek ? 'lektion' : kon ? 'kontrolle' : x;
    art[id] = kon && !lek ? 'fehler' : qadaa && i >= e.plan.length - qadaa ? 'qadaa' : 'zyklus';
  });
  eintrag('pl', { d: datum, t: { plan, art, ma, fertig: [], punkte: 0, hasanat: 0, r: 0, f: 0, h: 0, voll: false, qadaa, gl: D.gliederung, fl: e.faellig, ...(cb ? { cb } : {}), ...(frei ? { freiwillig: true } : {}) }, kn: e.kn, kz: e.kz });
  return P.tage[datum];
}
// Tagesplan anwenden. Gibt es für den Tag schon einen Plan (zweites Gerät), bleibt der erste;
// nur ein Ruhetag-Eintrag weicht einem echten Plan („trotzdem üben“), was an dem Tag schon geübt wurde, bleibt stehen.
function planAnwenden(e) {
  const alt = P.tage[e.d], neu = kopie(e.t);
  if (alt && !(alt.ruhe && !neu.ruhe)) return;
  if (alt?.fertig.length) for (const f of ['fertig', 'punkte', 'hasanat', 'r', 'f', 'h', 'zeit', 'zn', 'za']) if (alt[f] != null) neu[f] = alt[f];
  P.tage[e.d] = neu;
  if (e.kn != null) P.zyklus.kn = e.kn;
  if (e.kz != null) P.zyklus.kz = e.kz;
  if (!neu.ruhe) aufraeumen(e.d);
}
// Tag für einen Abschluss, zu dem es keinen Plan gibt (Einträge aus einer älteren Generation)
function tagSicher(d) {
  return P.tage[d] ??= { plan: [], art: {}, fertig: [], punkte: 0, hasanat: 0, r: 0, f: 0, h: 0, voll: false, qadaa: 0, ohne: 1, gl: D.gliederung };
}
// an einem Ruhetag oder in der Pause trotzdem üben
export function trotzdemUeben() { return tagesplan(heute(), true); }
// Zufallszahlen mit Startwert: derselbe Tag ergibt denselben Vorschlag
function zufall(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) { h = Math.imul(h ^ text.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
// ---------- Gedächtnismodell je Abschnitt (lernmodell.js) ----------
// Stabilität S in Tagen: nach S Tagen sind noch 90 % behalten. Abrufwahrscheinlichkeit nach einer Potenzkurve. Für ältere Karten ohne S gilt ein Anfangswert nach Stufe.
const STUFE_S = [1, 3, 10, 30, 90];
export const stabilitaet = k => { const s = k.S ?? STUFE_S[k.st || 0]; return s > 0 && isFinite(s) ? s : 1; };   // nie 0, NaN oder leer (veränderte Datei, Stufe außerhalb 0 bis 4)
export const abruf = (tage, S) => LM.abruf(tage, S);
export const MODELL = LM.PAR;   // Zahlen des Modells (Tests und Anzeige)
// Stand der Regeln, nach denen ein Abschluss gewertet wird; jeder Abschluss trägt ihn (m). Ein späterer Wechsel der Regeln kann daran erkennen,
// welche Einträge er nicht nachrechnen darf. Einträge ohne m stammen aus 1.99 oder älter.
// Stand 3 (ab 2.02): Abhaken lässt bei nie geprüften Abschnitten kein S und keine Erstprüfung zurück, freies Üben am Ruhetag erfüllt den Wird
// (und Stand 3 trägt den stetigen Start bei der Erstprüfung, PAR.erstGamma). Einträge mit kleinerem m werden nach den alten Regeln nachgerechnet.
export const MODELL_STAND = 3;
// Fassung des Lernmodells (PAR.fassung): 'm1' bis 2.01, 'm2' ab dem stetigen Start bei der Erstprüfung. Das Profil trägt die Fassung, nach der sein Sockel angelegt wurde (modell, fehlt: 'm1').
// Bei einer neueren Fassung beginnt das Gerät mit Konto eine neue Generation (abgleich.js), damit Einträge der alten Fassung nie nach den neuen Regeln neu gerechnet werden.
export const FASSUNG = LM.PAR.fassung;
const fassungNr = f => { const n = /^m(\d{1,3})$/.exec(f ?? 'm1'); return n ? +n[1] : 1; };
export const modellAelter = () => !!P && !fremd && fassungNr(P.modell) < fassungNr(FASSUNG);
// Abschnitte mit Stand für das Modell (nur geprüfte, Lektionen in Arbeit bleiben außen vor)
function modellKarten() {
  const m = {};
  for (const id of reihe()) { const k = P.karten[id]; if (k?.n && k.zul && !(P.lern?.[id]?.ph < 2)) m[id] = { S: stabilitaet(k), zul: tagNr(k.zul), n: k.n, kon: k.kon ? tagNr(k.kon) : null }; }
  return m;
}
// Reihenfolge der Erstprüfung: Grundreihe, bei Zufall je Tag fest gemischt (derselbe Tag ergibt auf jedem Gerät dieselbe Folge)
function reiheFuerPlan(datum, ausser) {
  const r = reihe().filter(id => !ausser.has(id) && !(P.lern?.[id]?.ph < 2)), E = P.einst;
  if (E.reihenfolge !== 'zufall' || r.length < 2) return r;
  const rnd = zufall(`${datum}|${P.erstellt}|${[...ausser].join(',')}|${r.length}`);
  if (E.zufall === 'block') { const k = Math.floor(rnd() * r.length); return [...r.slice(k), ...r.slice(0, k)]; }
  const a = [...r]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a;
}
// die nächsten Abschnitte außerhalb von ausser (mehr Abschnitte heute, Reihenfolge geändert, Bereich geändert). neuMind: Guthaben für Erstprüfung
export function naechsteImZyklus(anzahl, ausser = new Set(), datum = heute(), neuMind = 0) {
  return LM.planen({ karten: modellKarten(), reihe: reiheFuerPlan(datum, ausser), tag: tagNr(datum), n: anzahl, kn: neuMind, kz: 0, nRegime: pensumRegime(), zusatz: false }).plan.map(x => x.id);
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
// plus und minus sind je eine Nummer (ein Abschnitt mehr oder weniger) oder eine Liste (Plan nach geändertem Bereich)
function pensumAnwenden(e) {
  const t = P.tage[e.d]; if (!t) return;
  if (e.cbEnde) { t.cbEnde = 1; return; }   // Wiedereinstieg beendet
  if (e.ers) {   // Reihenfolge geändert: die Abschnitte aus dem Zyklus werden durch neue ersetzt, Punkte und Erfolge des Tages bleiben, der Zähler beginnt neu
    const alt = new Set(e.raus || []);
    t.plan = [...t.plan.filter(id => !alt.has(id)), ...e.ers]; t.fertig = t.fertig.filter(id => !alt.has(id) || e.ers.includes(id));
    for (const id of alt) delete t.art[id]; for (const id of e.ers) t.art[id] = 'zyklus'; t.voll = false; return;
  }
  for (const id of [].concat(e.plus ?? [])) if (!t.plan.includes(id)) { t.plan.push(id); t.art[id] = 'zyklus'; t.voll = false; }
  for (const id of [].concat(e.minus ?? [])) if (t.plan.includes(id) && !t.fertig.includes(id) && t.plan.length > 1) { t.plan = t.plan.filter(x => x !== id); delete t.art[id]; }
}
// Reihenfolge ändern: Zyklus-Abschnitte von heute (fertig oder offen) und wie viele davon schon abgegeben sind
export function heuteZyklus() {
  const t = P.tage[heute()]; if (!t || t.ruhe) return { n: 0, fertig: 0 };
  const zy = t.plan.filter(id => t.art[id] === 'zyklus');
  return { n: zy.length, fertig: zy.filter(id => t.fertig.includes(id)).length, voll: !!t.voll };
}
export function heuteNeuAufbauen() {
  const d = heute(), t = P.tage[d]; if (!t || t.ruhe || t.voll) return 0;   // ist das Wird erfüllt, gilt die neue Reihenfolge erst ab morgen
  // Was heute schon geübt ist, bleibt und zählt weiter; ersetzt werden nur die offenen Plätze aus dem Zyklus
  const zy = t.plan.filter(id => t.art[id] === 'zyklus' && !t.fertig.includes(id)); if (!zy.length) return 0;
  const ers = naechsteImZyklus(zy.length, new Set(t.plan.filter(id => !zy.includes(id))), d, Math.ceil(zy.length / 2));
  if (!ers.length) return 0;
  eintrag('pa', { d, ers, raus: zy }); return ers.length;
}
// Abschnitte auf dem heutigen Plan, die noch offen sind und nicht (mehr) im gewählten Bereich liegen
export function heuteAusserhalb() {
  const t = P.tage[heute()]; if (!t || t.ruhe) return [];
  return t.plan.filter(id => !t.fertig.includes(id) && !imBereich(id));
}
// ersetzt sie durch die nächsten Abschnitte des Zyklus aus dem Bereich
export function heuteAnBereichAnpassen() {
  const d = heute(), raus = heuteAusserhalb(); if (!raus.length) return 0;
  const t = P.tage[d], rein = naechsteImZyklus(raus.length, new Set(t.plan.filter(id => !raus.includes(id))), d).filter(id => imBereich(id) && !t.plan.includes(id));
  eintrag('pa', { d, plus: rein, minus: raus });
  return raus.length;
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
  eintrag('fm', { d: heute(), w: [...schluessel], ja: 1, ...(art ? { a: art } : {}), ...(mit != null ? { m: mit } : {}) });   // ja: die Art zählt je Āya (ältere Einträge zählen je Eintrag einmal)
}
function merkenAnwenden(e) {
  P.statistik ??= { arten: {} };
  if (e.a) (P.statistik.arten ??= {})[e.a] = (P.statistik.arten[e.a] || 0) + (e.ja ? new Set(e.w.map(s => String(s).split('.')[0])).size : 1);
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
// Kurzübungen: Itqān-Punkte je richtig gelöster Aufgabe, nach Schwierigkeit 2 bis 5. Mit Hilfe zählt die Hälfte, am Tag gibt es höchstens KURZ_TAGESLIMIT Punkte.
export const KURZ_PUNKTE = { zeile: 2, titel: 3, uebergang: 3, mitte: 4, juz: 4, seite: 5, zwillinge: 5 };
export const KURZ_TAGESLIMIT = 50;
// faktor: 1 richtig, 0.5 mit Hilfe oder knapp daneben, 0 nicht gelöst. Gibt die gebuchten Punkte zurück (gedeckelt: das Tageslimit hat gekürzt).
export function kurzBuchen(art, faktor) {
  const basis = KURZ_PUNKTE[art] || 0, soll = faktor >= 1 ? basis : faktor > 0 ? Math.max(1, Math.floor(basis / 2)) : 0;
  if (!soll) return { punkte: 0, gedeckelt: false };
  const d = heute(), t = tagesplan(d), schon = t.kp || 0, p = Math.max(0, Math.min(soll, KURZ_TAGESLIMIT - schon));
  if (p) eintrag('ku', { d, a: art, p });
  return { punkte: p, gedeckelt: p < soll };
}
function kurzAnwenden(e) {
  const t = tagSicher(e.d); t.punkte = (t.punkte || 0) + e.p; t.kp = (t.kp || 0) + e.p;
  P.summe.punkte += e.p; P.summe.kurz = (P.summe.kurz || 0) + 1;
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
// ganzer Abschnitt am Stück: Fehler gehen vor Zögern; gezögert wird je Vers gewählt
export const ganzErgebnis = (ayat, fehlerVi, zoegernVi) => ayat.map(vi => fehlerVi.has(vi) ? 'fehler' : zoegernVi.has(vi) ? 'zoegern' : 'ok');

// ---------- Zwischenstand einer angefangenen Übung (gilt nur am selben Tag und für dieselbe Gliederung) ----------
const ZWISCHEN = 'itqan-zwischenstand';
// Je Abschnitt (und Quelle) ein Zwischenstand, alle unter einem Schlüssel: { tag, gliederung, liste: { 'id|quelle': erg }, zuletzt }.
// Sie gelten nur am selben Tag und in derselben Gliederung; am nächsten Tag ersetzt das erste Speichern die alten.
// Die frühere Form mit einem einzigen Stand ({ id, quelle, erg, tag, gliederung }) wird weiter gelesen.
const zwName = (id, quelle) => id + '|' + (quelle || '');
function zwischenstaende() {
  try {
    const z = JSON.parse(speicher.lesen(ZWISCHEN) || 'null');
    if (!z || z.tag !== heute() || z.gliederung !== D.gliederung) return {};
    if (z.liste && typeof z.liste === 'object') return { liste: z.liste, zuletzt: z.zuletzt };
    return Array.isArray(z.erg) ? { liste: { [zwName(z.id, z.quelle)]: z.erg }, zuletzt: zwName(z.id, z.quelle) } : {};
  } catch (e) { return {}; }
}
const zwForm = (name, erg) => { const i = name.indexOf('|'); return { id: +name.slice(0, i), quelle: name.slice(i + 1), erg, tag: heute(), gliederung: D.gliederung }; };
// der zuletzt gespeicherte Zwischenstand von heute (oder null)
export function zwischenstand() { const z = zwischenstaende(), n = z.liste && (z.zuletzt in z.liste ? z.zuletzt : Object.keys(z.liste)[0]); return n != null && Array.isArray(z.liste[n]) ? zwForm(n, z.liste[n]) : null; }
export function zwischenstandLaden(id, quelle = '') { const erg = zwischenstaende().liste?.[zwName(id, quelle)]; return Array.isArray(erg) ? zwForm(zwName(id, quelle), erg) : null; }
export function zwischenstandSpeichern(id, quelle, erg) {
  try { const liste = { ...(zwischenstaende().liste || {}), [zwName(id, quelle)]: erg }; speicher.schreiben(ZWISCHEN, JSON.stringify({ tag: heute(), gliederung: D.gliederung, liste, zuletzt: zwName(id, quelle) })); return true; }
  catch (e) { melden(speicherFehlerHaken, { art: 'zwischenstand', fehler: e }); return false; }
}
// ohne Angabe: alle Zwischenstände; mit Abschnitt (und Quelle): nur dieser, die anderen angefangenen Übungen bleiben
export function zwischenstandLoeschen(id, quelle = '') {
  try {
    if (id == null) { speicher.entfernen(ZWISCHEN); return; }
    const z = zwischenstaende(), liste = { ...(z.liste || {}) }; delete liste[zwName(id, quelle)];
    if (!Object.keys(liste).length) speicher.entfernen(ZWISCHEN);
    else speicher.schreiben(ZWISCHEN, JSON.stringify({ tag: heute(), gliederung: D.gliederung, liste, zuletzt: z.zuletzt in liste ? z.zuletzt : Object.keys(liste)[0] }));
  } catch (e) {}
}
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
// Alte Tage verdichten, Statistik behalten. plantag: der Tag des eben angewendeten Plans.
// Bezug ist der siebtjüngste Tag mit Übung, der nicht nach dem Plantag liegt: Tage in der Zukunft (falsch gestellte Uhr, fremder Eintrag
// vom Konto) zählen nie als Bezug, und ein einzelner falscher Tag verschiebt ihn nicht. Gelöscht wird nur, was mehr als 400 Tage vor dem
// Bezug liegt, höchstens sieben Tage je Aufruf und nie der Plantag selbst. Steht die Uhr vor allen Übungstagen, gibt es keinen Bezug.
// Ein Sprung von mehr als 400 Tagen zwischen zwei Übungstagen trennt die Tage in Abschnitte. Ein letzter Abschnitt mit weniger als
// BEZUG_ABSCHNITT Übungstagen ist nicht belegt (falsch gestellte Uhr, Gerät mit falscher Zeit am Konto) und liefert keinen Bezug: der Bezug
// kommt dann aus dem Abschnitt davor. Wer nach einer langen Pause zurückkehrt, verdichtet so erst nach BEZUG_ABSCHNITT Übungstagen.
// Tage mehr als zwei Tage nach dem echten heutigen Tag der Uhr zählen ebenfalls nie.
const BEZUG_TAGE = 7, BEZUG_ABSCHNITT = 30;
function aufraeumen(plantag) {
  if (!DATUM_M.test(plantag || '')) return;
  const tage = Object.keys(P.tage).sort(), grenze = plusTage(heute(), 2);
  let geuebt = tage.filter(d => d <= plantag && d <= grenze && P.tage[d].fertig?.length);
  for (let s; geuebt.length; geuebt = geuebt.slice(0, s)) {
    s = geuebt.length - 1; while (s > 0 && tageZwischen(geuebt[s - 1], geuebt[s]) <= 400) s--;
    if (s === 0 || geuebt.length - s >= BEZUG_ABSCHNITT) break;
  }
  const bezug = geuebt[geuebt.length - BEZUG_TAGE]; if (!bezug) return;
  let n = 0;
  for (const d of tage) { if (n >= 7 || d >= bezug || tageZwischen(d, bezug) <= 400) break; if (d === plantag) continue; delete P.tage[d]; n++; }
}

// ---------- Neu lernen: ein Lernplan in drei Schritten (Ḥifẓ, Ḍabṭ, Itqān), danach geht der Abschnitt in die Wiederholung ----------
// Eine Lektion ist ein Abschnitt außerhalb des Bereichs. P.lern[id] = { b: Beginn, ph: 0 aktiv | 2 fertig (im Bereich),
// ft: Tage mit fehlerfreiem Durchgang, zul: letzter Durchgang, e: Tag des Abschlusses }. Fehlerfrei heißt: ohne Fehler und ohne Hilfe.
// Pro Tag zählt höchstens ein Durchgang. Die Zahl der Tage ist der Schritt: 0 Ḥifẓ (aufnehmen), 1 Ḍabṭ (absichern), 2 Itqān (meistern);
// nach dem dritten fehlerfreien Tag ist die Lektion fertig und der Abschnitt gehört zum Bereich (zur Murāǧaʿa).
// Die drei Stufen sind das Dach über den fünf Schritten der Karte: Ḥifẓ = 0 und 1, Ḍabṭ = 2 und 3, Itqān = 4.
export const LERN = { schritte: 3 };
export const lernbar = id => !!D.A[id] && !imBereich(id) && !(P.lern?.[id]?.ph < 2);   // auch ein früher gelernter Abschnitt, der wieder aus dem Bestand genommen wurde
export const lernProTag = () => Math.max(1, Math.min(5, Math.round(+P.einst.lernProTag) || 1));
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
    const st = offeneStellen(+id), schritte = L.ft.length;
    return { id: +id, ph: L.ph, schritte, st: Math.min(2, schritte), seit: L.b, zul: L.zul || null, heute: L.ft.includes(d), geuebt: L.zul === d, offen: st.length, stellen: [...new Set(st)] };
  }).sort((a, b) => a.seit.localeCompare(b.seit) || a.id - b.id);
}
// Was Heute aus dem Lernplan zeigt: so viele, wie pro Tag eingestellt sind; was heute schon gezählt hat, behält seinen Platz
// Ḥifẓ-Tempo: neue Lektionen beginnen nur, wenn die Wiederholung im Griff ist (lernmodell.js); angefangene laufen immer weiter.
// Angefangen ist eine Lektion mit dem ersten Durchgang, auch wenn er noch nicht fehlerfrei war.
const begonnen = l => l.schritte > 0 || l.heute || !!l.zul;
// Gezählt wird, was jetzt fällig ist (was heute schon geübt wurde, zählt nicht mehr), gemessen am üblichen Pensum.
// Nach der Umstellung eines älteren Stands zählen nur Abschnitte, die im neuen Modell schon einen Durchgang hatten. Legt keinen Plan an.
export function lernErlaubt() {
  const d = heute(), t = P.tage[d];
  if (t ? t.ruhe : ruhetag(d)) return { ok: true, grund: 'ruhe' };
  const karten = modellKarten(), ab = P.umgestellt ? tagNr(P.umgestellt) : null;
  if (ab != null) for (const id of Object.keys(karten)) if (karten[id].zul <= ab) delete karten[id];
  const faellig = LM.planen({ karten, reihe: Object.keys(karten).map(Number), tag: tagNr(d), n: 0 }).faellig;
  return LM.lernTempo({ n: pensumUeblich(), faellig, offen: lektionen().filter(begonnen).length });
}
export function lernHeute() {
  const alle = lektionen(), lauf = alle.filter(begonnen), warte = alle.filter(l => !lauf.includes(l));
  return [...lauf.filter(l => l.heute), ...lauf.filter(l => !l.heute), ...(lernErlaubt().ok ? warte : [])].slice(0, lernProTag());
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
function lernSchritt(L, k, id, datum, f, h, ereignisse) {
  const vor = L.ft.length, rein = !f && !h, neu = rein && !L.ft.includes(datum);
  if (neu) L.ft.push(datum);
  if (L.ft.length >= LERN.schritte) {   // fertig: der Abschnitt gehört zum Bestand, das erste Wiedersehen ist als Kontrolle am Folgetag gesichert
    const nl = LM.nachLektion(tagNr(datum));
    L.ph = 2; L.e = datum; k.S = nl.S; k.kon = nrTag(nl.kon); bereichAufnehmen(id);
  }
  L.zul = datum;
  k.st = L.ph === 2 ? 2 : Math.min(1, L.ft.length);
  if (L.ph === 2 && vor < LERN.schritte) ereignisse.push({ typ: 'lernstufe', id, ph: 2 });
  return { vor, schritte: L.ft.length, ph: L.ph, rein, neu, offen: offeneStellen(id).length };
}

// ---------- Ergebnis eines Abschnitts ----------
// ergebnisse: Array von 'ok' | 'hilfe' | 'fehler' je Āya (in Reihenfolge v[0]..v[1])
// dauer: aktive Übungszeit in Sekunden (ohne Zeit im Hintergrund), fehlt bei fortgesetzten Übungen
// Ein zweiter Durchgang am selben Tag zählt für den Plan, bringt aber keine Punkte und keinen Aufstieg (Rückgabe wiederholung: true).
export function abschnittAbschliessen(id, ergebnisse, quelle, dauer) {
  // Das Ergebnis muss zum Abschnitt passen: je Āya genau ein bekannter Wert. Sonst zählte ein leeres Array als fehlerfreier Durchgang.
  if (!D.A[id] || !Array.isArray(ergebnisse) || ergebnisse.length !== D.A[id].ayat || ergebnisse.some(x => !Object.hasOwn(ERG_KURZ, x))) throw new Error('ergebnis-ungueltig ' + id);   // Kennwort für Protokoll und Tests; die Oberfläche zeigt dazu ihren eigenen Text (ueben.abschluss_fehler)
  // Hat ein anderer Reiter inzwischen geschrieben, gilt dessen Stand schon für Punkte und Wiederholung, nicht erst für den Eintrag
  if (!fremd && speicherAbgleichen() && P.gliederung !== D.gliederung) throw new Error('Gliederung in einem anderen Fenster gewechselt');
  const datum = heute(), t = tagesplan(datum);
  const r = ergebnisse.filter(x => x === 'ok').length, h = ergebnisse.filter(x => x === 'hilfe').length, f = ergebnisse.filter(x => x === 'fehler').length, z = ergebnisse.filter(x => x === 'zoegern').length;
  if (quelle === 'lern' && !(P.lern?.[id]?.ph < 2)) quelle = 'frei';
  const art = quelle || t.art[id] || 'frei';
  // Punkte: Rückmeldung über Können
  let punkte = 10 * r + 5 * h + 5 * z, teile = [[tx('zustand.ayat_richtig', { r }), 10 * r]];
  if (h) teile.push([tx('zustand.mit_hilfe', { h }), 5 * h]);
  if (z) teile.push([tx('zustand.gezoegert', { z }), 5 * z]);
  if (!f && !h && !z) { const b = Math.round(punkte * 0.25); punkte += b; teile.push([tx('zustand.fehlerfrei'), b]); }
  if (art === 'bonus') { const b = Math.round(punkte * 0.5); punkte += b; teile.push([tx('zustand.bonusabschnitt_50'), b]); }
  const kp = kettenBonus(kettenTage()).p;
  if (kp) { const b = Math.round(punkte * kp / 100); punkte += b; teile.push([tx('zustand.kette', { kp }), b]); }
  const k0 = karte(id), vorherStand = { n: k0.n, S: k0.n ? stabilitaet(k0) : null, zul: k0.zul };
  // Wie im Modell und bei den Lektionen zählt je Abschnitt und Tag ein Durchgang: die Wiederholung am selben Tag bringt keine Punkte (Ḥasanāt bleiben)
  const wdh = art !== 'lern' && k0.n > 0 && k0.zul === datum && k0.ah !== datum;
  if (wdh) { punkte = 0; teile = []; }
  // Der Eintrag hält fest, was geübt wurde und welche Punkte dafür angezeigt wurden (p)
  // hw: seit 1.17 zählt eine Āya mit Hilfe für Stufe und Wiederholung wie ein Fehler (ältere Einträge ohne hw bleiben bei der alten Regel)
  const erg = eintrag('ab', { d: datum, id, v: [...D.A[id].v], e: ergebnisse.map(x => ERG_KURZ[x] || '-').join(''), q: art, ...(dauer > 0 ? { s: Math.round(dauer) } : {}), p: punkte, ...(h ? { hw: 1 } : {}), m: MODELL_STAND });
  try { abschlussHaken?.({ id, art, v: ergebnisse.length, f, h, z, vorher: vorherStand, datum, pensum: t.plan.length, gliederung: D.gliederung, profil: P.erstellt || '' }); } catch (e) {}
  return { punkte, teile, hasanat: erg.hasanat, r, f, h: h + z, ereignisse: erg.ereignisse, stufe: erg.stufe, vorher: erg.vorher, lern: erg.lern, wiederholung: wdh };
}
const ERG_KURZ = { ok: 'o', hilfe: 'h', fehler: 'f', zoegern: 'z' };
// Nachträglich abhaken: außerhalb der App geübt (Gebet, unterwegs). Zählt für Tagesplan und Zyklus, ohne Punkte, Hasanat und Stufenänderung
// kb: Eine offene Kontrolle nach einem Fehler bleibt stehen (Audit N4): Abhaken erfüllt den Wird, die Prüfung in der App kommt trotzdem. Ältere Einträge ohne kb bleiben bei der alten Regel.
// Ein nie in der App geprüfter Abschnitt bleibt ungeprüft (m ab 3): kein S, kein Durchgang, die Erstprüfung kommt noch. Für den Wird und den Zyklus zählt das Abhaken trotzdem.
const ABHAKBAR = ['zyklus', 'qadaa', 'festigen', 'fehler'];   // alles, was zum Wird zählt; Bonus und freies Üben stehen nicht im Plan (festigen: nur noch in älteren Plänen)
export function abschnittAbhaken(id) {
  const datum = heute(), t = tagesplan(datum); if (t.fertig.includes(id) || !ABHAKBAR.includes(t.art[id])) return null;
  return eintrag('ab', { d: datum, id, v: [...D.A[id].v], e: 'a'.repeat(D.A[id].ayat), q: t.art[id], p: 0, kb: 1, m: MODELL_STAND });
}
export function heuteAbhakbar() {
  const t = P.tage[heute()]; if (!t || t.ruhe) return [];
  return t.plan.filter(id => ABHAKBAR.includes(t.art[id]) && !t.fertig.includes(id));
}
// z: gezögert, zählt halb, ohne Stufenverlust; a: abgehakt (außerhalb der App geübt)
function abschlussAnwenden(e0) {
  const datum = e0.d, id = e0.id, t = tagSicher(datum), e = D.A[id], k = { ...karte(id) };
  const ergebnisse = [...e0.e].slice(0, e.ayat), art = e0.q, punkte = e0.p, dauer = e0.s || 0;   // nie mehr Werte, als der Abschnitt Āyāt hat
  const r = ergebnisse.filter(x => x === 'o').length, h = ergebnisse.filter(x => x === 'h').length, f = ergebnisse.filter(x => x === 'f').length, z = ergebnisse.filter(x => x === 'z').length;
  const ab = ergebnisse.length > 0 && ergebnisse.every(x => x === 'a');   // außerhalb der App geübt
  const hasanat = ab ? 0 : e.buchstaben * 10;
  // Karteisystem
  const vorher = k.st, ereignisse = [];
  // Neu lernen: eine offene Lektion folgt ihren eigenen Regeln, nicht dem Karteisystem
  const L = art === 'lern' && P.lern?.[id]?.ph < 2 ? P.lern[id] : null;
  const lern = L ? lernSchritt(L, k, id, datum, f, h + z, ereignisse) : null;
  const wdh = !L && !ab && k.n > 0 && k.zul === datum && k.ah !== datum;   // zweiter Durchgang am selben Tag (ein bloß abgehakter zählt nicht als erster)
  if (L) { /* Stufe steht schon */ }
  else if (ab) { /* Stufe bleibt, wie sie ist */ }
  else if (f || (e0.hw && h)) { const u = f + (e0.hw ? h : 0); k.st = Math.max(0, k.st - (u / ergebnisse.length > 0.3 ? 2 : 1)); }
  else if (h || z) { /* Stufe bleibt */ }
  else if (!wdh) k.st = Math.min(4, k.st + 1);   // Aufstieg höchstens einmal je Abschnitt und Tag; ein Fehler senkt weiterhin
  // Gedächtnismodell: Stabilität wächst bei Erfolg umso stärker, je mehr vergessen war; Fehler senken sie nach dem Anteil falscher Verse; deutlicher Fehler: Kontrolle am Folgetag
  const konBleibt = ab && e0.kb === 1 && k.kon != null;   // abgehakt bei offener Kontrolle: Modell und letzter Übungstag bleiben, wie sie sind
  const nieGeprueft = ab && e0.kb === 1 && (e0.m || 0) >= 3 && !k.n && !L;   // abgehakt, in der App noch nie geprüft: kein S, kein Durchgang, die Erstprüfung bleibt offen
  if (!L && !konBleibt && !nieGeprueft) {
    const alt = k.n && k.zul ? { n: k.n, S: stabilitaet(k), zul: tagNr(k.zul), kon: k.kon ? tagNr(k.kon) : null, lt: k.lt ?? null } : null;
    const ne = LM.nachUebung(alt, tagNr(datum), ab ? { v: ergebnisse.length, f: 0, z: 1 } : { v: ergebnisse.length, f: f + (e0.hw ? h : 0), z: z + (e0.hw ? 0 : h) }, (e0.m || 0) >= 3 ? LM.PAR : { ...LM.PAR, erstGamma: 0 });
    k.S = Math.round(ne.S * 100) / 100; k.kon = ne.kon != null ? nrTag(ne.kon) : null; if (ne.lt != null) k.lt = ne.lt;
  }
  if (!nieGeprueft) k.n++;
  k.fe += f; if (!konBleibt) k.zul = datum;
  if (dauer > 0) { k.z = Math.round(dauer); t.zeit = (t.zeit || 0) + k.z; t.zn = (t.zn || 0) + 1; t.za = (t.za || 0) + ergebnisse.length; }
  if (ab) k.ah = datum;
  else {   // lf: Fehler im letzten Durchgang, fa: seine Āyāt. Ein zweiter Durchgang am selben Tag kann beides nur verschlechtern.
    const fa = ergebnisse.map((x, i) => x !== 'o' ? e.v[0] + i : -1).filter(i => i >= 0);
    delete k.ah;
    if (wdh) { k.fa = [...new Set([...(k.fa || []), ...fa])].sort((a, b) => a - b); k.lf = Math.max(k.lf || 0, f); } else { k.fa = fa; k.lf = f; }
  }
  P.karten[id] = k;
  // Tag und Summen
  if (!t.fertig.includes(id)) t.fertig.push(id);
  if (['zyklus', 'fehler', 'festigen', 'qadaa'].includes(art) && !t.plan.includes(id)) { t.plan.push(id); t.art[id] = art; }   // Abschluss eines geplanten Abschnitts, dessen Plan dieses Gerät nicht kennt (Wiederherstellung, andere Generation): er zählt heute mit
  if (art === 'bonus' && !t.plan.includes(id)) { t.plan.push(id); t.art[id] = 'bonus'; }
  Object.assign(t, { punkte: t.punkte + punkte, hasanat: t.hasanat + hasanat, r: t.r + r, f: t.f + f, h: t.h + h + z });
  Object.assign(P.summe, { punkte: P.summe.punkte + punkte, hasanat: P.summe.hasanat + hasanat, r: P.summe.r + r, f: P.summe.f + f, h: P.summe.h + h + z, abschnitte: P.summe.abschnitte + 1 });
  // Zyklus / Ḫatma
  // Die Vollständigkeit wird bei jedem zählenden Abschluss geprüft, nicht nur bei einem neuen Abschnitt: nach einem verkleinerten Bestand
  // bliebe die Runde sonst bei 100 % stehen. Ein leerer Bestand ergibt keine Ḫatma.
  if (art !== 'frei' && art !== 'lern') {
    if (!P.zyklus.erledigt.includes(id)) P.zyklus.erledigt.push(id);
    const r = reihe(), erl = new Set(P.zyklus.erledigt);
    if (r.length && r.every(x => erl.has(x))) {
      P.zyklus.khatma++; P.zyklus.erledigt = []; P.zyklus.beginn = datum; (P.meilenD ??= {})['khatma-' + P.zyklus.khatma] = datum;
      if (!P.einst.bereich) P.zyklus.voll = (P.zyklus.voll || 0) + 1;   // Ḫatma über den ganzen Qurʾān
      ereignisse.push({ typ: 'khatma', n: P.zyklus.khatma });
    }
  }
  // Wird erfüllt → Kette. In der Pause und bei leerem Plan gibt es keinen Wird, den freies Üben erfüllen könnte.
  // An einem Ruhetag zählt freies Üben als Wird (Entscheidung 22.11.2026, ab m 3; frühere Einträge ohne diese Regel bleiben, wie sie waren).
  const pflicht = t.plan.filter(x => t.art[x] !== 'bonus');
  const ruhetagFrei = t.ruhe === 'ruhetag' && !t.plan.length && (e0.m || 0) >= 3 && reihe().length > 0;
  if (art !== 'lern' && !t.voll && ((!t.ohne && (ruhetagFrei || (!t.ruhe && pflicht.length > 0 && pflicht.every(x => t.fertig.includes(x))))) || e0.w)) {
    t.voll = true;
    const vorBonus = kettenBonus(ketteAktiv(datum) ? P.kette.n : 0).p;
    const z = P.kette.zuletzt, w1 = vorigerWirdTag(datum);
    if (z === datum) { /* schon gezählt */ }
    else if (z && z >= w1) P.kette.n++;
    else if (z && t.qadaa && z >= vorigerWirdTag(w1)) P.kette.n += 2;
    else P.kette.n = 1;
    P.kette.zuletzt = datum; P.kette.beste = Math.max(P.kette.beste, P.kette.n);
    ereignisse.push({ typ: 'wird' });
    { const nb = kettenBonus(P.kette.n).p; if (nb > vorBonus) ereignisse.push({ typ: 'kbonus', n: P.kette.n, p: nb }); }
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
// mindestens gefestigt / sicher / mutqan), offen0 (keine Kontrolle nach Fehler offen)
export const RAENGE = [
  { get n() { return tx('zustand.mubtadi'); }, ar: 'مُبْتَدِئ', get de() { return tx('zustand.der_beginnende'); }, get hifz() { return tx('zustand.du_hast_mit_der_geordneten_muragaa'); }, b: {} },
  { get n() { return tx('zustand.murid'); }, ar: 'مُرِيد', get de() { return tx('zustand.der_wollende_der_strebende'); }, get hifz() { return tx('zustand.die_absicht_ist_gefasst_und_durch_taten'); }, b: { punkte: 1000 } },
  { get n() { return tx('zustand.muwazib'); }, ar: 'مُوَاظِب', get de() { return tx('zustand.der_bestaendige'); }, get hifz() { return tx('zustand.die_wiederholung_hat_einen_festen_platz'); }, b: { punkte: 5000, kette: 7 } },
  { get n() { return tx('zustand.mutaahid'); }, ar: 'مُتَعَاهِد', get de() { return tx('zustand.der_der_den_quran_pflegt'); }, get hifz() { return tx('zustand.nach_dem_hadit_taahadu_hada_l_quran_er'); }, b: { punkte: 15000, kette: 40 } },
  { get n() { return tx('zustand.murabit'); }, ar: 'مُرَابِط', get de() { return tx('zustand.der_auf_seinem_posten_ausharrende'); }, get hifz() { return tx('zustand.du_haeltst_deinen_bereich_gegen_das'); }, b: { punkte: 30000, quote: 75 } },
  { get n() { return tx('zustand.hatim'); }, ar: 'خَاتِم', get de() { return tx('zustand.der_vollendende'); }, get hifz() { return tx('zustand.eine_ganze_runde_durch_deinen_bereich'); }, b: { punkte: 60000, khatma: 1, quote: 85 } },
  { get n() { return tx('zustand.mustahdir'); }, ar: 'مُسْتَحْضِر', get de() { return tx('zustand.der_den_quran_gegenwaertig_hat'); }, get hifz() { return tx('zustand.der_ganze_quran_ist_einmal_vollstaendig'); }, b: { punkte: 100000, ganz: 1, voll: 1, quote: 88 } },
  { get n() { return tx('zustand.dabit'); }, ar: 'ضَابِط', get de() { return tx('zustand.der_genaue'); }, get hifz() { return tx('zustand.dabt_heisst_in_den_haditwissenschaften'); }, b: { punkte: 180000, ganz: 1, voll: 2, quote: 92, st2: 50 } },
  { get n() { return tx('zustand.hadiq'); }, ar: 'حَاذِق', get de() { return tx('zustand.der_geuebte_der_kundige'); }, get hifz() { return tx('zustand.in_den_alten_quranschulen_hiess_der'); }, b: { punkte: 270000, ganz: 1, voll: 3, quote: 94, st2: 75 } },
  { get n() { return tx('zustand.rasih'); }, ar: 'رَاسِخ', get de() { return tx('zustand.der_fest_verwurzelte'); }, get hifz() { return tx('zustand.wie_ar_rasihuna_fi_l_ilm_3_7_fehler_sind'); }, b: { punkte: 360000, ganz: 1, voll: 4, quote: 96, st3: 50 } },
  { get n() { return tx('zustand.mutqin'); }, ar: 'مُتْقِن', get de() { return tx('zustand.der_meisterhafte'); }, get hifz() { return tx('zustand.vom_selben_stamm_wie_itqan_der_quran'); }, b: { punkte: 450000, ganz: 1, voll: 5, quote: 98, st3: 80, st4: 30 } },
  { get n() { return tx('zustand.tabt'); }, ar: 'ثَبْت', get de() { return tx('zustand.der_verlaessliche'); }, get hifz() { return tx('zustand.tiqa_tabt_ist_das_hoechste_lob_fuer'); }, b: { punkte: 630000, ganz: 1, voll: 7, quote: 99, st4: 75 } },
  { get n() { return tx('zustand.mutqin_mutlaq'); }, ar: 'مُتْقِنٌ مُطْلَق', get de() { return tx('zustand.der_uneingeschraenkt_meisterhafte'); }, get hifz() { return tx('zustand.jede_stelle_des_ganzen_quran_sitzt_ohne'); }, b: { punkte: 900000, ganz: 1, voll: 10, quote: 100, st4: 100, offen0: 1 } }
];
export function kennzahlen() {
  const ids = reihe(); let ay = 0, ok = 0, offen = 0; const st = [0, 0, 0, 0, 0];
  for (const id of ids) {
    const e = D.A[id], k = karte(id);
    ay += e.ayat; if (k.n) ok += e.ayat - Math.min(e.ayat, k.fa?.length || 0);
    st[k.st >= 0 && k.st <= 4 ? k.st | 0 : 0]++; if (k.kon) offen++;
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
// Reihe für das Punkte-Diagramm im Profil: 'tage' (30), 'wochen' (12, Montag bis Sonntag) oder 'monate' (12 bis 36, je nach Alter des Profils)
export function punkteReihe(art) {
  const alle = {}; for (const [d, t] of Object.entries(P.tage || {})) if (t?.punkte) alle[d] = t.punkte;
  Object.assign(alle, P.verlauf || {});
  const h = heute(), tag = d => alle[d] || 0, r = [];
  if (art === 'wochen') {
    const w0 = plusTage(h, -wochentag(h));
    for (let i = 11; i >= 0; i--) { const s = plusTage(w0, -7 * i); let p = 0; for (let k = 0; k < 7; k++) p += tag(plusTage(s, k)); r.push({ d: s, p }); }
  } else if (art === 'monate') {
    const summe = {}; for (const [d, p] of Object.entries(alle)) summe[d.slice(0, 7)] = (summe[d.slice(0, 7)] || 0) + p;
    const jetzt = h.slice(0, 7), [jy, jm] = jetzt.split('-').map(Number), erste = Object.keys(summe).sort()[0] || jetzt, [ey, em] = erste.split('-').map(Number);
    const n = Math.max(12, Math.min(36, (jy - ey) * 12 + (jm - em) + 1));
    for (let i = n - 1; i >= 0; i--) { const dt = new Date(jy, jm - 1 - i, 1), m = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`; r.push({ d: m, p: summe[m] || 0 }); }
  } else for (let i = 29; i >= 0; i--) { const d = plusTage(h, -i); r.push({ d, p: tag(d) }); }
  return r;
}
export function letzteTage(n = 30) {
  const aus = [];
  for (let i = n - 1; i >= 0; i--) { const d = plusTage(heute(), -i); aus.push({ d, t: P.tage[d] || null }); }
  return aus;
}
// Auswertung: Fehlerarten, Sūren, Quote, Zeit
// Behaltensquote: Anteil der Āyāt der letzten Tage, die ohne Fehler, ohne Hilfe und ohne Zögern kamen.
// Gezählt wird jeder Durchgang der Tage (auch freie Übungen, Bonus, Lektionen und ein zweiter Durchgang am selben Tag), nachträglich Abgehaktes nicht
export function behaltensquote(tage = 30) {
  let r = 0, n = 0;
  for (let i = 0; i < tage; i++) { const t = P.tage[plusTage(heute(), -i)]; if (t) { r += t.r || 0; n += (t.r || 0) + (t.f || 0) + (t.h || 0); } }
  return { quote: n >= 10 ? 100 * r / n : null, n, ziel: Math.round(100 * LM.PAR.rZiel) };
}
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
// Dauer einer Ḫatma in Tagen bei gleichmäßigem Umlauf
// Empfehlung für die Tagesmenge je Gebiet (N Abschnitte): mindestens die Hälfte der Plätze gehört der Erstprüfung, der erste Durchlauf dauert also höchstens etwa N / (0,5 n) Tage.
// minimal: erster Durchlauf in etwa 18 Monaten, ideal: in etwa 9 Monaten (Simulation: dann sitzt nach einem Jahr fast alles).
export function pensumEmpfehlung(N = reihe().length) {
  const anteil = LM.PAR.neuMin;   // mindestens die Hälfte der Plätze gehört der Erstprüfung, solange es Ungeprüftes gibt
  const tage = n => Math.round(N / (anteil * Math.max(0.1, n)));
  return { N, minimal: Math.max(1, Math.ceil(N / 190)), ideal: Math.max(1, Math.ceil(N / 95)), tage };
}
// Dauer der ersten Ḫatma in Tagen nach dem Modell, bei fehlerfreiem Üben (mit Fehlern bis etwa pensumEmpfehlung().tage, siehe khatmaSpanne).
// Im Umlauf führt jeder Platz weiter. Sonst gehört der Erstprüfung zuerst der hohe Anteil (neuMax); nach sErstSauber Tagen wird das zuerst
// Geprüfte fällig, binnen etwa einer Woche sinkt der Anteil auf neuMin. Ist schon alles geprüft, führt jeder Platz weiter (untere Grenze).
// Gegen die Simulation geprüft (tests/modell_regeln.test.mjs).
export function tageProKhatma() {
  const r = reihe();
  return tageNachModell(r.length, P.einst.pensum.reduce((a, b) => a + (b > 0 ? b : 0), 0) / 7, r.some(id => !karte(id).n));
}
// N Abschnitte, n am Tag; ungeprueft: es gibt noch Abschnitte ohne Erstprüfung
function tageNachModell(N, n, ungeprueft) {
  n = Math.max(0.1, n); const par = LM.PAR;
  if ((par.umlaufAb > 0 && N / n > par.umlaufAb) || !ungeprueft) return Math.ceil(N / n);
  const t1 = par.sErstSauber, a1 = par.neuMax * n * t1; if (N <= a1) return Math.ceil(N / (par.neuMax * n));
  const tu = 8, qm = (par.neuMax + par.neuMin) / 2, a2 = qm * n * tu; if (N <= a1 + a2) return Math.ceil(t1 + (N - a1) / (qm * n));
  return Math.ceil(t1 + tu + (N - a1 - a2) / (par.neuMin * n));
}
// Spanne für die Anzeige: von fehlerfrei (tageProKhatma) bis zur Obergrenze bei viel Fälligem (mindestens die Hälfte der Plätze führt weiter)
export function khatmaSpanne() {
  const von = tageProKhatma(), n = Math.max(0.1, P.einst.pensum.reduce((a, b) => a + (b > 0 ? b : 0), 0) / 7);
  return { von, bis: Math.max(von, pensumEmpfehlung().tage(n)) };
}
// Dieselbe Spanne ohne Profil (Startseite): N Abschnitte, n am Tag, noch nichts geprüft
export function khatmaSpanneFuer(N, n) {
  n = Math.max(0.1, +n || 0); N = Math.max(0, +N || 0);
  const von = tageNachModell(N, n, true);
  return { von, bis: Math.max(von, pensumEmpfehlung(N).tage(n)) };
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
// Liest eine Profildatei und prüft sie streng (profilPruefen). echt heißt nur: seit dem Sichern nicht versehentlich verändert.
// Die Prüfsumme hat kein Geheimnis, sie ist kein Echtheitsnachweis: wer die Datei ändert, kann sie neu berechnen.
const IMPORT_MAX = 8e6;
export async function importDatei(text) {
  const nein = () => new Error(tx('zustand.keine_itqan_profildatei'));
  if (typeof text !== 'string' || text.length > IMPORT_MAX) throw nein();
  let o; try { o = JSON.parse(text); } catch (e) { throw nein(); }
  if (!istObj(o) || o.format !== 'itqan-profil' || !istObj(o.profil) || o.profil.format !== 'itqan') throw nein();
  const echt = typeof o.pruef === 'string' && (await pruefsumme(JSON.stringify(o.profil))) === o.pruef;
  profilPruefen(o.profil);
  const exportiert = textGut(o.exportiert, 40) && Date.parse(o.exportiert) > 0 ? o.exportiert : undefined;
  return { profil: o.profil, echt, exportiert };
}

// ---------- Prüfung eines Profils aus fremder Hand (Datei, Stand vom Konto, Schülerdatei) ----------
// Streng nach Form und Typ: Zahlenfelder sind Zahlen, Daten haben das Datumsmuster, Texte sind kurz und ohne Zeichen, die in HTML etwas bedeuten.
// Unbekannte Felder sind erlaubt, solange sie nur aus solchen harmlosen Werten bestehen (spätere Versionen dürfen Felder ergänzen).
// Einzige Ausnahme ist der Name: er darf jedes sichtbare Zeichen enthalten und muss in der Oberfläche immer durch esc laufen.
const DATUM_M = /^\d{4}-\d{2}-\d{2}$/, NUMMER_M = /^\d{1,5}$/, PAAR_M = /^\d{1,5}-\d{1,5}$/;
const GLIEDERUNGEN = ['fort-1', 'fort-2', 'anf-1', 'seite-v1', 'seite-v2'], VERBOTEN = ['__proto__', 'constructor', 'prototype'];   // Schlüssel, die nie als Feld gelten
const zahlGut = (x, min = 0, max = 1e13) => typeof x === 'number' && isFinite(x) && x >= min && x <= max;
const ganzGut = (x, min = 0, max = 1e6) => Number.isInteger(x) && x >= min && x <= max;
const textGut = (x, max = 200) => typeof x === 'string' && x.length <= max && !/[<>"'&`\u0000-\u001f\u007f]/.test(x) && !VERBOTEN.includes(x);
const nameGut = x => typeof x === 'string' && x.length <= 200 && !/[\u0000-\u001f\u007f]/.test(x);
const datumGut = x => typeof x === 'string' && DATUM_M.test(x);
const leerOder = (x, f) => x == null || f(x);
const listeGut = (x, f, max = 20000) => Array.isArray(x) && x.length <= max && x.every(f);
const objGut = (x, f, max = 20000) => { if (!istObj(x)) return false; const e = Object.entries(x); return e.length <= max && e.every(y => !VERBOTEN.includes(y[0]) && f(y)); };
function harmlos(x, tiefe = 0) {
  if (x == null || typeof x === 'boolean') return true;
  if (typeof x === 'number') return isFinite(x);
  if (typeof x === 'string') return textGut(x, 2000);
  if (tiefe > 8 || typeof x !== 'object') return false;
  if (Array.isArray(x)) return x.length <= 50000 && x.every(y => harmlos(y, tiefe + 1));
  const k = Object.keys(x); return k.length <= 50000 && k.every(s => textGut(s, 100) && harmlos(x[s], tiefe + 1));
}
function einstWertGut(k, w) {
  switch (k) {
    case 'pensum': return listeGut(w, x => ganzGut(x, 0, 200), 7) && w.length === 7;
    case 'bereich': return w === null || listeGut(w, x => ganzGut(x, 0, 99999));
    case 'auswahl': return listeGut(w, x => Array.isArray(x) && x.length === 2 && ganzGut(x[0], 0, 9999) && ganzGut(x[1], x[0], 9999));
    case 'modus': return ['anf', 'fort', 'seite'].includes(w);
    case 'reihenfolge': return ['vorwaerts', 'rueckwaerts', 'zufall'].includes(w);
    case 'tagesbeginn': return (typeof w === 'number' || typeof w === 'string') && zahlGut(+w, 0, 23);
    default: return harmlos(w);
  }
}
// Einstellungs-Eintrag aus dem Protokoll (auch vom Konto): Schlüssel und Wert der erwarteten Form
function einstEintragGut(e) {
  if (e.k === 'name') return !('w' in e) || e.w == null || nameGut(e.w);
  return typeof e.k === 'string' && /^einst\.\w{1,40}$/.test(e.k) && !VERBOTEN.includes(e.k.slice(6)) && (!('w' in e) || einstWertGut(e.k.slice(6), e.w));
}
// Ein Eintrag des Protokolls aus fremder Hand (Konto, anderes Gerät): Kennung, Zeit, bekannte Art und je Art die Felder in Typ und Wertebereich.
// Abschnittsnummern müssen in der geladenen Gliederung vorkommen. Ein Eintrag, der nicht passt, wird beim Nachbau übersprungen; er hält nichts auf.
const STELLE_M = /^\d{1,5}\.\d{1,3}$/, WORT_M = /^[a-z]{1,20}$/;
const idGut = x => Number.isInteger(x) && x >= 0 && !!D.A?.[x];
const idsGut = (x, max = 2000) => listeGut(x, idGut, max);
const bereichV = x => x == null || (Array.isArray(x) && x.length === 2 && ganzGut(x[0], 0, 9999) && ganzGut(x[1], 0, 9999));
// Datum eines Eintrags: ein Tag, den es gibt (kein 31. Februar, kein Monat 13), zwischen 1970 und 2199 (auch ein Gerät mit zurückgesetzter Uhr
// schreibt gültige Einträge): die Tagesrechnung des Modells bleibt so immer eine Zahl
const tagGutDatum = d => datumGut(d) && d >= '1970-01-01' && d <= '2199-12-31' && !isNaN(Date.parse(d + 'T00:00:00Z')) && new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) === d;
const EINTRAG_ART = {
  pl: e => tagGutDatum(e.d) && tagGut(e.t) && idsGut(e.t.plan) && idsGut(e.t.fertig) && Object.keys(e.t.art).every(id => idGut(+id))
    && leerOder(e.t.ma, m => objGut(m, ([id, a]) => idGut(+id) && typeof a === 'string' && WORT_M.test(a), 2000)) && leerOder(e.kn, x => zahlGut(x)) && leerOder(e.kz, x => zahlGut(x)),
  pa: e => tagGutDatum(e.d) && ['ers', 'raus'].every(f => leerOder(e[f], x => idsGut(x))) && ['plus', 'minus'].every(f => leerOder(e[f], x => idGut(x) || idsGut(x))),
  ab: e => tagGutDatum(e.d) && idGut(e.id) && bereichV(e.v) && typeof e.e === 'string' && /^[a-z-]{0,400}$/.test(e.e) && leerOder(e.q, x => typeof x === 'string' && WORT_M.test(x))
    && zahlGut(e.p, 0, 1e5) && leerOder(e.s, x => zahlGut(x, 0, 1e6)),
  fm: e => tagGutDatum(e.d) && listeGut(e.w, x => typeof x === 'string' && STELLE_M.test(x), 2000) && e.w.length > 0 && leerOder(e.a, x => typeof x === 'string' && WORT_M.test(x)) && leerOder(e.m, x => ganzGut(x, 0, 9999)),
  fl: e => typeof e.s === 'string' && STELLE_M.test(e.s),
  fg: e => ganzGut(e.vi, 0, 9999),
  mu: e => tagGutDatum(e.d) && typeof e.k === 'string' && PAAR_M.test(e.k),
  ku: e => tagGutDatum(e.d) && typeof e.a === 'string' && WORT_M.test(e.a) && zahlGut(e.p, 0, KURZ_TAGESLIMIT),
  pb: e => tagGutDatum(e.d) && ganzGut(e.n, 1, PAUSE_MAX),
  pe: e => tagGutDatum(e.d),
  on: e => tagGutDatum(e.d),
  lb: e => tagGutDatum(e.d) && idGut(e.id) && bereichV(e.v),
  lx: e => idGut(e.id) && bereichV(e.v),
  rk: e => leerOder(e.ids, x => listeGut(x, y => textGut(y, 60), 5000)),
  ei: e => einstEintragGut(e)
};
export function eintragGut(e) {
  if (!istObj(e) || !textGut(e.i, 60) || !e.i || !zahlGut(e.z) || typeof e.y !== 'string' || !Object.hasOwn(EINTRAG_ART, e.y)) return false;
  try { return harmlos(e.y === 'ei' && e.k === 'name' ? { ...e, w: 0 } : e) && !!EINTRAG_ART[e.y](e); } catch (x) { return false; }
}
const karteGut = k => istObj(k) && ganzGut(k.st, 0, 4) && ganzGut(k.n) && leerOder(k.fe, x => zahlGut(x)) && ['zul', 'kon', 'fae', 'fz', 'ah'].every(f => leerOder(k[f], datumGut))
  && leerOder(k.S, x => zahlGut(x, 0, 1e6)) && leerOder(k.fa, x => listeGut(x, y => ganzGut(y, 0, 9999), 400)) && ['lf', 'fs', 'lt', 'lap', 'z'].every(f => leerOder(k[f], x => zahlGut(x))) && harmlos(k);
const tagGut = t => istObj(t) && listeGut(t.plan, x => ganzGut(x, 0, 99999), 2000) && listeGut(t.fertig, x => ganzGut(x, 0, 99999), 2000)
  && objGut(t.art, ([id, a]) => NUMMER_M.test(id) && typeof a === 'string' && /^[a-z]{1,12}$/.test(a), 2000)
  && ['punkte', 'hasanat', 'r', 'f', 'h', 'qadaa', 'fl', 'cb', 'zeit', 'zn', 'za', 'kp'].every(f => leerOder(t[f], x => zahlGut(x)))
  && leerOder(t.ruhe, x => x === false || x === 'pause' || x === 'ruhetag') && harmlos(t);
// Nennt das erste Feld, das nicht stimmt, oder null
function profilFehler(p) {
  if (!istObj(p) || p.format !== 'itqan') return 'format';
  if (Object.keys(p).some(k => VERBOTEN.includes(k))) return 'schluessel';
  if (!leerOder(p.version, x => zahlGut(x)) || !leerOder(p.schema, x => zahlGut(x))) return 'version';
  if (!leerOder(p.name, nameGut)) return 'name';
  if (!leerOder(p.erstellt, x => textGut(x, 40) && Date.parse(x) > 0)) return 'erstellt';
  if (!leerOder(p.gliederung, x => GLIEDERUNGEN.includes(x))) return 'gliederung';
  if (!objGut(p.einst, ([k, w]) => textGut(k, 40) && einstWertGut(k, w), 200) || !Array.isArray(p.einst.pensum)) return 'einst';
  if (!objGut(p.karten, ([id, k]) => NUMMER_M.test(id) && karteGut(k), 10000)) return 'karten';
  if (!objGut(p.tage, ([d, t]) => datumGut(d) && tagGut(t), 10000)) return 'tage';
  const z = p.zyklus;
  if (!istObj(z) || !listeGut(z.erledigt, x => ganzGut(x, 0, 99999)) || !ganzGut(z.khatma) || !leerOder(z.beginn, datumGut) || !['kn', 'kz', 'konto', 'voll'].every(f => leerOder(z[f], x => zahlGut(x))) || !harmlos(z)) return 'zyklus';
  const kt = p.kette;
  if (!istObj(kt) || !ganzGut(kt.n) || !ganzGut(kt.beste) || !leerOder(kt.zuletzt, datumGut) || !harmlos(kt)) return 'kette';
  if (!objGut(p.summe, ([, x]) => zahlGut(x), 50) || !zahlGut(p.summe.punkte) || !zahlGut(p.summe.abschnitte)) return 'summe';
  if (!listeGut(p.meilen, x => textGut(x, 60), 5000)) return 'meilen';
  if (!leerOder(p.meilenD, x => objGut(x, ([k, d]) => textGut(k, 60) && datumGut(d), 5000))) return 'meilenD';
  if (!leerOder(p.fstellen, x => objGut(x, ([k, f]) => /^\d{1,5}\.\d{1,3}$/.test(k) && istObj(f) && zahlGut(f.n) && leerOder(f.d, datumGut) && leerOder(f.gut, y => zahlGut(y))
    && leerOder(f.t, t => objGut(t, ([a, n]) => textGut(a, 30) && zahlGut(n), 50)) && leerOder(f.m, m => objGut(m, ([a, n]) => NUMMER_M.test(a) && zahlGut(n), 500)) && harmlos(f), 100000))) return 'fstellen';
  if (!leerOder(p.pausen, x => listeGut(x, y => istObj(y) && datumGut(y.von) && datumGut(y.bis) && harmlos(y), 100))) return 'pausen';
  if (!leerOder(p.lern, x => objGut(x, ([id, L]) => NUMMER_M.test(id) && istObj(L) && datumGut(L.b) && ganzGut(L.ph, 0, 2) && listeGut(L.ft, datumGut, 100) && leerOder(L.zul, datumGut) && leerOder(L.e, datumGut) && harmlos(L), 10000))) return 'lern';
  if (!leerOder(p.verlauf, x => objGut(x, ([d, n]) => datumGut(d) && zahlGut(n), 50000))) return 'verlauf';
  if (!leerOder(p.mutash, x => objGut(x, ([k, m]) => PAAR_M.test(k) && istObj(m) && zahlGut(m.n) && zahlGut(m.ok) && leerOder(m.d, datumGut) && harmlos(m), 100000))) return 'mutash';
  if (!leerOder(p.statistik, x => istObj(x) && leerOder(x.arten, a => objGut(a, ([k, n]) => textGut(k, 30) && zahlGut(n), 50)) && leerOder(x.vw, a => objGut(a, ([k, n]) => PAAR_M.test(k) && zahlGut(n), 100000)) && harmlos(x))) return 'statistik';
  if (!leerOder(p.sockel, x => istObj(x) && zahlGut(x.n) && zahlGut(x.z) && textGut(x.g, 40) && harmlos(x))) return 'sockel';
  if (!leerOder(p.log, x => listeGut(x, e => istObj(e) && (e.y === 'ei' && e.k === 'name' ? einstEintragGut(e) && harmlos({ ...e, w: 0 }) : harmlos(e)), 5000))) return 'log';
  if (!leerOder(p.rangBeste, x => istObj(x) && ganzGut(x.r, 0, 100) && leerOder(x.d, datumGut) && harmlos(x))) return 'rangBeste';
  if (!leerOder(p.umgestellt, datumGut)) return 'umgestellt';
  if (!leerOder(p.rangGesehen, x => ganzGut(x, 0, 100))) return 'rangGesehen';   // höchster Rang, dessen Freischaltung gezeigt wurde (js/rangfeier.js); darf fehlen
  if (!leerOder(p.modell, x => typeof x === 'string' && /^m\d{1,3}$/.test(x))) return 'modell';
  if (!leerOder(p.pensumVor, x => listeGut(x, y => istObj(y) && datumGut(y.bis) && einstWertGut('pensum', y.p), 20))) return 'pensumVor';
  const eigens = ['format', 'version', 'schema', 'name', 'erstellt', 'gliederung', 'einst', 'karten', 'tage', 'zyklus', 'kette', 'summe', 'meilen', 'meilenD', 'fstellen', 'pausen', 'lern', 'verlauf', 'mutash', 'statistik', 'sockel', 'log', 'rangBeste', 'rangGesehen', 'umgestellt', 'pensumVor', 'modell'];
  for (const [k, w] of Object.entries(p)) if (!eigens.includes(k) && !(textGut(k, 40) && harmlos(w))) return k;
  return null;
}
// Prüft ein Profil und gibt es zurück; wirft mit der Meldung „keine Itqān-Profildatei“ (Eigenschaft feld: das erste Feld, das nicht stimmt).
// Verändert nichts. Für Dateien (importDatei ruft es selbst), den Stand vom Konto und Schülerdateien der Lehreransicht.
export function profilPruefen(p) {
  const feld = profilFehler(p);
  if (feld) { const e = new Error(tx('zustand.keine_itqan_profildatei')); e.feld = feld; throw e; }
  return p;
}
