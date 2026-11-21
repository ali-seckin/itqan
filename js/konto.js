// Itqān · Konto: Anmeldung per E-Mail-Code bei Supabase, ohne Fremdbibliothek (nur fetch).
// Die Sitzung liegt unter 'itqan-konto': { a: Zugangsschlüssel, r: Erneuerungsschlüssel, ablauf: ms, uid, email, seit: ms der Anmeldung }.
import { SERVER } from './server.js';

const KEY = 'itqan-konto', AUS = 'itqan-konto-abmelden';
export class NetzFehler extends Error {}
// code: Kennung des Fehlers vom Server (error_code von Supabase Auth, code von PostgREST), soweit vorhanden
export class ServerFehler extends Error { constructor(status, text, code = '') { super(`${status} ${text}`); this.status = status; this.code = code; } }
export class AbgemeldetFehler extends Error {}

const lesen = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
const schreiben = s => { try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch (e) {} };
export const sitzung = () => lesen();
// Wie lange die Anmeldung per Code her ist (ms). Unbekannt (Sitzung aus einer älteren Fassung): Infinity
export const anmeldeAlter = () => { const s = lesen(); return s?.seit ? Math.max(0, Date.now() - s.seit) : Infinity; };

// Abweichung der Geräteuhr von der Serveruhr in ms (Gerät minus Server), aus der Kopfzeile Date. null: noch nicht bekannt
// (Browser geben die Kopfzeile nur heraus, wenn der Server sie freigibt).
let abweichung = null;
export const uhrAbweichung = () => abweichung;

async function roh(pfad, { methode = 'GET', token, body, kopf = {} } = {}) {
  let r;
  try {
    r = await fetch(SERVER.url + pfad, { method: methode, headers: { apikey: SERVER.key, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...kopf }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) { throw new NetzFehler(e?.message || 'offline'); }
  try { const d = Date.parse(r.headers?.get?.('date') || ''); if (d > 0) abweichung = Date.now() - d; } catch (e) {}
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
  if (!r.ok) {
    const code = [j?.error_code, j?.error, j?.code].find(x => typeof x === 'string') || '';
    throw new ServerFehler(r.status, (j && (j.msg || j.message || j.error_description)) || t.slice(0, 200), code);
  }
  return j;
}
function uebernehmen(j, alt) {
  if (!j?.access_token) throw new ServerFehler(0, 'no-session');
  const s = { a: j.access_token, r: j.refresh_token, ablauf: Date.now() + Math.max(60, (j.expires_in || 3600) - 60) * 1000, uid: j.user?.id, email: j.user?.email, seit: alt?.seit || Date.now() };
  schreiben(s); return s;
}

// Schritt 1: Code an die Adresse schicken (legt beim ersten Mal das Konto an). captcha: Token der Captcha-Prüfung,
// sobald sie im Dashboard eingeschaltet ist (konzept/server/LIESMICH.md).
export const codeSenden = (email, { captcha } = {}) => roh('/auth/v1/otp', { methode: 'POST', body: { email: email.trim(), create_user: true, ...(captcha ? { gotrue_meta_security: { captcha_token: captcha } } : {}) } });
// Schritt 2: Code prüfen. Neue Konten brauchen je nach Server den Typ „signup“ statt „email“.
// „Zu viele Versuche“ (429) bricht sofort ab und kostet keinen zweiten Versuch.
export async function codePruefen(email, code) {
  let letzter;
  for (const type of ['email', 'signup']) {
    try { return uebernehmen(await roh('/auth/v1/verify', { methode: 'POST', body: { type, email: email.trim(), token: code.trim() } })); }
    catch (e) { if (!(e instanceof ServerFehler) || e.status >= 500 || e.status === 429) throw e; letzter = e; }
  }
  throw letzter;
}
// Für die Oberfläche: was ist beim Senden oder Prüfen des Codes schiefgegangen? 'netz' | 'zu_oft' | 'falsch' | 'server'
export function codeFehlerArt(e) {
  if (e instanceof NetzFehler) return 'netz';
  if (!(e instanceof ServerFehler)) return 'server';
  if (e.status === 429 || /rate.?limit/i.test(e.code)) return 'zu_oft';
  return e.status >= 400 && e.status < 500 ? 'falsch' : 'server';
}

// Nur eine eindeutige Absage des Servers beendet die Sitzung. 429 (zu viele Anfragen), 408 und 5xx sind vorübergehend.
const sitzungUngueltig = e => [400, 401, 403].includes(e.status)
  && /refresh.?token|invalid_grant|session.?(not.?found|expired)|user.?(not.?found|banned)|bad_jwt/i.test(e.code + ' ' + e.message);
// Erneuern: je Reiter nur ein Lauf zugleich, zwischen Reitern über navigator.locks abgestimmt (wo vorhanden).
// Ein benutzter Erneuerungsschlüssel ist danach ungültig: zwei Reiter dürften sich sonst gegenseitig abmelden.
const sperre = f => globalThis.navigator?.locks?.request ? globalThis.navigator.locks.request('itqan-konto', f) : f();
let erneuerung = null;
function erneuern() {
  return erneuerung ??= sperre(async () => {
    const s = lesen(); if (!s) throw new AbgemeldetFehler('abgemeldet');
    if (s.ablauf > Date.now()) return s.a;                           // ein anderer Reiter war schneller
    try { return uebernehmen(await roh('/auth/v1/token?grant_type=refresh_token', { methode: 'POST', body: { refresh_token: s.r } }), s).a; }
    catch (e) {
      if (!(e instanceof ServerFehler) || !sitzungUngueltig(e)) throw e;
      const jetzt = lesen();
      if (jetzt && jetzt.r !== s.r && jetzt.ablauf > Date.now()) return jetzt.a;   // inzwischen liegt eine frische Sitzung da
      if (!jetzt || jetzt.r === s.r) schreiben(null);
      throw new AbgemeldetFehler('abgemeldet');
    }
  }).finally(() => { erneuerung = null; });
}
// Gültigen Zugangsschlüssel liefern, bei Bedarf erneuern
async function token() {
  const s = lesen(); if (!s) throw new AbgemeldetFehler('abgemeldet');
  return s.ablauf > Date.now() ? s.a : erneuern();
}
// Aufruf mit Anmeldung. Bei „abgelaufen“ (401) einmal neu versuchen.
export async function api(pfad, opt = {}) {
  try { return await roh(pfad, { ...opt, token: await token() }); }
  catch (e) {
    if (e instanceof ServerFehler && e.status === 401 && lesen()) { const s = lesen(); s.ablauf = 0; schreiben(s); return roh(pfad, { ...opt, token: await token() }); }
    throw e;
  }
}

// ---------- Abmelden ----------
// Auf dem Gerät gilt die Abmeldung sofort und immer. Auf dem Server wird nur die Sitzung dieses Geräts beendet (scope=local),
// andere Geräte bleiben angemeldet. Ist der Zugangsschlüssel abgelaufen, wird er vorher erneuert, sonst bliebe der
// Erneuerungsschlüssel auf dem Server gültig. Ohne Netz wird die Abmeldung vorgemerkt und später nachgeholt.
const ausLesen = () => { try { const l = JSON.parse(localStorage.getItem(AUS) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } };
const ausSchreiben = l => { try { if (l.length) localStorage.setItem(AUS, JSON.stringify(l.slice(-5))); else localStorage.removeItem(AUS); } catch (e) {} };
const spaeter = e => e instanceof NetzFehler || (e instanceof ServerFehler && (e.status === 429 || e.status === 408 || e.status >= 500));
async function serverAbmelden(s) {
  let a = s.ablauf > Date.now() ? s.a : null, r = s.r, erneuert = false;
  try {
    for (;;) {
      if (!a) { const j = await roh('/auth/v1/token?grant_type=refresh_token', { methode: 'POST', body: { refresh_token: r } }); a = j?.access_token; r = j?.refresh_token || r; erneuert = true; }
      try { await roh('/auth/v1/logout?scope=local', { methode: 'POST', token: a }); return true; }
      catch (e) { if (e instanceof ServerFehler && e.status === 401 && !erneuert) { a = null; continue; } throw e; }
    }
  } catch (e) {
    if (spaeter(e) && r) ausSchreiben([...ausLesen(), { r, z: s.z || Date.now() }]);   // sonst: der Server kennt die Sitzung nicht mehr, nichts zu tun
    return false;
  }
}
// Liefert true, wenn auch der Server die Sitzung beendet hat. Wirft nie.
export async function abmelden() {
  const s = lesen(); schreiben(null);
  if (!s) return true;
  try { return await serverAbmelden(s); } catch (e) { return false; }
}
// Vorgemerkte Abmeldungen nachholen (beim Start). Vormerkungen älter als 60 Tage verfallen.
let holtNach = false;
export async function abmeldenNachholen() {
  const l = ausLesen(); if (!l.length || holtNach) return;
  holtNach = true; ausSchreiben([]);
  try { for (const x of l) if (x?.r && Date.now() - (x.z || 0) < 60 * 864e5) await serverAbmelden({ r: x.r, ablauf: 0, z: x.z }); }
  catch (e) {} finally { holtNach = false; }
}
export const kontoLoeschen = () => api('/rest/v1/rpc/konto_loeschen', { methode: 'POST', body: {} });
