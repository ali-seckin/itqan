// Itqān · Attrappe des Servers für Tests: bildet die Teile von Supabase nach, die der Abgleich benutzt
// (Anmeldung per Code, Tabellen profile und eintraege mit Zugriffsregeln, Konto löschen). Die echten Regeln prüft
// werkzeuge/server/test_server.mjs gegen den echten Server.
import { SERVER } from '../js/server.js';

export function attrappe() {
  const benutzer = new Map(), zugang = new Map(), erneuerung = new Map(), codes = new Map();
  const profile = new Map(); let eintraege = []; let seq = 0, zaehler = 0;
  const a = { offline: false, verlorene: 0, anfragen: [], benutzer, profile, get eintraege() { return eintraege; } };
  const antwort = (status, json) => ({ ok: status < 300, status, text: async () => json === undefined || json === null ? '' : JSON.stringify(json) });
  const neueSitzung = email => {
    if (!benutzer.has(email)) benutzer.set(email, { id: 'u-' + (++zaehler) });
    const id = benutzer.get(email).id, z = 'z' + (++zaehler), r = 'r' + (++zaehler);
    zugang.set(z, id); erneuerung.set(r, { id, email });
    return { access_token: z, refresh_token: r, expires_in: 3600, user: { id, email } };
  };
  a.ablaufen = () => zugang.clear();           // alle Zugangsschlüssel ungültig, Erneuerung bleibt
  a.anrufe = teil => a.anfragen.filter(x => x.includes(teil)).length;
  a.fetch = async (url, opt = {}) => {
    if (a.offline) throw new TypeError('offline');
    const u = new URL(url), pfad = u.pathname, q = u.searchParams, m = opt.method || 'GET';
    const body = opt.body ? JSON.parse(opt.body) : null;
    a.anfragen.push(m + ' ' + pfad + u.search);
    if (pfad === '/auth/v1/otp') { codes.set(body.email, '123456'); return antwort(200, {}); }
    if (pfad === '/auth/v1/verify') {
      if (codes.get(body.email) !== body.token) return antwort(403, { msg: 'Token has expired or is invalid' });
      codes.delete(body.email); return antwort(200, neueSitzung(body.email));
    }
    if (pfad === '/auth/v1/token') { const r = erneuerung.get(body.refresh_token); if (!r) return antwort(400, { error_description: 'Invalid Refresh Token' }); erneuerung.delete(body.refresh_token); return antwort(200, neueSitzung(r.email)); }
    if (pfad === '/auth/v1/logout') return antwort(204);
    const uid = zugang.get((opt.headers?.Authorization || '').replace('Bearer ', ''));
    if (!uid) return antwort(401, { message: 'JWT expired' });
    if (pfad === '/rest/v1/rpc/konto_loeschen') {
      profile.delete(uid); eintraege = eintraege.filter(e => e.user_id !== uid);
      for (const [k, v] of zugang) if (v === uid) zugang.delete(k);
      for (const [e, b] of benutzer) if (b.id === uid) benutzer.delete(e);
      return antwort(204);
    }
    const spalten = (zeile, sel) => { const l = (sel || '*').split(','); return l.includes('*') ? zeile : Object.fromEntries(l.map(k => [k, zeile[k]])); };
    if (pfad === '/rest/v1/profile') {
      if (m === 'GET') { const z = profile.get(uid); return antwort(200, z ? [spalten(z, q.get('select'))] : []); }
      if (m === 'POST') { if (body.user_id !== uid) return antwort(403, { message: 'row-level security' }); profile.set(uid, JSON.parse(JSON.stringify(body))); return antwort(201); }
    }
    if (pfad === '/rest/v1/eintraege') {
      if (m === 'GET') {
        let l = eintraege.filter(e => e.user_id === uid);
        const n = q.get('sockel_n'), s = q.get('seq');
        if (n) l = l.filter(e => e.sockel_n === +n.replace('eq.', ''));
        if (s) l = l.filter(e => e.seq > +s.replace('gt.', ''));
        l.sort((x, y) => x.seq - y.seq);
        return antwort(200, l.slice(0, +(q.get('limit') || 1000)).map(e => spalten(e, q.get('select'))));
      }
      if (m === 'POST') {
        const liste = Array.isArray(body) ? body : [body];
        if (liste.some(e => e.user_id !== uid)) return antwort(403, { message: 'row-level security' });
        for (const e of liste) if (!eintraege.some(x => x.user_id === uid && x.sockel_n === e.sockel_n && x.i === e.i)) eintraege.push({ seq: ++seq, ...JSON.parse(JSON.stringify(e)) });
        if (a.verlorene > 0) { a.verlorene--; throw new TypeError('Antwort verloren'); }   // gespeichert, aber das Gerät erfährt es nicht
        return antwort(201);
      }
    }
    return antwort(404, { message: 'unbekannt ' + m + ' ' + pfad });
  };
  a.einsetzen = () => { const alt = globalThis.fetch; globalThis.fetch = (url, opt) => String(url).startsWith(SERVER.url) ? a.fetch(url, opt) : alt(url, opt); return () => { globalThis.fetch = alt; }; };
  return a;
}
