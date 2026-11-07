// Itqān · Darstellung der Muṣḥaf-Seiten (Druck 1405, KFGQPC-Seitenschriften)
import { D, sureArabisch, arZahl, schriftSeiten } from './daten.js';

const geladen = new Map();
export function schrift(p) {
  if (!geladen.has(p)) {
    // erst die Datei holen (über den Service Worker auch offline), dann als Schrift anmelden
    geladen.set(p, fetch(`schriften/${D.ausgabe === 'v1' ? 'v1' : 'v2'}/p${p}.woff2`).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
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
  const { von = -1, bis = -1, zu = new Set(), alt = new Set(), status = new Map(), naechste = -1, klar = new Set(), ton = null, fst = null } = opt;
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
      return `<span class="${k}" data-v="${vi}" data-i="${i}"${fp !== p ? ` style="font-family:qp${fp}"` : ''}>${glyphen(c, ty)}</span>`;
    }).join('');
    return `<div class="mz${p < 3 ? ' mitte' : ''}" style="font-family:qp${p}">${w}</div>`;
  }).join('');
  return `<div class="seite${p < 3 ? ' zier' : ''}" data-p="${p}"><div class="seite-innen">${zeilen}</div><div class="snr">${arZahl(p)}</div></div>`;
}
