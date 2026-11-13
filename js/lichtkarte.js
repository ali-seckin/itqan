// Itqān · Lichtkarte: Modell (Seiten und Abschnitte mit Stand, Frische und Tagesplan) und Darstellung
// Drei Ansichten: Stand (wie fest es sitzt), Frische (wie frisch es im Gedächtnis ist), Heute (der Tag auf der Karte).
// Eine Seite zeigt immer ihren schwächsten Abschnitt; die beste Stelle erscheint als Ecke.
import { tx } from './sprache.js';
import { D, sureName, abschnittName, bereichText, esc, juzStart, juzVonVers } from './daten.js';
import * as Z from './zustand.js';
import * as AF from './abfragen.js';

// Die klassischen Namen der Aǧzāʾ nach ihren ersten Worten
const JUZ_NAMEN = ['Alif Lām Mīm', 'Sayaqūl', 'Tilka r-Rusul', 'Lan tanālū', 'Wa l-muḥṣanāt', 'Lā yuḥibbu llāh', 'Wa iḏā samiʿū', 'Wa law annanā', 'Qāla l-malaʾ', 'Wa ʿlamū',
  'Yaʿtaḏirūn', 'Wa mā min dābba', 'Wa mā ubarriʾu', 'Rubamā', 'Subḥāna llaḏī', 'Qāla alam', 'Iqtaraba', 'Qad aflaḥa', 'Wa qāla llaḏīna', 'Amman ḫalaqa',
  'Utlu mā ūḥiya', 'Wa man yaqnut', 'Wa mā liya', 'Fa-man aẓlamu', 'Ilayhi yuraddu', 'Ḥā Mīm', 'Qāla fa-mā ḫaṭbukum', 'Qad samiʿa llāh', 'Tabāraka llaḏī', 'ʿAmma'];

// ---------- Modell ----------
const seiteVon = vi => D.W?.get(vi + '.0')?.[0] || D.V[vi][3];
let cache = null;
function index() {
  if (cache && cache.A === D.A && cache.V === D.V) return cache;
  const s = Array.from({ length: 606 }, () => []);
  for (const e of D.A) for (const p of e.seiten) s[p].push(e.id);
  const start = {};   // Seite -> Sūren, die dort beginnen
  for (let vi = 0; vi < D.V.length; vi++) if (D.V[vi][1] === 1) (start[seiteVon(vi)] ??= []).push(D.V[vi][0]);
  cache = { A: D.A, V: D.V, s, start };
  return cache;
}
// 0 ungeprüft, 1 im Aufbau, 2 gefestigt, 3 sicher, 4 mutqan
export const katVon = k => !k.n ? 0 : k.st <= 1 ? 1 : k.st;
// Frische aus der geschätzten Abrufwahrscheinlichkeit: 1 fällig, 2 bald fällig, 3 stabil, 4 frisch
const frischVon = (R, ziel) => R < ziel ? 1 : R < ziel + (1 - ziel) * 0.4 ? 2 : R < ziel + (1 - ziel) * 0.8 ? 3 : 4;
const faelligIn = (k, ziel, d) => {   // Tage bis zur Fälligkeit (<= 0: jetzt)
  if (k.fae && k.fae <= d) return 0;
  return Math.ceil(9 * Z.stabilitaet(k) * (1 / ziel - 1) - Z.tageZwischen(k.zul || d, d));
};

export function modell() {
  const idx = index(), d = Z.heute(), ziel = (Z.P.einst.zielQuote ?? 95) / 100;
  const t = Z.P.tage[d], plan = new Set(t && !t.ruhe ? t.plan : []), fertig = new Set(t?.fertig || []);
  const fSeiten = new Set();
  for (const k of Object.keys(Z.P.fstellen || {})) fSeiten.add(D.W?.get(k)?.[0] ?? seiteVon(+k.split('.')[0]));
  const ab = {};   // je Abschnitt: k Stand, f Frische, h Tag, w diese Woche geübt, fa fällig
  for (const e of D.A) {
    const k = Z.karte(e.id), kk = katVon(k);
    let f = 0, fa = false, w = false;
    if (k.n) {
      const R = Z.abruf(Z.tageZwischen(k.zul || d, d), Z.stabilitaet(k));
      fa = R < ziel || !!(k.fae && k.fae <= d);
      f = fa || (plan.has(e.id) && !fertig.has(e.id)) ? 1 : frischVon(R, ziel);   // 1: jetzt dran (fällig oder auf dem Plan von heute)
      w = !!k.zul && Z.tageZwischen(k.zul, d) <= 6;
    }
    ab[e.id] = { k: kk, f, w, fa };
  }
  const seiten = new Array(605).fill(null);
  for (let p = 1; p <= 604; p++) {
    const ids = idx.s[p].filter(id => Z.imBereich(id));
    if (!ids.length) { seiten[p] = { p, aus: true }; continue; }
    const a = ids.map(id => ab[id]);
    seiten[p] = {
      p, ids, k: Math.min(...a.map(x => x.k)), b: Math.max(...a.map(x => x.k)), f: Math.min(...a.map(x => x.f)),
      fa: a.some(x => x.fa), w: a.some(x => x.w), fehler: fSeiten.has(p), su: idx.start[p] || null
    };
  }
  return { seiten, ab, ziel, d };
}
// Mittlerer Stand je Ǧuzʾ für die kleine Karte auf „Heute“ (null: nichts gewählt)
export function juzMittel() {
  const m = modell();
  return Array.from({ length: 30 }, (_, i) => {
    const von = juzStart(i + 1), bis = i < 29 ? juzStart(i + 2) - 1 : 604;
    const w = []; for (let p = von; p <= bis; p++) if (!m.seiten[p].aus) w.push(m.seiten[p].k);
    return w.length ? w.reduce((a, b) => a + b, 0) / w.length : null;
  });
}

const katName = k => k === 0 ? tx('lichtkarte.k_ungeprueft') : Z.STUFEN[k];
const ANSICHTEN = {
  stand: { wert: s => s.k, kats: () => [[0, tx('lichtkarte.k_ungeprueft')], [1, Z.STUFEN[1]], [2, Z.STUFEN[2]], [3, Z.STUFEN[3]], [4, Z.STUFEN[4]]], hinweis: () => tx('lichtkarte.hinweis_stand') }
};
// Balken mit vielen Abschnitten (al-Baqarah) auf höchstens max Teile verdichten: der schwächste Wert je Gruppe zählt
const kompakt = (werte, max = 24) => {
  if (werte.length <= max) return werte;
  const g = Math.ceil(werte.length / max), aus = [];
  for (let i = 0; i < werte.length; i += g) aus.push(Math.min(...werte.slice(i, i + g)));
  return aus;
};
const INFO_STAND = () => [tx('lichtkarte.info_ungeprueft'), tx('lichtkarte.info_aufbau'), tx('lichtkarte.info_gefestigt'), tx('lichtkarte.info_sicher'), tx('lichtkarte.info_mutqan')];

let merk = { ansicht: 'stand', gruppe: 'guz' };   // bleibt, solange die App offen ist

// ---------- Seitenblatt (Bottom Sheet) ----------
function blatt({ titel, unter, koerper, aktionen }) {
  const wurzel = document.createElement('div'); wurzel.className = 'lk-blatt-wrap';
  wurzel.innerHTML = `<div class="lk-schleier"></div><section class="lk-blatt" role="dialog" aria-modal="true" aria-label="${esc(titel)}">
    <i class="lk-griff" aria-hidden="true"></i>
    <button type="button" class="lk-zu" aria-label="${tx('lichtkarte.zu')}">&times;</button>
    <div class="lk-kopf"><b>${esc(titel)}</b>${unter ? `<span>${unter}</span>` : ''}</div>
    <div class="lk-koerper">${koerper}</div>
    <div class="lk-aktionen">${aktionen}</div></section>`;
  const vorher = document.activeElement;
  const zu = () => {
    removeEventListener('keydown', taste, true); wurzel.classList.remove('auf');
    setTimeout(() => wurzel.remove(), 280); if (vorher?.isConnected) vorher.focus({ preventScroll: true });
  };
  const taste = ev => { if (ev.key === 'Escape') { ev.stopPropagation(); zu(); } };
  wurzel.querySelector('.lk-schleier').onclick = zu; wurzel.querySelector('.lk-zu').onclick = zu;
  wurzel.addEventListener('click', ev => { if (ev.target.closest('a[href]')) { removeEventListener('keydown', taste, true); wurzel.remove(); } });
  addEventListener('keydown', taste, true);
  document.body.appendChild(wurzel);
  requestAnimationFrame(() => { wurzel.classList.add('auf'); wurzel.querySelector('.lk-zu').focus({ preventScroll: true }); });
  return zu;
}

function abschnittsZeile(e, m) {
  const k = Z.karte(e.id), a = m.ab[e.id];
  const name = e.nr ? `${esc(sureName(e.von[0]))} <span class="lk-nr">${e.nr}</span>` : esc(abschnittName(e));
  const teile = [katName(a.k)];
  if (k.n) {
    teile.push(tx('lichtkarte.zuletzt', { n: Z.tageZwischen(k.zul || m.d, m.d) }));
    const r = faelligIn(k, m.ziel, m.d); teile.push(r <= 0 ? tx('lichtkarte.faellig_jetzt') : tx('lichtkarte.faellig_in', { n: r }));
  } else teile.push(tx('lichtkarte.nie'));
  return `<div class="lk-ab"><i class="lk-punkt" data-k="${a.k}"></i><div class="t"><b>${name}:</b><span class="lk-titel">${esc(e.titel)}</span><small>${bereichText(e)}</small><small>${teile.join(' · ')}</small></div>
    <a class="knopf leise klein" href="#ueben/${e.id}/frei" style="text-decoration:none">${tx('lichtkarte.frei_ueben')}</a></div>`;
}
const knopf = (href, text, haupt) => `<a class="knopf ${haupt ? 'haupt' : 'leise'} klein" href="${href}" style="text-decoration:none">${text}</a>`;

function seitenBlatt(p, m) {
  const s = m.seiten[p], vis = new Set();
  for (const z of D.L[p - 1]) if (z?.w) for (const w of z.w) vis.add(w[1]);
  const lo = Math.min(...vis), hi = Math.max(...vis), ja = juzVonVers(lo), jb = juzVonVers(hi);
  const su = D.V[lo][0], sb = D.V[hi][0];
  const unter = `${esc(sureName(su))}${sb !== su ? ` · ${esc(sureName(sb))}` : ''} · ${ja !== jb ? tx('lichtkarte.guz_und', { a: ja, b: jb }) : tx('lichtkarte.guz_2', { juzVonSeite: ja })} · ${tx('lichtkarte.seite_3', { a: p % 2 ? tx('allg.rechte') : tx('allg.linke') })}`;
  const zeilen = s.aus ? `<p class="unter">${tx('lichtkarte.diese_seite_gehoert_nicht_zu_deinem')}</p>` : s.ids.map(id => abschnittsZeile(D.A[id], m)).join('');
  const pruefen = s.aus ? null : AF.seitenAufgabe(p);
  blatt({
    titel: tx('lichtkarte.seite', { p }), unter, koerper: zeilen,
    aktionen: `${pruefen ? knopf(pruefen, tx('lichtkarte.jetzt_pruefen'), true) : ''}${knopf(`#mushaf/${p}`, tx('lichtkarte.zur_seite', { p }), !pruefen)}${s.fehler ? knopf('#fehlerstellen', tx('lichtkarte.fehlerstellen_ansehen')) : ''}`
  });
}
function juzBlatt(j, m) {
  const von = juzStart(j), bis = j < 30 ? juzStart(j + 1) - 1 : 604;
  let n = 0, gut = 0; for (let p = von; p <= bis; p++) { const s = m.seiten[p]; if (!s.aus) { n++; if (s.k >= 2) gut++; } }
  const ids = new Set(); for (let p = von; p <= bis; p++) for (const id of m.seiten[p].ids || []) ids.add(id);
  const pruefen = AF.juzAufgabe(j);
  blatt({
    titel: tx('allg.guz_nr', { j }), unter: `${JUZ_NAMEN[j - 1]}`,
    koerper: `<p class="lk-zahl">${n ? tx('lichtkarte.guz_stand', { a: gut, b: n }) : tx('lichtkarte.diese_seite_gehoert_nicht_zu_deinem')}</p>${karteBalken(kompakt([...ids].map(id => m.ab[id].k), 30))}`,
    aktionen: `${pruefen ? knopf(pruefen, tx('lichtkarte.guz_abfrage'), true) : ''}${knopf(`#mushaf/${von}`, tx('lichtkarte.zum_anfang'), !pruefen)}`
  });
}
function sureBlatt(s, m) {
  const ab = D.A.filter(e => e.von[0] <= s && e.bis[0] >= s && Z.imBereich(e.id));
  const gut = ab.filter(e => m.ab[e.id].k >= 2).length;
  const vi = D.V.findIndex(v => v[0] === s);
  blatt({
    titel: `${s}. ${sureName(s)}`, unter: ab.length ? tx('lichtkarte.sure_stand', { a: gut, b: ab.length }) : '',
    koerper: ab.length ? ab.map(e => abschnittsZeile(e, m)).join('') : `<p class="unter">${tx('lichtkarte.diese_seite_gehoert_nicht_zu_deinem')}</p>`,
    aktionen: knopf(`#mushaf/${AF.seiteVonAya(vi)}`, tx('lichtkarte.zur_seite', { p: AF.seiteVonAya(vi) }), true)
  });
}
const karteBalken = ks => `<div class="lk-balken" aria-hidden="true">${ks.map(k => `<i data-k="${k}"></i>`).join('')}</div>`;

// ---------- Seite ----------
export function zeichne(app, K) {
  let m = modell();
  const pct = x => Math.round(100 * x) + '%';
  const imBer = m.seiten.filter(s => s && !s.aus), nBer = imBer.length;
  const gef = imBer.filter(s => s.k >= 2).length, licht = imBer.filter(s => s.k >= 1).length;
  const wochen = imBer.filter(s => s.w).length, blass = imBer.filter(s => s.fa || (s.f >= 1 && s.f <= 2)).length;
  const share = nBer ? gef / nBer : 0, C = 2 * Math.PI * 46;
  const zellen = s => {
    if (s.aus) return `<button type="button" class="lk-z aus" data-p="${s.p}" aria-label="${tx('lichtkarte.seite_2', { p: s.p, a: tx('lichtkarte.nicht_gewaehlt') })}"></button>`;
    return `<button type="button" class="lk-z" data-p="${s.p}"${s.su ? ' data-su="1"' : ''}${s.w ? ' data-w="1"' : ''}><span class="lk-m"><i class="lk-d"></i><i class="lk-e"></i></span></button>`;
  };
  const juzZeilen = Array.from({ length: 30 }, (_, i) => {
    const j = i + 1, von = juzStart(j), bis = j < 30 ? juzStart(j + 1) - 1 : 604, ps = [];
    for (let p = von; p <= bis; p++) ps.push(m.seiten[p]);
    const oben = ps.length > 22 ? Math.floor(ps.length / 2) : 10;
    const inn = ps.filter(s => !s.aus), gut = inn.filter(s => s.k >= 2).length;
    return `<div class="lk-juz" style="--i:${i}"><button type="button" class="lk-jbtn" data-j="${j}" aria-label="${tx('allg.guz_nr', { j })}"><b>${j}</b></button>
      <div class="lk-reihen"><div class="licht-seiten lk-reihe">${ps.slice(0, oben).map(zellen).join('')}</div><div class="licht-seiten lk-reihe">${ps.slice(oben).map(zellen).join('')}</div></div>
      <span class="lk-anz">${inn.length ? pct(gut / inn.length) : ''}</span></div>`;
  }).join('');
  const sureAb = Array.from({ length: 115 }, () => []);
  for (const e of D.A) if (Z.imBereich(e.id)) for (let s = e.von[0]; s <= e.bis[0]; s++) sureAb[s].push(e.id);
  const sureZeilen = () => Array.from({ length: 114 }, (_, i) => {
    const s = i + 1, ids = sureAb[s], gut = ids.filter(id => m.ab[id].k >= 2).length;
    return `<button type="button" class="lk-sure${ids.length ? '' : ' aus'}" data-s="${s}" style="--i:${Math.min(i, 24)}"><span class="nr">${s}</span><span class="nm">${esc(sureName(s))}</span>
      <span class="lk-balken" aria-hidden="true">${kompakt(ids.map(id => ANSICHTEN[merk.ansicht].wert(m.ab[id]))).map(v => `<i data-k="${v}"></i>`).join('')}</span><span class="pr">${ids.length ? pct(gut / ids.length) : ''}</span></button>`;
  }).join('');

  app.innerHTML = `<div class="marke">${tx('allg.lichtkarte')}<small>${tx('lichtkarte.hero_start')}</small></div>
    <div class="lk-hero"><div class="lk-ring"><svg viewBox="0 0 110 110" aria-hidden="true"><defs><linearGradient id="lkv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--akzent)"/><stop offset="1" stop-color="var(--akzent2)"/></linearGradient></defs>
        <circle cx="55" cy="55" r="46" fill="none" stroke="var(--rand)" stroke-width="8"/><circle class="lk-fort" cx="55" cy="55" r="46" fill="none" stroke="url(#lkv)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}" transform="rotate(-90 55 55)"/></svg>
        <div class="lk-mitte"><b data-hoch="${Math.round(share * 100)}">${Math.round(share * 100)}</b><span>%</span></div></div>
      <div class="lk-hero-t"><p><b>${tx('lichtkarte.hero_prozent')}</b></p><p>${tx('lichtkarte.hero_licht', { a: licht, b: nBer })}</p><p>${tx('lichtkarte.hero_woche', { n: wochen })}</p>${blass ? `<p>${tx('lichtkarte.hero_blass', { n: blass })}</p>` : ''}</div></div>
    <p class="lk-hinweis" role="status"></p>
    <div class="lk-kacheln" role="group"></div>
    <div class="lk-info verdeckt" role="status"></div>
    <div class="lk-gruppe" role="tablist"><button type="button" role="tab" data-g="guz">${tx('lichtkarte.ansicht_guz')}</button><button type="button" role="tab" data-g="sure">${tx('lichtkarte.ansicht_sure')}</button></div>
    <div class="lk-karte lk-neu" id="licht" data-ansicht="stand"></div>
    <details class="lk-spring"><summary>${tx('lichtkarte.springen')}</summary>${K.stellenWahl()}</details>`;

  const wurzel = app.querySelector('#licht'), hinweis = app.querySelector('.lk-hinweis'), kacheln = app.querySelector('.lk-kacheln'), info = app.querySelector('.lk-info');
  let fokus = null;
  // Werte einer Ansicht auf die vorhandenen Zellen legen: die Farben gleiten ineinander
  const setzen = () => {
    const A = ANSICHTEN[merk.ansicht]; wurzel.dataset.ansicht = merk.ansicht;
    for (const z of wurzel.querySelectorAll('.lk-z[data-p]:not(.aus)')) {
      const s = m.seiten[+z.dataset.p], v = A.wert(s);
      z.dataset.k = v;
      if (merk.ansicht === 'stand' && s.b > s.k) z.dataset.b = s.b; else delete z.dataset.b;
      if (s.f === 1) z.dataset.d = '1'; else delete z.dataset.d;   // jetzt dran: fällig oder heute auf dem Plan
      if (s.fehler) z.dataset.e = '1'; else delete z.dataset.e;
      z.setAttribute('aria-label', tx('lichtkarte.seite_2', { p: s.p, a: A.kats().find(x => x[0] === v)?.[1] ?? katName(v) }));
    }
    hinweis.textContent = A.hinweis();
    const zaehl = {}; for (const s of m.seiten) if (s && !s.aus) { const v = A.wert(s); zaehl[v] = (zaehl[v] || 0) + 1; }
    const nDran = m.seiten.filter(x => x && !x.aus && x.f === 1).length;
    kacheln.innerHTML = A.kats().map(([k, name]) => `<button type="button" class="lk-kachel${fokus === k ? ' an' : ''}" data-k="${k}" aria-pressed="${fokus === k}"><i data-k="${k}"></i><b>${zaehl[k] || 0}</b><span>${name}</span></button>`).join('')
      + `<button type="button" class="lk-kachel lk-dran${fokus === 'd' ? ' an' : ''}" data-k="d" aria-pressed="${fokus === 'd'}"><i class="lk-puls"></i><b>${nDran}</b><span>${tx('lichtkarte.f_faellig')}</span></button>`;
    app.querySelectorAll('.lk-gruppe button').forEach(b => { const an = b.dataset.g === merk.gruppe; b.classList.toggle('an', an); b.setAttribute('aria-selected', an); });
    for (const b of wurzel.querySelectorAll('.lk-sure')) {
      const ids = sureAb[+b.dataset.s], bal = b.querySelectorAll('.lk-balken i'); kompakt(ids.map(id => A.wert(m.ab[id]))).forEach((v, i) => { if (bal[i]) bal[i].dataset.k = v; });
    }
    dimmen();
  };
  const dimmen = () => {
    const A = ANSICHTEN[merk.ansicht];
    for (const z of wurzel.querySelectorAll('.lk-z')) z.classList.toggle('lk-dim', fokus != null && (fokus === 'd' ? z.dataset.d !== '1' : z.dataset.k !== String(fokus)));
    for (const b of wurzel.querySelectorAll('.lk-sure')) { const ids = sureAb[+b.dataset.s]; b.classList.toggle('lk-dim', fokus != null && !ids.some(id => fokus === 'd' ? m.ab[id].f === 1 : A.wert(m.ab[id]) === fokus)); }
    kacheln.querySelectorAll('.lk-kachel').forEach(b => { const an = String(fokus) === b.dataset.k; b.classList.toggle('an', an); b.setAttribute('aria-pressed', an); });
    const zeigen = fokus != null;
    info.classList.toggle('verdeckt', !zeigen);
    if (zeigen) info.innerHTML = fokus === 'd' ? `<b>${tx('lichtkarte.f_faellig')}</b><p>${tx('lichtkarte.info_dran')}</p>` : `<b>${katName(fokus)}</b><p>${INFO_STAND()[fokus]}</p>`;
  };
  const baueKarte = () => {
    wurzel.innerHTML = merk.gruppe === 'guz' ? juzZeilen : `<div class="lk-sureliste">${sureZeilen()}</div>`;
    wurzel.dataset.gruppe = merk.gruppe; setzen();
  };
  baueKarte();

  app.querySelector('.lk-gruppe').onclick = ev => { const b = ev.target.closest('button[data-g]'); if (!b || b.dataset.g === merk.gruppe) return; merk.gruppe = b.dataset.g; wurzel.classList.remove('lk-neu'); baueKarte(); };
  kacheln.onclick = ev => { const b = ev.target.closest('.lk-kachel'); if (!b) return; const k = b.dataset.k === 'd' ? 'd' : +b.dataset.k; fokus = fokus === k ? null : k; dimmen(); };
  wurzel.onclick = ev => {
    const z = ev.target.closest('.lk-z[data-p]'), j = ev.target.closest('.lk-jbtn'), s = ev.target.closest('.lk-sure[data-s]');
    if (z) { m = modell(); seitenBlatt(+z.dataset.p, m); } else if (j) { m = modell(); juzBlatt(+j.dataset.j, m); } else if (s) { m = modell(); sureBlatt(+s.dataset.s, m); }
  };
  K.stellenWahlBinden();
  // Ring füllt sich, Zahlen zählen hoch, nach dem ersten Aufbau endet das Aufleuchten
  requestAnimationFrame(() => setTimeout(() => app.querySelector('.lk-fort')?.setAttribute('stroke-dashoffset', C * (1 - share)), 80));
  K.hochzaehlen(app);
  setTimeout(() => wurzel.isConnected && wurzel.classList.remove('lk-neu'), 2600);
}
