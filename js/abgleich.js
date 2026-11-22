// Itqān · Abgleich mit dem Konto (Server). Modell: konzept/datenmodell.md, Server: konzept/server/schema.sql.
// Der Server hält den Sockel (ein vollständiger Profilstand ohne Protokoll, mit Generation n) und alle Einträge der Generation.
// Dieses Gerät hält eine Kopie des Sockels, die Einträge dazu und einen Ausgang (noch nicht gesendete Einträge).
// Der Stand ist immer: nachbau(Sockel, alle Einträge). So landen Einträge verschiedener Geräte in einer festen Reihenfolge.
// Grundsätze: Ein Stand ersetzt den Stand des Kontos nur selbsttätig, wenn er dasselbe Profil fortsetzt und nicht leer ist,
// sonst entscheidet der Mensch. Am lokalen Profil wird nur getauscht, wenn die Oberfläche es im Augenblick des Einbaus erlaubt.
import * as Z from './zustand.js';
import * as K from './konto.js';
import { D } from './daten.js';

const SYNC = 'itqan-abgleich', KOPIE = 'itqan-abgleich-sockel', LISTE = 'itqan-abgleich-eintraege';
// VERSUCH: begonnener Upload (falls die Antwort verloren geht). LAGE: letzter Konflikt oder Fehler, für die Oberfläche.
// GELOESCHT: das Profil wurde auf diesem Gerät gelöscht, das Konto blieb angemeldet.
const VERSUCH = 'itqan-abgleich-versuch', LAGE = 'itqan-abgleich-lage', GELOESCHT = 'itqan-abgleich-geloescht';
// Einstellungen, die zum Gerät gehören (Bildschirmgröße, Erscheinungsbild): sie wandern nicht von Gerät zu Gerät
const GERAETE_EINST = ['thema', 'textGroesse', 'seitenGroesse', 'stopp'];
// Beim Abholen ein Stück vor den Zeiger zurückgehen: eine Zeile mit kleinerer Nummer kann später sichtbar werden als eine mit größerer
const FENSTER = 50;
const lies = (k, e = null) => { try { const t = localStorage.getItem(k); return t ? JSON.parse(t) : e; } catch (x) { return e; } };
const schreib = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (x) { return false; } };
const weg = k => { try { localStorage.removeItem(k); } catch (x) {} };
const kopie = x => JSON.parse(JSON.stringify(x));
const gleich = (a, b) => !!a && !!b && a.n === b.n && a.z === b.z && a.g === b.g;
const meta = sp => ({ n: sp.sockel_n, z: sp.sockel_z, g: sp.sockel_g });
const dedupe = liste => [...new Map(liste.map(e => [e.i, e])).values()];
// Grobe Form beim Abholen (unabhängig von der geladenen Gliederung). Die genaue Prüfung je Art folgt beim Einbau: aufbauen, Z.eintragGut.
const gueltig = e => !!e && typeof e === 'object' && typeof e.i === 'string' && typeof e.y === 'string';
class StandFehler extends Error {}
class ZwischenzeitFehler extends Error {}
export class AnmeldungAltFehler extends Error {}

let sync;   // { uid, sockel: {n,z,g}, cursor, ausgang: [Einträge], offen, neuAufbau, listeFehlt, kopieFehlt, wartetGen, letzter }
let wartetLos = false;   // ein Stand des Kontos wartet auf den Einbau, das Gerät ist aber noch nicht verbunden
const zustand = () => sync === undefined ? (sync = lies(SYNC)) : sync;
const sichern = () => { if (sync) schreib(SYNC, sync); else weg(SYNC); };
function lokalLoeschen() { sync = null; wartetLos = false; for (const k of [SYNC, KOPIE, LISTE, VERSUCH, LAGE, GELOESCHT]) weg(k); }
// Der Sockel des Kontos liegt als Kopie auf dem Gerät (für den Neuaufbau). Passt er nicht in den Speicher, wird er beim Aufbau vom Konto geholt.
function kopieSchreiben(s, stand) { if (schreib(KOPIE, stand)) s.kopieFehlt = false; else { s.kopieFehlt = true; weg(KOPIE); } }
function listeSchreiben(s, liste) { if (!schreib(LISTE, liste)) { s.listeFehlt = true; weg(LISTE); } }   // kein Platz: die alte Liste gibt ihren Platz frei, der Aufbau holt sie vom Server
export function geraetWechsel() { sync = undefined; wartetLos = false; rpcSockel = rpcRaeumen = null; }   // nur für Tests: der Speicher wurde ausgetauscht
// Die Oberfläche ruft das bei „Profil löschen“ (zusammen mit Z.loeschen()): Die Verbindung dieses Geräts zum Stand des Kontos
// wird gelöst, die Anmeldung bleibt. Danach holt abgleichen() ohne Profil den Stand vom Konto zurück; ein neu angelegtes
// Profil ersetzt weder das Konto noch wird es ersetzt, bevor jemand gewählt hat (Ergebnis 'konflikt').
export function beimProfilLoeschen() { const k = K.sitzung(); lokalLoeschen(); if (k) schreib(GELOESCHT, k.uid); }

// ---------- Anhängen an das Protokoll ----------
let auto = true, zeit = null, verzoegerung = 4000;
let ergebnisHaken = null, timerDarf = null;
export function autoSetzen(an, ms = 4000) { auto = an; verzoegerung = ms; if (!an) clearTimeout(zeit); }
// fn(ergebnis) bekommt jedes Ergebnis des selbsttätigen Laufs nach einem Eintrag (auch konflikt, fehler, neuLaden, aufgebaut).
// darf(): darf jetzt am Profil getauscht werden? Ohne darf baut der selbsttätige Lauf nie ein, er merkt nur vor.
export function ergebnisHakenSetzen(fn, darf = null) { ergebnisHaken = fn; timerDarf = typeof darf === 'function' ? darf : null; }
function planen() {
  if (!auto) return;
  clearTimeout(zeit);
  zeit = setTimeout(async () => {
    if (laeuft) return planen();                                    // ein anderer Lauf ist unterwegs: dessen Ergebnis gehört dem Aufrufer
    const r = await abgleichen({ still: true, darfAufbauen: timerDarf || (() => false) });
    try { ergebnisHaken?.(r); } catch (x) { console.warn('Abgleich', x); }
  }, verzoegerung);
  zeit.unref?.();
}
export function starten() {
  Z.eintragHakenSetzen(e => {
    const s = zustand();
    // Angemeldet, aber nicht verbunden (etwa nach „Profil löschen“ und neuem Profil): ein stiller Lauf stellt fest, ob eine Entscheidung aussteht,
    // und die Oberfläche sagt es gleich, nicht erst beim nächsten Start. Nur solange noch keine Lage (Konflikt, Fehler) bekannt ist:
    // der Kontostand wird so nicht nach jedem Eintrag abgerufen.
    if (!s) { if (K.sitzung() && !lies(LAGE)) planen(); return; }
    s.ausgang.push(kopie(e)); sichern(); planen();
  });
  K.abmeldenNachholen();
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
// Funktionen aus konzept/server/nachtrag_2026-11-21.sql. Solange der Nachtrag nicht eingespielt ist (404), gilt der alte Weg.
let rpcSockel = null, rpcRaeumen = null;
const fehlt = e => e instanceof K.ServerFehler && e.status === 404;
// Sockel schreiben. Der Server schreibt nur, wenn dort noch der Sockel liegt, den dieses Gerät gesehen hat (sp):
// so überschreiben sich zwei Geräte nicht, die fast gleichzeitig eine neue Generation hochladen.
async function sockelSetzen(ks, p, sp) {
  if (rpcSockel !== false) {
    try {
      const r = await K.api('/rest/v1/rpc/sockel_setzen', { methode: 'POST', body: { p_n: p.sockel.n, p_z: p.sockel.z, p_g: p.sockel.g, p_stand: p, p_erwartet_n: sp ? sp.sockel_n : null, p_erwartet_z: sp ? sp.sockel_z : null, p_erwartet_g: sp ? sp.sockel_g : null } });
      rpcSockel = true;
      if (r !== 'ok') throw new ZwischenzeitFehler('konflikt');
      return;
    } catch (e) { if (!fehlt(e)) throw e; rpcSockel = false; }
  }
  await K.api('/rest/v1/profile?on_conflict=user_id', { methode: 'POST', body: { user_id: ks.uid, sockel_n: p.sockel.n, sockel_z: p.sockel.z, sockel_g: p.sockel.g, stand: p, aktualisiert: new Date().toISOString() }, kopf: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
}
// Einträge älterer Generationen auf dem Server entfernen (sie stecken im neuen Sockel). Misslingt es, schadet das nicht.
async function serverAufraeumen() {
  if (rpcRaeumen === false) return;
  try { await K.api('/rest/v1/rpc/eintraege_aufraeumen', { methode: 'POST', body: {} }); rpcRaeumen = true; }
  catch (e) { if (fehlt(e)) rpcRaeumen = false; }
}
// Ein Stand vom Konto wird geprüft, bevor er eingebaut wird (Z.profilPruefen wirft bei ungültiger Struktur)
function standPruefen(stand) {
  if (!stand || typeof stand !== 'object' || stand.format !== 'itqan' || !stand.sockel || typeof stand.sockel !== 'object') throw new StandFehler('format');
  try { Z.profilPruefen?.(stand); } catch (e) { throw new StandFehler(String(e?.message || e)); }
}

// ---------- Wege ----------
const ueberblick = p => Z.profilUeberblick(p);
const konfliktErgebnis = sp => ({ art: 'konflikt', server: ueberblick(sp.stand), lokal: ueberblick(Z.P) });
// Schutzregel: Darf der Stand dieses Geräts den Stand des Kontos ohne ausdrückliche Wahl ersetzen? Nein, wenn er leer ist
// und das Konto geübte Abschnitte hat, und nein, wenn er ein anderes Profil ist (anderer Zeitpunkt des Anlegens).
function ungefragtVerboten(stand) {
  const srv = ueberblick(stand || {}), lok = ueberblick(Z.P);
  return (srv.abschnitte > 0 && !lok.abschnitte) || (stand?.erstellt || '') !== (Z.P.erstellt || '');
}
function verbinden(ks, sockel, ausgang, cursor = 0) {
  sync = { uid: ks.uid, sockel: kopie(sockel), cursor, ausgang, offen: 0, neuAufbau: false, listeFehlt: false, kopieFehlt: false, letzter: Date.now() };
  wartetLos = false; weg(GELOESCHT); weg(VERSUCH);
  return sync;
}
// Stand dieses Geräts als neue Generation auf das Konto legen (Umzug, eigene neue Generation, oder bewusst „diesen Stand behalten“).
// Ein Fehlversuch ändert auf dem Gerät nichts: kein weiterer Schnappschuss, keine höhere Generation, das Protokoll bleibt.
async function hochladen(ks, sp, { ausdruecklich = false } = {}) {
  if (sp && !ausdruecklich) {
    if (!sp.stand) sp = await serverProfil(true);
    if (sp && ungefragtVerboten(sp.stand)) return konfliktErgebnis(sp);
  }
  const daten = JSON.stringify({ ...Z.P, log: [] });
  if (!Z.schnappschuesse().some(x => x.grund === 'vor dem Konto' && x.daten === daten)) Z.schnappschuss('vor dem Konto');
  const vor = { sockel: kopie(Z.P.sockel), log: kopie(Z.P.log || []) };
  Z.sockelNeu(sp ? sp.sockel_n : 0);
  const p = kopie({ ...Z.P, log: [] }), neu = kopie(p.sockel);
  // Vormerken: geht nur die Antwort verloren, erkennt der nächste Lauf den eigenen Sockel auf dem Server wieder
  schreib(VERSUCH, { uid: ks.uid, sockel: neu, von: vor.sockel, bis: vor.log.length ? vor.log[vor.log.length - 1].i : null });
  try { await sockelSetzen(ks, p, sp); }
  catch (e) {
    if (Z.P && gleich(Z.P.sockel, neu)) { Z.P.sockel = vor.sockel; Z.P.log = [...vor.log, ...(Z.P.log || [])]; Z.speichern(); }
    if (!(e instanceof K.NetzFehler)) weg(VERSUCH);                // der Server hat abgelehnt: dort liegt der neue Sockel sicher nicht
    if (e instanceof ZwischenzeitFehler) { const jetzt = await serverProfil(true); return jetzt ? konfliktErgebnis(jetzt) : { art: 'fehler', text: 'konflikt' }; }
    throw e;
  }
  verbinden(ks, neu, kopie(Z.P.log || []));                         // was während des Hochladens geübt wurde, steht nicht im Sockel: in den Ausgang
  kopieSchreiben(sync, p); schreib(LISTE, []); sichern();
  await serverAufraeumen();
  return { art: sp ? 'ersetzt' : 'umzug' };
}
// Der eigene Sockel liegt schon auf dem Konto (die Antwort auf den Upload ging verloren): Abgleichstand ohne neuen Upload nachziehen.
// neue: Einträge, die nach dem Sockel entstanden sind.
async function nachziehen(ks, srv, neue) {
  const voll = await serverProfil(true);
  if (!voll || !gleich(meta(voll), srv)) return false;
  verbinden(ks, srv, kopie(neue));
  kopieSchreiben(sync, voll.stand); schreib(LISTE, []); sichern();
  if (!gleich(Z.P.sockel, srv)) { Z.P.sockel = kopie(srv); Z.P.log = kopie(neue); Z.speichern(); }
  return true;
}
function vormerken() {
  const s = zustand();
  if (s) { if (!s.wartetGen) { s.wartetGen = true; sichern(); } } else wartetLos = true;
  return { art: 'wartet', wartet: true };
}
// Stand des Kontos auf dieses Gerät holen. mitnehmen: eigene Einträge, die nach dem neuen Sockel entstanden sind, behalten.
// darf(): wird unmittelbar vor dem Tausch gefragt. Ist der Einbau nicht erlaubt, bleibt alles, wie es ist (vorgemerkt).
async function vomServer(ks, sp, { mitnehmen = false, darf = () => true } = {}) {
  if (!darf()) return vormerken();
  if (!sp.stand) sp = await serverProfil(true);
  if (!sp) return { art: 'fehler', text: 'sockel-missing' };
  standPruefen(sp.stand);
  const geholt = await eintraegeHolen(sp.sockel_n, 0);
  if (!darf()) return vormerken();
  const s = zustand();
  const eigene = mitnehmen && s ? dedupe([...lies(LISTE, []), ...s.ausgang]) : [];
  if (Z.P) Z.schnappschuss('vor dem Abgleich');
  const mit = eigene.length ? Z.umziehen(eigene, sp.stand).uebernommen : [];
  const neu = verbinden(ks, meta(sp), mit, geholt.length ? geholt[geholt.length - 1].seq : 0);
  kopieSchreiben(neu, sp.stand);
  listeSchreiben(neu, geholt.map(x => x.daten).filter(gueltig));
  sichern();
  return aufbauen('uebernommen');
}
// Stand aus Sockel und allen Einträgen neu bauen
async function aufbauen(art) {
  const s = zustand();
  let sockel = s.kopieFehlt ? null : lies(KOPIE);
  // Keine Kopie auf dem Gerät (Speicher voll): den Sockel vom Konto holen, aber nur den, zu dem die Einträge gehören
  if (!sockel && s.kopieFehlt) { const voll = await serverProfil(true); if (voll && gleich(meta(voll), s.sockel)) sockel = voll.stand; }
  if (!sockel) throw new K.ServerFehler(0, 'sockel-missing');
  let liste = s.listeFehlt ? (await eintraegeHolen(s.sockel.n, 0)).map(x => x.daten).filter(gueltig) : lies(LISTE, []);
  let alle = dedupe([...liste, ...s.ausgang]);
  if (sockel.gliederung !== D.gliederung) {
    // Die Daten dieses Geräts gehören zu einer anderen Gliederung als der Stand des Kontos: Stand ohne Einträge übernehmen,
    // der Aufbau folgt beim nächsten Start, wenn die passende Gliederung geladen ist.
    Z.standUebernehmen(sockel, []); s.neuAufbau = true; sichern();
    return { art, neuLaden: true };
  }
  // Einträge vom Konto werden geprüft, bevor sie in den Stand kommen (Form, Wertebereich, bekannter Abschnitt der geladenen Gliederung).
  // Was nicht passt, wird übersprungen und hält den Abgleich nicht auf; Fremdtext erreicht das Profil so nie.
  alle = alle.filter(Z.eintragGut);
  const p = Z.nachbau(sockel, alle);
  const alt = Z.P?.einst || {};
  for (const k of GERAETE_EINST) if (k in alt) p.einst[k] = alt[k];
  Z.standUebernehmen(p, alle.slice(-300));
  s.neuAufbau = false; s.offen = 0; s.letzter = Date.now(); sichern();
  return { art, aufgebaut: true };
}
// Gewöhnlicher Durchlauf: senden, abholen, bei fremden Einträgen neu aufbauen (wenn es gerade erlaubt ist)
async function normal(ks, darf) {
  const s = zustand();
  const zuSenden = s.ausgang.slice();
  let liste = s.listeFehlt ? null : lies(LISTE, []);
  if (zuSenden.length) {
    await senden(ks.uid, s.sockel.n, zuSenden);
    const ids = new Set(zuSenden.map(e => e.i));
    s.ausgang = s.ausgang.filter(e => !ids.has(e.i));
    if (liste) { liste.push(...zuSenden); listeSchreiben(s, liste); if (s.listeFehlt) liste = null; }
    sichern();
  }
  // Ohne Liste lässt sich Bekanntes nicht erkennen, dann gilt der Zeiger genau
  const geholt = await eintraegeHolen(s.sockel.n, liste ? Math.max(0, s.cursor - FENSTER) : s.cursor);
  let neu = 0;
  if (geholt.length) {
    const bekannt = new Set((liste || []).map(e => e.i)), fremd = [];
    for (const x of geholt) if (gueltig(x.daten) && !bekannt.has(x.daten.i)) { fremd.push(x.daten); bekannt.add(x.daten.i); }
    s.cursor = Math.max(s.cursor, geholt[geholt.length - 1].seq);
    if (fremd.length) {
      neu = fremd.length; s.offen = (s.offen || 0) + neu;
      if (liste) { liste.push(...fremd); listeSchreiben(s, liste); }
    }
    sichern();
  }
  s.letzter = Date.now(); sichern();
  if ((s.offen > 0 || s.neuAufbau) && darf()) { const r = await aufbauen('ok'); return { ...r, neu: neu || s.offen }; }
  return { art: 'ok', neu, wartet: s.offen > 0 || !!s.neuAufbau };
}
async function konfliktOderWahl(ks, sp, wahl, darf) {
  sp = sp.stand ? sp : await serverProfil(true);
  if (wahl === 'server') return vomServer(ks, sp, { darf });
  if (wahl === 'lokal') return hochladen(ks, sp, { ausdruecklich: true });
  return konfliktErgebnis(sp);
}

// ---------- Hauptweg ----------
// abgleichen({ wahl, darfAufbauen, neuAufbauen, still })
//   wahl: 'server' | 'lokal', die Antwort auf ein Ergebnis 'konflikt'
//   darfAufbauen: Funktion, die im Augenblick des Einbaus gefragt wird (nach den Netzaufrufen). Liefert sie false, wird am
//     Profil nichts getauscht, sondern vorgemerkt (Ergebnis mit wartet: true, bei einem neuen Stand des Kontos art: 'wartet').
//   neuAufbauen: älterer Schalter mit derselben Bedeutung als fester Wert (gilt, wenn darfAufbauen fehlt). Vorgabe: erlaubt.
//   still: selbsttätiger Lauf. Nach einem Fehler des Servers wartet er (erst 1 Minute, dann länger), statt sofort wieder anzufragen.
// Ergebnis: { art: 'ok' | 'umzug' | 'ersetzt' | 'uebernommen' | 'wartet' | 'konflikt' | 'kein_profil' | 'abgemeldet' | 'offline' | 'fehler', … }
let laeuft = null;
export function abgleichen(opt = {}) {
  if (laeuft) return opt.wahl ? laeuft.then(() => abgleichen(opt)) : laeuft;   // eine ausdrückliche Wahl geht nie in einem fremden Lauf unter
  return laeuft = durchlauf(opt).then(r => { lageMerken(r); return r; }).finally(() => { laeuft = null; });
}
function lageMerken(r) {
  if (r.pause || r.art === 'offline') return;
  if (r.art !== 'konflikt' && r.art !== 'fehler') return weg(LAGE);
  const uid = K.sitzung()?.uid, alt = lies(LAGE), weiter = alt && alt.uid === uid && alt.art === r.art;
  const n = (weiter ? alt.n : 0) + 1;
  schreib(LAGE, { uid, art: r.art, text: r.text || '', n, seit: weiter ? alt.seit : Date.now(), bis: r.art === 'fehler' ? Date.now() + Math.min(36e5, 6e4 * 2 ** (n - 1)) : 0 });
}
async function durchlauf({ wahl, neuAufbauen = true, darfAufbauen, still = false } = {}) {
  const ks = K.sitzung();
  if (!ks) return { art: 'abgemeldet' };
  const darf = typeof darfAufbauen === 'function' ? () => { try { return !!darfAufbauen(); } catch (e) { return false; } } : () => !!neuAufbauen;
  if (still) { const l = lies(LAGE); if (l && l.uid === ks.uid && l.art === 'fehler' && l.bis > Date.now()) return { art: 'fehler', text: l.text, pause: true }; }
  try {
    let s = zustand();
    if (s && s.uid !== ks.uid) { lokalLoeschen(); s = null; }       // anderes Konto auf diesem Gerät
    let sp = await serverProfil(!s);
    // Ein Upload, dessen Antwort verloren ging: liegt genau dieser Sockel auf dem Konto, ist er angekommen
    const v = lies(VERSUCH);
    if (v) {
      if (v.uid === ks.uid && sp && Z.P && gleich(meta(sp), v.sockel) && gleich(Z.P.sockel, v.von)) {
        const log = Z.P.log || [], k = v.bis == null ? -1 : log.findIndex(e => e.i === v.bis);
        if (await nachziehen(ks, v.sockel, log.slice(k + 1))) s = zustand();
      }
      weg(VERSUCH);
    }
    if (s && !Z.P) {                                                 // das Profil wurde gelöscht, das Gerät gilt noch als verbunden
      lokalLoeschen(); s = null; schreib(GELOESCHT, ks.uid);
    }
    // Der Sockel dieses Geräts liegt schon auf dem Konto, der Abgleichstand kennt ihn aber nicht (Antwort verloren und App
    // geschlossen, Stand aus einer älteren Fassung, oder ab- und wieder angemeldet): nachziehen statt Konflikt mit sich selbst
    if (Z.P && sp && !(s && gleich(Z.P.sockel, s.sockel)) && gleich(Z.P.sockel, meta(sp)) && await nachziehen(ks, meta(sp), Z.P.log || [])) s = zustand();
    if (!s) {                                                        // dieses Gerät ist noch nicht mit dem Konto verbunden
      if (!Z.P) return sp ? await vomServer(ks, sp, { darf }) : { art: 'kein_profil' };
      if (!sp) return await hochladen(ks, null);
      if (wahl) return await konfliktOderWahl(ks, sp, wahl, darf);
      if (lies(GELOESCHT) === ks.uid) return await konfliktOderWahl(ks, sp);   // nach „Profil löschen“ neu angelegt: nichts ohne Wahl
      if (!ueberblick(Z.P).abschnitte) return await vomServer(ks, sp, { darf });
      return await konfliktOderWahl(ks, sp);
    }
    if (!sp) return await hochladen(ks, null);                       // auf dem Konto liegt nichts mehr: Stand erneut hochladen
    const srv = meta(sp), lokalNeu = !gleich(Z.P.sockel, s.sockel), serverNeu = !gleich(srv, s.sockel);
    if (lokalNeu && wahl) return await konfliktOderWahl(ks, sp, wahl, darf);
    if (lokalNeu && (!serverNeu || Z.sockelNeuer(Z.P.sockel, srv))) return await hochladen(ks, sp);   // eigene neue Generation (Gliederung, Sicherung geladen)
    if (lokalNeu) return await konfliktOderWahl(ks, sp);
    if (serverNeu) return await vomServer(ks, sp, { mitnehmen: true, darf });
    return await normal(ks, darf);
  } catch (e) {
    if (e instanceof K.AbgemeldetFehler) return { art: 'abgemeldet' };
    if (e instanceof K.NetzFehler) return { art: 'offline' };
    if (e instanceof StandFehler) return { art: 'fehler', text: 'stand-ungueltig', grund: 'stand' };
    return { art: 'fehler', text: String(e?.message || e) };
  }
}

// ---------- Für die Oberfläche ----------
// zustand: 'abgemeldet' | 'konflikt' (eine Entscheidung steht aus) | 'fehler' (der Abgleich stockt) | 'unverbunden' | 'wartet' | 'verbunden'
// verbunden ist nur wahr, wenn der Abgleich wirklich läuft: bei Konflikt oder wiederholtem Fehler nicht (verknuepft sagt dann, dass das Gerät am Konto hängt).
export function status() {
  const k = K.sitzung(), s = zustand(), l = k ? lies(LAGE) : null, lage = l && l.uid === k.uid ? l : null;
  const verknuepft = !!(k && s && s.uid === k.uid);
  const konflikt = lage?.art === 'konflikt', fehler = lage?.art === 'fehler' ? (lage.text || 'fehler') : '';
  const stockt = konflikt || (!!fehler && lage.n >= 2);
  const wartet = !!(s && (s.offen > 0 || s.neuAufbau || s.wartetGen)) || (!!k && wartetLos);
  const ab = K.uhrAbweichung();
  return {
    angemeldet: !!k, email: k?.email || '', verknuepft, verbunden: verknuepft && !stockt,
    konflikt, fehler, fehlerFolge: fehler ? lage.n : 0, stockt,
    offen: s?.ausgang?.length || 0, wartet, letzter: s?.letzter || 0,
    uhrAbweichung: ab, uhrFalsch: ab != null && Math.abs(ab) > 5 * 60000,     // Geräteuhr weicht mehr als fünf Minuten von der Serveruhr ab
    anmeldeAlter: k ? K.anmeldeAlter() : Infinity,
    zustand: !k ? 'abgemeldet' : konflikt ? 'konflikt' : stockt ? 'fehler' : !verknuepft ? 'unverbunden' : wartet ? 'wartet' : 'verbunden'
  };
}
export { NetzFehler, ServerFehler, codeFehlerArt } from './konto.js';
export const codeSenden = K.codeSenden;
export const codePruefen = K.codePruefen;
// Abmelden: vorher einmal senden, was noch im Ausgang liegt (höchstens fünf Sekunden). Auf dem Gerät gilt die Abmeldung immer,
// auch wenn der Server nicht erreichbar ist oder ablehnt. Liefert true, wenn auch der Server die Sitzung beendet hat.
export async function abmelden() {
  if (K.sitzung() && zustand()?.ausgang?.length) {
    try { await Promise.race([abgleichen({ darfAufbauen: () => false }), new Promise(r => { const t = setTimeout(r, 5000); t.unref?.(); })]); } catch (e) {}
  }
  try { return await K.abmelden(); } finally { lokalLoeschen(); }
}
// hoechstAlter (ms): nur löschen, wenn die Anmeldung per Code höchstens so alt ist, sonst AnmeldungAltFehler (die Oberfläche bittet dann um einen neuen Code)
export async function kontoLoeschen({ hoechstAlter = 0 } = {}) {
  if (hoechstAlter > 0 && K.anmeldeAlter() > hoechstAlter) throw new AnmeldungAltFehler('anmeldung-alt');
  await K.kontoLoeschen();
  try { await K.abmelden(); } finally { lokalLoeschen(); }
}
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
