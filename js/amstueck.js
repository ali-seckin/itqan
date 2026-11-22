// Itqān · Am Stück üben (Reiter Üben) und die gemeinsame Mikrofon-Verwaltung aller Übungen
//
// Am Stück üben: Man wählt eine Stelle und deckt dann Āya für Āya auf und bewertet, so lange man möchte, ohne die Übung zu verlassen.
// Am Rand eines Abschnitts wird dieser im Hintergrund abgeschlossen und gespeichert (wie beim freien Üben, Quelle 'frei'),
// die Ansicht blättert zum nächsten Abschnitt weiter. Jede Bewertung steht sofort im Zwischenstand des Abschnitts: Beenden, Zurück-Taste,
// Verlassen der Seite oder ein Absturz verlieren nichts, und über „Dort weitermachen“ geht es an derselben Stelle weiter.
//
// Aufbau: Sitzung (reine Logik, ohne Oberfläche, mit Tests) · wahl (Startseite mit der Stellenwahl) · lauf (die laufende Übung).
// Was app.js beisteuert (Hilfsfunktionen der Oberfläche), kommt als Objekt h herein.
//
// Zweiter Teil der Datei: mikroKoordinator. Er regelt, dass immer nur eine Übung das Mikrofon anfordert (siehe dort).
import { D, bereichText, abschnittName, esc, zahl, ayaWoerter } from './daten.js';
import * as Z from './zustand.js';
import { seiteHTML, schriftenLaden, schrift, zeilenEinpassen, seitenText } from './mushaf.js';
import { textLaden } from './suche.js';
import { tx } from './sprache.js';

const QUELLE = 'frei';
const ERGEBNISSE = ['ok', 'zoegern', 'fehler'];   // was man hier bewertet
const BEKANNT = ['ok', 'hilfe', 'zoegern', 'fehler'];   // was ein Zwischenstand der gewöhnlichen Übung enthalten darf
const STELLE_KEY = 'itqan-amstueck';
export const naechsterAbschnitt = id => D.A[id + 1] ? id + 1 : null;

// Wo es zuletzt aufgehört hat (nur ein Merkzettel für „Dort weitermachen“; die Bewertungen selbst liegen im Zwischenstand und im Verlauf)
export function stelleMerken(id) { try { localStorage.setItem(STELLE_KEY, JSON.stringify({ id, d: Z.heute() })); } catch (e) { /* ohne Speicher gibt es nur keinen Merkzettel */ } }
export function stelleLesen() {
  try { const s = JSON.parse(localStorage.getItem(STELLE_KEY) || 'null'); return s && Number.isInteger(s.id) && D.A[s.id] ? s.id : null; } catch (e) { return null; }
}

// ---------- Sitzung: der Zustand einer Übung am Stück, ohne Oberfläche ----------
export class Sitzung {
  // startId: Abschnitt, mit dem es losgeht. weiter: den Zwischenstand dieses Abschnitts von heute übernehmen (sonst von vorn).
  constructor(startId, { Z: zm = Z, jetzt = Date.now, weiter = false } = {}) {
    this.Z = zm; this.jetzt = jetzt;
    this.stand = { aufgedeckt: 0, richtig: 0, zoegern: 0, fehler: 0, abschnitte: 0, punkte: 0, hasanat: 0 };
    this.fertig = [];   // abgeschlossene Abschnitte dieser Sitzung: { id, res }
    this.beendet = false; this.fehler = null; this.quranEnde = false;
    this.betreten(startId, weiter);
  }
  // In einen Abschnitt eintreten (am Anfang und nach jedem Abschluss). Einen Zwischenstand von heute übernimmt es nur auf Wunsch,
  // beim Weiterblättern immer: Was jemand schon bewertet hat, wird nie überschrieben.
  betreten(id, weiter) {
    this.id = id; this.e = D.A[id]; this.pos = 0; this.erg = []; this.offen = false; this.zeitGanz = true;
    this.aktivMs = 0; this.seit = this.jetzt();
    const zw = weiter ? this.Z.zwischenstandLaden(id, QUELLE) : null;
    if (zw && Array.isArray(zw.erg) && zw.erg.length < this.e.ayat && zw.erg.every(x => BEKANNT.includes(x))) { this.erg = [...zw.erg]; this.pos = this.erg.length; this.zeitGanz = false; }   // fortgesetzte Übungen werden nicht gemessen
    stelleMerken(id);
  }
  get vi() { return this.e.v[0] + this.pos; }   // die Āya, die jetzt dran ist
  zaehlen(x, d) { const k = x === 'ok' ? 'richtig' : x === 'fehler' ? 'fehler' : 'zoegern'; this.stand[k] += d; }
  // Übungszeit: zählt nur, solange die Seite sichtbar ist (wie in der gewöhnlichen Übung)
  sichtbarkeit(versteckt) {
    if (versteckt) { if (this.seit != null) { this.aktivMs += this.jetzt() - this.seit; this.seit = null; } }
    else if (this.seit == null) this.seit = this.jetzt();
  }
  sekunden() { return Math.min(3600, (this.aktivMs + (this.seit != null ? this.jetzt() - this.seit : 0)) / 1000); }
  // Die nächste Āya aufdecken; liefert ihren Index oder null, wenn nichts aufzudecken ist
  aufdecken() {
    if (this.beendet || this.offen || this.pos >= this.e.ayat) return null;
    this.offen = true; this.stand.aufgedeckt++;
    return this.vi;
  }
  // Die aufgedeckte Āya bewerten ('ok', 'zoegern', 'fehler'). Liefert, was geschehen ist:
  //   { art: 'aya' }                          nächste Āya im selben Abschnitt
  //   { art: 'abschnitt', id, res, naechster } Abschnitt abgeschlossen und gespeichert, die Sitzung steht im nächsten
  //   { art: 'ende', id, res }                 der letzte Abschnitt des Qurʾān ist abgeschlossen
  //   { art: 'fehler', fehler }                der Abschluss ließ sich nicht buchen; die Bewertungen bleiben im Zwischenstand
  bewerten(x) {
    if (this.beendet || !this.offen || !ERGEBNISSE.includes(x)) return null;
    const vi = this.vi;
    this.erg.push(x); this.zaehlen(x, 1); this.pos++; this.offen = false;
    this.speichern();   // jede Bewertung steht sofort im Zwischenstand
    if (this.pos < this.e.ayat) return { art: 'aya', vi };
    return this.abschliessen(vi);
  }
  abschliessen(vi) {
    const id = this.id;
    let res;
    try { res = this.Z.abschnittAbschliessen(id, this.erg, QUELLE, this.zeitGanz ? this.sekunden() : 0); }
    catch (fehler) { this.beendet = true; this.fehler = fehler; return { art: 'fehler', vi, id, fehler }; }
    this.Z.zwischenstandLoeschen(id, QUELLE);
    this.stand.abschnitte++; this.stand.punkte += res.punkte; this.stand.hasanat += res.hasanat;
    this.fertig.push({ id, res });
    const nach = naechsterAbschnitt(id);
    if (nach == null) { this.beendet = true; this.quranEnde = true; return { art: 'ende', vi, id, res }; }
    this.betreten(nach, true);
    return { art: 'abschnitt', vi, id, res, naechster: nach, fortgesetzt: this.pos };
  }
  // Die zuletzt bewertete Āya noch einmal bewerten (nur innerhalb des Abschnitts: ein abgeschlossener ist schon gebucht)
  zuruecknehmen() {
    if (this.beendet || this.offen || this.pos === 0) return null;
    this.zaehlen(this.erg.pop(), -1); this.pos--; this.offen = true;
    this.speichern(true);
    return this.vi;
  }
  // Zwischenstand des laufenden Abschnitts sichern. Ohne Bewertungen bleibt ein vorhandener Zwischenstand, wie er ist (leer: nur auf Wunsch löschen).
  speichern(leerLoeschen = false) {
    if (this.erg.length) return this.Z.zwischenstandSpeichern(this.id, QUELLE, [...this.erg]);
    if (leerLoeschen) this.Z.zwischenstandLoeschen(this.id, QUELLE);
    return true;
  }
  beenden() {
    if (!this.beendet) { this.beendet = true; this.speichern(); }
    stelleMerken(this.id);
    return this.zusammenfassung();
  }
  zusammenfassung() {
    const n = this.e.ayat, teil = !this.fehler && this.erg.length > 0 && this.erg.length < n;
    return { ...this.stand, geuebt: this.stand.richtig + this.stand.zoegern + this.stand.fehler, fertig: this.fertig, stelle: this.id,
      offen: teil ? { id: this.id, a: this.erg.length + 1, n } : null, quranEnde: this.quranEnde, fehler: this.fehler };
  }
}

// ---------- Mikrofon: eine Anlaufstelle für alle Übungen ----------
// Wer das Mikrofon will, fragt hier an. Das Gerät sieht dann nie zwei Anfragen zugleich und nie ein Freigeben und Anfordern
// im selben Augenblick. Das waren die Ursachen für den hängenden Aufnahmeknopf, wenn man gleich nach einer Übung die nächste beginnt:
//  1. Die Übung davor hatte ihre Anfrage noch offen (etwa eine unbeantwortete Berechtigungsabfrage), die neue stellte eine zweite daneben.
//     Beide warteten dann aufeinander, und die neue Aufnahme kam nie zustande. Jetzt wartet die neue auf die offene und stellt keine zweite.
//  2. Der Strom der alten Übung wurde im selben Augenblick freigegeben, in dem die neue ihn anforderte. Manche Geräte
//     (iPhone, manche Androids) liefern dann einen stummen Strom oder den Fehler NotReadableError. Jetzt gibt es eine Ruhezeit und einen zweiten Versuch.
//  3. Antwortete das Gerät nie, blieb die Übung für immer im Zustand „startet gerade“ und der Knopf tot. Jetzt gibt es eine Frist.
// Wer abbricht (Übung verlassen, Aufnahme verworfen), bekommt einen Strom, der später doch noch kommt, nie in die Hand: Er wird gleich beendet.
const FLUECHTIG = new Set(['NotReadableError', 'AbortError', 'TrackStartError']);
export function mikroKoordinator({ gum, warte = ms => new Promise(r => setTimeout(r, ms)), jetzt = Date.now, ruhe = 350, frist = 12000, nochmal = 400 } = {}) {
  let aktiv = null, laufend = null, nr = 0, zuletzt = -Infinity;
  const stopp = s => { try { s?.getTracks().forEach(t => { try { t.stop(); } catch (e) { /* schon beendet */ } }); } catch (e) { /* kein Strom */ } };
  const abbruch = () => Object.assign(new Error('abgebrochen'), { name: 'Abgebrochen' });
  const freigeben = () => { if (aktiv) { stopp(aktiv.stream); aktiv = null; zuletzt = jetzt(); } };
  // Eine Anfrage ans Gerät. Kommt die Antwort erst nach der Frist, wird der späte Strom sofort beendet.
  function geraet() {
    const a = { fertig: false, verworfen: false };
    const p = Promise.resolve().then(gum);
    let still; still = p.then(() => {}, () => {}).then(() => { if (laufend === still) laufend = null; });
    laufend = still;
    p.then(s => { a.fertig = true; if (a.verworfen) { stopp(s); zuletzt = jetzt(); } }, () => { a.fertig = true; });
    const uhr = new Promise((_, nein) => warte(frist).then(() => {
      if (a.fertig) return;
      a.verworfen = true; if (laufend === still) laufend = null;   // auf diese Anfrage wartet niemand mehr
      nein(Object.assign(new Error('mikro-frist'), { name: 'TimeoutError' }));
    }));
    return Promise.race([p, uhr]);
  }
  async function holen(wer) {
    const mein = wer.nr = ++nr;
    const gilt = () => wer.nr === mein && !wer.zu;
    freigeben();   // ein Strom einer früheren Aufnahme oder Übung wird nicht mitgenommen
    if (laufend) { await Promise.race([laufend, warte(frist)]); await warte(0); }   // eine ältere Anfrage ist noch offen: abwarten, keine zweite daneben stellen
    if (!gilt()) throw abbruch();
    const rest = ruhe - (jetzt() - zuletzt);
    if (rest > 0) await warte(rest);   // dem Gerät Zeit lassen, das eben freigegebene Mikrofon wirklich loszulassen
    if (!gilt()) throw abbruch();
    let s;
    try { s = await geraet(); }
    catch (e) {
      if (!gilt()) throw abbruch();
      if (!FLUECHTIG.has(e?.name)) throw e;
      await warte(nochmal);   // Mikrofon noch nicht wieder frei: ein zweiter Versuch
      if (!gilt()) throw abbruch();
      s = await geraet();
    }
    if (!gilt()) { stopp(s); zuletzt = jetzt(); throw abbruch(); }
    aktiv = { stream: s, wer };
    return s;
  }
  // Aufnahme verworfen oder beendet: der Strom des Besitzers wird freigegeben, eine offene Anfrage von ihm gilt nicht mehr
  function abgeben(wer) { wer.nr = ++nr; if (aktiv?.wer === wer) freigeben(); }
  return {
    holen, abgeben,
    besitzer: () => ({ nr: 0, zu: false }),
    // Übung verlassen: wie abgeben, und der Besitzer fragt nie wieder an
    beenden(wer) { wer.zu = true; abgeben(wer); },
    // Beim Beginn einer Übung: nichts, was eine frühere offen gelassen hat, bleibt am Mikrofon
    alleFrei: freigeben,
    laeuft: () => !!aktiv,
  };
}
// Die eine gemeinsame Verwaltung der App (getUserMedia wird erst bei der ersten Anfrage berührt)
export const Mikro = mikroKoordinator({ gum: () => navigator.mediaDevices.getUserMedia({ audio: true }) });

// ---------- Oberfläche ----------
export const ZEICHEN = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15c2.4 0 3-6 6-6s3.6 6 6 6 3.2-3.2 5.5-6"/><path d="M17.5 6.5h3.5v3.5"/></svg>';
const warteMs = ms => new Promise(r => setTimeout(r, ms));
const nameVon = e => abschnittName(e);

// Startseite: Stelle wählen. Wer schon einmal am Stück geübt hat, findet oben „Dort weitermachen“.
export function wahl(h) {
  h.navSetzen('uebungen');
  const app = h.app, id = stelleLesen(), e = id != null ? D.A[id] : null;
  const zw = e ? Z.zwischenstandLaden(id, QUELLE) : null, stand = zw?.erg?.length && zw.erg.length < e.ayat ? zw.erg.length : 0;
  const weiter = e ? `<a class="karte uebung-reihe as-weiter" href="#ueben/amstueck/${id}/weiter"><span class="uebung-zeichen klein">${ZEICHEN}</span><div class="t"><b>${tx('amstueck.weiter_titel')}</b><span>${stand ? tx('amstueck.weiter_stand', { name: nameVon(e), a: stand + 1, n: e.ayat }) : esc(nameVon(e))}</span></div><span class="pfeil" aria-hidden="true">›</span></a>` : '';
  app.innerHTML = `<button class="zurueck" data-ziel="#uebungen">${h.zurueckPfeil}${tx('allg.ueben')}</button>
    <div class="marke mit-zeichen as-marke"><span class="marke-zeichen" aria-hidden="true">${ZEICHEN}</span><div class="marke-text">${tx('amstueck.titel')}<small>${tx('amstueck.untertitel')}</small></div></div>
    ${weiter}<p class="as-text">${tx('amstueck.wahl_text')}</p>
    ${h.stellenWahl(0)}
    <button class="knopf haupt as-los" id="as-los" disabled>${tx('amstueck.start')}</button>`;
  const ss = app.querySelector('#wahl-sure'), sa = app.querySelector('#wahl-abschnitt'), los = app.querySelector('#as-los');
  ss.onchange = () => { sa.innerHTML = h.abschnittOptionen(+ss.value); sa.disabled = !ss.value; los.disabled = true; if (ss.value) sa.focus(); };
  sa.onchange = () => { los.disabled = sa.value === '' || !D.A[+sa.value]; };
  los.onclick = () => { if (sa.value !== '' && D.A[+sa.value]) location.hash = `#ueben/amstueck/${sa.value}`; };
  window.scrollTo(0, 0);
}

// Die laufende Übung. modus 'weiter': einen Zwischenstand ohne Rückfrage übernehmen (Knopf „Dort weitermachen“).
export async function lauf(h, idText, modus) {
  const nr = h.zeigeNr(), app = h.app;
  h.navSetzen(null);
  const id = +idText;
  if (!Number.isInteger(id) || !D.A[id]) { location.replace('#amstueck'); return; }
  app.innerHTML = `<div class="lade">${tx('ueben.seiten_werden_geladen')}</div>`;
  let weiter = false;
  const zw = Z.zwischenstandLaden(id, QUELLE), n0 = D.A[id].ayat;
  if (zw && Array.isArray(zw.erg) && zw.erg.every(x => BEKANNT.includes(x))) {
    // Alles schon bewertet, aber nie abgeschlossen (der Abschluss war gescheitert): das holt die gewöhnliche Übung nach
    if (zw.erg.length >= n0) { location.replace(`#ueben/${id}/${QUELLE}`); return; }
    if (zw.erg.length > 0) {
      if (modus === 'weiter') weiter = true;
      else {
        const ja = await h.dialog({ titel: tx('ueben.weitermachen'), html: `<p>${tx('ueben.du_hast_diesen_abschnitt_heute_schon', { n: zw.erg.length, n2: n0 })}</p>`, ja: tx('ueben.bei_aya_weiter', { a: zw.erg.length + 1 }), nein: tx('ueben.neu_beginnen') });
        if (ja === null || !h.ansichtGilt(nr)) return;   // Ansicht gewechselt: der Zwischenstand bleibt
        weiter = !!ja; if (!ja) Z.zwischenstandLoeschen(id, QUELLE);
      }
    }
  }
  if (!h.ansichtGilt(nr)) return;
  const sitz = new Sitzung(id, { weiter });
  let aktiv = true, beschaeftigt = false, dop = h.doppelseitig();
  const E = Z.P.einst;

  app.innerHTML = `<div class="ueb-kopf as-kopf"><button class="zurueck" id="as-zurueck" aria-label="${tx('allg.zurueck')}">${h.zurueckPfeil}</button><div class="info" id="as-info"></div>
      <button type="button" class="knopf leise klein as-ende" id="as-ende">${tx('amstueck.beenden')}</button></div>
    <div class="seiten roller" id="seiten"></div><div class="nur-leser" id="ansage" aria-live="polite" lang="ar" dir="rtl"></div><div class="ab-platz"></div>
    <div class="steuerung as-steuerung"><div class="innen"><div class="fort-zeile"><div class="punkte" id="punkte"></div><span class="zaehler" id="zaehler"></span><div class="as-stand" id="as-stand"></div></div>
    <div class="reihe" id="knoepfe"></div><div class="zeile2"><span class="unter" id="hinweis"></span></div></div></div>`;
  const seitenEl = app.querySelector('#seiten'), K = app.querySelector('#knoepfe'), H = app.querySelector('#hinweis'), ansage = app.querySelector('#ansage');
  const spans = vi => [...seitenEl.querySelectorAll(`.w[data-v="${vi}"]`)];
  let zu = new Set();
  h.wachHalten(true);

  // Seiten des laufenden Abschnitts aufbauen (am Anfang, nach jedem Abschnittswechsel und beim Drehen des Geräts)
  async function aufbauen(blaettern) {
    const e = sitz.e, vorVi = e.v[0] - 1, kontext = vorVi >= 0 && e.von[1] > 1;   // die Āya davor bleibt zur Orientierung sichtbar
    const kW = kontext ? ayaWoerter(vorVi) : [], davor = kontext ? [...new Set(kW.map(x => x[5]))].filter(p => !e.seiten.includes(p)).sort((a, b) => a - b) : [];
    const zeigeS = [...davor, ...e.seiten];
    dop = h.doppelseitig();
    const gezeigt = dop ? h.doppelseiten(zeigeS) : zeigeS.map(x => [x]);
    await Promise.all([schriftenLaden(gezeigt.flat()), ...kW.map(x => schrift(x[4]))]);
    if (!aktiv || !h.ansichtGilt(nr)) return false;
    zu = new Set(); for (let i = sitz.pos; i < e.ayat; i++) zu.add(e.v[0] + i);
    const status = new Map(sitz.erg.map((x, i) => [e.v[0] + i, x]));
    const opt = { von: e.v[0], bis: e.v[1], zu, alt: new Set(Z.karte(sitz.id).fa || []), status, klar: kontext ? new Set([vorVi]) : undefined, fst: Z.fehlerstellenSet(), wahl: true };
    document.body.classList.toggle('doppelt', dop); seitenEl.classList.toggle('doppel', dop);
    seitenEl.innerHTML = dop ? gezeigt.map(g => h.paarHTML(g, opt)).join('') : zeigeS.map(p => seiteHTML(p, opt)).join('');
    seitenEl.classList.remove('as-blatt'); if (blaettern && !h.ruhig()) { void seitenEl.offsetWidth; seitenEl.classList.add('as-blatt'); }
    zeilenEinpassen(seitenEl);
    app.querySelector('#as-info').innerHTML = `${bereichText(e)}${e.nr ? ` · <span class="ab-nr" role="img" aria-label="${tx('allg.abschnitt')} ${e.nr}">${e.nr}</span>` : ''} · ${esc(e.titel)}`;
    try { history.replaceState(null, '', `#ueben/amstueck/${sitz.id}`); } catch (x) { /* dann bleibt die alte Adresse stehen */ }
    const nx = naechsterAbschnitt(sitz.id); if (nx != null) schriftenLaden(D.A[nx].seiten).catch(() => {});   // das Weiterblättern soll nicht warten
    return true;
  }
  function sichtbar(el) {
    if (!el) return; h.seiteHolen(seitenEl, el); const r = el.getBoundingClientRect();
    if (r.top < 70 || r.bottom > innerHeight - 230) { el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: h.ruhig() ? 'auto' : 'smooth' }); return; }
    if (seitenEl.scrollWidth > seitenEl.clientWidth + 1) {   // vergrößerte Seite: das Wort liegt seitlich außerhalb
      const sr = seitenEl.getBoundingClientRect(), dx = r.left < sr.left + 8 ? r.left - sr.left - 24 : r.right > sr.right - 8 ? r.right - sr.right + 24 : 0;
      if (dx) seitenEl.scrollBy({ left: dx, behavior: h.ruhig() ? 'auto' : 'smooth' });
    }
  }
  const ansagen = vi => textLaden().then(T => { if (ansage.isConnected) ansage.textContent = `${D.V[vi][0]}:${D.V[vi][1]} ${T.u[vi].join(' ')}`; }).catch(() => {});

  // Anzeige: Punkte des Abschnitts, ruhiger Zähler der ganzen Sitzung, Knöpfe
  function zeichne() {
    const e = sitz.e, n = e.ayat, st = sitz.stand;
    app.querySelector('#punkte').innerHTML = sitz.erg.map(x => `<i class="${x}"></i>`).join('') + (sitz.pos < n ? '<i class="jetzt"></i>' : '') + '<i></i>'.repeat(Math.max(0, n - sitz.pos - 1));
    app.querySelector('#zaehler').textContent = tx('ueben.aya_von', { a: Math.min(sitz.pos + 1, n), n });
    app.querySelector('#as-stand').innerHTML = `<span class="as-z auf">${tx('amstueck.zaehl_aufgedeckt', { n: zahl(st.aufgedeckt) })}</span><span class="as-z ok">${tx('amstueck.zaehl_richtig', { n: zahl(st.richtig) })}</span>${st.zoegern ? `<span class="as-z zg">${tx('amstueck.zaehl_zoegern', { n: zahl(st.zoegern) })}</span>` : ''}<span class="as-z fe">${tx('amstueck.zaehl_fehler', { n: zahl(st.fehler) })}</span>`;
    seitenEl.querySelectorAll('.naechste').forEach(x => x.classList.remove('naechste'));
    const vi = sitz.vi;
    if (!sitz.offen) {
      spans(vi).forEach(x => x.classList.add('naechste'));
      K.innerHTML = `<button class="knopf haupt" id="auf">${tx('ueben.aya_aufdecken', { a: D.V[vi][1] })}</button>`;
      H.innerHTML = tx('ueben.rezitiere_aus_dem_gedaechtnis') + (sitz.pos > 0 ? `<br><button type="button" class="textlink mini" id="neu-bewerten">${tx('ueben.vorige_aya_neu_bewerten')}</button>` : '');
      app.querySelector('#auf').onclick = aufdecken;
      const nb = app.querySelector('#neu-bewerten'); if (nb) nb.onclick = zuruecknehmen;
    } else {
      K.innerHTML = `<button class="knopf schlecht" id="f">${tx('allg.fehler')}</button><button class="knopf leise" id="z">${tx('ueben.gezoegert')}</button><button class="knopf gut" id="r">${tx('ueben.richtig')}</button>`;
      H.textContent = tx('ueben.warst_du_sicher_und_fehlerfrei');
      if (h.uebersetzungSprache()) { const ub = document.createElement('button'); ub.type = 'button'; ub.className = 'textlink mini'; ub.textContent = tx('uebers.link'); H.append(document.createElement('br'), ub); ub.onclick = () => h.uebersetzungZeigen(vi); }
      app.querySelector('#r').onclick = () => bewerten('ok');
      app.querySelector('#f').onclick = () => bewerten('fehler');
      app.querySelector('#z').onclick = () => bewerten('zoegern');
    }
    seitenText(seitenEl, zu);
  }
  function aufdecken() {
    if (beschaeftigt) return;
    const vi = sitz.aufdecken(); if (vi == null) return;
    zu.delete(vi); spans(vi).forEach(x => x.classList.remove('zu', 'naechste', 'erstes'));
    zeichne(); ansagen(vi);
  }
  async function bewerten(x) {
    if (beschaeftigt || !sitz.offen) return;
    const vi = sitz.vi, sp = spans(vi);
    const ev = sitz.bewerten(x); if (!ev) return;
    sp.forEach(s => { s.classList.remove('alt', 'ok', 'hilfe', 'fehler', 'zoegern'); s.classList.add(x); });
    if (x !== 'fehler') h.punktePop(x === 'ok' ? '+10' : '+5', sp[sp.length - 1]);
    h.blaseSchliessen();
    if (ev.art === 'aya') { zeichne(); sichtbar(spans(sitz.vi)[0]); return; }
    if (ev.art === 'fehler') return beenden();   // die Zusammenfassung nennt den Grund, die Bewertungen bleiben im Zwischenstand
    // Abschnittsgrenze: der Abschnitt ist gespeichert; die letzte Bewertung bleibt kurz sichtbar, dann blättert die Ansicht weiter
    beschaeftigt = true;
    if (!h.ruhig()) await warteMs(380);
    if (!aktiv) return;
    if (ev.art === 'ende') { beschaeftigt = false; return beenden(); }
    h.toast(tx('amstueck.abschnitt_gespeichert', { name: nameVon(D.A[ev.id]) }), 2200);
    const ok = await aufbauen(true);
    beschaeftigt = false;
    if (!ok) return;
    zeichne(); sichtbar(spans(sitz.vi)[0]);
  }
  function zuruecknehmen() {
    if (beschaeftigt) return;
    const vi = sitz.zuruecknehmen(); if (vi == null) return;
    zu.delete(vi);
    spans(vi).forEach(s => { s.classList.remove('ok', 'hilfe', 'fehler', 'zoegern'); s.classList.remove('zu', 'naechste'); });
    zeichne(); sichtbar(spans(vi)[0]);
  }

  // Beenden: Stand sichern, Zusammenfassung zeigen
  function aufhoeren() {
    aktiv = false;
    document.removeEventListener('visibilitychange', sicht); removeEventListener('pagehide', sichern);
    removeEventListener('keydown', tasten); removeEventListener('resize', drehen); clearTimeout(drehWarte);
  }
  function beenden() {
    if (!aktiv) return;
    const z = sitz.beenden(); aufhoeren(); h.wachHalten(false);
    zusammenfassung(z);
  }
  function zusammenfassung(z) {
    document.querySelector('.steuerung')?.remove();
    const evs = z.fertig.flatMap(f => f.res.ereignisse || []), wird = evs.some(x => x.typ === 'wird');
    const hasanat = E.hasanat !== false && z.hasanat > 0;
    if (wird) h.ereignisseSetzen(evs.filter(x => x.typ !== 'ornament' && x.typ !== 'rang'));
    const baender = evs.filter(x => x.typ === 'ornament').map(h.ornBand).join('') + evs.filter(x => x.typ === 'rang').map(x => h.rangBand(x.r)).join('');
    const satz = z.fehler ? tx('ueben.abschluss_fehler') : z.quranEnde ? tx('amstueck.qur_ende') : z.geuebt ? '' : tx('amstueck.ende_leer');
    const kann = !z.quranEnde && !z.fehler;
    app.innerHTML = `<div class="feier as-feier">${h.qandil()}<h2>${tx('amstueck.ende_titel')}</h2>${satz ? `<p>${satz}</p>` : ''}
      <div class="ernte"><div><b data-hoch="${z.geuebt}">${zahl(z.geuebt)}</b><span>${tx('amstueck.ende_ayat')}</span></div><div><b data-hoch="${z.abschnitte}">${zahl(z.abschnitte)}</b><span>${tx('allg.abschnitte')}</span></div>
        ${z.punkte ? `<div><b data-hoch="${z.punkte}" data-vor="+">+${zahl(z.punkte)}</b><span>${tx('allg.itqan_punkte')}</span></div>` : ''}${hasanat ? `<div><b data-hoch="${z.hasanat}" data-vor="+">+${zahl(z.hasanat)}</b><span>${tx('allg.hasanat')}</span></div>` : ''}</div>
      ${z.geuebt ? `<div class="as-verteilung"><span class="ok"><b>${zahl(z.richtig)}</b> ${tx('ueben.richtig')}</span>${z.zoegern ? `<span class="zg"><b>${zahl(z.zoegern)}</b> ${tx('ueben.gezoegert')}</span>` : ''}<span class="fe"><b>${zahl(z.fehler)}</b> ${tx('allg.fehler')}</span></div>` : ''}
      ${z.offen ? `<div class="hinweisbox">${tx('amstueck.ende_offen', { name: nameVon(D.A[z.offen.id]), a: z.offen.a, n: z.offen.n })}</div>` : ''}${baender}
      <div style="display:grid;gap:10px;margin-top:16px">${wird ? `<button class="knopf haupt" id="as-wird">${tx('allg.weiter')}</button>` : kann ? `<button class="knopf haupt" id="as-weiter">${tx('amstueck.ende_weiter')}</button>` : ''}
        <button class="knopf ${wird || !kann ? 'haupt' : 'leise'}" id="as-uebersicht">${tx('ueben.zur_uebersicht')}</button></div></div>`;
    // Die Adresse der Übung verschwindet aus dem Verlauf: Zurück und Neuladen starten sie nicht noch einmal
    try { history.replaceState(null, '', '#uebungen'); } catch (x) { /* ohne Verlauf bleibt es dabei */ }
    const w1 = app.querySelector('#as-wird'); if (w1) w1.onclick = () => location.replace('#fertig');
    const w2 = app.querySelector('#as-weiter'); if (w2) w2.onclick = () => lauf(h, z.stelle, 'weiter');
    app.querySelector('#as-uebersicht').onclick = () => { if (location.hash === '#uebungen') h.zeige(); else location.replace('#uebungen'); };
    window.scrollTo(0, 0); h.hochzaehlen(app);
  }

  // Seite wird verlassen oder in den Hintergrund gelegt: der Stand steht schon im Zwischenstand, hier nur noch die Zeit anhalten
  const sicht = () => { sitz.sichtbarkeit(document.hidden); if (document.hidden) sitz.speichern(); };
  const sichern = () => sitz.speichern();
  let drehWarte = null;
  const drehen = () => {
    if (!seitenEl.isConnected) { removeEventListener('resize', drehen); return; }
    clearTimeout(drehWarte);
    drehWarte = setTimeout(async () => { if (!aktiv || beschaeftigt || h.doppelseitig() === dop) return; beschaeftigt = true; const ok = await aufbauen(false); beschaeftigt = false; if (ok) { zeichne(); sichtbar(spans(sitz.vi)[0]); } }, 160);
  };
  const tasten = ev => {
    if (!aktiv || !document.body.contains(seitenEl)) { removeEventListener('keydown', tasten); return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.repeat) return;
    const bst = h.buchstabe(ev);
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.closest?.('button,a,select,input,summary')) return;
    if (ev.target.closest?.('input,select,textarea') || document.querySelector('.dialog')) return;
    if (!sitz.offen && (ev.key === ' ' || ev.key === 'Enter' || ev.key === 'ArrowDown')) { ev.preventDefault(); aufdecken(); }
    else if (sitz.offen && (bst === 'r' || ev.key === 'ArrowRight')) bewerten('ok');
    else if (sitz.offen && (bst === 'f' || ev.key === 'ArrowLeft')) bewerten('fehler');
    else if (sitz.offen && bst === 'z') bewerten('zoegern');
  };
  document.addEventListener('visibilitychange', sicht); addEventListener('pagehide', sichern);
  addEventListener('keydown', tasten); addEventListener('resize', drehen);
  // Verlassen über Zurück-Taste, Reiter oder Adresse: der Stand ist gesichert, Tasten und Zeitnehmer enden
  h.aufraeumen(() => { if (!aktiv) return; sitz.beenden(); aufhoeren(); });
  app.querySelector('#as-zurueck').onclick = () => history.length > 1 ? history.back() : (location.hash = '#amstueck');
  app.querySelector('#as-ende').onclick = beenden;
  seitenEl.addEventListener('click', ev => {   // die aufgedeckte Āya antippen: Übersetzung; die verdeckte: aufdecken
    const w = ev.target.closest('.w'); if (!w) return;
    if (w.classList.contains('zu')) { if (+w.dataset.v === sitz.vi && !sitz.offen) aufdecken(); return; }
    if (sitz.offen && +w.dataset.v === sitz.vi) h.uebersetzungZeigen(+w.dataset.v);
  });

  const ok = await aufbauen(false);
  if (!ok) return;
  zeichne();
  if (sitz.pos) sichtbar(spans(sitz.vi)[0]);
}
