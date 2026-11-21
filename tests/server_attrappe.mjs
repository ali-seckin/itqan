// Itqān · Attrappe des Servers für Tests: bildet die Teile von Supabase nach, die der Abgleich benutzt
// (Anmeldung per Code, Tabellen profile und eintraege mit Zugriffsregeln, Konto löschen, Forschungstabelle). Die echten Regeln prüft
// werkzeuge/server/test_server.mjs gegen den echten Server.
// Schalter für Tests:
//   offline            jede Anfrage scheitert ohne Antwort
//   verlorene = n      die nächsten n Antworten auf POST eintraege gehen verloren (gespeichert wird trotzdem)
//   stoeren(teil, {status, json, mal, verloren})  Anfragen, deren „METHODE Pfad“ teil enthält: Antwort mit status (ohne Wirkung),
//                      oder verloren: true (Wirkung ja, Antwort nein); mal: wie oft (Vorgabe 1)
//   rpc = true         die Funktionen aus nachtrag_2026-11-21.sql sind vorhanden (sockel_setzen, eintraege_aufraeumen), sonst 404
//   verborgen          Menge von seq, die beim Lesen (noch) nicht sichtbar sind (Zeile vergeben, aber noch nicht bestätigt)
//   uhrVersatz         ms, um die die Serveruhr hinter der Geräteuhr liegt (Kopfzeile Date)
import { SERVER } from '../js/server.js';

export function attrappe() {
  const benutzer = new Map(), zugang = new Map(), erneuerung = new Map(), codes = new Map(), paar = new Map();
  const profile = new Map(); let eintraege = [], forschung = []; let seq = 0, zaehler = 0;
  const stoerungen = [];
  const a = { offline: false, verlorene: 0, rpc: false, uhrVersatz: 0, verborgen: new Set(), anfragen: [], abmeldungen: [], benutzer, profile,
    get eintraege() { return eintraege; }, get forschung() { return forschung; },
    forschungGueltig: z => z.v >= 1 && z.v <= 100 && (z.n == null || z.n <= 100) && z.f + z.z + z.h <= z.v };
  const antwort = (status, json) => ({ ok: status < 300, status, headers: { get: k => String(k).toLowerCase() === 'date' ? new Date(Date.now() - a.uhrVersatz).toUTCString() : null },
    text: async () => json === undefined || json === null ? '' : JSON.stringify(json) });
  const neueSitzung = email => {
    if (!benutzer.has(email)) benutzer.set(email, { id: 'u-' + (++zaehler) });
    const id = benutzer.get(email).id, z = 'z' + (++zaehler), r = 'r' + (++zaehler);
    zugang.set(z, id); erneuerung.set(r, { id, email }); paar.set(z, r);
    return { access_token: z, refresh_token: r, expires_in: 3600, user: { id, email } };
  };
  a.ablaufen = () => zugang.clear();           // alle Zugangsschlüssel ungültig, Erneuerung bleibt
  a.sitzungen = () => erneuerung.size;         // wie viele Sitzungen der Server noch kennt
  a.anrufe = teil => a.anfragen.filter(x => x.includes(teil)).length;
  a.stoeren = (teil, { status = 500, json = { message: 'gestört' }, mal = 1, verloren = false } = {}) => { stoerungen.push({ teil, status, json, mal, verloren }); };
  a.fetch = async (url, opt = {}) => {
    if (a.offline) throw new TypeError('offline');
    const u = new URL(url), m = opt.method || 'GET';
    a.anfragen.push(m + ' ' + u.pathname + u.search);
    const st = stoerungen.find(x => x.mal > 0 && (m + ' ' + u.pathname + u.search).includes(x.teil));
    if (st && !st.verloren) { st.mal--; return antwort(st.status, st.json); }
    const r = bearbeiten(u, m, opt);
    if (st) { st.mal--; throw new TypeError('Antwort verloren'); }
    return r;
  };
  function bearbeiten(u, m, opt) {
    const pfad = u.pathname, q = u.searchParams;
    const body = opt.body ? JSON.parse(opt.body) : null;
    if (pfad === '/auth/v1/otp') { codes.set(body.email, '123456'); return antwort(200, {}); }
    if (pfad === '/auth/v1/verify') {
      if (codes.get(body.email) !== body.token) return antwort(403, { error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
      codes.delete(body.email); return antwort(200, neueSitzung(body.email));
    }
    if (pfad === '/auth/v1/token') { const r = erneuerung.get(body.refresh_token); if (!r) return antwort(400, { error_code: 'refresh_token_not_found', error_description: 'Invalid Refresh Token' }); erneuerung.delete(body.refresh_token); return antwort(200, neueSitzung(r.email)); }
    // Forschung: ohne Anmeldung, nur einfügen und (über die Funktion) löschen
    if (pfad === '/rest/v1/forschung' && m === 'POST') {
      const liste = Array.isArray(body) ? body : [body];
      if (!liste.every(a.forschungGueltig)) return antwort(400, { code: '23514', message: 'check constraint' });
      forschung.push(...liste.map(z => ({ ...z }))); return antwort(201);
    }
    if (pfad === '/rest/v1/rpc/forschung_loeschen') { forschung = forschung.filter(z => z.pid !== body.p_pid); return antwort(204); }
    const schluessel = (opt.headers?.Authorization || '').replace('Bearer ', '');
    const uid = zugang.get(schluessel);
    if (pfad === '/auth/v1/logout') {
      const scope = q.get('scope') || 'global';
      a.abmeldungen.push({ scope, gueltig: !!uid });
      if (!uid) return antwort(401, { error_code: 'bad_jwt', msg: 'invalid JWT' });
      for (const [z, id] of zugang) if (id === uid && (scope === 'global' || z === schluessel)) { erneuerung.delete(paar.get(z)); zugang.delete(z); }
      if (scope === 'global') for (const [r, x] of erneuerung) if (x.id === uid) erneuerung.delete(r);
      return antwort(204);
    }
    if (!uid) return antwort(401, { message: 'JWT expired' });
    if (pfad === '/rest/v1/rpc/konto_loeschen') {
      profile.delete(uid); eintraege = eintraege.filter(e => e.user_id !== uid);
      for (const [k, v] of zugang) if (v === uid) zugang.delete(k);
      for (const [k, v] of erneuerung) if (v.id === uid) erneuerung.delete(k);
      for (const [e, b] of benutzer) if (b.id === uid) benutzer.delete(e);
      return antwort(204);
    }
    if (pfad === '/rest/v1/rpc/sockel_setzen' && a.rpc) {
      const z = profile.get(uid);
      const passt = z ? (body.p_erwartet_n === z.sockel_n && body.p_erwartet_z === z.sockel_z && body.p_erwartet_g === z.sockel_g && body.p_n >= z.sockel_n) : body.p_erwartet_n == null;
      if (!passt) return antwort(200, 'konflikt');
      profile.set(uid, JSON.parse(JSON.stringify({ user_id: uid, sockel_n: body.p_n, sockel_z: body.p_z, sockel_g: body.p_g, stand: body.p_stand, aktualisiert: new Date().toISOString() })));
      return antwort(200, 'ok');
    }
    if (pfad === '/rest/v1/rpc/eintraege_aufraeumen' && a.rpc) {
      const z = profile.get(uid), vorher = eintraege.length;
      if (z) eintraege = eintraege.filter(e => e.user_id !== uid || e.sockel_n >= z.sockel_n);
      return antwort(200, vorher - eintraege.length);
    }
    const spalten = (zeile, sel) => { const l = (sel || '*').split(','); return l.includes('*') ? zeile : Object.fromEntries(l.map(k => [k, zeile[k]])); };
    if (pfad === '/rest/v1/profile') {
      if (m === 'GET') { const z = profile.get(uid); return antwort(200, z ? [spalten(z, q.get('select'))] : []); }
      if (m === 'POST') { if (body.user_id !== uid) return antwort(403, { message: 'row-level security' }); profile.set(uid, JSON.parse(JSON.stringify(body))); return antwort(201); }
    }
    if (pfad === '/rest/v1/eintraege') {
      if (m === 'GET') {
        let l = eintraege.filter(e => e.user_id === uid && !a.verborgen.has(e.seq));
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
    return antwort(404, { code: 'PGRST202', message: 'unbekannt ' + m + ' ' + pfad });
  }
  a.einsetzen = () => { const alt = globalThis.fetch; globalThis.fetch = (url, opt) => String(url).startsWith(SERVER.url) ? a.fetch(url, opt) : alt(url, opt); return () => { globalThis.fetch = alt; }; };
  return a;
}
