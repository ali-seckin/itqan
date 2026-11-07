// Itqān · Daten: Muṣḥaf-Layout (Druck 1405), Āyāt, Abschnitte, Sūren
export const D = { L: null, V: null, A: null, S: null, W: null };

export async function ladeDaten() {
  const j = u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
  const [L, V, A, S] = await Promise.all([j('daten/layout_v1.json'), j('daten/verse.json'), j('daten/abschnitte.json'), j('daten/suren.json')]);
  Object.assign(D, { L, V, A, S });
  for (const e of A) e.juz = juzVonSeite(e.seiten[0]);
  // Wortindex je Āya (Eintrag[3]) und Fundort jedes Wortes: D.W 'vi.i' → [Seite, Glyphen, Typen]
  const zaehler = new Map(); D.W = new Map();
  L.forEach((seite, pi) => { for (const z of seite) if (z?.w) for (const e of z.w) {
    const i = zaehler.get(e[1]) || 0; zaehler.set(e[1], i + 1); e[3] = i; D.W.set(e[1] + '.' + i, [pi + 1, e[0], e[2]]);
  } });
}
// alle Worteinträge einer Āya mit Seite: [[code, vi, typen, i, p], …]
export function ayaWoerter(vi) {
  const aus = [], p0 = D.V[vi][3];
  for (let p = p0; p <= Math.min(604, p0 + 1); p++) for (const z of D.L[p - 1]) if (z?.w) for (const e of z.w) if (e[1] === vi) aus.push([...e, p]);
  return aus;
}

// Beginn der Aǧzāʾ im Madanī-Muṣḥaf (Seite)
const JUZ = [1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582];
export function juzVonSeite(p) { let j = 1; for (let i = 0; i < 30; i++) if (p >= JUZ[i]) j = i + 1; return j; }
export const juzStart = j => JUZ[j - 1];

export const sureName = s => D.S[s][1];
export const sureArabisch = s => D.S[s][0];
export const vers = vi => ({ s: D.V[vi][0], a: D.V[vi][1], b: D.V[vi][2], p: D.V[vi][3] });

export function abschnittName(e) {
  if (e.nr) return `${sureName(e.von[0])} ${e.nr}`;
  if (e.von[0] === e.bis[0]) return sureName(e.von[0]);
  return 'Sammelkarte';
}
export function bereichText(e) {
  return e.von[0] === e.bis[0] ? `${e.von[0]}:${e.von[1]} bis ${e.bis[1]}` : `${e.von[0]}:${e.von[1]} bis ${e.bis[0]}:${e.bis[1]}`;
}
export const zahl = n => Math.round(n).toLocaleString('de-DE');
export const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const arZahl = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
