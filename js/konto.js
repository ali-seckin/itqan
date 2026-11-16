// Itqān · Konto: Anmeldung per E-Mail-Code bei Supabase, ohne Fremdbibliothek (nur fetch).
// Die Sitzung liegt unter 'itqan-konto': { a: Zugangsschlüssel, r: Erneuerungsschlüssel, ablauf: ms, uid, email }.
import { SERVER } from './server.js';

const KEY = 'itqan-konto';
export class NetzFehler extends Error {}
export class ServerFehler extends Error { constructor(status, text) { super(`${status} ${text}`); this.status = status; } }
export class AbgemeldetFehler extends Error {}

const lesen = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
const schreiben = s => { try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch (e) {} };
export const sitzung = () => lesen();

async function roh(pfad, { methode = 'GET', token, body, kopf = {} } = {}) {
  let r;
  try {
    r = await fetch(SERVER.url + pfad, { method: methode, headers: { apikey: SERVER.key, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...kopf }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) { throw new NetzFehler(e?.message || 'offline'); }
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
  if (!r.ok) throw new ServerFehler(r.status, (j && (j.msg || j.message || j.error_description)) || t.slice(0, 200));
  return j;
}
function uebernehmen(j) {
  if (!j?.access_token) throw new ServerFehler(0, 'no-session');
  const s = { a: j.access_token, r: j.refresh_token, ablauf: Date.now() + Math.max(60, (j.expires_in || 3600) - 60) * 1000, uid: j.user?.id, email: j.user?.email };
  schreiben(s); return s;
}

// Schritt 1: Code an die Adresse schicken (legt beim ersten Mal das Konto an)
export const codeSenden = email => roh('/auth/v1/otp', { methode: 'POST', body: { email: email.trim(), create_user: true } });
// Schritt 2: Code prüfen. Neue Konten brauchen je nach Server den Typ „signup“ statt „email“.
export async function codePruefen(email, code) {
  let letzter;
  for (const type of ['email', 'signup']) {
    try { return uebernehmen(await roh('/auth/v1/verify', { methode: 'POST', body: { type, email: email.trim(), token: code.trim() } })); }
    catch (e) { if (!(e instanceof ServerFehler) || e.status >= 500) throw e; letzter = e; }
  }
  throw letzter;
}
// Gültigen Zugangsschlüssel liefern, bei Bedarf erneuern
async function token() {
  const s = lesen(); if (!s) throw new AbgemeldetFehler('abgemeldet');
  if (s.ablauf > Date.now()) return s.a;
  try { return uebernehmen(await roh('/auth/v1/token?grant_type=refresh_token', { methode: 'POST', body: { refresh_token: s.r } })).a; }
  catch (e) { if (e instanceof ServerFehler && e.status >= 400 && e.status < 500) { schreiben(null); throw new AbgemeldetFehler('abgemeldet'); } throw e; }
}
// Aufruf mit Anmeldung. Bei „abgelaufen“ (401) einmal neu versuchen.
export async function api(pfad, opt = {}) {
  try { return await roh(pfad, { ...opt, token: await token() }); }
  catch (e) {
    if (e instanceof ServerFehler && e.status === 401 && lesen()) { const s = lesen(); s.ablauf = 0; schreiben(s); return roh(pfad, { ...opt, token: await token() }); }
    throw e;
  }
}
export async function abmelden() {
  const s = lesen(); schreiben(null);
  if (s) try { await roh('/auth/v1/logout', { methode: 'POST', token: s.a }); } catch (e) {}
}
export const kontoLoeschen = () => api('/rest/v1/rpc/konto_loeschen', { methode: 'POST', body: {} });
