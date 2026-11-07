// Itqān · Oberfläche
import { D, ladeDaten, abschnittName, bereichText, zahl, esc, sureName, sureArabisch, juzVonSeite, juzStart, ayaWoerter } from './daten.js';
import * as Z from './zustand.js';
import { seiteHTML, schriftenLaden, schrift, glyphen, zeilenEinpassen } from './mushaf.js';

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
}
dunkelMQ.addEventListener('change', themaAnwenden);
// Wie eine App: kein Zoomen mit zwei Fingern (Safari hält sich nicht an user-scalable=no)
for (const g of ['gesturestart', 'gesturechange']) document.addEventListener(g, e => e.preventDefault(), { passive: false });

// ---------- Hilfen ----------
function toast(text, ms = 2600) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = text; document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('an')); setTimeout(() => { t.classList.remove('an'); setTimeout(() => t.remove(), 400); }, ms);
}
function datumText(d = new Date()) {
  const g = d.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' });
  let h = ''; try { h = new Intl.DateTimeFormat('de-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(d).replace(/\s*(AH|d\. H\.)$/, '') + ' n. H.'; } catch (e) {}
  return g + (h ? ' · ' + h : '');
}
const stufePunkte = st => `<div class="stufe" title="${Z.STUFEN[st]}">${[1, 2, 3, 4].map(i => `<i class="${st >= i ? 'an' : ''}"></i>`).join('')}</div>`;
// Die Laterne (App-Symbol), freigestellt: hell = Bronze für die Lesestube, dunkel = Gold für Tezhip
const laterne = klasse => `<span class="${klasse}" aria-hidden="true"><img class="nur-hell" src="icons/laterne_hell.png" alt=""><img class="nur-dunkel" src="icons/laterne.png" alt=""></span>`;
const qandil = () => laterne('qandil');
const lampeKlein = laterne('lampe-k');
function herunterladen(name, inhalt, typ) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([inhalt], { type: typ })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function dateiWaehlen(mehrere = false) {
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = '.itqan,.json,application/json'; i.multiple = mehrere;
    i.onchange = async () => res(await Promise.all([...i.files].map(f => f.text()))); i.click();
  });
}
function navSetzen(aktiv) {
  if (!aktiv) { nav.classList.add('verdeckt'); return; }
  nav.classList.remove('verdeckt');
  nav.querySelectorAll('a').forEach(a => a.classList.toggle('an', a.dataset.r === aktiv));
}

// ---------- Router ----------
const ROUTEN = { heute, ueben, fertig, karte: lichtkarte, mushaf, profil, einstellungen, lehrer, start };
async function zeige() {
  const [name, ...arg] = (location.hash.slice(1) || 'heute').split('/');
  if (!Z.P && name !== 'start') { location.replace('#start'); return; }
  const f = ROUTEN[name] || heute;
  document.body.dataset.ansicht = ROUTEN[name] ? name : 'heute';
  window.scrollTo(0, 0);
  await f(...arg);
}
addEventListener('hashchange', zeige);

// ---------- Start ----------
function start() {
  navSetzen(null);
  const s = { name: '', pensum: 3, reihenfolge: 'vorwaerts', zufall: 'einzeln', juz: new Set(Array.from({ length: 30 }, (_, i) => i + 1)), thema: 'auto' };
  const tageText = () => {
    const ids = D.A.filter(e => s.juz.has(e.juz)).length;
    return `${ids} Abschnitte · eine Ḫatma dauert damit etwa ${Math.ceil(ids / s.pensum)} Tage`;
  };
  app.innerHTML = `<div class="start">${qandil()}<h1>Itqān</h1><div class="ar">إِتْقَان</div>
    <p class="unter" style="margin-top:8px">Die Murāǧaʿa des ganzen Qurʾāns, Abschnitt für Abschnitt.</p></div>
    <div class="abschnitt"><h3>Wie heißt du?</h3><div class="feld"><input type="text" id="name" placeholder="Dein Name (für deine Profildatei)" autocomplete="given-name"></div></div>
    <div class="abschnitt"><h3>Was wiederholst du?</h3><p class="unter">Wähle die Aǧzāʾ, die du auswendig kannst.</p>
      <div class="reihe" style="margin:12px 0"><button class="knopf leise klein" id="alle">Alle 30</button><button class="knopf leise klein" id="keine">Keinen</button></div>
      <div class="juzwahl" id="juz"></div></div>
    <div class="abschnitt"><h3>Wie viele Abschnitte am Tag?</h3><p class="unter">Ein Abschnitt hat meist 10 bis 15 Zeilen. Pro Wochentag kannst du es später anpassen.</p>
      <div class="zaehler"><button id="minus" aria-label="weniger">−</button><b id="pensum">3</b><button id="plus" aria-label="mehr">+</button></div>
      <p class="unter" style="text-align:center" id="dauer"></p></div>
    <div class="abschnitt"><h3>In welcher Reihenfolge?</h3><div class="wahl" id="reihenfolge"><button data-w="vorwaerts" class="an">Ab al-Fātiḥah</button><button data-w="rueckwaerts">Ab an-Nās</button><button data-w="zufall">Zufällig</button></div>
      <div id="zufallwahl" class="verdeckt" style="margin-top:12px"><p class="unter">Bei mehreren Abschnitten am Tag:</p><div class="wahl" id="zufall" style="margin-top:8px"><button data-w="einzeln" class="an">Verstreute Stellen</button><button data-w="block">Eine Stelle am Stück</button></div></div></div>
    <div class="abschnitt"><h3>Erscheinungsbild</h3><div class="wahl" id="thema"><button data-w="hell">Hell</button><button data-w="dunkel">Dunkel</button><button data-w="auto" class="an">Wie Gerät</button></div></div>
    <button class="knopf haupt" id="los" style="margin-top:18px">Bismillāh, beginnen</button>`;
  const juzEl = app.querySelector('#juz');
  const juzZeichnen = () => { juzEl.innerHTML = Array.from({ length: 30 }, (_, i) => `<button data-j="${i + 1}" class="${s.juz.has(i + 1) ? 'an' : ''}">${i + 1}</button>`).join(''); app.querySelector('#dauer').textContent = tageText(); };
  juzEl.onclick = e => { const j = +e.target.dataset.j; if (!j) return; s.juz.has(j) ? s.juz.delete(j) : s.juz.add(j); juzZeichnen(); };
  app.querySelector('#alle').onclick = () => { for (let i = 1; i <= 30; i++) s.juz.add(i); juzZeichnen(); };
  app.querySelector('#keine').onclick = () => { s.juz.clear(); juzZeichnen(); };
  const p = d => { s.pensum = Math.min(30, Math.max(1, s.pensum + d)); app.querySelector('#pensum').textContent = s.pensum; app.querySelector('#dauer').textContent = tageText(); };
  app.querySelector('#minus').onclick = () => p(-1); app.querySelector('#plus').onclick = () => p(1);
  for (const id of ['reihenfolge', 'zufall', 'thema']) app.querySelector('#' + id).onclick = e => {
    const w = e.target.dataset.w; if (!w) return; s[id] = w;
    app.querySelectorAll(`#${id} button`).forEach(b => b.classList.toggle('an', b.dataset.w === w));
    if (id === 'reihenfolge') app.querySelector('#zufallwahl').classList.toggle('verdeckt', w !== 'zufall');
    if (id === 'thema') { try { localStorage.setItem('itqan-thema', w); } catch (x) {} themaAnwenden(); }
  };
  app.querySelector('#los').onclick = () => {
    if (!s.juz.size) { toast('Wähle mindestens einen Ǧuzʾ.'); return; }
    const bereich = s.juz.size === 30 ? null : D.A.filter(e => s.juz.has(e.juz)).map(e => e.id);
    Z.neuesProfil({ name: app.querySelector('#name').value.trim(), pensum: s.pensum, reihenfolge: s.reihenfolge, bereich, thema: s.thema });
    Z.P.einst.zufall = s.zufall; Z.speichern();
    navigator.storage?.persist?.();
    location.hash = '#heute';
  };
  juzZeichnen();
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
  let unter = t.voll ? 'Dein Wird für heute ist vollbracht. Allāhumma bārik.' : `Dein Wird für heute: noch ${pflicht.length - erledigt} ${pflicht.length - erledigt === 1 ? 'Abschnitt' : 'Abschnitte'}.`;
  const karten = t.plan.map((id, i) => {
    const e = D.A[id], fertig = t.fertig.includes(id), jetzt = !fertig && id === offen[0];
    const art = t.art[id];
    const marke = art === 'fehler' ? '<span class="marke-art fehler">Wiederholung nach Fehler</span>' : art === 'qadaa' ? '<span class="marke-art qadaa">Qaḍāʾ</span>' : art === 'bonus' ? '<span class="marke-art bonus">Bonus</span>' : '';
    return `<a class="karte ${fertig ? 'fertig' : ''} ${jetzt ? 'jetzt' : ''}" href="#ueben/${id}" style="text-decoration:none;color:inherit">
      <div class="nr">${fertig ? '✓' : i + 1}</div><div class="t"><b>${esc(e.titel)}</b><span>${abschnittName(e)} · ${bereichText(e)} · ${e.zeilen} Zeilen ${marke}</span></div>${stufePunkte(Z.karte(id).st)}</a>`;
  }).join('');
  const bonusId = t.voll ? Z.bonusVorschlag() : null;
  const woche = Z.letzteTage(7).map(x => x.t).filter(Boolean);
  const wSum = woche.reduce((s, x) => ({ r: s.r + x.r, f: s.f + x.f, h: s.h + x.h, p: s.p + x.punkte, v: s.v + (x.voll ? 1 : 0) }), { r: 0, f: 0, h: 0, p: 0, v: 0 });
  const sicherungFaellig = !P.einst.letzteSicherung || Z.tageZwischen(P.einst.letzteSicherung.slice(0, 10), Z.heute()) > 14;
  app.innerHTML = `
    <div class="kopfzeile"><div class="marke">Itqān<small>${datumText()}</small></div>
      <a class="pille" href="#profil" style="text-decoration:none;color:inherit" title="Tage in Folge">${lampeKlein}${aktiv ? P.kette.n : 0}</a></div>
    <h2 class="gruss">Assalāmu ʿalaikum${P.name ? ', ' + esc(P.name) : ''}</h2><p class="unter">${unter}</p>
    ${t.qadaa && !t.voll ? `<div class="hinweisbox"><b>Qaḍāʾ:</b> Gestern ist dein Wird ausgefallen. Holst du es heute mit nach, bleibt deine Kette von ${P.kette.n} ${P.kette.n === 1 ? 'Tag' : 'Tagen'} ganz.</div>` : ''}
    <div class="ring"><svg width="210" height="210" viewBox="0 0 210 210">
      <defs><linearGradient id="verlauf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--akzent)"/><stop offset="1" stop-color="var(--akzent2)"/></linearGradient></defs>
      <circle cx="105" cy="105" r="88" fill="none" stroke="var(--rand)" stroke-width="10"/>
      <circle class="fort" cx="105" cy="105" r="88" fill="none" stroke="url(#verlauf)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${U}" stroke-dashoffset="${U}"/>
      <circle cx="105" cy="105" r="74" fill="none" stroke="var(--rand)" stroke-width="1" stroke-dasharray="2 6"/></svg>
      <div class="mitte"><span class="gross">${erledigt}<span>/${pflicht.length}</span></span><span class="klein">Abschnitte</span></div></div>
    <div class="zahlen"><div class="zahl"><b>${aktiv ? P.kette.n : 0}</b><span>Tage Kette</span></div>
      <div class="zahl"><b>${zahl(t.hasanat)}</b><span>Ḥasanāt heute</span></div>
      <div class="zahl"><b>${quote == null ? '·' : quote + ' %'}</b><span>Āyāt sicher</span></div></div>
    ${t.voll && bonusId != null ? `<div class="angebot"><b>Allāhumma bārik. Noch Kraft für mehr?</b><p>Ein Bonusabschnitt bringt dir 50 % mehr Itqān-Punkte. Vorschlag: ${abschnittName(D.A[bonusId])}, „${esc(D.A[bonusId].titel)}“.</p><button id="bonus">Bonusabschnitt beginnen</button></div>` : ''}
    <div class="titel-klein">Heute dran</div>${karten}
    <div class="klein-zeile" style="justify-content:center;gap:4px"><button class="textlink" id="weniger">− ein Abschnitt</button><button class="textlink" id="mehr">+ ein Abschnitt</button></div>
    ${istFreitag ? `<div class="titel-klein">Ǧumuʿa mubāraka · deine Woche</div><div class="abschnitt" style="margin-top:0">
      <p>${wSum.v} von 7 Tagen erfüllt · ${wSum.r + wSum.f + wSum.h ? Math.round(100 * (wSum.r + wSum.h * .5) / (wSum.r + wSum.f + wSum.h)) : 0} % der Āyāt sicher · ${zahl(wSum.p)} Itqān-Punkte</p>
      <p class="unter" style="margin-top:6px">Eine neue Woche ist ein guter Neuanfang. ${Z.schwaechste(1)[0] ? `Schwächster Abschnitt gerade: ${abschnittName(D.A[Z.schwaechste(1)[0].id])}.` : ''}</p></div>` : ''}
    ${istFreitag && sicherungFaellig ? `<div class="hinweisbox">Deine Fortschritte liegen nur auf diesem Gerät. <b><a href="#profil">Profil jetzt sichern</a></b></div>` : ''}
    <div class="titel-klein">${P.zyklus.khatma + 1}. Ḫatma</div>
    <div class="balken"><div style="width:${(kf.anteil * 100).toFixed(1)}%"></div></div>
    <div class="klein-zeile"><span>${kf.fertig} von ${kf.gesamt} Abschnitten</span><span>${Math.floor(kf.anteil * 100)} %</span></div>
    <div class="titel-klein"><a href="#karte" style="color:inherit">Lichtkarte · 30 Ǧuzʾ ›</a></div>
    <div class="licht-seiten" style="grid-template-columns:repeat(10,1fr);gap:5px">${Array.from({ length: 30 }, (_, i) => {
      const seiten = Array.from({ length: (i < 29 ? juzStart(i + 2) : 605) - juzStart(i + 1) }, (_, k) => juzStart(i + 1) + k);
      const w = seiten.map(Z.seitenStufe).filter(x => x != null);
      const o = w.length ? 0.14 + 0.86 * (w.reduce((a, b) => a + b, 0) / w.length) / 4.6 : null;
      return `<button onclick="location.hash='#karte'" class="${o == null ? 'aus' : ''}" style="aspect-ratio:1;border-radius:6px;font-size:11px;color:rgba(0,0,0,.5);${o != null ? `opacity:${o.toFixed(2)}` : ''}">${i + 1}</button>`;
    }).join('')}</div>`;
  requestAnimationFrame(() => setTimeout(() => app.querySelector('circle.fort')?.setAttribute('stroke-dashoffset', U * (1 - anteil)), 60));
  app.querySelector('#mehr').onclick = () => { Z.pensumHeuteAendern(1); heute(); };
  app.querySelector('#weniger').onclick = () => { Z.pensumHeuteAendern(-1); heute(); };
  const b = app.querySelector('#bonus'); if (b) b.onclick = () => location.hash = `#ueben/${bonusId}/bonus`;
}

// ---------- Üben ----------
const zurueckPfeil = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 5l-7 7 7 7"/></svg>';
async function ueben(idText, quelle) {
  navSetzen(null);
  const id = +idText, e = D.A[id]; if (!e) { location.hash = '#heute'; return; }
  app.innerHTML = '<div class="lade">Seiten werden geladen …</div>';
  const E = Z.P.einst, t = Z.tagesplan(), art = quelle || t.art[id];
  // Bei Zufall und Fehlerwiederholung: die Āya davor deutlich zeigen, damit man weiß, wo man ist
  const vorVi = e.v[0] - 1;
  const kontext = vorVi >= 0 && e.von[1] > 1 && (E.reihenfolge === 'zufall' || art === 'fehler');
  const kWoerter = kontext ? ayaWoerter(vorVi) : [];
  const kSeiten = [...new Set(kWoerter.map(x => x[5]))];
  const kBox = kontext && kSeiten.some(p => !e.seiten.includes(p));
  await Promise.all([schriftenLaden(e.seiten), ...kWoerter.map(x => schrift(x[4]))]);
  const k = Z.karte(id);
  const ayat = []; for (let v = e.v[0]; v <= e.v[1]; v++) ayat.push(v);
  const zu = new Set(ayat), alt = new Set(k.fa || []), status = new Map(), erg = [];
  let pos = 0, offen = false, hilfe = false, ti = 0, teile = [], markieren = false, fArt = null, vorschau = false;
  const zusatz = art === 'bonus' ? ' · Bonus' : art === 'fehler' ? ' · Wiederholung nach Fehler' : '';
  app.innerHTML = `<div class="ueb-kopf"><button class="zurueck" id="zurueck" aria-label="Zurück">${zurueckPfeil}</button>
      <div class="info">${bereichText(e)} · ${e.ayat} Āyāt · ${e.zeilen} Zeilen · S. ${e.seiten.join(', ')}</div></div>
    ${kBox ? `<div class="kontext"><span>Davor · ${D.V[vorVi][0]}:${D.V[vorVi][1]}</span><div class="kz">${kWoerter.map(([c, , ty, , p]) => `<span style="font-family:qp${p}">${glyphen(c, ty)}</span>`).join('')}</div></div>` : ''}
    <div class="seiten" id="seiten"></div><div style="height:190px"></div>
    <div class="steuerung"><div class="innen"><div class="punkte" id="punkte"></div><div class="arten verdeckt" id="arten"></div><div class="reihe" id="knoepfe"></div>
    <div class="zeile2"><span class="unter" id="hinweis"></span><span class="unter" id="zaehler"></span></div></div></div>
    <div class="einblendung" id="einbl"><div><div class="ueber">${abschnittName(e)}${e.nr ? ' von ' + e.von_n : ''}${zusatz}</div><h2>${esc(e.titel)}</h2>
      <div class="ar">${sureArabisch(e.von[0])}</div></div></div>`;
  const einbl = app.querySelector('#einbl');
  const einblWeg = () => { if (!einbl.isConnected) return; einbl.classList.add('weg'); setTimeout(() => einbl.remove(), 350); };
  einbl.addEventListener('animationend', ev => { if (ev.target === einbl) einbl.remove(); });
  einbl.onclick = einblWeg;
  const seitenEl = app.querySelector('#seiten');
  seitenEl.innerHTML = e.seiten.map(p => seiteHTML(p, { von: e.v[0], bis: e.v[1], zu, alt, klar: kontext ? new Set([vorVi]) : undefined, fst: Z.fehlerstellenSet() })).join('');
  zeilenEinpassen(seitenEl);
  app.querySelector('#zurueck').onclick = () => history.length > 1 ? history.back() : (location.hash = '#heute');
  const spans = vi => [...seitenEl.querySelectorAll(`.w[data-v="${vi}"]`)];
  const K = app.querySelector('#knoepfe'), H = app.querySelector('#hinweis'), A = app.querySelector('#arten'), Zl = app.querySelector('#zaehler');
  // Āya in Teile bis zum jeweils nächsten Stoppzeichen zerlegen (Lā zählt nicht als Halt)
  function teileVon(vi) {
    const aus = [[]];
    for (const s of spans(vi)) { aus[aus.length - 1].push(s); if (s.querySelector('.wq:not(.la)')) aus.push([]); }
    while (aus.length > 1 && aus[aus.length - 1].length <= 1) { const rest = aus.pop(); aus[aus.length - 1].push(...rest); }
    return aus;
  }
  function sichtbar(el) { if (!el) return; const r = el.getBoundingClientRect(); if (r.top < 70 || r.bottom > innerHeight - 210) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  function zeichne() {
    app.querySelector('#punkte').innerHTML = ayat.map((a, i) => `<i class="${erg[i] || (i === pos ? 'jetzt' : '')}"></i>`).join('');
    seitenEl.querySelectorAll('.naechste').forEach(x => x.classList.remove('naechste'));
    seitenEl.querySelectorAll('.ziel').forEach(x => x.classList.remove('ziel'));
    A.classList.add('verdeckt');
    if (pos >= ayat.length) return abschluss();
    const vi = ayat[pos];
    Zl.textContent = `Āya ${pos + 1} von ${ayat.length}`;
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
      H.textContent = 'Tippe auf das Wort, bei dem du dich vertan hast. Freiwillig.';
      app.querySelector('#weiter').onclick = markierenFertig;
      return;
    }
    if (!offen) {
      if (ti === 0) teile = teileVon(vi);
      teile.slice(ti).flat().forEach(x => x.classList.add('naechste'));
      const grenze = ti < teile.length - 1 ? teile[ti][teile[ti].length - 1] : null;
      grenze?.querySelector('.wq:not(.la)')?.classList.add('ziel');
      K.innerHTML = `${grenze ? '<button class="knopf leise" id="teil">Bis zum Zeichen</button>' : ''}<button class="knopf haupt" id="auf">${ti ? 'Rest aufdecken' : `Āya ${D.V[vi][1]} aufdecken`}</button>`;
      const links = [];
      if (E.hilfe && !hilfe) links.push('<button class="textlink mini" id="hilfe">Anfang zeigen</button>');
      if (E.vorueben && pos === 0 && ti === 0) links.push('<button class="textlink mini" id="ansehen">Erst ansehen</button>');
      H.innerHTML = (alt.has(vi) ? 'Hier warst du zuletzt unsicher.' : ti ? 'Weiter aus dem Gedächtnis.' : 'Rezitiere aus dem Gedächtnis.') + (links.length ? '<br>' + links.join('') : '');
      app.querySelector('#auf').onclick = aufdecken;
      const tb = app.querySelector('#teil'); if (tb) tb.onclick = teilAufdecken;
      const hb = app.querySelector('#hilfe'); if (hb) hb.onclick = () => {
        hilfe = true; const s = spans(vi).find(x => x.classList.contains('zu'));
        if (s) { s.classList.remove('zu', 'naechste'); s.classList.add('erstes'); }
        zeichne();
      };
      const ab = app.querySelector('#ansehen'); if (ab) ab.onclick = () => { vorschau = true; seitenEl.classList.add('vorschau'); zeichne(); };
      sichtbar(teile[ti]?.[0]);
    } else {
      K.innerHTML = '<button class="knopf schlecht" id="f">Fehler</button><button class="knopf gut" id="r">Richtig</button>';
      H.textContent = hilfe ? 'Mit Hilfe: zählt als halb sicher.' : 'Warst du sicher und fehlerfrei?';
      app.querySelector('#r').onclick = () => bewerte(hilfe ? 'hilfe' : 'ok');
      app.querySelector('#f').onclick = () => bewerte('fehler');
    }
  }
  function aufdecken() {
    const vi = ayat[pos]; zu.delete(vi);
    spans(vi).forEach(x => x.classList.remove('zu', 'naechste', 'erstes'));
    offen = true; zeichne();
  }
  function teilAufdecken() {
    teile[ti].forEach(x => x.classList.remove('zu', 'naechste', 'erstes'));
    ti++;
    if (ti >= teile.length) return aufdecken();
    zeichne();
  }
  function bewerte(x) {
    const vi = ayat[pos]; erg[pos] = x; status.set(vi, x);
    spans(vi).forEach(s => { s.classList.remove('alt'); s.classList.add(x); });
    if (x === 'fehler') { markieren = true; fArt = null; return zeichne(); }
    naechsteAya();
  }
  function naechsteAya() { pos++; offen = false; hilfe = false; ti = 0; markieren = false; zeichne(); }
  function markierenFertig() {
    const marken = [...seitenEl.querySelectorAll('.w.fmark')];
    if (marken.length) Z.fehlerstellenMerken(marken.map(s => `${s.dataset.v}.${s.dataset.i}`), fArt);
    marken.forEach(s => { s.classList.remove('fmark'); s.classList.add('fs'); });
    if (marken.length) toast(marken.length === 1 ? 'Stelle gemerkt.' : `${marken.length} Stellen gemerkt.`, 1600);
    naechsteAya();
  }
  A.onclick = ev => { const a = ev.target.dataset.a; if (!a) return; fArt = fArt === a ? null : a; A.querySelectorAll('button').forEach(b => b.classList.toggle('an', b.dataset.a === fArt)); };
  seitenEl.onclick = ev => {
    const w = ev.target.closest('.w'); if (!w) return;
    if (markieren) { if (+w.dataset.v === ayat[pos]) w.classList.toggle('fmark'); return; }
    if (w.classList.contains('zu') && +w.dataset.v === ayat[pos] && !offen && !vorschau) aufdecken();
  };
  const tasten = ev => {
    if (!document.body.contains(seitenEl)) { removeEventListener('keydown', tasten); return; }
    if (pos >= ayat.length) return;
    if (vorschau) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); app.querySelector('#pruefen')?.click(); } return; }
    if (markieren) { if (ev.key === 'Enter') { ev.preventDefault(); markierenFertig(); } return; }
    if (!offen && (ev.key === ' ' || ev.key === 'Enter')) { ev.preventDefault(); aufdecken(); }
    else if (!offen && (ev.key === 's' || ev.key === 'ArrowDown')) { ev.preventDefault(); app.querySelector('#teil')?.click(); }
    else if (offen && (ev.key === 'r' || ev.key === 'ArrowRight')) bewerte(hilfe ? 'hilfe' : 'ok');
    else if (offen && (ev.key === 'f' || ev.key === 'ArrowLeft')) bewerte('fehler');
  };
  addEventListener('keydown', tasten);
  function abschluss() {
    removeEventListener('keydown', tasten);
    const res = Z.abschnittAbschliessen(id, erg, art === 'frei' || art === 'bonus' ? art : undefined);
    letzteEreignisse.push(...res.ereignisse);
    const t2 = Z.tagesplan();
    const wirdJetzt = res.ereignisse.some(x => x.typ === 'wird');
    const naechster = t2.plan.find(x => !t2.fertig.includes(x));
    const orn = res.ereignisse.filter(x => x.typ === 'ornament').map(x => `<div class="band">✦ <span><b>Neues Ornament:</b> ${sureName(x.s)} ist jetzt „${x.stufe}“.</span></div>`).join('');
    document.querySelector('.steuerung').remove();
    app.innerHTML = `<div class="feier">${qandil()}
      <h2>${res.f ? 'Abschnitt beendet' : res.h ? 'Gut gemacht' : 'Fehlerfrei, mā šāʾa llāh'}</h2>
      <p>${esc(e.titel)}<br><span class="unter">${abschnittName(e)} · Stufe: ${Z.STUFEN[res.stufe]}${res.stufe > res.vorher ? ' ↑' : res.stufe < res.vorher ? ' ↓' : ''}</span></p>
      <div class="ernte"><div><b>${res.r + res.h}/${ayat.length}</b><span>Āyāt gekonnt</span></div><div><b>+${zahl(res.punkte)}</b><span>Itqān-Punkte</span></div>
        <div style="grid-column:1/-1"><b>+${zahl(res.hasanat)}</b><span>Ḥasanāt</span></div></div>
      <p class="niyya">Jeder Buchstabe zehnfach, bei aufrichtiger Niyya, in šāʾa llāh.</p>
      <div class="aufschl">${res.teile.map(([a, b]) => `<div><span>${a}</span><span>+${zahl(b)}</span></div>`).join('')}</div>
      ${res.f ? `<div class="hinweisbox">Die ${res.f === 1 ? 'Fehler-Āya kommt' : res.f + ' Fehler-Āyāt kommen'} morgen wieder dran. Dann mit Markierung.</div>` : ''}
      ${orn}
      <div style="display:grid;gap:10px;margin-top:16px">
      ${wirdJetzt ? '<button class="knopf haupt" id="weiter">Weiter</button>' : naechster != null && art !== 'frei' ? `<button class="knopf haupt" id="naechster">Nächster Abschnitt</button><button class="knopf leise" id="uebersicht">Zur Übersicht</button>` : '<button class="knopf haupt" id="uebersicht">Zur Übersicht</button>'}
      </div></div>`;
    const w = app.querySelector('#weiter'); if (w) w.onclick = () => location.hash = '#fertig';
    const n = app.querySelector('#naechster'); if (n) n.onclick = () => location.replace(`#ueben/${naechster}`);
    const u = app.querySelector('#uebersicht'); if (u) u.onclick = () => location.hash = '#heute';
    window.scrollTo(0, 0);
  }
  zeichne();
  // nächste Seiten schon laden
  const t3 = Z.tagesplan(); t3.plan.filter(x => !t3.fertig.includes(x) && x !== id).slice(0, 2).forEach(x => schriftenLaden(D.A[x].seiten));
}

// ---------- Wird vollbracht ----------
function fertig() {
  navSetzen(null);
  const t = Z.tagesplan(), P = Z.P, bonusId = Z.bonusVorschlag();
  const ev = letzteEreignisse; letzteEreignisse = [];
  const quote = t.r + t.f + t.h ? `${t.r + t.h}/${t.r + t.f + t.h}` : '·';
  const extra = ev.filter(x => x.typ === 'kette' || x.typ === 'khatma' || x.typ === 'ornament').map(x =>
    x.typ === 'kette' ? `<div class="band">✦ <span><b>${x.n} Tage in Folge.</b> ${x.n === 66 ? 'Im Mittel wird eine Gewohnheit nach etwa 66 Tagen zur Selbstverständlichkeit.' : x.n === 40 ? 'Vierzig Tage Beständigkeit.' : 'Beständigkeit ist das Liebste bei Allāh, auch wenn es wenig ist.'}</span></div>`
    : x.typ === 'khatma' ? `<div class="band">✦ <span><b>Ḫatma ${x.n} vollendet.</b> Allāhumma rḥamnī bi-l-Qurʾān.</span></div>`
    : `<div class="band">✦ <span><b>Neues Ornament:</b> ${sureName(x.s)} ist jetzt „${x.stufe}“.</span></div>`).join('');
  app.innerHTML = `<div class="feier">${qandil()}
    <div class="ar">اللَّهُمَّ بَارِكْ</div><h2>Allāhumma bārik</h2>
    <p>Dein Wird für heute ist vollbracht.<br>Die ${P.kette.n}. Lampe deiner Kette brennt.</p>
    <div class="ernte"><div><b>${quote}</b><span>Āyāt gekonnt</span></div><div><b>+${zahl(t.punkte)}</b><span>Itqān-Punkte heute</span></div>
      <div><b>+${zahl(t.hasanat)}</b><span>Ḥasanāt heute</span></div><div><b>${P.kette.n}</b><span>Tage Kette</span></div></div>
    <p class="niyya">Ḥasanāt nach dem Ḥadīṯ: jeder Buchstabe zehnfach, bei aufrichtiger Niyya, in šāʾa llāh.</p>
    ${extra}
    ${bonusId != null ? `<div class="angebot"><b>Noch Kraft für mehr?</b><p>Ein Bonusabschnitt bringt dir heute 50 % mehr Itqān-Punkte. Vorschlag: ${abschnittName(D.A[bonusId])}, „${esc(D.A[bonusId].titel)}“.</p><button id="bonus">Bonusabschnitt beginnen</button></div>` : ''}
    <button class="textlink" id="genug" style="margin-top:12px">Für heute genug</button></div>`;
  const b = app.querySelector('#bonus'); if (b) b.onclick = () => location.hash = `#ueben/${bonusId}/bonus`;
  app.querySelector('#genug').onclick = () => location.hash = '#heute';
}

// ---------- Lichtkarte ----------
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
      zellen.push(`<button data-p="${p}" class="${s == null ? 'aus' : ''}" title="Seite ${p}" style="${s != null ? `opacity:${(0.12 + 0.88 * s / 4.6).toFixed(2)}` : ''}"></button>`);
    }
    zeilen.push(`<div class="licht-juz"><span>${j}</span><div class="licht-seiten">${zellen.join('')}</div></div>`);
  }
  app.innerHTML = `<div class="marke">Lichtkarte<small>Jede Seite leuchtet so hell, wie sie sitzt. Tippe auf eine Seite.</small></div>
    <div class="zahlen" style="grid-template-columns:repeat(5,1fr);margin-top:18px">${Z.STUFEN.map((s, i) => `<div class="zahl"><b style="font-size:19px">${zaehl[i]}</b><span>${s}</span></div>`).join('')}</div>
    <div style="margin-top:16px" id="licht">${zeilen.join('')}</div>
    <div class="legende"><span><i style="opacity:.12"></i>neu</span><span><i style="opacity:.45"></i>im Aufbau</span><span><i style="opacity:.7"></i>sicher</span><span><i></i>mutqan</span></div>`;
  app.querySelector('#licht').onclick = ev => { const p = ev.target.dataset.p; if (p) location.hash = '#mushaf/' + p; };
}

// ---------- Muṣḥaf ----------
async function mushaf(pText) {
  navSetzen('mushaf');
  const p = Math.min(604, Math.max(1, +pText || 1));
  app.innerHTML = '<div class="lade">Seite wird geladen …</div>';
  await schriftenLaden([p]);
  const abschnitte = D.A.filter(e => e.seiten.includes(p));
  const nrVon = vi => abschnitte.findIndex(e => vi >= e.v[0] && vi <= e.v[1]);
  const t = Z.tagesplan();
  const s = D.V[D.L[p - 1].find(z => z.w)?.w[0][1] ?? 0][0];
  app.innerHTML = `<div class="kopfzeile"><div class="marke">Muṣḥaf<small>Seite ${p} · ${sureName(s)} · Ǧuzʾ ${juzVonSeite(p)}</small></div>
      <div class="pille"><input id="nr" type="number" min="1" max="604" value="${p}" style="width:58px;border:0;background:none;text-align:center" aria-label="Seite"></div></div>
    <div class="reihe" style="margin:14px 0"><button class="knopf leise klein" id="vor">‹ Seite ${Math.min(604, p + 1)}</button><button class="knopf leise klein" id="zur">Seite ${Math.max(1, p - 1)} ›</button></div>
    <div id="seite">${seiteHTML(p, { ton: vi => { const i = nrVon(vi); return i < 0 ? null : abschnitte[i].id % 4; }, fst: Z.fehlerstellenSet() })}</div>
    <div class="titel-klein">Abschnitte auf dieser Seite</div>
    ${abschnitte.map((e, i) => {
      const dran = t.plan.includes(e.id) && !t.fertig.includes(e.id);
      return `<div class="karte tonk${e.id % 4}" data-a="${i}"><i class="farbe"></i><div class="t"><b>${esc(e.titel)}</b><span>${abschnittName(e)} · ${bereichText(e)} · ${Z.STUFEN[Z.karte(e.id).st]}${dran ? ' <span class="marke-art bonus">heute dran</span>' : ''}</span></div><a class="knopf leise klein" style="width:auto;text-decoration:none" href="#ueben/${e.id}/frei">Üben</a></div>`;
    }).join('')}`;
  zeilenEinpassen(app.querySelector('#seite'));
  app.querySelector('#vor').onclick = () => location.replace('#mushaf/' + Math.min(604, p + 1));
  app.querySelector('#zur').onclick = () => location.replace('#mushaf/' + Math.max(1, p - 1));
  app.querySelector('#nr').onchange = ev => location.replace('#mushaf/' + ev.target.value);
  // Tippen auf die Seite zeigt den passenden Abschnitt unten
  app.querySelector('#seite').onclick = ev => {
    const w = ev.target.closest('.w'); if (!w) return;
    const k = app.querySelector(`.karte[data-a="${nrVon(+w.dataset.v)}"]`); if (!k) return;
    k.scrollIntoView({ block: 'center', behavior: 'smooth' }); k.classList.remove('blitz'); void k.offsetWidth; k.classList.add('blitz');
  };
  if (p < 604) schriftenLaden([p + 1]); if (p > 1) schriftenLaden([p - 1]);
}

// ---------- Profil ----------
function profil() {
  navSetzen('profil');
  const P = Z.P, s = P.summe;
  const quote = s.r + s.f + s.h ? Math.round(100 * (s.r + s.h * .5) / (s.r + s.f + s.h)) : 0;
  const tage = Z.letzteTage(30);
  const max = Math.max(1, ...tage.map(x => x.t?.punkte || 0));
  const schwach = Z.schwaechste(6);
  const orn = P.meilen.filter(m => m.startsWith('sure-')).map(m => { const [, st, sn] = m.split('-'); return `${sureName(+sn)} ${st}`; });
  const ketten = P.meilen.filter(m => m.startsWith('kette-')).map(m => m.split('-')[1] + ' Tage');
  const fl = Z.fehlerstellenListe(12);
  for (const f of fl) for (const d of [-1, 0, 1]) { const w = D.W.get(f.vi + '.' + (f.i + d)); if (w) schrift(w[3]); }
  const wortHTML = k => { const w = D.W.get(k); return w ? `<span style="font-family:qp${w[3]}">${glyphen(w[1], w[2])}</span>` : ''; };
  app.innerHTML = `<div class="marke">${P.name ? esc(P.name) : 'Dein Profil'}<small>dabei seit ${new Date(P.erstellt).toLocaleDateString('de-AT')} · ${P.zyklus.khatma} ${P.zyklus.khatma === 1 ? 'Ḫatma' : 'Ḫatmāt'} vollendet</small></div>
    <div class="zahlen" style="margin-top:18px"><div class="zahl"><b>${zahl(s.punkte)}</b><span>Itqān-Punkte</span></div><div class="zahl"><b>${zahl(s.hasanat)}</b><span>Ḥasanāt</span></div><div class="zahl"><b>${quote} %</b><span>Āyāt sicher</span></div>
      <div class="zahl"><b>${Z.ketteAktiv() ? P.kette.n : 0}</b><span>Kette jetzt</span></div><div class="zahl"><b>${P.kette.beste}</b><span>längste Kette</span></div><div class="zahl"><b>${s.abschnitte}</b><span>Abschnitte</span></div></div>
    <div class="titel-klein">Itqān-Punkte der letzten 30 Tage</div>
    <div class="diagramm">${tage.map(x => `<div class="${x.t?.punkte ? '' : 'leer'}" style="height:${x.t?.punkte ? Math.max(4, 100 * x.t.punkte / max) : 3}%" title="${x.d}: ${x.t?.punkte || 0}"></div>`).join('')}</div>
    <div class="klein-zeile"><span>vor 30 Tagen</span><span>heute</span></div>
    <div class="titel-klein">Wo du am meisten übst</div>
    ${schwach.length ? schwach.map(({ id, k }) => `<a class="karte" href="#ueben/${id}/frei" style="text-decoration:none;color:inherit"><div class="t"><b>${esc(D.A[id].titel)}</b><span>${abschnittName(D.A[id])} · ${k.fe} Fehler in ${k.n} Durchgängen${k.fae ? ' · kommt wieder' : ''}</span></div>${stufePunkte(k.st)}</a>`).join('') : '<p class="leer">Noch keine Daten. Nach den ersten Tagen siehst du hier deine schwächsten Abschnitte.</p>'}
    <div class="titel-klein">Deine Fehlerstellen</div>
    ${fl.length ? fl.map(f => {
      const w = D.W.get(f.s); if (!w) return '';
      const arten = Object.entries(f.t).sort((a, b) => b[1] - a[1]).map(([x]) => Z.FEHLERARTEN.find(y => y[0] === x)?.[1]).filter(Boolean).join(', ');
      return `<div class="karte fstelle"><a class="wortbild" href="#mushaf/${w[0]}" aria-label="Im Muṣḥaf zeigen"><span class="nb">${wortHTML(f.vi + '.' + (f.i - 1))}</span>${wortHTML(f.s)}<span class="nb">${wortHTML(f.vi + '.' + (f.i + 1))}</span></a>
        <div class="t"><b>${sureName(D.V[f.vi][0])} ${D.V[f.vi][0]}:${D.V[f.vi][1]}</b><span>${f.n}× vertan${arten ? ' · ' + arten : ''}</span></div><button class="textlink" data-fweg="${f.s}">sitzt jetzt</button></div>`;
    }).join('') : '<p class="leer">Wenn du nach „Fehler“ auf das Wort tippst, bei dem du dich vertan hast, sammelt Itqān diese Stellen hier.</p>'}
    <div class="titel-klein">Ornamente und Meilensteine</div>
    ${orn.length || ketten.length ? `<p>${[...ketten, ...orn].map(x => `<span class="pille" style="margin:0 6px 6px 0">✦ ${x}</span>`).join('')}</p>` : '<p class="leer">Dein erstes Ornament bekommst du, wenn eine ganze Sūra gefestigt ist.</p>'}
    <div class="titel-klein">Sicherung</div>
    <p class="unter">Es gibt keinen Server: Deine Fortschritte liegen nur auf diesem Gerät. Sichere sie regelmäßig als Datei.${P.einst.letzteSicherung ? ` Letzte Sicherung: ${new Date(P.einst.letzteSicherung).toLocaleDateString('de-AT')}.` : ''}</p>
    <div class="reihe" style="margin-top:10px"><button class="knopf haupt klein" id="sichern">Profil sichern</button><button class="knopf leise klein" id="laden">Profil laden</button></div>
    <div style="display:grid;gap:10px;margin-top:22px"><a class="knopf leise" href="#einstellungen" style="text-decoration:none">Einstellungen</a><a class="knopf leise" href="#lehrer" style="text-decoration:none">Lehreransicht</a></div>`;
  app.querySelectorAll('[data-fweg]').forEach(b => b.onclick = () => { Z.fehlerstelleLoeschen(b.dataset.fweg); toast('Alḥamdu li-llāh.'); profil(); });
  app.querySelector('#sichern').onclick = async () => {
    const name = `Itqan-${(P.name || 'Profil').replace(/[^\p{L}\p{N}]+/gu, '_')}-${Z.heute()}.itqan`;
    herunterladen(name, await Z.exportDatei(), 'application/json');
    P.einst.letzteSicherung = new Date().toISOString(); Z.speichern(); toast('Profil gesichert.'); profil();
  };
  app.querySelector('#laden').onclick = async () => {
    const [text] = await dateiWaehlen(); if (!text) return;
    try {
      const { profil: neu, echt } = await Z.importDatei(text);
      if (!confirm(`Profil „${neu.name || 'ohne Namen'}“ laden? Dein aktueller Stand auf diesem Gerät wird ersetzt.${echt ? '' : '\n\nAchtung: Die Datei wurde nach dem Sichern verändert.'}`)) return;
      Z.ersetzeProfil(neu); themaAnwenden(); toast('Profil geladen.'); location.hash = '#heute';
    } catch (e) { toast('Das ist keine gültige Itqān-Profildatei.'); }
  };
}

// ---------- Einstellungen ----------
const TAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
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
    <div class="abschnitt"><h3>Name</h3><div class="feld"><input type="text" id="name" value="${esc(P.name)}"></div></div>
    <div class="abschnitt"><h3>Erscheinungsbild</h3><div class="wahl" id="thema">${[['hell', 'Hell'], ['dunkel', 'Dunkel'], ['auto', 'Wie Gerät']].map(([w, l]) => `<button data-w="${w}" class="${E.thema === w ? 'an' : ''}">${l}</button>`).join('')}</div></div>
    <div class="abschnitt"><h3>Schriftbild des Muṣḥaf</h3><p class="unter">Seiten und Zeilen bleiben immer wie im Druck 1405. Wählbar ist die Schrift.</p>
      <div class="wahl" id="ausgabe" style="margin-top:10px">${[['misch', 'Schrift 1421'], ['v1', 'Schrift 1405']].map(([w, l]) => `<button data-w="${w}" class="${(E.ausgabe || 'misch') === w ? 'an' : ''}">${l}</button>`).join('')}</div></div>
    <div class="abschnitt"><h3>Abschnitte pro Tag</h3><p class="unter">Für alle Tage gleich oder pro Wochentag.</p>
      <label class="auswahl stark"><span>Alle Tage</span><select id="alle">${gleich() ? '' : '<option value="" selected>verschieden</option>'}${optionen(bis(Math.max(...E.pensum)), gleich() ? E.pensum[0] : null)}</select></label>
      <div class="tagesliste">${TAGE.map((w, i) => `<label class="auswahl"><span>${w}</span><select data-i="${i}">${optionen(bis(E.pensum[i]), E.pensum[i])}</select></label>`).join('')}</div>
      <p class="unter" style="margin-top:10px" id="dauer">Eine Ḫatma dauert damit etwa ${Z.tageProKhatma()} Tage.</p></div>
    <div class="abschnitt"><h3>Reihenfolge</h3><div class="wahl" id="reihenfolge">${[['vorwaerts', 'Ab al-Fātiḥah'], ['rueckwaerts', 'Ab an-Nās'], ['zufall', 'Zufällig']].map(([w, l]) => `<button data-w="${w}" class="${E.reihenfolge === w ? 'an' : ''}">${l}</button>`).join('')}</div>
      <div id="zufallwahl" class="${E.reihenfolge === 'zufall' ? '' : 'verdeckt'}" style="margin-top:12px"><p class="unter">Bei mehreren Abschnitten am Tag:</p>
        <div class="wahl" id="zufall" style="margin-top:8px">${[['einzeln', 'Verstreute Stellen'], ['block', 'Eine Stelle am Stück']].map(([w, l]) => `<button data-w="${w}" class="${E.zufall === w ? 'an' : ''}">${l}</button>`).join('')}</div>
        <p class="unter" style="margin-top:8px">Jede Ḫatma bleibt vollständig: Zufällig gewählt wird nur unter den Abschnitten, die in dieser Runde noch offen sind. Zu Beginn siehst du die Āya davor.</p></div></div>
    <div class="abschnitt"><h3>Was du wiederholst</h3><div class="juzwahl" id="juz">${Array.from({ length: 30 }, (_, i) => `<button data-j="${i + 1}" class="${juzAn.has(i + 1) ? 'an' : ''}">${i + 1}</button>`).join('')}</div></div>
    <div class="abschnitt"><h3>Erst ansehen, dann prüfen</h3><p class="unter">Vor der ersten Āya kannst du den Abschnitt offen lesen und dich danach prüfen.</p>
      <div class="wahl" id="vorueben" style="margin-top:10px"><button data-w="1" class="${E.vorueben ? 'an' : ''}">Anbieten</button><button data-w="0" class="${E.vorueben ? '' : 'an'}">Aus</button></div></div>
    <div class="abschnitt"><h3>Hilfe beim Aufdecken</h3><p class="unter">„Anfang zeigen“ deckt das erste Wort einer Āya auf. Die Āya zählt dann als halb sicher.</p>
      <div class="wahl" id="hilfe" style="margin-top:10px"><button data-w="1" class="${E.hilfe ? 'an' : ''}">Erlaubt</button><button data-w="0" class="${E.hilfe ? '' : 'an'}">Aus</button></div></div>
    <div class="abschnitt"><h3>Tägliche Erinnerung</h3><p class="unter">Ohne Server kann die App selbst keine Benachrichtigung schicken. Deshalb trägt sie dein Wird als täglichen Termin mit Erinnerung in deinen Kalender ein.</p>
      <div class="zeitwahl"><select id="std" aria-label="Stunde">${optionen(Array.from({ length: 24 }, (_, i) => i), hh, zwei)}</select><b>:</b><select id="min" aria-label="Minute">${optionen(minuten, mm, zwei)}</select><span>Uhr</span></div>
      <button class="knopf leise" id="ics">In den Kalender eintragen</button></div>
    <div class="abschnitt"><h3>Offline</h3><p class="unter">Lädt alle 604 Seiten (etwa 48 MB), damit Itqān auch ohne Internet jede Seite zeigt.</p><button class="knopf leise" id="offline" style="margin-top:10px">Alle Seiten speichern</button></div>
    <div class="abschnitt"><h3>Neu beginnen</h3><p class="unter">Löscht dein Profil auf diesem Gerät. Sichere es vorher.</p><button class="knopf schlecht" id="reset" style="margin-top:10px">Profil löschen</button></div>`;
  const dauer = () => app.querySelector('#dauer').textContent = `Eine Ḫatma dauert damit etwa ${Z.tageProKhatma()} Tage.`;
  app.querySelector('#name').onchange = ev => { P.name = ev.target.value.trim(); Z.speichern(); toast('Gespeichert.'); };
  const wahl = (id, fn) => app.querySelector('#' + id).onclick = ev => { const w = ev.target.dataset.w; if (w == null) return; app.querySelectorAll(`#${id} button`).forEach(b => b.classList.toggle('an', b.dataset.w === w)); fn(w); Z.speichern(); };
  wahl('thema', w => { E.thema = w; themaAnwenden(); });
  wahl('reihenfolge', w => { E.reihenfolge = w; app.querySelector('#zufallwahl').classList.toggle('verdeckt', w !== 'zufall'); dauer(); toast('Gilt ab dem nächsten Tagesplan.'); });
  wahl('zufall', w => { E.zufall = w; toast('Gilt ab dem nächsten Tagesplan.'); });
  wahl('vorueben', w => { E.vorueben = w === '1'; });
  wahl('ausgabe', w => { if (w === E.ausgabe) return; E.ausgabe = w; Z.speichern(); location.reload(); });
  wahl('hilfe', w => { E.hilfe = w === '1'; });
  const alle = app.querySelector('#alle'), tage = [...app.querySelectorAll('.tagesliste select')];
  alle.onchange = () => {
    const n = +alle.value; if (!n) return;
    E.pensum = Array(7).fill(n); tage.forEach(x => x.value = String(n));
    alle.querySelector('option[value=""]')?.remove(); Z.speichern(); dauer();
  };
  tage.forEach(x => x.onchange = () => {
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
  app.querySelector('#offline').onclick = async ev => {
    const b = ev.target; b.disabled = true; let n = 0;
    const cache = 'caches' in window ? await caches.open('itqan-seiten-v1') : null;
    for (let p = 1; p <= 604; p += 8) {
      await Promise.all(Array.from({ length: 8 }, (_, k) => p + k).filter(x => x <= 604).map(async x => {
        const url = `schriften/${D.ausgabe === 'v1' ? 'v1' : 'v2'}/p${x}.woff2`;
        try { if (cache && !(await cache.match(url))) await cache.add(url); } catch (e) {}
        n++;
      }));
      b.textContent = `${n} von 604 …`;
    }
    b.textContent = 'Alle Seiten gespeichert';
  };
  app.querySelector('#reset').onclick = () => { if (confirm('Profil wirklich löschen? Das lässt sich nicht rückgängig machen, außer mit einer gesicherten Datei.')) { Z.loeschen(); location.hash = '#start'; } };
}

// ---------- Lehreransicht ----------
function schuelerLaden() { try { return JSON.parse(localStorage.getItem('itqan-schueler') || '[]'); } catch (e) { return []; } }
function schuelerSpeichern(l) { try { localStorage.setItem('itqan-schueler', JSON.stringify(l)); } catch (e) { toast('Speicher voll.'); } }
function lehrer() {
  navSetzen('profil');
  const liste = schuelerLaden();
  const karten = liste.map((x, i) => Z.mitProfil(x.profil, () => {
    const s = x.profil.summe, q = s.r + s.f + s.h ? Math.round(100 * (s.r + s.h * .5) / (s.r + s.f + s.h)) : 0;
    const kf = Z.khatmaFortschritt(), schwach = Z.schwaechste(3);
    const juz = Array.from({ length: 30 }, (_, j) => {
      const seiten = Array.from({ length: (j < 29 ? juzStart(j + 2) : 605) - juzStart(j + 1) }, (_, k) => juzStart(j + 1) + k);
      const w = seiten.map(Z.seitenStufe).filter(v => v != null);
      return w.length ? (0.12 + 0.88 * (w.reduce((a, b) => a + b, 0) / w.length) / 4.6).toFixed(2) : null;
    });
    return `<div class="abschnitt"><div class="kopfzeile"><h3>${esc(x.profil.name || 'ohne Namen')}</h3><button class="textlink" data-weg="${i}">entfernen</button></div>
      <p class="unter">Stand ${new Date(x.exportiert).toLocaleDateString('de-AT')} · ${Object.keys(x.profil.fstellen || {}).length} markierte Fehlerstellen${x.echt ? '' : ' · <b style="color:var(--schlecht)">Datei wurde verändert</b>'}</p>
      <div class="zahlen"><div class="zahl"><b>${x.profil.kette.n}</b><span>Kette</span></div><div class="zahl"><b>${q} %</b><span>Āyāt sicher</span></div><div class="zahl"><b>${Math.floor(kf.anteil * 100)} %</b><span>${x.profil.zyklus.khatma + 1}. Ḫatma</span></div></div>
      <div class="licht-seiten" style="grid-template-columns:repeat(30,1fr);gap:2px">${juz.map(o => `<button class="${o == null ? 'aus' : ''}" style="aspect-ratio:1/2;${o ? 'opacity:' + o : ''}"></button>`).join('')}</div>
      <p class="unter" style="margin-top:10px">${schwach.length ? 'Schwach: ' + schwach.map(({ id }) => `${abschnittName(D.A[id])} (${esc(D.A[id].titel)})`).join(' · ') : 'Noch keine Wiederholungen.'}</p></div>`;
  })).join('');
  app.innerHTML = `<button class="zurueck" onclick="location.hash='#profil'"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 5l-7 7 7 7"/></svg>Profil</button>
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
  try { await ladeDaten(Z.P?.einst.ausgabe || 'misch'); }
  catch (e) { app.innerHTML = '<div class="lade">Die Daten konnten nicht geladen werden. Bitte mit Internet erneut öffnen.</div>'; return; }
  zeige();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  // Tageswechsel, wenn die App über Nacht offen bleibt
  let tag = Z.heute();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Z.heute() !== tag) { tag = Z.heute(); if ((location.hash || '#heute') === '#heute') zeige(); } });
})();
