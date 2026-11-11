// Itqān · Suche ohne Vokale und Mutašābihāt (ähnliche Āyāt)
// Text: daten/text.json (QUL, Wort für Wort; n = gewöhnliche Schreibweise vereinheitlicht, u = Uthmani)
// Paare: daten/mutashabihat.json [viA, viB, Ähnlichkeit %, abweichende Wörter in A, in B] (werkzeuge/mutashabihat.py)
import { D } from './daten.js';

let T = null, Pa = null;
export async function textLaden() {
  if (!T) T = fetch('daten/text.json').then(r => { if (!r.ok) throw new Error('text'); return r.json(); })
    .then(d => vorbereiten(d.n, d.u)).catch(e => { T = null; throw e; });
  return T;
}
export async function paareLaden() {
  if (!Pa) Pa = fetch('daten/mutashabihat.json').then(r => { if (!r.ok) throw new Error('paare'); return r.json(); })
    .then(l => l.map(([a, b, s, da, db]) => ({ a, b, s, da, db, key: `${a}-${b}` }))).catch(e => { Pa = null; throw e; });
  return Pa;
}
// für Tests: Daten direkt setzen
// k: je Āya alle Wörter ohne Leerzeichen hintereinander (يا ويلنا steht im Text als ein Wort)
const vorbereiten = (n, u) => ({ n, u: u.map(x => x.split('|')), k: n.map(x => x.replace(/ /g, '')) });
export function datenSetzen(text, paare) { T = Promise.resolve(vorbereiten(text.n, text.u)); if (paare) Pa = Promise.resolve(paare.map(([a, b, s, da, db]) => ({ a, b, s, da, db, key: `${a}-${b}` }))); }

// Vereinheitlichung wie werkzeuge/suche.py: Vokale und Zeichen weg, Alif- und Hamza-Formen, Yāʾ, Tāʾ marbūṭa
const ZEICHEN = /[ؐ-ًؚ-ٰٟۖ-ۭـ‌-‏]/g;
const ERSATZ = { 'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ٲ': 'ا', 'ٳ': 'ا', 'ى': 'ي', 'ئ': 'ي', 'ؤ': 'و', 'ة': 'ه', 'ء': '', 'ک': 'ك', 'ی': 'ي', 'ھ': 'ه' };
// li + al- verschmilzt zu „لل“ (للحي, لله): intern als „لال…“, wie in werkzeuge/suche.py
function wortform(w) {
  const vor = w.length > 3 && 'وف'.includes(w[0]) && w.slice(1, 3) === 'لل' ? w[0] : '', kern = w.slice(vor.length);
  if (kern === 'لله') return vor + 'لالله';
  return kern.startsWith('لل') && kern.length > 2 ? vor + 'لال' + kern.slice(2) : w;
}
export const normal = t => t.replace(ZEICHEN, '').replace(/[أإآٱٲٳىئؤةءکیھ]/g, c => ERSATZ[c]).replace(/[^ء-ي\s]/g, '').trim().split(/\s+/).filter(Boolean).map(wortform).join(' ');

// Stellenangabe wie 2:255, 2 255 oder 2.255
export function stelle(q) {
  const m = q.trim().match(/^(\d{1,3})\s*[:.,\s]\s*(\d{1,3})$/); if (!m) return null;
  const s = +m[1], a = +m[2];
  const vi = D.V.findIndex(v => v[0] === s && v[1] === a);
  return vi < 0 ? null : vi;
}

// Suche: jede Fundstelle der Buchstabenfolge ohne Leerzeichen (auch innerhalb von Wörtern, z. B. mit wa- oder bi- davor)
// Ergebnis: { stelle, liste: [{ vi, woerter: Set der Wortnummern }], anzahl }
export async function suchen(eingabe) {
  const vi0 = stelle(eingabe);
  if (vi0 != null) return { stelle: vi0, liste: [{ vi: vi0, woerter: new Set() }], anzahl: 1 };
  const q = normal(eingabe);
  if (q.replace(/\s/g, '').length < 2) return { stelle: null, liste: [], anzahl: 0, zuKurz: true };
  const t = await textLaden(), qk = q.replace(/ /g, ''), liste = []; let anzahl = 0;
  t.k.forEach((zeile, vi) => {
    let i = zeile.indexOf(qk); if (i < 0) return;
    // Wortgrenzen: Endposition jedes Wortes in der Zeile ohne Leerzeichen
    const enden = []; let s = 0; for (const w of t.n[vi].split(' ')) { s += w.length; enden.push(s); }
    const wortBei = pos => enden.findIndex(e => pos < e);
    const woerter = new Set();
    while (i >= 0) {
      anzahl++;
      for (let w = wortBei(i), z = wortBei(i + qk.length - 1); w <= z; w++) woerter.add(w);
      i = zeile.indexOf(qk, i + 1);
    }
    liste.push({ vi, woerter });
  });
  return { stelle: null, liste, anzahl };
}

// Mutašābihāt einer Āya und alle Paare
export async function paareVon(vi) { return (await paareLaden()).filter(p => p.a === vi || p.b === vi); }
export async function paar(key) { return (await paareLaden()).find(p => p.key === key) || null; }
