// Itqān · Darstellung der Muṣḥaf-Seiten (Druck 1405, KFGQPC-Seitenschriften)
import { D, sureArabisch, arZahl, schriftSeiten } from './daten.js';
import { textLaden } from './suche.js';
import { tx } from './sprache.js';

const geladen = new Map(), da = new Set();   // da: Seiten, deren Schrift angemeldet ist
// Fehlt eine Seitenschrift (ohne Netz und noch nicht gespeichert), steht der Text in der einfachen Uthmani-Schrift:
// gleiche Zeilen, gleiche Wörter, nur ein anderes Schriftbild. U: Wörter je Āya aus daten/text.json
let U = null;
const textHolen = () => U ? Promise.resolve() : textLaden().then(t => { U = t.u; }).catch(() => {});
const fehlt = fp => !da.has(fp) && !!U;
export function textSetzen(u) { U = u; }   // für Tests
let anfaenge = null;   // erste Āya jedes Abschnitts
const KOPF = 'سُورَةُ', BASMALA = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ';
export function schrift(p) {
  if (!geladen.has(p)) {
    // erst die Datei holen (über den Service Worker auch offline), dann als Schrift anmelden
    // mit Zeitlimit und einem zweiten Versuch, damit eine hängende Verbindung die Seite nicht blockiert
    const url = `schriften/${D.ausgabe === 'v1' ? 'v1' : 'v2'}/p${p}.woff2`;
    const holen = () => { const c = new AbortController(), t = setTimeout(() => c.abort(), 12000);
      return fetch(url, { signal: c.signal }).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).finally(() => clearTimeout(t)); };
    geladen.set(p, holen().catch(holen)
      .then(b => new FontFace('qp' + p, b).load()).then(x => { document.fonts.add(x); da.add(p); return true; })
      .catch(() => { geladen.delete(p); return textHolen().then(() => false); }));
  }
  return geladen.get(p);
}
export const schriftenLaden = seiten => Promise.all([...new Set(seiten.flatMap(schriftSeiten))].map(schrift));
// Zeilen, die breiter als die Seite sind, passend verkleinern (Sicherheitsnetz, bei den Originaldrucken selten nötig)
export function zeilenEinpassen(el) {
  for (const z of el.querySelectorAll('.mz')) {
    if (!z.querySelector('.w')) continue;
    z.style.fontSize = '';
    if (z.scrollWidth > z.clientWidth + 1) z.style.fontSize = `calc(5.9cqw * ${(z.clientWidth / z.scrollWidth - 0.004).toFixed(3)})`;
  }
}

// Abschnittsgrenzen als feine gestrichelte Stufenlinie: über dem Beginn des neuen Abschnitts,
// senkrecht am Übergang und unter dem Ende des vorigen. Positionen in % der Zeilenbreite, damit sie mitskalieren.
export function grenzenZeichnen(el) {
  el.querySelectorAll('.gz').forEach(x => x.remove());
  for (const w of el.querySelectorAll('.w.ab')) {
    const z = w.parentElement, L = z.getBoundingClientRect(), vor = w.previousElementSibling;
    const pct = x => (100 * (x - L.left) / L.width).toFixed(2) + '%';
    const linie = (stil) => { const i = document.createElement('i'); i.className = 'gz'; i.setAttribute('style', stil); z.appendChild(i); };
    if (!vor) {   // Abschnitt beginnt am Zeilenanfang: Linie über die ganze Zeile, außer nach Kopf, Basmala oder am Seitenanfang
      const davor = z.previousElementSibling;
      if (davor && davor.querySelector('.w')) linie('left:0;right:0;top:0;border-top-width:1.5px');
      continue;
    }
    const W = w.getBoundingClientRect(), V = vor.getBoundingClientRect(), bx = (W.right + V.left) / 2;
    linie(`left:0;width:${pct(bx)};top:0;border-top-width:1.5px`);
    linie(`left:${pct(bx)};top:0;bottom:0;border-left-width:1.5px`);
    linie(`left:${pct(bx)};right:0;bottom:0;border-bottom-width:1.5px`);
  }
}

// Glyphen eines Worteintrags nach Typ gruppieren: w Wort, q Stoppzeichen, n Lā, o Ornament
const KL = { w: 'wt', q: 'wq', n: 'wq la', o: 'wo' };
export function glyphen(c, ty) {
  if (!ty) return c;
  let aus = '', i = 0;
  while (i < c.length) {
    if (ty[i] === ' ') { aus += ' '; i++; continue; }
    let j = i; while (j < c.length && ty[j] === ty[i]) j++;
    aus += `<span class="${KL[ty[i]]}">${c.slice(i, j)}</span>`; i = j;
  }
  return aus;
}
// Ein Wort in einfacher Schrift. Das letzte Stück jeder Āya ist ihr Endzeichen mit der Nummer.
// Stoppzeichen stehen im Text schon am Wort; leere Marken halten die Teilung an den Stoppzeichen wie in der Muṣḥaf-Schrift.
export function ersatz(vi, i, ty) {
  const w = U?.[vi]; if (!w) return '';
  const marken = ty ? [...ty].filter(x => x === 'q' || x === 'n').map(x => `<span class="${KL[x]}"></span>`).join('') : '';
  return (i < w.length ? w[i] : arZahl(D.V[vi][1])) + marken;
}
// Ein einzelnes Wort außerhalb der Seite (Kontextzeile, Fehlerstellen)
export function wortHTML(vi, i) {
  const w = D.W.get(vi + '.' + i); if (!w) return '';
  const a = `data-v="${vi}" data-i="${i}" data-fp="${w[3]}"`;
  return fehlt(w[3]) ? `<span class="ers" ${a}>${ersatz(vi, i, w[2])}</span>` : `<span ${a} style="font-family:qp${w[3]}">${glyphen(w[1], w[2])}</span>`;
}
// Nachziehen: Schriften noch einmal versuchen. Was da ist, steht danach in Muṣḥaf-Schrift, was fehlt, in einfacher Schrift.
export async function schriftAbgleichen(el = document.body) {
  const offen = [...el.querySelectorAll('[data-fp]')].filter(x => x.classList.contains('ers') || !da.has(+x.dataset.fp));
  if (!offen.length) return false;
  await Promise.all([...new Set(offen.map(x => +x.dataset.fp))].map(schrift));
  let neu = false;
  for (const x of offen) {
    const fp = +x.dataset.fp, vi = +x.dataset.v, i = +x.dataset.i, w = D.W.get(vi + '.' + i); if (!w) continue;
    if (da.has(fp) && x.classList.contains('ers')) { x.classList.remove('ers'); x.innerHTML = glyphen(w[1], w[2]); x.style.fontFamily = 'qp' + fp; neu = true; }
    else if (fehlt(fp) && !x.classList.contains('ers')) { x.classList.add('ers'); x.innerHTML = ersatz(vi, i, w[2]); x.style.fontFamily = ''; neu = true; }
  }
  if (!neu) return false;
  for (const z of el.querySelectorAll('.mz.ers')) if (!z.querySelector('.ers')) z.classList.remove('ers');
  for (const h of el.querySelectorAll('.ers-hinweis')) if (!h.closest('.seite')?.querySelector('.ers')) h.remove();
  zeilenEinpassen(el); if (el.querySelector('.gz')) grenzenZeichnen(el);
  return true;
}
// ---------- Textfassung für Bildschirmleser ----------
// Die Seite besteht aus Zeichen einer Seitenschrift ohne lesbaren Text. Neben jeder Seite steht deshalb derselbe Inhalt
// als unsichtbarer Text: Sūrenkopf, Basmala und jede Āya mit ihrer Nummer, in der Reihenfolge der Seite.
export const textFuerLeser = textHolen;
// Wortlaut eines Wortes: undefined, solange der Text nicht geladen ist; null für das Endzeichen der Āya
export function wortText(vi, i) { const w = U?.[vi]; return !w ? undefined : i < w.length ? w[i] : null; }
export function seiteAlsText(p) {
  if (!U) return null;
  const aus = []; let aya = null;
  for (const z of D.L[p - 1]) {
    if (!z) continue;
    if (z.kopf) { aus.push({ art: 'kopf', s: z.kopf, text: `${KOPF} ${sureArabisch(z.kopf)}` }); aya = null; continue; }
    if (z.basmala) { aus.push({ art: 'basmala', text: BASMALA }); aya = null; continue; }
    for (const [, vi, , i] of z.w) {
      if (!aya || aya.vi !== vi) { aya = { art: 'aya', vi, s: D.V[vi][0], a: D.V[vi][1], woerter: [] }; aus.push(aya); }
      const t = wortText(vi, i); if (t) aya.woerter.push(t);
    }
  }
  return aus;
}
// Füllt die Textfassung aller Seiten in el. zu: verdeckte Āyāt, sie nennen nur ihre Nummer.
// Geändert wird nur, was sich geändert hat, damit der Bildschirmleser seine Stelle behält.
const stInhalt = new WeakMap();
export async function seitenText(el, zu = new Set()) {
  await textHolen(); if (!U || !el?.isConnected) return false;
  for (const box of el.querySelectorAll('.stext[data-st]')) {
    let inhalt = stInhalt.get(box);
    if (!inhalt) {
      const teile = seiteAlsText(+box.dataset.st);
      inhalt = new Map(teile.filter(x => x.art === 'aya').map(x => [x.vi, x]));
      box.innerHTML = teile.map(x => x.art === 'aya' ? `<p data-tv="${x.vi}"></p>` : `<p lang="ar" dir="rtl">${x.text}</p>`).join('');
      stInhalt.set(box, inhalt);
    }
    for (const abs of box.querySelectorAll('p[data-tv]')) {
      const x = inhalt.get(+abs.dataset.tv), stand = zu.has(x.vi) ? 'zu' : 'offen';
      if (abs.dataset.z === stand) continue;
      abs.dataset.z = stand;
      abs.innerHTML = stand === 'zu' ? tx('mushaf.aya_verdeckt', { s: x.s, a: x.a }) : `<span>${x.s}:${x.a}</span> <span lang="ar" dir="rtl">${x.woerter.join(' ')}</span>`;
    }
  }
  return true;
}

// opt: { von, bis } Āya-Indizes des Abschnitts; zu: Set verdeckter Āyāt; alt: Set früherer Fehler-Āyāt; status: Map vi → 'ok'|'hilfe'|'fehler'
// klar: Āyāt vor dem Abschnitt, die deutlich sichtbar bleiben; ton: vi → Farbnummer; fst: Set 'vi.i' markierter Fehlerstellen
export function seiteHTML(p, opt = {}) {
  const { von = -1, bis = -1, zu = new Set(), alt = new Set(), status = new Map(), naechste = -1, klar = new Set(), ton = null, fst = null, grenzen = false, lage = false, wahl = false } = opt;
  // wahl (beim Üben): Die Wörter können zu Knöpfen werden. Dann ist die Seite eine Gruppe statt eines Bildes,
  // und alles, was gerade kein Knopf ist, bleibt für den Bildschirmleser stumm (den Inhalt liest er aus der Textfassung).
  const ah = wahl ? ' aria-hidden="true"' : '';
  if (grenzen && !anfaenge) anfaenge = new Set(D.A.map(e => e.v[0]));
  let einfach = false;
  const zeilen = D.L[p - 1].map(z => {
    if (z.kopf) return `<div class="mz kopfz"${ah}><span>${KOPF} ${sureArabisch(z.kopf)}</span></div>`;
    if (z.basmala) return `<div class="mz bas"${ah}>${BASMALA}</div>`;
    let zers = false;
    const w = z.w.map(([c, vi, ty, i, fp]) => {
      let k = 'w';
      const ers = fehlt(fp); if (ers) { k += ' ers'; zers = einfach = true; }
      if (von >= 0) k += vi < von ? (klar.has(vi) ? ' klar' : ' vor') : vi > bis ? ' nach' : ' in';
      if (zu.has(vi)) k += ' zu' + (vi === naechste ? ' naechste' : '');
      if (status.has(vi)) k += ' ' + status.get(vi);
      if (alt.has(vi) && !zu.has(vi)) k += ' alt';
      if (ton) { const t = ton(vi); if (t != null) k += ' ton' + t; }
      if (fst?.has(vi + '.' + i)) k += ' fs';
      if (grenzen && i === 0 && anfaenge.has(vi) && vi > 0) k += ' ab';
      if (ers) return `<span class="${k}" data-v="${vi}" data-i="${i}" data-fp="${fp}"${ah}>${ersatz(vi, i, ty)}</span>`;
      return `<span class="${k}" data-v="${vi}" data-i="${i}"${ah}${fp !== p ? ` style="font-family:qp${fp}"` : ''}>${glyphen(c, ty)}</span>`;
    }).join('');
    return `<div class="mz${p < 3 ? ' mitte' : ''}${zers ? ' ers' : ''}" style="font-family:qp${p}">${w}</div>`;
  }).join('');
  // Madanī-Muṣḥaf: ungerade Seiten liegen rechts, gerade links (Bundsteg jeweils innen)
  return `<div class="seite ${p % 2 ? 'rechts' : 'links'}${p < 3 ? ' zier' : ''}" data-p="${p}"><div class="seite-innen" role="${wahl ? 'group' : 'img'}" aria-label="${tx('mushaf.mushaf_seite', { p })}">${zeilen}</div><div class="stext nur-leser" data-st="${p}" role="group" aria-label="${tx('mushaf.text_der_seite', { p })}"></div><div class="snr" aria-hidden="true"><span class="snr-k"><span class="ar">${arZahl(p)}</span><i>|</i><span>${p}</span>${lage ? `<i>|</i><b>${p % 2 ? tx('mushaf.r') : tx('mushaf.l')}</b>` : ''}</span></div>${einfach ? `<p class="ers-hinweis">${tx('mushaf.ohne_netz_in_einfacher_schrift_die')}</p>` : ''}</div>`;
}
