// Itqān · Fehlermeldung: Tritt ein Fehler auf, erscheint ein ruhiges Band mit „Fehler melden“. Der Dialog zeigt genau, was gesendet wird.
// Gesendet wird nur nach ausdrücklichem Tippen auf „Senden“, nie automatisch. Nicht dabei: Profil, Namen, E-Mail, Aufnahmen.
// Ziel auf dem Server: Tabelle public.fehler (nur Einfügen, Grenzen je Gerät und Tag; Schema: konzept/server/fehler.sql).
// Die Felder (FELDER) stehen auch im Datenschutztext (werkzeuge/website/rechtstexte.py) und im Dialog: wer hier etwas ändert, ändert es dort auch.
// Ohne Netz oder bei fehlender Tabelle bleibt die Meldung auf dem Gerät (Warteschlange), dazu gibt es „Meldung kopieren“ und den E-Mail-Weg.
import { SERVER } from './server.js';
import { tx } from './sprache.js';
import { VERSION, RUECKMELDUNG_AN } from './version.js';
import { hintergrundSperren } from './sperre.js';

// Die Spalten einer gesendeten Meldung, in der Reihenfolge der Tabelle
export const FELDER = ['nr', 'anfrage', 'tag', 'version', 'umgebung', 'browser', 'system', 'bildschirm', 'sprache', 'ansicht', 'quelle', 'fehlertext', 'stapel', 'kommentar'];
const K_AKTE = 'itqan-fehler-akte', K_Q = 'itqan-fehler-q', K_GERAET = 'itqan-fehler-geraet';
export const GRENZE = { fehlertext: 300, stapel: 1200, kommentar: 800, quelle: 40, ansicht: 40 };   // der Server erlaubt mehr: 400, 1500, 1000, 40, 60
const MAX_WARTEND = 5, MAX_VERSUCHE = 10, MAX_ALTER_TAGE = 30, BANNER_MAX = 3, ZU_ALT_MS = 10 * 60e3, BANNER_BLEIBT_MS = 40e3;

const lesen = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ?? d; } catch (e) { return d; } };
const schreiben = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ohne Speicher bleibt nur der Dialog */ } };
const tageNr = () => Math.floor(Date.now() / 864e5);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function neueNummer() {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b); else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = b[6] & 0x0f | 0x40; b[8] = b[8] & 0x3f | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
// Zufällige Nummer dieses Geräts: nur dazu da, die Zahl der Meldungen je Gerät und Tag zu begrenzen. Keine Verbindung zu Konto, Profil oder Forschung.
function geraetNummer() { let g = lesen(K_GERAET, null); if (typeof g !== 'string' || g.length < 30) { g = neueNummer(); schreiben(K_GERAET, g); } return g; }

// ---------- Inhalt der Meldung: nur technische Angaben, bereinigt und gekürzt ----------
// Adressen werden auf „datei:zeile:spalte“ gekürzt (Herkunft, Pfade und Suchteile entfallen), Mailadressen, lange Kennungen und lange Zahlen maskiert.
const ADRESSE = /(?:https?|file|capacitor|ionic):\/\/[^\s)'"]*?\/?([^/\s)'"?#:]+)(?:[?#][^\s:)'"]*)?(:\d+(?::\d+)?)?(?=[\s)'",;]|$)/g;
export const ortKurz = s => String(s ?? '').replace(ADRESSE, (m, datei, pos) => datei + (pos || ''));
export function bereinigen(s, max = GRENZE.fehlertext, mehrzeilig = false) {
  return ortKurz(String(s ?? ''))
    .replace(/,?\s*"[^"]*"(?:\.\.\.)? is not valid JSON/gi, ' is not valid JSON')   // Chrome nennt hier einen Ausschnitt der Daten
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[mail]')
    .replace(/[A-Za-z0-9_\-+/=]{32,}/g, '[...]')
    .replace(/\d[\d\s().-]{7,}\d/g, '[#]')
    .replace(mehrzeilig ? /[ \t]+/g : /\s+/g, ' ').trim().slice(0, max);
}
// Aufrufstapel: nur die ersten Rahmen, je Zeile „Funktion datei:zeile:spalte“, höchstens max Zeichen
export function stapelKuerzen(stack, max = GRENZE.stapel, zeilen = 8) {
  const z = String(stack || '').split('\n').map(l => l.trim()).filter(l => /^at\s/.test(l) || /@/.test(l) || /\.m?js:\d+/.test(l)).slice(0, zeilen);
  let aus = '';
  for (const l of z) {
    const k = bereinigen(ortKurz(l).replace(/^([^\s@]*)@/, '$1 '), 200);
    if (!k) continue;
    if (aus.length + k.length + 1 > max) break;
    aus += (aus ? '\n' : '') + k;
  }
  return aus;
}
// Browserfamilie mit Hauptversion und Betriebssystem grob, aus dem User-Agent (der Rest davon wird nicht übertragen)
export function geraetInfo(ua) {
  ua = String(ua || '');
  const v = re => ua.match(re)?.[1];
  const browser = v(/Edg(?:e|A|iOS)?\/(\d+)/) ? 'Edge ' + v(/Edg(?:e|A|iOS)?\/(\d+)/) : v(/OPR\/(\d+)/) ? 'Opera ' + v(/OPR\/(\d+)/)
    : v(/SamsungBrowser\/(\d+)/) ? 'Samsung ' + v(/SamsungBrowser\/(\d+)/) : v(/FxiOS\/(\d+)/) ? 'Firefox ' + v(/FxiOS\/(\d+)/) : v(/Firefox\/(\d+)/) ? 'Firefox ' + v(/Firefox\/(\d+)/)
    : v(/CriOS\/(\d+)/) ? 'Chrome ' + v(/CriOS\/(\d+)/) : v(/Chrome\/(\d+)/) ? 'Chrome ' + v(/Chrome\/(\d+)/)
    : v(/Version\/(\d+)[^]*Safari/) ? 'Safari ' + v(/Version\/(\d+)[^]*Safari/) : /AppleWebKit/.test(ua) ? 'WebView' : 'other';
  const system = /iPhone|iPad|iPod/.test(ua) ? 'iOS' + (v(/OS (\d+)[_\d]* like Mac/) ? ' ' + v(/OS (\d+)[_\d]* like Mac/) : '')
    : /Android/.test(ua) ? 'Android' + (v(/Android (\d+)/) ? ' ' + v(/Android (\d+)/) : '') : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : 'other';
  return { browser, system };
}
// Nur der Name der Ansicht, ohne Parameter nach dem ersten Schrägstrich (die könnten Namen oder Suchbegriffe enthalten)
export const ansichtName = hash => (String(hash || '').replace(/^#/, '').split(/[/?]/)[0].toLowerCase().match(/^[a-z0-9_-]{1,40}/)?.[0]) || 'heute';
export function umgebungLesen(g = globalThis) {
  const n = g.navigator || {}, s = g.screen || {}, { browser, system } = geraetInfo(n.userAgent);
  let installiert = false;
  try { installiert = !!(g.matchMedia?.('(display-mode: standalone)').matches || n.standalone === true); } catch (e) { /* dann gilt: im Browser */ }
  const store = !!g.Capacitor?.isNativePlatform?.();
  const bs = s.width ? `${s.width}x${s.height}${g.innerWidth ? `/${g.innerWidth}x${g.innerHeight}` : ''}` : '';
  return { browser, system, bildschirm: bs.slice(0, 20), sprache: String(g.document?.documentElement?.lang || 'de').slice(0, 10), umgebung: store ? 'store' : installiert ? 'installiert' : 'browser' };
}
// Die Akte eines Fehlers, wie sie auf dem Gerät liegt (für „Letzten Fehler ansehen und melden“). e: Fehlerobjekt, Text oder { name, message }; wo: Stelle (Fänger oder gekapselter Block)
export function akteBauen(e, wo, kontext = {}) {
  const name = e && typeof e === 'object' && e.name ? String(e.name) : 'Error', msg = e && typeof e === 'object' ? String(e.message ?? '') : String(e ?? '');
  const fehlertext = bereinigen(`${name}: ${msg}`, GRENZE.fehlertext);
  if (!msg && name === 'Error') return null;
  return { wo: bereinigen(wo || 'app', GRENZE.quelle) || 'app', fehlertext, stapel: stapelKuerzen(e?.stack), ansicht: ansichtName(kontext.hash ?? globalThis.location?.hash).slice(0, GRENZE.ansicht), tag: kontext.tag ?? tageNr(), v: VERSION };
}
// Dieselbe Meldung (andere Stelle, gleiche Zeile): ein Schlüssel aus Text und erstem Rahmen
export const schluessel = a => `${a.fehlertext.slice(0, 160)}|${(a.stapel || '').split('\n')[0]}`;
// Rauschen, das kein Fehler der App ist: kein Netz, abgebrochene Anfragen, Browser-Erweiterungen, Layout-Meldungen des Browsers
const RAUSCHEN = [/ResizeObserver loop/i, /^Script error\.?/i, /Failed to fetch|Load failed|NetworkError|Network request failed|Network error/i, /AbortError|operation was aborted|signal is aborted/i, /Non-Error promise rejection/i];
export function ignoriert(e, wo, akte) {
  if (wo === 'laden') return false;   // dass die App nicht startet, ist immer ein Fall für die Meldung
  const roh = e && typeof e === 'object' ? `${e.stack || ''} ${e.filename || ''}` : '';
  if (/(?:chrome|moz|safari|safari-web)-extension:/i.test(roh)) return true;
  return RAUSCHEN.some(r => r.test(akte.fehlertext));
}
// Die Zeile für den Server und die Anzeige: genau die FELDER, sonst nichts
export function meldungBauen(akte, kommentar = '', kontext = {}) {
  const u = kontext.umg || umgebungLesen();
  const m = {
    nr: kontext.nr || neueNummer(), anfrage: kontext.anfrage || geraetNummer(), tag: akte.tag, version: akte.v || VERSION,
    umgebung: u.umgebung || null, browser: u.browser || null, system: u.system || null, bildschirm: u.bildschirm || null, sprache: u.sprache || null,
    ansicht: akte.ansicht || null, quelle: akte.wo || null, fehlertext: akte.fehlertext, stapel: akte.stapel || null, kommentar: bereinigen(kommentar, GRENZE.kommentar, true) || null
  };
  return Object.fromEntries(FELDER.map(k => [k, m[k]]));
}
// Als Text für die Zwischenablage und die E-Mail (ohne die beiden Zufallsnummern)
export const berichtText = m => FELDER.filter(k => !['nr', 'anfrage'].includes(k) && m[k] != null && m[k] !== '').map(k => k === 'stapel' ? `stapel:\n${m[k]}` : `${k}: ${m[k]}`).join('\n');

// ---------- Warteschlange und Übertragung ----------
export const warteschlange = () => lesen(K_Q, []);
const ausreihen = nr => { const q = lesen(K_Q, []).filter(x => x.m?.nr !== nr); schreiben(K_Q, q.length ? q : null); };
const einreihen = m => { const q = lesen(K_Q, []).filter(x => x.m?.nr !== m.nr); q.push({ m, versuche: 0 }); schreiben(K_Q, q.slice(-MAX_WARTEND)); };
// Ergebnis einer Anfrage:
//   'ok'         angenommen (auch: diese Meldungsnummer liegt schon dort, HTTP 409 mit Code 23505),
//   'fehlt'      die Tabelle gibt es auf dem Server noch nicht (HTTP 404),
//   'grenze'     der Server hat eine seiner Grenzen erreicht (Code P0001, Text beginnt mit „fehler_grenze“),
//   'abgelehnt'  der Server lehnt diese Meldung selbst ab (Prüfregel): nie wieder versuchen,
//   'spaeter'    Netzfehler, Zeitüberschreitung, 5xx, 429, 401, 403: später noch einmal.
export async function post(m, zeitlimit = 12000) {
  let r, uhr;
  try {
    const ac = typeof AbortController === 'function' ? new AbortController() : null;
    if (ac) uhr = setTimeout(() => ac.abort(), zeitlimit);
    r = await fetch(SERVER.url + '/rest/v1/fehler', { method: 'POST', headers: { apikey: SERVER.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(m), signal: ac?.signal });
  } catch (e) { return 'spaeter'; } finally { clearTimeout(uhr); }
  if (r.ok) return 'ok';
  if (r.status === 404) return 'fehlt';
  if (![400, 409, 413, 422].includes(r.status)) return 'spaeter';
  let j = null;
  try { j = JSON.parse(await r.text()); } catch (e) { j = null; }
  if (r.status === 409 && j?.code === '23505') return 'ok';
  if (j?.code === 'P0001' || /^fehler_grenze/.test(String(j?.message || ''))) return 'grenze';
  if (j?.code === 'PGRST205' || j?.code === '42P01') return 'fehlt';
  return 'abgelehnt';
}
// Aus dem Dialog: einmal senden. Bleibt etwas zu tun (kein Netz, Tabelle fehlt, Grenze), liegt die Meldung in der Warteschlange.
export async function absenden(m) {
  const e = await post(m);
  if (e === 'ok' || e === 'abgelehnt') ausreihen(m.nr); else einreihen(m);
  return e;
}
let sendet = false, nachUhr = null;
// Liegen Meldungen in der Warteschlange (die Nutzerin hat „Senden“ getippt, es ging nicht), wird beim Start und bei zurückkehrendem Netz erneut versucht.
export async function nachsenden() {
  if (sendet) return 0;
  sendet = true;
  let n = 0;
  try {
    for (const x of warteschlange().slice(0, MAX_WARTEND)) {
      if (!x?.m?.nr || tageNr() - x.m.tag > MAX_ALTER_TAGE || x.versuche >= MAX_VERSUCHE) { ausreihen(x?.m?.nr); continue; }
      const e = await post(x.m);
      if (e === 'ok' || e === 'abgelehnt') { ausreihen(x.m.nr); if (e === 'ok') n++; continue; }
      schreiben(K_Q, lesen(K_Q, []).map(y => y.m?.nr === x.m.nr ? { ...y, versuche: (y.versuche || 0) + 1 } : y));
      break;   // ohne Netz oder bei einer Grenze keine weiteren Versuche in diesem Lauf
    }
  } catch (e) { /* beim nächsten Mal */ } finally { sendet = false; }
  return n;
}
export function nachsendenPlanen(ms = 20000) {
  if (nachUhr || !warteschlange().length) return;
  nachUhr = setTimeout(() => { nachUhr = null; nachsenden(); }, ms); nachUhr.unref?.();
}

// ---------- Erfassen, Entprellen, Band ----------
export const letzte = () => lesen(K_AKTE, null);
let zeiten = { vorlauf: 700, pruefen: 2500, pause: 20000 };
export function zeitenSetzen(z) { zeiten = { ...zeiten, ...z }; }   // nur für Tests
// Eingriffe für Tests: zeigen(akte) ersetzt das Band, ruhig() sagt, ob gerade ein ruhiger Augenblick ist
export const haken = { zeigen: null, ruhig: null, unnoetig: null };
const gesehen = new Set();
let aktuell = null, vorgemerkt = 0, pruefUhr = null, anzahlBand = 0, letztesBand = 0, bandOffen = false;
export const zustandBand = () => ({ anzahl: anzahlBand, offen: bandOffen, gesehen: gesehen.size });
export function zuruecksetzen() { gesehen.clear(); aktuell = null; vorgemerkt = 0; clearTimeout(pruefUhr); pruefUhr = null; anzahlBand = 0; letztesBand = 0; bandOffen = false; }

// Ein Fehler ist aufgetreten (aus fehlerMerken in app.js und start.js). Immer als „letzter Fehler“ festhalten, ein Band höchstens je neuem Fehler.
export function erfassen(e, wo) {
  try {
    const akte = akteBauen(e, wo);
    if (!akte || ignoriert(e, wo, akte)) return null;
    schreiben(K_AKTE, akte); aktuell = akte;
    const s = schluessel(akte);
    if (gesehen.has(s)) return akte;                   // derselbe Fehler höchstens einmal je Sitzung
    gesehen.add(s);
    if (gesehen.size > 200) gesehen.clear();
    bandPlanen();
    return akte;
  } catch (x) { return null; }
}
function bandPlanen() {
  if (bandOffen || anzahlBand >= BANNER_MAX) return;   // höchstens ein Band zugleich, höchstens drei je Sitzung
  vorgemerkt = Date.now();
  if (!pruefUhr) { pruefUhr = setTimeout(pruefen, zeiten.vorlauf); pruefUhr.unref?.(); }
}
const standardRuhig = () => {
  if (typeof document === 'undefined' || document.hidden) return false;
  const nr = ansichtName(location.hash), nav = document.getElementById('nav');
  // nie in einer Übung (dort läuft auch die Aufnahme), nie bei Beginn des Ladens
  return !['ueben', 'lernen', 'abhaken', 'kurz'].includes(nr) && document.body?.dataset?.ansicht !== 'ueben' && !nav?.classList.contains('verdeckt') && !document.querySelector('#app .lade-logo, .steuerung');
};
// Die Fehleransicht (eigener Knopf zum Melden) und die Notansicht brauchen kein zweites Band
const standardUnnoetig = () => typeof document !== 'undefined' && !!document.querySelector('#fe-melden, #app .not');
function pruefen() {
  pruefUhr = null;
  if (!vorgemerkt) return;
  if (Date.now() - vorgemerkt > ZU_ALT_MS || bandOffen || anzahlBand >= BANNER_MAX || (letztesBand && Date.now() - letztesBand < zeiten.pause) || (haken.unnoetig || standardUnnoetig)()) { vorgemerkt = 0; return; }
  if (!(haken.ruhig || standardRuhig)()) { pruefUhr = setTimeout(pruefen, zeiten.pruefen); pruefUhr.unref?.(); return; }
  vorgemerkt = 0; anzahlBand++; letztesBand = Date.now();
  try { (haken.zeigen || bandZeigen)(aktuell); } catch (x) { /* ohne Band bleibt der Fehler im Profil erreichbar */ }
}

// ---------- Oberfläche ----------
let bandEl = null, bandUhr = null;
function bandSchliessen() { clearTimeout(bandUhr); bandEl?.remove(); bandEl = null; bandOffen = false; }
function bandZeigen() {
  if (bandEl || typeof document === 'undefined') return;
  const b = document.createElement('div'); b.id = 'fehlerband'; b.className = 'fehlerband'; b.setAttribute('role', 'status'); b.setAttribute('aria-live', 'polite');
  b.innerHTML = `<p><b>${esc(tx('fehlermeldung.band_titel'))}</b> ${esc(tx('fehlermeldung.band_text'))}</p>
    <div class="reihe"><button type="button" class="knopf haupt klein" data-f="melden">${esc(tx('fehlermeldung.melden'))}</button><button type="button" class="knopf leise klein" data-f="zu">${esc(tx('fehlermeldung.schliessen'))}</button></div>`;
  b.onclick = ev => { const k = ev.target.closest('[data-f]'); if (!k) return; bandSchliessen(); if (k.dataset.f === 'melden') melden(); };
  document.body.appendChild(b); bandEl = b; bandOffen = true;
  bandUhr = setTimeout(bandSchliessen, BANNER_BLEIBT_MS);   // ein Band, das niemand braucht, verschwindet von selbst; der Fehler bleibt im Profil erreichbar
}

let dialogEl = null;
// Dialog „Fehler melden“. akte: der Fehler (Standard: der letzte). Zeigt, was gesendet wird; sendet erst auf „Senden“.
export function melden(akte = letzte()) {
  if (dialogEl || typeof document === 'undefined') return;
  const d = document.createElement('div'); d.className = 'dialog fehlerdialog';
  const karte = (inhalt, knoepfe) => `<div class="dialog-karte" role="dialog" aria-modal="true" aria-label="${esc(tx('fehlermeldung.dialog_titel'))}"><h3>${esc(tx('fehlermeldung.dialog_titel'))}</h3><div class="dialog-text">${inhalt}</div><div class="reihe fm-knoepfe">${knoepfe}</div></div>`;
  const zuTaste = `<button type="button" class="knopf leise klein" data-a="zu">${esc(tx('fehlermeldung.schliessen'))}</button>`;
  const vorher = document.activeElement;
  let offen = true, laeuft = false, m = null;
  const zu = () => {
    if (!offen || laeuft) return; offen = false; dialogEl = null;
    removeEventListener('keydown', taste, true); removeEventListener('hashchange', zu); hintergrundSperren(false);
    d.classList.add('weg'); setTimeout(() => d.remove(), 200); if (vorher?.isConnected) vorher.focus?.({ preventScroll: true });
  };
  const taste = ev => {
    if (ev.key === 'Escape') { ev.stopPropagation(); zu(); return; }
    if (ev.key !== 'Tab') return;
    const f = [...d.querySelectorAll('button, textarea, a[href]')].filter(x => !x.disabled && x.getClientRects().length); if (!f.length) return;
    const drin = d.contains(document.activeElement);
    if (ev.shiftKey && (!drin || document.activeElement === f[0])) { ev.preventDefault(); f[f.length - 1].focus(); }
    else if (!ev.shiftKey && (!drin || document.activeElement === f[f.length - 1])) { ev.preventDefault(); f[0].focus(); }
  };
  const umgDe = { browser: tx('fehlermeldung.umg_browser'), installiert: tx('fehlermeldung.umg_installiert'), store: tx('fehlermeldung.umg_store') };
  if (!akte) {
    d.innerHTML = karte(`<p>${esc(tx('fehlermeldung.kein_fehler'))}</p>`, zuTaste);
  } else {
    const vorschau = meldungBauen(akte, '', { nr: '-', anfrage: '-' });
    const zeilen = [[tx('fehlermeldung.feld_version'), vorschau.version], [tx('fehlermeldung.feld_umgebung'), umgDe[vorschau.umgebung] || vorschau.umgebung], [tx('fehlermeldung.feld_browser'), vorschau.browser],
      [tx('fehlermeldung.feld_system'), vorschau.system], [tx('fehlermeldung.feld_bildschirm'), vorschau.bildschirm], [tx('fehlermeldung.feld_sprache'), vorschau.sprache], [tx('fehlermeldung.feld_ansicht'), vorschau.ansicht],
      [tx('fehlermeldung.feld_quelle'), vorschau.quelle], [tx('fehlermeldung.feld_tag'), vorschau.tag], [tx('fehlermeldung.feld_fehler'), vorschau.fehlertext]].filter(z => z[1] != null && z[1] !== '');
    d.innerHTML = karte(`<p>${esc(tx('fehlermeldung.einleitung'))}</p>
      <dl class="fm-liste">${zeilen.map(([k, w]) => `<div><dt>${esc(k)}</dt><dd dir="auto">${esc(w)}</dd></div>`).join('')}</dl>
      ${vorschau.stapel ? `<p class="fm-kopf">${esc(tx('fehlermeldung.feld_stapel'))}</p><pre class="fm-stapel" dir="ltr" tabindex="0">${esc(vorschau.stapel)}</pre>` : ''}
      <p class="unter">${esc(tx('fehlermeldung.nicht_dabei'))}</p>
      <label class="fm-kopf" for="fm-kommentar">${esc(tx('fehlermeldung.kommentar_label'))}</label>
      <textarea id="fm-kommentar" rows="3" maxlength="${GRENZE.kommentar}" placeholder="${esc(tx('fehlermeldung.kommentar_hinweis'))}"></textarea>
      <p class="unter fm-status" id="fm-status" role="status" aria-live="polite"></p>
      <div class="reihe fm-ersatz verdeckt" id="fm-ersatz"><button type="button" class="knopf leise klein" data-a="kopieren">${esc(tx('fehlermeldung.kopieren'))}</button><button type="button" class="knopf leise klein" data-a="mail">${esc(tx('fehlermeldung.per_mail'))}</button></div>
      <textarea id="fm-kopie" class="verdeckt" rows="5" readonly dir="ltr" aria-label="${esc(tx('fehlermeldung.kopieren'))}"></textarea>`,
      `<button type="button" class="knopf leise klein" data-a="zu">${esc(tx('fehlermeldung.abbrechen'))}</button><button type="button" class="knopf haupt klein" data-a="senden">${esc(tx('fehlermeldung.senden'))}</button>`);
  }
  const q = s => d.querySelector(s), status = t => { const s = q('#fm-status'); if (s) s.textContent = t; };
  const aktuelleMeldung = () => { m = meldungBauen(akte, q('#fm-kommentar')?.value || '', m ? { nr: m.nr } : {}); return m; };   // dieselbe Nummer bei jedem Versuch: nichts kommt doppelt an
  d.onclick = async ev => {
    const a = ev.target.closest('[data-a]')?.dataset.a;
    if (!a) { if (ev.target === d) zu(); return; }
    if (a === 'zu') { zu(); return; }
    if (a === 'senden') {
      const knopf = ev.target.closest('[data-a]'); knopf.disabled = true; laeuft = true; status(tx('fehlermeldung.sendet'));
      const e = await absenden(aktuelleMeldung());
      laeuft = false; if (!offen) return;
      if (e === 'ok') {
        q('.dialog-text').innerHTML = `<p>${esc(tx('fehlermeldung.danke'))}</p>`; q('.fm-knoepfe').innerHTML = zuTaste; q('[data-a="zu"]').focus();
      } else {
        status(e === 'abgelehnt' ? tx('fehlermeldung.abgelehnt') : tx('fehlermeldung.spaeter')); knopf.disabled = false; knopf.textContent = tx('fehlermeldung.erneut');
        q('#fm-ersatz').classList.remove('verdeckt');
      }
      return;
    }
    if (a === 'kopieren' || a === 'mail') {
      const text = berichtText(aktuelleMeldung());
      if (a === 'mail') { location.href = `mailto:${RUECKMELDUNG_AN}?subject=${encodeURIComponent(tx('fehlermeldung.betreff', { VERSION }))}&body=${encodeURIComponent(text.slice(0, 1800))}`; return; }
      let gut = false;
      try { await navigator.clipboard.writeText(text); gut = true; } catch (x) { gut = false; }
      if (gut) { status(tx('fehlermeldung.kopiert')); return; }
      // Rückfall: Text sichtbar und markiert, die Nutzerin kopiert von Hand
      const f = q('#fm-kopie'); f.value = text; f.classList.remove('verdeckt'); f.focus(); f.select();
      try { if (document.execCommand?.('copy')) { status(tx('fehlermeldung.kopiert')); return; } } catch (x) { /* von Hand */ }
      status(tx('fehlermeldung.kopieren_hand'));
    }
  };
  hintergrundSperren(true);
  addEventListener('keydown', taste, true); addEventListener('hashchange', zu);
  document.body.appendChild(d); dialogEl = d;
  (q('[data-a="senden"]') || q('[data-a="zu"]'))?.focus({ preventScroll: true });   // nicht ins Kommentarfeld: sonst springt am Handy sofort die Tastatur auf
}

// Notansicht (die App ist nicht gestartet): ein Knopf unter dem Hinweis, nur wenn ein Fehler vorliegt
export function notKnopf(kasten) {
  if (!kasten || !letzte() || kasten.querySelector('[data-fehler]')) return;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'knopf leise klein'; b.dataset.fehler = '1'; b.textContent = tx('fehlermeldung.melden');
  b.onclick = () => melden(); kasten.appendChild(b);
}

// ---------- Anschluss ----------
// Fehler, die start.js vor dem Laden dieser Datei sah, nachtragen; danach hört diese Datei auf das Ereignis, das start.js und app.js auslösen
if (typeof globalThis.addEventListener === 'function') {
  const vor = globalThis.itqanFehlerVor; globalThis.itqanFehlerVor = null;
  addEventListener('itqan-fehler', ev => erfassen(ev.detail?.e, ev.detail?.wo));
  addEventListener('online', () => nachsendenPlanen(3000));
  for (const [e, wo] of Array.isArray(vor) ? vor : []) erfassen(e, wo);
  nachsendenPlanen(20000);
}
