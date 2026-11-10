// Itqān · Oberfläche
import { D, ladeDaten, abschnittName, bereichText, zahl, esc, sureName, sureArabisch, juzVonSeite, juzStart, ayaWoerter } from './daten.js';
import * as Z from './zustand.js';
import { seiteHTML, schriftenLaden, schrift, glyphen, zeilenEinpassen, grenzenZeichnen } from './mushaf.js';
import { ornamentSVG, groesse, KLASSEN_TEXT, ornamentInfo } from './ornamente.js';
import { VERSION, NEUIGKEITEN, RUECKMELDUNG_AN } from './version.js';
import { fuehrung, gesehen as tourGesehen, merken as tourMerken, zuruecksetzen as tourZuruecksetzen } from './fuehrung.js';
import * as S from './suche.js';
import * as NL from './aehnlich.js';
import * as RB from './rueckblick.js';
import { FRAGEN, GLOSSAR, TASTEN } from './hilfe.js';

const app = document.getElementById('app');
const nav = document.getElementById('nav');
const WT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
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
  const g = d.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' });
  let h = ''; try { h = new Intl.DateTimeFormat('de-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(d).replace(/\s*(AH|d\. H\.)$/, '') + ' n. H.'; } catch (e) {}
  return g + (h ? ' · ' + h : '');
}
const stufePunkte = st => `<div class="stufe" role="img" aria-label="Stufe: ${Z.STUFEN[st]}" title="${Z.STUFEN[st]}">${[1, 2, 3, 4].map(i => `<i class="${st >= i ? 'an' : ''}"></i>`).join('')}</div>`;
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

const rangBand = r => `<div class="band rang-band"><span class="ar">${Z.RAENGE[r].ar}</span><span><b>Neuer Rang: ${Z.RAENGE[r].n}</b><br>${Z.RAENGE[r].de}. <a href="#raenge">Was das bedeutet</a></span></div>`;

// ---------- Dialog (statt confirm): Titel, Inhalt, zwei Knöpfe; liefert true oder false ----------
function dialog({ titel, html = '', ja = 'OK', nein = 'Abbrechen', gefahr = false }) {
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
const istInstalliert = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
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
  const P = Z.P, name = `Itqan-${(P.name || 'Profil').replace(/[^\p{L}\p{N}]+/gu, '_')}-${Z.heute()}.itqan`;
  const text = await Z.exportDatei();
  let geteilt = false;
  if (istTouch() && navigator.canShare) {
    const datei = new File([text], name, { type: 'application/octet-stream' });
    if (navigator.canShare({ files: [datei] })) {
      try { await navigator.share({ files: [datei], title: 'Itqān-Profil' }); geteilt = true; }
      catch (e) { if (e.name === 'AbortError') return false; }
    }
  }
  if (!geteilt) herunterladen(name, text, 'application/octet-stream');
  P.einst.letzteSicherung = new Date().toISOString(); Z.speichern();
  toast('Profil gesichert.');
  return true;
}
const datumKurz = d => d ? new Date(d.length === 10 ? d + 'T12:00' : d).toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric' }) : 'noch nie';
async function profilLaden() {
  const [text] = await dateiWaehlen(); if (!text) return;
  let r;
  try { r = await Z.importDatei(text); } catch (e) { toast('Das ist keine gültige Itqān-Profildatei.'); return; }
  const u = Z.profilUeberblick(r.profil);
  const ok = await dialog({ titel: 'Dieses Profil laden?', ja: 'Laden', html: `<div class="ueberblick">
      <div><span>Name</span><b>${esc(u.name || 'ohne Namen')}</b></div>
      <div><span>Gesichert am</span><b>${datumKurz(r.exportiert)}</b></div>
      <div><span>Zuletzt geübt</span><b>${datumKurz(u.letzterTag)}</b></div>
      <div><span>Abschnitte geübt</span><b>${zahl(u.abschnitte)}</b></div>
      <div><span>Itqān-Punkte</span><b>${zahl(u.punkte)}</b></div>
      <div><span>Kette</span><b>${u.kette} ${u.kette === 1 ? 'Tag' : 'Tage'}</b></div></div>
    ${r.echt ? '' : '<p class="warnung">Achtung: Die Datei wurde nach dem Sichern verändert.</p>'}
    ${Z.P ? '<p class="unter">Dein jetziger Stand auf diesem Gerät wird ersetzt. Vorher legt Itqān einen Schnappschuss an, den du in den Einstellungen zurückholen kannst.</p>' : ''}` });
  if (!ok) return;
  if (Z.P) Z.schnappschuss('vor dem Laden einer Sicherung');
  Z.ersetzeProfil(r.profil);
  try { localStorage.setItem(EINF_KEY, '1'); } catch (e) {}
  location.hash = '#heute'; location.reload();
}

// ---------- Installieren ----------
const teilenSymbol = '<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5v10h14V11h-1"/></svg>';
const plusSymbol = '<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
const punkteSymbol = '<svg class="sym" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>';
function installieren() {
  navSetzen(Z.P ? 'profil' : null);
  const g = geraet();
  const schritte = {
    iphone: [`Öffne Itqān in <b>Safari</b>.`, `Tippe unten auf ${teilenSymbol} <b>Teilen</b>.`, `Wähle ${plusSymbol} <b>Zum Home-Bildschirm</b>, dann <b>Hinzufügen</b>.`],
    ipad: [`Öffne Itqān in <b>Safari</b>.`, `Tippe oben auf ${teilenSymbol} <b>Teilen</b>.`, `Wähle ${plusSymbol} <b>Zum Home-Bildschirm</b>, dann <b>Hinzufügen</b>.`],
    android: [`Öffne Itqān in <b>Chrome</b>.`, `Tippe oben rechts auf ${punkteSymbol} das Menü.`, `Wähle <b>App installieren</b> oder <b>Zum Startbildschirm hinzufügen</b>.`],
    pc: [`Öffne Itqān in <b>Chrome</b> oder <b>Edge</b>.`, `Klicke rechts in der Adressleiste auf das Symbol <b>App installieren</b>.`, `Bestätige mit <b>Installieren</b>. Itqān öffnet sich dann in einem eigenen Fenster.`]
  }[g];
  app.innerHTML = `${Z.P ? `<button class="zurueck" onclick="location.hash='#profil'">${zurueckPfeil}Profil</button>` : `<button class="zurueck" onclick="history.back()">${zurueckPfeil}Zurück</button>`}
    <div class="marke">Itqān installieren<small>Als App auf dem Home-Bildschirm startet Itqān schneller, im Vollbild und auch ohne Internet.</small></div>
    ${istInstalliert() ? '<div class="hinweisbox"><b>Itqān ist auf diesem Gerät bereits installiert.</b></div>' : ''}
    ${installHinweis ? '<button class="knopf haupt" id="jetzt-installieren" style="margin-top:16px">Jetzt installieren</button>' : ''}
    <ol class="install-schritte">${schritte.map(s => `<li><span>${s}</span></li>`).join('')}</ol>
    <div class="hinweisbox"><b>Wichtig:</b> ${g === 'iphone' || g === 'ipad' ? 'Auf dem iPhone und iPad hat die App auf dem Home-Bildschirm einen eigenen Speicher, getrennt von Safari.' : 'Die installierte App und der Browser können getrennte Speicher haben.'} Wenn du schon im Browser geübt hast: erst dort <b>Profil sichern</b>, dann in der installierten App <b>Profil laden</b>. Wer das Symbol vom Home-Bildschirm löscht, löscht auch den Fortschritt darin, darum vorher sichern.</div>
    ${Z.P ? '<button class="knopf leise" id="inst-sichern">Profil jetzt sichern</button>' : ''}`;
  const j = app.querySelector('#jetzt-installieren');
  if (j) j.onclick = async () => { installHinweis.prompt(); const w = await installHinweis.userChoice.catch(() => null); installHinweis = null; if (w?.outcome === 'accepted') toast('Itqān wird installiert.'); installieren(); };
  const s = app.querySelector('#inst-sichern'); if (s) s.onclick = profilSichern;
}

// ---------- Was ist neu ----------
const VERSION_KEY = 'itqan-version-gesehen';
function neuigkeitenHTML(liste) {
  return liste.map(n => `<div class="neu-eintrag"><div class="neu-kopf"><b>Version ${n.v}</b><span>${datumKurz(n.datum)}</span></div><h4>${esc(n.titel)}</h4><ul>${n.punkte.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>`).join('');
}
function neuigkeitenSeite() {
  navSetzen('profil');
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#profil'">${zurueckPfeil}Profil</button>
    <div class="marke">Was ist neu<small>Itqān ${VERSION}. Jede Veröffentlichung mit ihren Änderungen.</small></div>
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
  if (neu.length) await dialog({ titel: `Neu in Itqān ${VERSION}`, html: neuigkeitenHTML(neu), ja: 'Schön', nein: '' });
}

// ---------- Rückmeldung ----------
let vorherigeAnsicht = '';
function rueckmeldung() {
  navSetzen('profil');
  const P = Z.P;
  const info = [`Itqān ${VERSION}`, `Gerät: ${geraet()}${istTouch() ? ', Touch' : ''}${istInstalliert() ? ', installiert' : ', im Browser'}`,
    `Bildschirm: ${screen.width} × ${screen.height}, Fenster ${innerWidth} × ${innerHeight}`, `Browser: ${navigator.userAgent}`,
    P ? `Druck ${P.einst.ausgabe === 'v1' ? '1405' : '1421'}, ${P.einst.modus === 'anf' ? 'Anfänger' : 'Fortgeschritten'}, ${P.summe.abschnitte} Abschnitte geübt` : 'noch kein Profil',
    vorherigeAnsicht ? `Zuletzt geöffnet: ${vorherigeAnsicht}` : ''].filter(Boolean);
  let art = 'Fehler';
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#profil'">${zurueckPfeil}Profil</button>
    <div class="marke">Rückmeldung<small>Was ist dir aufgefallen? Jede Rückmeldung hilft, Itqān besser zu machen.</small></div>
    <div class="abschnitt"><h3>Worum geht es?</h3><div class="wahl" id="rm-art">${['Fehler', 'Wunsch', 'Frage', 'Lob'].map(a => `<button data-w="${a}" class="${a === art ? 'an' : ''}">${a}</button>`).join('')}</div>
      <textarea id="rm-text" rows="6" placeholder="Beschreibe kurz, was passiert ist oder was du dir wünschst. Bei einem Fehler: Was hast du getan, was hast du erwartet?"></textarea>
      <label class="haken"><input type="checkbox" id="rm-info" checked> Angaben zum Gerät mitschicken</label>
      <p class="unter rm-info">${info.map(esc).join('<br>')}</p></div>
    <button class="knopf haupt" id="rm-senden">Senden</button>
    <p class="unter" style="margin-top:8px;text-align:center">${RUECKMELDUNG_AN ? 'Öffnet eine E-Mail an das Itqān-Team.' : istTouch() ? 'Öffnet das Teilen-Menü, z. B. für WhatsApp oder E-Mail.' : 'Öffnet dein E-Mail-Programm. Der Text wird zusätzlich kopiert.'}</p>`;
  app.querySelector('#rm-art').onclick = ev => { const w = ev.target.dataset.w; if (!w) return; art = w; app.querySelectorAll('#rm-art button').forEach(b => b.classList.toggle('an', b.dataset.w === w)); };
  app.querySelector('#rm-senden').onclick = async () => {
    const text = app.querySelector('#rm-text').value.trim();
    if (!text) { toast('Schreib bitte kurz, worum es geht.'); return; }
    const voll = `Itqān · ${art}\n\n${text}${app.querySelector('#rm-info').checked ? '\n\n---\n' + info.join('\n') : ''}`;
    const betreff = `Itqān ${VERSION} · ${art}`;
    try { await navigator.clipboard?.writeText(voll); } catch (e) {}
    if (!RUECKMELDUNG_AN && istTouch() && navigator.share) {
      try { await navigator.share({ title: betreff, text: voll }); toast('Danke für deine Rückmeldung.'); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    location.href = `mailto:${RUECKMELDUNG_AN}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(voll)}`;
    toast('Danke. Der Text ist auch kopiert.');
  };
}

// ---------- Schnappschüsse (Einstellungen und Start) ----------
const GRUND_TEXT = { 'täglich': 'täglich', 'vor dem Gliederungswechsel': 'vor dem Wechsel der Abschnittslänge' };
function schnappschussListe() {
  const l = Z.schnappschuesse();
  if (!l.length) return '<p class="leer">Noch keine Schnappschüsse.</p>';
  return `<div class="schnapp-liste">${l.map(x => `<div class="schnapp"><div><b>${new Date(x.zeit).toLocaleString('de-AT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</b><span>${esc(GRUND_TEXT[x.grund] || x.grund)} · ${zahl(x.abschnitte)} Abschnitte geübt</span></div><button class="knopf leise klein" data-zeit="${x.zeit}">Zurückholen</button></div>`).join('')}</div>`;
}
function schnappschussBinden(wurzel) {
  wurzel.querySelectorAll('[data-zeit]').forEach(b => b.onclick = async () => {
    const ok = await dialog({ titel: 'Diesen Stand zurückholen?', html: `<p>Itqān setzt dein Profil auf den Stand vom ${new Date(b.dataset.zeit).toLocaleString('de-AT')} zurück. Dein jetziger Stand wird vorher selbst als Schnappschuss abgelegt.</p>`, ja: 'Zurückholen' });
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

// ---------- Router ----------
const ROUTEN = { heute, ueben, fertig, karte: lichtkarte, mushaf, profil, einstellungen, lehrer, start, raenge, einfuehrung, fortschritt: fortschrittSeite, auswertung: auswertungSeite, suche: sucheSeite, aehnlich: aehnlichSeite, vergleich: vergleichSeite, fehlerstellen: fehlerstellenSeite, ornamente: ornamenteSeite, installieren, neu: neuigkeitenSeite, rueckmeldung, rueckblick: rueckblickSeite, hilfe: hilfeSeite };
// Seitentitel je Ansicht: Bildschirmleser sagen ihn beim Wechsel an
const TITEL = { heute: 'Heute', ueben: 'Üben', fertig: 'Abschluss', karte: 'Lichtkarte', mushaf: 'Muṣḥaf', profil: 'Profil', einstellungen: 'Einstellungen', lehrer: 'Lehrer', start: 'Profil anlegen', raenge: 'Ränge', einfuehrung: 'Einführung',
  fortschritt: 'Fortschritt', auswertung: 'Auswertung', suche: 'Suche', aehnlich: 'Mutašābihāt', vergleich: 'Vergleich', fehlerstellen: 'Fehlerstellen', ornamente: 'Ornamente', installieren: 'Installieren', neu: 'Was ist neu', rueckmeldung: 'Rückmeldung', rueckblick: 'Rückblick', hilfe: 'Hilfe und Glossar' };
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
  if (!Z.P && name !== 'start' && name !== 'einfuehrung') { location.replace(einfuehrungGesehen() ? '#start' : '#einfuehrung'); return; }
  const f = ROUTEN[name] || heute;
  if (name !== 'rueckmeldung') vorherigeAnsicht = location.hash || '#heute';
  document.body.dataset.ansicht = ROUTEN[name] ? name : 'heute';
  document.body.classList.remove('doppelt');
  const y = scrollBehalten; scrollBehalten = null;
  if (y == null) window.scrollTo(0, 0);
  await f(...arg);
  if (y != null) window.scrollTo(0, y);
  const ansicht = ROUTEN[name] ? name : 'heute';
  document.title = ansicht === 'heute' ? 'Itqān' : TITEL[ansicht] + ' · Itqān';
  // Tastatur und Bildschirmleser beginnen in der neuen Ansicht, nicht in der alten Navigation
  if (!app.contains(document.activeElement)) app.focus({ preventScroll: true });
}
addEventListener('hashchange', zeige);

// ---------- Einführung (beim ersten Öffnen, später über Profil oder Start erneut) ----------
const EINF_KEY = 'itqan-einfuehrung';
const einfuehrungGesehen = () => { try { return localStorage.getItem(EINF_KEY) === '1'; } catch (e) { return true; } };
function einfuehrung() {
  navSetzen(null);
  const linien = (n, klasse = '') => Array.from({ length: n }, (_, i) => `<i class="${klasse}" style="--i:${i}"></i>`).join('');
  const SCHRITTE = [
    { bild: `<div class="tb-laterne">${qandil()}</div><div class="tb-ar">إِتْقَان</div>`,
      titel: 'Assalāmu ʿalaikum',
      text: 'Itqān begleitet dich bei der Murāǧaʿa des ganzen Qurʾān. Es ist für Ḥuffāẓ, für alle, die gerade auswendig lernen, und für ihre Lehrer.<br><br><b>Itqān</b> heißt: etwas so sicher beherrschen, dass es hält.' },
    { bild: `<div class="tb-seite">${[3, 4, 5, 3].map((n, g) => linien(n, 'g' + g)).join('')}</div>`,
      titel: 'Sinnabschnitte statt Seiten',
      text: 'Der Qurʾān ist in kleine Sinnabschnitte geteilt, jeder mit einem eigenen Titel. Jeden Tag wiederholst du einige davon, dein <b>Wird</b>: die feste Menge, die du dir für jeden Tag vornimmst. Abschnitt für Abschnitt entsteht so eine ganze Ḫatma.' },
    { bild: `<div class="tb-ayat">${Array.from({ length: 4 }, (_, i) => `<div class="tb-aya" style="--i:${i}"><span class="tb-schleier"></span><span class="tb-schrift"></span><b class="${i === 2 ? 'nein' : 'ja'}">${i === 2 ? '✗' : '✓'}</b></div>`).join('')}</div>`,
      titel: 'Aufdecken und ehrlich prüfen',
      text: 'Die Āyāt sind verdeckt. Du rezitierst aus dem Gedächtnis, deckst auf und sagst ehrlich <b>Richtig</b> oder <b>Fehler</b>. Diese Ehrlichkeit ist eine Amāna: Nur so zeigt dir Itqān, wo du wirklich stehst.<br><br>Dazu kannst du bis zum nächsten Stoppzeichen aufdecken, dich kurz selbst aufnehmen und die Stelle eines Fehlers aufs Wort genau markieren.' },
    { bild: `<div class="tb-stufen">${['neu', 'Aufbau', 'gefestigt', 'sicher', 'mutqan'].map((s, i) => `<span style="--i:${i}">${s}</span>`).join('')}<div class="tb-zurueck"><span>1 Tag</span><span>3 Tage</span><span>7 Tage</span></div></div>`,
      titel: 'Was nicht sitzt, kommt wieder',
      text: 'Jeder fehlerfreie Durchgang hebt einen Abschnitt eine Stufe höher, bis er <b>mutqan</b> ist. Ein Fehler setzt ihn zurück, und der Abschnitt kommt nach 1, 3 und 7 Tagen wieder, bis er hält.' },
    { bild: `<div class="tb-licht">${Array.from({ length: 40 }, (_, i) => `<i style="--i:${i};--o:${[.15, .35, .55, .8, 1][(i * 7) % 5]}"></i>`).join('')}</div>`,
      titel: 'Deine Lichtkarte',
      text: 'Je sicherer eine Seite sitzt, desto heller leuchtet sie auf deiner Lichtkarte. Dazu gibt es Ränge von <b>Mubtadiʾ</b> bis <b>Mutqin Muṭlaq</b>.<br><br>Es gibt keine Bestenliste. Du misst dich nur an dir selbst, damit die Absicht rein bleibt.' },
    { bild: `<div class="tb-kette">${Array.from({ length: 7 }, (_, i) => `<span style="--i:${i}">${lampeKlein}<small>${i + 1}</small></span>`).join('')}</div>`,
      titel: 'Beständigkeit vor Menge',
      text: 'Jeder Tag mit erfülltem Wird zündet eine Lampe deiner Kette an. Fällt ein Tag aus, holst du ihn am nächsten Tag nach (<b>Qaḍāʾ</b>) und die Kette bleibt ganz.<br><br>Der Prophet ﷺ sagte: „Die liebsten Taten bei Allāh sind die beständigsten, auch wenn sie wenig sind.“ (Bei al-Buḫārī und Muslim überliefert)' },
    { bild: `<div class="tb-liste">${['Abschnittslänge wählen', 'Nur sichere Aǧzāʾ', 'Wenig, aber jeden Tag', 'Profil sichern'].map((t, i) => `<div style="--i:${i}"><b>✓</b>${t}</div>`).join('')}</div>`,
      titel: 'Bevor du dein Profil anlegst',
      text: `<ul class="tb-punkte">
        <li><b>Abschnittslänge:</b> Wer erst seit kurzem wiederholt, beginnt mit <b>Anfänger</b> (höchstens eine halbe Seite). <b>Fortgeschritten</b> ist für Personen, die geübt sind, ganze Seiten zu wiederholen. Wechseln geht jederzeit, der Fortschritt bleibt.</li>
        <li><b>Aǧzāʾ:</b> Wähle nur die Aǧzāʾ, die du schon auswendig kannst. Die Wiederholung ist für Bewahrtes, nicht für neues Lernen.</li>
        <li><b>Abschnitte am Tag:</b> Lieber wenig und jeden Tag als viel und selten. Die App zeigt dir, wie lange eine Ḫatma damit dauert.</li>
        <li><b>Sichern:</b> Solange die App in der Testphase ist, wird dein Fortschritt nicht auf einem Server gespeichert. Er bleibt auf diesem Gerät und lässt sich unter Profil mit „Profil sichern“ sichern.</li></ul>` }
  ];
  let i = 0;
  app.innerHTML = `<div class="tutorial">
    <button class="textlink tut-weg" id="tut-weg">Überspringen</button>
    <div class="tut-buehne" id="tut-buehne"></div>
    <div class="tut-punkte" id="tut-punkte">${SCHRITTE.map((_, k) => `<i data-k="${k}"></i>`).join('')}</div>
    <div class="reihe tut-knoepfe"><button class="knopf leise" id="tut-zurueck">Zurück</button><button class="knopf haupt" id="tut-weiter">Weiter</button></div></div>`;
  const buehne = app.querySelector('#tut-buehne'), weiter = app.querySelector('#tut-weiter'), zurueck = app.querySelector('#tut-zurueck');
  const fertig = () => { try { localStorage.setItem(EINF_KEY, '1'); } catch (e) {} location.hash = Z.P ? '#profil' : '#start'; };
  function zeigeSchritt(neu, richtung = 1) {
    i = Math.max(0, Math.min(SCHRITTE.length - 1, neu));
    const s = SCHRITTE[i];
    buehne.innerHTML = `<div class="tut-schritt ${richtung < 0 ? 'rueckwaerts' : ''}"><div class="tut-bild">${s.bild}</div><h2>${s.titel}</h2><div class="tut-text">${s.text}</div></div>`;
    app.querySelectorAll('#tut-punkte i').forEach((p, k) => p.classList.toggle('an', k === i));
    zurueck.style.visibility = i ? 'visible' : 'hidden';
    weiter.textContent = i === SCHRITTE.length - 1 ? (Z.P ? 'Fertig' : 'Profil erstellen') : 'Weiter';
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
  zurueck.onclick = () => zeigeSchritt(i - 1, -1);
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
  const s = { name: '', pensum: 3, reihenfolge: 'vorwaerts', zufall: 'einzeln', juz: new Set(Array.from({ length: 30 }, (_, i) => i + 1)), thema: 'auto', modus: 'fort' };
  const tageText = () => {
    const ids = D.A.filter(e => s.juz.has(e.juz)).length;
    return `${ids} Abschnitte · eine Ḫatma dauert damit etwa<br><b class="dauer-zahl">${Math.ceil(ids / s.pensum)} Tage</b>`;
  };
  app.innerHTML = `<div class="start">${qandil()}<h1>Itqān</h1><div class="ar">إِتْقَان</div>
    <p class="unter" style="margin-top:8px">Die Murāǧaʿa des ganzen Qurʾāns, Abschnitt für Abschnitt.</p>
    <a class="textlink" href="#einfuehrung">Einführung noch einmal ansehen</a></div>
    <div class="abschnitt start-laden"><h3>Schon ein Profil?</h3><p class="unter">Wenn du Itqān auf einem anderen Gerät oder im Browser genutzt hast, lade hier deine gesicherte Datei.</p>
      <div class="reihe" style="margin-top:10px"><button class="knopf leise klein" id="start-laden">Gesichertes Profil laden</button>${Z.schnappschuesse().length ? '<button class="knopf leise klein" id="start-schnapp">Schnappschuss zurückholen</button>' : ''}</div>
      <div id="start-schnapp-liste" class="verdeckt" style="margin-top:12px">${schnappschussListe()}</div></div>
    <div class="abschnitt"><h3>Wie heißt du?</h3><div class="feld"><input type="text" id="name" placeholder="Dein Name (für deine Profildatei)" autocomplete="given-name"></div></div>
    <div class="abschnitt"><h3>Was wiederholst du?</h3><p class="unter">Wähle die Aǧzāʾ, die du auswendig kannst.</p>
      <div class="reihe" style="margin:12px 0"><button class="knopf leise klein" id="alle">Alle 30</button><button class="knopf leise klein" id="keine">Keinen</button></div>
      <div class="juzwahl" id="juz"></div></div>
    <div class="abschnitt"><h3>Wie lang sollen die Abschnitte sein?</h3>${modusWahl('fort', false)}</div>
    <div class="abschnitt"><h3>Wie viele Abschnitte am Tag?</h3><p class="unter">Pro Wochentag kannst du es später anpassen.</p>
      <div class="zaehler"><button id="minus" aria-label="weniger">−</button><b id="pensum">3</b><button id="plus" aria-label="mehr">+</button></div>
      <p class="unter" style="text-align:center" id="dauer"></p></div>
    <div class="abschnitt"><h3>In welcher Reihenfolge?</h3><div class="wahl" id="reihenfolge"><button data-w="vorwaerts" class="an">Ab al-Fātiḥah</button><button data-w="rueckwaerts">Ab an-Nās</button><button data-w="zufall">Zufällig</button></div>
      <div id="zufallwahl" class="verdeckt" style="margin-top:12px"><p class="unter">Bei mehreren Abschnitten am Tag:</p><div class="wahl" id="zufall" style="margin-top:8px"><button data-w="einzeln" class="an">Verstreute Stellen</button><button data-w="block">Eine Stelle am Stück</button></div></div></div>
    <div class="abschnitt"><h3>Erscheinungsbild</h3><div class="wahl" id="thema"><button data-w="hell">Hell</button><button data-w="dunkel">Dunkel</button><button data-w="auto" class="an">Wie Gerät</button></div></div>
    <button class="knopf haupt" id="los" style="margin-top:18px">Bismillāh, beginnen</button>`;
  app.querySelector('#start-laden').onclick = profilLaden;
  const ssb = app.querySelector('#start-schnapp'); if (ssb) ssb.onclick = () => app.querySelector('#start-schnapp-liste').classList.toggle('verdeckt');
  schnappschussBinden(app);
  const juzEl = app.querySelector('#juz');
  const juzZeichnen = () => { juzEl.innerHTML = Array.from({ length: 30 }, (_, i) => `<button data-j="${i + 1}" class="${s.juz.has(i + 1) ? 'an' : ''}">${i + 1}</button>`).join(''); app.querySelector('#dauer').innerHTML = tageText(); };
  juzEl.onclick = e => { const j = +e.target.dataset.j; if (!j) return; s.juz.has(j) ? s.juz.delete(j) : s.juz.add(j); juzZeichnen(); };
  app.querySelector('#alle').onclick = () => { for (let i = 1; i <= 30; i++) s.juz.add(i); juzZeichnen(); };
  app.querySelector('#keine').onclick = () => { s.juz.clear(); juzZeichnen(); };
  const p = d => { s.pensum = Math.min(30, Math.max(1, s.pensum + d)); app.querySelector('#pensum').textContent = s.pensum; app.querySelector('#dauer').innerHTML = tageText(); };
  app.querySelector('#minus').onclick = () => p(-1); app.querySelector('#plus').onclick = () => p(1);
  for (const id of ['reihenfolge', 'zufall', 'thema', 'modus']) app.querySelector('#' + id).onclick = e => {
    const w = e.target.dataset.w; if (!w) return; s[id] = w;
    app.querySelectorAll(`#${id} button`).forEach(b => b.classList.toggle('an', b.dataset.w === w));
    if (id === 'reihenfolge') app.querySelector('#zufallwahl').classList.toggle('verdeckt', w !== 'zufall');
    if (id === 'thema') { try { localStorage.setItem('itqan-thema', w); } catch (x) {} themaAnwenden(); }
  };
  app.querySelector('#los').onclick = () => {
    if (!s.juz.size) { toast('Wähle mindestens einen Ǧuzʾ.'); return; }
    const bereich = s.juz.size === 30 ? null : D.A.filter(e => s.juz.has(e.juz)).map(e => e.id);
    Z.neuesProfil({ name: app.querySelector('#name').value.trim(), pensum: s.pensum, reihenfolge: s.reihenfolge, bereich: null, thema: s.thema, modus: s.modus });
    Z.P.einst.zufall = s.zufall;
    // Bereich als Aǧzāʾ merken; die Abschnitte dazu bestimmt die gewählte Gliederung beim Neustart
    if (bereich) Z.P.einst.bereichJuz = [...s.juz];
    Z.speichern();
    if (s.modus !== D.modus) { location.hash = '#heute'; location.reload(); return; }
    if (bereich) { Z.P.einst.bereich = bereich; delete Z.P.einst.bereichJuz; Z.speichern(); }
    navigator.storage?.persist?.();
    location.hash = '#heute';
  };
  juzZeichnen();
}

// Sūrenname und Abschnittsnummer fett; die Nummer zeigt farbig, wie gut der Abschnitt sitzt
const STAND_TEXT = { nie: 'noch nie wiederholt', neu: 'neu', aufbau: 'im Aufbau', gefestigt: 'gefestigt', sicher: 'sicher', mutqan: 'mutqan', fehler: 'Fehler im letzten Durchgang' };
function abschnittMarke(e) {
  const st = Z.abschnittStand(e.id);
  if (!e.nr) return `<strong class="ab-name" title="${STAND_TEXT[st]}">${abschnittName(e)}</strong>`;
  return `<strong class="ab-name">${sureName(e.von[0])} <span class="ab-nr st-${st}" title="${STAND_TEXT[st]}">${e.nr}</span><span class="nur-leser">, ${STAND_TEXT[st]}</span></strong>`;
}

// Wahl zwischen Fortgeschritten und Anfänger
function modusWahl(jetzt, mitHinweis = true) {
  return `<div class="wahl" id="modus" style="margin-top:4px">${[['anf', 'Anfänger'], ['fort', 'Fortgeschritten']].map(([w, l]) => `<button data-w="${w}" class="${jetzt === w ? 'an' : ''}">${l}</button>`).join('')}</div>
    <p class="unter" style="margin-top:8px"><b>Anfänger:</b> Jeder Abschnitt ist höchstens eine halbe Seite lang, jede kurze Sūra ist ein eigener Abschnitt (1.595 Abschnitte).<br><b>Fortgeschritten:</b> Für alle, die geübt sind, ganze Seiten zu wiederholen. Ein Abschnitt hat meist 10 bis 15 Zeilen (739 Abschnitte).</p>
    ${mitHinweis ? '<p class="unter" style="margin-top:6px">Beim Wechsel bleibt dein Fortschritt erhalten: Jeder neue Abschnitt übernimmt den Stand der Āyāt, die er enthält.</p>' : ''}`;
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
  const quote = t.r + t.f + t.h ? Math.round(100 * (t.r + t.h * .5) / (t.r + t.f + t.h)) : null;
  const kf = Z.khatmaFortschritt();
  const istFreitag = Z.wochentag(Z.heute()) === 4;
  // Ruhetag oder Pause: kein Wird, die Kette wartet
  const ps = t.ruhe === 'pause' ? Z.pauseJetzt() : null;
  const ruheHTML = t.ruhe ? `<div class="ruhe-karte">${ps ? `<b>Pause bis ${tagLang(ps.bis)}</b><p>Kein Wird, keine Fehlerwiederholung. ${P.kette.n ? `Deine Kette von ${P.kette.n} ${P.kette.n === 1 ? 'Tag' : 'Tagen'} wartet und läuft danach weiter.` : 'Danach geht es dort weiter, wo du aufgehört hast.'}</p>`
      : `<b>Heute ist Ruhetag</b><p>Dein Wird ruht heute. ${P.kette.n ? 'Deine Kette läuft am nächsten Wird-Tag weiter.' : ''}</p>`}
    <div class="reihe" style="margin-top:12px"><button class="knopf haupt klein" id="trotzdem">Trotzdem üben</button>${ps ? '<button class="knopf leise klein" id="pause-ende">Pause beenden</button>' : ''}</div></div>` : '';
  let unter = t.ruhe ? (ps ? 'Du machst gerade eine Pause.' : 'Heute ist dein Ruhetag.') : t.voll ? 'Dein Wird für heute ist vollbracht. Allāhumma bārik.' : `Dein Wird für heute: noch ${pflicht.length - erledigt} ${pflicht.length - erledigt === 1 ? 'Abschnitt' : 'Abschnitte'}.`;
  const karten = t.plan.map((id, i) => {
    const e = D.A[id], fertig = t.fertig.includes(id), jetzt = !fertig && id === offen[0];
    const art = t.art[id];
    const zwh = Z.zwischenstandLaden(id, art === 'bonus' ? 'bonus' : ''), angefangen = !fertig && zwh?.erg?.length ? `<span class="marke-art angefangen">angefangen · ${zwh.erg.length}/${e.ayat}</span>` : '';
    const marke = angefangen + (art === 'fehler' ? '<span class="marke-art fehler">Wiederholung nach Fehler</span>' : art === 'qadaa' ? '<span class="marke-art qadaa">Qaḍāʾ</span>' : art === 'festigen' ? '<span class="marke-art festigen">Festigen</span>' : art === 'bonus' ? '<span class="marke-art bonus">Bonus</span>' : '');
    return `<a class="karte ${fertig ? 'fertig' : ''} ${jetzt ? 'jetzt' : ''}" href="#ueben/${id}" style="text-decoration:none;color:inherit">
      <div class="nr">${fertig ? '✓' : i + 1}</div><div class="t"><b>${esc(e.titel)}</b><span>${abschnittMarke(e)} · ${bereichText(e)} · ${e.zeilen} Zeilen ${marke}</span></div>${stufePunkte(Z.karte(id).st)}</a>`;
  }).join('');
  const bonusId = t.voll ? Z.bonusVorschlag() : null;
  const woche = Z.letzteTage(7).map(x => x.t).filter(Boolean);
  const wSum = woche.reduce((s, x) => ({ r: s.r + x.r, f: s.f + x.f, h: s.h + x.h, p: s.p + x.punkte, v: s.v + (x.voll ? 1 : 0) }), { r: 0, f: 0, h: 0, p: 0, v: 0 });
  // ÜBERGANG bis zum Launch mit eigenem Server und App-Store: Erinnerung an die Sicherung und die Karte zum Installieren
  // entfallen dann (Daten liegen auf dem Server, die App kommt aus dem Store). „Profil sichern“ bleibt als freiwillige Funktion.
  // Erinnerung an die Sicherung: 7 Tage nach der letzten (oder nach dem Anlegen), höchstens einmal am Tag wegklickbar
  const seitSicherung = Z.tageZwischen((P.einst.letzteSicherung || P.erstellt).slice(0, 10), Z.heute());
  let spaeter = null; try { spaeter = localStorage.getItem('itqan-sicherung-spaeter'); } catch (e) {}
  const sicherungFaellig = seitSicherung >= 7 && P.summe.abschnitte > 0 && spaeter !== Z.heute();
  let installWeg = null; try { installWeg = localStorage.getItem('itqan-install-weg'); } catch (e) {}
  const installKarte = !istInstalliert() && istTouch() && !installWeg;
  app.innerHTML = `
    <div class="kopfzeile"><div class="marke">Itqān<small>${datumText()}</small></div>
      <a class="pille kette-pille" href="#profil" style="text-decoration:none;color:inherit" title="Tage in Folge" aria-label="Kette: ${aktiv ? P.kette.n : 0} ${(aktiv ? P.kette.n : 0) === 1 ? 'Tag' : 'Tage'} in Folge. Zum Profil">${lampeKlein}${aktiv ? P.kette.n : 0}</a></div>
    <h2 class="gruss">Assalāmu ʿalaikum${P.name ? ', ' + esc(P.name) : ''}</h2><p class="unter">${unter}</p>
    ${sicherungFaellig ? `<div class="hinweisbox sicherung-hinweis"><b>Sichere dein Profil.</b> ${P.einst.letzteSicherung ? `Die letzte Sicherung ist ${seitSicherung} Tage her.` : 'Du hast dein Profil noch nie gesichert.'} Deine Fortschritte liegen nur auf diesem Gerät.
      <div class="reihe" style="margin-top:10px"><button class="knopf haupt klein" id="jetzt-sichern">Jetzt sichern</button><button class="knopf leise klein" id="sichern-spaeter">Morgen erinnern</button></div></div>` : ''}
    ${installKarte ? `<div class="hinweisbox install-hinweis"><b>Itqān als App nutzen.</b> Auf dem Home-Bildschirm startet Itqān schneller und im Vollbild.
      <div class="reihe" style="margin-top:10px"><a class="knopf haupt klein" href="#installieren" style="text-decoration:none">So geht’s</a><button class="knopf leise klein" id="install-weg">Nicht mehr zeigen</button></div></div>` : ''}
    ${t.qadaa && !t.voll ? `<div class="hinweisbox"><b>Qaḍāʾ:</b> ${qadaaTag()} ist dein Wird ausgefallen. Holst du es heute mit nach, bleibt deine Kette von ${P.kette.n} ${P.kette.n === 1 ? 'Tag' : 'Tagen'} ganz.</div>` : ''}
    ${t.ruhe ? ruheHTML : `<div class="ring"><svg width="210" height="210" viewBox="0 0 210 210" aria-hidden="true">
      <defs><linearGradient id="verlauf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--akzent)"/><stop offset="1" stop-color="var(--akzent2)"/></linearGradient></defs>
      <circle cx="105" cy="105" r="88" fill="none" stroke="var(--rand)" stroke-width="10"/>
      <circle class="fort" cx="105" cy="105" r="88" fill="none" stroke="url(#verlauf)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${U}" stroke-dashoffset="${U}"/>
      <circle cx="105" cy="105" r="74" fill="none" stroke="var(--rand)" stroke-width="1" stroke-dasharray="2 6"/></svg>
      <div class="mitte"><span class="gross" aria-label="${erledigt} von ${pflicht.length}">${erledigt}<span>/${pflicht.length}</span></span><span class="klein">Abschnitte</span></div></div>
    <div class="zahlen"><div class="zahl"><b>${aktiv ? P.kette.n : 0}</b><span>Tage Kette</span></div>
      <div class="zahl"><b>${zahl(t.hasanat)}</b><span>Ḥasanāt heute</span></div>
      <div class="zahl"><b>${quote == null ? '·' : quote + ' %'}</b><span>Āyāt sicher</span></div></div>
    ${t.voll && bonusId != null ? `<div class="angebot"><b>Allāhumma bārik. Noch Kraft für mehr?</b><p>Ein Bonusabschnitt bringt dir 50 % mehr Itqān-Punkte. Vorschlag: ${abschnittName(D.A[bonusId])}, „${esc(D.A[bonusId].titel)}“.</p><button id="bonus">Bonusabschnitt beginnen</button></div>` : ''}
    <div class="titel-klein">Heute dran</div>${karten}
    <div class="klein-zeile" style="justify-content:center;gap:4px"><button class="textlink" id="weniger">− ein Abschnitt</button><button class="textlink" id="mehr">+ ein Abschnitt</button></div>`}
    ${istFreitag ? `<div class="titel-klein">Ǧumuʿa mubāraka · deine Woche</div><div class="abschnitt" style="margin-top:0">
      <p>${wSum.v} von 7 Tagen erfüllt · ${wSum.r + wSum.f + wSum.h ? Math.round(100 * (wSum.r + wSum.h * .5) / (wSum.r + wSum.f + wSum.h)) : 0} % der Āyāt sicher · ${zahl(wSum.p)} Itqān-Punkte</p>
      <p class="unter" style="margin-top:6px">Eine neue Woche ist ein guter Neuanfang. ${Z.schwaechste(1)[0] ? `Schwächster Abschnitt gerade: ${abschnittName(D.A[Z.schwaechste(1)[0].id])}.` : ''}</p></div>` : ''}
    <div class="titel-klein">${P.zyklus.khatma + 1}. Ḫatma</div>
    <div class="balken"><div style="width:${(kf.anteil * 100).toFixed(1)}%"></div></div>
    <div class="klein-zeile"><span>${kf.fertig} von ${kf.gesamt} Abschnitten</span><span>${Math.floor(kf.anteil * 100)} %</span></div>
    <div class="titel-klein"><a href="#karte" style="color:inherit">Lichtkarte · 30 Ǧuzʾ ›</a></div>
    <a class="licht-mini" href="#karte" aria-label="Lichtkarte öffnen: 30 Ǧuzʾ, je heller, desto sicherer">${Array.from({ length: 30 }, (_, i) => {
      const seiten = Array.from({ length: (i < 29 ? juzStart(i + 2) : 605) - juzStart(i + 1) }, (_, k) => juzStart(i + 1) + k);
      const w = seiten.map(Z.seitenStufe).filter(x => x != null);
      const o = w.length ? 0.14 + 0.86 * (w.reduce((a, b) => a + b, 0) / w.length) / 4.6 : null;
      // Farbe gemischt statt durchsichtig, damit die Zahl lesbar bleibt; ab 58,5 % wechselt im dunklen Bild die Schrift auf Schwarz
      return `<span aria-hidden="true" class="${o == null ? 'aus' : o >= 0.585 ? 'voll' : ''}"${o != null ? ` style="background:color-mix(in srgb,var(--akzent) ${Math.round(o * 100)}%,var(--bg))"` : ''}>${i + 1}</span>`;
    }).join('')}</a>`;
  requestAnimationFrame(() => setTimeout(() => app.querySelector('circle.fort')?.setAttribute('stroke-dashoffset', U * (1 - anteil)), 60));
  const mehr = app.querySelector('#mehr'); if (mehr) mehr.onclick = () => { Z.pensumHeuteAendern(1); heute(); };
  const weniger = app.querySelector('#weniger'); if (weniger) weniger.onclick = () => { Z.pensumHeuteAendern(-1); heute(); };
  const tz = app.querySelector('#trotzdem'); if (tz) tz.onclick = () => { Z.trotzdemUeben(); heute(); };
  const pe = app.querySelector('#pause-ende'); if (pe) pe.onclick = () => { Z.pauseBeenden(); toast('Die Pause ist beendet. Willkommen zurück.'); heute(); };
  const b = app.querySelector('#bonus'); if (b) b.onclick = () => location.hash = `#ueben/${bonusId}/bonus`;
  const js = app.querySelector('#jetzt-sichern'); if (js) js.onclick = async () => { if (await profilSichern()) heute(); };
  const sp = app.querySelector('#sichern-spaeter'); if (sp) sp.onclick = () => { try { localStorage.setItem('itqan-sicherung-spaeter', Z.heute()); } catch (e) {} heute(); };
  const iw = app.querySelector('#install-weg'); if (iw) iw.onclick = () => { try { localStorage.setItem('itqan-install-weg', '1'); } catch (e) {} heute(); };
}

// Datum ausgeschrieben, z. B. „Freitag, 20. November“
const tagLang = d => new Date(d + 'T12:00').toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' });
// welcher Wird-Tag für das Qaḍāʾ ausgefallen ist
function qadaaTag() {
  const w = Z.vorigerWirdTag(Z.heute());
  return w === Z.plusTage(Z.heute(), -1) ? 'Gestern' : `Am ${TAGE[Z.wochentag(w)]}`;
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
  app.innerHTML = '<div class="lade">Seiten werden geladen …</div>';
  const E = Z.P.einst, t = Z.tagesplan(), art = quelle || t.art[id];
  // Bei Zufall und Fehlerwiederholung: die Āya davor deutlich zeigen, damit man weiß, wo man ist
  const vorVi = e.v[0] - 1;
  const kontext = vorVi >= 0 && e.von[1] > 1 && (E.reihenfolge === 'zufall' || art === 'fehler' || art === 'stelle');
  const kWoerter = kontext ? ayaWoerter(vorVi) : [];
  const kSeiten = [...new Set(kWoerter.map(x => x[5]))];
  const dop = doppelseitig(), gezeigt = dop ? doppelseiten(e.seiten) : e.seiten.map(x => [x]), alleSeiten = gezeigt.flat();
  const kBox = kontext && kSeiten.some(p => !alleSeiten.includes(p));
  document.body.classList.toggle('doppelt', dop);
  await Promise.all([schriftenLaden(alleSeiten), ...kWoerter.map(x => schrift(x[4]))]);
  const k = Z.karte(id);
  const ayat = []; for (let v = e.v[0]; v <= e.v[1]; v++) ayat.push(v);
  const zu = new Set(ayat), alt = new Set(k.fa || []), status = new Map(), erg = [];
  let pos = 0, offen = false, hilfe = false, ti = 0, teile = [], markieren = false, fArt = null, vorschau = false;
  // liste: die Āyāt der laufenden Runde (Hauptrunde oder Sofortkorrektur); verlauf: bewertete Āyāt zum Zurücknehmen
  let liste = ayat, phase = 'haupt', korr = [], verlauf = [], fsVorher = null, abhoeren = false;
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
    catch (e) { startet = false; mikro = null; toast('Ohne Zugriff auf das Mikrofon geht keine Aufnahme.'); return; }
    if (offen || pos >= ayat.length) { startet = false; return; }   // inzwischen aufgedeckt
    const nr = ++aufnahmeNr, daten = [];
    let r;
    try { r = new MediaRecorder(mikro); } catch (e) { startet = false; toast('Die Aufnahme ließ sich nicht starten.'); return; }
    r.ondataavailable = ev => { if (ev.data?.size) daten.push(ev.data); };
    r.onstop = () => {
      if (nr !== aufnahmeNr) return;
      if (rec === r) rec = null;
      mikroFrei();
      if (daten.length) { aufnahmeWeg(); aufnahme = URL.createObjectURL(new Blob(daten, { type: r.mimeType || daten[0].type || 'audio/mp4' })); }
      else toast('Die Aufnahme ist leer geblieben. Bitte noch einmal aufnehmen.');
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
  const zusatz = art === 'bonus' ? ' · Bonus' : art === 'fehler' ? ' · Wiederholung nach Fehler' : art === 'festigen' ? ' · Festigen' : '';
  app.innerHTML = `<div class="ueb-kopf"><button class="zurueck" id="zurueck" aria-label="Zurück">${zurueckPfeil}</button>
      <div class="info">${art === 'stelle' ? `<b>Fehlerstelle</b> · ${e.von[0]}:${e.von[1]}` : `${bereichText(e)} · ${e.ayat} Āyāt · ${e.zeilen} Zeilen`} · S. ${e.seiten.map(p => `${p}<button class="seitenlage klein" data-lage="${p}" aria-label="Seite ${p}: ${p % 2 ? 'rechte' : 'linke'} Seite">${p % 2 ? 'R' : 'L'}</button>`).join(' ')}</div></div>
    <div class="hinweisbox lageinfo verdeckt" id="lageinfo" style="margin:0 4px 10px"></div>
    ${kBox ? `<div class="kontext"><span>Davor · ${D.V[vorVi][0]}:${D.V[vorVi][1]}</span><div class="kz">${kWoerter.map(([c, , ty, , p]) => `<span style="font-family:qp${p}">${glyphen(c, ty)}</span>`).join('')}</div></div>` : ''}
    <div class="seiten roller" id="seiten"></div><div class="nur-leser" id="ansage" aria-live="polite" lang="ar" dir="rtl"></div><div style="height:190px"></div>
    <div class="steuerung"><div class="innen"><div class="fort-zeile"><div class="punkte" id="punkte"></div><span class="zaehler" id="zaehler"></span></div><div class="arten verdeckt" id="arten"></div><div class="reihe" id="knoepfe"></div>
    <div class="zeile2"><span class="unter" id="hinweis"></span></div></div></div>
    ${art === 'stelle' ? '' : `<div class="einblendung" id="einbl"><div><div class="ueber">${e.nr ? `${sureName(e.von[0])} <b>${e.nr}</b> von <b>${e.von_n}</b>` : abschnittName(e)}${zusatz}</div><h2>${esc(e.titel)}</h2>
      <div class="ar">${sureArabisch(e.von[0])}</div>${doppelseiteSkizze(e)}</div></div>`}`;
  const einbl = app.querySelector('#einbl');
  if (einbl) {
    const einblWeg = () => { if (!einbl.isConnected) return; einbl.classList.add('weg'); setTimeout(() => einbl.remove(), 350); };
    einbl.addEventListener('animationend', ev => { if (ev.target === einbl) einbl.remove(); });
    einbl.onclick = einblWeg;
  }
  const seitenEl = app.querySelector('#seiten');
  const sOpt = { von: e.v[0], bis: e.v[1], zu, alt, klar: kontext ? new Set([vorVi]) : undefined, fst: Z.fehlerstellenSet() };
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
    if (!el) return; const r = el.getBoundingClientRect();
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
      { titel: 'Deine erste Übung', text: 'Willkommen. So läuft jede Übung ab: Du rezitierst eine Āya aus dem Gedächtnis, deckst sie auf und sagst ehrlich, ob sie richtig war. Dann kommt die nächste Āya.<br><br>Wir gehen die Seite und die Knöpfe einmal Schritt für Schritt durch.' },
      { ziel: imAbschnitt, titel: 'Dein Abschnitt', text: 'Die Āyāt deines Abschnitts sind verdeckt, jedes Wort als Balken. So siehst du, wie lang eine Āya ist, aber nicht ihren Text. Die Stoppzeichen bleiben sichtbar.' },
      { ziel: () => [...seitenEl.querySelectorAll('.w.naechste')].slice(0, 12), titel: 'Diese Āya ist dran', text: 'Die Āya, die du jetzt rezitierst, ist goldbraun hinterlegt und pulsiert leicht. Ein leuchtendes Stoppzeichen zeigt, bis wohin „Bis zum Zeichen“ aufdeckt.' },
      { ziel: () => { const k = [...seitenEl.querySelectorAll('.w.klar')]; return k.length ? k : null; }, titel: 'Die Āya davor', text: 'Die Āya vor deinem Abschnitt ist hell bläulich hinterlegt und gut lesbar. Sie hilft dir, den Einstieg zu finden.' },
      { ziel: () => { const v = [...seitenEl.querySelectorAll('.w.vor, .w.nach')].slice(0, 30); return v.length ? v : null; }, titel: 'Der Rest der Seite', text: 'Text vor deinem Abschnitt ist blass, Text danach ist verschwommen. So verrät die Seite nichts, was du gleich aus dem Gedächtnis rezitieren sollst.' },
      { ziel: () => app.querySelector('.fort-zeile'), titel: 'Dein Fortschritt', text: 'Jeder Punkt ist eine Āya des Abschnitts: grün richtig, rot Fehler, golden mit Hilfe. Daneben steht, bei welcher Āya du bist.' },
      { ziel: () => app.querySelector('#mikro'), titel: 'Dich selbst aufnehmen', text: 'Freiwillig: Tippe auf den Punkt und rezitiere. Beim Aufdecken endet die Aufnahme und du kannst dich anhören und mit dem Text vergleichen. Die Aufnahme wird nirgends gespeichert und nach der Bewertung gelöscht.' },
      { ziel: () => app.querySelector('#teil'), titel: 'Bis zum Zeichen', text: 'Deckt die Āya nur bis zum nächsten Stoppzeichen auf. Bei langen Āyāt prüfst du dich so Stück für Stück.' },
      { ziel: () => app.querySelector('#auf'), titel: 'Aufdecken', text: 'Deckt die ganze Āya auf. Du kannst auch direkt auf ein verdecktes Wort tippen.' },
      { ziel: () => app.querySelector('#hilfe'), titel: 'Erstes Wort', text: 'Wenn du nicht weißt, wie die Āya beginnt, zeigt dir das ihr erstes Wort. Danach deckt „Noch ein Wort“ jeweils ein weiteres auf. Die Āya zählt dann nur halb.' },
      { ziel: () => app.querySelector('#ansehen'), titel: 'Erst ansehen', text: 'Du kannst den Abschnitt auch zuerst offen lesen und dich erst danach prüfen.' },
      { ziel: () => app.querySelector('.ueb-kopf .info'), titel: 'Wo du bist', text: 'Oben stehen Bereich, Zahl der Āyāt und Zeilen und die Seite. R oder L zeigt, ob die Seite im gedruckten Muṣḥaf rechts oder links liegt.' },
      { titel: 'Jetzt du', text: 'Rezitiere die erste Āya aus dem Gedächtnis und decke sie dann auf. Danach zeigen wir dir, wie du dich bewertest.', los: 'Los geht’s' }
    ],
    'ueben-2': () => [
      { ziel: jetzt, titel: 'Vergleichen', text: 'Jetzt siehst du die Āya. Vergleiche Wort für Wort mit dem, was du rezitiert hast. Die Ehrlichkeit dabei ist eine Amāna: Nur so zeigt dir Itqān, wo du wirklich stehst.' },
      { ziel: () => app.querySelector('#hoeren'), titel: 'Anhören', text: 'Hier hörst du deine Aufnahme. Danach wird sie gelöscht.' },
      { ziel: () => app.querySelector('#r'), titel: 'Richtig', text: 'Die Āya war fehlerfrei und ohne Stocken. Das bringt 10 Itqān-Punkte, mit Hilfe 5. Ein Fehltipp lässt sich bei der nächsten Āya mit „Vorige Āya neu bewerten“ zurücknehmen.' },
      { ziel: () => app.querySelector('#f'), titel: 'Fehler', text: 'Ein Wort verwechselt oder ausgelassen, ein falscher Vokal oder ein Hänger. Danach kannst du die Stelle markieren. Ein Abschnitt mit Fehlern kommt nach 1, 3 und 7 Tagen wieder, bis er sitzt.', los: 'Verstanden' }
    ],
    'ueben-3': () => [
      { ziel: jetzt, titel: 'Die Stelle markieren', text: 'Tippe auf das Wort, bei dem du dich vertan hast. Es wird rot umrandet. Du kannst auch mehrere Wörter markieren. Das ist freiwillig.' },
      { ziel: () => app.querySelector('#arten'), titel: 'Was ist passiert?', text: 'Wähle, wenn du möchtest, die Art des Fehlers. Tippst du eine an, steht darunter, was sie bedeutet.' },
      { ziel: () => app.querySelector('#weiter'), titel: 'Weiter', text: 'Speichert die markierten Wörter und geht zur nächsten Āya.' },
      { titel: 'Deine Fehlerstellen', text: 'Alle markierten Wörter sammelt Itqān unter <b>Profil › Fehlerstellen</b>. Dort übst du jede Stelle gezielt: dreimal in Folge richtig, dann ist sie erledigt.<br><br>Auf der Muṣḥaf-Seite tragen markierte Wörter einen kleinen roten Punkt.' }
    ]
  };
  let tourAktiv = false;
  function tourPruefen() {
    if (tourAktiv || vorschau || abhoeren || phase !== 'haupt' || pos >= liste.length) return;
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
  function zeichne() { zeichneInnen(); tourPruefen(); }
  function zeichneInnen() {
    app.querySelector('#punkte').innerHTML = liste.map((a, i) => `<i class="${(phase === 'haupt' ? erg[i] : korr[i]) || (i === pos ? 'jetzt' : '')}"></i>`).join('');
    app.querySelector('.fort-zeile').classList.toggle('korrektur', phase === 'korrektur');
    seitenEl.querySelectorAll('.naechste').forEach(x => x.classList.remove('naechste'));
    seitenEl.querySelectorAll('.ziel').forEach(x => x.classList.remove('ziel'));
    A.classList.add('verdeckt');
    if (abhoeren) return abhoerenZeichnen();
    if (pos >= liste.length) return rundeFertig();
    const vi = liste[pos];
    Zl.textContent = phase === 'korrektur' ? `Korrektur ${pos + 1} von ${liste.length}` : `Āya ${pos + 1} von ${ayat.length}`;
    if (vorschau) {
      K.innerHTML = '<button class="knopf haupt" id="pruefen">Jetzt prüfen</button>';
      H.textContent = 'Lies den Abschnitt in Ruhe. Dann prüfe dich.';
      app.querySelector('#pruefen').onclick = () => { vorschau = false; seitenEl.classList.remove('vorschau'); zeichne(); sichtbar(spans(ayat[0])[0]); };
      return;
    }
    if (markieren) {
      A.classList.remove('verdeckt');
      A.innerHTML = Z.FEHLERARTEN.map(([w, l]) => `<button data-a="${w}" class="${fArt === w ? 'an' : ''}">${l}</button>`).join('');
      K.innerHTML = '<button class="knopf haupt" id="weiter">Weiter</button>';
      H.innerHTML = 'Tippe auf das Wort, bei dem du dich vertan hast. Freiwillig.<br><button class="textlink mini" id="doch-richtig">Doch kein Fehler</button>';
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
      K.innerHTML = `${AUFNAHME ? `<button class="knopf leise rund ${nimmt ? 'nimmt' : ''}" id="mikro" aria-label="${nimmt ? 'Aufnahme beenden' : 'Eigene Rezitation aufnehmen'}">${nimmt ? '■' : '●'}</button>` : ''}${grenze ? '<button class="knopf leise" id="teil">Bis zum Zeichen</button>' : ''}<button class="knopf haupt" id="auf">${ti ? 'Rest aufdecken' : `Āya ${D.V[vi][1]} aufdecken`}</button>`;
      const mb = app.querySelector('#mikro'); if (mb) mb.onclick = () => nimmt ? aufnahmeStopp() : aufnahmeStart();
      const links = [], start = phase === 'haupt' && pos === 0 && ti === 0 && !hilfe;
      if (E.hilfe) links.push(`<button class="textlink mini" id="hilfe">${hilfe ? 'Noch ein Wort' : ti ? 'Nächstes Wort' : 'Erstes Wort'}</button>`);
      if (E.vorueben && start) links.push('<button class="textlink mini" id="ansehen">Erst ansehen</button>');
      if (phase === 'haupt' && verlauf.length && ti === 0 && !hilfe) links.push('<button class="textlink mini" id="neu-bewerten">Vorige Āya neu bewerten</button>');
      if (E.abhoeren !== false && start && art !== 'stelle') links.push('<button class="textlink mini leiser" id="abhoeren">Jemand hört ab</button>');
      const satz = phase === 'korrektur' ? 'Sofortkorrektur: diese Āya noch einmal aus dem Gedächtnis. Zählt nicht für die Punkte.' : alt.has(vi) ? 'Hier warst du zuletzt unsicher.' : ti ? 'Weiter aus dem Gedächtnis.' : 'Rezitiere aus dem Gedächtnis.';
      H.innerHTML = (nimmt ? '<b class="nimmt-text">● Aufnahme läuft.</b> Beim Aufdecken endet sie.' : satz) + (links.length ? '<br>' + links.join('') : '');
      app.querySelector('#auf').onclick = aufdecken;
      const tb = app.querySelector('#teil'); if (tb) tb.onclick = teilAufdecken;
      // Hilfe Wort für Wort: jedes Tippen deckt das nächste verdeckte Wort auf, die Āya zählt dann als „mit Hilfe“
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
      K.innerHTML = `${aufnahme ? '<button class="knopf leise rund" id="hoeren" aria-label="Aufnahme anhören">▶</button>' : ''}<button class="knopf schlecht" id="f">Fehler</button><button class="knopf gut" id="r">Richtig</button>`;
      H.textContent = aufnahme ? 'Hör dir deine Rezitation an und vergleiche. Danach wird sie gelöscht.' : hilfe ? 'Mit Hilfe: zählt als halb sicher.' : 'Warst du sicher und fehlerfrei?';
      const hb2 = app.querySelector('#hoeren'); if (hb2) hb2.onclick = () => {
        if (spieler && !spieler.paused) { spieler.pause(); hb2.textContent = '▶'; return; }
        spieler ??= new Audio(aufnahme); spieler.currentTime = 0; spieler.play().catch(() => {}); hb2.textContent = '❚❚';
        spieler.onended = () => { hb2.textContent = '▶'; };
      };
      app.querySelector('#r').onclick = () => bewerte(hilfe ? 'hilfe' : 'ok');
      app.querySelector('#f').onclick = () => bewerte('fehler');
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
    const sp = spans(vi); sp.forEach(s => { s.classList.remove('alt', 'ok', 'hilfe', 'fehler'); s.classList.add(x); });
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
    seitenEl.querySelectorAll('.w.fmark').forEach(s => s.classList.remove('fmark'));
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
    spans(vi).forEach(s => { s.classList.remove('ok', 'hilfe', 'fehler'); if (alt.has(vi)) s.classList.add('alt'); });
    offen = true; hilfe = war === 'hilfe'; ti = 0; markieren = false;
    zwischenSpeichern(); zeichne(); sichtbar(spans(vi)[0]);
  }
  const zwischenSpeichern = () => { if (art !== 'stelle') Z.zwischenstandSpeichern(id, quelle, erg.slice(0, erg.length)); };
  // Ende einer Runde: nach der Hauptrunde die Fehler-Āyāt sofort noch einmal (wenn eingeschaltet), dann Abschluss
  function rundeFertig() {
    if (phase === 'haupt' && art !== 'stelle' && E.sofort !== false) {
      const f = ayat.filter((vi, i) => erg[i] === 'fehler');
      if (f.length) {
        phase = 'korrektur'; liste = f; pos = 0; offen = false; hilfe = false; ti = 0; korr = [];
        f.forEach(vi => { zu.add(vi); spans(vi).forEach(s => { s.classList.remove('fehler'); s.classList.add('zu'); }); });
        toast(f.length === 1 ? 'Sofortkorrektur: die Āya mit Fehler noch einmal.' : `Sofortkorrektur: die ${f.length} Āyāt mit Fehler noch einmal.`, 2800);
        zeichne(); sichtbar(spans(f[0])[0]); return;
      }
    }
    abschluss();
  }
  // Abhören (Tasmīʿ): eine zweite Person sieht den Text offen und tippt Fehler aufs Wort; dezente Nebenfunktion
  function abhoerenStart() {
    aufnahmeVerwerfen(); abhoeren = true; fArt = null;
    ayat.forEach(vi => { zu.delete(vi); spans(vi).forEach(s => s.classList.remove('zu', 'naechste', 'erstes')); });
    zeichne();
  }
  function abhoerenZeichnen() {
    Zl.textContent = `${ayat.length} Āyāt`;
    app.querySelector('#punkte').innerHTML = '';
    A.classList.remove('verdeckt');
    A.innerHTML = Z.FEHLERARTEN.map(([w, l]) => `<button data-a="${w}" class="${fArt === w ? 'an' : ''}">${l}</button>`).join('');
    K.innerHTML = '<button class="knopf leise" id="abh-ab">Abbrechen</button><button class="knopf haupt" id="abh-fertig">Fertig</button>';
    H.innerHTML = '<b>Abhören:</b> Der Text ist offen. Wer zuhört, tippt auf jedes Wort, bei dem ein Fehler kommt, und am Ende auf „Fertig“.';
    app.querySelector('#abh-ab').onclick = () => {
      abhoeren = false; seitenEl.querySelectorAll('.w.fmark').forEach(s => s.classList.remove('fmark'));
      ayat.forEach(vi => { zu.add(vi); spans(vi).forEach(s => s.classList.add('zu')); }); zeichne();
    };
    app.querySelector('#abh-fertig').onclick = () => {
      const marken = [...seitenEl.querySelectorAll('.w.fmark')];
      Z.abhoerErgebnis(ayat, new Set(marken.map(s => +s.dataset.v))).forEach((x, i) => { erg[i] = x; });
      if (marken.length) Z.fehlerstellenMerken(marken.map(s => `${s.dataset.v}.${s.dataset.i}`), fArt);
      pos = ayat.length; abschluss();
    };
  }
  function naechsteAya() { aufnahmeVerwerfen(); pos++; offen = false; hilfe = false; ti = 0; markieren = false; zeichne(); if (pos < liste.length && phase === 'korrektur') sichtbar(spans(liste[pos])[0]); }
  function markierenFertig() {
    const marken = [...seitenEl.querySelectorAll('.w.fmark')];
    if (marken.length) Z.fehlerstellenMerken(marken.map(s => `${s.dataset.v}.${s.dataset.i}`), fArt);
    marken.forEach(s => { s.classList.remove('fmark'); s.classList.add('fs'); });
    if (marken.length) toast(marken.length === 1 ? 'Stelle gemerkt.' : `${marken.length} Stellen gemerkt.`, 1600);
    verlauf.push({ pos, fs: fsVorher }); zwischenSpeichern();
    naechsteAya();
  }
  A.onclick = ev => {
    const a = ev.target.dataset.a; if (!a) return; fArt = fArt === a ? null : a;
    A.querySelectorAll('button').forEach(b => b.classList.toggle('an', b.dataset.a === fArt));
    H.innerHTML = fArt ? `<b>${Z.FEHLERARTEN.find(x => x[0] === fArt)[1]}:</b> ${Z.FEHLERARTEN_TEXT[fArt]}` : 'Tippe auf das Wort, bei dem du dich vertan hast. Freiwillig.';
  };
  seitenEl.onclick = ev => {
    const w = ev.target.closest('.w'); if (!w) return;
    if (abhoeren) { if (w.classList.contains('in')) w.classList.toggle('fmark'); return; }
    if (markieren) { if (+w.dataset.v === liste[pos]) w.classList.toggle('fmark'); return; }
    if (w.classList.contains('zu') && +w.dataset.v === liste[pos] && !offen && !vorschau) aufdecken();
  };
  const tasten = ev => {
    if (!document.body.contains(seitenEl)) { removeEventListener('keydown', tasten); return; }
    if (pos >= liste.length || abhoeren) return;
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.closest?.('button,a,select,input,summary')) return;
    if (ev.target.closest?.('input,select,textarea') || document.querySelector('.dialog')) return;
    if (vorschau) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); app.querySelector('#pruefen')?.click(); } return; }
    if (markieren) { if (ev.key === 'Enter') { ev.preventDefault(); markierenFertig(); } return; }
    if (!offen && (ev.key === ' ' || ev.key === 'Enter')) { ev.preventDefault(); aufdecken(); }
    else if (!offen && (ev.key === 's' || ev.key === 'ArrowDown')) { ev.preventDefault(); app.querySelector('#teil')?.click(); }
    else if (offen && (ev.key === 'r' || ev.key === 'ArrowRight')) bewerte(hilfe ? 'hilfe' : 'ok');
    else if (offen && (ev.key === 'f' || ev.key === 'ArrowLeft')) bewerte('fehler');
  };
  addEventListener('keydown', tasten);
  function stelleAbschluss() {
    mikroAus(); removeEventListener('keydown', tasten);
    const r = Z.fehlerstelleGeuebt(ayat[0], erg[0]), ok = erg[0] === 'ok';
    document.querySelector('.steuerung')?.remove();
    const text = ok ? (r.erledigt && !r.rest ? `${Z.STELLE_ZIEL}× in Folge richtig. Die Stelle ist aus deiner Liste genommen.` : `Noch ${Math.max(1, Z.STELLE_ZIEL - r.gut)}× in Folge richtig, dann ist die Stelle erledigt.`)
      : 'Die Zählung beginnt von vorn. Übe die Stelle bald noch einmal.';
    app.innerHTML = `<div class="feier">${qandil()}<h2>${ok ? (r.erledigt && !r.rest ? 'Die Stelle sitzt' : 'Richtig') : 'Noch nicht sicher'}</h2>
      <p>${D.V[ayat[0]][0]}:${D.V[ayat[0]][1]}<br><span class="unter">${text}</span></p>
      <div style="display:grid;gap:10px;margin-top:16px">${r.rest ? '<button class="knopf haupt" id="nochmal">Noch einmal üben</button>' : ''}<a class="knopf ${r.rest ? 'leise' : 'haupt'}" href="#fehlerstellen" style="text-decoration:none">Zu den Fehlerstellen</a></div></div>`;
    const n = app.querySelector('#nochmal'); if (n) n.onclick = () => ueben(idText, 'stelle', fokusText);
    window.scrollTo(0, 0);
  }
  function abschluss() {
    if (art === 'stelle') return stelleAbschluss();
    mikroAus(); Z.zwischenstandLoeschen();
    removeEventListener('keydown', tasten);
    const res = Z.abschnittAbschliessen(id, erg, art === 'frei' || art === 'bonus' ? art : undefined, zeitGanz ? zeitSekunden() : 0);
    letzteEreignisse.push(...res.ereignisse);
    const t2 = Z.tagesplan();
    const wirdJetzt = res.ereignisse.some(x => x.typ === 'wird');
    const naechster = t2.plan.find(x => !t2.fertig.includes(x));
    const orn = res.ereignisse.filter(x => x.typ === 'ornament').map(ornBand).join('')
      + res.ereignisse.filter(x => x.typ === 'rang').map(x => rangBand(x.r)).join('');
    document.querySelector('.steuerung').remove();
    app.innerHTML = `<div class="feier">${qandil()}
      <h2>${res.f ? 'Abschnitt beendet' : res.h ? 'Gut gemacht' : 'Fehlerfrei, mā šāʾa llāh'}</h2>
      <p>${esc(e.titel)}<br><span class="unter">${abschnittName(e)} · Stufe: ${Z.STUFEN[res.stufe]}${res.stufe > res.vorher ? ' ↑' : res.stufe < res.vorher ? ' ↓' : ''}</span></p>
      <div class="ernte"><div><b>${res.r + res.h}/${ayat.length}</b><span>Āyāt gekonnt</span></div><div><b data-hoch="${res.punkte}" data-vor="+">+${zahl(res.punkte)}</b><span>Itqān-Punkte</span></div>
        <div style="grid-column:1/-1"><b data-hoch="${res.hasanat}" data-vor="+">+${zahl(res.hasanat)}</b><span>Ḥasanāt</span></div></div>
      <p class="niyya">Jeder Buchstabe zehnfach, bei aufrichtiger Niyya, in šāʾa llāh.</p>
      <div class="aufschl">${res.teile.map(([a, b]) => `<div><span>${a}</span><span>+${zahl(b)}</span></div>`).join('')}</div>
      ${res.f ? `<div class="hinweisbox">${korr.length ? `<b>Sofortkorrektur:</b> ${korr.filter(x => x !== 'fehler').length} von ${korr.length} ${korr.length === 1 ? 'Āya sitzt' : 'Āyāt sitzen'} jetzt. ` : ''}Die ${res.f === 1 ? 'Fehler-Āya kommt' : res.f + ' Fehler-Āyāt kommen'} morgen wieder dran. Dann mit Markierung.</div>` : ''}
      ${orn}
      <div style="display:grid;gap:10px;margin-top:16px">
      ${wirdJetzt ? '<button class="knopf haupt" id="weiter">Weiter</button>' : naechster != null && art !== 'frei' ? `<button class="knopf haupt" id="naechster">Nächster Abschnitt</button><button class="knopf leise" id="uebersicht">Zur Übersicht</button>` : '<button class="knopf haupt" id="uebersicht">Zur Übersicht</button>'}
      </div></div>`;
    const w = app.querySelector('#weiter'); if (w) w.onclick = () => location.hash = '#fertig';
    const n = app.querySelector('#naechster'); if (n) n.onclick = () => location.replace(`#ueben/${naechster}`);
    const u = app.querySelector('#uebersicht'); if (u) u.onclick = () => location.hash = '#heute';
    window.scrollTo(0, 0); hochzaehlen(app);
  }
  // angefangene Übung von heute fortsetzen?
  const zw = art !== 'stelle' ? Z.zwischenstandLaden(id, quelle) : null;
  if (zw?.erg?.length && zw.erg.length <= ayat.length && zw.erg.every(x => ['ok', 'hilfe', 'fehler'].includes(x))) {
    const weiter = await dialog({ titel: 'Weitermachen?', html: `<p>Du hast diesen Abschnitt heute schon begonnen: ${zw.erg.length} von ${ayat.length} Āyāt sind bewertet.</p>`, ja: zw.erg.length < ayat.length ? `Bei Āya ${zw.erg.length + 1} weiter` : 'Weiter', nein: 'Neu beginnen' });
    if (weiter) {
      zw.erg.forEach((x, i) => { const vi = ayat[i]; erg[i] = x; status.set(vi, x); zu.delete(vi); spans(vi).forEach(s => { s.classList.remove('zu', 'alt'); s.classList.add(x); }); });
      pos = zw.erg.length; zeitGanz = false;
      einbl?.remove();
    } else Z.zwischenstandLoeschen();
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
  const quote = t.r + t.f + t.h ? `${t.r + t.h}/${t.r + t.f + t.h}` : '·';
  const extra = ev.filter(x => x.typ === 'rang').map(x => rangBand(x.r)).join('') + ev.filter(x => x.typ === 'kette' || x.typ === 'khatma' || x.typ === 'ornament').map(x =>
    x.typ === 'kette' ? `<div class="band">✦ <span><b>${x.n} Tage in Folge.</b> ${x.n === 66 ? 'Im Mittel wird eine Gewohnheit nach etwa 66 Tagen zur Selbstverständlichkeit.' : x.n === 40 ? 'Vierzig Tage Beständigkeit.' : 'Beständigkeit ist das Liebste bei Allāh, auch wenn es wenig ist.'}</span></div>`
    : x.typ === 'khatma' ? `<div class="band">✦ <span><b>Ḫatma ${x.n} vollendet.</b> Allāhumma rḥamnī bi-l-Qurʾān.</span></div>`
    : ornBand(x)).join('');
  app.innerHTML = `<div class="feier">${qandil()}
    <div class="ar">اللَّهُمَّ بَارِكْ</div><h2>Allāhumma bārik</h2>
    <p>Dein Wird für heute ist vollbracht.<br>Die ${P.kette.n}. Lampe deiner Kette brennt.</p>
    <div class="ernte"><div><b>${quote}</b><span>Āyāt gekonnt</span></div><div><b data-hoch="${t.punkte}" data-vor="+">+${zahl(t.punkte)}</b><span>Itqān-Punkte heute</span></div>
      <div><b data-hoch="${t.hasanat}" data-vor="+">+${zahl(t.hasanat)}</b><span>Ḥasanāt heute</span></div><div><b>${P.kette.n}</b><span>Tage Kette</span></div></div>
    <p class="niyya">Ḥasanāt nach dem Ḥadīṯ: jeder Buchstabe zehnfach, bei aufrichtiger Niyya, in šāʾa llāh.</p>
    ${extra}
    ${bonusId != null ? `<div class="angebot"><b>Noch Kraft für mehr?</b><p>Ein Bonusabschnitt bringt dir heute 50 % mehr Itqān-Punkte. Vorschlag: ${abschnittName(D.A[bonusId])}, „${esc(D.A[bonusId].titel)}“.</p><button id="bonus">Bonusabschnitt beginnen</button></div>` : ''}
    <button class="textlink" id="genug" style="margin-top:12px">Für heute genug</button></div>`;
  const b = app.querySelector('#bonus'); if (b) b.onclick = () => location.hash = `#ueben/${bonusId}/bonus`;
  app.querySelector('#genug').onclick = () => location.hash = '#heute';
  hochzaehlen(app);
  // fehlerfrei: volle Funken, mit Hilfe etwas weniger, mit Fehlern nur ein schwacher Schimmer
  funkeln(t.f ? 1 : t.h ? 2 : 3);
  app.querySelector('.feier').classList.add(t.f ? 'mit-fehlern' : 'strahlt');
}

// ---------- Lichtkarte ----------
const STUFEN_TEXT = [
  'Noch nicht wiederholt oder nach Fehlern ganz zurückgefallen. Diese Seiten leuchten kaum. Hier liegt die meiste Arbeit.',
  'Einmal ohne Fehler gekommen. Der Abschnitt ist da, aber noch nicht belastbar. Ein Fehler wirft ihn wieder auf „neu“ zurück.',
  'Zwei Stufen aufgebaut, meist zwei Durchgänge in Folge ohne Fehler. Der Abschnitt hält, auch wenn einige Zeit vergeht.',
  'Drei Stufen: mehrere Runden fehlerfrei. Du kannst hier ohne Anlauf einsteigen und sicher weiterrezitieren.',
  'Die höchste Stufe: mindestens vier Durchgänge in Folge ohne Fehler und ohne Hilfe. Itqān im eigentlichen Sinn, diese Seiten leuchten am hellsten.'
];
const STUFEN_REGEL = 'So entstehen die Stufen: Jeder Durchgang ohne Fehler hebt einen Abschnitt um eine Stufe. Jeder Fehler setzt ihn eine Stufe zurück, bei vielen Fehlern (mehr als 30 % der Āyāt) zwei. Mit „Anfang zeigen“ bleibt die Stufe gleich. Eine Seite leuchtet so hell wie der Mittelwert ihrer Abschnitte.';
function lichtkarte() {
  navSetzen('karte');
  const zeilen = [];
  const zaehl = [0, 0, 0, 0, 0];
  for (const e of D.A) if (Z.imBereich(e.id)) zaehl[Z.karte(e.id).st]++;
  for (let j = 1; j <= 30; j++) {
    const von = juzStart(j), bis = j < 30 ? juzStart(j + 1) - 1 : 604;
    const zellen = [];
    for (let p = von; p <= bis; p++) {
      const s = Z.seitenStufe(p);
      zellen.push(`<button data-p="${p}" class="${s == null ? 'aus' : ''}" title="Seite ${p}" aria-label="Seite ${p}, ${s == null ? 'nicht gewählt' : Z.STUFEN[Math.round(s)]}" style="${s != null ? `opacity:${(0.12 + 0.88 * s / 4.6).toFixed(2)}` : ''}"></button>`);
    }
    const oben = zellen.length > 22 ? Math.floor(zellen.length / 2) : 10;   // Ǧuzʾ 30 (23 Seiten): 11 und 12
    zeilen.push(`<div class="licht-juz"><span>${j}</span><div class="lk-reihen"><div class="licht-seiten lk-reihe">${zellen.slice(0, oben).join('')}</div><div class="licht-seiten lk-reihe">${zellen.slice(oben).join('')}</div></div><span class="lk-anz" title="Seiten in Ǧuzʾ ${j}">${zellen.length}</span></div>`);
  }
  app.innerHTML = `<div class="marke">Lichtkarte<small>Jede Seite leuchtet so hell, wie sie sitzt. Tippe auf eine Seite.</small></div>
    ${stellenWahl()}
    <div class="titel-klein" style="margin:18px 0 8px">Abschnitte nach Stufe</div>
    <div class="zahlen stufenwahl" style="grid-template-columns:repeat(5,1fr);margin-top:0">${Z.STUFEN.map((s, i) => `<button class="zahl" data-st="${i}"><b style="font-size:var(--s-text)">${zaehl[i]}</b><span>${s === 'im Aufbau' ? 'Aufbau' : s}</span></button>`).join('')}</div>
    <div class="hinweisbox verdeckt" id="stufeninfo"></div>
    <div class="lk-erklaerung">Darunter jede Zeile ein <b>Ǧuzʾ</b>, jedes Feld eine <b>Muṣḥaf-Seite</b>. Die Zahlen oben zählen dagegen <b>Abschnitte</b>.</div>
    <div class="licht-juz lk-kopf"><span>Ǧuzʾ</span><span class="mitte">Muṣḥaf-Seiten</span><span class="lk-anz">Seiten</span></div>
    <div id="licht">${zeilen.join('')}</div>
    <div class="legende"><span><i style="opacity:.12"></i>neu</span><span><i style="opacity:.45"></i>Aufbau</span><span><i style="opacity:.7"></i>sicher</span><span><i></i>mutqan</span></div>`;
  // Tippen auf eine Seite: kleines Infokästchen unter dem Ǧuzʾ, erst der Knopf darin führt zur Seite
  const licht = app.querySelector('#licht');
  licht.onclick = ev => {
    const b = ev.target.closest('[data-p]');
    if (ev.target.closest('#seiteninfo') || !b) return;
    const alt = licht.querySelector('#seiteninfo'), p = +b.dataset.p;
    licht.querySelectorAll('.gewaehlt').forEach(x => x.classList.remove('gewaehlt'));
    if (alt) { const gleich = +alt.dataset.p === p; alt.remove(); if (gleich) return; }
    b.classList.add('gewaehlt');
    const abschnitte = D.A.filter(e => e.seiten.includes(p));
    const s = D.V[D.L[p - 1].find(z => z.w)?.w[0][1] ?? 0][0], st = Z.seitenStufe(p);
    const box = document.createElement('div'); box.id = 'seiteninfo'; box.className = 'seiteninfo'; box.dataset.p = p;
    box.innerHTML = `<div class="kopf"><b>Seite ${p}</b><span>${sureName(s)} · Ǧuzʾ ${juzVonSeite(p)} · ${p % 2 ? 'rechte' : 'linke'} Seite</span></div>
      ${st == null ? '<p class="unter">Diese Seite gehört nicht zu deinem Wiederholungsbereich.</p>' : ''}
      ${abschnitte.map(e => `<div class="zeile"><span>${e.nr ? `${sureName(e.von[0])} <b>${e.nr}</b>` : abschnittName(e)}: ${esc(e.titel)}<small>${bereichText(e)}</small></span><span class="st">${Z.STUFEN[Z.karte(e.id).st]}</span></div>`).join('')}
      <a class="knopf haupt klein" href="#mushaf/${p}" style="text-decoration:none;margin-top:4px">Zur Seite ${p}</a>`;
    b.closest('.licht-juz').after(box);
  };
  // Tippen irgendwo außerhalb des Kästchens schließt es (Scrollen löst keinen Klick aus)
  const aussen = ev => {
    if (!licht.isConnected) { document.removeEventListener('click', aussen); return; }
    const box = licht.querySelector('#seiteninfo');
    if (!box || box.contains(ev.target) || ev.target.closest('#licht [data-p]')) return;
    box.remove(); licht.querySelectorAll('.gewaehlt').forEach(x => x.classList.remove('gewaehlt'));
  };
  document.addEventListener('click', aussen);
  stellenWahlBinden();
  const info = app.querySelector('#stufeninfo');
  app.querySelector('.stufenwahl').onclick = ev => {
    const b = ev.target.closest('[data-st]'); if (!b) return;
    const an = !b.classList.contains('an');
    app.querySelectorAll('.stufenwahl .zahl').forEach(x => x.classList.toggle('an', an && x === b));
    info.classList.toggle('verdeckt', !an);
    if (an) { const i = +b.dataset.st; info.innerHTML = `<b>${Z.STUFEN[i]}</b> · ${zaehl[i]} ${zaehl[i] === 1 ? 'Abschnitt' : 'Abschnitte'}<br>${STUFEN_TEXT[i]}<p class="unter" style="margin-top:8px">${STUFEN_REGEL}</p>`; }
  };
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
  return `${buch}<div><b>${r ? 'Rechte Seite' : 'Linke Seite'}</b><br>Im gedruckten Muṣḥaf liegt Seite ${p} ${r ? 'rechts' : 'links'}${links <= 604 && rechts >= 1 ? `, aufgeschlagen zusammen mit Seite ${r ? links : rechts} ${r ? 'links' : 'rechts'} daneben` : ''}. Ungerade Seiten liegen immer rechts, gerade immer links.</div>`;
}
// Auswahl Sūra → Abschnitt, springt zur Stelle im Muṣḥaf
function stellenWahl(sJetzt = 0) {
  return `<div class="stellenwahl"><select id="wahl-sure" aria-label="Sūra"><option value="">Sūra wählen …</option>${Array.from({ length: 114 }, (_, i) => i + 1).map(n => `<option value="${n}"${n === sJetzt ? ' selected' : ''}>${n}. ${esc(sureName(n))}</option>`).join('')}</select>
    <select id="wahl-abschnitt" aria-label="Abschnitt"${sJetzt ? '' : ' disabled'}>${abschnittOptionen(sJetzt)}</select></div>`;
}
function abschnittOptionen(s) {
  if (!s) return '<option value="">Abschnitt …</option>';
  return '<option value="">Abschnitt wählen …</option>' + D.A.filter(e => e.von[0] <= s && e.bis[0] >= s)
    .map(e => `<option value="${e.id}">${e.nr ? e.nr + '. ' : ''}${esc(e.titel)} (${bereichText(e)})</option>`).join('');
}
function stellenWahlBinden() {
  const ss = app.querySelector('#wahl-sure'), sa = app.querySelector('#wahl-abschnitt');
  ss.onchange = () => { sa.innerHTML = abschnittOptionen(+ss.value); sa.disabled = !ss.value; if (ss.value) sa.focus(); };
  sa.onchange = () => { const e = D.A[+sa.value]; if (e) location.hash = `#mushaf/${e.seiten[0]}/${e.id}`; };
}
// Seitenauswahl, nach Aǧzāʾ gruppiert
function seitenOptionen(p) {
  let h = '';
  for (let j = 1; j <= 30; j++) {
    const von = juzStart(j), bis = j < 30 ? juzStart(j + 1) - 1 : 604;
    h += `<optgroup label="Ǧuzʾ ${j}">`;
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
  const knopfText = x => dop ? `Seiten ${paarVon(x).join(' und ')}` : `Seite ${x}`;
  app.innerHTML = '<div class="lade">Seite wird geladen …</div>';
  await schriftenLaden(seiten);
  const abschnitte = D.A.filter(e => e.seiten.some(x => seiten.includes(x)));
  const nrVon = vi => abschnitte.findIndex(e => vi >= e.v[0] && vi <= e.v[1]);
  const t = Z.tagesplan();
  const s = D.V[D.L[seiten[0] - 1].find(z => z.w)?.w[0][1] ?? 0][0];
  const opt = { ton: vi => { const i = nrVon(vi); return i < 0 ? null : abschnitte[i].id % 4; }, fst: Z.fehlerstellenSet(), grenzen: true };
  app.innerHTML = `<div class="kopfzeile"><div class="marke">Muṣḥaf<small>${seiten.length > 1 ? `Seiten ${seiten.join(' und ')}` : `Seite ${p}`} · ${sureName(s)} · Ǧuzʾ ${juzVonSeite(p)}</small></div>
      <div class="reihe-k"><a class="seitenlage such-knopf" href="#suche" aria-label="Im Qurʾān suchen">${lupe}</a><button class="seitenlage" id="lage" aria-label="${p % 2 ? 'rechte' : 'linke'} Seite">${p % 2 ? 'R' : 'L'}</button><select id="nr" class="seitenwahl" aria-label="Seite">${seitenOptionen(p)}</select></div></div>
    <div class="hinweisbox lageinfo verdeckt" id="lageinfo">${lageInfo(p)}</div>
    ${stellenWahl(s)}
    <div class="reihe blaettern" style="margin:12px 0 14px"><button class="knopf leise klein" id="vor">‹ ${knopfText(naechste)}</button><button class="knopf leise klein" id="zur">${knopfText(vorige)} ›</button></div>
    <div id="seite" class="${dop ? 'doppel' : ''}"><div class="roller">${dop ? paarHTML(seiten, opt) : seiteHTML(p, opt)}</div><button class="vollbild-knopf" id="vollbild" aria-label="Seite im Vollbild zeigen">${vollbildIcon}</button></div>
    <div class="titel-klein">Abschnitte auf ${seiten.length > 1 ? 'diesen Seiten' : 'dieser Seite'}</div>
    ${abschnitte.map((e, i) => {
      const dran = t.plan.includes(e.id) && !t.fertig.includes(e.id);
      return `<div class="karte tonk${e.id % 4}" data-a="${i}"><i class="farbe"></i><div class="t"><b>${esc(e.titel)}</b><span>${e.nr ? `${sureName(e.von[0])} <b class="nr-fett">${e.nr}</b>` : abschnittName(e)} · ${bereichText(e)} · ${Z.STUFEN[Z.karte(e.id).st]}${dran ? ' <span class="marke-art bonus">heute dran</span>' : ''}</span></div><a class="knopf leise klein" style="width:auto;text-decoration:none" href="#ueben/${e.id}/frei">Üben</a></div>`;
    }).join('')}`;
  const seiteEl = app.querySelector('#seite');
  zeilenEinpassen(seiteEl); grenzenZeichnen(seiteEl);
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
  const ziel = aText != null ? D.A[+aText] : null;
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
  v.innerHTML = `<div class="vb-buehne"></div><button class="vb-zu" aria-label="Vollbild schließen">✕</button>
    <button class="vb-pfeil links" aria-label="Nächste Seite">‹</button><button class="vb-pfeil rechts" aria-label="Vorige Seite">›</button>`;
  document.body.appendChild(v); document.body.classList.add('im-vollbild');
  try { document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })?.catch(() => {}); } catch (e) {}   // nicht abwarten: iPhone kennt es nicht
  const buehne = v.querySelector('.vb-buehne');
  const quer = () => innerWidth > innerHeight || doppelseitig();   // quer am Handy, PC und Tablet immer
  // Abschnitte farbig wie in der Muṣḥaf-Ansicht
  const farben = x => { const ab = D.A.filter(e => e.seiten.includes(x)); return { grenzen: true, lage: true, ton: vi => { const e = ab.find(e => vi >= e.v[0] && vi <= e.v[1]); return e ? e.id % 4 : null; } }; };
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
    zeilenEinpassen(buehne); grenzenZeichnen(buehne);
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
const istText = b => b.k === 'ganz' || b.k === 'offen0' ? (b.ok ? 'erfüllt' : 'offen') : `${b.k === 'punkte' ? zahl(b.ist) : String(b.ist).replace('.', ',')}${['quote', 'st2', 'st3', 'st4'].includes(b.k) ? ' %' : ''}`;
const bedListe = (i, z) => `<div class="bed">${Z.bedingungen(i, z).map(b => `<div class="${b.ok ? 'ok' : ''}"><span>${b.ok ? '✓ ' : ''}${b.text}</span><span>${istText(b)}</span><i><b style="width:${(fortschritt(b) * 100).toFixed(1)}%"></b></i></div>`).join('')}</div>`;
function rangKarte() {
  const z = Z.kennzahlen(), r = Z.rangJetzt(z), R = Z.RAENGE[r], best = Z.P.rangBeste?.r ?? 0;
  return `<div class="rangkarte"><div class="kopf"><span class="ar">${R.ar}</span><div><span class="titel-klein" style="margin:0">Rang ${r + 1} von ${Z.RAENGE.length}</span><b>${R.n}</b><span>${R.de}</span></div></div>
    ${best > r ? `<p class="unter">Höchster erreichter Rang: ${Z.RAENGE[best].n}. Die Bedingungen dafür sind gerade nicht alle erfüllt.</p>` : ''}
    ${r + 1 < Z.RAENGE.length ? `<p class="naechster">Zum nächsten Rang, ${Z.RAENGE[r + 1].n}:</p>${bedListe(r + 1, z)}` : '<p class="naechster">Der höchste Rang. Allāhumma bārik.</p>'}
    <a class="textlink" href="#raenge" style="padding-left:0">Alle Ränge und was sie bedeuten ›</a></div>`;
}
function raenge() {
  navSetzen('profil');
  const z = Z.kennzahlen(), r = Z.rangJetzt(z);
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#profil'">${zurueckPfeil}Profil</button>
    <div class="marke">Die Ränge<small>Dreizehn Stufen vom ersten Schritt bis zum Itqān über den ganzen Qurʾān.</small></div>
    <p class="unter" style="margin:14px 0 4px">Ein Rang verlangt immer beides: Fleiß (Itqān-Punkte, Ḫatmāt) und Güte (die Fehlerfrei-Quote). Die Quote zählt die Āyāt, die beim letzten Durchgang jedes Abschnitts ohne Fehler und ohne Hilfe kamen, über deinen ganzen Bereich. Noch nicht wiederholte Abschnitte zählen als nicht sicher. Lässt die Güte nach, sinkt auch der Rang, bis sie wieder erreicht ist.</p>
    <p class="unter">Ab Rang 7 gilt nur der ganze Qurʾān. Bei drei Abschnitten am Tag dauert der Weg zum höchsten Rang mehrere Jahre.</p>
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
  app.innerHTML = `<div class="marke">${P.name ? esc(P.name) : 'Dein Profil'}<small>dabei seit ${new Date(P.erstellt).toLocaleDateString('de-AT')} · ${P.zyklus.khatma} ${P.zyklus.khatma === 1 ? 'Ḫatma' : 'Ḫatmāt'} vollendet</small></div>
    ${rangKarte()}
    <div class="zahlen" style="margin-top:18px"><div class="zahl"><b>${zahl(s.punkte)}</b><span>Itqān-Punkte</span></div><div class="zahl"><b>${zahl(s.hasanat)}</b><span>Ḥasanāt</span></div><div class="zahl"><b>${quote} %</b><span>Āyāt sicher</span></div>
      <div class="zahl"><b>${Z.ketteAktiv() ? P.kette.n : 0}</b><span>Kette jetzt</span></div><div class="zahl"><b>${P.kette.beste}</b><span>längste Kette</span></div><div class="zahl"><b>${s.abschnitte}</b><span>Abschnitte</span></div></div>
    <div class="titel-klein">Itqān-Punkte der letzten 30 Tage</div>
    <div class="diagramm" role="img" aria-label="Itqān-Punkte der letzten 30 Tage: zusammen ${zahl(tage.reduce((a, x) => a + (x.t?.punkte || 0), 0))}, bester Tag ${zahl(Math.max(0, ...tage.map(x => x.t?.punkte || 0)))}, ${tage.filter(x => x.t?.punkte).length} Tage mit Übung">${tage.map(x => `<div class="${x.t?.punkte ? '' : 'leer'}" style="height:${x.t?.punkte ? Math.max(4, 100 * x.t.punkte / max) : 3}%" title="${x.d}: ${x.t?.punkte || 0}"></div>`).join('')}</div>
    <div class="klein-zeile"><span>vor 30 Tagen</span><span>heute</span></div>
    <div class="unterseiten"><a class="karte" href="#auswertung"><div class="t"><b>Auswertung</b><span>Fehlerarten, Sūren, Quote und Zeit</span></div><span class="pfeil">›</span></a>
      <a class="karte" href="#rueckblick"><div class="t"><b>Rückblick</b><span>Woche und Monat als Bild zum Aufheben und Teilen</span></div><span class="pfeil">›</span></a>
      <a class="karte" href="#aehnlich"><div class="t"><b>Ähnliche Stellen</b><span>Mutašābihāt nachschlagen, vergleichen und unterscheiden</span></div><span class="pfeil">›</span></a>
      <a class="karte" href="#fortschritt"><div class="t"><b>Fortschritt</b><span>Wo du am meisten übst</span></div><span class="pfeil">›</span></a>
      <a class="karte" href="#fehlerstellen"><div class="t"><b>Fehlerstellen</b><span>${Object.keys(P.fstellen || {}).length} markierte Stellen zum gezielten Üben</span></div><span class="pfeil">›</span></a>
      <a class="karte" href="#ornamente"><div class="orn-vorschau">${zuletzt.length ? zuletzt.map(x => ornamentSVG(x.sn, x.o.stufe, 'mini')).join('') : ornamentSVG(1, 0, 'mini')}</div><div class="t"><b>Ornamente und Meilensteine</b><span>${gesammelt.length} von 114 Ornamenten${vergoldet ? ` · ${vergoldet} vergoldet` : ''}</span></div><span class="pfeil">›</span></a></div>
    <div class="titel-klein">Sicherung</div>
    <p class="unter">Es gibt keinen Server: Deine Fortschritte liegen nur auf diesem Gerät. Sichere sie regelmäßig${istTouch() ? ', am besten in Dateien, iCloud Drive oder per WhatsApp an dich selbst' : ' als Datei'}. Letzte Sicherung: <b>${datumKurz(P.einst.letzteSicherung)}</b>.</p>
    <div class="reihe" style="margin-top:10px"><button class="knopf haupt klein" id="sichern">Profil sichern</button><button class="knopf leise klein" id="laden">Profil laden</button></div>
    <div style="display:grid;gap:10px;margin-top:22px"><a class="knopf leise" href="#einstellungen" style="text-decoration:none">Einstellungen</a><a class="knopf leise" href="#hilfe" style="text-decoration:none">Hilfe und Glossar</a><a class="knopf leise" href="#lehrer" style="text-decoration:none">Lehreransicht</a><a class="knopf leise" href="#einfuehrung" style="text-decoration:none">Einführung ansehen</a><button class="knopf leise" id="tour-neu">Erklärung beim Üben wieder zeigen</button><a class="knopf leise" href="#installieren" style="text-decoration:none">Itqān installieren</a><a class="knopf leise" href="#rueckmeldung" style="text-decoration:none">Rückmeldung senden</a></div>
    <p class="version-zeile">Itqān ${VERSION} · <a href="#neu">Was ist neu</a></p>`;
  app.querySelector('#tour-neu').onclick = () => { tourZuruecksetzen(); toast('Beim nächsten Üben erscheint die Erklärung wieder.'); };
  app.querySelector('#sichern').onclick = async () => { if (await profilSichern()) profil(); };
  app.querySelector('#laden').onclick = profilLaden;
}

// ---------- Hilfe und Glossar ----------
// ohne Sonderzeichen suchen: „hatma“ findet Ḫatma, „guz“ findet Ǧuzʾ
const schlicht = s => s.normalize('NFD').replace(/[\u0300-\u036f\u02be\u02bf'’]/g, '').toLowerCase();
function hilfeSeite(ziel) {
  navSetzen('profil');
  const kbd = k => `<kbd>${k}</kbd>`;
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#profil'">${zurueckPfeil}Profil</button>
    <div class="marke">Hilfe<small>Fragen, Begriffe und Bedienung</small></div>
    <div class="hf-sprung" role="navigation" aria-label="Auf dieser Seite">${[['fragen', 'Fragen'], ['glossar', 'Glossar'], ['lesbar', 'Lesbarkeit'], ['tasten', 'Tastatur']].map(([z, l]) => `<button data-z="${z}">${l}</button>`).join('')}</div>
    <h2 class="titel-klein" id="hf-fragen" tabindex="-1">Fragen und Antworten</h2>
    <div class="hf-fragen">${FRAGEN.map(x => `<details><summary>${x.f}</summary><p>${x.a}</p></details>`).join('')}</div>
    <h2 class="titel-klein" id="hf-glossar" tabindex="-1">Glossar</h2>
    <div class="hf-suche"><input type="search" id="hf-filter" placeholder="Begriff suchen" aria-label="Begriff im Glossar suchen" autocomplete="off" enterkeyhint="search"></div>
    <dl class="glossar" id="hf-liste">${GLOSSAR.map(g => `<div data-s="${esc(schlicht(g.b + ' ' + g.t + ' ' + (g.mehr || '')))}"><dt>${g.b}${g.ar ? `<span lang="ar" dir="rtl">${g.ar}</span>` : ''}</dt><dd>${g.t}${g.mehr ? `<small>${g.mehr}</small>` : ''}</dd></div>`).join('')}</dl>
    <p class="leer verdeckt" id="hf-leer" role="status">Kein Begriff gefunden.</p>
    <h2 class="titel-klein" id="hf-lesbar" tabindex="-1">Lesbarkeit</h2>
    <div class="abschnitt"><p><b>Seitengröße.</b> In den Einstellungen wählst du 100, 125 oder 150 %. So groß erscheint die Muṣḥaf-Seite beim Üben und im Muṣḥaf. Ist sie breiter als der Bildschirm, schiebst du sie mit dem Finger. Beim Üben folgt sie von selbst der Stelle, an der du bist.</p>
      <p style="margin-top:10px"><b>Schriftgröße.</b> Normal, groß oder sehr groß: Das gilt für Texte, Knöpfe und Überschriften der App.</p>
      <p style="margin-top:10px"><b>Zoomen.</b> Mit zwei Fingern lässt sich jede Ansicht vergrößern. Im Vollbild des Muṣḥaf füllt die Seite den ganzen Bildschirm.</p>
      <p style="margin-top:10px"><b>Hell und Dunkel.</b> Beide Erscheinungsbilder halten den Kontrast ein, der für gut lesbare Schrift verlangt wird (WCAG 2.1, Stufe AA).</p>
      <a class="knopf leise" href="#einstellungen" style="text-decoration:none;margin-top:14px">Zu den Einstellungen</a></div>
    <h2 class="titel-klein" id="hf-tasten" tabindex="-1">Tastatur</h2>
    <div class="abschnitt"><table class="hf-tasten">${TASTEN.map(t => `<tr><td colspan="2"><b>${t.wo}</b></td></tr>` + t.kuerzel.map(([k, was]) => `<tr><th scope="row">${k.map(kbd).join(' oder ')}</th><td>${was}</td></tr>`).join('')).join('')}</table></div>
    <h2 class="titel-klein">Bildschirmleser</h2>
    <div class="abschnitt"><p>Jeder Knopf hat einen Namen, jede Auswahl sagt, was gewählt ist, und nach einem Wechsel der Ansicht beginnt der Leser oben in der neuen Ansicht. Beim Üben wird die aufgedeckte Āya auf Arabisch angesagt.</p>
      <p style="margin-top:10px">Zwei Dinge fehlen noch: Eine Muṣḥaf-Seite als Ganzes ist für den Bildschirmleser nur ein Bild, und das Markieren des Fehlerworts geht bisher nur durch Tippen auf das Wort.</p></div>
    <p class="lesbar-probe">Deine Frage ist nicht dabei? <a href="#rueckmeldung">Schreib uns</a>, dann ergänzen wir die Hilfe.</p>`;
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
const ornBand = x => `<div class="band orn-band">${ornamentSVG(x.s, x.stufe === 'mutqan' ? 4 : 2, 'mini')}<span>${x.stufe === 'mutqan' ? `<b>Vergoldet:</b> Das Ornament von ${sureName(x.s)} glänzt jetzt in Gold, die ganze Sūra ist mutqan.` : `<b>Neues Ornament:</b> ${sureName(x.s)} ist ganz gefestigt.`} <a href="#ornamente">Ansehen</a></span></div>`;
function ornamentDetail(s) {
  const o = Z.ornamentStand(s), info = ornamentInfo(s), e0 = Z.sureAbschnitte(s)[0];
  const art = s === 1 ? 'Umm al-Kitāb: eine große Šamsa mit sieben Blättern für die sieben Āyāt.'
    : info.klasse === 1 && info.blaetter === info.ayat ? `Eine Blüte mit ${info.ayat} Blättern, eines für jede Āya.` : KLASSEN_TEXT[info.klasse] + '.';
  const stand = o.stufe >= 4 ? `Vergoldet${o.datum ? ' am ' + new Date(o.datum).toLocaleDateString('de-AT') : ''}. Die ganze Sūra ist mutqan.`
    : o.stufe >= 2 ? `Gesammelt${o.erst ? ' am ' + new Date(o.erst).toLocaleDateString('de-AT') : ''}. Vergoldet wird es, wenn alle ${o.gesamt} ${o.gesamt === 1 ? 'Abschnitt' : 'Abschnitte'} mutqan sind (jetzt ${o.mutqan}).`
    : !o.imBereich ? 'Diese Sūra liegt nicht ganz in deinem Wiederholungsbereich.'
    : `Noch nicht gesammelt: ${o.gefestigt} von ${o.gesamt} ${o.gesamt === 1 ? 'Abschnitt' : 'Abschnitten'} gefestigt.`;
  const anteil = o.stufe >= 2 ? o.mutqan / o.gesamt : o.gefestigt / o.gesamt;
  const d = document.createElement('div'); d.className = 'orn-detail';
  d.innerHTML = `<div class="orn-karte" role="dialog" aria-label="Ornament ${esc(sureName(s))}">
    <div class="orn-gross">${ornamentSVG(s, o.stufe)}</div>
    <div class="ar">${sureArabisch(s)}</div><h2>${s}. ${esc(sureName(s))}</h2>
    <p class="unter">${art}</p><p>${stand}</p>
    ${o.imBereich && o.stufe < 4 ? `<div class="balken"><div style="width:${(anteil * 100).toFixed(1)}%"></div></div><div class="klein-zeile"><span>${o.stufe >= 2 ? 'mutqan' : 'gefestigt'}</span><span>${o.stufe >= 2 ? o.mutqan : o.gefestigt} von ${o.gesamt}</span></div>` : ''}
    <div class="reihe" style="margin-top:14px">${e0 ? `<a class="knopf leise klein" href="#mushaf/${e0.seiten[0]}/${e0.id}" style="text-decoration:none">Im Muṣḥaf</a>` : ''}<button class="knopf haupt klein" id="orn-zu">Schließen</button></div></div>`;
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
  const ketten = Z.KETTEN_MEILEN.map(n => { const hat = P.meilen.includes('kette-' + n); return `<div class="meilenstein ${hat ? 'hat' : ''}">${lampeKlein}<b>${n}</b><span>Tage</span></div>`; }).join('');
  let filter = 'alle';
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#profil'">${zurueckPfeil}Profil</button>
    <div class="marke">Ornamente<small>Für jede Sūra ein eigenes Ornament. Du bekommst es, wenn alle Abschnitte der Sūra gefestigt sind. Ist die ganze Sūra mutqan, wird es vergoldet. Je länger die Sūra, desto prächtiger das Ornament.</small></div>
    <div class="zahlen"><div class="zahl"><b>${ges}</b><span>von 114 gesammelt</span></div><div class="zahl"><b>${gold}</b><span>vergoldet</span></div><div class="zahl"><b>${P.zyklus.khatma}</b><span>${P.zyklus.khatma === 1 ? 'Ḫatma' : 'Ḫatmāt'}</span></div></div>
    <div class="wahl" id="ofilter" style="margin-top:16px"><button data-w="alle" class="an">Alle 114</button><button data-w="hat">Gesammelt</button><button data-w="offen">Noch offen</button></div>
    <div class="orn-legende" aria-label="Größen der Ornamente">${[['unter 1', 'Seite', 1.5], ['1 bis 4', 'Seiten', 2], ['5 bis 9', 'Seiten', 3], ['10 bis 20', 'Seiten', 4], ['über 20', 'Seiten', 6]].map(([t, w, e], i) => `<div><span class="kreis"><i style="--e:${e}"></i></span><b>${i + 1}</b><span>${t}<br>${w}</span></div>`).join('')}</div>
    <p class="orn-legende-text">Die Größe richtet sich nach der Länge der Sūra im Muṣḥaf. Wegen ihrer besonderen Stellung ist <span style="white-space:nowrap">al-Fātiḥah</span> größer, als ihre Länge es vorgibt, und steht in Größe 3 an erster Stelle.</p>
    <div class="orn-feld" id="og"></div>
    <div class="titel-klein">Meilensteine der Kette</div>
    <div class="meilensteine">${ketten}</div>
    <p class="unter" style="margin-top:8px">Längste Kette: ${P.kette.beste} ${P.kette.beste === 1 ? 'Tag' : 'Tage'} · höchster Rang: ${Z.RAENGE[P.rangBeste?.r ?? 0].n}</p>`;
  const og = app.querySelector('#og');
  // Größe 1 bis 5 nach der Länge der Sūra, al-Fātiḥah ausnahmsweise 3. Eine Reihe hat 12 Teile:
  // Größe 5 = 6 Teile (zwei je Reihe), 4 = 4, 3 = 3, 2 = 2, 1 = 1,5. Die Reihenfolge des Muṣḥaf bleibt immer erhalten.
  const kachel = s => `<button class="orn-kachel g${s === 1 ? 3 : groesse(s)}${st[s].stufe ? '' : ' offen'}" data-s="${s}" aria-label="${s}. ${esc(sureName(s))}">${ornamentSVG(s, st[s].stufe)}<span><b>${s}</b><i>. ${esc(sureName(s))}</i></span></button>`;
  const zeichnen = () => {
    const liste = Array.from({ length: 114 }, (_, i) => i + 1).filter(s => filter === 'alle' || (filter === 'hat') === (st[s].stufe >= 2));
    if (!liste.length) { og.innerHTML = `<p class="leer">${filter === 'hat' ? 'Dein erstes Ornament bekommst du, wenn alle Abschnitte einer Sūra gefestigt sind.' : 'Alle 114 Ornamente sind gesammelt. Allāhumma bārik.'}</p>`; return; }
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
function fortschrittSeite() {
  navSetzen('profil');
  const schwach = Z.schwaechste(25);
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#profil'">${zurueckPfeil}Profil</button>
    <div class="marke">Fortschritt<small>Die Abschnitte, in denen du dich am häufigsten vertan hast. Tippe auf einen, um ihn zu üben.</small></div>
    <div style="margin-top:16px">${schwach.length ? schwach.map(({ id, k }) => `<a class="karte" href="#ueben/${id}/frei" style="text-decoration:none;color:inherit"><div class="t"><b>${esc(D.A[id].titel)}</b><span>${abschnittMarke(D.A[id])} · ${k.fe} Fehler in ${k.n} Durchgängen${k.fae ? ' · kommt wieder' : ''}</span></div>${stufePunkte(k.st)}</a>`).join('') : '<p class="leer">Noch keine Daten. Nach den ersten Tagen siehst du hier deine schwächsten Abschnitte.</p>'}</div>`;
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
  const wort = art === 'monat' ? ['Dieser Monat', 'Letzter Monat', `vor ${v} Monaten`] : ['Diese Woche', 'Letzte Woche', `vor ${v} Wochen`];
  const einheit = art === 'monat' ? 'Monat' : 'Woche';
  let mitName = !!P.name && P.einst.rbName !== false, blob = null;
  const name = () => mitName ? P.name : '';
  // ob dieses Gerät Bilder an andere Apps weitergeben kann (iPhone, Android)
  let kannTeilen = false;
  try { kannTeilen = istTouch() && !!navigator.canShare?.({ files: [new File([new Blob(['x'], { type: 'image/png' })], 'x.png', { type: 'image/png' })] }); } catch (e) {}
  const worte = () => RB.beschreibung(R, name());
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#profil'">${zurueckPfeil}Profil</button>
    <div class="marke">Rückblick<small>Eine Woche oder ein Monat als Bild: zum Aufheben oder zum Teilen mit Lehrer, Eltern und Freunden.</small></div>
    <div class="wahl" id="rb-art" style="margin-top:16px" role="group" aria-label="Zeitraum"><button data-w="woche" class="${art === 'woche' ? 'an' : ''}" aria-pressed="${art === 'woche'}">Woche</button><button data-w="monat" class="${art === 'monat' ? 'an' : ''}" aria-pressed="${art === 'monat'}">Monat</button></div>
    <div class="rb-zeit"><button class="rb-pfeil" id="rb-vor" aria-label="${einheit} davor"${R.frueher ? '' : ' disabled'}>‹</button>
      <div class="mitte" aria-live="polite"><b>${RB.zeitraumTitel(R)}</b><span>${wort[Math.min(v, 2)]}${R.laufend && !R.leer ? ' · läuft noch' : ''}</span></div>
      <button class="rb-pfeil" id="rb-nach" aria-label="${einheit} danach"${v ? '' : ' disabled'}>›</button></div>
    ${R.leer ? `<p class="leer rb-leer">In ${art === 'monat' ? 'diesem Monat' : 'dieser Woche'} hast du ${R.laufend ? 'noch nicht' : 'nicht'} geübt.${R.frueher ? ` Mit dem Pfeil links kommst du zu${art === 'monat' ? 'm Monat' : 'r Woche'} davor.` : ''}</p>` : `
    <div class="rb-bild"><img id="rb-img" alt="${esc(worte().join(' '))}"></div>
    <div class="reihe" style="margin-top:14px">${kannTeilen ? '<button class="knopf haupt" id="rb-teilen" disabled>Teilen</button>' : ''}<button class="knopf ${kannTeilen ? 'leise' : 'haupt'}" id="rb-speichern" disabled>Bild speichern</button></div>
    ${P.name ? `<label class="haken rb-name"><input type="checkbox" id="rb-name"${mitName ? ' checked' : ''}> Mein Name steht auf dem Bild</label>` : ''}
    <div class="titel-klein">In Worten</div>
    <ul class="rb-worte" id="rb-worte">${worte().slice(1).map(s => `<li>${esc(s)}</li>`).join('')}</ul>
    <p class="unter" style="margin-top:12px">Das Bild entsteht auf deinem Gerät. Es verlässt das Gerät erst, wenn du es teilst.</p>`}`;
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
  const speichern = () => { herunterladen(RB.dateiName(R, name()), blob, 'image/png'); toast(geraet() === 'pc' ? 'Das Bild liegt bei deinen Downloads.' : 'Bild gespeichert.'); };
  app.querySelector('#rb-speichern').onclick = () => { if (blob) speichern(); };
  const teilen = app.querySelector('#rb-teilen');
  if (teilen) teilen.onclick = async () => {
    if (!blob) return;
    try { await navigator.share({ files: [new File([blob], RB.dateiName(R, name()), { type: 'image/png' })], title: 'Itqān · Rückblick' }); }
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
const dauerText = sek => sek == null ? '·' : sek < 60 ? `${Math.round(sek)} s` : sek < 3600 ? `${Math.floor(sek / 60)}:${String(Math.floor(sek % 60)).padStart(2, '0')} min` : `${Math.floor(sek / 3600)}:${String(Math.floor(sek % 3600 / 60)).padStart(2, '0')} h`;
function auswertungSeite() {
  navSetzen('profil');
  const a = Z.auswertung(30);
  const zeile = (name, wert, max, rechts, klasse = '') => `<div class="aw-zeile ${klasse}"><span>${name}</span><div class="aw-balken"><i style="width:${max ? (100 * wert / max).toFixed(1) : 0}%"></i></div><b>${rechts}</b></div>`;
  const maxArt = Math.max(1, ...a.arten.map(x => x.n), a.ohneArt);
  const mitArt = a.arten.reduce((s, x) => s + x.n, 0);
  const schwach = a.suren.filter(x => x.sicher < x.ayat).slice(0, 10);
  const wo = a.wochen;
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#profil'">${zurueckPfeil}Profil</button>
    <div class="marke">Auswertung<small>Wo du sicher bist und wo es noch hakt. Gezählt wird jeweils der letzte Durchgang eines Abschnitts.</small></div>
    <div class="titel-klein">Quote</div>
    <div class="zahlen"><div class="zahl"><b>${a.quoteGeprueft == null ? '·' : Math.floor(a.quoteGeprueft) + ' %'}</b><span>der geprüften Āyāt sicher</span></div>
      <div class="zahl"><b>${zahl(a.geprueft)}</b><span>Āyāt geprüft</span></div>
      <div class="zahl"><b>${Math.floor(a.quote)} %</b><span>des ganzen Bereichs sicher</span></div></div>
    <div class="diagramm aw-wochen">${wo.map(w => `<div class="${w.quote == null ? 'leer' : ''}" style="height:${w.quote == null ? 3 : Math.max(4, (w.quote - 50) * 2)}%" title="Woche bis ${w.bis}: ${w.quote == null ? 'nicht geübt' : Math.round(w.quote) + ' % sicher'}"></div>`).join('')}</div>
    <div class="klein-zeile"><span>vor 8 Wochen</span><span>diese Woche</span></div>
    <p class="unter" style="margin-top:6px">Anteil der Āyāt ohne Fehler und ohne Hilfe je Woche, von 50 bis 100 %.${(() => { const z = wo.filter(w => w.quote != null); return z.length ? ` Diese Woche: <b>${z.at(-1) === wo.at(-1) ? Math.floor(wo.at(-1).quote) + ' %' : 'noch nicht geübt'}</b>.` : ''; })()}</p>
    <div class="titel-klein">Fehlerarten</div>
    ${mitArt + a.ohneArt ? `<div class="aw-liste">${a.arten.map(x => zeile(x.name, x.n, maxArt, x.n)).join('')}${a.ohneArt ? zeile('ohne Angabe', a.ohneArt, maxArt, a.ohneArt, 'leise') : ''}</div>
      <p class="unter" style="margin-top:8px">Gezählt wird jede Āya, bei der du nach „Fehler“ eine Art gewählt hast. ${(() => { const top = [...a.arten].sort((x, y) => y.n - x.n)[0]; return top.n ? `Am häufigsten: <b>${top.name}</b>. ${Z.FEHLERARTEN_TEXT[top.art]}` : ''; })()}</p>`
      : '<p class="leer">Noch keine Fehler gezählt. Wähle nach „Fehler“ die Art, dann siehst du hier, was dir am häufigsten passiert.</p>'}
    <div class="titel-klein">Sūren mit Fehlern</div>
    ${schwach.length ? `<div class="aw-liste">${schwach.map(x => zeile(`${x.s}. ${esc(sureName(x.s))}`, x.quote, 100, `${x.sicher}/${x.ayat}`)).join('')}</div>
      <p class="unter" style="margin-top:8px">Sichere Āyāt von allen geprüften der Sūra, die schwächste zuerst.</p>`
      : `<p class="leer">${a.geprueft ? 'Im letzten Durchgang war jede geprüfte Sūra fehlerfrei. Allāhumma bārik.' : 'Nach den ersten Abschnitten siehst du hier, welche Sūren noch Fehler haben.'}</p>`}
    <div class="titel-klein">Zeit · letzte 30 Tage</div>
    ${a.zeit.abschnitte ? `<div class="zahlen"><div class="zahl"><b>${dauerText(a.zeit.jeAbschnitt)}</b><span>je Abschnitt</span></div><div class="zahl"><b>${dauerText(a.zeit.jeAya)}</b><span>je Āya</span></div><div class="zahl"><b>${dauerText(a.zeit.summe)}</b><span>insgesamt</span></div></div>
      ${a.zeit.langsam.length ? `<p class="unter" style="margin:14px 0 8px">Am längsten gebraucht, gemessen an der Länge:</p>${a.zeit.langsam.map(x => `<a class="karte" href="#ueben/${x.id}/frei" style="text-decoration:none;color:inherit"><div class="t"><b>${esc(D.A[x.id].titel)}</b><span>${abschnittMarke(D.A[x.id])} · ${D.A[x.id].zeilen} Zeilen · ${dauerText(x.z)}</span></div><span class="pfeil">›</span></a>`).join('')}` : ''}
      <p class="unter" style="margin-top:8px">Gemessen wird nur, solange die Übung auf dem Bildschirm ist.</p>`
      : '<p class="leer">Seit Version 1.6 misst Itqān beim Üben die Zeit. Nach den ersten Abschnitten stehen hier deine Werte.</p>'}`;
}

// ---------- Suche ohne Vokale ----------
const lupe = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>';
const ARABISCH = 'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي ء ة ى'.split(' ');
const stelleText = vi => `${sureName(D.V[vi][0])} ${D.V[vi][0]}:${D.V[vi][1]}`;
const seiteVon = vi => D.W.get(vi + '.0')?.[0] || D.V[vi][3];
const abschnittVon = vi => D.A.find(e => vi >= e.v[0] && vi <= e.v[1]);
// Āya in Uthmani-Schrift, markierte Wörter hervorgehoben oder verdeckt
function ayaText(t, vi, { mark = new Set(), zu = new Set(), klasse = 'treffer-wort' } = {}) {
  return `<span class="uthmani">${t.u[vi].map((w, i) => zu.has(i) ? `<span class="wort-zu" data-i="${i}">${esc(w)}</span>` : mark.has(i) ? `<mark class="${klasse}">${esc(w)}</mark>` : esc(w)).join(' ')} <span class="aya-nr">${D.V[vi][1].toLocaleString('ar-EG')}</span></span>`;
}
async function sucheSeite(qText = '') {
  navSetzen('mushaf');
  const start = decodeURIComponent(qText || '');
  app.innerHTML = `<button class="zurueck" onclick="history.length > 1 ? history.back() : (location.hash = '#mushaf')">${zurueckPfeil}Muṣḥaf</button>
    <div class="marke">Suche<small>Im ganzen Qurʾān, ohne Vokale. Eine Stelle wie 2:255 springt direkt zur Āya.</small></div>
    <div class="suchfeld"><input id="q" type="search" dir="rtl" lang="ar" autocomplete="off" spellcheck="false" placeholder="مثلا: الحي القيوم" value="${esc(start)}" aria-label="Suchbegriff">
      <button class="seitenlage" id="tast" aria-label="Arabische Buchstaben einblenden" aria-expanded="false">ا ب</button></div>
    <div class="tastatur verdeckt" id="tastatur" dir="rtl">${ARABISCH.map(b => `<button data-b="${b}">${b}</button>`).join('')}<button data-b=" " class="breit">Leerzeichen</button><button data-b="⌫" aria-label="Löschen">⌫</button></div>
    <p class="unter such-stand" id="stand"></p><div id="treffer"></div>
    <p class="quelle">Text: quran.com, Uthmani und gewöhnliche Schreibweise. Gesucht wird ohne Vokale. Hamza- und Alif-Formen, Alif maqṣūra und Tāʾ marbūṭa werden dabei vereinheitlicht.</p>`;
  const q = app.querySelector('#q'), stand = app.querySelector('#stand'), liste = app.querySelector('#treffer'), tast = app.querySelector('#tastatur');
  let t = null;
  try { stand.textContent = 'Text wird geladen …'; t = await S.textLaden(); stand.textContent = ''; }
  catch (e) { stand.textContent = 'Der Text ließ sich nicht laden. Bitte einmal mit Internet öffnen.'; return; }
  let gezeigt = 0, ergebnis = null, lauf = 0;
  const karte = x => { const e = abschnittVon(x.vi); return `<a class="treffer" href="#mushaf/${seiteVon(x.vi)}${e ? '/' + e.id : ''}"><span class="treffer-ort">${stelleText(x.vi)} · S. ${seiteVon(x.vi)}</span>${ayaText(t, x.vi, { mark: x.woerter })}</a>`; };
  const mehr = () => {
    const neu = ergebnis.liste.slice(gezeigt, gezeigt + 40); gezeigt += neu.length;
    liste.querySelector('#mehr-treffer')?.remove();
    liste.insertAdjacentHTML('beforeend', neu.map(karte).join('') + (gezeigt < ergebnis.liste.length ? `<button class="knopf leise" id="mehr-treffer" style="margin-top:12px">Weitere ${Math.min(40, ergebnis.liste.length - gezeigt)} zeigen</button>` : ''));
    const m = liste.querySelector('#mehr-treffer'); if (m) m.onclick = mehr;
  };
  const suchen = async () => {
    const nr = ++lauf, text = q.value;
    history.replaceState(null, '', '#suche' + (text.trim() ? '/' + encodeURIComponent(text.trim()) : ''));
    if (!text.trim()) { stand.textContent = ''; liste.innerHTML = ''; return; }
    const r = await S.suchen(text); if (nr !== lauf) return;
    ergebnis = r; gezeigt = 0; liste.innerHTML = '';
    if (r.zuKurz) { stand.textContent = 'Mindestens zwei Buchstaben.'; return; }
    if (r.stelle != null) { stand.innerHTML = 'Stelle gefunden.'; mehr(); return; }
    stand.innerHTML = r.liste.length ? `<b>${zahl(r.anzahl)} ${r.anzahl === 1 ? 'Fundstelle' : 'Fundstellen'}</b> in ${zahl(r.liste.length)} ${r.liste.length === 1 ? 'Āya' : 'Āyāt'}` : 'Keine Treffer. Prüfe die Schreibweise oder suche nach weniger Wörtern.';
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
  app.innerHTML = '<div class="lade">Ähnliche Stellen werden geladen …</div>';
  let A, t;
  try { [A, t] = await Promise.all([NL.laden(), S.textLaden()]); } catch (e) { app.innerHTML = '<p class="leer">Die Liste ließ sich nicht laden. Bitte einmal mit Internet öffnen.</p>'; return; }
  const P = Z.P;
  // Āyāt mit „Verwechslung“ bei den Fehlerstellen: ihre Gruppen stehen oben
  const verw = new Set(Object.entries(P.fstellen || {}).filter(([, f]) => f.t?.verwechslung).map(([k]) => +k.split('.')[0]));
  const imB = vi => Z.imBereich(vonAbschnitt(vi));
  let a = NL.anfrage();
  const tr = vi => a.aktiv && NL.trifft(vi, a, t);

  // ----- Bausteine -----
  const text = (vi, klasse, nr = true) => `<div class="vk-text" dir="rtl"><span class="uthmani">${t.u[vi].map((w, j) => { const c = klasse(j); return c ? `<mark class="${c}">${esc(w)}</mark>` : esc(w); }).join(' ')}${nr ? ` <span class="aya-nr">${D.V[vi][1].toLocaleString('ar-EG')}</span>` : ''}</span></div>`;
  const danach = vi => { const d = NL.danach(t, vi); return `<span>danach</span>${d ? `<span class="ah-ar" lang="ar" dir="rtl">${esc(d)}</span>` : '<i>Ende der Sūra</i>'}`; };
  const kopf = vi => `<div class="vk-kopf${tr(vi) ? ' ah-treffer' : ''}"><b>${esc(sureName(D.V[vi][0]))}</b> ${NL.stelleKurz(vi)}<a href="${mushafOrt(vi)}">S. ${seiteVon(vi)}</a></div>`;
  const stellenKurz = s => { const l = [...s].sort((x, y) => x - y); return l.length <= 3 ? l.map(NL.stelleKurz).join(' · ') : `${NL.stelleKurz(l[0])} · ${NL.stelleKurz(l[1])} und ${l.length - 2} weitere`; };
  const verweisF = k => `<a class="ah-verweis" href="#aehnlich/f/${k}">${stellenKurz(A.FK[k].s)}</a>`;
  const verweisT = k => `<a class="ah-verweis" href="#aehnlich/t/${k}"><bdi class="ah-ar" lang="ar">${esc(A.TK[k].ta)}</bdi> ⇄ <bdi class="ah-ar" lang="ar">${esc(A.TK[k].tb)}</bdi></a>`;
  const variante = (v, art) => {
    const d = new Set(v.d), n = v.g.length, vi = v.g[0], mark = j => art !== 'gleich' && d.has(j) ? 'anders' : '';
    if (n === 1) return `<div class="ah-stelle">${kopf(vi)}${text(vi, mark)}<div class="ah-danach">${danach(vi)}</div></div>`;
    return `<div class="ah-stelle"><div class="vk-kopf"><b>${n} Stellen</b> mit diesem Wortlaut</div>${text(vi, mark, false)}
      <ul class="ah-orte${n > 7 ? ' zu' : ''}">${v.g.map(x => `<li${tr(x) ? ' class="ah-treffer"' : ''}><a href="${mushafOrt(x)}">${NL.stelleKurz(x)}</a><span class="sn">${esc(sureName(D.V[x][0]))}</span>${danach(x)}</li>`).join('')}</ul>
      ${n > 7 ? `<button class="ah-mehr" data-auf>alle ${n} Stellen zeigen</button>` : ''}</div>`;
  };
  const familie = f => {
    const n = f.s.length, w = f.v.length, z = [];
    if (f.vor) z.push(`<div><span>Davor steht meist die Gruppe</span>${f.vor.map(([k]) => verweisF(k)).join('')}</div>`);
    if (f.nach) z.push(`<div><span>Darauf folgt meist die Gruppe</span>${f.nach.map(([k]) => verweisF(k)).join('')}</div>`);
    if (f.auch) z.push(`<div><span>Eine Stelle steht auch in der Gruppe</span>${f.auch.map(verweisF).join('')}</div>`);
    if (f.verw) z.push(`<div><span>Verwandte Gruppe</span>${f.verw.map(verweisF).join('')}</div>`);
    if (f.t) z.push(`<div><span>Als Reihenfolge-Fall</span>${f.t.filter(k => A.TK[k]).map(verweisT).join('')}</div>`);
    if (f.paare.length) z.push(`<div><span>Unterscheiden üben</span>${f.paare.map(p => { const st = P.mutash?.[p.key]; return `<a class="ah-verweis ueben" href="#vergleich/${p.key}/ueben">${NL.stelleKurz(p.a)} und ${NL.stelleKurz(p.b)}${st ? `<small>${st.ok}/${st.n}</small>` : ''}</a>`; }).join('')}</div>`);
    return `<article class="ah-karte" id="${f.k}">
      <div class="ah-kopf"><span class="ah-art ${f.art}">${NL.ART[f.art]}</span><span class="ah-nr">${n} Stellen${w > 1 ? `, ${w} Wortlaute` : ''}</span>${f.s.some(vi => verw.has(vi)) ? '<span class="marke-art fehler">Verwechslung</span>' : ''}</div>
      ${f.was.length ? `<div class="ah-marken">${f.was.map(x => `<span>${mitAr(NL.WAS[x])}</span>`).join('')}</div>` : ''}
      <p class="ah-merk">${NL.merksatz(f)}</p>
      ${f.v.map(x => variante(x, f.art)).join('')}
      ${z.length ? `<div class="ah-verweise">${z.join('')}</div>` : ''}</article>`;
  };
  const chips = (x, seite) => {
    const l = x[seite], zu = l.length > 14;
    return `<div class="ah-chips${zu ? ' zu' : ''}">${l.map((o, i) => `<button class="ah-chip${tr(o[0]) ? ' ah-treffer' : ''}" data-k="${x.k}" data-o="${seite}${i}" title="${esc(sureName(D.V[o[0]][0]))}" aria-pressed="false">${NL.stelleKurz(o[0])}</button>`).join('')}${zu ? `<button class="ah-mehr" data-auf>alle ${l.length} zeigen</button>` : ''}</div>`;
  };
  const fall = x => {
    const na = x.ab.length, nb = x.ba.length, { satz, regel } = NL.fallSatz(x);
    return `<div class="ah-fall" id="${x.k}">
      <div class="ah-gegen"><div class="ah-folge eins"><div class="uthmani" lang="ar">${esc(x.ta)}</div><div class="anz"><b>${na}</b> ${na === 1 ? 'Stelle' : 'Stellen'}${regel ? ' · die Regel' : ''}</div></div>
        <div class="ah-tausch" aria-hidden="true">⇄</div>
        <div class="ah-folge zwei"><div class="uthmani" lang="ar">${esc(x.tb)}</div><div class="anz"><b>${nb}</b> ${nb === 1 ? 'Stelle' : 'Stellen'}${regel ? (nb === 1 ? ' · die Ausnahme' : ' · die Ausnahmen') : ''}</div></div></div>
      <div class="ah-balken" aria-hidden="true"><i style="width:${(100 * na / (na + nb)).toFixed(1)}%"></i><i></i></div>
      <p class="ah-merk">${esc(satz)}</p>
      <div class="ah-spalten"><div class="eins">${chips(x, 'ab')}</div><div class="zwei">${chips(x, 'ba')}</div></div>
      <div class="ah-ayat"></div>
      ${x.f.some(k => A.FK[k]) ? `<div class="ah-verweise"><div><span>Als Gruppe ähnlicher Verse</span>${x.f.filter(k => A.FK[k]).map(verweisF).join('')}</div></div>` : ''}</div>`;
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
    app.innerHTML = `<button class="zurueck" onclick="history.length > 1 ? history.back() : (location.hash = '#aehnlich')">${zurueckPfeil}Zurück</button>
      <div class="marke">${f ? 'Ähnliche Verse' : 'Reihenfolge'}<small>${f ? 'Eine Gruppe ähnlicher Verse. Markiert ist, was ein Wortlaut anders hat als die übrigen.' : `${mitAr(th.thema)}. Tippe auf eine Stelle, um die Āya zu lesen.`}</small></div>
      <div id="ah" class="ah-stapel">${f ? familie(f) : fallKarte(gr, [x])}</div>
      <a class="knopf leise" href="#aehnlich/${teil}" style="text-decoration:none;margin-top:16px">Alle ${f ? 'Gruppen' : 'Reihenfolge-Fälle'} zeigen</a>`;
    app.querySelector('#ah').onclick = ev => { const b = ev.target.closest('button'); if (b) kartenKlick(b); };
    return;
  }

  // ----- Nachschlagen: Suche, zwei Bereiche -----
  if (teil === 'f' || teil === 't') NA.tab = teil;
  const begrenzt = !!P.einst.bereich;
  const wahlen = (feld, l) => `<select data-feld="${feld}" aria-label="${esc(l[0][1])}">${l.map(([w, n]) => `<option value="${w}"${String(NA[feld]) === String(w) ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#profil'">${zurueckPfeil}Profil</button>
    <div class="marke">Ähnliche Stellen<small>Mutašābihāt zum Nachschlagen: ${A.f.length} Gruppen ähnlicher Verse mit ${A.stellen} Stellen und ${A.faelle.length} Fälle, in denen dieselben Wörter in anderer Reihenfolge stehen.</small></div>
    <div class="suchfeld"><input id="q" class="ah-q" type="search" dir="auto" autocomplete="off" spellcheck="false" placeholder="2:48, Sūra oder Wörter" value="${esc(NA.q)}" aria-label="Stelle, Sūra oder arabische Wörter">
      <button class="seitenlage" id="tast" aria-label="Arabische Buchstaben einblenden" aria-expanded="false">ا ب</button></div>
    <div class="tastatur verdeckt" id="tastatur" dir="rtl">${ARABISCH.map(b => `<button data-b="${b}">${b}</button>`).join('')}<button data-b=" " class="breit">Leerzeichen</button><button data-b="⌫" aria-label="Löschen">⌫</button></div>
    <div class="ah-zeile">${wahlen('sure', [[0, 'Alle Sūren'], ...A.suren.map(([s, n]) => [s, `${s} · ${sureName(s)} (${n})`])])}
      ${begrenzt ? `<div class="wahl" id="abereich"><button data-w="mein">Dein Bereich</button><button data-w="alle">Alle</button></div>` : ''}</div>
    <div class="ah-reiter" role="tablist"><button role="tab" data-tab="f">Ähnliche Verse<small id="anz-f"></small></button><button role="tab" data-tab="t">Reihenfolge<small id="anz-t"></small></button></div>
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
    const wonach = a.vi != null ? (a.vi >= 0 ? NL.stelleKurz(a.vi) : 'dieser Stelle') : a.text ? 'diesen Wörtern' : 'dieser Auswahl';
    // außerhalb des eigenen Bereichs gäbe es Treffer: darauf hinweisen
    const draussen = n => nur && n ? ` Außerhalb deines Bereichs: ${n}. <button class="ah-verweis" data-alle>Alle zeigen</button>` : '';
    if (NA.tab === 'f') {
      const st = new Set(fl.flatMap(e => e.f.s)).size, rest = fl.length - NA.zahl, oben = fl.filter(e => e.oben).length;
      const gefiltert = NA.art || NA.was || NA.wo || NA.gr;
      feld.innerHTML = `<div class="wahl vier" id="f-art">${[['', 'Alle'], ...Object.entries(NL.ART)].map(([w, n]) => `<button data-w="${w}"${NA.art === w ? ' class="an"' : ''}>${n}</button>`).join('')}</div>
        <details class="ah-filter"${NA.filterAuf ? ' open' : ''}><summary>Weitere Filter${NA.was || NA.wo || NA.gr || NA.sort !== 'mushaf' ? ' · aktiv' : ''}</summary><div class="ah-wahlen">
          ${wahlen('was', [['', 'Jeder Unterschied'], ...Object.entries(NL.WAS).map(([k, n]) => [k, `${n} (${A.f.filter(f => f.was.includes(k)).length})`])])}
          ${wahlen('wo', [['', 'An jeder Stelle der Āya'], ...Object.entries(NL.WO).map(([k, n]) => [k, 'Unterschied ' + n])])}
          ${wahlen('gr', [['', 'Jede Größe'], ['2', 'Paare'], ['3', '3 bis 5 Stellen'], ['6', '6 und mehr Stellen']])}
          ${wahlen('sort', [['mushaf', 'Reihenfolge des Muṣḥaf'], ['gross', 'Größte Gruppen zuerst']])}</div></details>
        <p class="unter ah-klein"><mark class="ah-probe anders">Unterlegt</mark> ist, was ein Wortlaut anders hat als die übrigen seiner Gruppe. Unter jeder Stelle steht, wie die folgende Āya beginnt, denn dort entscheidet sich, ob du richtig weiterliest.</p>
        ${fl.length ? `<p class="unter ah-klein" aria-live="polite"><b>${fl.length} ${fl.length === 1 ? 'Gruppe' : 'Gruppen'}</b> mit ${st} Stellen.${oben ? ' Gruppen mit einer Stelle, die du als Verwechslung markiert hast, stehen oben.' : ''}</p>
          <div class="ah-stapel">${fl.slice(0, NA.zahl).map(e => familie(e.f)).join('')}</div>
          ${rest > 0 ? `<button class="knopf leise" id="f-mehr" style="margin-top:14px">Weitere ${Math.min(NA_SEITE, rest)} zeigen (noch ${rest})</button>` : ''}`
        : `<p class="leer" style="margin-top:16px" aria-live="polite">${gefiltert ? 'Mit diesen Filtern' : `Zu ${esc(wonach)}`} ist${nur ? ' in deinem Bereich' : ''} keine Gruppe ähnlicher Verse verzeichnet.${draussen(NL.familienListe(A, t, a, { art: NA.art, was: NA.was, wo: NA.wo, gr: NA.gr }).length)}${tz ? ` Im Bereich Reihenfolge gibt es dazu ${tz} ${tz === 1 ? 'Fall' : 'Fälle'}. <button class="ah-verweis" data-tab="t">Zeigen</button>` : ''}</p>`}`;
    } else {
      const drin = new Set(tl.map(x => x.k)), teile = [], nav = [];
      A.t.forEach((th, ti) => {
        const karten = th.gruppen.map(gr => { const l = gr.faelle.filter(x => drin.has(x.k)); return l.length ? fallKarte(gr, l) : ''; }).filter(Boolean);
        if (!karten.length) return;
        const n = th.gruppen.reduce((s, gr) => s + gr.faelle.filter(x => drin.has(x.k)).length, 0);
        nav.push(`<button class="ah-verweis" data-thema="${ti}">${mitAr(th.thema)}<small>${n}</small></button>`);
        teile.push(`<section class="ah-thema" id="thema-${ti}"><div><h2>${mitAr(th.thema)}</h2><p class="unter ah-klein">${mitAr(th.hinweis)}</p></div>${karten.join('')}</section>`);
      });
      feld.innerHTML = `<p class="unter ah-klein">Dieselben Wörter in zwei Reihenfolgen. Links steht die häufigere, rechts die seltenere. Tippe auf eine Stelle, um die Āya zu lesen. <mark class="ah-probe kern">Umrandet</mark> sind die Wörter, die den Platz tauschen.</p>
        ${teile.length ? `<div class="ah-themen">${nav.join('')}</div>${a.aktiv ? `<p class="unter ah-klein" aria-live="polite"><b>${tz} ${tz === 1 ? 'Fall' : 'Fälle'}</b> zu ${esc(wonach)}.</p>` : ''}${teile.join('')}`
        : `<p class="leer" style="margin-top:16px" aria-live="polite">Zu ${esc(wonach)} ist${nur ? ' in deinem Bereich' : ''} kein Reihenfolge-Fall verzeichnet.${draussen(NL.faelleListe(A, t, a).length)}${fz ? ` Im Bereich Ähnliche Verse gibt es dazu ${fz} ${fz === 1 ? 'Gruppe' : 'Gruppen'}. <button class="ah-verweis" data-tab="f">Zeigen</button>` : ''}</p>`}`;
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
  app.innerHTML = '<div class="lade">Wird geladen …</div>';
  let x, t;
  try { [x, t] = await Promise.all([S.paar(key), S.textLaden()]); } catch (e) { app.innerHTML = '<p class="leer">Die Stellen ließen sich nicht laden. Bitte einmal mit Internet öffnen.</p>'; return; }
  if (!x) { location.replace('#aehnlich'); return; }
  const ueben = modus === 'ueben';
  let offen = !ueben;
  const stelleKarte = (vi, ab) => `<div class="vergleich-karte"><div class="vk-kopf"><b>${esc(sureName(D.V[vi][0]))}</b> ${D.V[vi][0]}:${D.V[vi][1]}<a href="#mushaf/${seiteVon(vi)}${abschnittVon(vi) ? '/' + abschnittVon(vi).id : ''}">S. ${seiteVon(vi)}</a></div>
    <div class="vk-text" dir="rtl">${ayaText(t, vi, offen ? { mark: new Set(ab), klasse: 'anders' } : { zu: new Set(ab) })}</div></div>`;
  const st = Z.P.mutash?.[key];
  const zeichnen = () => {
    app.innerHTML = `<button class="zurueck" onclick="location.hash='#aehnlich'">${zurueckPfeil}Ähnliche Stellen</button>
      <div class="marke">${ueben ? 'Unterscheiden' : 'Vergleich'}<small>${ueben ? (offen ? 'Hast du beide Stellen richtig unterschieden?' : 'Rezitiere beide Stellen. Verdeckt sind genau die Wörter, in denen sie sich unterscheiden.') : `${x.s} % gleich. Markiert sind die Wörter, in denen sich die beiden Āyāt unterscheiden.`}</small></div>
      ${stelleKarte(x.a, x.da)}${stelleKarte(x.b, x.db)}
      ${st ? `<p class="unter" style="margin-top:6px">Bisher ${st.ok} von ${st.n} Mal richtig unterschieden.</p>` : ''}
      <div class="reihe" style="margin-top:14px" id="vk-knoepfe">${!ueben ? '<a class="knopf haupt" href="#vergleich/' + key + '/ueben" style="text-decoration:none">Unterscheiden üben</a>'
        : !offen ? '<button class="knopf haupt" id="vk-auf">Aufdecken</button>'
        : '<button class="knopf schlecht" id="vk-f">Verwechselt</button><button class="knopf gut" id="vk-r">Beide richtig</button>'}</div>`;
    const auf = app.querySelector('#vk-auf'); if (auf) auf.onclick = () => { offen = true; zeichnen(); };
    const bew = ok => { Z.unterscheidenMerken(key, ok); toast(ok ? 'Gut unterschieden.' : 'Gemerkt. Vergleiche die markierten Wörter noch einmal in Ruhe.'); naechstes(); };
    const r = app.querySelector('#vk-r'); if (r) r.onclick = () => bew(true);
    const f = app.querySelector('#vk-f'); if (f) f.onclick = () => bew(false);
  };
  // nach der Bewertung: zurück zum Vergleich mit dem Ergebnis und dem Weg zum nächsten Paar im eigenen Bereich
  const naechstes = async () => {
    const paare = await S.paareLaden(), mein = y => Z.imBereich(vonAbschnitt(y.a)) || Z.imBereich(vonAbschnitt(y.b));
    const l = paare.filter(mein), i = l.findIndex(y => y.key === key), n = l[(i + 1) % l.length];
    app.querySelector('#vk-knoepfe').innerHTML = `<a class="knopf leise" href="#vergleich/${key}" style="text-decoration:none">Noch einmal ansehen</a>${n && n.key !== key ? `<a class="knopf haupt" href="#vergleich/${n.key}/ueben" style="text-decoration:none">Nächstes Paar</a>` : ''}`;
  };
  zeichnen();
}

// ---------- Fehlerstellen ----------
function fehlerstellenSeite() {
  navSetzen('profil');
  const fl = Z.fehlerstellenListe(500);
  for (const f of fl) for (const d of [-1, 0, 1]) { const w = D.W.get(f.vi + '.' + (f.i + d)); if (w) schrift(w[3]); }
  const wortHTML = k => { const w = D.W.get(k); return w ? `<span style="font-family:qp${w[3]}">${glyphen(w[1], w[2])}</span>` : ''; };
  const abschnittVon = vi => D.A.find(e => vi >= e.v[0] && vi <= e.v[1]);
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#profil'">${zurueckPfeil}Profil</button>
    <div class="marke">Fehlerstellen<small>Die Wörter, bei denen du dich vertan hast. Übe eine Stelle dreimal in Folge richtig, dann verschwindet sie von selbst.</small></div>
    <div style="margin-top:16px">${fl.length ? fl.map(f => {
      const w = D.W.get(f.s); if (!w) return '';
      const arten = Object.entries(f.t).sort((a, b) => b[1] - a[1]).map(([x]) => Z.FEHLERARTEN.find(y => y[0] === x)?.[1]).filter(Boolean).join(', ');
      const ab = abschnittVon(f.vi), gut = f.gut || 0;
      return `<div class="fs-karte" data-vi="${f.vi}"><a class="wortbild" href="#mushaf/${w[0]}" aria-label="Im Muṣḥaf zeigen"><span class="nb">${wortHTML(f.vi + '.' + (f.i - 1))}</span>${wortHTML(f.s)}<span class="nb">${wortHTML(f.vi + '.' + (f.i + 1))}</span></a>
        <div class="fs-unten"><div class="t"><b>${sureName(D.V[f.vi][0])} ${D.V[f.vi][0]}:${D.V[f.vi][1]}</b><span>${f.n}× vertan${arten ? ' · ' + arten : ''}</span>
          <span class="fs-fort" title="richtig in Folge">${Array.from({ length: Z.STELLE_ZIEL }, (_, k) => `<i class="${k < gut ? 'an' : ''}"></i>`).join('')}</span></div>
          ${ab ? `<a class="knopf haupt klein" href="#ueben/${ab.id}/stelle/${f.vi}" style="width:auto;text-decoration:none">Üben</a>` : ''}</div></div>`;
    }).join('') : '<p class="leer">Wenn du nach „Fehler“ auf das Wort tippst, bei dem du dich vertan hast, sammelt Itqān diese Stellen hier.</p>'}</div>`;
  // ähnliche Stellen nachtragen, sobald die Liste geladen ist
  // Paar: zum Vergleich. Größere Gruppe, wortgleiche Stelle oder Reihenfolge-Fall: zum Nachschlagen
  Promise.all([NL.laden(), S.paareLaden()]).then(([A, paare]) => app.querySelectorAll('.fs-karte[data-vi]').forEach(k => {
    const vi = +k.dataset.vi, bei = A.vonVi.get(vi), f = bei?.f.length ? A.FK[bei.f[0]] : null, p = paare.find(x => x.a === vi || x.b === vi);
    const zeile = (ziel, text) => k.querySelector('.t')?.insertAdjacentHTML('beforeend', `<a class="fs-aehnlich" href="${ziel}">${text}</a>`);
    if (f && f.s.length > 2) zeile(`#aehnlich/f/${f.k}`, `Eine von ${f.s.length} ähnlichen Stellen · nachschlagen`);
    else if (p) { const ander = p.a === vi ? p.b : p.a; zeile(`#vergleich/${p.key}`, `Ähnlich wie ${NL.stelleKurz(ander)} · vergleichen`); }
    else if (f) { const ander = f.s.find(x => x !== vi); zeile(`#aehnlich/f/${f.k}`, `${f.art === 'gleich' ? 'Gleicher Wortlaut wie' : 'Ähnlich wie'} ${NL.stelleKurz(ander)} · nachschlagen`); }
    if (bei?.t.length) zeile(`#aehnlich/t/${bei.t[0]}`, 'Wörter in anderer Reihenfolge an anderer Stelle · nachschlagen');
  })).catch(() => {});
}

// ---------- Einstellungen ----------
const TAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const SCHWACH_TEXT = {
  khatma: 'Nur die Wiederholung nach Fehlern (nach 1, 3 und 7 Tagen). Die Ḫatma geht am schnellsten.',
  ausgewogen: 'Schwache Abschnitte kommen zwischen zwei Runden ab und zu zusätzlich dran. Die Ḫatma dauert etwa 3 % länger.',
  schwaechen: 'Schwache Abschnitte kommen etwa doppelt so oft dran. Die Ḫatma dauert etwa 7 % länger.'
};
// Pause: bis zu 30 Tage ohne Wird
function pauseHTML() {
  const p = Z.pauseJetzt(), kuenftig = (Z.P.pausen || []).find(x => x.von > Z.heute());
  if (p || kuenftig) { const x = p || kuenftig; return `<p class="unter">${p ? 'Deine Pause läuft' : `Deine Pause beginnt am ${tagLang(x.von)} und läuft`} bis <b>${tagLang(x.bis)}</b>. Die Kette wartet, Fehlerwiederholungen verschieben sich mit.</p><button class="knopf leise" id="pause-ende" style="margin-top:10px">Pause beenden</button>`; }
  return `<p class="unter">Für Reisen, Krankheit oder volle Wochen: bis zu ${Z.PAUSE_MAX} Tage ohne Wird. Die Kette wartet und läuft danach weiter, Fehlerwiederholungen verschieben sich mit.</p>
    <label class="auswahl" style="margin-top:10px"><span>Dauer</span><select id="pause-tage">${optionen([3, 7, 10, 14, 21, 30], 7, x => `${x} Tage`)}</select></label>
    <button class="knopf leise" id="pause-los" style="margin-top:10px">Pause beginnen</button>`;
}
function pauseBinden() {
  const los = app.querySelector('#pause-los'), ende = app.querySelector('#pause-ende');
  if (los) los.onclick = async () => {
    const n = +app.querySelector('#pause-tage').value, t = Z.P.tage[Z.heute()];
    const ab = t && !t.ruhe && t.fertig.length ? Z.plusTage(Z.heute(), 1) : Z.heute();
    if (!await dialog({ titel: 'Pause beginnen?', html: `<p>${n} Tage ohne Wird, ${ab === Z.heute() ? 'ab heute' : 'ab morgen'} bis ${tagLang(Z.plusTage(ab, n - 1))}. Du kannst sie jederzeit früher beenden.</p>`, ja: 'Pause beginnen' })) return;
    Z.pauseBeginnen(n); toast('Pause eingetragen.'); einstellungen();
  };
  if (ende) ende.onclick = () => { Z.pauseBeenden(); toast('Die Pause ist beendet.'); einstellungen(); };
}
const optionen = (werte, wahl, text = x => x) => werte.map(x => `<option value="${x}"${x === wahl ? ' selected' : ''}>${text(x)}</option>`).join('');
function einstellungen() {
  navSetzen('profil');
  const P = Z.P, E = P.einst;
  const juzAn = new Set(E.bereich ? D.A.filter(e => E.bereich.includes(e.id)).map(e => e.juz) : Array.from({ length: 30 }, (_, i) => i + 1));
  const bis = n => Array.from({ length: Math.max(30, n) }, (_, i) => i + 1);
  const gleich = () => E.pensum.every(x => x === E.pensum[0]);
  const [hh, mm] = (E.erinnerung || '05:30').split(':').map(Number);
  const minuten = [...new Set([...Array.from({ length: 12 }, (_, i) => i * 5), mm])].sort((a, b) => a - b);
  const zwei = x => String(x).padStart(2, '0');
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#profil'">${zurueckPfeil}Profil</button>
    <div class="marke">Einstellungen</div>
    <div class="abschnitt"><h3>Name</h3><div class="feld"><input type="text" id="name" aria-label="Name" autocomplete="given-name" value="${esc(P.name)}"></div></div>
    <div class="abschnitt"><h3>Erscheinungsbild</h3><div class="wahl" id="thema">${[['hell', 'Hell'], ['dunkel', 'Dunkel'], ['auto', 'Wie Gerät']].map(([w, l]) => `<button data-w="${w}" class="${E.thema === w ? 'an' : ''}">${l}</button>`).join('')}</div></div>
    <div class="abschnitt" id="lesbarkeit"><h3>Lesbarkeit</h3><p class="unter">Seitengröße: so groß erscheint die Muṣḥaf-Seite beim Üben und im Muṣḥaf. Ist sie breiter als der Bildschirm, schiebst du sie mit dem Finger.</p>
      <div class="wahl" id="seitengroesse" role="group" aria-label="Seitengröße" style="margin-top:10px">${[100, 125, 150].map(w => `<button data-w="${w}" class="${(E.seitenGroesse || 100) === w ? 'an' : ''}">${w} %</button>`).join('')}</div>
      <p class="unter" style="margin-top:14px">Schriftgröße: Texte, Knöpfe und Überschriften der App.</p>
      <div class="wahl" id="textgroesse" role="group" aria-label="Schriftgröße" style="margin-top:10px">${[[100, 'Normal'], [112, 'Groß'], [125, 'Sehr groß']].map(([w, l]) => `<button data-w="${w}" class="${(E.textGroesse || 100) === w ? 'an' : ''}">${l}</button>`).join('')}</div>
      <p class="lesbar-probe">Mit zwei Fingern kannst du außerdem überall zoomen. Mehr dazu in der <a href="#hilfe/lesbar">Hilfe</a>.</p></div>
    <div class="abschnitt"><h3>Länge der Abschnitte</h3>${modusWahl(E.modus || 'fort')}</div>
    <div class="abschnitt"><h3>Druckausgabe des Muṣḥaf</h3>
      <div class="wahl" id="ausgabe" style="margin-top:10px">${[['v1', 'Druck 1405'], ['v2', 'Druck 1421']].map(([w, l]) => `<button data-w="${w}" class="${(E.ausgabe || 'v2') === w ? 'an' : ''}">${l}</button>`).join('')}</div>
      <p class="unter" style="margin-top:8px">Beide Madanī-Drucke mit ihren eigenen Seiten und Zeilen. Abschnitte, Fortschritt und Fehlerstellen gelten für beide.</p></div>
    <div class="abschnitt"><h3>Abschnitte pro Tag</h3><p class="unter">Für alle Tage gleich oder pro Wochentag. An einem Ruhetag gibt es keinen Wird, die Kette läuft darüber weiter.</p>
      <label class="auswahl stark"><span>Alle Tage</span><select id="alle">${gleich() ? '' : '<option value="" selected>verschieden</option>'}${optionen(bis(Math.max(...E.pensum)), gleich() ? E.pensum[0] : null)}</select></label>
      <div class="tagesliste">${TAGE.map((w, i) => `<label class="auswahl"><span>${w}</span><select data-i="${i}">${optionen([0, ...bis(E.pensum[i])], E.pensum[i], x => x ? x : 'Ruhetag')}</select></label>`).join('')}</div>
      <p class="unter" style="margin-top:10px" id="dauer">Eine Ḫatma dauert damit etwa<br><b class="dauer-zahl">${Z.tageProKhatma(true)} Tage</b></p></div>
    <div class="abschnitt"><h3>Schwache Abschnitte</h3><p class="unter">Abschnitte, in denen du dich zuletzt vertan hast, können zwischen zwei Runden zusätzlich drankommen. Sie stehen dann mit „Festigen“ im Tagesplan.</p>
      <div class="wahl" id="schwaechen" style="margin-top:10px">${[['khatma', 'Ḫatma zuerst'], ['ausgewogen', 'Ausgewogen'], ['schwaechen', 'Schwächen zuerst']].map(([w, l]) => `<button data-w="${w}" class="${(E.schwaechen || 'ausgewogen') === w ? 'an' : ''}">${l}</button>`).join('')}</div>
      <p class="unter" style="margin-top:8px" id="schwach-text">${SCHWACH_TEXT[E.schwaechen || 'ausgewogen']}</p></div>
    <div class="abschnitt"><h3>Pause</h3>${pauseHTML()}</div>
    <div class="abschnitt"><h3>Reihenfolge</h3><div class="wahl" id="reihenfolge">${[['vorwaerts', 'Ab al-Fātiḥah'], ['rueckwaerts', 'Ab an-Nās'], ['zufall', 'Zufällig']].map(([w, l]) => `<button data-w="${w}" class="${E.reihenfolge === w ? 'an' : ''}">${l}</button>`).join('')}</div>
      <div id="zufallwahl" class="${E.reihenfolge === 'zufall' ? '' : 'verdeckt'}" style="margin-top:12px"><p class="unter">Bei mehreren Abschnitten am Tag:</p>
        <div class="wahl" id="zufall" style="margin-top:8px">${[['einzeln', 'Verstreute Stellen'], ['block', 'Eine Stelle am Stück']].map(([w, l]) => `<button data-w="${w}" class="${E.zufall === w ? 'an' : ''}">${l}</button>`).join('')}</div>
        <p class="unter" style="margin-top:8px">Jede Ḫatma bleibt vollständig: Zufällig gewählt wird nur unter den Abschnitten, die in dieser Runde noch offen sind. Zu Beginn siehst du die Āya davor.</p></div></div>
    <div class="abschnitt"><h3>Was du wiederholst</h3><div class="juzwahl" id="juz">${Array.from({ length: 30 }, (_, i) => `<button data-j="${i + 1}" class="${juzAn.has(i + 1) ? 'an' : ''}">${i + 1}</button>`).join('')}</div></div>
    <div class="abschnitt"><h3>Erst ansehen, dann prüfen</h3><p class="unter">Vor der ersten Āya kannst du den Abschnitt offen lesen und dich danach prüfen.</p>
      <div class="wahl" id="vorueben" style="margin-top:10px"><button data-w="1" class="${E.vorueben ? 'an' : ''}">Anbieten</button><button data-w="0" class="${E.vorueben ? '' : 'an'}">Aus</button></div></div>
    <div class="abschnitt"><h3>Hilfe beim Aufdecken</h3><p class="unter">„Erstes Wort“ zeigt den Anfang der Āya, danach deckt „Noch ein Wort“ jeweils ein weiteres auf. Die Āya zählt dann als halb sicher.</p>
      <div class="wahl" id="hilfe" style="margin-top:10px"><button data-w="1" class="${E.hilfe ? 'an' : ''}">Erlaubt</button><button data-w="0" class="${E.hilfe ? '' : 'an'}">Aus</button></div></div>
    <div class="abschnitt"><h3>Sofortkorrektur</h3><p class="unter">Hattest du in einem Abschnitt Fehler, fragt Itqān die Āyāt mit Fehler am Ende gleich noch einmal ab. Das zählt nicht für die Punkte, die Wiederholung nach 1, 3 und 7 Tagen bleibt.</p>
      <div class="wahl" id="sofort" style="margin-top:10px"><button data-w="1" class="${E.sofort !== false ? 'an' : ''}">An</button><button data-w="0" class="${E.sofort !== false ? '' : 'an'}">Aus</button></div></div>
    <div class="abschnitt"><h3>Dein Tag beginnt um</h3><p class="unter">Wer sein Wird nach Mitternacht macht, kann den Tageswechsel später legen. Bei 3 Uhr zählt ein Wird um 1 Uhr nachts noch zum Vortag, die Kette bleibt ganz.</p>
      <label class="auswahl" style="margin-top:10px"><span>Tageswechsel</span><select id="tagesbeginn">${optionen([0, 1, 2, 3, 4, 5], E.tagesbeginn || 0, x => x ? `${x} Uhr` : 'Mitternacht')}</select></label></div>
    <div class="abschnitt"><h3>Abhören durch eine zweite Person</h3><p class="unter">Zu Beginn eines Abschnitts steht klein „Jemand hört ab“. Dann sieht die zuhörende Person den Text offen und tippt Fehler direkt aufs Wort.</p>
      <div class="wahl" id="abhoeren" style="margin-top:10px"><button data-w="1" class="${E.abhoeren !== false ? 'an' : ''}">Anbieten</button><button data-w="0" class="${E.abhoeren !== false ? '' : 'an'}">Aus</button></div></div>
    <div class="abschnitt"><h3>Tägliche Erinnerung</h3><p class="unter">Ohne Server kann die App selbst keine Benachrichtigung schicken. Deshalb trägt sie dein Wird als täglichen Termin mit Erinnerung in deinen Kalender ein.</p>
      <div class="zeitwahl"><select id="std" aria-label="Stunde">${optionen(Array.from({ length: 24 }, (_, i) => i), hh, zwei)}</select><b>:</b><select id="min" aria-label="Minute">${optionen(minuten, mm, zwei)}</select><span>Uhr</span></div>
      <button class="knopf leise" id="ics">In den Kalender eintragen</button></div>
    <div class="abschnitt"><h3>Offline</h3><p class="unter">Lädt alle 604 Seiten des Drucks ${D.ausgabe === 'v1' ? '1405 (etwa 48 MB)' : '1421 (etwa 95 MB)'}, damit Itqān auch ohne Internet jede Seite zeigt. Am besten im WLAN.</p>
      <p class="offline-stand" id="offline-stand">Gespeicherte Seiten werden gezählt …</p><div class="balken verdeckt" id="offline-balken"><div style="width:0%"></div></div>
      <button class="knopf leise" id="offline" style="margin-top:10px">Alle Seiten speichern</button></div>
    <div class="abschnitt"><h3>Schnappschüsse</h3><p class="unter">Itqān legt einmal am Tag und vor wichtigen Schritten eine Kopie deines Profils auf diesem Gerät ab. Damit holst du einen früheren Stand zurück. Gegen das Löschen der App oder einen Gerätewechsel hilft nur „Profil sichern“.</p>
      <div style="margin-top:10px">${schnappschussListe()}</div></div>
    <div class="abschnitt"><h3>Neu beginnen</h3><p class="unter">Löscht dein Profil auf diesem Gerät. Sichere es vorher.</p><button class="knopf schlecht" id="reset" style="margin-top:10px">Profil löschen</button></div>`;
  const dauer = () => app.querySelector('#dauer').innerHTML = `Eine Ḫatma dauert damit etwa<br><b class="dauer-zahl">${Z.tageProKhatma(true)} Tage</b>`;
  app.querySelector('#name').onchange = ev => { P.name = ev.target.value.trim(); Z.speichern(); toast('Gespeichert.'); };
  const wahl = (id, fn) => app.querySelector('#' + id).onclick = ev => { const w = ev.target.dataset.w; if (w == null) return; app.querySelectorAll(`#${id} button`).forEach(b => b.classList.toggle('an', b.dataset.w === w)); fn(w); Z.speichern(); };
  wahl('thema', w => { E.thema = w; themaAnwenden(); });
  wahl('seitengroesse', w => { E.seitenGroesse = +w; themaAnwenden(); });
  wahl('textgroesse', w => { E.textGroesse = +w; themaAnwenden(); });
  wahl('reihenfolge', w => { E.reihenfolge = w; app.querySelector('#zufallwahl').classList.toggle('verdeckt', w !== 'zufall'); dauer(); toast('Gilt ab dem nächsten Tagesplan.'); });
  wahl('zufall', w => { E.zufall = w; toast('Gilt ab dem nächsten Tagesplan.'); });
  wahl('vorueben', w => { E.vorueben = w === '1'; });
  wahl('ausgabe', w => { if (w === E.ausgabe) return; E.ausgabe = w; Z.speichern(); location.reload(); });
  wahl('modus', w => { if (w === (E.modus || 'fort')) return; Z.schnappschuss('vor dem Gliederungswechsel'); E.modus = w; Z.speichern(); toast('Abschnitte werden umgestellt …'); setTimeout(() => location.reload(), 600); });
  wahl('hilfe', w => { E.hilfe = w === '1'; });
  wahl('schwaechen', w => { E.schwaechen = w; app.querySelector('#schwach-text').textContent = SCHWACH_TEXT[w]; dauer(); toast('Gilt ab dem nächsten Tagesplan.'); });
  pauseBinden();
  wahl('sofort', w => { E.sofort = w === '1'; });
  wahl('abhoeren', w => { E.abhoeren = w === '1'; });
  app.querySelector('#tagesbeginn').onchange = ev => { E.tagesbeginn = +ev.target.value; Z.speichern(); toast('Gilt ab sofort.'); };
  const alle = app.querySelector('#alle'), tage = [...app.querySelectorAll('.tagesliste select')];
  alle.onchange = () => {
    const n = +alle.value; if (!n) return;
    E.pensum = Array(7).fill(n); tage.forEach(x => x.value = String(n));
    alle.querySelector('option[value=""]')?.remove(); Z.speichern(); dauer();
  };
  tage.forEach(x => x.onchange = () => {
    if (+x.value === 0 && E.pensum.filter((v, i) => v > 0 && i !== +x.dataset.i).length === 0) { x.value = String(E.pensum[+x.dataset.i]); toast('Mindestens ein Tag braucht einen Wird.'); return; }
    E.pensum[+x.dataset.i] = +x.value; Z.speichern(); dauer();
    if (gleich()) { alle.querySelector('option[value=""]')?.remove(); alle.value = String(E.pensum[0]); }
    else { if (!alle.querySelector('option[value=""]')) alle.insertAdjacentHTML('afterbegin', '<option value="">verschieden</option>'); alle.value = ''; }
  });
  app.querySelector('#juz').onclick = ev => {
    const j = +ev.target.dataset.j; if (!j) return;
    ev.target.classList.toggle('an'); juzAn.has(j) ? juzAn.delete(j) : juzAn.add(j);
    if (!juzAn.size) { juzAn.add(j); ev.target.classList.add('an'); toast('Mindestens ein Ǧuzʾ.'); return; }
    E.bereich = juzAn.size === 30 ? null : D.A.filter(e => juzAn.has(e.juz)).map(e => e.id); Z.speichern(); dauer();
  };
  const zeit = () => { E.erinnerung = `${zwei(app.querySelector('#std').value)}:${zwei(app.querySelector('#min').value)}`; Z.speichern(); };
  app.querySelector('#std').onchange = zeit; app.querySelector('#min').onchange = zeit;
  app.querySelector('#ics').onclick = () => {
    const [h, m] = (E.erinnerung || '05:30').split(':'), d = Z.heute().replace(/-/g, '');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Itqan//Wird//DE', 'BEGIN:VEVENT', `UID:itqan-wird-${Date.now()}@itqan`, `DTSTAMP:${stamp}`,
      `DTSTART:${d}T${h}${m}00`, 'DURATION:PT20M', 'RRULE:FREQ=DAILY', 'SUMMARY:Itqān · Wird', `DESCRIPTION:Zeit für dein Wird. ${location.href.split('#')[0]}`,
      'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:Zeit für dein Wird', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    herunterladen('Itqan-Wird.ics', ics, 'text/calendar');
  };
  // Stand anzeigen, nur fehlende Seiten laden, Abbrüche zählen und „Erneut versuchen“ anbieten
  const stand = app.querySelector('#offline-stand'), balken = app.querySelector('#offline-balken'), ob = app.querySelector('#offline');
  const standZeigen = async () => {
    const da = await gespeicherteSeiten();
    if (!da) { stand.textContent = 'Dieser Browser kann keine Seiten speichern.'; ob.disabled = true; return null; }
    stand.innerHTML = da.size >= 604 ? '<b>Alle 604 Seiten sind gespeichert.</b> Itqān funktioniert auch ohne Internet.' : `<b>${da.size} von 604 Seiten</b> sind auf diesem Gerät gespeichert.`;
    ob.textContent = da.size >= 604 ? 'Alle Seiten gespeichert' : da.size ? 'Fehlende Seiten speichern' : 'Alle Seiten speichern';
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
      stand.innerHTML = `Speichere … <b>${da.size + fertig - fehler} von 604</b>`;
      if (!app.contains(ob)) return;
    }
    balken.classList.add('verdeckt');
    await standZeigen();
    if (fehler) { stand.innerHTML += `<br>${fehler} Seiten konnten nicht geladen werden. Prüfe die Verbindung und versuche es erneut.`; ob.disabled = false; ob.textContent = 'Erneut versuchen'; }
  };
  app.querySelector('#reset').onclick = async () => {
    const ok = await dialog({ titel: 'Profil wirklich löschen?', html: '<p>Dein Fortschritt auf diesem Gerät wird gelöscht. Zurück holst du ihn nur mit einer gesicherten Datei oder einem Schnappschuss.</p>', ja: 'Löschen', gefahr: true });
    if (!ok) return;
    Z.schnappschuss('vor dem Löschen'); Z.loeschen(); location.hash = '#start';
  };
}

// ---------- Lehreransicht ----------
function schuelerLaden() { try { return JSON.parse(localStorage.getItem('itqan-schueler') || '[]'); } catch (e) { return []; } }
function schuelerSpeichern(l) { try { localStorage.setItem('itqan-schueler', JSON.stringify(l)); } catch (e) { toast('Speicher voll.'); } }
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
    return `<div class="abschnitt"><div class="kopfzeile"><h3>${esc(x.profil.name || 'ohne Namen')}</h3><button class="textlink" data-weg="${i}">entfernen</button></div>
      <p class="unter">Rang: <b>${Z.RAENGE[Z.rangJetzt()].n}</b> · Stand ${new Date(x.exportiert).toLocaleDateString('de-AT')} · ${Object.keys(x.profil.fstellen || {}).length} markierte Fehlerstellen${x.echt ? '' : ' · <b style="color:var(--schlechtT)">Datei wurde verändert</b>'}</p>
      <div class="zahlen"><div class="zahl"><b>${x.profil.kette.n}</b><span>Kette</span></div><div class="zahl"><b>${q} %</b><span>Āyāt sicher</span></div><div class="zahl"><b>${Math.floor(kf.anteil * 100)} %</b><span>${x.profil.zyklus.khatma + 1}. Ḫatma</span></div></div>
      <div class="licht-seiten" role="img" aria-label="Lichtkarte der 30 Aǧzāʾ: ${juz.filter(o => o != null).length} von 30 mit Übung, je heller, desto sicherer" style="grid-template-columns:repeat(30,1fr);gap:2px">${juz.map(o => `<button tabindex="-1" aria-hidden="true" class="${o == null ? 'aus' : ''}" style="aspect-ratio:1/2;${o ? 'opacity:' + o : ''}"></button>`).join('')}</div>
      <p class="unter" style="margin-top:10px">${kopie.einst.modus === 'anf' ? 'Übt im Anfänger-Modus. ' : ''}${schwach.length ? 'Schwach: ' + schwach.map(({ id }) => `${abschnittName(D.A[id])} (${esc(D.A[id].titel)})`).join(' · ') : 'Noch keine Wiederholungen.'}</p></div>`;
  }); }).join('');
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#profil'">${zurueckPfeil}Profil</button>
    <div class="marke">Lehreransicht<small>Deine Schüler schicken dir ihre Profildatei. Sie bleibt nur auf diesem Gerät.</small></div>
    <button class="knopf haupt" id="import" style="margin:18px 0">Profildateien hinzufügen</button>
    ${karten || '<p class="leer">Noch keine Schüler. Füge die .itqan-Dateien deiner Schüler hinzu.</p>'}`;
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
    schuelerSpeichern(l); toast(`${n} ${n === 1 ? 'Profil' : 'Profile'} übernommen.`); lehrer();
  };
  app.querySelectorAll('[data-weg]').forEach(b => b.onclick = () => { const l = schuelerLaden(); l.splice(+b.dataset.weg, 1); schuelerSpeichern(l); lehrer(); });
}

// ---------- Start der App ----------
(async () => {
  Z.laden(); themaAnwenden();
  try {
    await ladeDaten(Z.P?.einst.ausgabe || 'v2', Z.P?.einst.modus || 'fort');
    if (await Z.gliederungAbgleichen()) toast('Abschnitte umgestellt, dein Fortschritt ist übernommen.');
    if (Z.P?.einst.bereichJuz) { const j = new Set(Z.P.einst.bereichJuz); Z.P.einst.bereich = D.A.filter(e => j.has(e.juz)).map(e => e.id); delete Z.P.einst.bereichJuz; Z.speichern(); }
  }
  catch (e) { app.innerHTML = '<div class="lade">Die Daten konnten nicht geladen werden. Bitte mit Internet erneut öffnen.</div>'; return; }
  Z.tagesSchnappschuss();
  await zeige();
  setTimeout(neuigkeitenPruefen, 600);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  // Tageswechsel, wenn die App über Nacht offen bleibt
  let tag = Z.heute();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Z.heute() !== tag) { tag = Z.heute(); if ((location.hash || '#heute') === '#heute') zeige(); } });
})();
