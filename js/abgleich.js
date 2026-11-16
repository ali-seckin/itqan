// Itqān · Abgleich mit dem Konto (Server). Modell: konzept/datenmodell.md, Server: konzept/server/schema.sql.
// Der Server hält den Sockel (ein vollständiger Profilstand ohne Protokoll, mit Generation n) und alle Einträge der Generation.
// Dieses Gerät hält eine Kopie des Sockels, die Einträge dazu und einen Ausgang (noch nicht gesendete Einträge).
// Der Stand ist immer: nachbau(Sockel, alle Einträge). So landen Einträge verschiedener Geräte in einer festen Reihenfolge.
import * as Z from './zustand.js';
import * as K from './konto.js';
import { D } from './daten.js';

const SYNC = 'itqan-abgleich', KOPIE = 'itqan-abgleich-sockel', LISTE = 'itqan-abgleich-eintraege';
// Einstellungen, die zum Gerät gehören (Bildschirmgröße, Erscheinungsbild): sie wandern nicht von Gerät zu Gerät
const GERAETE_EINST = ['thema', 'textGroesse', 'seitenGroesse', 'stopp'];
const lies = (k, e = null) => { try { const t = localStorage.getItem(k); return t ? JSON.parse(t) : e; } catch (x) { return e; } };
const schreib = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (x) { return false; } };
const weg = k => { try { localStorage.removeItem(k); } catch (x) {} };
const kopie = x => JSON.parse(JSON.stringify(x));
const gleich = (a, b) => !!a && !!b && a.n === b.n && a.z === b.z && a.g === b.g;
const meta = sp => ({ n: sp.sockel_n, z: sp.sockel_z, g: sp.sockel_g });
const dedupe = liste => [...new Map(liste.map(e => [e.i, e])).values()];

let sync;   // { uid, sockel: {n,z,g}, cursor, ausgang: [Einträge], offen, neuAufbau, listeFehlt, letzter }
const zustand = () => sync === undefined ? (sync = lies(SYNC)) : sync;
const sichern = () => { if (sync) schreib(SYNC, sync); else weg(SYNC); };
function lokalLoeschen() { sync = null; weg(SYNC); weg(KOPIE); weg(LISTE); }
export function geraetWechsel() { sync = undefined; }   // nur für Tests: der Speicher wurde ausgetauscht

// ---------- Anhängen an das Protokoll ----------
let auto = true, zeit = null, verzoegerung = 4000;
export function autoSetzen(an, ms = 4000) { auto = an; verzoegerung = ms; }
function planen() {
  if (!auto) return;
  clearTimeout(zeit);
  zeit = setTimeout(() => { abgleichen({ neuAufbauen: false }); }, verzoegerung);
  zeit.unref?.();
}
export function starten() {
  Z.eintragHakenSetzen(e => {
    const s = zustand(); if (!s) return;
    s.ausgang.push(kopie(e)); sichern(); planen();
  });
}

// ---------- Server ----------
async function serverProfil(voll = false) {
  const r = await K.api(`/rest/v1/profile?select=sockel_n,sockel_z,sockel_g${voll ? ',stand' : ''}`);
  return r?.[0] || null;
}
async function eintraegeHolen(n, ab) {
  const aus = []; let cursor = ab;
  for (;;) {
    const r = await K.api(`/rest/v1/eintraege?select=seq,daten&sockel_n=eq.${n}&seq=gt.${cursor}&order=seq.asc&limit=1000`) || [];
    aus.push(...r);
    if (r.length < 1000) break;
    cursor = r[r.length - 1].seq;
  }
  return aus;
}
async function senden(uid, n, liste) {
  for (let i = 0; i < liste.length; i += 200) {
    const teil = liste.slice(i, i + 200).map(e => ({ user_id: uid, i: e.i, sockel_n: n, z: e.z, y: e.y, daten: e }));
    await K.api('/rest/v1/eintraege?on_conflict=user_id,sockel_n,i', { methode: 'POST', body: teil, kopf: { Prefer: 'resolution=ignore-duplicates,return=minimal' } });
  }
}

// ---------- Wege ----------
// Stand dieses Geräts als neue Generation auf das Konto legen (Umzug, oder bewusst „diesen Stand behalten“)
async function hochladen(ks, sp) {
  Z.schnappschuss('vor dem Konto');
  Z.sockelNeu(sp ? sp.sockel_n : 0);
  const p = kopie({ ...Z.P, log: [] });
  await K.api('/rest/v1/profile?on_conflict=user_id', { methode: 'POST', body: { user_id: ks.uid, sockel_n: p.sockel.n, sockel_z: p.sockel.z, sockel_g: p.sockel.g, stand: p, aktualisiert: new Date().toISOString() }, kopf: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
  sync = { uid: ks.uid, sockel: kopie(p.sockel), cursor: 0, ausgang: [], offen: 0, neuAufbau: false, listeFehlt: false, letzter: Date.now() };
  schreib(KOPIE, p); schreib(LISTE, []); sichern();
  return { art: sp ? 'ersetzt' : 'umzug' };
}
// Stand des Kontos auf dieses Gerät holen. mitnehmen: eigene Einträge, die nach dem neuen Sockel entstanden sind, behalten.
async function vomServer(ks, sp, { mitnehmen = false } = {}) {
  const s = zustand();
  const eigene = mitnehmen && s ? dedupe([...lies(LISTE, []), ...s.ausgang]) : [];
  if (Z.P) Z.schnappschuss('vor dem Abgleich');
  const geholt = await eintraegeHolen(sp.sockel_n, 0);
  const mit = eigene.length ? Z.umziehen(eigene, sp.stand).uebernommen : [];
  sync = { uid: ks.uid, sockel: meta(sp), cursor: geholt.length ? geholt[geholt.length - 1].seq : 0, ausgang: mit, offen: 0, neuAufbau: false, listeFehlt: false, letzter: Date.now() };
  schreib(KOPIE, sp.stand);
  if (!schreib(LISTE, geholt.map(x => x.daten))) sync.listeFehlt = true;
  sichern();
  return aufbauen('uebernommen');
}
// Stand aus Sockel und allen Einträgen neu bauen
async function aufbauen(art) {
  const s = zustand(), sockel = lies(KOPIE);
  if (!sockel) throw new K.ServerFehler(0, 'sockel-missing');
  let liste = s.listeFehlt ? (await eintraegeHolen(s.sockel.n, 0)).map(x => x.daten) : lies(LISTE, []);
  const alle = dedupe([...liste, ...s.ausgang]);
  if (sockel.gliederung !== D.gliederung) {
    // Die Daten dieses Geräts gehören zu einer anderen Gliederung als der Stand des Kontos: Stand ohne Einträge übernehmen,
    // der Aufbau folgt beim nächsten Start, wenn die passende Gliederung geladen ist.
    Z.standUebernehmen(sockel, []); s.neuAufbau = true; sichern();
    return { art, neuLaden: true };
  }
  const p = Z.nachbau(sockel, alle);
  const alt = Z.P?.einst || {};
  for (const k of GERAETE_EINST) if (k in alt) p.einst[k] = alt[k];
  Z.standUebernehmen(p, alle.slice(-300));
  s.neuAufbau = false; s.offen = 0; s.letzter = Date.now(); sichern();
  return { art, aufgebaut: true };
}
// Gewöhnlicher Durchlauf: senden, abholen, bei fremden Einträgen neu aufbauen
async function normal(ks, neuAufbauen) {
  const s = zustand();
  const zuSenden = s.ausgang.slice();
  let liste = s.listeFehlt ? null : lies(LISTE, []);
  if (zuSenden.length) {
    await senden(ks.uid, s.sockel.n, zuSenden);
    const ids = new Set(zuSenden.map(e => e.i));
    s.ausgang = s.ausgang.filter(e => !ids.has(e.i));
    if (liste) { liste.push(...zuSenden); if (!schreib(LISTE, liste)) s.listeFehlt = true; }
    sichern();
  }
  const geholt = await eintraegeHolen(s.sockel.n, s.cursor);
  let neu = 0;
  if (geholt.length) {
    const bekannt = new Set((liste || []).map(e => e.i)), fremd = [];
    for (const x of geholt) if (!bekannt.has(x.daten.i)) { fremd.push(x.daten); bekannt.add(x.daten.i); }
    s.cursor = geholt[geholt.length - 1].seq;
    if (fremd.length) {
      neu = fremd.length; s.offen = (s.offen || 0) + neu;
      if (liste) { liste.push(...fremd); if (!schreib(LISTE, liste)) s.listeFehlt = true; }
    }
    sichern();
  }
  s.letzter = Date.now(); sichern();
  if (neuAufbauen && (s.offen > 0 || s.neuAufbau)) { const r = await aufbauen('ok'); return { ...r, neu: neu || s.offen }; }
  return { art: 'ok', neu, wartet: s.offen > 0 || !!s.neuAufbau };
}
const ueberblick = p => Z.profilUeberblick(p);
async function konfliktOderWahl(ks, sp, wahl) {
  sp = sp.stand ? sp : await serverProfil(true);
  if (wahl === 'server') return vomServer(ks, sp);
  if (wahl === 'lokal') return hochladen(ks, sp);
  return { art: 'konflikt', server: ueberblick(sp.stand), lokal: ueberblick(Z.P) };
}

// ---------- Hauptweg ----------
let laeuft = null;
export function abgleichen(opt = {}) {
  if (laeuft) return laeuft;
  return laeuft = durchlauf(opt).finally(() => { laeuft = null; });
}
async function durchlauf({ wahl, neuAufbauen = true } = {}) {
  const ks = K.sitzung();
  if (!ks) return { art: 'abgemeldet' };
  try {
    let s = zustand();
    if (s && s.uid !== ks.uid) { lokalLoeschen(); s = null; }       // anderes Konto auf diesem Gerät
    let sp = await serverProfil(!s);
    if (!s) {                                                        // dieses Gerät ist noch nicht mit dem Konto verbunden
      if (!Z.P) return sp ? await vomServer(ks, sp) : { art: 'kein_profil' };
      if (!sp) return await hochladen(ks, null);
      if (!ueberblick(Z.P).abschnitte) return await vomServer(ks, sp);
      return await konfliktOderWahl(ks, sp, wahl);
    }
    if (!sp) return await hochladen(ks, null);                       // auf dem Konto liegt nichts mehr: Stand erneut hochladen
    const srv = meta(sp), lokalNeu = !!Z.P && !gleich(Z.P.sockel, s.sockel), serverNeu = !gleich(srv, s.sockel);
    if (lokalNeu && wahl === 'server') return await konfliktOderWahl(ks, sp, wahl);
    if (lokalNeu && (!serverNeu || Z.sockelNeuer(Z.P.sockel, srv))) return await hochladen(ks, sp);   // eigene neue Generation (Gliederung, Sicherung geladen)
    if (lokalNeu) return await konfliktOderWahl(ks, sp, wahl);
    if (serverNeu) { sp = await serverProfil(true); return await vomServer(ks, sp, { mitnehmen: true }); }
    return await normal(ks, neuAufbauen);
  } catch (e) {
    if (e instanceof K.AbgemeldetFehler) return { art: 'abgemeldet' };
    if (e instanceof K.NetzFehler) return { art: 'offline' };
    return { art: 'fehler', text: String(e?.message || e) };
  }
}

// ---------- Für die Oberfläche ----------
export function status() {
  const k = K.sitzung(), s = zustand();
  return { angemeldet: !!k, email: k?.email || '', verbunden: !!(k && s && s.uid === k.uid), offen: s?.ausgang?.length || 0, wartet: !!(s && (s.offen > 0 || s.neuAufbau)), letzter: s?.letzter || 0 };
}
export { NetzFehler, ServerFehler } from './konto.js';
export const codeSenden = K.codeSenden;
export const codePruefen = K.codePruefen;
export async function abmelden() { await K.abmelden(); lokalLoeschen(); }
export async function kontoLoeschen() { await K.kontoLoeschen(); await K.abmelden(); lokalLoeschen(); }
// Alle Daten des Kontos als Text (Datenexport)
export async function datenExport() {
  const profil = await K.api('/rest/v1/profile?select=*');
  const eintraege = []; let cursor = 0;
  for (;;) {
    const r = await K.api(`/rest/v1/eintraege?select=seq,sockel_n,daten&seq=gt.${cursor}&order=seq.asc&limit=1000`) || [];
    eintraege.push(...r);
    if (r.length < 1000) break;
    cursor = r[r.length - 1].seq;
  }
  return JSON.stringify({ format: 'itqan-konto', exportiert: new Date().toISOString(), email: K.sitzung()?.email, profil: profil?.[0] || null, eintraege }, null, 1);
}
