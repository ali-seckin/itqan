// Itqān · Lernprotokoll für die Forschung: freiwillig, nur nach Zustimmung, ohne Namen, ohne E-Mail, ohne Datum, ohne Aufnahmen.
// Pro Übung eine Zeile unter einer zufälligen Nummer, die nur auf diesem Gerät steht (pseudonym; Schema und Regeln: konzept/server/forschung.sql).
// Widerruf löscht die gesendeten Zeilen über eine Funktion auf dem Server. Zweck: nach einem Jahr das Lernmodell an echten Daten prüfen (konzept/lernmodell_einheitlich/DOSSIER.md).
import { SERVER } from './server.js';
import * as LM from './lernmodell.js';

const K = 'itqan-forschung', Q = 'itqan-forschung-q', L = 'itqan-forschung-loeschen', GRENZE = 3000, MODELL = 'm1';
// Die Felder einer gesendeten Zeile. Dieselbe Liste steht im Datenschutztext (werkzeuge/website/rechtstexte.py) und im
// Zustimmungsdialog: wer hier etwas ändert, ändert es auch dort (tests/forschung.test.mjs prüft die Zeile gegen diese Liste).
export const FELDER = ['pid', 't', 's', 'o', 'g', 'st', 'r', 'v', 'f', 'z', 'h', 'a', 'n', 'm'];
const lesen = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ?? d; } catch (e) { return d; } };
const schreiben = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const tageNr = () => Math.floor(Date.now() / 864e5);
export const an = () => !!lesen(K, null)?.pid;
export const warteschlange = () => lesen(Q, []);
// Zufällige Nummer (UUID v4) aus dem sicheren Zufall des Geräts
function neueNummer() {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b); else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = b[6] & 0x0f | 0x40; b[8] = b[8] & 0x3f | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export function einschalten() { if (an()) return; schreiben(K, { pid: neueNummer(), basis: tageNr() }); }
// Eine Übung: Daten aus der App (zustand.js, abschnittAbschliessen). vorher: { n, S, zul } des Abschnitts vor der Übung
export function eintragen({ id, art, v, f, h, z, vorher, datum, pensum, gliederung }) {
  const k = lesen(K, null); if (!k?.pid) return;
  const gap = vorher?.n && vorher.zul ? Math.max(0, Math.round((new Date(datum) - new Date(vorher.zul)) / 864e5)) : null;
  const R = vorher?.n && vorher.S && gap != null ? Math.round(100 * LM.abruf(gap, vorher.S)) / 100 : null;
  const q = lesen(Q, []);
  q.push({ pid: k.pid, t: tageNr() - k.basis, s: id, o: gliederung || null, g: gap, st: vorher?.S != null ? Math.round(10 * vorher.S) / 10 : null, r: R, v, f, z, h, a: art || null, n: pensum || null, m: MODELL });
  schreiben(Q, q.slice(-GRENZE));
  planen();
}
// Gesendet wird nicht im selben Augenblick wie der Abgleich mit dem Konto, sondern gesammelt und zufällig versetzt:
// so lassen sich Protokollzeilen und Konto über den Zeitpunkt der Anfragen schlechter zusammenführen.
let wartet = null, zeiten = { nach: [120e3, 600e3], start: [20e3, 90e3] };
const zufall = ([a, b]) => a + Math.random() * (b - a);
export function zeitenSetzen(z) { zeiten = { ...zeiten, ...z }; }   // nur für Tests
function planen(spanne = zeiten.nach) { if (wartet) return; wartet = setTimeout(() => { wartet = null; senden(); }, zufall(spanne)); wartet.unref?.(); }
// Ein Stapel an den Server. Liefert 'ok', 'unzustellbar' (der Server lehnt die Zeilen selbst ab: Wertebereich, Grenze) oder 'spaeter'.
async function stapel(teil) {
  let r;
  try { r = await fetch(SERVER.url + '/rest/v1/forschung', { method: 'POST', headers: { apikey: SERVER.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(teil) }); }
  catch (e) { return 'spaeter'; }
  if (r.ok) return 'ok';
  return [400, 409, 413, 422].includes(r.status) ? 'unzustellbar' : 'spaeter';
}
// Zeilen zustellen. Lehnt der Server einen Stapel ab, wird er geteilt, bis die unzustellbaren Zeilen einzeln feststehen:
// die werden verworfen, damit sie die Schlange nicht für immer blockieren. Liefert die Zahl der vorn erledigten Zeilen.
async function zustellen(teil) {
  const e = await stapel(teil);
  if (e === 'ok') return teil.length;
  if (e === 'spaeter') return 0;
  if (teil.length === 1) return 1;
  const mitte = teil.length >> 1, links = await zustellen(teil.slice(0, mitte));
  return links < mitte ? links : mitte + await zustellen(teil.slice(mitte));
}
let sendet = false;
export async function senden() {
  if (sendet || !an()) return false;
  const q = lesen(Q, []); if (!q.length) return true;
  sendet = true;
  try {
    const teil = q.slice(0, 200), pid = lesen(K, null)?.pid;
    const fertig = await zustellen(teil);
    if (lesen(K, null)?.pid !== pid) return false;                  // inzwischen widerrufen oder zurückgesetzt: nichts mehr anfassen
    if (fertig) schreiben(Q, lesen(Q, []).slice(fertig));
    if (fertig === teil.length && lesen(Q, []).length) planen([1000, 5000]);
    return fertig === teil.length;
  } catch (e) { return false; } finally { sendet = false; }
}
async function loeschenSenden() {
  const l = lesen(L, []); if (!l.length) return true;
  const rest = [];
  for (const pid of l) {
    try {
      const r = await fetch(SERVER.url + '/rest/v1/rpc/forschung_loeschen', { method: 'POST', headers: { apikey: SERVER.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_pid: pid }) });
      if (!r.ok && r.status !== 400 && r.status !== 422) rest.push(pid);   // 400: keine gültige Nummer, das wird nie gelingen
    } catch (e) { rest.push(pid); }
  }
  // inzwischen neu vorgemerkte Nummern (zweiter Widerruf während des Sendens) nicht verlieren
  const dazu = lesen(L, []).filter(pid => !l.includes(pid));
  schreiben(L, rest.length + dazu.length ? [...rest, ...dazu] : null);
  return !rest.length;
}
// Auf dem Gerät: Zustimmung und Warteschlange entfernen, die Nummer zum Löschen auf dem Server vormerken
function lokalBeenden() {
  const k = lesen(K, null); schreiben(K, null); schreiben(Q, null);
  clearTimeout(wartet); wartet = null;
  if (k?.pid) { const l = lesen(L, []); if (!l.includes(k.pid)) l.push(k.pid); schreiben(L, l); }
}
// Widerruf: nichts mehr senden, Warteschlange verwerfen, schon gesendete Zeilen auf dem Server löschen (wird bei Netzfehler später wiederholt)
export async function widerrufen() { lokalBeenden(); return loeschenSenden(); }
// Die Oberfläche ruft das bei „Profil löschen“ (und beim Laden eines anderen Profils): Die Zustimmung gehört zum gelöschten
// Profil. Sie endet sofort, die Warteschlange wird verworfen, der Widerruf auf dem Server läuft im Hintergrund an.
// Ein neues Profil wird neu gefragt und bekäme eine neue Nummer. Liefert das Versprechen des Widerrufs (muss nicht abgewartet werden).
export function zuruecksetzen() { lokalBeenden(); return loeschenSenden().catch(() => false); }
export function starten() { loeschenSenden(); if (an() && lesen(Q, []).length) planen(zeiten.start); }
