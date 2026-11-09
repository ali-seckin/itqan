// Itqān · Mutašābihāt nachschlagen: Gruppen ähnlicher Verse und Reihenfolge-Fälle
// Daten: daten/aehnlich.json (werkzeuge/familien.py)
//   f: [{ k, art: gleich|fast|aehnlich, kern, v: [{ g: [vi], d: [abweichende Wortnummern] }], was, wo, nach, vor, auch, verw, t }]
//   t: [{ thema, hinweis, gruppen: [{ titel, notiz, faelle: [{ k, art: paar|stellung|weit, ta, tb, ab: [[vi, i, j]], ba, f }] }] }]
//      ab = die häufigere Reihenfolge, ta und tb = Wortlaut der beiden Folgen
import { D } from './daten.js';
import { normal, stelle, paareLaden } from './suche.js';

export const ART = { gleich: 'Wortgleich', fast: 'Fast gleich', aehnlich: 'Ähnlich' };
export const WAS = { zusatz: 'Zusatz oder Auslassung', wort: 'anderes Wort', wortform: 'andere Wortform', bindewort: 'وَ oder فَ davor', reihenfolge: 'andere Reihenfolge' };
export const WO = { anfang: 'am Anfang', mitte: 'in der Mitte', schluss: 'am Schluss' };

let A = null;
export async function laden() {
  if (!A) A = Promise.all([fetch('daten/aehnlich.json').then(r => { if (!r.ok) throw new Error('aehnlich'); return r.json(); }), paareLaden()])
    .then(([d, paare]) => vorbereiten(d, paare)).catch(e => { A = null; throw e; });
  return A;
}
// für Tests: Daten direkt setzen
export function datenSetzen(d, paare = []) { A = Promise.resolve(vorbereiten(d, paare.map(p => Array.isArray(p) ? { a: p[0], b: p[1], s: p[2], da: p[3], db: p[4], key: `${p[0]}-${p[1]}` } : p))); }

// Nachschlagetafeln: FK und TK nach Schlüssel, vonVi: Āya → { f: [Gruppen], t: [Fälle] }, suren: [[Nummer, Zahl der Stellen]]
function vorbereiten(d, paare) {
  const FK = {}, TK = {}, faelle = [], vonVi = new Map();
  const bei = vi => { if (!vonVi.has(vi)) vonVi.set(vi, { f: [], t: [] }); return vonVi.get(vi); };
  for (const f of d.f) {
    f.s = f.v.flatMap(v => v.g); f.erst = Math.min(...f.s); f.paare = []; FK[f.k] = f;
    for (const vi of f.s) bei(vi).f.push(f.k);
  }
  d.t.forEach((th, ti) => th.gruppen.forEach(gr => gr.faelle.forEach(x => {
    x.s = [...new Set([...x.ab, ...x.ba].map(o => o[0]))]; x.thema = ti; TK[x.k] = x; faelle.push(x);
    for (const vi of x.s) bei(vi).t.push(x.k);
  })));
  // bestätigte Paare (zum Unterscheiden) der Gruppe zuordnen, in der beide Āyāt stehen
  for (const p of paare) {
    const fa = vonVi.get(p.a)?.f || [], fb = vonVi.get(p.b)?.f || [], beide = fa.filter(k => fb.includes(k));
    for (const k of beide.length ? beide : new Set([...fa, ...fb])) FK[k].paare.push(p);
  }
  const zs = new Map();
  for (const vi of vonVi.keys()) zs.set(D.V[vi][0], (zs.get(D.V[vi][0]) || 0) + 1);
  return { f: d.f, t: d.t, FK, TK, faelle, vonVi, suren: [...zs].sort((x, y) => x[0] - y[0]), stellen: new Set(d.f.flatMap(f => f.s)).size };
}

// ---------- Anfrage: Stelle (2:48), Sūrennummer, arabische Wörter oder Sūrenname ----------
const falte = s => s.normalize('NFD').replace(/[̀-ͯʿʾ'’‘`-]/g, '').replace(/\s+/g, '').toLowerCase();
const NAMEN = {};
const sureGefaltet = s => NAMEN[s] ??= falte(D.S[s][1]);
export function anfrage(eingabe = '', sure = 0) {
  const q = eingabe.trim(), a = { sure, vi: null, sureQ: 0, text: '', name: '' };
  if (/^\d{1,3}\s*[:.,;\s]\s*\d{1,3}$/.test(q)) a.vi = stelle(q.replace(';', ':')) ?? -1;
  else if (/^\d{1,3}$/.test(q)) a.sureQ = +q;
  else if (/[؀-ۿ]/.test(q)) a.text = normal(q).replace(/ /g, '');
  else if (q) a.name = falte(q);
  a.aktiv = !!(a.sure || a.vi != null || a.sureQ || a.text || a.name);
  return a;
}
// t: der Suchtext aus suche.js (textLaden)
export function trifft(vi, a, t) {
  const s = D.V[vi][0];
  if (a.sure && s !== a.sure) return false;
  if (a.vi != null && vi !== a.vi) return false;
  if (a.sureQ && s !== a.sureQ) return false;
  if (a.name && !sureGefaltet(s).includes(a.name)) return false;
  if (a.text && !t.k[vi].includes(a.text)) return false;
  return true;
}

// ---------- Listen ----------
const groesse = n => n === 2 ? '2' : n <= 5 ? '3' : '6';
// F: { art, was, wo, gr, sort: mushaf|gross, nur: vi => im Bereich, zuerst: Set von Āyāt, die nach oben gehören }
// Ergebnis: [{ f, erst: erste passende Āya, oben }]
export function familienListe(A, t, a, F = {}) {
  const l = [];
  for (const f of A.f) {
    if (F.art && f.art !== F.art) continue;
    if (F.was && !f.was.includes(F.was)) continue;
    if (F.wo && !f.wo.includes(F.wo)) continue;
    if (F.gr && groesse(f.s.length) !== F.gr) continue;
    if (F.nur && !f.s.some(F.nur)) continue;
    let erst = f.erst;
    if (a.aktiv) { const tr = f.s.filter(vi => trifft(vi, a, t)); if (!tr.length) continue; erst = Math.min(...tr); }
    l.push({ f, erst, oben: !!F.zuerst && f.s.some(vi => F.zuerst.has(vi)) });
  }
  return l.sort((x, y) => (y.oben - x.oben) || (F.sort === 'gross' ? y.f.s.length - x.f.s.length : 0) || x.erst - y.erst);
}
export const faelleListe = (A, t, a, nur) => A.faelle.filter(x => (!nur || x.s.some(nur)) && (!a.aktiv || x.s.some(vi => trifft(vi, a, t))));

// ---------- Texte ----------
export const stelleKurz = vi => `${D.V[vi][0]}:${D.V[vi][1]}`;
// Anfang der folgenden Āya derselben Sūra: dort entscheidet sich, ob man richtig weiterliest
export function danach(t, vi) {
  if (vi + 1 >= D.V.length || D.V[vi + 1][0] !== D.V[vi][0]) return '';
  const w = t.u[vi + 1];
  return w.slice(0, 4).join(' ') + (w.length > 4 ? ' …' : '');
}
export function merksatz(f) {
  const n = f.s.length;
  if (f.art === 'gleich') return `Derselbe Wortlaut an ${n === 2 ? 'beiden' : 'allen ' + n} Stellen. Verwechselt wird hier die Fortsetzung.`;
  const wo = f.wo.map(x => WO[x]);
  return `Der Unterschied liegt ${wo.length > 1 ? wo.slice(0, -1).join(', ') + ' und ' + wo.at(-1) : wo[0]}.`;
}
// Reihenfolge-Fall: regel = eine Folge ist klar die häufigere
export function fallSatz(x) {
  const na = x.ab.length, nb = x.ba.length, regel = na >= 3 && na >= 2 * nb, st = n => `${n} ${n === 1 ? 'Stelle' : 'Stellen'}`;
  const satz = na === nb ? `Beide Reihenfolgen kommen gleich oft vor, je ${st(na)}.`
    : regel ? (nb === 1 ? `Regel mit einer einzigen Ausnahme: ${stelleKurz(x.ba[0][0])} (${D.S[D.V[x.ba[0][0]][0]][1]}).` : `Die Regel gilt an ${na} von ${na + nb} Stellen. Die ${nb} Ausnahmen lohnt es sich einzeln zu merken.`)
    : `Keine klare Regel: ${na} Stellen in der einen, ${st(nb)} in der anderen Reihenfolge.`;
  return { satz, regel };
}
// Markierung der Wörter einer Stelle [vi, i, j]: 'kern' für die Wörter, die den Platz tauschen, 'zw' für das Stück dazwischen
export const markFuer = (x, o) => { const [, p, q] = o, eng = x.art === 'stellung'; return j => (j === p || j === q) ? 'kern' : (j > p && j < q) ? (eng ? 'kern' : 'zw') : ''; };
