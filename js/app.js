// Itqān · Oberfläche
import { D, ladeDaten, abschnittName, bereichText, zahl, prozent, esc, sureName, sureArabisch, juzVonSeite, juzStart, ayaWoerter, schriftSeiten } from './daten.js';
import * as Z from './zustand.js';
import * as Lk from './lichtkarte.js';
import { seiteHTML, schriftenLaden, schrift, wortHTML, schriftAbgleichen, zeilenEinpassen, grenzenZeichnen, seitenText, wortText, textFuerLeser } from './mushaf.js';
import { ornamentSVG, groesse, KLASSEN_TEXT, ornamentInfo } from './ornamente.js';
import { VERSION, NEUIGKEITEN, RUECKMELDUNG_AN, UEBERGANG } from './version.js';
import { fuehrung, gesehen as tourGesehen, merken as tourMerken, zuruecksetzen as tourZuruecksetzen } from './fuehrung.js';
import * as S from './suche.js';
import * as NL from './aehnlich.js';
import * as AF from './abfragen.js';
import { wahlZeichnen, ausAbschnitten, ausBereiche, zuBereichen, zuAbschnitten, istAlles, istLeer, seitenZahl, alles } from './auswahl.js';
import * as RB from './rueckblick.js';
import { FRAGEN, GLOSSAR, TASTEN } from './hilfe.js';
import { tx, gebiet, SPRACHEN, spracheMerken, durchlaufSetzen, spracheGewaehlt, geraeteSprache } from './sprache.js';
const komma = () => gebiet('komma') ?? ', ';

const app = document.getElementById('app');
const nav = document.getElementById('nav');
const WT = [tx('wt.mo'), tx('wt.di'), tx('wt.mi'), tx('wt.do'), tx('wt.fr'), tx('wt.sa'), tx('wt.so')];
let letzteEreignisse = [];

// ---------- Erscheinungsbild ----------
const dunkelMQ = matchMedia('(prefers-color-scheme: dark)');
function themaAnwenden() {
  let wahl = Z.P?.einst.thema; if (!wahl) { try { wahl = localStorage.getItem('itqan-thema') || 'auto'; } catch (e) { wahl = 'auto'; } }
  const modus = wahl === 'auto' ? (dunkelMQ.matches ? 'dunkel' : 'hell') : wahl;
  document.documentElement.dataset.modus = modus;
  document.querySelector('meta[name=theme-color]').content = modus === 'dunkel' ? '#0d2230' : '#f3e8d2';
  // Lesbarkeit: Seitengröße (--sm) und Schriftgröße (--tm) aus den Einstellungen; data-gross nur über 100 %
  if (Z.P) {
    const h = document.documentElement, sm = Z.P.einst.seitenGroesse || 100, tm = Z.P.einst.textGroesse || 100;
    h.style.setProperty('--sm', sm / 100); h.style.setProperty('--tm', tm / 100);
    if (sm > 100) h.dataset.gross = '1'; else delete h.dataset.gross;
  }
}
dunkelMQ.addEventListener('change', themaAnwenden);
// Zoomen mit zwei Fingern bleibt erlaubt (Barrierefreiheit); die Seitengröße lässt sich zusätzlich fest einstellen

// ---------- Hilfen ----------
function toast(text, ms = 2600) {
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); t.textContent = text; document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('an')); setTimeout(() => { t.classList.remove('an'); setTimeout(() => t.remove(), 400); }, ms);
}
const ruhig = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// Itqān-Punkte steigen kurz über der bewerteten Āya auf
function punktePop(text, el) {
  const r = el?.getBoundingClientRect(), p = document.createElement('div');
  p.className = 'punkt-pop'; p.textContent = text;
  p.style.left = (r ? Math.min(innerWidth - 36, Math.max(36, r.left + r.width / 2)) : innerWidth / 2) + 'px';
  p.style.top = (r && r.top > 50 && r.top < innerHeight - 200 ? r.top : innerHeight - 230) + 'px';
  document.body.appendChild(p); setTimeout(() => p.remove(), 1500);
}
// Zahlen auf der Abschlussseite zählen kurz hoch
function hochzaehlen(wurzel) {
  for (const b of wurzel.querySelectorAll('[data-hoch]')) {
    const ziel = +b.dataset.hoch, vor = b.dataset.vor || '', t0 = performance.now(), dauer = 900;
    if (ruhig() || !ziel) continue;
    const schritt = t => { const x = Math.min(1, (t - t0) / dauer); b.textContent = vor + zahl(ziel * (1 - Math.pow(1 - x, 3))); if (x < 1 && b.isConnected) requestAnimationFrame(schritt); };
    b.textContent = vor + '0'; requestAnimationFrame(schritt);
    // falls der Browser Animationen anhält (App im Hintergrund): Endwert trotzdem setzen
    setTimeout(() => { if (b.isConnected) b.textContent = vor + zahl(ziel); }, dauer + 200);
  }
}
// Abschluss des Wird: feine Goldfunken, die langsam fallen. Stärke 3 = fehlerfrei, 2 = mit Hilfe, 1 = mit Fehlern (schwächer)
function funkeln(staerke) {
  if (ruhig()) return;
  const n = [0, 9, 20, 34][staerke], f = document.createElement('div');
  f.className = 'funken s' + staerke;
  const FORM = ['stern', 'raute', 'punkt'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i'), gr = (staerke === 1 ? 4 : 5) + Math.random() * (staerke === 1 ? 4 : 8);
    s.className = FORM[i % 3];
    s.style.cssText = `left:${(3 + Math.random() * 94).toFixed(1)}%;width:${gr.toFixed(1)}px;height:${gr.toFixed(1)}px;--dx:${(Math.random() * 60 - 30).toFixed(0)}px;--dr:${(Math.random() * 300 - 150).toFixed(0)}deg;--ziel:${(55 + Math.random() * 40).toFixed(0)}vh;animation-delay:${(Math.random() * (staerke === 1 ? 1.4 : 1.1)).toFixed(2)}s;animation-duration:${((staerke === 1 ? 3.6 : 3) + Math.random() * 1.8).toFixed(2)}s`;
    f.appendChild(s);
  }
  document.body.appendChild(f); setTimeout(() => f.remove(), 7500);
}
function datumText(d = new Date()) {
  const g = d.toLocaleDateString(gebiet('datum'), { weekday: 'long', day: 'numeric', month: 'long' });
  let h = ''; try { h = tx('datumtext.n_h', { a: new Intl.DateTimeFormat(gebiet('hidschri'), { day: 'numeric', month: 'long', year: 'numeric' }).format(d).replace(/\s*(AH|d\. H\.)$/, '') }); } catch (e) {}
  return g + (h ? ' · ' + h : '');
}
const stufePunkte = st => `<div class="stufe" role="img" aria-label="${tx('stufepunkte.stufe', { a: Z.STUFEN[st] })}" title="${Z.STUFEN[st]}">${[1, 2, 3, 4].map(i => `<i class="${st >= i ? 'an' : ''}"></i>`).join('')}</div>`;
// Die Laterne (App-Symbol), freigestellt: hell = Bronze für die Lesestube, dunkel = Gold für Tezhip
// Das Itqān-Zeichen (Nische mit Flamme, nach Sūra an-Nūr 24:35): hell in Bronze, dunkel in Gold, Farben aus --z1/--z2
const NISCHE = 'M272 820 V470 C272 330 392 230 512 176 C632 230 752 330 752 470 V820 H672 V488 C672 384 592 314 512 270 C432 314 352 384 352 488 V820 Z', FLAMME = 'M512 452 C576 532 600 596 578 652 C566 684 540 706 512 712 C484 706 458 684 446 652 C424 596 448 532 512 452 Z';
const laterne = klasse => `<span class="${klasse} zeichen" aria-hidden="true"><svg viewBox="232 156 560 684"><defs><linearGradient id="zv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--z1)"/><stop offset="1" style="stop-color:var(--z2)"/></linearGradient></defs><path d="${NISCHE}" fill="url(#zv)"/><path d="${FLAMME}" fill="url(#zv)"/></svg></span>`;
const qandil = () => laterne('qandil');
const lampeKlein = laterne('lampe-k');
function herunterladen(name, inhalt, typ) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([inhalt], { type: typ })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function dateiWaehlen(mehrere = false) {
  return new Promise(res => {
    // ohne accept: das iPhone graut unbekannte Endungen wie .itqan sonst aus
    const i = document.createElement('input'); i.type = 'file'; i.multiple = mehrere; i.style.display = 'none';
    i.onchange = async () => { res(await Promise.all([...i.files].map(f => f.text()))); i.remove(); };
    document.body.appendChild(i); i.click();
  });
}
function navSetzen(aktiv) {
  if (!aktiv) { nav.classList.add('verdeckt'); return; }
  nav.classList.remove('verdeckt');
  nav.querySelectorAll('a').forEach(a => { const an = a.dataset.r === aktiv; a.classList.toggle('an', an); if (an) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
}

const rangBand = r => `<div class="band rang-band"><span class="ar">${Z.RAENGE[r].ar}</span><span>${tx('rangband.neuer_rang_was_das_bedeutet', { n: Z.RAENGE[r].n, de: Z.RAENGE[r].de })}</span></div>`;

// ---------- Dialog (statt confirm): Titel, Inhalt, zwei Knöpfe; liefert true oder false ----------
function dialog({ titel, html = '', ja = tx('dialog.ok'), nein = tx('dialog.abbrechen'), gefahr = false }) {
  return new Promise(fertig => {
    const d = document.createElement('div'); d.className = 'dialog';
    d.innerHTML = `<div class="dialog-karte" role="dialog" aria-modal="true" aria-label="${esc(titel)}"><h3>${esc(titel)}</h3><div class="dialog-text">${html}</div>
      <div class="reihe">${nein ? `<button class="knopf leise klein" data-a="0">${esc(nein)}</button>` : ''}<button class="knopf ${gefahr ? 'schlecht' : 'haupt'} klein" data-a="1">${esc(ja)}</button></div></div>`;
    const vorher = document.activeElement;   // nach dem Schließen kehrt der Fokus dorthin zurück
    const zu = wert => { d.classList.add('weg'); setTimeout(() => d.remove(), 200); removeEventListener('keydown', taste, true); if (vorher?.isConnected) vorher.focus({ preventScroll: true }); fertig(wert); };
    const taste = ev => {
      if (ev.key === 'Escape') { ev.stopPropagation(); zu(false); return; }
      if (ev.key !== 'Tab') return;
      // der Fokus bleibt im Dialog
      const f = [...d.querySelectorAll('button, a[href], input, select, textarea')].filter(x => !x.disabled); if (!f.length) return;
      const drin = d.contains(document.activeElement);
      if (ev.shiftKey && (!drin || document.activeElement === f[0])) { ev.preventDefault(); f[f.length - 1].focus(); }
      else if (!ev.shiftKey && (!drin || document.activeElement === f[f.length - 1])) { ev.preventDefault(); f[0].focus(); }
    };
    d.onclick = ev => { const a = ev.target.closest('[data-a]'); if (a) zu(a.dataset.a === '1'); else if (ev.target === d) zu(false); };
    addEventListener('keydown', taste, true);
    document.body.appendChild(d); d.querySelector('[data-a="1"]').focus();
  });
}

// ---------- Gerät und Installation ----------
const istInstalliert = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true || !!globalThis.Capacitor?.isNativePlatform?.();
const istTouch = () => matchMedia('(pointer: coarse)').matches;
function geraet() {
  const ua = navigator.userAgent;
  if (/iPhone|iPod/.test(ua)) return 'iphone';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ipad';
  if (/Android/.test(ua)) return 'android';
  return 'pc';
}
let installHinweis = null;   // Chrome und Edge bieten Installieren mit einem Tipp an
addEventListener('beforeinstallprompt', ev => { ev.preventDefault(); installHinweis = ev; });

// ---------- Profil sichern und laden ----------
// Am Handy öffnet „Profil sichern“ das Teilen-Menü (Dateien, iCloud Drive, WhatsApp), am PC wird die Datei heruntergeladen.
async function profilSichern() {
  const P = Z.P, name = `Itqan-${(P.name || tx('allg.profil')).replace(/[^\p{L}\p{N}]+/gu, '_')}-${Z.heute()}.itqan`;
  const text = await Z.exportDatei();
  let geteilt = false;
  if (istTouch() && navigator.canShare) {
    const datei = new File([text], name, { type: 'application/octet-stream' });
    if (navigator.canShare({ files: [datei] })) {
      try { await navigator.share({ files: [datei], title: tx('profilsichern.itqan_profil') }); geteilt = true; }
      catch (e) { if (e.name === 'AbortError') return false; }
    }
  }
  if (!geteilt) herunterladen(name, text, 'application/octet-stream');
  P.einst.letzteSicherung = new Date().toISOString(); Z.speichern();
  toast(tx('profilsichern.profil_gesichert'));
  return true;
}
const datumKurz = d => d ? new Date(d.length === 10 ? d + 'T12:00' : d).toLocaleDateString(gebiet('datum'), { day: 'numeric', month: 'long', year: 'numeric' }) : tx('datumkurz.noch_nie');
async function profilLaden() {
  const [text] = await dateiWaehlen(); if (!text) return;
  let r;
  try { r = await Z.importDatei(text); } catch (e) { toast(tx('profilladen.das_ist_keine_gueltige_itqan_profildatei')); return; }
  const u = Z.profilUeberblick(r.profil);
  const ok = await dialog({ titel: tx('profilladen.dieses_profil_laden'), ja: tx('profilladen.laden'), html: `<div class="ueberblick">
      <div><span>${tx('profilladen.name')}</span><b>${esc(u.name || tx('profilladen.ohne_namen'))}</b></div>
      <div><span>${tx('profilladen.gesichert_am')}</span><b>${datumKurz(r.exportiert)}</b></div>
      <div><span>${tx('profilladen.zuletzt_geuebt')}</span><b>${datumKurz(u.letzterTag)}</b></div>
      <div><span>${tx('profilladen.abschnitte_geuebt')}</span><b>${zahl(u.abschnitte)}</b></div>
      <div><span>${tx('allg.itqan_punkte')}</span><b>${zahl(u.punkte)}</b></div>
      <div><span>${tx('allg.kette')}</span><b>${tx('profilladen.tage', { kette: u.kette })}</b></div></div>
    ${r.echt ? '' : `<p class="warnung">${tx('profilladen.achtung_die_datei_wurde_nach_dem_sichern')}</p>`}
    ${Z.P ? `<p class="unter">${tx('profilladen.dein_jetziger_stand_auf_diesem_geraet')}</p>` : ''}` });
  if (!ok) return;
  if (Z.P) Z.schnappschuss('vor dem Laden einer Sicherung');
  Z.ersetzeProfil(r.profil, r.exportiert);
  try { localStorage.setItem(EINF_KEY, '1'); } catch (e) {}
  location.hash = '#heute'; location.reload();
}

// ---------- Installieren ----------
const teilenSymbol = '<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5v10h14V11h-1"/></svg>';
const plusSymbol = '<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
const punkteSymbol = '<svg class="sym" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>';
function installieren() {
  if (!UEBERGANG.installieren) { location.replace(Z.P ? '#profil' : '#start'); return; }
  navSetzen(Z.P ? 'profil' : null);
  const g = geraet();
  const schritte = {
    iphone: [tx('installieren.oeffne_itqan_in_safari'), tx('installieren.tippe_unten_auf_teilen', { teilenSymbol }), tx('installieren.waehle_zum_home_bildschirm_dann', { plusSymbol })],
    ipad: [tx('installieren.oeffne_itqan_in_safari'), tx('installieren.tippe_oben_auf_teilen', { teilenSymbol }), tx('installieren.waehle_zum_home_bildschirm_dann', { plusSymbol })],
    android: [tx('installieren.oeffne_itqan_in_chrome'), tx('installieren.tippe_oben_rechts_auf_das_menue', { punkteSymbol }), tx('installieren.waehle_app_installieren_oder_zum')],
    pc: [tx('installieren.oeffne_itqan_in_chrome_oder_edge'), tx('installieren.klicke_rechts_in_der_adressleiste_auf'), tx('installieren.bestaetige_mit_installieren_itqan')]
  }[g];
  app.innerHTML = `${Z.P ? `<button class="zurueck" onclick="location.hash='#profil'">${zurueckPfeil}${tx('allg.profil')}</button>` : `<button class="zurueck" onclick="history.back()">${zurueckPfeil}${tx('allg.zurueck')}</button>`}
    <div class="marke">${tx('installieren.itqan_installieren')}<small>${tx('installieren.als_app_auf_dem_home_bildschirm_startet')}</small></div>
    ${istInstalliert() ? `<div class="hinweisbox"><b>${tx('installieren.itqan_ist_auf_diesem_geraet_bereits')}</b></div>` : ''}
    ${installHinweis ? `<button class="knopf haupt" id="jetzt-installieren" style="margin-top:16px">${tx('installieren.jetzt_installieren')}</button>` : ''}
    <ol class="install-schritte">${schritte.map(s => `<li><span>${s}</span></li>`).join('')}</ol>
    <div class="hinweisbox">${tx('installieren.wichtig_wenn_du_schon_im_browser_geuebt', { a: g === 'iphone' || g === 'ipad' ? tx('installieren.auf_dem_iphone_und_ipad_hat_die_app_auf') : tx('installieren.die_installierte_app_und_der_browser') })}</div>
    ${Z.P ? `<button class="knopf leise" id="inst-sichern">${tx('installieren.profil_jetzt_sichern')}</button>` : ''}`;
  const j = app.querySelector('#jetzt-installieren');
  if (j) j.onclick = async () => { installHinweis.prompt(); const w = await installHinweis.userChoice.catch(() => null); installHinweis = null; if (w?.outcome === 'accepted') toast(tx('installieren.itqan_wird_installiert')); installieren(); };
  const s = app.querySelector('#inst-sichern'); if (s) s.onclick = profilSichern;
}

// ---------- Was ist neu ----------
const VERSION_KEY = 'itqan-version-gesehen';
function neuigkeitenHTML(liste) {
  return liste.map(n => `<div class="neu-eintrag"><div class="neu-kopf"><b>${tx('neuigkeitenhtml.version', { v: n.v })}</b><span>${datumKurz(n.datum)}</span></div><h4>${esc(n.titel)}</h4><ul>${n.punkte.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>`).join('');
}
function neuigkeitenSeite() {
  navSetzen('profil');
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#profil'">${zurueckPfeil}${tx('allg.profil')}</button>
    <div class="marke">${tx('allg.was_ist_neu')}<small>${tx('neuigkeitenseite.itqan_jede_veroeffentlichung_mit_ihren', { VERSION })}</small></div>
    <div style="margin-top:16px">${neuigkeitenHTML(NEUIGKEITEN)}</div>`;
}
async function neuigkeitenPruefen() {
  let gesehen = null; try { gesehen = localStorage.getItem(VERSION_KEY); } catch (e) {}
  const merken = () => { try { localStorage.setItem(VERSION_KEY, VERSION); } catch (e) {} };
  if (!Z.P) { merken(); return; }
  if (gesehen === VERSION) return;
  const vgl = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x.at(i) || 0) - (y.at(i) || 0); if (d) return d; } return 0; };
  const neu = gesehen ? NEUIGKEITEN.filter(n => vgl(n.v, gesehen) > 0).slice(0, 3) : NEUIGKEITEN.slice(0, 1);
  merken();
  if (neu.length) await dialog({ titel: tx('neuigkeitenpruefen.neu_in_itqan', { VERSION }), html: neuigkeitenHTML(neu), ja: tx('neuigkeitenpruefen.schoen'), nein: '' });
}

// ---------- Rückmeldung ----------
let vorherigeAnsicht = '';
function rueckmeldung() {
  navSetzen('profil');
  const P = Z.P;
  const info = [tx('rueckmeldung.itqan', { VERSION }), tx('rueckmeldung.geraet', { geraet: geraet(), a: istTouch() ? tx('rueckmeldung.touch') : '', b: istInstalliert() ? tx('rueckmeldung.installiert') : tx('rueckmeldung.im_browser') }),
    tx('rueckmeldung.bildschirm_fenster', { width: screen.width, height: screen.height, innerWidth, innerHeight }), tx('rueckmeldung.browser', { userAgent: navigator.userAgent }),
    P ? tx('rueckmeldung.druck_abschnitte_geuebt', { a: P.einst.ausgabe === 'v1' ? '1405' : '1421', b: P.einst.modus === 'anf' ? tx('rueckmeldung.anfaenger') : P.einst.modus === 'seite' ? tx('rueckmeldung.ganze_seiten') : tx('rueckmeldung.fortgeschritten'), abschnitte: P.summe.abschnitte }) : tx('rueckmeldung.noch_kein_profil'),
    vorherigeAnsicht ? tx('rueckmeldung.zuletzt_geoeffnet', { vorherigeAnsicht }) : ''].filter(Boolean);
  let art = tx('allg.fehler');
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#profil'">${zurueckPfeil}${tx('allg.profil')}</button>
    <div class="marke">${tx('rueckmeldung.rueckmeldung')}<small>${tx('rueckmeldung.was_ist_dir_aufgefallen_jede')}</small></div>
    <div class="abschnitt"><h3>${tx('rueckmeldung.worum_geht_es')}</h3><div class="wahl" id="rm-art">${[tx('allg.fehler'), tx('rueckmeldung.wunsch'), tx('rueckmeldung.frage'), tx('rueckmeldung.lob')].map(a => `<button data-w="${a}" class="${a === art ? 'an' : ''}">${a}</button>`).join('')}</div>
      <textarea id="rm-text" rows="6" placeholder="${tx('rueckmeldung.beschreibe_kurz_was_passiert_ist_oder')}"></textarea>
      <label class="haken"><input type="checkbox" id="rm-info" checked> ${tx('rueckmeldung.angaben_zum_geraet_mitschicken')}</label>
      <p class="unter rm-info">${info.map(esc).join('<br>')}</p></div>
    <button class="knopf haupt" id="rm-senden">${tx('rueckmeldung.senden')}</button>
    <p class="unter" style="margin-top:8px;text-align:center">${RUECKMELDUNG_AN ? tx('rueckmeldung.oeffnet_eine_e_mail_an_das_itqan_team') : istTouch() ? tx('rueckmeldung.oeffnet_das_teilen_menue_z_b_fuer') : tx('rueckmeldung.oeffnet_dein_e_mail_programm_der_text')}</p>`;
  app.querySelector('#rm-art').onclick = ev => { const w = ev.target.dataset.w; if (!w) return; art = w; app.querySelectorAll('#rm-art button').forEach(b => b.classList.toggle('an', b.dataset.w === w)); };
  app.querySelector('#rm-senden').onclick = async () => {
    const text = app.querySelector('#rm-text').value.trim();
    if (!text) { toast(tx('rueckmeldung.schreib_bitte_kurz_worum_es_geht')); return; }
    const voll = `${tx('allg.itqan')} · ${art}\n\n${text}${app.querySelector('#rm-info').checked ? '\n\n---\n' + info.join('\n') : ''}`;
    const betreff = `${tx('rueckmeldung.itqan', { VERSION })} · ${art}`;
    try { await navigator.clipboard?.writeText(voll); } catch (e) {}
    if (!RUECKMELDUNG_AN && istTouch() && navigator.share) {
      try { await navigator.share({ title: betreff, text: voll }); toast(tx('rueckmeldung.danke_fuer_deine_rueckmeldung')); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    location.href = `mailto:${RUECKMELDUNG_AN}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(voll)}`;
    toast(tx('rueckmeldung.danke_der_text_ist_auch_kopiert'));
  };
}

// ---------- Schnappschüsse (Einstellungen und Start) ----------
// Der Grund steht als festes Kennzeichen im Speicher, angezeigt wird der Text der Sprache
const GRUND_TEXT = { 'täglich': tx('grund_text.taeglich'), 'vor dem Gliederungswechsel': tx('grund_text.vor_dem_wechsel_der_abschnittslaenge'),
  'vor dem Laden einer Sicherung': tx('grund_text.vor_dem_laden_einer_sicherung'), 'vor dem Löschen': tx('grund_text.vor_dem_loeschen'), 'vor dem Zurückholen': tx('grund_text.vor_dem_zurueckholen') };
function schnappschussListe() {
  const l = Z.schnappschuesse();
  if (!l.length) return `<p class="leer">${tx('schnappschussliste.noch_keine_schnappschuesse')}</p>`;
  return `<div class="schnapp-liste">${l.map(x => `<div class="schnapp"><div><b>${new Date(x.zeit).toLocaleString(gebiet('datum'), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</b><span>${esc(GRUND_TEXT[x.grund] || x.grund)} · ${tx('schnappschussliste.abschnitte_geuebt', { abschnitte: zahl(x.abschnitte), n: x.abschnitte })}</span></div><button class="knopf leise klein" data-zeit="${x.zeit}">${tx('schnappschussliste.zurueckholen')}</button></div>`).join('')}</div>`;
}
function schnappschussBinden(wurzel) {
  wurzel.querySelectorAll('[data-zeit]').forEach(b => b.onclick = async () => {
    const ok = await dialog({ titel: tx('schnappschussbinden.diesen_stand_zurueckholen'), html: `<p>${tx('schnappschussbinden.itqan_setzt_dein_profil_auf_den_stand', { a: new Date(b.dataset.zeit).toLocaleString(gebiet('datum')) })}</p>`, ja: tx('schnappschussbinden.zurueckholen') });
    if (!ok) return;
    Z.schnappschussZurueck(b.dataset.zeit); location.hash = '#heute'; location.reload();
  });
}

// ---------- Alle Seiten offline speichern ----------
const SEITEN_CACHE = 'itqan-seiten-v1';
const seitenUrl = x => `schriften/${D.ausgabe === 'v1' ? 'v1' : 'v2'}/p${x}.woff2`;
async function gespeicherteSeiten() {
  if (!('caches' in window)) return null;
  const c = await caches.open(SEITEN_CACHE), pfad = `/schriften/${D.ausgabe === 'v1' ? 'v1' : 'v2'}/p`;
  return new Set((await c.keys()).map(r => new URL(r.url).pathname).filter(p => p.includes(pfad)).map(p => +p.split(pfad)[1].replace('.woff2', '')));
}
// Die Seiten des heutigen Wird im Hintergrund speichern, damit es auch ohne Netz in Muṣḥaf-Schrift da ist
async function vorratSpeichern() {
  if (!Z.P || !navigator.onLine || navigator.connection?.saveData) return;
  try {
    const da = await gespeicherteSeiten(); if (!da) return;
    const t = Z.tagesplan(), cache = await caches.open(SEITEN_CACHE);
    const fehlt = [...new Set(t.plan.filter(x => !t.fertig.includes(x)).flatMap(x => D.A[x].seiten).flatMap(schriftSeiten))].filter(x => !da.has(x));
    for (let i = 0; i < fehlt.length; i += 3) await Promise.all(fehlt.slice(i, i + 3).map(x => cache.add(seitenUrl(x)).catch(() => {})));
  } catch (e) {}
}

// ---------- Kurzübungen ----------
// ---------- Nachträglich abhaken: außerhalb der App geübt (Gebet, unterwegs) ----------
function abhakenSeite() {
  navSetzen('heute');
  const offen = Z.heuteAbhakbar();
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#heute'">${zurueckPfeil}${tx('titel.heute')}</button>
    <div class="marke">${tx('abhaken.titel')}<small>${tx('abhaken.text')}</small></div>
    ${offen.length ? `<div class="abh-liste" role="group" aria-label="${tx('abhaken.titel')}">${offen.map(id => `<label class="karte abh-zeile"><input type="checkbox" value="${id}"><div class="t"><b>${esc(abschnittName(D.A[id]))}</b><span>${esc(D.A[id].titel)}</span></div></label>`).join('')}</div>
      <div class="reihe" style="margin-top:14px"><button type="button" class="knopf leise" id="abh-alle">${tx('abhaken.alle')}</button><button type="button" class="knopf haupt" id="abh-ok" disabled>${tx('abhaken.knopf')}</button></div>`
    : `<p class="leer" style="margin-top:16px">${tx('abhaken.leer')}</p>`}`;
  if (!offen.length) return;
  const boxen = () => [...app.querySelectorAll('.abh-liste input')], ok = app.querySelector('#abh-ok');
  const pruefen = () => { ok.disabled = !boxen().some(b => b.checked); };
  app.querySelector('.abh-liste').onchange = pruefen;
  app.querySelector('#abh-alle').onclick = () => { const an = !boxen().every(b => b.checked); boxen().forEach(b => { b.checked = an; }); pruefen(); };
  ok.onclick = () => {
    const ev = []; let n = 0;
    for (const b of boxen()) if (b.checked) { const r = Z.abschnittAbhaken(+b.value); if (r) { n++; ev.push(...r.ereignisse); } }
    letzteEreignisse.push(...ev);
    toast(tx('abhaken.fertig', { n }));
    location.hash = ev.some(x => x.typ === 'wird') ? '#fertig' : '#heute';
  };
}

function kurzSeite(was) {
  navSetzen('heute');
  if (was === 'zeile') return zeileSeite();
  const arten = [['seite', tx('kurz.seite'), tx('kurz.seite_t')], ['juz', tx('kurz.juz'), tx('kurz.juz_t')], ['uebergang', tx('kurz.uebergang'), tx('kurz.uebergang_t')], ['mitte', tx('kurz.mitte'), tx('kurz.mitte_t')], ['titel', tx('kurz.titel_aufgabe'), tx('kurz.titel_aufgabe_t')]];
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#heute'">${zurueckPfeil}${tx('titel.heute')}</button>
    <div class="marke">${tx('kurz.titel')}<small>${tx('kurz.untertitel')}</small></div>
    <div class="kurz-liste">${arten.map(([k, l, t]) => `<button type="button" class="kurz-karte" data-k="${k}"><b>${l}</b><span>${t}</span></button>`).join('')}
      <a class="kurz-karte" href="#kurz/zeile"><b>${tx('kurz.zeile')}</b><span>${tx('kurz.zeile_t')}</span></a>
      <button type="button" class="kurz-karte" data-k="zwillinge"><b>${tx('kurz.zwillinge')}</b><span>${tx('kurz.zwillinge_t')}</span></button></div>
    <p class="leer verdeckt" id="kurz-leer" role="status">${tx('kurz.nichts')}</p>`;
  app.querySelector('.kurz-liste').onclick = async ev => {
    const b = ev.target.closest('[data-k]'); if (!b) return;
    const h = b.dataset.k === 'zwillinge' ? await AF.zwillingsZiel() : AF.naechste(b.dataset.k);
    if (h) location.hash = h; else app.querySelector('#kurz-leer').classList.remove('verdeckt');
  };
  window.scrollTo(0, 0);
}
// Zeile auf der Seite: Seite und Āya sind genannt, gefragt ist die Zeile, in der die Āya beginnt
function zeileSeite() {
  const a = AF.zeilenAufgabe();
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#kurz'">${zurueckPfeil}${tx('kurz.titel')}</button>
    <div class="marke">${tx('kurz.zeile')}<small>${a ? tx('kurz.zeile_frage', { p: a.p, name: esc(sureName(a.s)), aya: a.a }) : ''}</small></div>
    ${a ? `<div class="zeilenwahl" role="group">${Array.from({ length: a.zeilenZahl }, (_, i) => `<button type="button" data-z="${i + 1}" aria-label="${tx('kurz.zeile_nr', { n: i + 1 })}"><span>${i + 1}</span></button>`).join('')}</div>
      <p class="unter" id="zeile-ergebnis" role="status" style="margin-top:10px"></p>
      <div class="reihe" style="margin-top:12px"><button class="knopf haupt klein verdeckt" id="zeile-weiter">${tx('kurz.nochmal')}</button></div>` : `<p class="leer">${tx('kurz.nichts')}</p>`}`;
  if (!a) return;
  const w = app.querySelector('.zeilenwahl');
  w.onclick = ev => {
    const b = ev.target.closest('button'); if (!b || w.dataset.fertig) return; w.dataset.fertig = '1';
    const d = Math.abs(+b.dataset.z - a.zeile); b.classList.add('gewaehlt'); w.querySelector(`[data-z="${a.zeile}"]`).classList.add('richtig');
    app.querySelector('#zeile-ergebnis').textContent = d === 0 ? tx('kurz.zeile_genau') : d === 1 ? tx('kurz.zeile_nah') : tx('kurz.zeile_fern', { n: d });
    app.querySelector('#zeile-weiter').classList.remove('verdeckt');
  };
  app.querySelector('#zeile-weiter').onclick = zeileSeite;
  window.scrollTo(0, 0);
}
// ---------- Router ----------
const ROUTEN = { sprachwahl, heute, abhaken: abhakenSeite, kurz: kurzSeite, lernen: lernenSeite, ueben, fertig, karte: lichtkarte, mushaf, profil, einstellungen, lehrer, start, raenge, einfuehrung, fortschritt: fortschrittSeite, auswertung: auswertungSeite, suche: sucheSeite, aehnlich: aehnlichSeite, vergleich: vergleichSeite, fehlerstellen: fehlerstellenSeite, ornamente: ornamenteSeite, installieren, neu: neuigkeitenSeite, rueckmeldung, rueckblick: rueckblickSeite, hilfe: hilfeSeite };
// Seitentitel je Ansicht: Bildschirmleser sagen ihn beim Wechsel an
const TITEL = { abhaken: tx('abhaken.titel'), kurz: tx('kurz.titel'), sprachwahl: tx('sprachwahl.titel'), heute: tx('titel.heute'), ueben: tx('allg.ueben'), fertig: tx('titel.abschluss'), karte: tx('allg.lichtkarte'), mushaf: tx('allg.mushaf'), profil: tx('allg.profil'), einstellungen: tx('allg.einstellungen'), lehrer: tx('titel.lehrer'), start: tx('titel.profil_anlegen'), raenge: tx('titel.raenge'), einfuehrung: tx('titel.einfuehrung'),
  lernen: tx('lernen.neu_lernen'), fortschritt: tx('allg.fortschritt'), auswertung: tx('allg.auswertung'), suche: tx('titel.suche'), aehnlich: tx('titel.mutasabihat'), vergleich: tx('titel.vergleich'), fehlerstellen: tx('allg.fehlerstellen'), ornamente: tx('allg.ornamente'), installieren: tx('titel.installieren'), neu: tx('allg.was_ist_neu'), rueckmeldung: tx('titel.rueckmeldung'), rueckblick: tx('allg.rueckblick'), hilfe: tx('titel.hilfe_und_glossar') };
// Was gewählt ist, erfährt auch der Bildschirmleser: aria-pressed folgt der Klasse "an"
const GEDRUECKT = '.wahl button, .juzwahl button, .arten button';
new MutationObserver(() => {
  for (const b of app.querySelectorAll(GEDRUECKT)) { const an = String(b.classList.contains('an')); if (b.getAttribute('aria-pressed') !== an) b.setAttribute('aria-pressed', an); }
  // eine Auswahl heißt wie die Überschrift ihres Abschnitts
  for (const g of app.querySelectorAll('.abschnitt .wahl:not([role]), .abschnitt .juzwahl:not([role])')) { const h = g.closest('.abschnitt').querySelector('h3'); if (h) { g.setAttribute('role', 'group'); g.setAttribute('aria-label', h.textContent); } }
}).observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
let scrollBehalten = null;   // beim Blättern im Muṣḥaf bleibt die Scrollhöhe
async function zeige() {
  const [name, ...arg] = (location.hash.slice(1) || 'heute').split('/');
  // Erstes Öffnen: zuerst die Einführung, dann das Profil
  if (!Z.P && name !== 'sprachwahl' && !spracheGewaehlt()) { location.replace('#sprachwahl'); return; }   // allererster Start: zuerst die Sprache
  if (!Z.P && name !== 'start' && name !== 'einfuehrung' && name !== 'sprachwahl') { location.replace(einfuehrungGesehen() ? '#start' : '#einfuehrung'); return; }
  durchlaufSetzen(!!Z.P?.einst.bereich);   // ohne alle 30 Aǧzāʾ keine Ḫatma, sondern ein Durchlauf
  const f = ROUTEN[name] || heute;
  if (name !== 'rueckmeldung') vorherigeAnsicht = location.hash || '#heute';
  document.body.dataset.ansicht = ROUTEN[name] ? name : 'heute';
  document.body.classList.remove('doppelt');
  const y = scrollBehalten; scrollBehalten = null;
  if (y == null) window.scrollTo(0, 0);
  await f(...arg);
  if (y != null) window.scrollTo(0, y);
  const ansicht = ROUTEN[name] ? name : 'heute';
  document.title = ansicht === 'heute' ? tx('allg.itqan') : `${TITEL[ansicht]} · ${tx('allg.itqan')}`;
  // Tastatur und Bildschirmleser beginnen in der neuen Ansicht, nicht in der alten Navigation
  if (!app.contains(document.activeElement)) app.focus({ preventScroll: true });
}
addEventListener('hashchange', zeige);

// ---------- Einführung (beim ersten Öffnen, später über Profil oder Start erneut) ----------
const EINF_KEY = 'itqan-einfuehrung';
const einfuehrungGesehen = () => { try { return localStorage.getItem(EINF_KEY) === '1'; } catch (e) { return true; } };
// ---------- Sprachwahl beim ersten Start ----------
// Die Sprache gilt für das Gerät und wird beim Start geladen. Antippen wählt nur aus, erst der Knopf darunter bestätigt
// (in der gewählten Sprache beschriftet). Danach lädt die App neu und beginnt mit der Einführung.
function sprachwahl() {
  navSetzen(null);
  const frei = SPRACHEN.filter(s => s.frei);
  let wahl = spracheGewaehlt() ? gebiet('code') : geraeteSprache();
  if (!frei.some(s => s.code === wahl)) wahl = 'de';
  app.innerHTML = `<div class="start">${qandil()}<h1>${tx('allg.itqan')}</h1><div class="ar">إِتْقَان</div>
    <p class="unter" style="margin-top:8px">${tx('sprachwahl.titel')}</p></div>
    <div class="sprachwahl" id="sprachwahl" role="radiogroup" aria-label="${esc(tx('sprachwahl.titel'))}">${frei.map(s => `<button class="knopf leise sw-wahl" role="radio" data-w="${s.code}" lang="${s.code}" dir="${s.rtl ? 'rtl' : 'ltr'}">${esc(s.name)}</button>`).join('')}</div>
    <div class="sprachwahl sw-los"><button class="knopf haupt" id="sw-los">${esc(frei.find(s => s.code === wahl).los)}</button></div>`;
  const los = app.querySelector('#sw-los');
  const zeigen = () => {
    for (const b of app.querySelectorAll('.sw-wahl')) { const an = b.dataset.w === wahl; b.classList.toggle('an', an); b.setAttribute('aria-checked', an ? 'true' : 'false'); }
    const s = frei.find(x => x.code === wahl);
    los.textContent = s.los; los.lang = s.code; los.dir = s.rtl ? 'rtl' : 'ltr';
  };
  zeigen();
  app.querySelector('#sprachwahl').onclick = ev => { const w = ev.target.closest('button')?.dataset.w; if (w) { wahl = w; zeigen(); } };
  los.onclick = () => {
    spracheMerken(wahl);
    const u = new URL(location.href); u.searchParams.delete('sprache'); u.hash = Z.P ? '#heute' : '#einfuehrung';
    history.replaceState(null, '', u); location.reload();
  };
}
function einfuehrung() {
  navSetzen(null);
  const linien = (n, klasse = '') => Array.from({ length: n }, (_, i) => `<i class="${klasse}" style="--i:${i}"></i>`).join('');
  const SCHRITTE = [
    { bild: `<div class="tb-laterne">${qandil()}</div><div class="tb-ar">إِتْقَان</div>`,
      titel: tx('einfuehrung.assalamu_alaikum'),
      text: tx('einfuehrung.itqan_begleitet_dich_bei_der_muragaa_des') },
    { bild: `<div class="tb-seite">${[3, 4, 5, 3].map((n, g) => linien(n, 'g' + g)).join('')}</div>`,
      titel: tx('einfuehrung.sinnabschnitte_statt_seiten'),
      text: tx('einfuehrung.der_quran_ist_in_kleine_sinnabschnitte') },
    { bild: `<div class="tb-ayat">${Array.from({ length: 4 }, (_, i) => `<div class="tb-aya" style="--i:${i}"><span class="tb-schleier"></span><span class="tb-schrift"></span><b class="${i === 2 ? 'nein' : 'ja'}">${i === 2 ? '✗' : '✓'}</b></div>`).join('')}</div>`,
      titel: tx('einfuehrung.aufdecken_und_ehrlich_pruefen'),
      text: tx('einfuehrung.die_ayat_sind_verdeckt_du_rezitierst_aus') },
    { bild: `<div class="tb-stufen">${[tx('allg.neu'), tx('einfuehrung.aufbau'), tx('allg.gefestigt'), tx('allg.sicher'), tx('allg.mutqan')].map((s, i) => `<span style="--i:${i}">${s}</span>`).join('')}<div class="tb-zurueck"><span>${tx('einfuehrung.1_tag')}</span><span>${tx('einfuehrung.3_tage')}</span><span>${tx('einfuehrung.7_tage')}</span></div></div>`,
      titel: tx('einfuehrung.was_nicht_sitzt_kommt_wieder'),
      text: tx('einfuehrung.jeder_fehlerfreie_durchgang_hebt_einen') },
    { bild: `<div class="tb-licht">${Array.from({ length: 40 }, (_, i) => `<i style="--i:${i};--o:${[.15, .35, .55, .8, 1][(i * 7) % 5]}"></i>`).join('')}</div>`,
      titel: tx('einfuehrung.deine_lichtkarte'),
      text: tx('einfuehrung.je_sicherer_eine_seite_sitzt_desto') },
    { bild: `<div class="tb-kette">${Array.from({ length: 7 }, (_, i) => `<span style="--i:${i}">${lampeKlein}<small>${i + 1}</small></span>`).join('')}</div>`,
      titel: tx('einfuehrung.bestaendigkeit_vor_menge'),
      text: tx('einfuehrung.jeder_tag_mit_erfuelltem_wird_zuendet') },
    { bild: `<div class="tb-liste">${[tx('einfuehrung.abschnittslaenge_waehlen'), tx('einfuehrung.nur_sichere_agza'), tx('einfuehrung.wenig_aber_jeden_tag'), tx('einfuehrung.profil_sichern')].map((t, i) => `<div style="--i:${i}"><b>✓</b>${t}</div>`).join('')}</div>`,
      titel: tx('einfuehrung.bevor_du_dein_profil_anlegst'),
      text: `<ul class="tb-punkte">
        <li>${tx('einfuehrung.abschnittslaenge_wer_erst_seit_kurzem')}</li>
        <li>${tx('einfuehrung.agza_waehle_nur_die_agza_die_du_schon')}</li>
        <li>${tx('einfuehrung.abschnitte_am_tag_lieber_wenig_und_jeden')}</li>
        <li>${tx('einfuehrung.sichern_solange_die_app_in_der_testphase')}</li></ul>` }
  ];
  let i = 0;
  app.innerHTML = `<div class="tutorial">
    <button class="textlink tut-weg" id="tut-weg">${tx('einfuehrung.ueberspringen')}</button>
    <div class="tut-buehne" id="tut-buehne"></div>
    <div class="tut-punkte" id="tut-punkte">${SCHRITTE.map((_, k) => `<i data-k="${k}"></i>`).join('')}</div>
    <div class="reihe tut-knoepfe"><button class="knopf leise" id="tut-zurueck">${tx('allg.zurueck')}</button><button class="knopf haupt" id="tut-weiter">${tx('allg.weiter')}</button></div></div>`;
  const buehne = app.querySelector('#tut-buehne'), weiter = app.querySelector('#tut-weiter'), zurueck = app.querySelector('#tut-zurueck');
  const fertig = () => { try { localStorage.setItem(EINF_KEY, '1'); } catch (e) {} location.hash = Z.P ? '#profil' : '#start'; };
  function zeigeSchritt(neu, richtung = 1) {
    i = Math.max(0, Math.min(SCHRITTE.length - 1, neu));
    const s = SCHRITTE[i];
    buehne.innerHTML = `<div class="tut-schritt ${richtung < 0 ? 'rueckwaerts' : ''}"><div class="tut-bild">${s.bild}</div><h2>${s.titel}</h2><div class="tut-text">${s.text}</div></div>`;
    app.querySelectorAll('#tut-punkte i').forEach((p, k) => p.classList.toggle('an', k === i));
    const zurSprache = !i && !Z.P;
    zurueck.style.visibility = i || zurSprache ? 'visible' : 'hidden';
    // Pfeil als eigenes Flex-Element: steht so in jeder Schreibrichtung außen und zeigt zurück
    zurueck.classList.toggle('mit-pfeil', zurSprache);
    zurueck.innerHTML = zurSprache ? `<span aria-hidden="true">${gebiet('richtung') === 'rtl' ? '→' : '←'}</span><span>${esc(tx('einstellungen.sprache'))}</span>` : esc(tx('allg.zurueck'));
    weiter.textContent = i === SCHRITTE.length - 1 ? (Z.P ? tx('einfuehrung.fertig') : tx('einfuehrung.profil_erstellen')) : tx('allg.weiter');
    window.scrollTo(0, 0);
  }
  function hoeheFestlegen() {
    const mess = document.createElement('div'); mess.className = 'tut-mess';
    mess.style.width = buehne.clientWidth + 'px';
    mess.innerHTML = SCHRITTE.slice(0, -1).map(s => `<div class="tut-schritt"><div class="tut-bild">${s.bild}</div><h2>${s.titel}</h2><div class="tut-text">${s.text}</div></div>`).join('');
    document.body.appendChild(mess);
    buehne.style.minHeight = Math.ceil(Math.max(...[...mess.children].map(x => x.offsetHeight))) + 'px';
    mess.remove();
  }
  hoeheFestlegen(); addEventListener('resize', function r() { if (!buehne.isConnected) return removeEventListener('resize', r); hoeheFestlegen(); });
  weiter.onclick = () => i === SCHRITTE.length - 1 ? fertig() : zeigeSchritt(i + 1, 1);
  zurueck.onclick = () => (!i && !Z.P ? (location.hash = '#sprachwahl') : zeigeSchritt(i - 1, -1));
  app.querySelector('#tut-weg').onclick = fertig;
  app.querySelector('#tut-punkte').onclick = ev => { const k = ev.target.dataset.k; if (k != null) zeigeSchritt(+k, +k > i ? 1 : -1); };
  // Wischen: nach links weiter, nach rechts zurück
  let sx = null, sy = null;
  buehne.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  buehne.addEventListener('touchend', e => {
    if (sx == null) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) dx < 0 ? weiter.click() : (i && zurueck.click());
  });
  zeigeSchritt(0);
}

// ---------- Start ----------
function start() {
  navSetzen(null);
  const s = { name: '', pensum: 3, reihenfolge: 'vorwaerts', zufall: 'einzeln', sel: alles(), thema: 'auto', modus: 'fort', hasanat: '1', rhythmus: 'langzeit' };
  const tageText = () => {
    const ganz = s.modus === 'seite';
    const ids = ganz ? seitenZahl(s.sel) : (zuAbschnitten(s.sel) || D.A).length;
    return `${ganz ? tx('start.seiten_zahl', { ids }) : tx('start.abschnitte', { ids })} · ${istAlles(s.sel) ? tx('start.eine_hatma_dauert_damit_etwa_tage', { a: Math.ceil(ids / s.pensum) }) : tx('start.ein_durchlauf_dauert_damit_etwa_tage', { a: Math.ceil(ids / s.pensum) })}`;
  };
  app.innerHTML = `<div class="start">${qandil()}<h1>${tx('allg.itqan')}</h1><div class="ar">إِتْقَان</div>
    <p class="unter" style="margin-top:8px">${tx('start.die_muragaa_des_ganzen_qurans_abschnitt')}</p>
    <a class="textlink" href="#einfuehrung">${tx('start.einfuehrung_noch_einmal_ansehen')}</a></div>
    <div class="abschnitt start-laden"><h3>${tx('start.schon_ein_profil')}</h3><p class="unter">${tx('start.wenn_du_itqan_auf_einem_anderen_geraet')}</p>
      <div class="reihe" style="margin-top:10px"><button class="knopf leise klein" id="start-laden">${tx('start.gesichertes_profil_laden')}</button>${Z.schnappschuesse().length ? `<button class="knopf leise klein" id="start-schnapp">${tx('start.schnappschuss_zurueckholen')}</button>` : ''}</div>
      <div id="start-schnapp-liste" class="verdeckt" style="margin-top:12px">${schnappschussListe()}</div></div>
    <div class="abschnitt"><h3>${tx('start.wie_heisst_du')}</h3><div class="feld"><input type="text" id="name" placeholder="${tx('start.dein_name_fuer_deine_profildatei')}" autocomplete="given-name"></div></div>
    <div class="abschnitt"><h3>${tx('start.was_wiederholst_du')}</h3><p class="unter">${tx('start.waehle_die_agza_die_du_auswendig_kannst')}</p>
      <div id="auswahl"></div></div>
    <div class="abschnitt"><h3 id="pensum-titel">${tx('start.wie_viele_abschnitte_am_tag')}</h3><p class="unter">${tx('start.pro_wochentag_kannst_du_es_spaeter')}</p>
      <div class="zaehler"><button id="minus" aria-label="${tx('start.weniger')}">−</button><b id="pensum">3</b><button id="plus" aria-label="${tx('start.mehr')}">+</button></div>
      <p class="unter" style="text-align:center" id="dauer"></p></div>
    <div class="abschnitt"><h3>${tx('einstellungen.hasanat_titel')}</h3><p class="unter">${tx('einstellungen.hasanat_text')}</p>
      <div class="wahl" id="hasanat" style="margin-top:10px"><button data-w="1" class="an">${tx('einstellungen.hasanat_zeigen')}</button><button data-w="0">${tx('einstellungen.hasanat_ausblenden')}</button></div></div>
    <details class="start-mehr"><summary>${tx('start.weitere_einstellungen')}</summary><p class="unter" style="margin:8px 0">${tx('start.weitere_text')}</p>
    <div class="abschnitt"><h3>${tx('einstellungen.rhythmus')}</h3>
      <div class="wahl" id="rhythmus" style="margin-top:10px"><button data-w="khatma">${tx('einstellungen.rhythmus_klassisch')}</button><button data-w="langzeit" class="an">${tx('einstellungen.rhythmus_langzeit')}</button></div>
      ${optionsListe([tx('einstellungen.rhythmus_text')])}</div>
    <div class="abschnitt"><label class="auswahl"><span>${tx('einstellungen.herkunft')}</span><select id="herkunft">${[['madina', tx('einstellungen.herkunft_madina')], ['indopak', tx('einstellungen.herkunft_indopak')], ['tuerkisch', tx('einstellungen.herkunft_tuerkisch')], ['andere', tx('einstellungen.herkunft_andere')]].map(([w, l]) => `<option value="${w}"${(s.herkunft || 'madina') === w ? ' selected' : ''}>${l}</option>`).join('')}</select></label><p class="unter" style="margin-top:6px">${tx('einstellungen.herkunft_text')}</p></div>
    <div class="abschnitt"><h3>${tx('start.wie_lang_sollen_die_abschnitte_sein')}</h3>${modusWahl('fort', false)}</div>
    <div class="abschnitt"><h3>${tx('start.in_welcher_reihenfolge')}</h3><div class="wahl reihenfolge-wahl" id="reihenfolge"><button data-w="vorwaerts" class="an">${tx('start.vorwaerts')}<small>${tx('start.bsp_vorwaerts')}</small></button><button data-w="rueckwaerts">${tx('start.rueckwaerts')}<small>${tx('start.bsp_rueckwaerts')}</small></button><button data-w="zufall">${tx('start.zufaellig')}</button></div>
      <div id="zufallwahl" class="verdeckt" style="margin-top:12px"><p class="unter">${tx('start.bei_mehreren_abschnitten_am_tag')}</p><div class="wahl" id="zufall" style="margin-top:8px"><button data-w="einzeln" class="an">${tx('start.verstreute_stellen')}</button><button data-w="block">${tx('start.eine_stelle_am_stueck')}</button></div></div></div>
    <div class="abschnitt"><h3>${tx('start.erscheinungsbild')}</h3><div class="wahl" id="thema"><button data-w="hell">${tx('start.hell')}</button><button data-w="dunkel">${tx('start.dunkel')}</button><button data-w="auto" class="an">${tx('start.wie_geraet')}</button></div></div>
    </details>
    <button class="knopf haupt" id="los" style="margin-top:18px">${tx('start.bismillah_beginnen')}</button>`;
  app.querySelector('#start-laden').onclick = profilLaden;
  const ssb = app.querySelector('#start-schnapp'); if (ssb) ssb.onclick = () => app.querySelector('#start-schnapp-liste').classList.toggle('verdeckt');
  schnappschussBinden(app);
  const dauerZeigen = () => { app.querySelector('#dauer').innerHTML = tageText(); };
  app.querySelector('#herkunft').onchange = ev => { s.herkunft = ev.target.value; };
  wahlZeichnen(app.querySelector('#auswahl'), s.sel, dauerZeigen, { leer: tx('auswahl.leer_start') });
  const p = d => { s.pensum = Math.min(30, Math.max(1, s.pensum + d)); app.querySelector('#pensum').textContent = s.pensum; app.querySelector('#dauer').innerHTML = tageText(); };
  app.querySelector('#minus').onclick = () => p(-1); app.querySelector('#plus').onclick = () => p(1);
  for (const id of ['reihenfolge', 'zufall', 'thema', 'modus', 'hasanat', 'rhythmus']) app.querySelector('#' + id).onclick = e => {
    const w = e.target.closest('button')?.dataset.w; if (!w) return; s[id] = w;
    app.querySelectorAll(`#${id} button`).forEach(b => b.classList.toggle('an', b.dataset.w === w));
    if (id === 'reihenfolge') app.querySelector('#zufallwahl').classList.toggle('verdeckt', w !== 'zufall');
    if (id === 'thema') { try { localStorage.setItem('itqan-thema', w); } catch (x) {} themaAnwenden(); }
    if (id === 'modus') { app.querySelector('#pensum-titel').textContent = w === 'seite' ? tx('start.wie_viele_seiten_am_tag') : tx('start.wie_viele_abschnitte_am_tag'); app.querySelector('#dauer').innerHTML = tageText(); }
  };
  app.querySelector('#los').onclick = () => {
    if (istLeer(s.sel)) { toast(tx('auswahl.mindestens_etwas')); return; }
    const bereich = zuAbschnitten(s.sel);
    Z.neuesProfil({ name: app.querySelector('#name').value.trim(), pensum: s.pensum, reihenfolge: s.reihenfolge, bereich: null, thema: s.thema, modus: s.modus });
    Z.P.einst.zufall = s.zufall; Z.P.einst.hasanat = s.hasanat !== '0'; Z.P.einst.rhythmus = s.rhythmus; if (s.herkunft) Z.P.einst.herkunft = s.herkunft;
    // Auswahl als Āya-Bereiche merken; die Abschnitte dazu bestimmt die gewählte Gliederung beim Start
    if (bereich) Z.P.einst.auswahl = zuBereichen(s.sel);
    Z.speichern();
    if (s.modus !== D.modus) { location.hash = '#heute'; location.reload(); return; }
    if (bereich) { Z.P.einst.bereich = bereich; Z.speichern(); }
    navigator.storage?.persist?.();
    location.hash = '#heute';
  };
  dauerZeigen();
}

// Sūrenname und Abschnittsnummer fett; die Nummer zeigt farbig, wie gut der Abschnitt sitzt
const STAND_TEXT = { nie: tx('stand_text.noch_nie_wiederholt'), neu: tx('allg.neu'), aufbau: tx('stand_text.im_aufbau'), gefestigt: tx('allg.gefestigt'), sicher: tx('allg.sicher'), mutqan: tx('allg.mutqan'), fehler: tx('stand_text.fehler_im_letzten_durchgang') };
function abschnittMarke(e) {
  const st = Z.abschnittStand(e.id);
  if (!e.nr) return `<strong class="ab-name" title="${STAND_TEXT[st]}">${abschnittName(e)}</strong>`;
  return `<strong class="ab-name">${sureName(e.von[0])} <span class="ab-nr st-${st}" title="${STAND_TEXT[st]}">${e.nr}</span><span class="nur-leser">${komma()}${STAND_TEXT[st]}</span></strong>`;
}

// Wahl zwischen Anfänger, Fortgeschritten und ganzen Seiten; empfohlen bleiben die Sinnabschnitte
// Erklärung mehrerer Wahlmöglichkeiten: jede für sich, mit hervorgehobenem Namen; ein Absatz ohne Namen bleibt ein schlichter Hinweis.
// Jeder Text darf mehrere Möglichkeiten mit <br> trennen; der Name steht als <b>Name:</b> am Anfang.
function optionsListe(texte) {
  const teile = texte.flatMap(t => String(t).split(/<br\s*\/?>/));
  return `<div class="opt-liste unter">${teile.map(t => { const m = t.match(/^\s*<b>(.*?)<\/b>\s*([\s\S]*)$/); return m ? `<div class="opt"><span class="opt-name">${m[1].replace(/\s*[:：]\s*$/, '')}</span>${m[2]}</div>` : `<p class="opt-notiz">${t}</p>`; }).join('')}</div>`;
}
function modusWahl(jetzt, mitHinweis = true) {
  return `<div class="wahl" id="modus" style="margin-top:4px">${[['anf', tx('moduswahl.anfaenger')], ['fort', tx('moduswahl.fortgeschritten')], ['seite', tx('moduswahl.ganze_seiten')]].map(([w, l]) => `<button data-w="${w}" class="${jetzt === w ? 'an' : ''}">${l}</button>`).join('')}</div>
    ${optionsListe([tx('moduswahl.anfaenger_jeder_abschnitt_ist_hoechstens'), tx('moduswahl.ganze_seiten_text'), ...(mitHinweis ? [tx('moduswahl.beim_wechsel_bleibt_dein_fortschritt')] : [])])}`;
}

// ---------- Heute ----------
function heute() {
  navSetzen('heute');
  const t = Z.tagesplan(), P = Z.P;
  const pflicht = t.plan.filter(id => t.art[id] !== 'bonus');
  const erledigt = pflicht.filter(id => t.fertig.includes(id)).length;
  const offen = t.plan.filter(id => !t.fertig.includes(id));
  const anteil = pflicht.length ? erledigt / pflicht.length : 0;
  const U = 2 * Math.PI * 88;
  const aktiv = Z.ketteAktiv();
  const quote = t.r + t.f + t.h ? Math.round(100 * t.r / (t.r + t.f + t.h)) : null;
  const kf = Z.khatmaFortschritt();
  const istFreitag = Z.wochentag(Z.heute()) === 4;
  // Ruhetag oder Pause: kein Wird, die Kette wartet
  const ps = t.ruhe === 'pause' ? Z.pauseJetzt() : null;
  const ruheHTML = t.ruhe ? `<div class="ruhe-karte">${ps ? `<b>${tx('heute.pause_bis', { bis: tagLang(ps.bis) })}</b><p>${tx('heute.kein_wird_keine_fehlerwiederholung', { a: P.kette.n ? tx('heute.deine_kette_von_tagen_wartet_und_laeuft', { n: P.kette.n }) : tx('heute.danach_geht_es_dort_weiter_wo_du') })}</p>`
      : `<b>${tx('heute.heute_ist_ruhetag')}</b><p>${tx('heute.dein_wird_ruht_heute', { a: P.kette.n ? tx('heute.deine_kette_laeuft_am_naechsten_wird_tag') : '' })}</p>`}
    <div class="reihe" style="margin-top:12px"><button class="knopf haupt klein" id="trotzdem">${tx('heute.trotzdem_ueben')}</button>${ps ? `<button class="knopf leise klein" id="pause-ende">${tx('heute.pause_beenden')}</button>` : ''}</div></div>` : '';
  let unter = t.ruhe ? (ps ? tx('heute.du_machst_gerade_eine_pause') : tx('heute.heute_ist_dein_ruhetag')) : t.voll ? tx('heute.dein_wird_fuer_heute_ist_vollbracht') : tx('heute.dein_wird_fuer_heute_noch_abschnitte', { a: pflicht.length - erledigt });
  const karten = t.plan.map((id, i) => {
    const e = D.A[id], fertig = t.fertig.includes(id), jetzt = !fertig && id === offen[0];
    const art = t.art[id];
    const zwh = Z.zwischenstandLaden(id, art === 'bonus' ? 'bonus' : ''), angefangen = !fertig && zwh?.erg?.length ? `<span class="marke-art angefangen">${tx('heute.angefangen')} · ${zwh.erg.length}/${e.ayat}</span>` : '';
    const marke = angefangen + (art === 'fehler' ? `<span class="marke-art fehler">${tx('allg.wiederholung_nach_fehler')}</span>` : art === 'qadaa' ? `<span class="marke-art qadaa">${tx('heute.qada')}</span>` : art === 'festigen' ? `<span class="marke-art festigen">${tx('allg.festigen')}</span>` : art === 'bonus' ? `<span class="marke-art bonus">${tx('allg.bonus')}</span>` : art === 'zyklus' ? `<span class="marke-art umlauf">${P.einst.rhythmus === 'langzeit' && Z.karte(id).n > 0 ? tx('heute.faellig') : tx('heute.runde')}</span>` : '');
    return `<a class="karte ${fertig ? 'fertig' : ''} ${jetzt ? 'jetzt' : ''}" href="#ueben/${id}" style="text-decoration:none;color:inherit">
      <div class="nr">${fertig ? '✓' : i + 1}</div><div class="t"><b>${esc(e.titel)}</b><span>${abschnittMarke(e)} · ${bereichText(e)} · ${tx('allg.zeilen', { zeilen: e.zeilen })} ${marke}</span></div>${stufePunkte(Z.karte(id).st)}</a>`;
  }).join('');
  const bonusId = t.voll ? Z.bonusVorschlag() : null;
  const woche = Z.letzteTage(7).map(x => x.t).filter(Boolean);
  const wSum = woche.reduce((s, x) => ({ r: s.r + x.r, f: s.f + x.f, h: s.h + x.h, p: s.p + x.punkte, v: s.v + (x.voll ? 1 : 0) }), { r: 0, f: 0, h: 0, p: 0, v: 0 });
  // ÜBERGANG bis zum Launch mit eigenem Server und App-Store: Erinnerung an die Sicherung und die Karte zum Installieren
  // entfallen dann (Daten liegen auf dem Server, die App kommt aus dem Store). „Profil sichern“ bleibt als freiwillige Funktion.
  // Erinnerung an die Sicherung: 7 Tage nach der letzten (oder nach dem Anlegen), höchstens einmal am Tag wegklickbar
  const seitSicherung = Z.tageZwischen((P.einst.letzteSicherung || P.erstellt).slice(0, 10), Z.heute());
  let spaeter = null; try { spaeter = localStorage.getItem('itqan-sicherung-spaeter'); } catch (e) {}
  const sicherungFaellig = UEBERGANG.sicherungErinnern && seitSicherung >= 7 && P.summe.abschnitte > 0 && spaeter !== Z.heute();
  let installWeg = null; try { installWeg = localStorage.getItem('itqan-install-weg'); } catch (e) {}
  const installKarte = UEBERGANG.installieren && !istInstalliert() && istTouch() && !installWeg;
  const comebackHTML = t.cb && t.plan.length < Z.pensumAm(Z.heute()) ? `<div class="hinweisbox"><b>${tx('heute.comeback_titel')}</b><p style="margin-top:4px">${tx('heute.comeback_text')}</p><div class="reihe" style="margin-top:8px"><button class="knopf leise klein" id="comeback-voll">${tx('heute.comeback_voll')}</button></div></div>` : '';
  // Neu lernen: offene Lektionen (Ḥifẓ, Ḍabṭ) stehen unter dem Wird; ohne Lektion und ohne freien Abschnitt entfällt der Block
  const lekt = Z.lektionen();
  const lernHTML = lekt.length || Z.lernVorschlag() != null ? `<div class="titel-klein"><a href="#lernen" style="color:inherit">${tx('lernen.neu_lernen')}</a></div>${lekt.map(lektionKarte).join('')}
    <div class="klein-zeile" style="justify-content:center"><a class="textlink" href="#lernen">${lekt.length ? tx('lernen.alle_lektionen') : tx('lernen.erste_lektion')}</a></div>` : '';
  app.innerHTML = `
    <div class="kopfzeile"><div class="marke">${tx('allg.itqan')}<small>${datumText()}</small></div>
      <a class="pille kette-pille" href="#profil" style="text-decoration:none;color:inherit" title="${tx('heute.tage_in_folge')}" aria-label="${tx('heute.kette_tage_in_folge_zum_profil', { a: aktiv ? P.kette.n : 0 })}">${lampeKlein}${aktiv ? P.kette.n : 0}</a></div>
    <h2 class="gruss">${tx('heute.assalamu_alaikum', { a: P.name ? komma() + esc(P.name) : '' })}</h2><p class="unter">${unter}</p>${comebackHTML}
    ${sicherungFaellig ? `<div class="hinweisbox sicherung-hinweis">${tx('heute.sichere_dein_profil_deine_fortschritte', { a: P.einst.letzteSicherung ? tx('heute.die_letzte_sicherung_ist_tage_her', { seitSicherung }) : tx('heute.du_hast_dein_profil_noch_nie_gesichert') })}
      <div class="reihe" style="margin-top:10px"><button class="knopf haupt klein" id="jetzt-sichern">${tx('heute.jetzt_sichern')}</button><button class="knopf leise klein" id="sichern-spaeter">${tx('heute.morgen_erinnern')}</button></div></div>` : ''}
    ${installKarte ? `<div class="hinweisbox install-hinweis">${tx('heute.itqan_als_app_nutzen_auf_dem_home')}
      <div class="reihe" style="margin-top:10px"><a class="knopf haupt klein" href="#installieren" style="text-decoration:none">${tx('heute.so_gehts')}</a><button class="knopf leise klein" id="install-weg">${tx('heute.nicht_mehr_zeigen')}</button></div></div>` : ''}
    ${t.qadaa && !t.voll ? `<div class="hinweisbox">${tx('heute.qada_ist_dein_wird_ausgefallen_holst_du', { qadaaTag: qadaaTag(), n: P.kette.n })}</div>` : ''}
    ${t.ruhe ? ruheHTML : `<div class="ring"><svg width="210" height="210" viewBox="0 0 210 210" aria-hidden="true">
      <defs><linearGradient id="verlauf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--akzent)"/><stop offset="1" stop-color="var(--akzent2)"/></linearGradient></defs>
      <circle cx="105" cy="105" r="88" fill="none" stroke="var(--rand)" stroke-width="10"/>
      <circle class="fort" cx="105" cy="105" r="88" fill="none" stroke="url(#verlauf)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${U}" stroke-dashoffset="${U}"/>
      <circle cx="105" cy="105" r="74" fill="none" stroke="var(--rand)" stroke-width="1" stroke-dasharray="2 6"/></svg>
      <div class="mitte"><span class="gross" aria-label="${tx('heute.von', { erledigt, n: pflicht.length })}">${erledigt}<span>/${pflicht.length}</span></span><span class="klein">${tx('allg.abschnitte')}</span></div></div>
    <div class="zahlen"><div class="zahl"><b>${aktiv ? P.kette.n : 0}</b><span>${tx('heute.tage_kette')}</span></div>
      ${Z.P.einst.hasanat === false ? '' : `<div class="zahl"><b>${zahl(t.hasanat)}</b><span>${tx('heute.hasanat_heute')}</span></div>`}
      <div class="zahl"><b>${quote == null ? '·' : prozent(quote)}</b><span>${tx('allg.ayat_sicher')}</span></div></div>
    ${t.voll && bonusId != null ? `<div class="angebot"><b>${tx('heute.allahumma_barik_noch_kraft_fuer_mehr')}</b><p>${tx('heute.ein_bonusabschnitt_bringt_dir_50_mehr', { abschnittName: abschnittName(D.A[bonusId]), titel: esc(D.A[bonusId].titel) })}</p><button id="bonus">${tx('heute.bonusabschnitt_beginnen')}</button></div>` : ''}
    <div class="titel-klein">${tx('heute.heute_dran')}</div>${karten}
    ${Z.heuteAbhakbar().length ? `<div class="klein-zeile" style="justify-content:center"><a class="textlink" href="#abhaken">${tx('heute.abhaken_link')}</a></div>` : ''}`}
    <div class="kurz-angebot"><div class="titel-klein">${tx('heute.zusaetzlich')}</div>
      <a class="karte kurz-heute" href="#kurz"><div class="t"><b>${tx('kurz.titel')}</b><span>${tx('kurz.untertitel')}</span></div><span class="pfeil">›</span></a></div>
    ${lernHTML}
    ${istFreitag ? `<div class="titel-klein">${tx('heute.gumua_mubaraka')} · ${tx('heute.deine_woche')}</div><div class="abschnitt" style="margin-top:0">
      <p>${tx('heute.der_ayat_sicher', { a: wSum.r + wSum.f + wSum.h ? Math.round(100 * (wSum.r + wSum.h * .5) / (wSum.r + wSum.f + wSum.h)) : 0 })} · ${tx('heute.von_7_tagen_erfuellt', { v: wSum.v })} · ${tx('heute.itqan_punkte', { p: zahl(wSum.p) })}</p>
      ${(() => { const bq = Z.behaltensquote(30); return bq.quote == null ? '' : `<p class="unter">${tx('heute.behaltensquote', { a: prozent(Math.round(bq.quote)), ziel: prozent(bq.ziel) })}</p>`; })()}
      <p class="unter" style="margin-top:6px">${tx('heute.eine_neue_woche_ist_ein_guter_neuanfang', { a: Z.schwaechste(1)[0] ? tx('heute.schwaechster_abschnitt_gerade', { abschnittName: abschnittName(D.A[Z.schwaechste(1)[0].id]), titel: esc(D.A[Z.schwaechste(1)[0].id].titel) }) : '' })}</p></div>` : ''}
    <div class="titel-klein">${tx('heute.hatma', { a: P.zyklus.khatma + 1 })}</div>
    <div class="balken"><div style="width:${(kf.anteil * 100).toFixed(1)}%"></div></div>
    <div class="klein-zeile"><span>${tx('heute.von_abschnitten', { fertig: kf.fertig, gesamt: kf.gesamt })}</span><span>${prozent(Math.floor(kf.anteil * 100))}</span></div>
    <div class="titel-klein"><a href="#karte" style="color:inherit">${tx('allg.lichtkarte')} · ${tx('heute.30_guz')}</a></div>
    <a class="licht-mini" href="#karte" aria-label="${tx('heute.lichtkarte_oeffnen_30_guz_je_heller')}">${Lk.juzMittel().map((x, i) =>
      `<span aria-hidden="true" class="${x == null ? 'aus' : x >= 2.5 ? 'voll' : ''}"${x != null ? ` data-k="${Math.round(x)}"` : ''}>${i + 1}</span>`).join('')}</a>`;
  requestAnimationFrame(() => setTimeout(() => app.querySelector('circle.fort')?.setAttribute('stroke-dashoffset', U * (1 - anteil)), 60));
  const tz = app.querySelector('#trotzdem'); if (tz) tz.onclick = () => { Z.trotzdemUeben(); heute(); };
  const cbv = app.querySelector('#comeback-voll'); if (cbv) cbv.onclick = () => { Z.comebackBeenden(); heute(); };
  const pe = app.querySelector('#pause-ende'); if (pe) pe.onclick = () => { Z.pauseBeenden(); toast(tx('heute.die_pause_ist_beendet_willkommen_zurueck')); heute(); };
  const b = app.querySelector('#bonus'); if (b) b.onclick = () => location.hash = `#ueben/${bonusId}/bonus`;
  const js = app.querySelector('#jetzt-sichern'); if (js) js.onclick = async () => { if (await profilSichern()) heute(); };
  const sp = app.querySelector('#sichern-spaeter'); if (sp) sp.onclick = () => { try { localStorage.setItem('itqan-sicherung-spaeter', Z.heute()); } catch (e) {} heute(); };
  const iw = app.querySelector('#install-weg'); if (iw) iw.onclick = () => { try { localStorage.setItem('itqan-install-weg', '1'); } catch (e) {} heute(); };
}

// Datum ausgeschrieben, z. B. „Freitag, 20. November“
const tagLang = d => new Date(d + 'T12:00').toLocaleDateString(gebiet('datum'), { weekday: 'long', day: 'numeric', month: 'long' });
// welcher Wird-Tag für das Qaḍāʾ ausgefallen ist
function qadaaTag() {
  const w = Z.vorigerWirdTag(Z.heute());
  return w === Z.plusTage(Z.heute(), -1) ? tx('qadaatag.gestern') : tx('qadaatag.am', { a: TAGE[Z.wochentag(w)] });
}

// ---------- Doppelseite auf PC und Tablet ----------
// Überall, wo der Muṣḥaf erscheint, zeigen PC und Tablet die aufgeschlagene Doppelseite (ungerade Seite rechts, gerade links).
// Als Handy gilt ein Gerät, dessen kürzere Bildschirmseite unter 600 px liegt; es bleibt einseitig.
const doppelseitig = () => Math.min(screen.width, screen.height) >= 600 && innerWidth >= 700;
const paarVon = p => (p % 2 ? [p, p + 1] : [p - 1, p]).filter(x => x >= 1 && x <= 604);
// Seiten zu ganzen Doppelseiten ergänzen und paarweise gruppieren
function doppelseiten(seiten) {
  const paare = new Map();
  for (const x of [...new Set(seiten.flatMap(paarVon))].sort((a, b) => a - b)) { const r = x % 2 ? x : x - 1; if (!paare.has(r)) paare.set(r, []); paare.get(r).push(x); }
  return [...paare.values()];
}
// Vergrößerte Seite (125 oder 150 %): Der Ausschnitt beginnt am rechten Rand. Die gemeinte Seite schiebt sich ganz in den Blick,
// wenn sie in den Ausschnitt passt. Ist sie breiter, entscheidet das einzelne Wort (sichtbar beim Üben).
function seiteHolen(roller, el) {
  const s = el?.closest?.('.seite');
  if (!roller || !s || roller.scrollWidth <= roller.clientWidth + 1) return;
  const R = roller.getBoundingClientRect(), r = s.getBoundingClientRect();
  if (r.width > R.width) return;
  const dx = r.left < R.left ? r.left - R.left - 4 : r.right > R.right ? r.right - R.right + 4 : 0;
  if (dx) roller.scrollBy({ left: dx, behavior: 'auto' });
}
const paarHTML = (seiten, opt) => `<div class="paar">${seiten.map(x => seiteHTML(x, typeof opt === 'function' ? opt(x) : opt)).join('')}</div>`;
let warDoppelt = null;
addEventListener('resize', () => {
  const d = doppelseitig(); if (warDoppelt === null) { warDoppelt = d; return; }
  if (d !== warDoppelt) { warDoppelt = d; if (document.body.dataset.ansicht === 'mushaf' && !document.body.classList.contains('im-vollbild')) zeige(); }
});

// Kleine Doppelseite für die Einblendung: Zeilen des Abschnitts markiert, ungerade Seite rechts
function doppelseiteSkizze(e) {
  const erste = Math.min(...e.seiten), letzte = Math.max(...e.seiten);
  const von = erste % 2 ? erste : erste - 1, bis = Math.min(604, letzte % 2 ? letzte + 1 : letzte);
  const seiten = []; for (let x = von; x <= bis; x++) if (x >= 1) seiten.push(x);
  const seite = x => `<div class="sk-seite ${x % 2 ? 'r' : 'l'}${e.seiten.includes(x) ? ' hier' : ''}">${D.L[x - 1].map(z => {
      if (!z) return '<i class="leer"></i>';
      if (z.kopf) return '<i class="kopf"></i>';
      if (z.basmala) return '<i class="bas"></i>';
      return `<i class="${z.w.some(w => w[1] >= e.v[0] && w[1] <= e.v[1]) ? 'an' : ''}"></i>`;
    }).join('')}<span>${x}</span></div>`;
  // je Doppelseite ein Paar, rechts die ungerade Seite
  const paare = []; for (let x = von; x <= bis; x += 2) paare.push(`<div class="sk-paar">${seite(x)}${x + 1 <= 604 ? seite(x + 1) : ''}</div>`);
  return `<div class="skizze">${paare.join('')}</div>`;
}

// ---------- Üben ----------
const zurueckPfeil = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
async function ueben(idText, quelle, fokusText) {
  navSetzen(null);
  const id = +idText; let e = D.A[id]; if (!e) { location.hash = '#heute'; return; }
  // Fehlerstelle üben: nur diese eine Āya, mit der Āya davor als Orientierung
  if (quelle === 'stelle') {
    const fv = +fokusText; if (!(fv >= e.v[0] && fv <= e.v[1])) { location.hash = '#fehlerstellen'; return; }
    e = { ...e, v: [fv, fv], von: [D.V[fv][0], D.V[fv][1]], bis: [D.V[fv][0], D.V[fv][1]], ayat: 1, seiten: [...new Set(ayaWoerter(fv).map(x => x[5]))].sort((a, b) => a - b) };
  }
  // Kurzübung (siehe abfragen.js): eine oder wenige Āyāt aus dem Abschnitt mit eigenem Hinweis, ohne Wirkung auf Stufe und Karte
  const ABF = quelle === 'abfrage' ? (([av, ab, ac, ak, an]) => ({ von: +av, bis: +ab, ctx: ac === '1', art: ak, n: +an }))(String(fokusText).split('_')) : null;
  if (ABF) {
    if (!(ABF.von >= 0 && ABF.bis >= ABF.von && ABF.bis < D.V.length)) { location.hash = '#kurz'; return; }
    e = { ...e, v: [ABF.von, ABF.bis], von: [D.V[ABF.von][0], D.V[ABF.von][1]], bis: [D.V[ABF.bis][0], D.V[ABF.bis][1]], ayat: ABF.bis - ABF.von + 1,
      seiten: [...new Set(Array.from({ length: ABF.bis - ABF.von + 1 }, (_, i) => ayaWoerter(ABF.von + i)).flat().map(x => x[5]))].sort((a, b) => a - b) };
  }
  const abfrageTitel = () => ABF.art === 'seite' ? tx('ueben.abfrage_seite', { n: ABF.n }) : ABF.art === 'juz' ? tx('ueben.abfrage_juz', { n: ABF.n }) : ABF.art === 'uebergang' ? tx('ueben.abfrage_uebergang') : ABF.art === 'mitte' ? tx('ueben.abfrage_mitte') : tx('ueben.abfrage_titel', { titel: esc(D.A[ABF.n]?.titel || '') });
  app.innerHTML = `<div class="lade">${tx('ueben.seiten_werden_geladen')}</div>`;
  const E = Z.P.einst, t = Z.tagesplan(), art = ABF ? 'stelle' : quelle || t.art[id];
  // Neu lernen: die offene Lektion dieses Abschnitts (ph 0 Ḥifẓ, 1 Ḍabṭ)
  const L = quelle === 'lern' ? Z.lektionen().find(x => x.id === id) : null;
  if (quelle === 'lern' && !L) { location.replace('#lernen'); return; }
  // Bei Zufall und Fehlerwiederholung: die Āya davor deutlich zeigen, damit man weiß, wo man ist
  const vorVi = e.v[0] - 1;
  const kontext = vorVi >= 0 && e.von[1] > 1 && (E.reihenfolge === 'zufall' || art === 'fehler' || (art === 'stelle' && (!ABF || ABF.ctx)) || L?.ph === 1);   // im Ḍabṭ: Einsatz aus der Āya davor
  const kWoerter = kontext ? ayaWoerter(vorVi) : [];
  const kSeiten = [...new Set(kWoerter.map(x => x[5]))];
  const dop = doppelseitig(), gezeigt = dop ? doppelseiten(e.seiten) : e.seiten.map(x => [x]), alleSeiten = gezeigt.flat();
  const kBox = kontext && kSeiten.some(p => !alleSeiten.includes(p));
  document.body.classList.toggle('doppelt', dop);
  await Promise.all([schriftenLaden(alleSeiten), ...kWoerter.map(x => schrift(x[4]))]);
  const k = Z.karte(id);
  const ayat = []; for (let v = e.v[0]; v <= e.v[1]; v++) ayat.push(v);
  const zu = new Set(ayat), alt = new Set(k.fa || []), status = new Map(), erg = [];
  if (ABF && ['seite', 'juz', 'titel'].includes(ABF.art)) for (const p of e.seiten) for (const z of D.L[p - 1]) if (z?.w) for (const w of z.w) zu.add(w[1]);   // ganze Seite verdeckt
  let pos = 0, offen = false, hilfe = false, ti = 0, teile = [], markieren = false, fArt = null, vorschau = false, hilfeFrei = false;
  // liste: die Āyāt der laufenden Runde (Hauptrunde oder Sofortkorrektur); verlauf: bewertete Āyāt zum Zurücknehmen
  let liste = ayat, phase = 'haupt', korr = [], verlauf = [], fsVorher = null, abhoeren = false;
  let ganz = E.ablauf === 'ganz' && art !== 'stelle' && !ABF && !L, zg = new Set();   // Ablauf „ganzer Abschnitt am Stück“ (Einstellungen)
  // Übungszeit für die Auswertung: zählt nur, solange die Seite sichtbar ist; fortgesetzte Übungen werden nicht gemessen
  let zeitAktiv = 0, zeitSeit = document.hidden ? null : Date.now(), zeitGanz = true;
  const zeitTick = () => { if (document.hidden) { if (zeitSeit) zeitAktiv += Date.now() - zeitSeit; zeitSeit = null; } else if (!zeitSeit) zeitSeit = Date.now(); };
  const zeitSekunden = () => { zeitTick(); return Math.min(3600, (zeitAktiv + (zeitSeit ? Date.now() - zeitSeit : 0)) / 1000); };
  document.addEventListener('visibilitychange', zeitTick);
  addEventListener('hashchange', () => document.removeEventListener('visibilitychange', zeitTick), { once: true });
  // Aufnahme nur im Arbeitsspeicher: nach der Bewertung der Āya wird sie verworfen, nichts wird gespeichert
  const AUFNAHME = typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  // Jede Aufnahme hat ihren eigenen Rekorder und ihre eigenen Daten. Eine Aufnahme, deren Āya schon bewertet ist
  // oder die von einer neuen abgelöst wurde, wird verworfen (Nummer passt nicht mehr).
  let mikro = null, rec = null, aufnahme = null, spieler = null, aufnahmeNr = 0, startet = false;
  // iPhone: Nach dem Abspielen schaltet Safari das Mikrofon oft stumm, dann liefert es nur noch leere Aufnahmen
  const mikroLebt = () => !!mikro && mikro.getAudioTracks().some(t => t.readyState === 'live' && !t.muted);
  async function aufnahmeStart() {
    if (startet || rec?.state === 'recording') return;
    startet = true; aufnahmeVerwerfen();   // eine neue Aufnahme ersetzt die vorige
    try { if (!mikroLebt()) { mikro?.getTracks().forEach(t => t.stop()); mikro = await navigator.mediaDevices.getUserMedia({ audio: true }); } }
    catch (e) { startet = false; mikro = null; toast(tx('ueben.ohne_zugriff_auf_das_mikrofon_geht_keine')); return; }
    if (offen || pos >= ayat.length) { startet = false; return; }   // inzwischen aufgedeckt
    const nr = ++aufnahmeNr, daten = [];
    let r;
    try { r = new MediaRecorder(mikro); } catch (e) { startet = false; toast(tx('ueben.die_aufnahme_liess_sich_nicht_starten')); return; }
    r.ondataavailable = ev => { if (ev.data?.size) daten.push(ev.data); };
    r.onstop = () => {
      if (nr !== aufnahmeNr) return;
      if (rec === r) rec = null;
      mikroFrei();
      if (daten.length) { aufnahmeWeg(); aufnahme = URL.createObjectURL(new Blob(daten, { type: r.mimeType || daten[0].type || 'audio/mp4' })); }
      else toast(tx('ueben.die_aufnahme_ist_leer_geblieben_bitte'));
      zeichne();
    };
    rec = r; startet = false;
    r.start(1000);   // Daten jede Sekunde abholen, damit beim Beenden nichts verloren geht
    zeichne();
  }
  const aufnahmeStopp = () => { if (rec?.state === 'recording') rec.stop(); };
  function aufnahmeWeg() { spieler?.pause(); spieler = null; if (aufnahme) URL.revokeObjectURL(aufnahme); aufnahme = null; }
  // laufende und fertige Aufnahme verwerfen (nach der Bewertung oder vor einer neuen Aufnahme)
  function aufnahmeVerwerfen() { aufnahmeNr++; if (rec?.state === 'recording') rec.stop(); rec = null; aufnahmeWeg(); mikroFrei(); }
  // Das Mikrofon ist nur während einer Aufnahme offen. Sonst zeigt das iPhone beim App-Wechsel eine laufende Aufnahme an.
  function mikroFrei() { mikro?.getTracks().forEach(t => t.stop()); mikro = null; }
  function mikroAus() { aufnahmeVerwerfen(); document.removeEventListener('visibilitychange', imHintergrund); }
  // App wechselt in den Hintergrund: laufende Aufnahme beenden (sie bleibt zum Anhören) und Mikrofon freigeben
  function imHintergrund() { if (!document.hidden) return; if (rec?.state === 'recording') aufnahmeStopp(); else mikroFrei(); }
  document.addEventListener('visibilitychange', imHintergrund);
  addEventListener('hashchange', mikroAus, { once: true });
  const zusatz = art === 'bonus' ? ` · ${tx('allg.bonus')}` : art === 'fehler' ? ` · ${tx('allg.wiederholung_nach_fehler')}` : art === 'festigen' ? ` · ${tx('allg.festigen')}` : '';
  app.innerHTML = `<div class="ueb-kopf"><button class="zurueck" id="zurueck" aria-label="${tx('allg.zurueck')}">${zurueckPfeil}</button>
      <div class="info">${ABF ? `<b>${abfrageTitel()}</b>${['uebergang', 'mitte'].includes(ABF.art) ? ` · ${e.von[0]}:${e.von[1]}` : ''}` : art === 'stelle' ? `<b>${tx('ueben.fehlerstelle')}</b> · ${e.von[0]}:${e.von[1]}` : `${bereichText(e)} · ${tx('ueben.ayat', { ayat: e.ayat })} · ${tx('allg.zeilen', { zeilen: e.zeilen })}`} · ${tx('ueben.s')} ${e.seiten.map(p => `${p}<button class="seitenlage klein" data-lage="${p}" aria-label="${tx('ueben.seite_seite', { p, a: p % 2 ? tx('allg.rechte') : tx('allg.linke') })}">${p % 2 ? tx('ueben.r') : tx('ueben.l')}</button>`).join(' ')}</div></div>
    <div class="hinweisbox lageinfo verdeckt" id="lageinfo" style="margin:0 4px 10px"></div>
    ${kBox ? `<div class="kontext"><span>${tx('ueben.davor')} · ${D.V[vorVi][0]}:${D.V[vorVi][1]}</span><div class="kz">${kWoerter.map(([, vi, , i]) => wortHTML(vi, i)).join('')}</div></div>` : ''}
    <div class="seiten roller" id="seiten"></div><div class="nur-leser" id="ansage" aria-live="polite" lang="ar" dir="rtl"></div><div style="height:190px"></div>
    <div class="steuerung"><div class="innen"><div class="fort-zeile"><div class="punkte" id="punkte"></div><span class="zaehler" id="zaehler"></span></div><div class="arten verdeckt" id="arten"></div><div class="reihe" id="knoepfe"></div>
    <div class="zeile2"><span class="unter" id="hinweis"></span></div></div></div>
    ${art === 'stelle' ? '' : `<div class="einblendung" id="einbl"><div><div class="ueber">${e.nr ? tx('ueben.von', { sureName: sureName(e.von[0]), nr: e.nr, von_n: e.von_n }) : abschnittName(e)}${zusatz}</div><h2>${esc(e.titel)}</h2>
      <div class="ar">${sureArabisch(e.von[0])}</div>${doppelseiteSkizze(e)}</div></div>`}`;
  const einbl = app.querySelector('#einbl');
  if (einbl) {
    const einblWeg = () => { if (!einbl.isConnected) return; einbl.classList.add('weg'); setTimeout(() => einbl.remove(), 350); };
    einbl.addEventListener('animationend', ev => { if (ev.target === einbl) einbl.remove(); });
    einbl.onclick = einblWeg;
  }
  const seitenEl = app.querySelector('#seiten');
  const sOpt = { von: e.v[0], bis: e.v[1], zu, alt, klar: kontext ? new Set([vorVi]) : undefined, fst: Z.fehlerstellenSet(), wahl: true };
  seitenEl.classList.toggle('doppel', dop);
  seitenEl.innerHTML = dop ? gezeigt.map(g => paarHTML(g, sOpt)).join('') : e.seiten.map(p => seiteHTML(p, sOpt)).join('');
  zeilenEinpassen(seitenEl);
  app.querySelector('#zurueck').onclick = () => history.length > 1 ? history.back() : (location.hash = '#heute');
  const lage = app.querySelector('#lageinfo');
  app.querySelector('.ueb-kopf .info').onclick = ev => {
    const b = ev.target.closest('[data-lage]'); if (!b) return;
    const zu = !lage.classList.contains('verdeckt') && lage.dataset.p === b.dataset.lage;
    lage.classList.toggle('verdeckt', zu);
    if (!zu) { lage.dataset.p = b.dataset.lage; lage.innerHTML = lageInfo(+b.dataset.lage); }
  };
  const spans = vi => [...seitenEl.querySelectorAll(`.w[data-v="${vi}"]`)];
  const K = app.querySelector('#knoepfe'), H = app.querySelector('#hinweis'), A = app.querySelector('#arten'), Zl = app.querySelector('#zaehler');
  // Āya in Teile bis zum jeweils nächsten Stoppzeichen zerlegen (Lā zählt nicht als Halt)
  function teileVon(vi) {
    const aus = [[]];
    for (const s of spans(vi)) { aus[aus.length - 1].push(s); if (s.querySelector('.wq:not(.la)')) aus.push([]); }
    while (aus.length > 1 && aus[aus.length - 1].length <= 1) { const rest = aus.pop(); aus[aus.length - 1].push(...rest); }
    return aus;
  }
  function sichtbar(el) {
    if (!el) return; seiteHolen(seitenEl, el); const r = el.getBoundingClientRect();
    if (r.top < 70 || r.bottom > innerHeight - 210) { el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: ruhig() ? 'auto' : 'smooth' }); return; }
    // vergrößerte Seite (125 oder 150 %): liegt das Wort seitlich außerhalb, schiebt sich die Seite dorthin
    if (seitenEl.scrollWidth > seitenEl.clientWidth + 1) {
      const sr = seitenEl.getBoundingClientRect(), dx = r.left < sr.left + 8 ? r.left - sr.left - 24 : r.right > sr.right - 8 ? r.right - sr.right + 24 : 0;
      if (dx) seitenEl.scrollBy({ left: dx, behavior: ruhig() ? 'auto' : 'smooth' });
    }
  }
  // Für Bildschirmleser: die aufgedeckte Āya wird als Text angesagt (die Seite selbst besteht aus Schriftzeichen ohne lesbaren Text)
  const ansage = app.querySelector('#ansage');
  const ansagen = vi => S.textLaden().then(T => { if (ansage.isConnected) ansage.textContent = `${D.V[vi][0]}:${D.V[vi][1]} ${T.u[vi].join(' ')}`; }).catch(() => {});
  // ---------- Erklärung beim ersten Üben: drei Etappen, jede beim ersten Mal, wenn sie gebraucht wird ----------
  // 1 vor dem ersten Aufdecken, 2 nach dem ersten Aufdecken (Bewerten), 3 nach dem ersten „Fehler“ (Stelle markieren)
  const imAbschnitt = () => [...(seitenEl.querySelector('.seite') || seitenEl).querySelectorAll('.w.in')];
  const jetzt = () => spans(liste[pos]);
  const TOUR = {
    'ueben-1': () => [
      { titel: tx('ueben.deine_erste_uebung'), text: tx('ueben.willkommen_so_laeuft_jede_uebung_ab_du') },
      { ziel: imAbschnitt, titel: tx('ueben.dein_abschnitt'), text: tx('ueben.die_ayat_deines_abschnitts_sind_verdeckt') },
      { ziel: () => [...seitenEl.querySelectorAll('.w.naechste')].slice(0, 12), titel: tx('ueben.diese_aya_ist_dran'), text: tx('ueben.die_aya_die_du_jetzt_rezitierst_ist') },
      { ziel: () => { const k = [...seitenEl.querySelectorAll('.w.klar')]; return k.length ? k : null; }, titel: tx('ueben.die_aya_davor'), text: tx('ueben.die_aya_vor_deinem_abschnitt_ist_hell') },
      { ziel: () => { const v = [...seitenEl.querySelectorAll('.w.vor, .w.nach')].slice(0, 30); return v.length ? v : null; }, titel: tx('ueben.der_rest_der_seite'), text: tx('ueben.text_vor_deinem_abschnitt_ist_blass_text') },
      { ziel: () => app.querySelector('.fort-zeile'), titel: tx('ueben.dein_fortschritt'), text: tx('ueben.jeder_punkt_ist_eine_aya_des_abschnitts') },
      { ziel: () => app.querySelector('#mikro'), titel: tx('ueben.dich_selbst_aufnehmen'), text: tx('ueben.freiwillig_tippe_auf_den_punkt_und') },
      { ziel: () => app.querySelector('#teil'), titel: tx('ueben.bis_zum_zeichen'), text: tx('ueben.deckt_die_aya_nur_bis_zum_naechsten') },
      { ziel: () => app.querySelector('#auf'), titel: tx('ueben.aufdecken'), text: tx('ueben.deckt_die_ganze_aya_auf_du_kannst_auch') },
      { ziel: () => app.querySelector('#hilfe'), titel: tx('ueben.erstes_wort'), text: tx('ueben.wenn_du_nicht_weisst_wie_die_aya_beginnt') },
      { ziel: () => app.querySelector('#ansehen'), titel: tx('ueben.erst_ansehen'), text: tx('ueben.du_kannst_den_abschnitt_auch_zuerst') },
      { ziel: () => app.querySelector('.ueb-kopf .info'), titel: tx('ueben.wo_du_bist'), text: tx('ueben.oben_stehen_bereich_zahl_der_ayat_und') },
      { titel: tx('ueben.jetzt_du'), text: tx('ueben.rezitiere_die_erste_aya_aus_dem'), los: tx('ueben.los_gehts') }
    ],
    'ueben-2': () => [
      { ziel: jetzt, titel: tx('ueben.vergleichen'), text: tx('ueben.jetzt_siehst_du_die_aya_vergleiche_wort') },
      { ziel: () => app.querySelector('#hoeren'), titel: tx('ueben.anhoeren'), text: tx('ueben.hier_hoerst_du_deine_aufnahme_danach') },
      { ziel: () => app.querySelector('#z'), titel: tx('ueben.gezoegert'), text: tx('ueben.gezoegert_hinweis') },
      { ziel: () => app.querySelector('#r'), titel: tx('ueben.richtig'), text: tx('ueben.die_aya_war_fehlerfrei_und_ohne_stocken') },
      { ziel: () => app.querySelector('#f'), titel: tx('allg.fehler'), text: tx('ueben.ein_wort_verwechselt_oder_ausgelassen'), los: tx('ueben.verstanden') }
    ],
    'ueben-3': () => [
      { ziel: jetzt, titel: tx('ueben.die_stelle_markieren'), text: tx('ueben.tippe_auf_das_wort_bei_dem_du_dich') },
      { ziel: () => app.querySelector('#arten'), titel: tx('ueben.was_ist_passiert'), text: tx('ueben.waehle_wenn_du_moechtest_die_art_des') },
      { ziel: () => app.querySelector('#weiter'), titel: tx('allg.weiter'), text: tx('ueben.speichert_die_markierten_woerter_und') },
      { titel: tx('ueben.deine_fehlerstellen'), text: tx('ueben.alle_markierten_woerter_sammelt_itqan') }
    ]
  };
  let tourAktiv = false;
  function tourPruefen() {
    if (tourAktiv || vorschau || abhoeren || ganz || phase !== 'haupt' || pos >= liste.length) return;
    const name = markieren ? 'ueben-3' : offen ? 'ueben-2' : pos === 0 && ti === 0 ? 'ueben-1' : null;
    if (!name || tourGesehen(name)) return;
    tourAktiv = true;
    const los = () => {
      if (!seitenEl.isConnected) { tourAktiv = false; return; }
      if (document.querySelector('#einbl')) return setTimeout(los, 250);   // erst wenn die Einblendung weg ist
      tourMerken(name);
      fuehrung(TOUR[name]()).then(() => { tourAktiv = false; });
    };
    setTimeout(los, name === 'ueben-1' ? 300 : 450);   // kurz warten, bis Knöpfe und Abspielknopf stehen
  }
  function zeichne() { zeichneInnen(); wahlSetzen(); seitenText(seitenEl, vorschau ? new Set() : zu); tourPruefen(); }
  // ---------- Fehlerwort mit Tastatur und Bildschirmleser ----------
  // Nach „Fehler“ sind die Wörter der Āya Knöpfe mit ihrem Wortlaut, beim Abhören alle Wörter des Abschnitts.
  // Ein Wort ist mit Tab erreichbar, die Pfeiltasten gehen von Wort zu Wort (links und unten = weiter im Text).
  const wahlWoerter = () => !seitenEl.isConnected ? [] : abhoeren ? [...seitenEl.querySelectorAll('.w.in')] : markieren ? spans(liste[pos]) : [];
  function wahlSetzen() {
    const ws = wahlWoerter(), drin = new Set(ws);
    let fokusWeg = false;
    for (const w of seitenEl.querySelectorAll('.w[role=button]')) if (!drin.has(w)) {
      if (w === document.activeElement) fokusWeg = true;
      for (const a of ['role', 'tabindex', 'aria-pressed', 'aria-label', 'lang']) w.removeAttribute(a);
      w.setAttribute('aria-hidden', 'true'); delete w.dataset.wl;
    }
    for (const w of ws) {
      if (w.getAttribute('role') !== 'button') { w.setAttribute('role', 'button'); w.removeAttribute('aria-hidden'); w.tabIndex = -1; }
      if (!w.dataset.wl) {
        const vi = +w.dataset.v, t = wortText(vi, +w.dataset.i);
        if (t) { w.setAttribute('aria-label', t); w.lang = 'ar'; w.dataset.wl = '1'; }
        else w.setAttribute('aria-label', t === null ? tx('ueben.endzeichen_der_aya', { a: D.V[vi][1] }) : tx('ueben.wort_nr', { n: +w.dataset.i + 1 }));
        if (t === null) w.dataset.wl = '1';
      }
      w.setAttribute('aria-pressed', w.classList.contains('fmark') ? 'true' : 'false');
    }
    if (ws.length && !ws.some(w => w.tabIndex === 0)) ws[0].tabIndex = 0;
    if (fokusWeg) app.querySelector('#auf, #weiter, #r')?.focus();
  }
  function wortFokus(w) {
    if (!w) return;
    for (const x of seitenEl.querySelectorAll('.w[tabindex="0"]')) x.tabIndex = -1;
    w.tabIndex = 0; w.focus();
  }
  const wortEinstieg = () => wortFokus(seitenEl.querySelector('.w[role=button][tabindex="0"]') || wahlWoerter()[0]);
  seitenEl.addEventListener('keydown', ev => {
    const w = ev.target.closest?.('.w[role=button]'); if (!w) return;
    const ws = wahlWoerter(), i = ws.indexOf(w); let z;
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') z = ws[Math.min(ws.length - 1, i + 1)];
    else if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') z = ws[Math.max(0, i - 1)];
    else if (ev.key === 'Home') z = ws[0];
    else if (ev.key === 'End') z = ws[ws.length - 1];
    else if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); w.click(); return; }
    else return;
    ev.preventDefault(); ev.stopPropagation(); wortFokus(z);
  });
  // Wortlaute nachtragen, sobald der Text geladen ist
  textFuerLeser().then(() => { if (seitenEl.isConnected) wahlSetzen(); });
  function zeichneInnen() {
    app.querySelector('#punkte').innerHTML = liste.map((a, i) => `<i class="${(phase === 'haupt' ? erg[i] : korr[i]) || (i === pos ? 'jetzt' : '')}"></i>`).join('');
    app.querySelector('.fort-zeile').classList.toggle('korrektur', phase === 'korrektur');
    seitenEl.querySelectorAll('.naechste').forEach(x => x.classList.remove('naechste'));
    seitenEl.querySelectorAll('.ziel').forEach(x => x.classList.remove('ziel'));
    A.classList.add('verdeckt');
    if (abhoeren) return abhoerenZeichnen();
    if (pos >= liste.length) return rundeFertig();
    const vi = liste[pos];
    Zl.textContent = phase === 'korrektur' ? tx('ueben.korrektur_von', { a: pos + 1, n: liste.length }) : tx('ueben.aya_von', { a: pos + 1, n: ayat.length });
    if (vorschau) {
      K.innerHTML = `<button class="knopf haupt" id="pruefen">${tx('ueben.jetzt_pruefen')}</button>`;
      H.textContent = tx('ueben.lies_den_abschnitt_in_ruhe_dann_pruefe');
      app.querySelector('#pruefen').onclick = () => { vorschau = false; seitenEl.classList.remove('vorschau'); zeichne(); sichtbar(spans(ayat[0])[0]); };
      return;
    }
    if (ganz && phase === 'haupt') return ganzSprechen();
    if (markieren) {
      A.classList.remove('verdeckt');
      A.innerHTML = Z.FEHLERARTEN.map(([w, l]) => `<button data-a="${w}">${l}</button>`).join('');
      K.innerHTML = `<button class="knopf haupt" id="weiter">${tx('allg.weiter')}</button>`;
      H.innerHTML = `${tx('ueben.tippe_auf_das_wort_bei_dem_du_dich_2')}<br><button class="textlink mini" id="doch-richtig">${tx('ueben.doch_kein_fehler')}</button>`;
      app.querySelector('#weiter').onclick = markierenFertig;
      app.querySelector('#doch-richtig').onclick = fehlerZurueck;
      return;
    }
    if (!offen) {
      if (ti === 0) teile = teileVon(vi);
      teile.slice(ti).flat().forEach(x => x.classList.add('naechste'));
      const grenze = ti < teile.length - 1 ? teile[ti][teile[ti].length - 1] : null;
      grenze?.querySelector('.wq:not(.la)')?.classList.add('ziel');
      const nimmt = rec?.state === 'recording';
      K.innerHTML = `${AUFNAHME ? `<button class="knopf leise rund ${nimmt ? 'nimmt' : ''}" id="mikro" aria-label="${nimmt ? tx('ueben.aufnahme_beenden') : tx('ueben.eigene_rezitation_aufnehmen')}">${nimmt ? '■' : '●'}</button>` : ''}${grenze ? `<button class="knopf leise" id="teil">${tx('ueben.bis_zum_zeichen')}</button>` : ''}<button class="knopf haupt" id="auf">${ti ? tx('ueben.rest_aufdecken') : tx('ueben.aya_aufdecken', { a: D.V[vi][1] })}</button>`;
      const mb = app.querySelector('#mikro'); if (mb) mb.onclick = () => nimmt ? aufnahmeStopp() : aufnahmeStart();
      const links = [], start = phase === 'haupt' && pos === 0 && ti === 0 && !hilfe;
      const hilfeVersteckt = !L && k.st >= 3 && !hilfeFrei && !hilfe && !ti;   // ab „sicher“ erst nach „Hilfe?“ (Hilfen zurücknehmen, wenn das Können wächst)
      if (E.hilfe && L?.ph !== 1 && hilfeVersteckt) links.push(`<button class="textlink mini leiser" id="hilfe-frage">${tx('ueben.hilfe_frage')}</button>`);
      else if (E.hilfe && L?.ph !== 1) links.push(`<button class="textlink mini" id="hilfe">${hilfe ? tx('ueben.noch_ein_wort') : ti ? tx('ueben.naechstes_wort') : tx('ueben.erstes_wort')}</button>`);
      if ((L ? L.ph === 0 : E.vorueben && k.st <= 1) && start) links.push(`<button class="textlink mini" id="ansehen">${tx('ueben.erst_ansehen')}</button>`);
      if (phase === 'haupt' && verlauf.length && ti === 0 && !hilfe) links.push(`<button class="textlink mini" id="neu-bewerten">${tx('ueben.vorige_aya_neu_bewerten')}</button>`);
      if (E.abhoeren !== false && start && art !== 'stelle') links.push(`<button class="textlink mini leiser" id="abhoeren">${tx('ueben.jemand_hoert_ab')}</button>`);
      const satz = L?.ph === 1 && start ? tx('lernen.dabt_hinweis') : phase === 'korrektur' ? tx('ueben.sofortkorrektur_diese_aya_noch_einmal') : alt.has(vi) ? tx('ueben.hier_warst_du_zuletzt_unsicher') : ti ? tx('ueben.weiter_aus_dem_gedaechtnis') : tx('ueben.rezitiere_aus_dem_gedaechtnis');
      H.innerHTML = (nimmt ? tx('ueben.aufnahme_laeuft_beim_aufdecken_endet_sie') : satz + (start ? ` ${tx('ueben.laut_hinweis')}` : '')) + (links.length ? '<br>' + links.join('') : '');
      app.querySelector('#auf').onclick = aufdecken;
      const tb = app.querySelector('#teil'); if (tb) tb.onclick = teilAufdecken;
      // Hilfe Wort für Wort: jedes Tippen deckt das nächste verdeckte Wort auf, die Āya zählt dann als „mit Hilfe“
      const hf = app.querySelector('#hilfe-frage'); if (hf) hf.onclick = () => { hilfeFrei = true; zeichne(); };
      const hb = app.querySelector('#hilfe'); if (hb) hb.onclick = () => {
        hilfe = true; const s = spans(vi).find(x => x.classList.contains('zu'));
        if (s) { s.classList.remove('zu', 'naechste'); s.classList.add('erstes'); }
        if (!spans(vi).some(x => x.classList.contains('zu'))) return aufdecken();
        zeichne();
      };
      const nb = app.querySelector('#neu-bewerten'); if (nb) nb.onclick = zuruecknehmen;
      const ah = app.querySelector('#abhoeren'); if (ah) ah.onclick = abhoerenStart;
      const ab = app.querySelector('#ansehen'); if (ab) ab.onclick = () => { vorschau = true; seitenEl.classList.add('vorschau'); zeichne(); };
      sichtbar(teile[ti]?.[0]);
    } else {
      K.innerHTML = `${aufnahme ? `<button class="knopf leise rund" id="hoeren" aria-label="${tx('ueben.aufnahme_anhoeren')}">▶</button>` : ''}<button class="knopf schlecht" id="f">${tx('allg.fehler')}</button>${hilfe ? '' : `<button class="knopf leise" id="z">${tx('ueben.gezoegert')}</button>`}<button class="knopf gut" id="r">${tx('ueben.richtig')}</button>`;
      H.textContent = aufnahme ? tx('ueben.hoer_dir_deine_rezitation_an_und') : hilfe ? tx('ueben.mit_hilfe_zaehlt_als_halb_sicher') : tx('ueben.warst_du_sicher_und_fehlerfrei');
      const hb2 = app.querySelector('#hoeren'); if (hb2) hb2.onclick = () => {
        if (spieler && !spieler.paused) { spieler.pause(); hb2.textContent = '▶'; return; }
        spieler ??= new Audio(aufnahme); spieler.currentTime = 0; spieler.play().catch(() => {}); hb2.textContent = '❚❚';
        spieler.onended = () => { hb2.textContent = '▶'; };
      };
      app.querySelector('#r').onclick = () => bewerte(hilfe ? 'hilfe' : 'ok');
      app.querySelector('#f').onclick = () => bewerte('fehler');
      const zb = app.querySelector('#z'); if (zb) zb.onclick = () => bewerte('zoegern');
    }
  }
  function aufdecken() {
    aufnahmeStopp();
    const vi = liste[pos]; zu.delete(vi);
    spans(vi).forEach(x => x.classList.remove('zu', 'naechste', 'erstes'));
    offen = true; zeichne(); ansagen(vi);
  }
  function teilAufdecken() {
    teile[ti].forEach(x => x.classList.remove('zu', 'naechste', 'erstes'));
    ti++;
    if (ti >= teile.length) return aufdecken();
    zeichne();
  }
  function bewerte(x) {
    const vi = liste[pos];
    const sp = spans(vi); sp.forEach(s => { s.classList.remove('alt', 'ok', 'hilfe', 'fehler', 'zoegern'); s.classList.add(x); });
    if (phase === 'korrektur') { korr[pos] = x; if (x !== 'fehler') punktePop('✓', sp[sp.length - 1]); return naechsteAya(); }
    erg[pos] = x; status.set(vi, x);
    if (x !== 'fehler' && art !== 'stelle') punktePop(x === 'ok' ? '+10' : '+5', sp[sp.length - 1]);
    if (x === 'fehler') { markieren = true; fArt = null; fsVorher = Z.fehlerstellenStand(); return zeichne(); }
    verlauf.push({ pos, fs: null }); zwischenSpeichern();
    naechsteAya();
  }
  // Fehltipp „Fehler“: zurück zu Richtig/Fehler, ohne etwas zu speichern
  function fehlerZurueck() {
    const vi = liste[pos]; markieren = false; erg.length = pos; status.delete(vi);
    markenWeg();
    spans(vi).forEach(s => { s.classList.remove('fehler'); if (alt.has(vi)) s.classList.add('alt'); });
    zeichne();
  }
  // Vorige Āya neu bewerten: Bewertung und markierte Fehlerstellen dieser Āya zurücknehmen
  function zuruecknehmen() {
    const v = verlauf.pop(); if (!v) return;
    aufnahmeVerwerfen();
    pos = v.pos; const vi = ayat[pos], war = erg[pos];
    erg.length = pos; status.delete(vi);
    if (v.fs) { Z.fehlerstellenSetzen(v.fs); const fst = Z.fehlerstellenSet(); spans(vi).forEach(s => s.classList.toggle('fs', fst.has(s.dataset.v + '.' + s.dataset.i))); }
    spans(vi).forEach(s => { s.classList.remove('ok', 'hilfe', 'fehler', 'zoegern'); if (alt.has(vi)) s.classList.add('alt'); });
    offen = true; hilfe = war === 'hilfe'; ti = 0; markieren = false;
    zwischenSpeichern(); zeichne(); sichtbar(spans(vi)[0]);
  }
  const zwischenSpeichern = () => { if (art !== 'stelle') Z.zwischenstandSpeichern(id, quelle, erg.slice(0, erg.length)); };
  // Ende einer Runde: nach der Hauptrunde die Fehler-Āyāt sofort noch einmal (wenn eingeschaltet), dann Abschluss
  function rundeFertig() {
    if (phase === 'haupt' && art !== 'stelle' && E.sofort !== false) {
      const f = ayat.filter((vi, i) => erg[i] === 'fehler' || erg[i] === 'hilfe' || erg[i] === 'zoegern');   // auch Āyāt mit Hilfe sitzen noch nicht
      if (f.length) {
        phase = 'korrektur'; liste = f; pos = 0; offen = false; hilfe = false; ti = 0; korr = [];
        f.forEach(vi => { zu.add(vi); spans(vi).forEach(s => { s.classList.remove('fehler'); s.classList.add('zu'); }); });
        toast(f.length === 1 ? tx('ueben.sofortkorrektur_die_aya_mit_fehler_noch') : tx('ueben.sofortkorrektur_die_ayat_mit_fehler_noch', { n: f.length }), 2800);
        zeichne(); sichtbar(spans(f[0])[0]); return;
      }
    }
    abschluss();
  }
  // Abhören (Tasmīʿ): eine zweite Person sieht den Text offen und tippt Fehler aufs Wort; dezente Nebenfunktion
  // ---------- Ablauf „ganzer Abschnitt am Stück“: erst alles sprechen (und aufnehmen), dann aufdecken, anhören, Fehler und Zögerstellen markieren ----------
  const ganzAufnahmeTaste = () => {
    const nimmt = rec?.state === 'recording';
    return AUFNAHME ? `<button class="knopf leise rund ${nimmt ? 'nimmt' : ''}" id="mikro" aria-label="${nimmt ? tx('ueben.aufnahme_beenden') : tx('ueben.eigene_rezitation_aufnehmen')}">${nimmt ? '■' : '●'}</button>` : '';
  };
  const ganzHoeren = hb => {
    if (spieler && !spieler.paused) { spieler.pause(); hb.textContent = '▶'; return; }
    spieler ??= new Audio(aufnahme); spieler.play().catch(() => {}); hb.textContent = '❚❚';
    spieler.onended = () => { hb.textContent = '▶'; };
  };
  function ganzSprechen() {
    Zl.textContent = tx('ueben.ayat_2', { n: ayat.length });
    app.querySelector('#punkte').innerHTML = '';
    const nimmt = rec?.state === 'recording', ansehen = E.vorueben && k.st <= 1 && !hilfe;
    K.innerHTML = `${ganzAufnahmeTaste()}<button class="knopf haupt" id="g-auf">${tx('ueben.ganz_aufdecken')}</button>`;
    H.innerHTML = (nimmt ? tx('ueben.aufnahme_laeuft_beim_aufdecken_endet_sie') : `${tx('ueben.ganz_hinweis')} ${tx('ueben.laut_hinweis')}`) + (ansehen && !nimmt ? `<br><button class="textlink mini" id="ansehen">${tx('ueben.erst_ansehen')}</button>` : '');
    const mb = app.querySelector('#mikro'); if (mb) mb.onclick = () => nimmt ? aufnahmeStopp() : aufnahmeStart();
    app.querySelector('#g-auf').onclick = ganzAufdecken;
    const ab = app.querySelector('#ansehen'); if (ab) ab.onclick = () => { vorschau = true; seitenEl.classList.add('vorschau'); zeichne(); };
    sichtbar(spans(ayat[0])[0]);
  }
  function ganzAufdecken() {
    aufnahmeStopp(); abhoeren = true; fArt = null; zg = new Set();
    ayat.forEach(vi => { zu.delete(vi); spans(vi).forEach(s => s.classList.remove('zu', 'naechste', 'erstes')); });
    zeichne(); sichtbar(spans(ayat[0])[0]);
  }
  const ganzSchluessel = `itqan.ganz.${id}`;
  const ganzMerken = () => {   // nur eingetragene Markierungen (mit Art) und gezögerte Āyāt; die Aufnahme bleibt im Arbeitsspeicher
    if (!(ganz && abhoeren)) return;
    const m = [...seitenEl.querySelectorAll('.w.fmark.typ')].map(s => [+s.dataset.v, +s.dataset.i, s.dataset.art]);
    try { if (m.length || zg.size) localStorage.setItem(ganzSchluessel, JSON.stringify({ d: Z.heute(), m, z: [...zg] })); else localStorage.removeItem(ganzSchluessel); } catch (e) { /* ohne Speicher geht es auch */ }
  };
  const ganzLoeschen = () => { try { localStorage.removeItem(ganzSchluessel); } catch (e) { /* egal */ } };
  function ganzAufraeumen() {
    markenWeg();
  }
  function ganzPruefenZeichnen() {
    Zl.textContent = tx('ueben.ayat_2', { n: ayat.length });
    app.querySelector('#punkte').innerHTML = '';
    A.classList.remove('verdeckt');
    A.innerHTML = Z.FEHLERARTEN.map(([w, l]) => `<button data-a="${w}">${l}</button>`).join('') + `<button data-a="zg">${tx('ueben.ganz_gezoegert')}</button>`;
    K.innerHTML = `${aufnahme ? `<button class="knopf leise rund" id="hoeren" aria-label="${tx('ueben.aufnahme_anhoeren')}">▶</button>` : ''}<button class="knopf leise" id="g-neu">${tx('ueben.ganz_neu')}</button><button class="knopf haupt" id="g-fertig">${tx('ueben.ganz_abschliessen')}</button>`;
    H.innerHTML = aufnahme ? tx('ueben.ganz_pruef_ton') : tx('ueben.ganz_pruef');
    const hb = app.querySelector('#hoeren'); if (hb) hb.onclick = () => ganzHoeren(hb);
    app.querySelector('#g-neu').onclick = () => {
      aufnahmeVerwerfen(); abhoeren = false; zg = new Set(); ganzAufraeumen(); ganzLoeschen();
      ayat.forEach(vi => { zu.add(vi); spans(vi).forEach(s => s.classList.add('zu')); }); zeichne();
    };
    app.querySelector('#g-fertig').onclick = () => {
      if (artFehlt()) return;
      const marken = [...seitenEl.querySelectorAll('.w.fmark')];
      Z.ganzErgebnis(ayat, new Set(marken.map(s => +s.dataset.v)), zg).forEach((x, i) => { erg[i] = x; });
      merken(marken);
      ganzAufraeumen(); ganzLoeschen(); abhoeren = false; ganz = false; aufnahmeVerwerfen();
      pos = ayat.length; rundeFertig();
    };
  }
  function abhoerenStart() {
    aufnahmeVerwerfen(); abhoeren = true; fArt = null;
    ayat.forEach(vi => { zu.delete(vi); spans(vi).forEach(s => s.classList.remove('zu', 'naechste', 'erstes')); });
    zeichne();
  }
  function abhoerenZeichnen() {
    if (ganz) return ganzPruefenZeichnen();
    Zl.textContent = tx('ueben.ayat_2', { n: ayat.length });
    app.querySelector('#punkte').innerHTML = '';
    A.classList.remove('verdeckt');
    A.innerHTML = Z.FEHLERARTEN.map(([w, l]) => `<button data-a="${w}">${l}</button>`).join('');
    K.innerHTML = `<button class="knopf leise" id="abh-ab">${tx('ueben.abbrechen')}</button><button class="knopf haupt" id="abh-fertig">${tx('ueben.fertig')}</button>`;
    H.innerHTML = tx('ueben.abhoeren_der_text_ist_offen_wer_zuhoert');
    app.querySelector('#abh-ab').onclick = () => {
      abhoeren = false; markenWeg();
      ayat.forEach(vi => { zu.add(vi); spans(vi).forEach(s => s.classList.add('zu')); }); zeichne();
    };
    app.querySelector('#abh-fertig').onclick = () => {
      if (artFehlt()) return;
      const marken = [...seitenEl.querySelectorAll('.w.fmark')];
      Z.abhoerErgebnis(ayat, new Set(marken.map(s => +s.dataset.v))).forEach((x, i) => { erg[i] = x; });
      merken(marken);
      pos = ayat.length; abschluss();
    };
  }
  function naechsteAya() { aufnahmeVerwerfen(); pos++; offen = false; hilfe = false; hilfeFrei = false; ti = 0; markieren = false; zeichne(); if (pos < liste.length && phase === 'korrektur') sichtbar(spans(liste[pos])[0]); }
  function markierenFertig() {
    if (artFehlt()) return;
    const marken = [...seitenEl.querySelectorAll('.w.fmark')];
    merken(marken);
    marken.forEach(s => { s.classList.remove('fmark', 'typ'); delete s.dataset.art; s.classList.add('fs'); });
    if (marken.length) toast(marken.length === 1 ? tx('ueben.stelle_gemerkt') : tx('ueben.stellen_gemerkt', { n: marken.length }), 1600);
    verlauf.push({ pos, fs: fsVorher }); zwischenSpeichern();
    naechsteAya();
  }
  // Fehler markieren: erst die Stelle (Wort antippen), dann die Fehlerart. Die Art gilt für die eben markierten Wörter; ohne Art geht es nicht weiter.
  const ausstehend = () => [...seitenEl.querySelectorAll('.w.fmark:not(.typ)')];
  const markenWeg = () => { zg = new Set(); seitenEl.querySelectorAll('.w.fmark, .w.zmark').forEach(s => { s.classList.remove('fmark', 'typ', 'zmark'); delete s.dataset.art; }); };
  const artFehlt = () => { if (!ausstehend().length) return false; toast(tx('ueben.art_wahl_fehlt'), 2600); return true; };
  const merken = marken => {
    const gruppen = new Map();
    for (const s of marken) { const a = s.dataset.art || null; gruppen.set(a, [...(gruppen.get(a) || []), `${s.dataset.v}.${s.dataset.i}`]); }
    for (const [a, keys] of gruppen) Z.fehlerstellenMerken(keys, a);
  };
  function artSetzen(a) {
    const ws = ausstehend(); if (!ws.length) return 0;
    if (a === 'zg') {   // Gezögert (Vers): der ganze Vers, das einzelne Wort wird wieder abgewählt; schon eingetragene Fehlerarten im Vers bleiben
      for (const vi of new Set(ws.map(w => +w.dataset.v))) { if (zg.has(vi)) zg.delete(vi); else zg.add(vi); spans(vi).forEach(s => s.classList.toggle('zmark', zg.has(vi))); }
      ws.forEach(w => { w.classList.remove('fmark'); delete w.dataset.art; w.setAttribute('aria-pressed', 'false'); });
    } else ws.forEach(w => { w.dataset.art = a; w.classList.add('typ'); });
    return ws.length;
  }
  A.onclick = ev => {
    const a = ev.target.dataset.a; if (!a) return;
    const n = artSetzen(a); fArt = null; ganzMerken();
    H.innerHTML = !n ? tx('ueben.art_zuerst_wort') : a === 'zg' ? tx('ueben.ganz_gezoegert_text') : `<b>${Z.FEHLERARTEN.find(x => x[0] === a)[1]}:</b> ${Z.FEHLERARTEN_TEXT[a]}`;
  };
  const markeUmschalten = w => { if (w.classList.contains('typ')) { w.classList.remove('fmark', 'typ'); delete w.dataset.art; } else w.classList.toggle('fmark'); };
  seitenEl.onclick = ev => {
    const w = ev.target.closest('.w'); if (!w) return;
    const gedrueckt = () => { if (w.getAttribute('role') === 'button') w.setAttribute('aria-pressed', w.classList.contains('fmark') ? 'true' : 'false'); };
    if (abhoeren) {
      if (!w.classList.contains('in')) return;
      markeUmschalten(w); gedrueckt(); ganzMerken(); return;
    }
    if (ganz && w.classList.contains('zu') && !vorschau) return ganzAufdecken();
    if (markieren) { if (+w.dataset.v === liste[pos]) { markeUmschalten(w); gedrueckt(); } return; }
    if (w.classList.contains('zu') && +w.dataset.v === liste[pos] && !offen && !vorschau) aufdecken();
  };
  const tasten = ev => {
    if (!document.body.contains(seitenEl)) { removeEventListener('keydown', tasten); return; }
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.closest?.('button,a,select,input,summary')) return;
    if (ev.target.closest?.('input,select,textarea') || document.querySelector('.dialog')) return;
    const pfeil = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(ev.key);
    if (abhoeren) { if (pfeil) { ev.preventDefault(); wortEinstieg(); } return; }
    if (ganz && phase === 'haupt') { if (!vorschau && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); app.querySelector('#g-auf')?.click(); } else if (vorschau && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); app.querySelector('#pruefen')?.click(); } return; }
    if (pos >= liste.length) return;
    if (vorschau) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); app.querySelector('#pruefen')?.click(); } return; }
    if (markieren) {
      if (ev.key === 'Enter' || ev.key === 'w') { ev.preventDefault(); markierenFertig(); }
      else if (pfeil || (ev.key === 'f' && !ev.repeat)) { ev.preventDefault(); wortEinstieg(); }
      return;
    }
    if (!offen && (ev.key === ' ' || ev.key === 'Enter')) { ev.preventDefault(); aufdecken(); }
    else if (!offen && (ev.key === 's' || ev.key === 'ArrowDown')) { ev.preventDefault(); app.querySelector('#teil')?.click(); }
    else if (offen && (ev.key === 'r' || ev.key === 'ArrowRight')) bewerte(hilfe ? 'hilfe' : 'ok');
    else if (offen && (ev.key === 'f' || ev.key === 'ArrowLeft')) bewerte('fehler');
    else if (offen && !hilfe && ev.key === 'z') bewerte('zoegern');
  };
  addEventListener('keydown', tasten);
  function abfrageAbschluss() {
    mikroAus(); removeEventListener('keydown', tasten);
    document.querySelector('.steuerung')?.remove();
    const wieder = AF.naechste(ABF.art), gut = erg.every(x => x === 'ok');
    app.innerHTML = `<div class="feier">${qandil()}<h2>${gut ? tx('ueben.richtig') : tx('ueben.noch_nicht_sicher')}</h2>
      <p>${tx('kurz.fertig')}</p>
      <div style="display:grid;gap:10px;margin-top:16px">${wieder ? `<a class="knopf haupt" href="${wieder}" style="text-decoration:none">${tx('kurz.nochmal')}</a>` : ''}<a class="knopf leise" href="#kurz" style="text-decoration:none">${tx('kurz.titel')}</a></div></div>`;
    window.scrollTo(0, 0);
  }
  function stelleAbschluss() {
    mikroAus(); removeEventListener('keydown', tasten);
    const r = Z.fehlerstelleGeuebt(ayat[0], erg[0]), ok = erg[0] === 'ok';
    document.querySelector('.steuerung')?.remove();
    const text = ok ? (r.erledigt && !r.rest ? tx('ueben.in_folge_richtig_die_stelle_ist_aus', { STELLE_ZIEL: Z.STELLE_ZIEL }) : tx('ueben.noch_in_folge_richtig_dann_ist_die', { a: Math.max(1, Z.STELLE_ZIEL - r.gut) }))
      : tx('ueben.die_zaehlung_beginnt_von_vorn_uebe_die');
    app.innerHTML = `<div class="feier">${qandil()}<h2>${ok ? (r.erledigt && !r.rest ? tx('ueben.die_stelle_sitzt') : tx('ueben.richtig')) : tx('ueben.noch_nicht_sicher')}</h2>
      <p>${D.V[ayat[0]][0]}:${D.V[ayat[0]][1]}<br><span class="unter">${text}</span></p>
      <div style="display:grid;gap:10px;margin-top:16px">${r.rest ? `<button class="knopf haupt" id="nochmal">${tx('ueben.noch_einmal_ueben')}</button>` : ''}<a class="knopf ${r.rest ? 'leise' : 'haupt'}" href="#fehlerstellen" style="text-decoration:none">${tx('ueben.zu_den_fehlerstellen')}</a></div></div>`;
    const n = app.querySelector('#nochmal'); if (n) n.onclick = () => ueben(idText, 'stelle', fokusText);
    window.scrollTo(0, 0);
  }
  function abschluss() {
    if (art === 'stelle') return ABF ? abfrageAbschluss() : stelleAbschluss();
    mikroAus(); Z.zwischenstandLoeschen();
    removeEventListener('keydown', tasten);
    const res = Z.abschnittAbschliessen(id, erg, ['frei', 'bonus', 'lern'].includes(art) ? art : undefined, zeitGanz ? zeitSekunden() : 0);
    letzteEreignisse.push(...res.ereignisse);
    const t2 = Z.tagesplan();
    const wirdJetzt = res.ereignisse.some(x => x.typ === 'wird');
    const naechster = t2.plan.find(x => !t2.fertig.includes(x));
    const orn = res.ereignisse.filter(x => x.typ === 'ornament').map(ornBand).join('')
      + res.ereignisse.filter(x => x.typ === 'rang').map(x => rangBand(x.r)).join('');
    document.querySelector('.steuerung').remove();
    app.innerHTML = `<div class="feier">${qandil()}
      <h2>${res.f ? tx('ueben.abschnitt_beendet') : res.h ? tx('ueben.gut_gemacht') : tx('ueben.fehlerfrei_ma_saa_llah')}</h2>
      <p>${esc(e.titel)}<br><span class="unter">${abschnittName(e)} · ${tx('ueben.stufe', { a: Z.STUFEN[res.stufe], b: res.stufe > res.vorher ? ' ↑' : res.stufe < res.vorher ? ' ↓' : '' })}</span></p>
      <div class="ernte"><div><b>${res.r}/${ayat.length}</b><span>${tx('ueben.ayat_gekonnt')}</span></div><div><b data-hoch="${res.punkte}" data-vor="+">+${zahl(res.punkte)}</b><span>${tx('allg.itqan_punkte')}</span></div>
        ${E.hasanat === false ? '' : `<div style="grid-column:1/-1"><b data-hoch="${res.hasanat}" data-vor="+">+${zahl(res.hasanat)}</b><span>${tx('allg.hasanat')}</span></div>`}</div>
      ${E.hasanat === false ? '' : `<p class="niyya">${tx('ueben.jeder_buchstabe_zehnfach_bei')}</p>`}
      <div class="aufschl">${res.teile.map(([a, b]) => `<div><span>${a}</span><span>+${zahl(b)}</span></div>`).join('')}</div>
      ${(res.f || res.h) && !res.lern ? `<div class="hinweisbox">${korr.length ? `${tx('ueben.sofortkorrektur_von_ayat_sitzen_jetzt', { n: korr.filter(x => x !== 'fehler').length, n2: korr.length })} ` : ''}${tx('ueben.morgen_wieder_dran', { n: res.f + res.h })}</div>` : ''}
      ${res.lern ? `<div class="band">${lernMeldung(res.lern)}</div>` : ''}${orn}
      <div style="display:grid;gap:10px;margin-top:16px" id="abschl-knoepfe">
      ${res.lern ? `<button class="knopf haupt" id="uebersicht">${tx('lernen.zu_den_lektionen')}</button>` : wirdJetzt ? `<button class="knopf haupt" id="weiter">${tx('allg.weiter')}</button>` : naechster != null && art !== 'frei' ? `<button class="knopf haupt" id="naechster">${tx('ueben.naechster_abschnitt')}</button><button class="knopf leise" id="uebersicht">${tx('ueben.zur_uebersicht')}</button>` : `<button class="knopf haupt" id="uebersicht">${tx('ueben.zur_uebersicht')}</button>`}
      </div></div>`;
    const w = app.querySelector('#weiter'); if (w) w.onclick = () => location.hash = '#fertig';
    const n = app.querySelector('#naechster'); if (n) n.onclick = () => location.replace(`#ueben/${naechster}`);
    const u = app.querySelector('#uebersicht'); if (u) u.onclick = () => location.hash = res.lern ? '#lernen' : '#heute';
    window.scrollTo(0, 0); hochzaehlen(app);
    // Zwillings-Übung (Mutašābihāt): nach einem sicheren Abschnitt, wenn es eine ähnliche Stelle gibt
    if (!res.lern && res.stufe >= 2) AF.zwillingZu(e.v[0], e.v[1]).then(z => { const kn = app.querySelector('#abschl-knoepfe'); if (z && kn) kn.insertAdjacentHTML('beforeend', `<a class="knopf leise" href="#vergleich/${z.key}/ueben" style="text-decoration:none">${tx('ueben.zwillinge_knopf', { a: NL.stelleKurz(z.a), b: NL.stelleKurz(z.b) })}</a>`); });
  }
  // angefangene Übung von heute fortsetzen?
  const zw = art !== 'stelle' ? Z.zwischenstandLaden(id, quelle) : null;
  if (zw?.erg?.length && zw.erg.length <= ayat.length && zw.erg.every(x => ['ok', 'hilfe', 'fehler', 'zoegern'].includes(x))) {
    const weiter = await dialog({ titel: tx('ueben.weitermachen'), html: `<p>${tx('ueben.du_hast_diesen_abschnitt_heute_schon', { n: zw.erg.length, n2: ayat.length })}</p>`, ja: zw.erg.length < ayat.length ? tx('ueben.bei_aya_weiter', { a: zw.erg.length + 1 }) : tx('allg.weiter'), nein: tx('ueben.neu_beginnen') });
    if (weiter) {
      zw.erg.forEach((x, i) => { const vi = ayat[i]; erg[i] = x; status.set(vi, x); zu.delete(vi); spans(vi).forEach(s => { s.classList.remove('zu', 'alt'); s.classList.add(x); }); });
      pos = zw.erg.length; zeitGanz = false; ganz = false;
      einbl?.remove();
    } else Z.zwischenstandLoeschen();
  }
  if (ganz) {   // Markierungen von vorhin wiederherstellen (heute, ohne Aufnahme)
    let g = null; try { g = JSON.parse(localStorage.getItem(ganzSchluessel) || 'null'); } catch (e) { g = null; }
    if (g && g.d === Z.heute()) {
      ganzAufdecken();
      for (const [v, i, a] of g.m || []) { const w = seitenEl.querySelector(`.w[data-v="${v}"][data-i="${i}"]`); if (w) { w.classList.add('fmark', 'typ'); w.dataset.art = a; } }
      for (const vi of g.z || []) { zg.add(vi); spans(vi).forEach(s => s.classList.add('zmark')); }
      toast(tx('ueben.ganz_wiederhergestellt'), 3200);
    } else ganzLoeschen();
  }
  zeichne();
  if (pos) sichtbar(spans(ayat[Math.min(pos, ayat.length - 1)])[0]);
  // nächste Seiten schon laden
  const t3 = Z.tagesplan(); t3.plan.filter(x => !t3.fertig.includes(x) && x !== id).slice(0, 2).forEach(x => schriftenLaden(D.A[x].seiten));
}

// ---------- Wird vollbracht ----------
function fertig() {
  navSetzen(null);
  const t = Z.tagesplan(), P = Z.P, bonusId = Z.bonusVorschlag();
  const ev = letzteEreignisse; letzteEreignisse = [];
  const quote = t.r + t.f + t.h ? `${t.r}/${t.r + t.f + t.h}` : '·';
  const extra = ev.filter(x => x.typ === 'rang').map(x => rangBand(x.r)).join('') + ev.filter(x => x.typ === 'kette' || x.typ === 'khatma' || x.typ === 'ornament').map(x =>
    x.typ === 'kette' ? `<div class="band">${tx('fertig.tage_in_folge', { n: x.n, a: x.n === 66 ? tx('fertig.im_mittel_wird_eine_gewohnheit_nach_etwa') : x.n === 40 ? tx('fertig.vierzig_tage_bestaendigkeit') : tx('fertig.bestaendigkeit_ist_das_liebste_bei_allah') })}</div>`
    : x.typ === 'khatma' ? `<div class="band">${tx('fertig.hatma_vollendet_allahumma_rhamni_bi_l', { n: x.n })}</div>`
    : ornBand(x)).join('');
  app.innerHTML = `<div class="feier">${qandil()}
    <div class="ar">اللَّهُمَّ بَارِكْ</div><h2>${tx('fertig.allahumma_barik')}</h2>
    <p>${tx('fertig.dein_wird_fuer_heute_ist_vollbracht_die', { n: P.kette.n })}</p>
    <div class="ernte"><div><b>${quote}</b><span>${tx('fertig.ayat_gekonnt')}</span></div><div><b data-hoch="${t.punkte}" data-vor="+">+${zahl(t.punkte)}</b><span>${tx('fertig.itqan_punkte_heute')}</span></div>
      ${P.einst.hasanat === false ? '' : `<div><b data-hoch="${t.hasanat}" data-vor="+">+${zahl(t.hasanat)}</b><span>${tx('fertig.hasanat_heute')}</span></div>`}<div><b>${P.kette.n}</b><span>${tx('fertig.tage_kette')}</span></div></div>
    ${P.einst.hasanat === false ? '' : `<p class="niyya">${tx('fertig.hasanat_nach_dem_hadit_jeder_buchstabe')}</p>`}
    ${extra}
    ${bonusId != null ? `<div class="angebot"><b>${tx('fertig.noch_kraft_fuer_mehr')}</b><p>${tx('fertig.ein_bonusabschnitt_bringt_dir_heute_50', { abschnittName: abschnittName(D.A[bonusId]), titel: esc(D.A[bonusId].titel) })}</p><button id="bonus">${tx('fertig.bonusabschnitt_beginnen')}</button></div>` : ''}
    <button class="textlink" id="genug" style="margin-top:12px">${tx('fertig.fuer_heute_genug')}</button></div>`;
  const b = app.querySelector('#bonus'); if (b) b.onclick = () => location.hash = `#ueben/${bonusId}/bonus`;
  app.querySelector('#genug').onclick = () => location.hash = '#heute';
  hochzaehlen(app);
  // fehlerfrei: volle Funken, mit Hilfe etwas weniger, mit Fehlern nur ein schwacher Schimmer
  funkeln(t.f ? 1 : t.h ? 2 : 3);
  app.querySelector('.feier').classList.add(t.f ? 'mit-fehlern' : 'strahlt');
}

// ---------- Lichtkarte ----------
function lichtkarte() {
  navSetzen('karte');
  Lk.zeichne(app, { stellenWahl, stellenWahlBinden, hochzaehlen });
}

// ---------- Muṣḥaf ----------
// Lage im doppelseitigen Madanī-Muṣḥaf: ungerade Seiten rechts, gerade links
function lageInfo(p) {
  const r = p % 2 === 1, rechts = r ? p : p - 1, links = r ? p + 1 : p;
  const buch = `<svg class="buch" viewBox="0 0 120 70" aria-hidden="true">
    <path d="M60 10 C45 4 22 4 6 8 V64 C22 60 45 60 60 66 Z" class="${r ? 'leer' : 'hier'}"/>
    <path d="M60 10 C75 4 98 4 114 8 V64 C98 60 75 60 60 66 Z" class="${r ? 'hier' : 'leer'}"/>
    <path d="M60 10 V66" class="falz"/>
    <text x="33" y="42">${links <= 604 ? links : ''}</text><text x="87" y="42">${rechts >= 1 ? rechts : ''}</text></svg>`;
  return `${buch}<div>${tx('lageinfo.im_gedruckten_mushaf_liegt_seite', { a: r ? tx('lageinfo.rechte_seite') : tx('lageinfo.linke_seite'), p, b: r ? tx('lageinfo.rechts') : tx('lageinfo.links'), c: links <= 604 && rechts >= 1 ? tx('lageinfo.aufgeschlagen_zusammen_mit_seite_daneben', { a: r ? links : rechts, b: r ? tx('lageinfo.links') : tx('lageinfo.rechts') }) : '' })}</div>`;
}
// Auswahl Sūra → Abschnitt, springt zur Stelle im Muṣḥaf
function stellenWahl(sJetzt = 0, mitVers = false) {
  return `<div class="stellenwahl${mitVers ? ' mit-vers' : ''}"><select id="wahl-sure" aria-label="${tx('stellenwahl.sura')}"><option value="">${tx('stellenwahl.sura_waehlen')}</option>${Array.from({ length: 114 }, (_, i) => i + 1).map(n => `<option value="${n}"${n === sJetzt ? ' selected' : ''}>${n}. ${esc(sureName(n))}</option>`).join('')}</select>
    <select id="wahl-abschnitt" aria-label="${tx('allg.abschnitt')}"${sJetzt ? '' : ' disabled'}>${abschnittOptionen(sJetzt)}</select>${mitVers ? `<select id="wahl-vers" aria-label="${tx('stellenwahl.aya_waehlen')}"${sJetzt ? '' : ' disabled'}>${versOptionen(sJetzt)}</select>` : ''}</div>`;
}
// Āya-Nummern einer Sūra (Wert = Āya-Index im Datensatz), als Alternative zum Abschnitt
function versOptionen(s) {
  const kopf = `<option value="">${tx('stellenwahl.aya')}</option>`;
  if (!s) return kopf;
  const von = D.V.findIndex(v => v[0] === s); let n = 0; while (D.V[von + n]?.[0] === s) n++;
  return kopf + Array.from({ length: n }, (_, i) => `<option value="${von + i}">${i + 1}</option>`).join('');
}
function abschnittOptionen(s) {
  if (!s) return `<option value="">${tx('abschnittoptionen.abschnitt')}</option>`;
  return `<option value="">${tx('abschnittoptionen.abschnitt_waehlen')}</option>${D.A.filter(e => e.von[0] <= s && e.bis[0] >= s)
    .map(e => `<option value="${e.id}">${e.nr ? e.nr + '. ' : ''}${esc(e.titel)} (${bereichText(e)})</option>`).join('')}`;
}
function stellenWahlBinden() {
  const ss = app.querySelector('#wahl-sure'), sa = app.querySelector('#wahl-abschnitt'), sv = app.querySelector('#wahl-vers');
  ss.onchange = () => { sa.innerHTML = abschnittOptionen(+ss.value); sa.disabled = !ss.value; if (sv) { sv.innerHTML = versOptionen(+ss.value); sv.disabled = !ss.value; } if (ss.value) sa.focus(); };
  if (sv) sv.onchange = () => { if (sv.value !== '') location.hash = `#mushaf/${seiteVon(+sv.value)}/v${sv.value}`; };
  sa.onchange = () => { const e = D.A[+sa.value]; if (e) location.hash = `#mushaf/${e.seiten[0]}/${e.id}`; };
}
// Seitenauswahl, nach Aǧzāʾ gruppiert
function seitenOptionen(p) {
  let h = '';
  for (let j = 1; j <= 30; j++) {
    const von = juzStart(j), bis = j < 30 ? juzStart(j + 1) - 1 : 604;
    h += `<optgroup label="${tx('allg.guz_nr', { j })}">`;
    for (let x = von; x <= bis; x++) h += `<option value="${x}"${x === p ? ' selected' : ''}>${x}</option>`;
    h += '</optgroup>';
  }
  return h;
}
const vollbildIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
async function mushaf(pText, aText) {
  navSetzen('mushaf');
  const p = Math.min(604, Math.max(1, +pText || 1)), dop = doppelseitig();
  const seiten = dop ? paarVon(p) : [p];
  document.body.classList.toggle('doppelt', dop);
  const naechste = Math.min(604, seiten[seiten.length - 1] + 1), vorige = Math.max(1, seiten[0] - 1);
  const knopfText = x => dop ? `${tx('allg.seiten')} ${paarVon(x).join(` ${tx('mushaf.und')} `)}` : `${tx('mushaf.seite_3')} ${x}`;
  app.innerHTML = `<div class="lade">${tx('mushaf.seite_wird_geladen')}</div>`;
  await schriftenLaden(seiten);
  const abschnitte = D.A.filter(e => e.seiten.some(x => seiten.includes(x)));
  const nrVon = vi => abschnitte.findIndex(e => vi >= e.v[0] && vi <= e.v[1]);
  const t = Z.tagesplan();
  const s = D.V[D.L[seiten[0] - 1].find(z => z.w)?.w[0][1] ?? 0][0];
  // Ganze Seiten: keine Tönung und keine Grenzlinien, die Seite ist die Einheit
  const ganz = D.modus === 'seite';
  const opt = ganz ? { fst: Z.fehlerstellenSet(), lage: !dop } : { lage: !dop, ton: vi => { const i = nrVon(vi); return i < 0 ? null : abschnitte[i].id % 4; }, fst: Z.fehlerstellenSet(), grenzen: true };
  app.innerHTML = `<div class="kopfzeile"><div class="marke">${tx('allg.mushaf')}<small>${seiten.length > 1 ? `${tx('allg.seiten')} ${seiten.join(` ${tx('mushaf.und')} `)}` : tx('mushaf.seite', { p })} · ${sureName(s)} · ${tx('mushaf.guz', { juzVonSeite: juzVonSeite(p) })}</small></div>
      <div class="reihe-k"><a class="seitenlage such-knopf" href="#suche" aria-label="${tx('mushaf.im_quran_suchen')}">${lupe}</a><button class="seitenlage" id="lage" aria-label="${tx('mushaf.seite_2', { a: p % 2 ? tx('allg.rechte') : tx('allg.linke') })}">${p % 2 ? tx('mushaf.r') : tx('mushaf.l')}</button><select id="nr" class="seitenwahl" aria-label="${tx('mushaf.seite_3')}">${seitenOptionen(p)}</select></div></div>
    <div class="hinweisbox lageinfo verdeckt" id="lageinfo">${lageInfo(p)}</div>
    ${stellenWahl(s, true)}
    <div class="reihe blaettern" style="margin:12px 0 14px"><button class="knopf leise klein" id="vor">‹ ${knopfText(naechste)}</button><button class="knopf leise klein" id="zur">${knopfText(vorige)} ›</button></div>
    <div id="seite" class="${dop ? 'doppel' : ''}"><div class="roller">${dop ? paarHTML(seiten, opt) : seiteHTML(p, opt)}</div><button class="vollbild-knopf" id="vollbild" aria-label="${tx('mushaf.seite_im_vollbild_zeigen')}">${vollbildIcon}</button></div>
    <div class="titel-klein">${tx('mushaf.abschnitte_auf', { a: seiten.length > 1 ? tx('mushaf.diesen_seiten') : tx('mushaf.dieser_seite') })}</div>
    ${abschnitte.map((e, i) => {
      const dran = t.plan.includes(e.id) && !t.fertig.includes(e.id);
      return `<div class="karte${ganz ? '' : ` tonk${e.id % 4}`}" data-a="${i}">${ganz ? '' : '<i class="farbe"></i>'}<div class="t"><b>${esc(e.titel)}</b><span>${e.nr ? `${sureName(e.von[0])} <b class="nr-fett">${e.nr}</b>` : abschnittName(e)} · ${bereichText(e)} · ${Z.STUFEN[Z.karte(e.id).st]}${dran ? ` <span class="marke-art bonus">${tx('mushaf.heute_dran')}</span>` : ''}</span></div><a class="knopf leise klein" style="width:auto;text-decoration:none" href="#ueben/${e.id}/frei">${tx('allg.ueben')}</a></div>`;
    }).join('')}`;
  const seiteEl = app.querySelector('#seite');
  zeilenEinpassen(seiteEl); grenzenZeichnen(seiteEl);
  seitenText(seiteEl); seiteHolen(seiteEl.querySelector('.roller'), seiteEl.querySelector(`.seite[data-p="${p}"]`));
  const blaettern = ziel => { if (seiten.includes(ziel)) return; scrollBehalten = scrollY; location.replace('#mushaf/' + ziel); };
  app.querySelector('#vor').onclick = () => blaettern(naechste);
  app.querySelector('#zur').onclick = () => blaettern(vorige);
  app.querySelector('#nr').onchange = ev => location.replace('#mushaf/' + ev.target.value);
  app.querySelector('#lage').onclick = () => app.querySelector('#lageinfo').classList.toggle('verdeckt');
  app.querySelector('#vollbild').onclick = ev => { ev.stopPropagation(); vollbild(p); };
  // Blättern durch Wischen: nach rechts = nächste Seite (wie im Muṣḥaf), nach links = vorige
  let sx = null, sy = null;
  seiteEl.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  seiteEl.addEventListener('touchend', e => {
    if (sx == null) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
    // vergrößerte Seite: Wischen schiebt die Seite, geblättert wird mit den Knöpfen darüber
    const ro = seiteEl.querySelector('.roller'); if (ro.scrollWidth > ro.clientWidth + 1) return;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) blaettern(dx > 0 ? naechste : vorige);
  });
  // Tastatur am PC: Pfeil links = weiter (wie im Buch), Pfeil rechts = zurück
  const tasten = ev => {
    if (!seiteEl.isConnected) { removeEventListener('keydown', tasten); return; }
    if (document.body.classList.contains('im-vollbild') || ev.target.closest?.('select,input')) return;
    if (ev.key === 'ArrowLeft') blaettern(naechste); else if (ev.key === 'ArrowRight') blaettern(vorige);
  };
  addEventListener('keydown', tasten);
  stellenWahlBinden();
  const blitz = k => { k.scrollIntoView({ block: 'center', behavior: 'smooth' }); k.classList.remove('blitz'); void k.offsetWidth; k.classList.add('blitz'); };
  // Tippen auf die Seite zeigt den passenden Abschnitt unten
  seiteEl.onclick = ev => {
    const w = ev.target.closest('.w'); if (!w) return;
    const k = app.querySelector(`.karte[data-a="${nrVon(+w.dataset.v)}"]`); if (k) blitz(k);
  };
  // aus der Auswahl angesprungen: Abschnitt auf der Seite kurz aufleuchten lassen
  // „v<Āya-Index>“: eine einzelne Āya aus der Āya-Auswahl; sonst Abschnitts-Nummer
  const ziel = aText == null ? null : /^v\d+$/.test(aText) ? { v: [+aText.slice(1), +aText.slice(1)] } : D.A[+aText];
  if (ziel) {
    const ws = [...seiteEl.querySelectorAll('.w')].filter(w => +w.dataset.v >= ziel.v[0] && +w.dataset.v <= ziel.v[1]);
    ws.forEach(w => w.classList.add('angesprungen')); setTimeout(() => ws.forEach(w => w.classList.remove('angesprungen')), 2600);
    ws[0]?.scrollIntoView({ block: 'center' });
  }
  if (naechste > seiten[seiten.length - 1]) schriftenLaden(dop ? paarVon(naechste) : [naechste]);
  if (vorige < seiten[0]) schriftenLaden(dop ? paarVon(vorige) : [vorige]);
}

// ---------- Vollbild: nur die Seite, Blättern nach rechts und links ----------
async function vollbild(start) {
  let p = start;
  const v = document.createElement('div'); v.className = 'vollbild';
  v.innerHTML = `<div class="vb-buehne"></div><button class="vb-zu" aria-label="${tx('vollbild.vollbild_schliessen')}">✕</button>
    <button class="vb-pfeil links" aria-label="${tx('vollbild.naechste_seite')}">‹</button><button class="vb-pfeil rechts" aria-label="${tx('vollbild.vorige_seite')}">›</button>`;
  document.body.appendChild(v); document.body.classList.add('im-vollbild');
  try { document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })?.catch(() => {}); } catch (e) {}   // nicht abwarten: iPhone kennt es nicht
  const buehne = v.querySelector('.vb-buehne');
  const quer = () => innerWidth > innerHeight || doppelseitig();   // quer am Handy, PC und Tablet immer
  // Abschnitte farbig wie in der Muṣḥaf-Ansicht
  const farben = x => { if (D.modus === 'seite') return { lage: true }; const ab = D.A.filter(e => e.seiten.includes(x)); return { grenzen: true, lage: true, ton: vi => { const e = ab.find(e => vi >= e.v[0] && vi <= e.v[1]); return e ? e.id % 4 : null; } }; };
  async function zeige(neu, richtung = 0) {
    if (neu < 1 || neu > 604) return;
    const doppel = quer();
    // Querformat: Doppelseite wie im Buch, ungerade Seite rechts, gerade links
    const erste = doppel ? (neu % 2 ? neu : neu - 1) : neu;
    const seiten = doppel ? [erste, erste + 1].filter(x => x <= 604) : [erste];
    p = erste; await schriftenLaden(seiten);
    buehne.innerHTML = `<div class="vb-seiten${doppel ? ' doppel' : ''}">${seiten.map(x => seiteHTML(x, farben(x))).join('')}</div>`;
    const ss = [...buehne.querySelectorAll('.seite')];
    const breite = doppel ? Math.floor((innerWidth - 28) / 2) : Math.min(innerWidth, 900), hoehe = innerHeight - 16;
    ss.forEach(s => s.style.width = breite + 'px');
    const h = Math.max(...ss.map(s => s.offsetHeight));
    if (h > hoehe) ss.forEach(s => s.style.width = Math.floor(breite * hoehe / h) + 'px');
    zeilenEinpassen(buehne); grenzenZeichnen(buehne); seitenText(buehne);
    if (richtung) buehne.firstElementChild.classList.add(richtung > 0 ? 'von-links' : 'von-rechts');
    const nach = Math.max(...seiten), vor = Math.min(...seiten);
    if (nach < 604) schriftenLaden([nach + 1]); if (vor > 1) schriftenLaden([vor - 1]);
  }
  // im Muṣḥaf liegt die nächste Seite links: nach rechts wischen oder links tippen = weiter
  const weiter = () => zeige(p + (quer() ? 2 : 1), 1), zurueck = () => zeige(p - (quer() ? 2 : 1), -1);
  v.querySelector('.vb-pfeil.links').onclick = weiter;
  v.querySelector('.vb-pfeil.rechts').onclick = zurueck;
  let x0 = null, y0 = null;
  v.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  v.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  v.addEventListener('touchend', e => {
    if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) dx > 0 ? weiter() : zurueck();
  });
  const tasten = e => { if (e.key === 'ArrowLeft') weiter(); else if (e.key === 'ArrowRight') zurueck(); else if (e.key === 'Escape') schliessen(); };
  addEventListener('keydown', tasten);
  // Drehen des Handys: neu aufbauen (einzeln hoch, Doppelseite quer)
  let warte = null; const anpassen = () => { clearTimeout(warte); warte = setTimeout(() => zeige(p), 120); };
  const lageMQ = matchMedia('(orientation: landscape)');
  addEventListener('resize', anpassen); lageMQ.addEventListener('change', anpassen);
  function schliessen() {
    removeEventListener('keydown', tasten); removeEventListener('resize', anpassen); lageMQ.removeEventListener('change', anpassen);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    v.remove(); document.body.classList.remove('im-vollbild');
    if (p !== start) location.replace('#mushaf/' + p);
  }
  v.querySelector('.vb-zu').onclick = schliessen;
  document.addEventListener('fullscreenchange', function f() { if (!document.fullscreenElement && v.isConnected) { document.removeEventListener('fullscreenchange', f); schliessen(); } });
  await zeige(p);
}

// ---------- Ränge ----------
const fortschritt = b => b.k === 'ganz' || b.k === 'offen0' ? (b.ok ? 1 : 0) : Math.min(1, b.ist / b.soll);
const istText = b => b.k === 'ganz' || b.k === 'offen0' ? (b.ok ? tx('isttext.erfuellt') : tx('isttext.offen')) : (w => ['quote', 'st2', 'st3', 'st4'].includes(b.k) ? prozent(w) : w)(b.k === 'punkte' ? zahl(b.ist) : b.ist.toLocaleString(gebiet('zahl'), { useGrouping: false }));
const bedListe = (i, z) => `<div class="bed">${Z.bedingungen(i, z).map(b => `<div class="${b.ok ? 'ok' : ''}"><span>${b.ok ? '✓ ' : ''}${b.text}</span><span>${istText(b)}</span><i><b style="width:${(fortschritt(b) * 100).toFixed(1)}%"></b></i></div>`).join('')}</div>`;
function rangKarte() {
  const z = Z.kennzahlen(), r = Z.rangJetzt(z), R = Z.RAENGE[r], best = Z.P.rangBeste?.r ?? 0;
  return `<div class="rangkarte"><div class="kopf"><span class="ar">${R.ar}</span><div><span class="titel-klein" style="margin:0">${tx('rangkarte.rang_von', { a: r + 1, n: Z.RAENGE.length })}</span><b>${R.n}</b><span>${R.de}</span></div></div>
    ${best > r ? `<p class="unter">${tx('rangkarte.hoechster_erreichter_rang_die', { n: Z.RAENGE[best].n })}</p>` : ''}
    ${r + 1 < Z.RAENGE.length ? `<p class="naechster">${tx('rangkarte.zum_naechsten_rang', { n: Z.RAENGE[r + 1].n })}</p>${bedListe(r + 1, z)}` : `<p class="naechster">${tx('rangkarte.der_hoechste_rang_allahumma_barik')}</p>`}
    <a class="textlink" href="#raenge" style="padding-left:0">${tx('rangkarte.alle_raenge_und_was_sie_bedeuten')}</a></div>`;
}
function raenge() {
  navSetzen('profil');
  const z = Z.kennzahlen(), r = Z.rangJetzt(z);
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#profil'">${zurueckPfeil}${tx('allg.profil')}</button>
    <div class="marke">${tx('raenge.die_raenge')}<small>${tx('raenge.dreizehn_stufen_vom_ersten_schritt_bis')}</small></div>
    <p class="unter" style="margin:14px 0 4px">${tx('raenge.ein_rang_verlangt_immer_beides_fleiss')}</p>
    <p class="unter">${tx('raenge.ab_rang_7_gilt_nur_der_ganze_quran_bei')}</p>
    ${Z.RAENGE.map((R, i) => `<div class="rangstufe ${i === r ? 'jetzt' : i < r ? 'erreicht' : ''}">
      <div class="kopf"><span class="nr">${i + 1}</span><span class="ar">${R.ar}</span><div><b>${R.n}</b><span>${R.de}</span></div></div>
      <p>${R.hifz}</p>${i ? bedListe(i, z) : ''}</div>`).join('')}`;
}

// ---------- Profil ----------
function profil() {
  navSetzen('profil');
  const P = Z.P, s = P.summe;
  const quote = s.r + s.f + s.h ? Math.round(100 * (s.r + s.h * .5) / (s.r + s.f + s.h)) : 0;
  const tage = Z.letzteTage(30);
  const max = Math.max(1, ...tage.map(x => x.t?.punkte || 0));
  const schwach = Z.schwaechste(6);
  Z.ornamenteNachtragen();
  // zuletzt gesammelte Ornamente als kleine Vorschau
  const gesammelt = [...new Set(P.meilen.filter(m => m.startsWith('sure-')).map(m => +m.split('-')[2]))];
  const zuletzt = gesammelt.map(sn => ({ sn, o: Z.ornamentStand(sn) })).sort((a, b) => (b.o.datum || '').localeCompare(a.o.datum || '')).slice(0, 3);
  const vergoldet = gesammelt.filter(sn => P.meilen.includes('sure-mutqan-' + sn)).length;
  app.innerHTML = `<div class="marke">${P.name ? esc(P.name) : tx('profil.dein_profil')}<small>${tx('profil.dabei_seit', { a: new Date(P.erstellt).toLocaleDateString(gebiet('datum')) })} · ${tx('profil.hatmat_vollendet', { khatma: P.zyklus.khatma })}</small></div>
    ${rangKarte()}
    <div class="zahlen" style="margin-top:18px"><div class="zahl"><b>${zahl(s.punkte)}</b><span>${tx('allg.itqan_punkte')}</span></div>${Z.P.einst.hasanat === false ? '' : `<div class="zahl"><b>${zahl(s.hasanat)}</b><span>${tx('allg.hasanat')}</span></div>`}<div class="zahl"><b>${prozent(quote)}</b><span>${tx('allg.ayat_sicher')}</span></div>
      <div class="zahl"><b>${Z.ketteAktiv() ? P.kette.n : 0}</b><span>${tx('profil.kette_jetzt')}</span></div><div class="zahl"><b>${P.kette.beste}</b><span>${tx('profil.laengste_kette')}</span></div><div class="zahl"><b>${s.abschnitte}</b><span>${tx('allg.abschnitte')}</span></div></div>
    <div class="titel-klein">${tx('profil.itqan_punkte_der_letzten_30_tage')}</div>
    <div class="diagramm" role="img" aria-label="${tx('profil.itqan_punkte_der_letzten_30_tage_2', { a: zahl(tage.reduce((a, x) => a + (x.t?.punkte || 0), 0)), b: zahl(Math.max(0, ...tage.map(x => x.t?.punkte || 0))), n: tage.filter(x => x.t?.punkte).length })}">${tage.map(x => `<div class="${x.t?.punkte ? '' : 'leer'}" style="height:${x.t?.punkte ? Math.max(4, 100 * x.t.punkte / max) : 3}%" title="${x.d}: ${x.t?.punkte || 0}"></div>`).join('')}</div>
    <div class="klein-zeile"><span>${tx('profil.vor_30_tagen')}</span><span>${tx('profil.heute')}</span></div>
    <a class="knopf leise" href="#einstellungen" style="text-decoration:none;display:block;margin:18px 0 6px">${tx('allg.einstellungen')}</a>
    <details class="profil-gruppe"><summary><span><b>${tx('profil.gruppe_fortschritt')}</b><small>${tx('profil.gruppe_fortschritt_t')}</small></span></summary>
      <div class="profil-inhalt"><div class="unterseiten"><a class="karte" href="#auswertung"><div class="t"><b>${tx('allg.auswertung')}</b><span>${tx('profil.fehlerarten_suren_quote_und_zeit')}</span></div><span class="pfeil">›</span></a><a class="karte" href="#rueckblick"><div class="t"><b>${tx('allg.rueckblick')}</b><span>${tx('profil.woche_und_monat_als_bild_zum_aufheben')}</span></div><span class="pfeil">›</span></a><a class="karte" href="#fortschritt"><div class="t"><b>${tx('allg.fortschritt')}</b><span>${tx('profil.wo_du_am_meisten_uebst')}</span></div><span class="pfeil">›</span></a><a class="karte" href="#fehlerstellen"><div class="t"><b>${tx('allg.fehlerstellen')}</b><span>${tx('profil.markierte_stellen_zum_gezielten_ueben', { n: Object.keys(P.fstellen || {}).length })}</span></div><span class="pfeil">›</span></a><a class="karte" href="#ornamente"><div class="orn-vorschau">${zuletzt.length ? zuletzt.map(x => ornamentSVG(x.sn, x.o.stufe, 'mini')).join('') : ornamentSVG(1, 0, 'mini')}</div><div class="t"><b>${tx('profil.ornamente_und_meilensteine')}</b><span>${tx('profil.von_114_ornamenten', { n: gesammelt.length, a: vergoldet ? ` · ${tx('profil.vergoldet', { vergoldet })}` : '' })}</span></div><span class="pfeil">›</span></a></div></div></details>
    <details class="profil-gruppe"><summary><span><b>${tx('profil.gruppe_ueben')}</b><small>${tx('profil.gruppe_ueben_t')}</small></span></summary>
      <div class="profil-inhalt"><div class="unterseiten"><a class="karte" href="#lernen"><div class="t"><b>${tx('lernen.neu_lernen')}</b><span>${tx('lernen.profil_text')}</span></div><span class="pfeil">›</span></a><a class="karte" href="#kurz"><div class="t"><b>${tx('kurz.titel')}</b><span>${tx('kurz.untertitel')}</span></div><span class="pfeil">›</span></a><a class="karte" href="#aehnlich"><div class="t"><b>${tx('allg.aehnliche_stellen')}</b><span>${tx('profil.mutasabihat_nachschlagen_vergleichen_und')}</span></div><span class="pfeil">›</span></a></div></div></details>
    <details class="profil-gruppe"><summary><span><b>${tx('profil.sicherung')}</b><small>${tx('profil.gruppe_sicherung_t')}</small></span></summary>
      <div class="profil-inhalt">
    <p class="unter">${tx('profil.es_gibt_keinen_server_deine_fortschritte', { a: istTouch() ? tx('profil.am_besten_in_dateien_icloud_drive_oder') : ` ${tx('profil.als_datei')}`, letzteSicherung: datumKurz(P.einst.letzteSicherung) })}</p>
    <div class="reihe" style="margin-top:10px"><button class="knopf haupt klein" id="sichern">${tx('profil.profil_sichern')}</button><button class="knopf leise klein" id="laden">${tx('profil.profil_laden')}</button></div>
      </div></details>
    <details class="profil-gruppe"><summary><span><b>${tx('profil.gruppe_hilfe')}</b><small>${tx('profil.gruppe_hilfe_t')}</small></span></summary>
      <div class="profil-inhalt"><div class="unterseiten"><a class="karte" href="#hilfe"><div class="t"><b>${tx('profil.hilfe_und_glossar')}</b></div><span class="pfeil">›</span></a><a class="karte" href="#einfuehrung"><div class="t"><b>${tx('profil.einfuehrung_ansehen')}</b></div><span class="pfeil">›</span></a><button type="button" class="karte" id="tour-neu"><div class="t"><b>${tx('profil.erklaerung_beim_ueben_wieder_zeigen')}</b></div><span class="pfeil">›</span></button><a class="karte" href="#rueckmeldung"><div class="t"><b>${tx('profil.rueckmeldung_senden')}</b></div><span class="pfeil">›</span></a></div></div></details>
    <details class="profil-gruppe"><summary><span><b>${tx('profil.gruppe_mehr')}</b><small>${tx('profil.gruppe_mehr_t')}</small></span></summary>
      <div class="profil-inhalt"><div class="unterseiten"><a class="karte" href="#lehrer"><div class="t"><b>${tx('profil.lehreransicht')}</b></div><span class="pfeil">›</span></a>${UEBERGANG.installieren ? `<a class="karte" href="#installieren"><div class="t"><b>${tx('profil.itqan_installieren')}</b></div><span class="pfeil">›</span></a>` : ''}</div></div></details>
    <p class="version-zeile">${tx('profil.itqan', { VERSION })} · <a href="#neu">${tx('allg.was_ist_neu')}</a></p>`;
  app.querySelector('#tour-neu').onclick = () => { tourZuruecksetzen(); toast(tx('profil.beim_naechsten_ueben_erscheint_die')); };
  app.querySelector('#sichern').onclick = async () => { if (await profilSichern()) profil(); };
  app.querySelector('#laden').onclick = profilLaden;
}

// ---------- Hilfe und Glossar ----------
// ohne Sonderzeichen suchen: „hatma“ findet Ḫatma, „guz“ findet Ǧuzʾ
const schlicht = s => s.normalize('NFD').replace(/[\u0300-\u036f\u02be\u02bf'’]/g, '').toLowerCase();
function hilfeSeite(ziel) {
  navSetzen('profil');
  const kbd = k => `<kbd>${k}</kbd>`;
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#profil'">${zurueckPfeil}${tx('allg.profil')}</button>
    <div class="marke">${tx('hilfeseite.hilfe')}<small>${tx('hilfeseite.fragen_begriffe_und_bedienung')}</small></div>
    <div class="hf-sprung" role="navigation" aria-label="${tx('hilfeseite.auf_dieser_seite')}">${[['fragen', tx('hilfeseite.fragen')], ['glossar', tx('hilfeseite.glossar')], ['lesbar', tx('hilfeseite.lesbarkeit')], ['tasten', tx('hilfeseite.tastatur')]].map(([z, l]) => `<button data-z="${z}">${l}</button>`).join('')}</div>
    <h2 class="titel-klein" id="hf-fragen" tabindex="-1">${tx('hilfeseite.fragen_und_antworten')}</h2>
    <div class="hf-fragen">${FRAGEN.map(x => `<details><summary>${x.f}</summary><p>${x.a}</p></details>`).join('')}</div>
    <h2 class="titel-klein" id="hf-glossar" tabindex="-1">${tx('hilfeseite.glossar')}</h2>
    <div class="hf-suche"><input type="search" id="hf-filter" placeholder="${tx('hilfeseite.begriff_suchen')}" aria-label="${tx('hilfeseite.begriff_im_glossar_suchen')}" autocomplete="off" enterkeyhint="search"></div>
    <dl class="glossar" id="hf-liste">${GLOSSAR.map(g => `<div data-s="${esc(schlicht(g.b + ' ' + g.t + ' ' + (g.mehr || '')))}"><dt>${g.b}${g.ar ? `<span lang="ar" dir="rtl">${g.ar}</span>` : ''}</dt><dd>${g.t}${g.mehr ? `<small>${g.mehr}</small>` : ''}</dd></div>`).join('')}</dl>
    <p class="leer verdeckt" id="hf-leer" role="status">${tx('hilfeseite.kein_begriff_gefunden')}</p>
    <h2 class="titel-klein" id="hf-lesbar" tabindex="-1">${tx('hilfeseite.lesbarkeit')}</h2>
    <div class="abschnitt"><p>${tx('hilfeseite.seitengroesse_in_den_einstellungen')}</p>
      <p style="margin-top:10px">${tx('hilfeseite.schriftgroesse_normal_gross_oder_sehr')}</p>
      <p style="margin-top:10px">${tx('hilfeseite.zoomen_mit_zwei_fingern_laesst_sich_jede')}</p>
      <p style="margin-top:10px">${tx('hilfeseite.hell_und_dunkel_beide_erscheinungsbilder')}</p>
      <a class="knopf leise" href="#einstellungen" style="text-decoration:none;margin-top:14px">${tx('hilfeseite.zu_den_einstellungen')}</a></div>
    <h2 class="titel-klein" id="hf-tasten" tabindex="-1">${tx('hilfeseite.tastatur')}</h2>
    <div class="abschnitt"><table class="hf-tasten">${TASTEN.map(t => `<tr><td colspan="2"><b>${t.wo}</b></td></tr>` + t.kuerzel.map(([k, was]) => `<tr><th scope="row">${k.map(kbd).join(` ${tx('hilfeseite.oder')} `)}</th><td>${was}</td></tr>`).join('')).join('')}</table></div>
    <h2 class="titel-klein">${tx('hilfeseite.bildschirmleser')}</h2>
    <div class="abschnitt"><p>${tx('hilfeseite.jeder_knopf_hat_einen_namen_jede_auswahl')}</p>
      <p style="margin-top:10px">${tx('hilfeseite.jede_mushaf_seite_gibt_es_auch_als_text')}</p></div>
    <p class="lesbar-probe">${tx('hilfeseite.deine_frage_ist_nicht_dabei_schreib_uns')}</p>`;
  const zu = z => { const el = app.querySelector('#hf-' + z); if (!el) return; el.scrollIntoView({ block: 'start', behavior: ruhig() ? 'auto' : 'smooth' }); el.focus({ preventScroll: true }); };
  app.querySelector('.hf-sprung').onclick = ev => { const z = ev.target.dataset.z; if (z) zu(z); };
  const filter = app.querySelector('#hf-filter'), eintraege = [...app.querySelectorAll('#hf-liste > div')], leer = app.querySelector('#hf-leer');
  filter.oninput = () => {
    const q = schlicht(filter.value.trim()); let n = 0;
    for (const e of eintraege) { const da = !q || e.dataset.s.includes(q); e.classList.toggle('verdeckt', !da); if (da) n++; }
    leer.classList.toggle('verdeckt', n > 0);
  };
  if (ziel) setTimeout(() => zu(ziel), 60);
}

// ---------- Ornamente und Meilensteine ----------
const ornBand = x => `<div class="band orn-band">${ornamentSVG(x.s, x.stufe === 'mutqan' ? 4 : 2, 'mini')}<span>${x.stufe === 'mutqan' ? tx('ornband.vergoldet_das_ornament_von_glaenzt_jetzt', { sureName: sureName(x.s) }) : tx('ornband.neues_ornament_ist_ganz_gefestigt', { sureName: sureName(x.s) })} <a href="#ornamente">${tx('ornband.ansehen')}</a></span></div>`;
function ornamentDetail(s) {
  const o = Z.ornamentStand(s), info = ornamentInfo(s), e0 = Z.sureAbschnitte(s)[0];
  const art = s === 1 ? tx('ornamentdetail.umm_al_kitab_eine_grosse_samsa_mit')
    : info.klasse === 1 && info.blaetter === info.ayat ? tx('ornamentdetail.eine_bluete_mit_blaettern_eines_fuer', { ayat: info.ayat }) : KLASSEN_TEXT[info.klasse] + '.';
  const stand = o.stufe >= 4 ? tx('ornamentdetail.vergoldet_die_ganze_sura_ist_mutqan', { a: o.datum ? ` ${tx('ornamentdetail.am', { a: new Date(o.datum).toLocaleDateString(gebiet('datum')) })}` : '' })
    : o.stufe >= 2 ? tx('ornamentdetail.gesammelt_vergoldet_wird_es_wenn_alle', { a: o.erst ? ` ${tx('ornamentdetail.am', { a: new Date(o.erst).toLocaleDateString(gebiet('datum')) })}` : '', gesamt: o.gesamt, mutqan: o.mutqan })
    : !o.imBereich ? tx('ornamentdetail.diese_sura_liegt_nicht_ganz_in_deinem')
    : tx('ornamentdetail.noch_nicht_gesammelt_von_abschnitten', { gefestigt: o.gefestigt, gesamt: o.gesamt });
  const anteil = o.stufe >= 2 ? o.mutqan / o.gesamt : o.gefestigt / o.gesamt;
  const d = document.createElement('div'); d.className = 'orn-detail';
  d.innerHTML = `<div class="orn-karte" role="dialog" aria-label="${tx('ornamentdetail.ornament', { a: esc(sureName(s)) })}">
    <div class="orn-gross">${ornamentSVG(s, o.stufe)}</div>
    <div class="ar">${sureArabisch(s)}</div><h2>${s}. ${esc(sureName(s))}</h2>
    <p class="unter">${art}</p><p>${stand}</p>
    ${o.imBereich && o.stufe < 4 ? `<div class="balken"><div style="width:${(anteil * 100).toFixed(1)}%"></div></div><div class="klein-zeile"><span>${o.stufe >= 2 ? tx('allg.mutqan') : tx('allg.gefestigt')}</span><span>${tx('ornamentdetail.von', { a: o.stufe >= 2 ? o.mutqan : o.gefestigt, gesamt: o.gesamt })}</span></div>` : ''}
    <div class="reihe" style="margin-top:14px">${e0 ? `<a class="knopf leise klein" href="#mushaf/${e0.seiten[0]}/${e0.id}" style="text-decoration:none">${tx('ornamentdetail.im_mushaf')}</a>` : ''}<button class="knopf haupt klein" id="orn-zu">${tx('ornamentdetail.schliessen')}</button></div></div>`;
  const zu = () => { d.classList.add('weg'); setTimeout(() => d.remove(), 250); removeEventListener('hashchange', zu); };
  d.onclick = ev => { if (ev.target === d || ev.target.id === 'orn-zu') zu(); };
  addEventListener('hashchange', zu);
  document.body.appendChild(d);
}
function ornamenteSeite() {
  navSetzen('profil');
  Z.ornamenteNachtragen();
  const P = Z.P, st = Array.from({ length: 115 }, (_, s) => s ? Z.ornamentStand(s) : null);
  const ges = st.filter(x => x?.stufe >= 2).length, gold = st.filter(x => x?.stufe >= 4).length;
  const ketten = Z.KETTEN_MEILEN.map(n => { const hat = P.meilen.includes('kette-' + n); return `<div class="meilenstein ${hat ? 'hat' : ''}">${lampeKlein}<b>${n}</b><span>${tx('ornamenteseite.tage')}</span></div>`; }).join('');
  let filter = 'alle';
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#profil'">${zurueckPfeil}${tx('allg.profil')}</button>
    <div class="marke">${tx('allg.ornamente')}<small>${tx('ornamenteseite.fuer_jede_sura_ein_eigenes_ornament_du')}</small></div>
    <div class="zahlen"><div class="zahl"><b>${ges}</b><span>${tx('ornamenteseite.von_114_gesammelt')}</span></div><div class="zahl"><b>${gold}</b><span>${tx('ornamenteseite.vergoldet')}</span></div><div class="zahl"><b>${P.zyklus.khatma}</b><span>${tx('ornamenteseite.hatmat', { n: P.zyklus.khatma })}</span></div></div>
    <div class="wahl" id="ofilter" style="margin-top:16px"><button data-w="alle" class="an">${tx('ornamenteseite.alle_114')}</button><button data-w="hat">${tx('ornamenteseite.gesammelt')}</button><button data-w="offen">${tx('ornamenteseite.noch_offen')}</button></div>
    <div class="orn-legende" aria-label="${tx('ornamenteseite.groessen_der_ornamente')}">${[[tx('ornamenteseite.unter_1'), tx('ornamenteseite.seite'), 1.5], [tx('ornamenteseite.1_bis_4'), tx('allg.seiten'), 2], [tx('ornamenteseite.5_bis_9'), tx('allg.seiten'), 3], [tx('ornamenteseite.10_bis_20'), tx('allg.seiten'), 4], [tx('ornamenteseite.ueber_20'), tx('allg.seiten'), 6]].map(([t, w, e], i) => `<div><span class="kreis"><i style="--e:${e}"></i></span><b>${i + 1}</b><span>${t}<br>${w}</span></div>`).join('')}</div>
    <p class="orn-legende-text">${tx('ornamenteseite.die_groesse_richtet_sich_nach_der_laenge')}</p>
    <div class="orn-feld" id="og"></div>
    <div class="titel-klein">${tx('ornamenteseite.meilensteine_der_kette')}</div>
    <div class="meilensteine">${ketten}</div>
    <p class="unter" style="margin-top:8px">${tx('ornamenteseite.laengste_kette_tage', { beste: P.kette.beste })} · ${tx('ornamenteseite.hoechster_rang', { n: Z.RAENGE[P.rangBeste?.r ?? 0].n })}</p>`;
  const og = app.querySelector('#og');
  // Größe 1 bis 5 nach der Länge der Sūra, al-Fātiḥah ausnahmsweise 3. Eine Reihe hat 12 Teile:
  // Größe 5 = 6 Teile (zwei je Reihe), 4 = 4, 3 = 3, 2 = 2, 1 = 1,5. Die Reihenfolge des Muṣḥaf bleibt immer erhalten.
  const kachel = s => `<button class="orn-kachel g${s === 1 ? 3 : groesse(s)}${st[s].stufe ? '' : ' offen'}" data-s="${s}" aria-label="${s}. ${esc(sureName(s))}">${ornamentSVG(s, st[s].stufe)}<span><b>${s}</b><i>. ${esc(sureName(s))}</i></span></button>`;
  const zeichnen = () => {
    const liste = Array.from({ length: 114 }, (_, i) => i + 1).filter(s => filter === 'alle' || (filter === 'hat') === (st[s].stufe >= 2));
    if (!liste.length) { og.innerHTML = `<p class="leer">${filter === 'hat' ? tx('ornamenteseite.dein_erstes_ornament_bekommst_du_wenn') : tx('ornamenteseite.alle_114_ornamente_sind_gesammelt')}</p>`; return; }
    // feste Reihen oben: al-Fātiḥah allein in der Mitte, dann die langen Sūren paarweise, al-Anfāl neben at-Taubah
    const reihen = [[1], [2, 3], [4, 5], [6, 7], [8, 9]].map(r => r.filter(s => liste.includes(s))).filter(r => r.length);
    const fest = new Set(reihen.flat());
    og.innerHTML = reihen.map(r => `<div class="orn-reihe">${r.map(kachel).join('')}</div>`).join('')
      + `<div class="orn-reihe">${liste.filter(s => !fest.has(s)).map(kachel).join('')}</div>`;
  };
  zeichnen();
  og.onclick = ev => { const b = ev.target.closest('[data-s]'); if (b) ornamentDetail(+b.dataset.s); };
  app.querySelector('#ofilter').onclick = ev => { const w = ev.target.dataset.w; if (!w) return; filter = w; app.querySelectorAll('#ofilter button').forEach(b => b.classList.toggle('an', b.dataset.w === w)); zeichnen(); };
}

// ---------- Fortschritt (schwächste Abschnitte) ----------
// ---------- Neu lernen: Ḥifẓ, Ḍabṭ, Itqān ----------
function lektionKarte(l, i) {
  const e = D.A[l.id], H = Z.LERN;
  const stand = l.ph ? tx('lernen.stand_dabt', { n: Math.min(l.serie, H.dabtSerie), z: H.dabtSerie }) : tx('lernen.stand_hifz', { n: l.tage, z: H.hifzTage });
  return `<a class="karte ${l.heute ? 'fertig' : ''}" href="#ueben/${l.id}/lern" style="text-decoration:none;color:inherit">
      <div class="nr">${l.heute ? '✓' : i + 1}</div><div class="t"><b>${esc(e.titel)}</b><span>${abschnittMarke(e)} · ${bereichText(e)} · ${stand}${l.offen ? ' · ' + tx('lernen.offene_stellen', { n: l.offen }) : ''} <span class="marke-art festigen">${l.ph ? tx('lernen.dabt') : tx('lernen.hifz')}</span></span></div>${stufePunkte(Z.karte(l.id).st)}</a>`;
}
// Satz nach einem Durchgang einer Lektion
function lernMeldung(l) {
  const H = Z.LERN;
  if (l.ph > l.vor) return l.ph === 2 ? tx('lernen.jetzt_itqan') : tx('lernen.jetzt_dabt');
  if (l.ph === 0) return l.rein ? tx('lernen.hifz_tag_gezaehlt', { n: l.tage, z: H.hifzTage }) : tx('lernen.hifz_nochmal');
  if (!l.rein) return tx('lernen.dabt_neu');
  return l.s >= H.dabtSerie && l.offen ? tx('lernen.dabt_stellen') : tx('lernen.dabt_folge', { n: Math.min(l.s, H.dabtSerie), z: H.dabtSerie });
}
function lernenSeite(wahlText) {
  navSetzen('heute');
  const lekt = Z.lektionen(), gemeistert = Z.lernFertig().length, dz = Z.dachZahlen();
  const tp = Z.tagesplan(), alteOffen = !tp.ruhe && tp.plan.some(id => !tp.fertig.includes(id) && tp.art[id] !== 'bonus');   // Altes zuerst, nur als Rat
  const wahl = wahlText != null && Z.lernbar(+wahlText) ? +wahlText : null, vor = wahl ?? Z.lernVorschlag();
  const namen = [tx('lernen.hifz_voll'), tx('lernen.dabt_voll'), tx('lernen.itqan_voll')], texte = [tx('lernen.hifz_text'), tx('lernen.dabt_text'), tx('lernen.itqan_text')];
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#heute'">${zurueckPfeil}${tx('lernen.zurueck')}</button>
    <div class="marke">${tx('lernen.neu_lernen')}<small>${tx('lernen.untertitel')}</small></div>
    <div class="titel-klein">${tx('lernen.deine_lektionen')}</div>
    ${lekt.length ? lekt.map((l, i) => `${lektionKarte(l, i)}<div class="klein-zeile" style="justify-content:flex-end;gap:14px;margin:-4px 0 10px">${l.offen ? `<a class="textlink" href="#ueben/${l.id}/stelle/${l.stellen[0]}">${tx('lernen.stellen_ueben')}</a>` : ''}<button class="textlink" data-ab="${l.id}">${tx('lernen.abbrechen')}</button></div>`).join('') : `<p class="unter">${tx('lernen.keine_lektion')}</p>`}
    <div class="titel-klein">${tx('lernen.neue_lektion')}</div>
    ${alteOffen ? `<div class="hinweisbox"><p>${tx('lernen.alt_zuerst')}</p><div class="reihe" style="margin-top:8px"><a class="knopf leise klein" href="#heute" style="text-decoration:none">${tx('lernen.zur_wiederholung')}</a></div></div>` : ''}
    <p class="unter" style="margin-bottom:10px">${tx('lernen.abend_morgen')} ${tx('lernen.groesse_hinweis')}</p>
    ${vor == null ? `<p class="unter">${tx('lernen.alles_im_bereich')}</p>` : `<div class="abschnitt" style="margin-top:0"><p>${wahl != null ? tx('lernen.gewaehlt', { name: abschnittName(D.A[vor]), titel: esc(D.A[vor].titel) }) : tx('lernen.vorschlag', { name: abschnittName(D.A[vor]), titel: esc(D.A[vor].titel) })}</p>
      <div class="reihe" style="margin-top:10px"><button class="knopf haupt klein" id="l-beginn">${tx('lernen.beginnen')}</button></div>
      <p class="unter" style="margin:14px 0 8px">${tx('lernen.anderer')}</p>${stellenWahl()}</div>`}
    <div class="titel-klein">${tx('lernen.dach_titel')}</div>
    <div class="abschnitt" style="margin-top:0">${[0, 1, 2].map(i => `<p${i ? ' style="margin-top:14px"' : ''}><b>${namen[i]}</b></p><p class="unter">${tx('lernen.dach_zeile', { n: dz[i] })}</p><p style="margin-top:4px">${texte[i]}</p>`).join('')}</div>
    ${gemeistert ? `<p class="unter" style="margin-top:12px">${tx('lernen.gemeistert', { n: gemeistert })}</p>` : ''}`;
  app.querySelectorAll('[data-ab]').forEach(b => b.onclick = async () => {
    const id = +b.dataset.ab;
    if (await dialog({ titel: tx('lernen.abbrechen_titel'), html: `<p>${tx('lernen.abbrechen_text', { titel: esc(D.A[id].titel) })}</p>`, ja: tx('lernen.abbrechen'), gefahr: true })) { Z.lernAbbrechen(id); toast(tx('lernen.abgebrochen')); lernenSeite(); }
  });
  const lb = app.querySelector('#l-beginn'); if (lb) lb.onclick = () => { if (Z.lernBeginnen(vor)) location.hash = `#ueben/${vor}/lern`; };
  if (app.querySelector('#wahl-sure')) {
    stellenWahlBinden();
    const sa = app.querySelector('#wahl-abschnitt');
    sa.onchange = () => { if (sa.value === '') return; if (Z.lernbar(+sa.value)) lernenSeite(sa.value); else toast(tx('lernen.nicht_lernbar')); };
  }
  window.scrollTo(0, 0);
}
function fortschrittSeite() {
  navSetzen('profil');
  const schwach = Z.schwaechste(25);
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#profil'">${zurueckPfeil}${tx('allg.profil')}</button>
    <div class="marke">${tx('allg.fortschritt')}<small>${tx('fortschrittseite.die_abschnitte_in_denen_du_dich_am')}</small></div>
    <div style="margin-top:16px">${schwach.length ? schwach.map(({ id, k }) => `<a class="karte" href="#ueben/${id}/frei" style="text-decoration:none;color:inherit"><div class="t"><b>${esc(D.A[id].titel)}</b><span>${abschnittMarke(D.A[id])} · ${tx('fortschrittseite.fehler_in_durchgaengen', { fe: k.fe, n: k.n, a: k.fae ? ` · ${tx('fortschrittseite.kommt_wieder')}` : '' })}</span></div>${stufePunkte(k.st)}</a>`).join('') : `<p class="leer">${tx('fortschrittseite.noch_keine_daten_nach_den_ersten_tagen')}</p>`}</div>`;
}

// ---------- Rückblick: eine Woche oder ein Monat als Bild zum Aufheben und Teilen ----------
let rbLauf = 0, rbAdresse = '';
async function rueckblickSeite(art, versatz) {
  navSetzen('profil');
  const P = Z.P, lauf = ++rbLauf;
  // ohne Angabe: die laufende Woche, und wenn in ihr noch nichts geübt wurde, die Woche davor
  if (!art) { const jetzt = Z.rueckblick('woche', 0); location.replace(`#rueckblick/woche/${jetzt.leer && jetzt.frueher && !Z.rueckblick('woche', 1).leer ? 1 : 0}`); return; }
  art = art === 'monat' ? 'monat' : 'woche';
  const v = Math.max(0, Math.min(art === 'monat' ? 13 : 57, parseInt(versatz) || 0)), R = Z.rueckblick(art, v);
  const wort = art === 'monat' ? [tx('rueckblickseite.dieser_monat'), tx('rueckblickseite.letzter_monat'), tx('rueckblickseite.vor_monaten', { v })] : [tx('rueckblickseite.diese_woche'), tx('rueckblickseite.letzte_woche'), tx('rueckblickseite.vor_wochen', { v })];
  const einheit = art === 'monat' ? tx('rueckblickseite.monat') : tx('rueckblickseite.woche');
  let mitName = !!P.name && P.einst.rbName !== false, blob = null;
  const name = () => mitName ? P.name : '';
  // ob dieses Gerät Bilder an andere Apps weitergeben kann (iPhone, Android)
  let kannTeilen = false;
  try { kannTeilen = istTouch() && !!navigator.canShare?.({ files: [new File([new Blob(['x'], { type: 'image/png' })], 'x.png', { type: 'image/png' })] }); } catch (e) {}
  const worte = () => RB.beschreibung(R, name());
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#profil'">${zurueckPfeil}${tx('allg.profil')}</button>
    <div class="marke">${tx('allg.rueckblick')}<small>${tx('rueckblickseite.eine_woche_oder_ein_monat_als_bild_zum')}</small></div>
    <div class="wahl" id="rb-art" style="margin-top:16px" role="group" aria-label="${tx('rueckblickseite.zeitraum')}"><button data-w="woche" class="${art === 'woche' ? 'an' : ''}" aria-pressed="${art === 'woche'}">${tx('rueckblickseite.woche')}</button><button data-w="monat" class="${art === 'monat' ? 'an' : ''}" aria-pressed="${art === 'monat'}">${tx('rueckblickseite.monat')}</button></div>
    <div class="rb-zeit"><button class="rb-pfeil" id="rb-vor" aria-label="${tx('rueckblickseite.davor', { einheit })}"${R.frueher ? '' : ' disabled'}>‹</button>
      <div class="mitte" aria-live="polite"><b>${RB.zeitraumTitel(R)}</b><span>${wort[Math.min(v, 2)]}${R.laufend && !R.leer ? ` · ${tx('rueckblickseite.laeuft_noch')}` : ''}</span></div>
      <button class="rb-pfeil" id="rb-nach" aria-label="${tx('rueckblickseite.danach', { einheit })}"${v ? '' : ' disabled'}>›</button></div>
    ${R.leer ? `<p class="leer rb-leer">${tx('rueckblickseite.in_hast_du_geuebt', { a: art === 'monat' ? tx('rueckblickseite.diesem_monat') : tx('rueckblickseite.dieser_woche'), b: R.laufend ? tx('rueckblickseite.noch_nicht') : tx('rueckblickseite.nicht'), c: R.frueher ? ` ${tx('rueckblickseite.mit_dem_pfeil_links_kommst_du_zu_davor', { a: art === 'monat' ? tx('rueckblickseite.m_monat') : tx('rueckblickseite.r_woche') })}` : '' })}</p>` : `
    <div class="rb-bild"><img id="rb-img" alt="${esc(worte().join(' '))}"></div>
    <div class="reihe" style="margin-top:14px">${kannTeilen ? `<button class="knopf haupt" id="rb-teilen" disabled>${tx('rueckblickseite.teilen')}</button>` : ''}<button class="knopf ${kannTeilen ? 'leise' : 'haupt'}" id="rb-speichern" disabled>${tx('rueckblickseite.bild_speichern')}</button></div>
    ${P.name ? `<label class="haken rb-name"><input type="checkbox" id="rb-name"${mitName ? ' checked' : ''}> ${tx('rueckblickseite.mein_name_steht_auf_dem_bild')}</label>` : ''}
    <div class="titel-klein">${tx('rueckblickseite.in_worten')}</div>
    <ul class="rb-worte" id="rb-worte">${worte().slice(1).map(s => `<li>${esc(s)}</li>`).join('')}</ul>
    <p class="unter" style="margin-top:12px">${tx('rueckblickseite.das_bild_entsteht_auf_deinem_geraet_es')}</p>`}`;
  const zu = (a, n) => location.replace(`#rueckblick/${a}/${n}`);
  app.querySelector('#rb-art').onclick = ev => { const b = ev.target.closest('button'); if (b && b.dataset.w !== art) zu(b.dataset.w, 0); };
  app.querySelector('#rb-vor').onclick = () => zu(art, v + 1);
  app.querySelector('#rb-nach').onclick = () => zu(art, v - 1);
  if (R.leer) return;
  const img = app.querySelector('#rb-img'), knoepfe = app.querySelectorAll('#rb-teilen, #rb-speichern');
  // Das Bild wird fertig gezeichnet, bevor jemand auf „Teilen“ tippt: das iPhone erlaubt das Teilen nur direkt im Tipp.
  async function malen() {
    knoepfe.forEach(k => k.disabled = true);
    await RB.schriftenBereit(RB.zeitraumTitel(R) + worte().join(' '));
    const fertig = await new Promise(res => RB.zeichnen(document.createElement('canvas'), R, RB.farbenLesen(), name()).toBlob(res, 'image/png'));
    if (lauf !== rbLauf || !img.isConnected || !fertig) return;
    blob = fertig;
    if (rbAdresse) URL.revokeObjectURL(rbAdresse);
    img.src = rbAdresse = URL.createObjectURL(blob); img.alt = worte().join(' ');
    knoepfe.forEach(k => k.disabled = false);
  }
  const speichern = () => { herunterladen(RB.dateiName(R, name()), blob, 'image/png'); toast(geraet() === 'pc' ? tx('rueckblickseite.das_bild_liegt_bei_deinen_downloads') : tx('rueckblickseite.bild_gespeichert')); };
  app.querySelector('#rb-speichern').onclick = () => { if (blob) speichern(); };
  const teilen = app.querySelector('#rb-teilen');
  if (teilen) teilen.onclick = async () => {
    if (!blob) return;
    try { await navigator.share({ files: [new File([blob], RB.dateiName(R, name()), { type: 'image/png' })], title: `${tx('allg.itqan')} · ${tx('allg.rueckblick')}` }); }
    catch (e) { if (e.name !== 'AbortError') speichern(); }   // Teilen nicht möglich: das Bild wenigstens speichern
  };
  const haken = app.querySelector('#rb-name');
  if (haken) haken.onchange = () => {
    mitName = haken.checked; P.einst.rbName = mitName; Z.speichern();
    malen();
  };
  await malen();
}

// ---------- Auswertung: Fehlerarten, Sūren, Quote, Zeit ----------
const dauerText = sek => sek == null ? '·' : sek < 60 ? tx('dauertext.s', { sek: Math.round(sek) }) : sek < 3600 ? tx('dauertext.min', { a: Math.floor(sek / 60), b: String(Math.floor(sek % 60)).padStart(2, '0') }) : tx('dauertext.h', { a: Math.floor(sek / 3600), b: String(Math.floor(sek % 3600 / 60)).padStart(2, '0') });
function auswertungSeite() {
  navSetzen('profil');
  const a = Z.auswertung(30);
  const zeile = (name, wert, max, rechts, klasse = '') => `<div class="aw-zeile ${klasse}"><span>${name}</span><div class="aw-balken"><i style="width:${max ? (100 * wert / max).toFixed(1) : 0}%"></i></div><b>${rechts}</b></div>`;
  const maxArt = Math.max(1, ...a.arten.map(x => x.n), a.ohneArt);
  const mitArt = a.arten.reduce((s, x) => s + x.n, 0);
  const schwach = a.suren.filter(x => x.sicher < x.ayat).slice(0, 10);
  const wo = a.wochen;
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#profil'">${zurueckPfeil}${tx('allg.profil')}</button>
    <div class="marke">${tx('allg.auswertung')}<small>${tx('auswertungseite.wo_du_sicher_bist_und_wo_es_noch_hakt')}</small></div>
    <div class="titel-klein">${tx('auswertungseite.quote')}</div>
    <div class="zahlen"><div class="zahl"><b>${a.quoteGeprueft == null ? '·' : prozent(Math.floor(a.quoteGeprueft))}</b><span>${tx('auswertungseite.der_geprueften_ayat_sicher')}</span></div>
      <div class="zahl"><b>${zahl(a.geprueft)}</b><span>${tx('auswertungseite.ayat_geprueft')}</span></div>
      <div class="zahl"><b>${prozent(Math.floor(a.quote))}</b><span>${tx('auswertungseite.des_ganzen_bereichs_sicher')}</span></div></div>
    <div class="diagramm aw-wochen">${wo.map(w => `<div class="${w.quote == null ? 'leer' : ''}" style="height:${w.quote == null ? 3 : Math.max(4, (w.quote - 50) * 2)}%" title="${tx('auswertungseite.woche_bis', { bis: w.bis, a: w.quote == null ? tx('auswertungseite.nicht_geuebt') : tx('auswertungseite.sicher', { quote: Math.round(w.quote) }) })}"></div>`).join('')}</div>
    <div class="klein-zeile"><span>${tx('auswertungseite.vor_8_wochen')}</span><span>${tx('auswertungseite.diese_woche')}</span></div>
    <p class="unter" style="margin-top:6px">${tx('auswertungseite.anteil_der_ayat_ohne_fehler_und_ohne')}${(() => { const z = wo.filter(w => w.quote != null); return z.length ? ` ${tx('auswertungseite.diese_woche_2', { a: z.at(-1) === wo.at(-1) ? prozent(Math.floor(wo.at(-1).quote)) : tx('auswertungseite.noch_nicht_geuebt') })}` : ''; })()}</p>
    <div class="titel-klein">${tx('auswertungseite.fehlerarten')}</div>
    ${mitArt + a.ohneArt ? `<div class="aw-liste">${a.arten.map(x => zeile(x.name, x.n, maxArt, x.n)).join('')}${a.ohneArt ? zeile(tx('auswertungseite.ohne_angabe'), a.ohneArt, maxArt, a.ohneArt, 'leise') : ''}</div>
      <p class="unter" style="margin-top:8px">${tx('auswertungseite.gezaehlt_wird_jede_aya_bei_der_du_nach')} ${(() => { const top = [...a.arten].sort((x, y) => y.n - x.n)[0]; return top.n ? tx('auswertungseite.am_haeufigsten', { name: top.name, a: Z.FEHLERARTEN_TEXT[top.art] }) : ''; })()}</p>`
      : `<p class="leer">${tx('auswertungseite.noch_keine_fehler_gezaehlt_waehle_nach')}</p>`}
    <div class="titel-klein">${tx('auswertungseite.suren_mit_fehlern')}</div>
    ${schwach.length ? `<div class="aw-liste">${schwach.map(x => zeile(`${x.s}. ${esc(sureName(x.s))}`, x.quote, 100, `${x.sicher}/${x.ayat}`)).join('')}</div>
      <p class="unter" style="margin-top:8px">${tx('auswertungseite.sichere_ayat_von_allen_geprueften_der')}</p>`
      : `<p class="leer">${a.geprueft ? tx('auswertungseite.im_letzten_durchgang_war_jede_gepruefte') : tx('auswertungseite.nach_den_ersten_abschnitten_siehst_du')}</p>`}
    <div class="titel-klein">${tx('auswertungseite.zeit')} · ${tx('auswertungseite.letzte_30_tage')}</div>
    ${a.zeit.abschnitte ? `<div class="zahlen"><div class="zahl"><b>${dauerText(a.zeit.jeAbschnitt)}</b><span>${tx('auswertungseite.je_abschnitt')}</span></div><div class="zahl"><b>${dauerText(a.zeit.jeAya)}</b><span>${tx('auswertungseite.je_aya')}</span></div><div class="zahl"><b>${dauerText(a.zeit.summe)}</b><span>${tx('auswertungseite.insgesamt')}</span></div></div>
      ${a.zeit.langsam.length ? `<p class="unter" style="margin:14px 0 8px">${tx('auswertungseite.am_laengsten_gebraucht_gemessen_an_der')}</p>${a.zeit.langsam.map(x => `<a class="karte" href="#ueben/${x.id}/frei" style="text-decoration:none;color:inherit"><div class="t"><b>${esc(D.A[x.id].titel)}</b><span>${abschnittMarke(D.A[x.id])} · ${tx('allg.zeilen', { zeilen: D.A[x.id].zeilen })} · ${dauerText(x.z)}</span></div><span class="pfeil">›</span></a>`).join('')}` : ''}
      <p class="unter" style="margin-top:8px">${tx('auswertungseite.gemessen_wird_nur_solange_die_uebung_auf')}</p>`
      : `<p class="leer">${tx('auswertungseite.seit_version_1_6_misst_itqan_beim_ueben')}</p>`}`;
}

// ---------- Suche ohne Vokale ----------
const lupe = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>';
const ARABISCH = 'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي ء ة ى'.split(' ');
const stelleText = vi => `${sureName(D.V[vi][0])} ${D.V[vi][0]}:${D.V[vi][1]}`;
const seiteVon = vi => D.W.get(vi + '.0')?.[0] || D.V[vi][3];
const abschnittVon = vi => D.A.find(e => vi >= e.v[0] && vi <= e.v[1]);
// Āya in Uthmani-Schrift, markierte Wörter hervorgehoben oder verdeckt
function ayaText(t, vi, { mark = new Set(), zu = new Set(), klasse = 'treffer-wort' } = {}) {
  return `<span class="uthmani">${t.u[vi].map((w, i) => zu.has(i) ? `<span class="wort-zu" data-i="${i}" data-t="${esc(w)}"></span>` : mark.has(i) ? `<mark class="${klasse}">${esc(w)}</mark>` : esc(w)).join(' ')} <span class="aya-nr">${D.V[vi][1].toLocaleString('ar-EG')}</span></span>`;
}
async function sucheSeite(qText = '') {
  navSetzen('mushaf');
  const start = decodeURIComponent(qText || '');
  app.innerHTML = `<button class="zurueck" onclick="history.length > 1 ? history.back() : (location.hash = '#mushaf')">${zurueckPfeil}${tx('allg.mushaf')}</button>
    <div class="marke">${tx('sucheseite.suche')}<small>${tx('sucheseite.im_ganzen_quran_ohne_vokale_eine_stelle')}</small></div>
    <div class="suchfeld"><input id="q" type="search" dir="rtl" lang="ar" autocomplete="off" spellcheck="false" placeholder="مثلا: الحي القيوم" value="${esc(start)}" aria-label="${tx('sucheseite.suchbegriff')}">
      <button class="seitenlage" id="tast" aria-label="${tx('sucheseite.arabische_buchstaben_einblenden')}" aria-expanded="false">ا ب</button></div>
    <div class="tastatur verdeckt" id="tastatur" dir="rtl">${ARABISCH.map(b => `<button data-b="${b}">${b}</button>`).join('')}<button data-b=" " class="breit">${tx('sucheseite.leerzeichen')}</button><button data-b="⌫" aria-label="${tx('allg.loeschen')}">⌫</button></div>
    <p class="unter such-stand" id="stand"></p><div id="treffer"></div>
    <p class="quelle">${tx('sucheseite.text_quran_com_uthmani_und_gewoehnliche')}</p>`;
  const q = app.querySelector('#q'), stand = app.querySelector('#stand'), liste = app.querySelector('#treffer'), tast = app.querySelector('#tastatur');
  let t = null;
  try { stand.textContent = tx('sucheseite.text_wird_geladen'); t = await S.textLaden(); stand.textContent = ''; }
  catch (e) { stand.textContent = tx('sucheseite.der_text_liess_sich_nicht_laden_bitte'); return; }
  let gezeigt = 0, ergebnis = null, lauf = 0;
  const karte = x => { const e = abschnittVon(x.vi); return `<a class="treffer" href="#mushaf/${seiteVon(x.vi)}${e ? '/' + e.id : ''}"><span class="treffer-ort">${stelleText(x.vi)} · ${tx('sucheseite.s', { vi: seiteVon(x.vi) })}</span>${ayaText(t, x.vi, { mark: x.woerter })}</a>`; };
  const mehr = () => {
    const neu = ergebnis.liste.slice(gezeigt, gezeigt + 40); gezeigt += neu.length;
    liste.querySelector('#mehr-treffer')?.remove();
    liste.insertAdjacentHTML('beforeend', neu.map(karte).join('') + (gezeigt < ergebnis.liste.length ? `<button class="knopf leise" id="mehr-treffer" style="margin-top:12px">${tx('sucheseite.weitere_zeigen', { a: Math.min(40, ergebnis.liste.length - gezeigt) })}</button>` : ''));
    const m = liste.querySelector('#mehr-treffer'); if (m) m.onclick = mehr;
  };
  const suchen = async () => {
    const nr = ++lauf, text = q.value;
    history.replaceState(null, '', '#suche' + (text.trim() ? '/' + encodeURIComponent(text.trim()) : ''));
    if (!text.trim()) { stand.textContent = ''; liste.innerHTML = ''; return; }
    const r = await S.suchen(text); if (nr !== lauf) return;
    ergebnis = r; gezeigt = 0; liste.innerHTML = '';
    if (r.zuKurz) { stand.textContent = tx('sucheseite.mindestens_zwei_buchstaben'); return; }
    if (r.stelle != null) { stand.innerHTML = tx('sucheseite.stelle_gefunden'); mehr(); return; }
    stand.innerHTML = r.liste.length ? tx('sucheseite.fundstellen_in_ayat', { anzahl: zahl(r.anzahl), n: r.anzahl, length: zahl(r.liste.length), n2: r.liste.length }) : tx('sucheseite.keine_treffer_pruefe_die_schreibweise');
    if (r.liste.length) mehr();
  };
  let warte = null;
  q.oninput = () => { clearTimeout(warte); warte = setTimeout(suchen, 220); };
  app.querySelector('#tast').onclick = ev => { const auf = tast.classList.toggle('verdeckt'); ev.currentTarget.setAttribute('aria-expanded', String(!auf)); };
  tast.onclick = ev => {
    const b = ev.target.closest('[data-b]')?.dataset.b; if (b == null) return;
    q.value = b === '⌫' ? q.value.slice(0, -1) : q.value + b; q.oninput();
  };
  if (start) suchen(); else if (!istTouch()) q.focus();
}

// ---------- Ähnliche Stellen (Mutašābihāt): nachschlagen, vergleichen, unterscheiden ----------
function vonAbschnitt(vi) { const e = abschnittVon(vi); return e ? e.id : -1; }
// Stand der Nachschlageseite: bleibt beim Wechsel in den Muṣḥaf, zu einer Gruppe oder zum Unterscheiden erhalten
const NA = { tab: 'f', q: '', sure: 0, bereich: 'mein', art: '', was: '', wo: '', gr: '', sort: 'mushaf', zahl: 20, filterAuf: false, y: null };
const NA_SEITE = 20;
const mitAr = s => esc(s).replace(/[؀-ۿ]+(?:[\s…]+[؀-ۿ]+)*/g, m => `<bdi class="ah-arw" lang="ar">${m}</bdi>`);
const mushafOrt = vi => `#mushaf/${seiteVon(vi)}${abschnittVon(vi) ? '/' + abschnittVon(vi).id : ''}`;
// teil: 'f' = Gruppen ähnlicher Verse, 't' = Reihenfolge-Fälle; mit key nur diese eine Gruppe oder dieser eine Fall
async function aehnlichSeite(teil, key) {
  navSetzen('profil');
  app.innerHTML = `<div class="lade">${tx('aehnlichseite.aehnliche_stellen_werden_geladen')}</div>`;
  let A, t;
  try { [A, t] = await Promise.all([NL.laden(), S.textLaden()]); } catch (e) { app.innerHTML = `<p class="leer">${tx('aehnlichseite.die_liste_liess_sich_nicht_laden_bitte')}</p>`; return; }
  const P = Z.P;
  // Āyāt mit „Verwechslung“ bei den Fehlerstellen: ihre Gruppen stehen oben
  const verw = new Set(Object.entries(P.fstellen || {}).filter(([, f]) => f.t?.verwechslung).map(([k]) => +k.split('.')[0]));
  const imB = vi => Z.imBereich(vonAbschnitt(vi));
  let a = NL.anfrage();
  const tr = vi => a.aktiv && NL.trifft(vi, a, t);

  // ----- Bausteine -----
  const text = (vi, klasse, nr = true) => `<div class="vk-text" dir="rtl"><span class="uthmani">${t.u[vi].map((w, j) => { const c = klasse(j); return c ? `<mark class="${c}">${esc(w)}</mark>` : esc(w); }).join(' ')}${nr ? ` <span class="aya-nr">${D.V[vi][1].toLocaleString('ar-EG')}</span>` : ''}</span></div>`;
  const danach = vi => { const d = NL.danach(t, vi); return `<span>${tx('aehnlichseite.danach')}</span>${d ? `<span class="ah-ar" lang="ar" dir="rtl">${esc(d)}</span>` : `<i>${tx('aehnlichseite.ende_der_sura')}</i>`}`; };
  const kopf = vi => `<div class="vk-kopf${tr(vi) ? ' ah-treffer' : ''}">${tx('aehnlichseite.s', { a: esc(sureName(D.V[vi][0])), vi: NL.stelleKurz(vi), vi3: mushafOrt(vi), vi4: seiteVon(vi) })}</div>`;
  const stellenKurz = s => { const l = [...s].sort((x, y) => x - y); return l.length <= 3 ? l.map(NL.stelleKurz).join(' · ') : `${NL.stelleKurz(l[0])} · ${tx('aehnlichseite.und_weitere', { stelleKurz: NL.stelleKurz(l[1]), a: l.length - 2 })}`; };
  const verweisF = k => `<a class="ah-verweis" href="#aehnlich/f/${k}">${stellenKurz(A.FK[k].s)}</a>`;
  const verweisT = k => `<a class="ah-verweis" href="#aehnlich/t/${k}"><bdi class="ah-ar" lang="ar">${esc(A.TK[k].ta)}</bdi> ⇄ <bdi class="ah-ar" lang="ar">${esc(A.TK[k].tb)}</bdi></a>`;
  const variante = (v, art) => {
    const d = new Set(v.d), n = v.g.length, vi = v.g[0], mark = j => art !== 'gleich' && d.has(j) ? 'anders' : '';
    if (n === 1) return `<div class="ah-stelle">${kopf(vi)}${text(vi, mark)}<div class="ah-danach">${danach(vi)}</div></div>`;
    return `<div class="ah-stelle"><div class="vk-kopf">${tx('aehnlichseite.stellen_mit_diesem_wortlaut', { n })}</div>${text(vi, mark, false)}
      <ul class="ah-orte${n > 7 ? ' zu' : ''}">${v.g.map(x => `<li${tr(x) ? ' class="ah-treffer"' : ''}><a href="${mushafOrt(x)}">${NL.stelleKurz(x)}</a><span class="sn">${esc(sureName(D.V[x][0]))}</span>${danach(x)}</li>`).join('')}</ul>
      ${n > 7 ? `<button class="ah-mehr" data-auf>${tx('aehnlichseite.alle_stellen_zeigen', { n })}</button>` : ''}</div>`;
  };
  const familie = f => {
    const n = f.s.length, w = f.v.length, z = [];
    if (f.vor) z.push(`<div><span>${tx('aehnlichseite.davor_steht_meist_die_gruppe')}</span>${f.vor.map(([k]) => verweisF(k)).join('')}</div>`);
    if (f.nach) z.push(`<div><span>${tx('aehnlichseite.darauf_folgt_meist_die_gruppe')}</span>${f.nach.map(([k]) => verweisF(k)).join('')}</div>`);
    if (f.auch) z.push(`<div><span>${tx('aehnlichseite.eine_stelle_steht_auch_in_der_gruppe')}</span>${f.auch.map(verweisF).join('')}</div>`);
    if (f.verw) z.push(`<div><span>${tx('aehnlichseite.verwandte_gruppe')}</span>${f.verw.map(verweisF).join('')}</div>`);
    if (f.t) z.push(`<div><span>${tx('aehnlichseite.als_reihenfolge_fall')}</span>${f.t.filter(k => A.TK[k]).map(verweisT).join('')}</div>`);
    if (f.paare.length) z.push(`<div><span>${tx('aehnlichseite.unterscheiden_ueben')}</span>${f.paare.map(p => { const st = P.mutash?.[p.key]; return `<a class="ah-verweis ueben" href="#vergleich/${p.key}/ueben">${tx('aehnlichseite.und', { stelleKurz: NL.stelleKurz(p.a), stelleKurz2: NL.stelleKurz(p.b) })}${st ? `<small>${st.ok}/${st.n}</small>` : ''}</a>`; }).join('')}</div>`);
    return `<article class="ah-karte" id="${f.k}">
      <div class="ah-kopf"><span class="ah-art ${f.art}">${NL.ART[f.art]}</span><span class="ah-nr">${tx('aehnlichseite.stellen', { n, a: w > 1 ? tx('aehnlichseite.wortlaute', { w }) : '' })}</span>${f.s.some(vi => verw.has(vi)) ? `<span class="marke-art fehler">${tx('aehnlichseite.verwechslung')}</span>` : ''}</div>
      ${f.was.length ? `<div class="ah-marken">${f.was.map(x => `<span>${mitAr(NL.WAS[x])}</span>`).join('')}</div>` : ''}
      <p class="ah-merk">${NL.merksatz(f)}</p>
      ${f.v.map(x => variante(x, f.art)).join('')}
      ${z.length ? `<div class="ah-verweise">${z.join('')}</div>` : ''}</article>`;
  };
  const chips = (x, seite) => {
    const l = x[seite], zu = l.length > 14;
    return `<div class="ah-chips${zu ? ' zu' : ''}">${l.map((o, i) => `<button class="ah-chip${tr(o[0]) ? ' ah-treffer' : ''}" data-k="${x.k}" data-o="${seite}${i}" title="${esc(sureName(D.V[o[0]][0]))}" aria-pressed="false">${NL.stelleKurz(o[0])}</button>`).join('')}${zu ? `<button class="ah-mehr" data-auf>${tx('aehnlichseite.alle_zeigen', { n: l.length })}</button>` : ''}</div>`;
  };
  const fall = x => {
    const na = x.ab.length, nb = x.ba.length, { satz, regel } = NL.fallSatz(x);
    return `<div class="ah-fall" id="${x.k}">
      <div class="ah-gegen"><div class="ah-folge eins"><div class="uthmani" lang="ar">${esc(x.ta)}</div><div class="anz">${tx('aehnlichseite.stellen_2', { na, a: regel ? ` · ${tx('aehnlichseite.die_regel')}` : '' })}</div></div>
        <div class="ah-tausch" aria-hidden="true">⇄</div>
        <div class="ah-folge zwei"><div class="uthmani" lang="ar">${esc(x.tb)}</div><div class="anz">${tx('aehnlichseite.stellen_3', { nb, a: regel ? (tx('aehnlichseite.die_ausnahmen', { n: nb })) : '' })}</div></div></div>
      <div class="ah-balken" aria-hidden="true"><i style="width:${(100 * na / (na + nb)).toFixed(1)}%"></i><i></i></div>
      <p class="ah-merk">${esc(satz)}</p>
      <div class="ah-spalten"><div class="eins">${chips(x, 'ab')}</div><div class="zwei">${chips(x, 'ba')}</div></div>
      <div class="ah-ayat"></div>
      ${x.f.some(k => A.FK[k]) ? `<div class="ah-verweise"><div><span>${tx('aehnlichseite.als_gruppe_aehnlicher_verse')}</span>${x.f.filter(k => A.FK[k]).map(verweisF).join('')}</div></div>` : ''}</div>`;
  };
  const ayaBlock = (x, o) => `<div class="ah-stelle" data-aya="${o[0]}">${kopf(o[0])}${text(o[0], NL.markFuer(x, o))}<div class="ah-danach">${danach(o[0])}</div></div>`;
  const fallKarte = (gr, l) => `<article class="ah-karte">${gr.titel ? `<h3>${mitAr(gr.titel)}</h3>` : ''}${gr.notiz ? `<p class="ah-merk">${mitAr(gr.notiz)}</p>` : ''}${l.map(fall).join('')}</article>`;
  // Tippen innerhalb der Karten: Stellen aufklappen, Āya eines Reihenfolge-Falls ein- und ausblenden
  const kartenKlick = b => {
    if ('auf' in b.dataset) { b.previousElementSibling?.classList.remove('zu'); b.parentElement.classList.remove('zu'); b.remove(); return true; }
    if (b.classList.contains('ah-chip')) {
      const x = A.TK[b.dataset.k], o = x[b.dataset.o.slice(0, 2)][+b.dataset.o.slice(2)];
      const ort = b.closest('.ah-fall').querySelector('.ah-ayat'), da = ort.querySelector(`[data-aya="${o[0]}"]`);
      if (da) da.remove(); else ort.insertAdjacentHTML('beforeend', ayaBlock(x, o));
      b.classList.toggle('an', !da); b.setAttribute('aria-pressed', String(!da));
      return true;
    }
    return false;
  };

  // ----- eine einzelne Gruppe oder ein einzelner Fall -----
  if (key) {
    const f = teil === 'f' ? A.FK[key] : null, x = teil === 't' ? A.TK[key] : null;
    if (!f && !x) { location.replace('#aehnlich'); return; }
    const th = x && A.t[x.thema], gr = x && th.gruppen.find(g => g.faelle.includes(x));
    app.innerHTML = `<button class="zurueck" onclick="history.length > 1 ? history.back() : (location.hash = '#aehnlich')">${zurueckPfeil}${tx('allg.zurueck')}</button>
      <div class="marke">${f ? tx('aehnlichseite.aehnliche_verse') : tx('aehnlichseite.reihenfolge')}<small>${f ? tx('aehnlichseite.eine_gruppe_aehnlicher_verse_markiert') : `${mitAr(th.thema)}${tx('aehnlichseite.tippe_auf_eine_stelle_um_die_aya_zu')}`}</small></div>
      <div id="ah" class="ah-stapel">${f ? familie(f) : fallKarte(gr, [x])}</div>
      <a class="knopf leise" href="#aehnlich/${teil}" style="text-decoration:none;margin-top:16px">${f ? tx('aehnlichseite.alle_gruppen_zeigen') : tx('aehnlichseite.alle_reihenfolge_faelle_zeigen')}</a>`;
    app.querySelector('#ah').onclick = ev => { const b = ev.target.closest('button'); if (b) kartenKlick(b); };
    return;
  }

  // ----- Nachschlagen: Suche, zwei Bereiche -----
  if (teil === 'f' || teil === 't') NA.tab = teil;
  const begrenzt = !!P.einst.bereich;
  const wahlen = (feld, l) => `<select data-feld="${feld}" aria-label="${esc(l[0][1])}">${l.map(([w, n]) => `<option value="${w}"${String(NA[feld]) === String(w) ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#profil'">${zurueckPfeil}${tx('allg.profil')}</button>
    <div class="marke">${tx('allg.aehnliche_stellen')}<small>${tx('aehnlichseite.mutasabihat_zum_nachschlagen_gruppen', { n: A.f.length, stellen: A.stellen, n2: A.faelle.length })}</small></div>
    <div class="suchfeld"><input id="q" class="ah-q" type="search" dir="auto" autocomplete="off" spellcheck="false" placeholder="${tx('aehnlichseite.2_48_sura_oder_woerter')}" value="${esc(NA.q)}" aria-label="${tx('aehnlichseite.stelle_sura_oder_arabische_woerter')}">
      <button class="seitenlage" id="tast" aria-label="${tx('aehnlichseite.arabische_buchstaben_einblenden')}" aria-expanded="false">ا ب</button></div>
    <div class="tastatur verdeckt" id="tastatur" dir="rtl">${ARABISCH.map(b => `<button data-b="${b}">${b}</button>`).join('')}<button data-b=" " class="breit">${tx('aehnlichseite.leerzeichen')}</button><button data-b="⌫" aria-label="${tx('allg.loeschen')}">⌫</button></div>
    <div class="ah-zeile">${wahlen('sure', [[0, tx('aehnlichseite.alle_suren')], ...A.suren.map(([s, n]) => [s, `${s} · ${sureName(s)} (${n})`])])}
      ${begrenzt ? `<div class="wahl" id="abereich"><button data-w="mein">${tx('aehnlichseite.dein_bereich')}</button><button data-w="alle">${tx('aehnlichseite.alle')}</button></div>` : ''}</div>
    <div class="ah-reiter" role="tablist"><button role="tab" data-tab="f">${tx('aehnlichseite.aehnliche_verse')}<small id="anz-f"></small></button><button role="tab" data-tab="t">${tx('aehnlichseite.reihenfolge')}<small id="anz-t"></small></button></div>
    <div id="ah"></div>`;
  const feld = app.querySelector('#ah'), q = app.querySelector('#q'), tast = app.querySelector('#tastatur');
  const zeichnen = () => {
    a = NL.anfrage(NA.q, NA.sure);
    const nur = begrenzt && NA.bereich === 'mein' ? imB : null;
    const fl = NL.familienListe(A, t, a, { art: NA.art, was: NA.was, wo: NA.wo, gr: NA.gr, sort: NA.sort, nur, zuerst: verw });
    const tl = NL.faelleListe(A, t, a, nur);
    // Zähler an den Reitern: Treffer der Suche, ohne die übrigen Filter
    const fz = NL.familienListe(A, t, a, { nur }).length, tz = tl.length;
    app.querySelector('#anz-f').textContent = fz; app.querySelector('#anz-t').textContent = tz;
    app.querySelectorAll('.ah-reiter button').forEach(b => { b.classList.toggle('an', b.dataset.tab === NA.tab); b.setAttribute('aria-selected', String(b.dataset.tab === NA.tab)); });
    app.querySelectorAll('#abereich button').forEach(b => b.classList.toggle('an', b.dataset.w === NA.bereich));
    const wonach = a.vi != null ? (a.vi >= 0 ? NL.stelleKurz(a.vi) : tx('aehnlichseite.dieser_stelle')) : a.text ? tx('aehnlichseite.diesen_woertern') : tx('aehnlichseite.dieser_auswahl');
    // außerhalb des eigenen Bereichs gäbe es Treffer: darauf hinweisen
    const draussen = n => nur && n ? ` ${tx('aehnlichseite.ausserhalb_deines_bereichs', { n })} <button class="ah-verweis" data-alle>${tx('aehnlichseite.alle_zeigen_3')}</button>` : '';
    if (NA.tab === 'f') {
      const st = new Set(fl.flatMap(e => e.f.s)).size, rest = fl.length - NA.zahl, oben = fl.filter(e => e.oben).length;
      const gefiltert = NA.art || NA.was || NA.wo || NA.gr;
      feld.innerHTML = `<div class="wahl vier" id="f-art">${[['', tx('aehnlichseite.alle')], ...Object.entries(NL.ART)].map(([w, n]) => `<button data-w="${w}"${NA.art === w ? ' class="an"' : ''}>${n}</button>`).join('')}</div>
        <details class="ah-filter"${NA.filterAuf ? ' open' : ''}><summary>${tx('aehnlichseite.weitere_filter', { a: NA.was || NA.wo || NA.gr || NA.sort !== 'mushaf' ? ` · ${tx('aehnlichseite.aktiv')}` : '' })}</summary><div class="ah-wahlen">
          ${wahlen('was', [['', tx('aehnlichseite.jeder_unterschied')], ...Object.entries(NL.WAS).map(([k, n]) => [k, `${n} (${A.f.filter(f => f.was.includes(k)).length})`])])}
          ${wahlen('wo', [['', tx('aehnlichseite.an_jeder_stelle_der_aya')], ...Object.entries(NL.WO).map(([k, n]) => [k, tx('aehnlichseite.unterschied', { n })])])}
          ${wahlen('gr', [['', tx('aehnlichseite.jede_groesse')], ['2', tx('aehnlichseite.paare')], ['3', tx('aehnlichseite.3_bis_5_stellen')], ['6', tx('aehnlichseite.6_und_mehr_stellen')]])}
          ${wahlen('sort', [['mushaf', tx('aehnlichseite.reihenfolge_des_mushaf')], ['gross', tx('aehnlichseite.groesste_gruppen_zuerst')]])}</div></details>
        <p class="unter ah-klein"><mark class="ah-probe anders">${tx('aehnlichseite.unterlegt')}</mark> ${tx('aehnlichseite.ist_was_ein_wortlaut_anders_hat_als_die')}</p>
        ${fl.length ? `<p class="unter ah-klein" aria-live="polite">${tx('aehnlichseite.gruppen_mit_stellen', { n: fl.length, st, a: oben ? ` ${tx('aehnlichseite.gruppen_mit_einer_stelle_die_du_als')}` : '' })}</p>
          <div class="ah-stapel">${fl.slice(0, NA.zahl).map(e => familie(e.f)).join('')}</div>
          ${rest > 0 ? `<button class="knopf leise" id="f-mehr" style="margin-top:14px">${tx('aehnlichseite.weitere_zeigen_noch', { NA_SEITE: Math.min(NA_SEITE, rest), rest })}</button>` : ''}`
        : `<p class="leer" style="margin-top:16px" aria-live="polite">${tx('aehnlichseite.ist_keine_gruppe_aehnlicher_verse', { a: gefiltert ? tx('aehnlichseite.mit_diesen_filtern') : tx('aehnlichseite.zu', { wonach: esc(wonach) }), b: nur ? ` ${tx('aehnlichseite.in_deinem_bereich')}` : '' })}${draussen(NL.familienListe(A, t, a, { art: NA.art, was: NA.was, wo: NA.wo, gr: NA.gr }).length)}${tz ? ` ${tx('aehnlichseite.im_bereich_reihenfolge_gibt_es_dazu', { tz })} <button class="ah-verweis" data-tab="t">${tx('aehnlichseite.zeigen')}</button>` : ''}</p>`}`;
    } else {
      const drin = new Set(tl.map(x => x.k)), teile = [], nav = [];
      A.t.forEach((th, ti) => {
        const karten = th.gruppen.map(gr => { const l = gr.faelle.filter(x => drin.has(x.k)); return l.length ? fallKarte(gr, l) : ''; }).filter(Boolean);
        if (!karten.length) return;
        const n = th.gruppen.reduce((s, gr) => s + gr.faelle.filter(x => drin.has(x.k)).length, 0);
        nav.push(`<button class="ah-verweis" data-thema="${ti}">${mitAr(th.thema)}<small>${n}</small></button>`);
        teile.push(`<section class="ah-thema" id="thema-${ti}"><div><h2>${mitAr(th.thema)}</h2><p class="unter ah-klein">${mitAr(th.hinweis)}</p></div>${karten.join('')}</section>`);
      });
      feld.innerHTML = `<p class="unter ah-klein">${tx('aehnlichseite.dieselben_woerter_in_zwei_reihenfolgen')} <mark class="ah-probe kern">${tx('aehnlichseite.umrandet')}</mark> ${tx('aehnlichseite.sind_die_woerter_die_den_platz_tauschen')}</p>
        ${teile.length ? `<div class="ah-themen">${nav.join('')}</div>${a.aktiv ? `<p class="unter ah-klein" aria-live="polite">${tx('aehnlichseite.faelle_zu', { tz, wonach: esc(wonach) })}</p>` : ''}${teile.join('')}`
        : `<p class="leer" style="margin-top:16px" aria-live="polite">${tx('aehnlichseite.zu_ist_kein_reihenfolge_fall_verzeichnet', { wonach: esc(wonach), a: nur ? ` ${tx('aehnlichseite.in_deinem_bereich')}` : '' })}${draussen(NL.faelleListe(A, t, a).length)}${fz ? ` ${tx('aehnlichseite.im_bereich_aehnliche_verse_gibt_es_dazu', { fz })} <button class="ah-verweis" data-tab="f">${tx('aehnlichseite.zeigen')}</button>` : ''}</p>`}`;
    }
  };
  const neu = () => { NA.zahl = NA_SEITE; zeichnen(); };
  const reiter = tab => { NA.tab = tab; history.replaceState(null, '', '#aehnlich/' + tab); vorherigeAnsicht = location.hash; zeichnen(); };
  let warte = null;
  q.oninput = () => { clearTimeout(warte); warte = setTimeout(() => { NA.q = q.value; neu(); }, 200); };
  app.querySelector('#tast').onclick = ev => { const zu = tast.classList.toggle('verdeckt'); ev.currentTarget.setAttribute('aria-expanded', String(!zu)); };
  tast.onclick = ev => { const b = ev.target.closest('[data-b]')?.dataset.b; if (b == null) return; q.value = b === '⌫' ? q.value.slice(0, -1) : q.value + b; q.oninput(); };
  app.querySelector('.ah-zeile select').onchange = ev => { NA.sure = +ev.target.value; neu(); };
  app.querySelector('#abereich')?.addEventListener('click', ev => { const w = ev.target.dataset.w; if (w) { NA.bereich = w; neu(); } });
  app.querySelector('.ah-reiter').onclick = ev => { const b = ev.target.closest('[data-tab]'); if (b) reiter(b.dataset.tab); };
  feld.onchange = ev => { const f = ev.target.dataset.feld; if (f) { NA[f] = ev.target.value; neu(); } };
  feld.addEventListener('toggle', ev => { if (ev.target.matches?.('.ah-filter')) NA.filterAuf = ev.target.open; }, true);
  feld.onclick = ev => {
    // vor dem Wechsel zu einer Gruppe, in den Muṣḥaf oder zum Unterscheiden die Stelle in der Liste merken
    if (ev.target.closest('a[href]')) { NA.y = window.scrollY; return; }
    const b = ev.target.closest('button'); if (!b || kartenKlick(b)) return;
    if (b.id === 'f-mehr') { NA.zahl += NA_SEITE; zeichnen(); }
    else if (b.closest('#f-art')) { NA.art = b.dataset.w; neu(); }
    else if (b.dataset.tab) reiter(b.dataset.tab);
    else if ('alle' in b.dataset) { NA.bereich = 'alle'; neu(); }
    else if (b.dataset.thema) feld.querySelector('#thema-' + b.dataset.thema)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  zeichnen();
  if (NA.y != null) { const y = NA.y; NA.y = null; window.scrollTo(0, y); }
}
async function vergleichSeite(key, modus) {
  navSetzen(null);
  app.innerHTML = `<div class="lade">${tx('vergleichseite.wird_geladen')}</div>`;
  let x, t;
  try { [x, t] = await Promise.all([S.paar(key), S.textLaden()]); } catch (e) { app.innerHTML = `<p class="leer">${tx('vergleichseite.die_stellen_liessen_sich_nicht_laden')}</p>`; return; }
  if (!x) { location.replace('#aehnlich'); return; }
  const ueben = modus === 'ueben';
  let offen = !ueben;
  const stelleKarte = (vi, ab) => `<div class="vergleich-karte"><div class="vk-kopf">${tx('vergleichseite.s', { a: esc(sureName(D.V[vi][0])), b: D.V[vi][0], c: D.V[vi][1], vi: seiteVon(vi), d: abschnittVon(vi) ? '/' + abschnittVon(vi).id : '' })}</div>
    <div class="vk-text" dir="rtl">${ayaText(t, vi, offen ? { mark: new Set(ab), klasse: 'anders' } : { zu: new Set(ab) })}</div></div>`;
  const st = Z.P.mutash?.[key];
  const zeichnen = () => {
    app.innerHTML = `<button class="zurueck" onclick="location.hash='#aehnlich'">${zurueckPfeil}${tx('allg.aehnliche_stellen')}</button>
      <div class="marke">${ueben ? tx('vergleichseite.unterscheiden') : tx('vergleichseite.vergleich')}<small>${ueben ? (offen ? tx('vergleichseite.hast_du_beide_stellen_richtig') : tx('vergleichseite.rezitiere_beide_stellen_verdeckt_sind')) : tx('vergleichseite.gleich_markiert_sind_die_woerter_in', { s: x.s })}</small></div>
      ${stelleKarte(x.a, x.da)}${stelleKarte(x.b, x.db)}
      ${st ? `<p class="unter" style="margin-top:6px">${tx('vergleichseite.bisher_von_mal_richtig_unterschieden', { ok: st.ok, n: st.n })}</p>` : ''}
      <div class="reihe" style="margin-top:14px" id="vk-knoepfe">${!ueben ? `<a class="knopf haupt" href="#vergleich/${key}/ueben" style="text-decoration:none">${tx('vergleichseite.unterscheiden_ueben')}</a>`
        : !offen ? `<button class="knopf haupt" id="vk-auf">${tx('vergleichseite.aufdecken')}</button>`
        : `<button class="knopf schlecht" id="vk-f">${tx('vergleichseite.verwechselt')}</button><button class="knopf gut" id="vk-r">${tx('vergleichseite.beide_richtig')}</button>`}</div>`;
    const auf = app.querySelector('#vk-auf'); if (auf) auf.onclick = () => { offen = true; zeichnen(); };
    const bew = ok => { Z.unterscheidenMerken(key, ok); toast(ok ? tx('vergleichseite.gut_unterschieden') : tx('vergleichseite.gemerkt_vergleiche_die_markierten')); naechstes(); };
    const r = app.querySelector('#vk-r'); if (r) r.onclick = () => bew(true);
    const f = app.querySelector('#vk-f'); if (f) f.onclick = () => bew(false);
  };
  // nach der Bewertung: zurück zum Vergleich mit dem Ergebnis und dem Weg zum nächsten Paar im eigenen Bereich
  const naechstes = async () => {
    const paare = await S.paareLaden(), mein = y => Z.imBereich(vonAbschnitt(y.a)) || Z.imBereich(vonAbschnitt(y.b));
    const l = paare.filter(mein), i = l.findIndex(y => y.key === key), n = l[(i + 1) % l.length];
    app.querySelector('#vk-knoepfe').innerHTML = `<a class="knopf leise" href="#vergleich/${key}" style="text-decoration:none">${tx('vergleichseite.noch_einmal_ansehen')}</a>${n && n.key !== key ? `<a class="knopf haupt" href="#vergleich/${n.key}/ueben" style="text-decoration:none">${tx('vergleichseite.naechstes_paar')}</a>` : ''}`;
  };
  zeichnen();
}

// ---------- Fehlerstellen ----------
function fehlerstellenSeite() {
  navSetzen('profil');
  const fl = Z.fehlerstellenListe(500);
  for (const f of fl) for (const d of [-1, 0, 1]) { const w = D.W.get(f.vi + '.' + (f.i + d)); if (w) schrift(w[3]); }
  const wortBild = k => { const [vi, i] = k.split('.').map(Number); return wortHTML(vi, i); };
  const abschnittVon = vi => D.A.find(e => vi >= e.v[0] && vi <= e.v[1]);
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#profil'">${zurueckPfeil}${tx('allg.profil')}</button>
    <div class="marke">${tx('allg.fehlerstellen')}<small>${tx('fehlerstellenseite.die_woerter_bei_denen_du_dich_vertan')}</small></div>
    <div style="margin-top:16px">${fl.length ? fl.map(f => {
      const w = D.W.get(f.s); if (!w) return '';
      const arten = Object.entries(f.t).sort((a, b) => b[1] - a[1]).map(([x]) => Z.FEHLERARTEN.find(y => y[0] === x)?.[1]).filter(Boolean).join(komma());
      const ab = abschnittVon(f.vi), gut = f.gut || 0;
      return `<div class="fs-karte" data-vi="${f.vi}"><a class="wortbild" href="#mushaf/${w[0]}" aria-label="${tx('fehlerstellenseite.im_mushaf_zeigen')}"><span class="nb">${wortBild(f.vi + '.' + (f.i - 1))}</span>${wortBild(f.s)}<span class="nb">${wortBild(f.vi + '.' + (f.i + 1))}</span></a>
        <div class="fs-unten"><div class="t"><b>${sureName(D.V[f.vi][0])} ${D.V[f.vi][0]}:${D.V[f.vi][1]}</b><span>${tx('fehlerstellenseite.vertan', { n: f.n, a: arten ? ' · ' + arten : '' })}</span>
          <span class="fs-fort" title="${tx('fehlerstellenseite.richtig_in_folge')}">${Array.from({ length: Z.STELLE_ZIEL }, (_, k) => `<i class="${k < gut ? 'an' : ''}"></i>`).join('')}</span></div>
          ${ab ? `<a class="knopf haupt klein" href="#ueben/${ab.id}/stelle/${f.vi}" style="width:auto;text-decoration:none">${tx('allg.ueben')}</a>` : ''}</div></div>`;
    }).join('') : `<p class="leer">${tx('fehlerstellenseite.wenn_du_nach_fehler_auf_das_wort_tippst')}</p>`}</div>`;
  schriftAbgleichen(app).catch(() => {});
  // ähnliche Stellen nachtragen, sobald die Liste geladen ist
  // Paar: zum Vergleich. Größere Gruppe, wortgleiche Stelle oder Reihenfolge-Fall: zum Nachschlagen
  Promise.all([NL.laden(), S.paareLaden()]).then(([A, paare]) => app.querySelectorAll('.fs-karte[data-vi]').forEach(k => {
    const vi = +k.dataset.vi, bei = A.vonVi.get(vi), f = bei?.f.length ? A.FK[bei.f[0]] : null, p = paare.find(x => x.a === vi || x.b === vi);
    const zeile = (ziel, text) => k.querySelector('.t')?.insertAdjacentHTML('beforeend', `<a class="fs-aehnlich" href="${ziel}">${text}</a>`);
    if (f && f.s.length > 2) zeile(`#aehnlich/f/${f.k}`, `${tx('fehlerstellenseite.eine_von_aehnlichen_stellen', { n: f.s.length })} · ${tx('fehlerstellenseite.nachschlagen')}`);
    else if (p) { const ander = p.a === vi ? p.b : p.a; zeile(`#vergleich/${p.key}`, `${tx('fehlerstellenseite.aehnlich_wie', { ander: NL.stelleKurz(ander) })} · ${tx('fehlerstellenseite.vergleichen')}`); }
    else if (f) { const ander = f.s.find(x => x !== vi); zeile(`#aehnlich/f/${f.k}`, `${f.art === 'gleich' ? tx('fehlerstellenseite.gleicher_wortlaut_wie') : tx('fehlerstellenseite.aehnlich_wie_2')} ${NL.stelleKurz(ander)} · ${tx('fehlerstellenseite.nachschlagen')}`); }
    if (bei?.t.length) zeile(`#aehnlich/t/${bei.t[0]}`, `${tx('fehlerstellenseite.woerter_in_anderer_reihenfolge_an')} · ${tx('fehlerstellenseite.nachschlagen')}`);
  })).catch(() => {});
}

// ---------- Einstellungen ----------
const TAGE = [tx('tage.montag'), tx('tage.dienstag'), tx('tage.mittwoch'), tx('tage.donnerstag'), tx('tage.freitag'), tx('tage.samstag'), tx('tage.sonntag')];
const SCHWACH_TEXT = {
  khatma: tx('schwach_text.nur_die_wiederholung_nach_fehlern_nach_1'),
  ausgewogen: tx('schwach_text.schwache_abschnitte_kommen_zwischen_zwei'),
  schwaechen: tx('schwach_text.schwache_abschnitte_kommen_etwa_doppelt')
};
// Pause: bis zu 30 Tage ohne Wird
function pauseHTML() {
  const p = Z.pauseJetzt(), kuenftig = (Z.P.pausen || []).find(x => x.von > Z.heute());
  if (p || kuenftig) { const x = p || kuenftig; return `<p class="unter">${tx('pausehtml.bis_die_kette_wartet', { a: p ? tx('pausehtml.deine_pause_laeuft') : tx('pausehtml.deine_pause_beginnt_am_und_laeuft', { von: tagLang(x.von) }), bis: tagLang(x.bis) })}</p><button class="knopf leise" id="pause-ende" style="margin-top:10px">${tx('pausehtml.pause_beenden')}</button>`; }
  return `<p class="unter">${tx('pausehtml.fuer_reisen_krankheit_oder_volle_wochen', { PAUSE_MAX: Z.PAUSE_MAX })}</p>
    <label class="auswahl" style="margin-top:10px"><span>${tx('pausehtml.dauer')}</span><select id="pause-tage">${optionen([3, 7, 10, 14, 21, 30], 7, x => `${x} ${tx('pausehtml.tage')}`)}</select></label>
    <button class="knopf leise" id="pause-los" style="margin-top:10px">${tx('pausehtml.pause_beginnen')}</button>`;
}
function pauseBinden() {
  const los = app.querySelector('#pause-los'), ende = app.querySelector('#pause-ende');
  if (los) los.onclick = async () => {
    const n = +app.querySelector('#pause-tage').value, t = Z.P.tage[Z.heute()];
    const ab = t && !t.ruhe && t.fertig.length ? Z.plusTage(Z.heute(), 1) : Z.heute();
    if (!await dialog({ titel: tx('pausebinden.pause_beginnen_2'), html: `<p>${tx('pausebinden.tage_ohne_wird_bis_du_kannst_sie', { n, a: ab === Z.heute() ? tx('pausebinden.ab_heute') : tx('pausebinden.ab_morgen'), tagLang: tagLang(Z.plusTage(ab, n - 1)) })}</p>`, ja: tx('pausebinden.pause_beginnen') })) return;
    Z.pauseBeginnen(n); toast(tx('pausebinden.pause_eingetragen')); einstellungen();
  };
  if (ende) ende.onclick = () => { Z.pauseBeenden(); toast(tx('pausebinden.die_pause_ist_beendet')); einstellungen(); };
}
const optionen = (werte, wahl, text = x => x) => werte.map(x => `<option value="${x}"${x === wahl ? ' selected' : ''}>${text(x)}</option>`).join('');
function einstellungen() {
  navSetzen('profil');
  const P = Z.P, E = P.einst;
  // Wählbar ist jede freigegebene Sprache, dazu die gerade geladene (so kommt man aus einer Probesprache zurück)
  const sprachen = SPRACHEN.filter(s => s.frei || s.code === gebiet('code'));
  const sel = E.auswahl ? ausBereiche(E.auswahl) : E.bereich ? ausAbschnitten(E.bereich) : alles();
  const bis = n => Array.from({ length: Math.max(30, n) }, (_, i) => i + 1);
  const gleich = () => E.pensum.every(x => x === E.pensum[0]);
  const [hh, mm] = (E.erinnerung || '05:30').split(':').map(Number);
  const minuten = [...new Set([...Array.from({ length: 12 }, (_, i) => i * 5), mm])].sort((a, b) => a - b);
  const zwei = x => String(x).padStart(2, '0');
  const ANKER = { fajr: tx('einstellungen.anker_fajr'), zuhr: tx('einstellungen.anker_zuhr'), asr: tx('einstellungen.anker_asr'), maghrib: tx('einstellungen.anker_maghrib'), isha: tx('einstellungen.anker_isha'), schlaf: tx('einstellungen.anker_schlaf') };
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#profil'">${zurueckPfeil}${tx('allg.profil')}</button>
    <div class="marke">${tx('allg.einstellungen')}</div>
    <div class="abschnitt"><h3>${tx('einstellungen.name')}</h3><div class="feld"><input type="text" id="name" aria-label="${tx('einstellungen.name')}" autocomplete="given-name" value="${esc(P.name)}"></div></div>
    <div class="abschnitt"><h3>${tx('einstellungen.erscheinungsbild')}</h3><div class="wahl" id="thema">${[['hell', tx('einstellungen.hell')], ['dunkel', tx('einstellungen.dunkel')], ['auto', tx('einstellungen.wie_geraet')]].map(([w, l]) => `<button data-w="${w}" class="${E.thema === w ? 'an' : ''}">${l}</button>`).join('')}</div></div>
    ${sprachen.length > 1 ? `<div class="abschnitt"><h3>${tx('einstellungen.sprache')}</h3><div class="wahl" id="sprache">${sprachen.map(s => `<button data-w="${s.code}" lang="${s.code}" class="${s.code === gebiet('code') ? 'an' : ''}">${s.name}</button>`).join('')}</div></div>` : ''}
    <div class="abschnitt"><h3>${tx('einstellungen.druckausgabe_des_mushaf')}</h3>
      <div class="wahl" id="ausgabe" style="margin-top:10px">${[['v1', tx('einstellungen.druck_1405')], ['v2', tx('einstellungen.druck_1421')]].map(([w, l]) => `<button data-w="${w}" class="${(E.ausgabe || 'v2') === w ? 'an' : ''}">${l}</button>`).join('')}</div>
      <p class="unter" style="margin-top:8px">${tx('einstellungen.beide_madani_drucke_mit_ihren_eigenen')}</p>
      <label class="auswahl" style="margin-top:14px"><span>${tx('einstellungen.herkunft')}</span><select id="herkunft">${[['madina', tx('einstellungen.herkunft_madina')], ['indopak', tx('einstellungen.herkunft_indopak')], ['tuerkisch', tx('einstellungen.herkunft_tuerkisch')], ['andere', tx('einstellungen.herkunft_andere')]].map(([w, l]) => `<option value="${w}"${(E.herkunft || 'madina') === w ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <p class="unter" style="margin-top:6px">${tx('einstellungen.herkunft_text')}</p></div>
    <div class="abschnitt"><h3>${tx('einstellungen.was_du_wiederholst')}</h3><div id="auswahl"></div><div class="hinweisbox verdeckt" id="heute-frage" role="status"></div></div>
    <div class="abschnitt"><h3>${tx('einstellungen.laenge_der_abschnitte')}</h3>${modusWahl(E.modus || 'fort')}</div>
    <div class="abschnitt" id="pensum-block"><h3>${tx('einstellungen.abschnitte_pro_tag')}</h3><p class="unter">${tx('einstellungen.fuer_alle_tage_gleich_oder_pro_wochentag')}</p>
      <div class="auswahl stark"><span>${tx('einstellungen.alle_tage')}</span><span class="schritt" data-s="alle"><button type="button" data-d="-1" aria-label="${tx('start.weniger')}">−</button><b aria-live="polite">${gleich() ? E.pensum[0] : tx('einstellungen.verschieden')}</b><button type="button" data-d="1" aria-label="${tx('start.mehr')}">+</button></span></div>
      <button type="button" class="knopf leise klein" id="tage-einzeln" aria-expanded="${gleich() ? 'false' : 'true'}" style="margin-top:10px">${gleich() ? tx('einstellungen.tage_einzeln') : tx('einstellungen.tage_einzeln_aus')}</button>
      <div class="tagesliste${gleich() ? ' verdeckt' : ''}" style="margin-top:10px">${TAGE.map((w, i) => `<div class="auswahl"><span>${w}</span><span class="schritt" data-s="${i}"><button type="button" data-d="-1" aria-label="${tx('start.weniger')}">−</button><b aria-live="polite">${E.pensum[i] || tx('allg.ruhetag')}</b><button type="button" data-d="1" aria-label="${tx('start.mehr')}">+</button></span></div>`).join('')}</div>
      <p class="unter" style="margin-top:10px" id="dauer">${tx('einstellungen.eine_hatma_dauert_damit_etwa_tage', { tageProKhatma: Z.tageProKhatma(true) })}</p></div>
    <div class="abschnitt"><h3>${tx('einstellungen.reihenfolge')}</h3><div class="wahl reihenfolge-wahl" id="reihenfolge">${[['vorwaerts', `${tx('einstellungen.vorwaerts')}<small>${tx('einstellungen.bsp_vorwaerts')}</small>`], ['rueckwaerts', `${tx('einstellungen.rueckwaerts')}<small>${tx('einstellungen.bsp_rueckwaerts')}</small>`], ['zufall', tx('einstellungen.zufaellig')]].map(([w, l]) => `<button data-w="${w}" class="${E.reihenfolge === w ? 'an' : ''}">${l}</button>`).join('')}</div>
      <div id="zufallwahl" class="${E.reihenfolge === 'zufall' ? '' : 'verdeckt'}" style="margin-top:12px"><p class="unter">${tx('einstellungen.bei_mehreren_abschnitten_am_tag')}</p>
        <div class="wahl" id="zufall" style="margin-top:8px">${[['einzeln', tx('einstellungen.verstreute_stellen')], ['block', tx('einstellungen.eine_stelle_am_stueck')]].map(([w, l]) => `<button data-w="${w}" class="${E.zufall === w ? 'an' : ''}">${l}</button>`).join('')}</div>
        <p class="unter" style="margin-top:8px">${tx('einstellungen.jede_hatma_bleibt_vollstaendig_zufaellig')}</p></div></div>
    <div class="abschnitt"><h3>${tx('einstellungen.ablauf_titel')}</h3>
      <div class="wahl" id="ablauf" style="margin-top:10px"><button data-w="vers" class="${E.ablauf === 'ganz' ? '' : 'an'}">${tx('einstellungen.ablauf_vers')}</button><button data-w="ganz" class="${E.ablauf === 'ganz' ? 'an' : ''}">${tx('einstellungen.ablauf_ganz')}</button></div>
      ${optionsListe([tx('einstellungen.ablauf_text')])}</div>
    <div class="abschnitt"><h3>${tx('einstellungen.rhythmus')}</h3>
      <div class="wahl" id="rhythmus" style="margin-top:10px"><button data-w="khatma" class="${E.rhythmus === 'langzeit' ? '' : 'an'}">${tx('einstellungen.rhythmus_klassisch')}</button><button data-w="langzeit" class="${E.rhythmus === 'langzeit' ? 'an' : ''}">${tx('einstellungen.rhythmus_langzeit')}</button></div>
      ${optionsListe([tx('einstellungen.rhythmus_text')])}</div>
    <div class="abschnitt${E.rhythmus === 'langzeit' ? ' gedimmt' : ''}" id="schwach-block"><h3>${tx('einstellungen.schwache_abschnitte')}</h3><p class="unter schwach-hinweis${E.rhythmus === 'langzeit' ? '' : ' verdeckt'}">${tx('einstellungen.schwach_langzeit')}</p><p class="unter">${tx('einstellungen.abschnitte_in_denen_du_dich_zuletzt')}</p>
      <div class="wahl" id="schwaechen" style="margin-top:10px">${[['khatma', tx('einstellungen.hatma_zuerst')], ['ausgewogen', tx('einstellungen.ausgewogen')], ['schwaechen', tx('einstellungen.schwaechen_zuerst')]].map(([w, l]) => `<button data-w="${w}" class="${(E.schwaechen || 'ausgewogen') === w ? 'an' : ''}">${l}</button>`).join('')}</div>
      <p class="unter" style="margin-top:8px" id="schwach-text">${SCHWACH_TEXT[E.schwaechen || 'ausgewogen']}</p></div>
    <div class="abschnitt"><h3>${tx('einstellungen.zielquote')}</h3><p class="unter">${tx('einstellungen.zielquote_text')}</p>
      <div class="wahl" id="zielquote" style="margin-top:10px">${[90, 95, 98].map(w => `<button data-w="${w}" class="${(E.zielQuote ?? 95) === w ? 'an' : ''}">${prozent(w)}</button>`).join('')}</div></div>
    <div class="abschnitt" id="lesbarkeit"><h3>${tx('einstellungen.lesbarkeit')}</h3><p class="unter">${tx('einstellungen.seitengroesse_so_gross_erscheint_die')}</p>
      <div class="wahl" id="seitengroesse" role="group" aria-label="${tx('einstellungen.seitengroesse')}" style="margin-top:10px">${[100, 125, 150].map(w => `<button data-w="${w}" class="${(E.seitenGroesse || 100) === w ? 'an' : ''}">${prozent(w)}</button>`).join('')}</div>
      <p class="unter" style="margin-top:14px">${tx('einstellungen.schriftgroesse_texte_knoepfe_und')}</p>
      <div class="wahl" id="textgroesse" role="group" aria-label="${tx('einstellungen.schriftgroesse')}" style="margin-top:10px">${[[100, tx('einstellungen.normal')], [112, tx('einstellungen.gross')], [125, tx('einstellungen.sehr_gross')]].map(([w, l]) => `<button data-w="${w}" class="${(E.textGroesse || 100) === w ? 'an' : ''}">${l}</button>`).join('')}</div>
      <p class="lesbar-probe">${tx('einstellungen.mit_zwei_fingern_kannst_du_ausserdem')}</p></div>
    <details class="einst-gruppe"><summary>${tx('einstellungen.gruppe_funktionen')}</summary>
    <div class="abschnitt"><h3>${tx('einstellungen.erst_ansehen_dann_pruefen')}</h3><p class="unter">${tx('einstellungen.vor_der_ersten_aya_kannst_du_den')}</p>
      <div class="wahl" id="vorueben" style="margin-top:10px"><button data-w="1" class="${E.vorueben ? 'an' : ''}">${tx('einstellungen.anbieten')}</button><button data-w="0" class="${E.vorueben ? '' : 'an'}">${tx('einstellungen.aus')}</button></div></div>
    <div class="abschnitt"><h3>${tx('einstellungen.hilfe_beim_aufdecken')}</h3><p class="unter">${tx('einstellungen.erstes_wort_zeigt_den_anfang_der_aya')}</p>
      <div class="wahl" id="hilfe" style="margin-top:10px"><button data-w="1" class="${E.hilfe ? 'an' : ''}">${tx('einstellungen.erlaubt')}</button><button data-w="0" class="${E.hilfe ? '' : 'an'}">${tx('einstellungen.aus')}</button></div></div>
    <div class="abschnitt"><h3>${tx('einstellungen.sofortkorrektur')}</h3><p class="unter">${tx('einstellungen.hattest_du_in_einem_abschnitt_fehler')}</p>
      <div class="wahl" id="sofort" style="margin-top:10px"><button data-w="1" class="${E.sofort !== false ? 'an' : ''}">${tx('einstellungen.an')}</button><button data-w="0" class="${E.sofort !== false ? '' : 'an'}">${tx('einstellungen.aus')}</button></div></div>
    <div class="abschnitt"><h3>${tx('einstellungen.abhoeren_durch_eine_zweite_person')}</h3><p class="unter">${tx('einstellungen.zu_beginn_eines_abschnitts_steht_klein')}</p>
      <div class="wahl" id="abhoeren" style="margin-top:10px"><button data-w="1" class="${E.abhoeren !== false ? 'an' : ''}">${tx('einstellungen.anbieten')}</button><button data-w="0" class="${E.abhoeren !== false ? '' : 'an'}">${tx('einstellungen.aus')}</button></div></div>
    <div class="abschnitt"><h3>${tx('einstellungen.hasanat_titel')}</h3><p class="unter">${tx('einstellungen.hasanat_text')}</p>
      <div class="wahl" id="hasanat" style="margin-top:10px"><button data-w="1" class="${E.hasanat !== false ? 'an' : ''}">${tx('einstellungen.hasanat_zeigen')}</button><button data-w="0" class="${E.hasanat !== false ? '' : 'an'}">${tx('einstellungen.hasanat_ausblenden')}</button></div></div>
    </details>
    <details class="einst-gruppe"><summary>${tx('einstellungen.gruppe_zeit')}</summary>
    <div class="abschnitt"><h3>${tx('einstellungen.pause')}</h3>${pauseHTML()}</div>
    <div class="abschnitt"><h3>${tx('einstellungen.dein_tag_beginnt_um')}</h3><p class="unter">${tx('einstellungen.vorgabe_ist_3_uhr_ein_wird_um_1_uhr')}</p>
      <label class="auswahl" style="margin-top:10px"><span>${tx('einstellungen.tageswechsel')}</span><select id="tagesbeginn">${optionen([0, 1, 2, 3, 4, 5], E.tagesbeginn || 0, x => x ? tx('einstellungen.um_uhr', { x }) : tx('einstellungen.mitternacht'))}</select></label></div>
    <div class="abschnitt"><h3>${tx('einstellungen.taegliche_erinnerung')}</h3><p class="unter">${tx('einstellungen.ohne_server_kann_die_app_selbst_keine')}</p>
      <div class="zeitwahl"><select id="std" aria-label="${tx('einstellungen.stunde')}">${optionen(Array.from({ length: 24 }, (_, i) => i), hh, zwei)}</select><b>:</b><select id="min" aria-label="${tx('einstellungen.minute')}">${optionen(minuten, mm, zwei)}</select><span>${tx('einstellungen.uhr')}</span></div>
      <label class="auswahl" style="margin-top:10px"><span>${tx('einstellungen.anker')}</span><select id="anker">${['', 'fajr', 'zuhr', 'asr', 'maghrib', 'isha', 'schlaf'].map(k => `<option value="${k}"${(E.anker || '') === k ? ' selected' : ''}>${k ? ANKER[k] : tx('einstellungen.anker_ohne')}</option>`).join('')}</select></label>
      <p class="unter" style="margin-top:6px">${tx('einstellungen.anker_text')}</p>
      <button class="knopf leise" id="ics" style="margin-top:10px">${tx('einstellungen.in_den_kalender_eintragen')}</button></div>
    </details>
    <details class="einst-gruppe"><summary>${tx('einstellungen.gruppe_wiederherstellung')}</summary>
    <div class="abschnitt"><h3>${tx('einstellungen.offline')}</h3><p class="unter">${tx('einstellungen.laedt_alle_604_seiten_des_drucks_damit', { a: D.ausgabe === 'v1' ? tx('einstellungen.1405_etwa_48_mb') : tx('einstellungen.1421_etwa_95_mb') })}</p>
      <p class="offline-stand" id="offline-stand">${tx('einstellungen.gespeicherte_seiten_werden_gezaehlt')}</p><div class="balken verdeckt" id="offline-balken"><div style="width:0%"></div></div>
      <button class="knopf leise" id="offline" style="margin-top:10px">${tx('einstellungen.alle_seiten_speichern')}</button></div>
    <div class="abschnitt"><h3>${tx('einstellungen.schnappschuesse')}</h3><p class="unter">${tx('einstellungen.itqan_legt_einmal_am_tag_und_vor')}</p>
      <div style="margin-top:10px">${schnappschussListe()}</div></div>
    <div class="abschnitt"><h3>${tx('einstellungen.quellen')}</h3><p class="unter">${tx('einstellungen.die_schriften_der_mushaf_seiten_drucke')}</p></div>
    <div class="abschnitt"><h3>${tx('einstellungen.neu_beginnen')}</h3><p class="unter">${tx('einstellungen.loescht_dein_profil_auf_diesem_geraet')}</p><button class="knopf schlecht" id="reset" style="margin-top:10px">${tx('einstellungen.profil_loeschen')}</button></div>
    </details>`;
  const dauer = () => app.querySelector('#dauer').innerHTML = tx('einstellungen.eine_hatma_dauert_damit_etwa_tage', { tageProKhatma: Z.tageProKhatma(true) });
  app.querySelector('#name').onchange = ev => { P.name = ev.target.value.trim(); Z.speichern(); toast(tx('einstellungen.gespeichert')); };
  const wahl = (id, fn) => app.querySelector('#' + id).onclick = ev => { const w = ev.target.dataset.w; if (w == null) return; app.querySelectorAll(`#${id} button`).forEach(b => b.classList.toggle('an', b.dataset.w === w)); fn(w); Z.speichern(); };
  wahl('thema', w => { E.thema = w; themaAnwenden(); });
  // Die Sprache gilt für das Gerät und wird beim Start geladen, deshalb lädt die App nach der Wahl neu
  if (sprachen.length > 1) app.querySelector('#sprache').onclick = ev => {
    const w = ev.target.dataset.w; if (!w || w === gebiet('code')) return;
    spracheMerken(w);
    const u = new URL(location.href); u.searchParams.delete('sprache'); history.replaceState(null, '', u);
    location.reload();
  };
  wahl('seitengroesse', w => { E.seitenGroesse = +w; themaAnwenden(); });
  wahl('textgroesse', w => { E.textGroesse = +w; themaAnwenden(); });
  // Die neue Reihenfolge gilt sofort: der Plan von heute wird neu aufgebaut; wer heute schon Abschnitte abgegeben hat, wird einmal gewarnt
  app.querySelector('#reihenfolge').onclick = async ev => {
    const w = ev.target.closest('button')?.dataset.w; if (w == null || w === E.reihenfolge) return;
    const zy = Z.heuteZyklus();
    if (!zy.voll && zy.fertig && !await dialog({ titel: tx('einstellungen.reihenfolge_dialog_titel'), html: `<p>${tx('einstellungen.reihenfolge_dialog_text', { n: zy.n })}</p>`, ja: tx('einstellungen.reihenfolge_dialog_ja'), gefahr: true })) return;
    E.reihenfolge = w; app.querySelectorAll('#reihenfolge button').forEach(b => b.classList.toggle('an', b.dataset.w === w));
    app.querySelector('#zufallwahl').classList.toggle('verdeckt', w !== 'zufall'); dauer();
    Z.heuteNeuAufbauen(); Z.speichern(); toast(zy.voll ? tx('einstellungen.reihenfolge_ab_morgen') : tx('einstellungen.reihenfolge_sofort'));
  };
  wahl('zufall', w => { E.zufall = w; toast(tx('einstellungen.gilt_ab_dem_naechsten_tagesplan')); });
  wahl('vorueben', w => { E.vorueben = w === '1'; });
  wahl('ausgabe', w => { if (w === E.ausgabe) return; if (E.modus === 'seite') Z.schnappschuss('vor dem Gliederungswechsel'); E.ausgabe = w; Z.speichern(); location.reload(); });
  wahl('modus', w => { if (w === (E.modus || 'fort')) return; Z.schnappschuss('vor dem Gliederungswechsel'); E.modus = w; Z.speichern(); toast(tx('einstellungen.abschnitte_werden_umgestellt')); setTimeout(() => location.reload(), 600); });
  wahl('hilfe', w => { E.hilfe = w === '1'; });
  wahl('hasanat', w => { E.hasanat = w === '1'; });
  wahl('zielquote', w => { E.zielQuote = +w; });
  app.querySelector('#herkunft').onchange = ev => { E.herkunft = ev.target.value; Z.speichern(); };
  wahl('rhythmus', w => {
    E.rhythmus = w; toast(tx('einstellungen.gilt_ab_dem_naechsten_tagesplan'));
    app.querySelector('#schwach-block').classList.toggle('gedimmt', w === 'langzeit'); app.querySelector('.schwach-hinweis').classList.toggle('verdeckt', w !== 'langzeit');
  });
  wahl('schwaechen', w => { E.schwaechen = w; app.querySelector('#schwach-text').textContent = SCHWACH_TEXT[w]; dauer(); toast(tx('einstellungen.gilt_ab_dem_naechsten_tagesplan')); });
  pauseBinden();
  wahl('sofort', w => { E.sofort = w === '1'; });
  wahl('abhoeren', w => { E.abhoeren = w === '1'; });
  wahl('ablauf', w => { E.ablauf = w; toast(tx('einstellungen.ablauf_gilt')); });
  app.querySelector('#tagesbeginn').onchange = ev => { E.tagesbeginn = +ev.target.value; Z.speichern(); toast(tx('einstellungen.gilt_ab_sofort')); };
  app.querySelector('#tage-einzeln').onclick = ev => {
    const zu = app.querySelector('.tagesliste').classList.toggle('verdeckt');
    ev.target.setAttribute('aria-expanded', String(!zu)); ev.target.textContent = zu ? tx('einstellungen.tage_einzeln') : tx('einstellungen.tage_einzeln_aus');
  };
  // Abschnitte pro Tag mit Plus und Minus: „Alle Tage“ setzt jeden Tag, bei verschiedenen Werten zählt der Durchschnitt; ein Tag darf auf 0 (Ruhetag), mindestens ein Tag bleibt
  const pensumZeigen = () => {
    const bl = app.querySelector('#pensum-block');
    bl.querySelectorAll('.schritt').forEach(st => {
      const alleTage = st.dataset.s === 'alle', w = alleTage ? (gleich() ? E.pensum[0] : null) : E.pensum[+st.dataset.s];
      st.querySelector('b').textContent = alleTage ? (gleich() ? w : tx('einstellungen.verschieden')) : (w || tx('allg.ruhetag'));
      const [minus, plus] = st.querySelectorAll('button'); minus.disabled = alleTage ? (w != null && w <= 1) : w <= 0; plus.disabled = w != null && w >= 30;
    });
  };
  app.querySelector('#pensum-block').onclick = ev => {
    const b = ev.target.closest('button[data-d]'); if (!b) return;
    const st = b.closest('.schritt'), d = +b.dataset.d;
    if (st.dataset.s === 'alle') {
      const pos = E.pensum.filter(v => v > 0), basis = gleich() ? E.pensum[0] : Math.round(pos.reduce((a, c) => a + c, 0) / pos.length);
      E.pensum = Array(7).fill(Math.min(30, Math.max(1, basis + d)));
    } else {
      const i = +st.dataset.s, n = Math.min(30, Math.max(0, E.pensum[i] + d));
      if (n === 0 && E.pensum.filter((v, k) => v > 0 && k !== i).length === 0) { toast(tx('einstellungen.mindestens_ein_tag_braucht_einen_wird')); return; }
      E.pensum[i] = n;
    }
    Z.speichern(); dauer(); pensumZeigen();
  };
  pensumZeigen();
  // Alles abwählen ist erlaubt (bequem zum Neuwählen); gespeichert wird erst, wenn etwas gewählt ist
  const frage = app.querySelector('#heute-frage');
  const frageZeigen = () => {   // steht auf dem Plan von heute noch Offenes außerhalb der neuen Auswahl, wird angeboten, es zu ersetzen
    const n = Z.heuteAusserhalb().length;
    frage.classList.toggle('verdeckt', !n);
    if (n) frage.innerHTML = `<p>${tx('auswahl.heute_frage', { n })}</p><div class="reihe" style="margin-top:10px"><button type="button" class="knopf haupt klein" data-ja>${tx('auswahl.heute_ersetzen')}</button><button type="button" class="knopf leise klein" data-nein>${tx('auswahl.heute_lassen')}</button></div>`;
  };
  frage.onclick = ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if ('ja' in b.dataset) { Z.heuteAnBereichAnpassen(); toast(tx('auswahl.heute_angepasst')); }
    frage.classList.add('verdeckt');
  };
  wahlZeichnen(app.querySelector('#auswahl'), sel, s => {
    if (istLeer(s)) return;
    if (istAlles(s)) { E.bereich = null; delete E.auswahl; } else { E.auswahl = zuBereichen(s); E.bereich = zuAbschnitten(s); }
    Z.speichern(); dauer(); frageZeigen();
  }, { leer: tx('auswahl.leer_einst') });
  const verlassen = () => { removeEventListener('hashchange', verlassen); if (istLeer(sel)) toast(tx('auswahl.leer_verlassen')); };
  addEventListener('hashchange', verlassen);
  const zeit = () => { E.erinnerung = `${zwei(app.querySelector('#std').value)}:${zwei(app.querySelector('#min').value)}`; Z.speichern(); };
  app.querySelector('#std').onchange = zeit; app.querySelector('#min').onchange = zeit;
  app.querySelector('#anker').onchange = ev => { E.anker = ev.target.value; Z.speichern(); };
  app.querySelector('#ics').onclick = () => {
    const [h, m] = (E.erinnerung || '05:30').split(':'), d = Z.heute().replace(/-/g, '');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Itqan//Wird//DE', 'BEGIN:VEVENT', `UID:itqan-wird-${Date.now()}@itqan`, `DTSTAMP:${stamp}`,
      `DTSTART:${d}T${h}${m}00`, 'DURATION:PT20M', 'RRULE:FREQ=DAILY', `SUMMARY:${tx('einstellungen.kalender_titel')}${E.anker ? ' · ' + ANKER[E.anker] : ''}`, `DESCRIPTION:${tx('einstellungen.kalender_text')}. ${location.href.split('#')[0]}`,
      'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${tx('einstellungen.kalender_text')}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    herunterladen('Itqan-Wird.ics', ics, 'text/calendar');
  };
  // Stand anzeigen, nur fehlende Seiten laden, Abbrüche zählen und „Erneut versuchen“ anbieten
  const stand = app.querySelector('#offline-stand'), balken = app.querySelector('#offline-balken'), ob = app.querySelector('#offline');
  const standZeigen = async () => {
    const da = await gespeicherteSeiten();
    if (!da) { stand.textContent = tx('einstellungen.dieser_browser_kann_keine_seiten'); ob.disabled = true; return null; }
    stand.innerHTML = da.size >= 604 ? tx('einstellungen.alle_604_seiten_sind_gespeichert_itqan') : tx('einstellungen.von_604_seiten_sind_auf_diesem_geraet', { size: da.size });
    ob.textContent = da.size >= 604 ? tx('einstellungen.alle_seiten_gespeichert') : da.size ? tx('einstellungen.fehlende_seiten_speichern') : tx('einstellungen.alle_seiten_speichern');
    ob.disabled = da.size >= 604; return da;
  };
  standZeigen();
  schnappschussBinden(app);
  ob.onclick = async () => {
    const da = await standZeigen(); if (!da) return;
    const fehlt = Array.from({ length: 604 }, (_, i) => i + 1).filter(x => !da.has(x));
    const cache = await caches.open(SEITEN_CACHE);
    ob.disabled = true; balken.classList.remove('verdeckt');
    let fertig = 0, fehler = 0;
    for (let i = 0; i < fehlt.length; i += 6) {
      await Promise.all(fehlt.slice(i, i + 6).map(async x => { try { await cache.add(seitenUrl(x)); } catch (e) { fehler++; } fertig++; }));
      balken.firstElementChild.style.width = (100 * fertig / fehlt.length).toFixed(1) + '%';
      stand.innerHTML = tx('einstellungen.speichere_von_604', { a: da.size + fertig - fehler });
      if (!app.contains(ob)) return;
    }
    balken.classList.add('verdeckt');
    await standZeigen();
    if (fehler) { stand.innerHTML += `<br>${tx('einstellungen.seiten_konnten_nicht_geladen_werden', { fehler })}`; ob.disabled = false; ob.textContent = tx('einstellungen.erneut_versuchen'); }
  };
  app.querySelector('#reset').onclick = async () => {
    const ok = await dialog({ titel: tx('einstellungen.profil_wirklich_loeschen'), html: `<p>${tx('einstellungen.dein_fortschritt_auf_diesem_geraet_wird')}</p>`, ja: tx('allg.loeschen'), gefahr: true });
    if (!ok) return;
    Z.schnappschuss('vor dem Löschen'); Z.loeschen(); location.hash = '#start';
  };
}

// ---------- Lehreransicht ----------
function schuelerLaden() { try { return JSON.parse(localStorage.getItem('itqan-schueler') || '[]'); } catch (e) { return []; } }
function schuelerSpeichern(l) { try { localStorage.setItem('itqan-schueler', JSON.stringify(l)); } catch (e) { toast(tx('schuelerspeichern.speicher_voll')); } }
async function lehrer() {
  navSetzen('profil');
  const liste = schuelerLaden();
  // Schülerdateien aus der anderen Gliederung (Anfänger/Fortgeschritten, ältere Fassung) für die Anzeige umrechnen
  const alt = {};
  for (const x of liste) { const g = x.profil.gliederung || 'fort-1'; if (g !== D.gliederung && !alt[g]) { try { alt[g] = await Z.gliederungLaden(g); } catch (e) {} } }
  const karten = liste.map((x, i) => {
    const kopie = Z.ergaenzen(JSON.parse(JSON.stringify(x.profil)));
    return Z.mitProfil(kopie, () => {
    if (kopie.gliederung !== D.gliederung && alt[kopie.gliederung]) Z.gliederungUmstellen(alt[kopie.gliederung], D.gliederung, false);
    const s = x.profil.summe, q = s.r + s.f + s.h ? Math.round(100 * (s.r + s.h * .5) / (s.r + s.f + s.h)) : 0;
    const kf = Z.khatmaFortschritt(), schwach = Z.schwaechste(3);
    const juz = Array.from({ length: 30 }, (_, j) => {
      const seiten = Array.from({ length: (j < 29 ? juzStart(j + 2) : 605) - juzStart(j + 1) }, (_, k) => juzStart(j + 1) + k);
      const w = seiten.map(Z.seitenStufe).filter(v => v != null);
      return w.length ? (0.12 + 0.88 * (w.reduce((a, b) => a + b, 0) / w.length) / 4.6).toFixed(2) : null;
    });
    return `<div class="abschnitt"><div class="kopfzeile"><h3>${esc(x.profil.name || tx('lehrer.ohne_namen'))}</h3><button class="textlink" data-weg="${i}">${tx('lehrer.entfernen')}</button></div>
      <p class="unter">${tx('lehrer.rang', { n: Z.RAENGE[Z.rangJetzt()].n })} · ${tx('lehrer.stand', { a: new Date(x.exportiert).toLocaleDateString(gebiet('datum')) })} · ${tx('lehrer.markierte_fehlerstellen', { n: Object.keys(x.profil.fstellen || {}).length })}${x.echt ? '' : ` · <b style="color:var(--schlechtT)">${tx('lehrer.datei_wurde_veraendert')}</b>`}</p>
      <div class="zahlen"><div class="zahl"><b>${x.profil.kette.n}</b><span>${tx('allg.kette')}</span></div><div class="zahl"><b>${prozent(q)}</b><span>${tx('allg.ayat_sicher')}</span></div><div class="zahl"><b>${prozent(Math.floor(kf.anteil * 100))}</b><span>${tx('lehrer.hatma', { a: x.profil.zyklus.khatma + 1 })}</span></div></div>
      <div class="licht-seiten" role="img" aria-label="${tx('lehrer.lichtkarte_der_30_agza_von_30_mit_uebung', { n: juz.filter(o => o != null).length })}" style="grid-template-columns:repeat(30,1fr);gap:2px">${juz.map(o => `<button tabindex="-1" aria-hidden="true" class="${o == null ? 'aus' : ''}" style="aspect-ratio:1/2;${o ? 'opacity:' + o : ''}"></button>`).join('')}</div>
      <p class="unter" style="margin-top:10px">${kopie.einst.modus === 'anf' ? `${tx('lehrer.uebt_im_anfaenger_modus')} ` : kopie.einst.modus === 'seite' ? `${tx('lehrer.uebt_in_ganzen_seiten')} ` : ''}${schwach.length ? `${tx('lehrer.schwach')} ${schwach.map(({ id }) => `${abschnittName(D.A[id])} (${esc(D.A[id].titel)})`).join(' · ')}` : tx('lehrer.noch_keine_wiederholungen')}</p></div>`;
  }); }).join('');
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#profil'">${zurueckPfeil}${tx('allg.profil')}</button>
    <div class="marke">${tx('lehrer.lehreransicht')}<small>${tx('lehrer.deine_schueler_schicken_dir_ihre')}</small></div>
    <button class="knopf haupt" id="import" style="margin:18px 0">${tx('lehrer.profildateien_hinzufuegen')}</button>
    ${karten || `<p class="leer">${tx('lehrer.noch_keine_schueler_fuege_die_itqan')}</p>`}`;
  app.querySelector('#import').onclick = async () => {
    const texte = await dateiWaehlen(true); let n = 0;
    const l = schuelerLaden();
    for (const t of texte) {
      try {
        const r = await Z.importDatei(t);
        const i = l.findIndex(x => x.profil.erstellt === r.profil.erstellt && x.profil.name === r.profil.name);
        if (i >= 0) l[i] = r; else l.push(r); n++;
      } catch (e) {}
    }
    schuelerSpeichern(l); toast(tx('lehrer.profile_uebernommen', { n })); lehrer();
  };
  app.querySelectorAll('[data-weg]').forEach(b => b.onclick = () => { const l = schuelerLaden(); l.splice(+b.dataset.weg, 1); schuelerSpeichern(l); lehrer(); });
}

// ---------- Start der App ----------
(async () => {
  Z.laden(); themaAnwenden();
  try {
    await ladeDaten(Z.P?.einst.ausgabe || 'v2', Z.P?.einst.modus || 'fort');
    if (await Z.gliederungAbgleichen()) toast(tx('app.abschnitte_umgestellt_dein_fortschritt'));
    if (Z.P?.einst.bereichJuz) { const j = new Set(Z.P.einst.bereichJuz); Z.P.einst.bereich = D.A.filter(e => j.has(e.juz)).map(e => e.id); delete Z.P.einst.bereichJuz; Z.speichern(); }
    if (Z.P) {   // Auswahl (Āya-Bereiche) ist maßgeblich; ältere Profile bekommen sie aus ihren Abschnitten
      const E = Z.P.einst, vor = JSON.stringify([E.bereich, E.auswahl]);
      if (E.auswahl) E.bereich = zuAbschnitten(ausBereiche(E.auswahl)); else if (E.bereich) E.auswahl = zuBereichen(ausAbschnitten(E.bereich));
      if (E.auswahl && !E.bereich) delete E.auswahl;
      if (JSON.stringify([E.bereich, E.auswahl]) !== vor) Z.speichern();
    }
  }
  catch (e) { app.innerHTML = `<div class="lade">${tx('app.die_daten_konnten_nicht_geladen_werden')}</div>`; return; }
  Z.tagesSchnappschuss();
  await zeige();
  setTimeout(neuigkeitenPruefen, 600);
  setTimeout(vorratSpeichern, 4000);
  // wieder Netz: Seiten in einfacher Schrift bekommen ihre Muṣḥaf-Schrift, der Vorrat wird nachgeholt
  addEventListener('online', () => { schriftAbgleichen().catch(() => {}); vorratSpeichern(); });
  // Solange in ein Feld getippt wird, weicht die Navigation: auf dem iPhone rutscht sie sonst mit der Tastatur über den Inhalt
  const tippfeld = el => !!el?.matches?.('textarea, [contenteditable=""], [contenteditable="true"], input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]):not([type=file]):not([type=color])');
  const tippt = () => document.documentElement.classList.toggle('tippt', tippfeld(document.activeElement));
  document.addEventListener('focusin', tippt); document.addEventListener('focusout', () => setTimeout(tippt, 0));
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  // Tageswechsel, wenn die App über Nacht offen bleibt
  let tag = Z.heute();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Z.heute() !== tag) { tag = Z.heute(); if ((location.hash || '#heute') === '#heute') zeige(); } });
})();
