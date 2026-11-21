// Itqān · Lernprotokoll für die Forschung: freiwillig, nur nach Zustimmung, ohne Namen, ohne E-Mail, ohne Datum, ohne Aufnahmen.
// Pro Übung eine Zeile mit einer zufälligen Nummer, die nur auf diesem Gerät steht (Schema und Regeln: konzept/server/forschung.sql).
// Widerruf löscht die gesendeten Zeilen über eine Funktion auf dem Server. Zweck: nach einem Jahr das Lernmodell an echten Daten prüfen (konzept/lernmodell_einheitlich/DOSSIER.md).
import { SERVER } from './server.js';
import * as LM from './lernmodell.js';

const K = 'itqan-forschung', Q = 'itqan-forschung-q', L = 'itqan-forschung-loeschen', GRENZE = 3000, MODELL = 'm1';
const lesen = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ?? d; } catch (e) { return d; } };
const schreiben = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const tageNr = () => Math.floor(Date.now() / 864e5);
export const an = () => !!lesen(K, null)?.pid;
export const warteschlange = () => lesen(Q, []);
function neueNummer() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const h = n => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${h(8)}-${h(4)}-4${h(3)}-a${h(3)}-${h(12)}`;
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
let wartet = null;
function planen() { if (wartet) return; wartet = setTimeout(() => { wartet = null; senden(); }, 4000); wartet.unref?.(); }
let sendet = false;
export async function senden() {
  if (sendet || !an()) return false;
  const q = lesen(Q, []); if (!q.length) return true;
  sendet = true;
  try {
    const teil = q.slice(0, 200);
    const r = await fetch(SERVER.url + '/rest/v1/forschung', { method: 'POST', headers: { apikey: SERVER.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(teil) });
    if (!r.ok) return false;
    schreiben(Q, lesen(Q, []).slice(teil.length));
    if (lesen(Q, []).length) planen();
    return true;
  } catch (e) { return false; } finally { sendet = false; }
}
async function loeschenSenden() {
  const l = lesen(L, []); if (!l.length) return true;
  const rest = [];
  for (const pid of l) {
    try { const r = await fetch(SERVER.url + '/rest/v1/rpc/forschung_loeschen', { method: 'POST', headers: { apikey: SERVER.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_pid: pid }) }); if (!r.ok) rest.push(pid); }
    catch (e) { rest.push(pid); }
  }
  schreiben(L, rest.length ? rest : null);
  return !rest.length;
}
// Widerruf: nichts mehr senden, Warteschlange verwerfen, schon gesendete Zeilen auf dem Server löschen (wird bei Netzfehler später wiederholt)
export async function widerrufen() {
  const k = lesen(K, null); schreiben(K, null); schreiben(Q, null);
  if (k?.pid) { const l = lesen(L, []); l.push(k.pid); schreiben(L, l); }
  return loeschenSenden();
}
export function starten() { loeschenSenden(); if (an()) senden(); }
