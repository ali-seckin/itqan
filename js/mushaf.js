// Itqān · Darstellung der Muṣḥaf-Seiten (Druck 1405, KFGQPC-Seitenschriften)
import { D, sureArabisch, arZahl, schriftSeiten } from './daten.js';

const geladen = new Map();
let anfaenge = null;   // erste Āya jedes Abschnitts
export function schrift(p) {
  if (!geladen.has(p)) {
    // erst die Datei holen (über den Service Worker auch offline), dann als Schrift anmelden
    // mit Zeitlimit und einem zweiten Versuch, damit eine hängende Verbindung die Seite nicht blockiert
    const url = `schriften/${D.ausgabe === 'v1' ? 'v1' : 'v2'}/p${p}.woff2`;
    const holen = () => { const c = new AbortController(), t = setTimeout(() => c.abort(), 12000);
      return fetch(url, { signal: c.signal }).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).finally(() => clearTimeout(t)); };
    geladen.set(p, holen().catch(holen)
      .then(b => new FontFace('qp' + p, b).load()).then(x => { document.fonts.add(x); return true; })
      .catch(() => { geladen.delete(p); return false; }));
  }
  return geladen.get(p);
}
export const schriftenLaden = seiten => Promise.all([...new Set(seiten.flatMap(schriftSeiten))].map(schrift));
// Zeilen, die in der Mischform länger als die 1405-Zeile sind, passend verkleinern
export function zeilenEinpassen(el) {
  if (D.ausgabe === 'v1') return;
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
// opt: { von, bis } Āya-Indizes des Abschnitts; zu: Set verdeckter Āyāt; alt: Set früherer Fehler-Āyāt; status: Map vi → 'ok'|'hilfe'|'fehler'
// klar: Āyāt vor dem Abschnitt, die deutlich sichtbar bleiben; ton: vi → Farbnummer; fst: Set 'vi.i' markierter Fehlerstellen
export function seiteHTML(p, opt = {}) {
  const { von = -1, bis = -1, zu = new Set(), alt = new Set(), status = new Map(), naechste = -1, klar = new Set(), ton = null, fst = null, grenzen = false } = opt;
  if (grenzen && !anfaenge) anfaenge = new Set(D.A.map(e => e.v[0]));
  const zeilen = D.L[p - 1].map(z => {
    if (z.kopf) return `<div class="mz kopfz"><span>سُورَةُ ${sureArabisch(z.kopf)}</span></div>`;
    if (z.basmala) return `<div class="mz bas">بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ</div>`;
    const w = z.w.map(([c, vi, ty, i, fp]) => {
      let k = 'w';
      if (von >= 0) k += vi < von ? (klar.has(vi) ? ' klar' : ' vor') : vi > bis ? ' nach' : ' in';
      if (zu.has(vi)) k += ' zu' + (vi === naechste ? ' naechste' : '');
      if (status.has(vi)) k += ' ' + status.get(vi);
      if (alt.has(vi) && !zu.has(vi)) k += ' alt';
      if (ton) { const t = ton(vi); if (t != null) k += ' ton' + t; }
      if (fst?.has(vi + '.' + i)) k += ' fs';
      if (grenzen && i === 0 && anfaenge.has(vi) && vi > 0) k += ' ab';
      return `<span class="${k}" data-v="${vi}" data-i="${i}"${fp !== p ? ` style="font-family:qp${fp}"` : ''}>${glyphen(c, ty)}</span>`;
    }).join('');
    return `<div class="mz${p < 3 ? ' mitte' : ''}" style="font-family:qp${p}">${w}</div>`;
  }).join('');
  // Madanī-Muṣḥaf: ungerade Seiten liegen rechts, gerade links (Bundsteg jeweils innen)
  return `<div class="seite ${p % 2 ? 'rechts' : 'links'}${p < 3 ? ' zier' : ''}" data-p="${p}"><div class="seite-innen">${zeilen}</div><div class="snr">${arZahl(p)}</div></div>`;
}
