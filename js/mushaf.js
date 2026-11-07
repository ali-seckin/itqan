// Itqān · Darstellung der Muṣḥaf-Seiten (Druck 1405, KFGQPC-Seitenschriften)
import { D, sureArabisch, arZahl } from './daten.js';

const geladen = new Map();
export function schrift(p) {
  if (!geladen.has(p)) {
    const f = new FontFace('qp' + p, `url(schriften/v1/p${p}.woff2)`);
    geladen.set(p, f.load().then(x => { document.fonts.add(x); return true; }).catch(() => { geladen.delete(p); return false; }));
  }
  return geladen.get(p);
}
export const schriftenLaden = seiten => Promise.all(seiten.map(schrift));

// opt: { von, bis } Āya-Indizes des Abschnitts; zu: Set verdeckter Āyāt; alt: Set früherer Fehler-Āyāt; status: Map vi → 'ok'|'hilfe'|'fehler'
export function seiteHTML(p, opt = {}) {
  const { von = -1, bis = -1, zu = new Set(), alt = new Set(), status = new Map(), naechste = -1 } = opt;
  const zeilen = D.L[p - 1].map(z => {
    if (z.kopf) return `<div class="mz kopfz"><span>سُورَةُ ${sureArabisch(z.kopf)}</span></div>`;
    if (z.basmala) return `<div class="mz bas">بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ</div>`;
    const w = z.w.map(([c, vi]) => {
      let k = 'w';
      if (von >= 0) k += vi < von ? ' vor' : vi > bis ? ' nach' : ' in';
      if (zu.has(vi)) k += ' zu' + (vi === naechste ? ' naechste' : '');
      if (status.has(vi)) k += ' ' + status.get(vi);
      if (alt.has(vi) && !zu.has(vi)) k += ' alt';
      return `<span class="${k}" data-v="${vi}">${c}</span>`;
    }).join('');
    return `<div class="mz${p < 3 ? ' mitte' : ''}" style="font-family:qp${p}">${w}</div>`;
  }).join('');
  return `<div class="seite${p < 3 ? ' zier' : ''}" data-p="${p}"><div class="seite-innen">${zeilen}</div><div class="snr">${arZahl(p)}</div></div>`;
}
