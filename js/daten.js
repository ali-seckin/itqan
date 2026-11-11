import { tx, gebiet, umschrift, fassungSetzen } from './sprache.js';
// Itqān · Daten: Muṣḥaf-Layout (Druck 1405), Āyāt, Abschnitte, Sūren
export const D = { L: null, V: null, A: null, S: null, W: null, ausgabe: 'v2', modus: 'fort', gliederung: 'fort-2' };
// Gliederungen: Fortgeschritten (bis etwa eine Seite) und Anfänger (höchstens eine halbe Seite); Name = Fassung für die Umstellung
export const GLIEDERUNG = { fort: { datei: 'daten/abschnitte.json', name: 'fort-2' }, anf: { datei: 'daten/abschnitte_anf.json', name: 'anf-1' } };
// Dritter Modus 'seite': jede Lerneinheit ist eine Muṣḥaf-Seite. Die Umbrüche der zwei Drucke weichen teils ab, darum je Druck eine Fassung.
export const gliederungVon = (modus, ausgabe = 'v2') => modus === 'seite' ? { datei: `daten/abschnitte_seite_${ausgabe === 'v1' ? 'v1' : 'v2'}.json`, name: `seite-${ausgabe === 'v1' ? 'v1' : 'v2'}` } : GLIEDERUNG[modus];
// Im Seiten-Modus heißt jede Einheit nach ihrer Seitenzahl, und die Sprachschicht nimmt die Fassung 'ganzseite' der Meldungen
export function modusAnwenden(A, modus) {
  fassungSetzen(modus === 'seite' ? 'ganzseite' : null);
  for (const e of A) if (e.seite) e.titel = tx('daten.seite_n', { n: e.seite });
}

// Titel der Abschnitte in der gewählten Sprache: daten/titel/de.json listet jeden deutschen Titel einmal,
// daten/titel/<code>.json hat an derselben Stelle seine Übersetzung. Die Anfänger-Teile tragen „(Teil a/b)“ hinter
// dem Titel des ganzen Abschnitts. Fehlt eine Übersetzung, bleibt der deutsche Titel.
const TEIL = / \(Teil (\d+)\/(\d+)\)$/;
async function titelUebersetzen(A) {
  const code = gebiet('code');
  if (code === 'de') return;
  const holen = u => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null);
  const [liste, ueber] = await Promise.all([holen('daten/titel/de.json'), holen(`daten/titel/${code}.json`)]);
  if (!liste || !ueber) return;
  const t = new Map(liste.map((d, i) => [d, ueber[i]]));
  for (const e of A) {
    if (e.seite || !e.titel) continue;
    const m = e.titel.match(TEIL), grund = m ? e.titel.slice(0, m.index) : e.titel, ue = t.get(grund);
    if (ue) e.titel = m ? tx('daten.titel_teil', { titel: ue, a: m[1], b: m[2] }) : ue;
  }
}

// ausgabe: 'v1' = Druck 1405, 'v2' = Druck 1421, jeweils mit eigenen Seiten und Zeilen
const LAYOUT = { v1: 'daten/layout_v1.json', v2: 'daten/layout_v2.json' };
export async function ladeDaten(ausgabe = 'v2', modus = 'fort') {
  if (!LAYOUT[ausgabe]) ausgabe = 'v2';
  if (!gliederungVon(modus, ausgabe)) modus = 'fort';
  const G = gliederungVon(modus, ausgabe);
  const holen = u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
  const j = u => holen(u).catch(() => holen(u));   // ein zweiter Versuch bei abgebrochener Verbindung
  const [L, V, A, S] = await Promise.all([j(LAYOUT[ausgabe]), j('daten/verse.json'), j(G.datei), j('daten/suren.json')]);
  Object.assign(D, { L, V, A, S, ausgabe, modus, gliederung: G.name });
  modusAnwenden(A, modus);
  await titelUebersetzen(A);
  for (const e of A) e.juz = juzVonSeite(e.seiten[0]);   // Ǧuzʾ immer nach 1405, damit der gewählte Bereich gleich bleibt
  if (ausgabe === 'v2') {   // Seiten, Zeilen und Āya-Seite nach den Umbrüchen von 1421 neu bestimmen
    const seiten = new Map(), zeilen = new Map();
    L.forEach((seite, pi) => seite.forEach((z, zi) => { if (z?.w) for (const e of z.w) {
      if (!seiten.has(e[1])) seiten.set(e[1], new Set()); seiten.get(e[1]).add(pi + 1);
      if (!zeilen.has(e[1])) zeilen.set(e[1], new Set()); zeilen.get(e[1]).add((pi + 1) * 100 + zi);
    } }));
    seiten.forEach((s, vi) => { V[vi][3] = Math.min(...s); });
    for (const e of A) {
      const ps = new Set(), zs = new Set();
      for (let vi = e.v[0]; vi <= e.v[1]; vi++) { seiten.get(vi)?.forEach(x => ps.add(x)); zeilen.get(vi)?.forEach(x => zs.add(x)); }
      e.seiten = [...ps].sort((a, b) => a - b); e.zeilen = zs.size;
    }
  }
  layoutSetzen(L);
}
// Einträge vereinheitlichen zu [Glyphen, vi, Typen, Wortindex in der Āya, Schriftseite]
// und Fundort jedes Wortes merken: D.W 'vi.i' → [Seite, Glyphen, Typen, Schriftseite]
export function layoutSetzen(L) {
  D.L = L;
  const zaehler = new Map(); D.W = new Map();
  L.forEach((seite, pi) => { for (const z of seite) if (z?.w) for (const e of z.w) {
    const fp = e[3] ?? pi + 1, i = zaehler.get(e[1]) || 0; zaehler.set(e[1], i + 1);
    e[2] = e[2] || null; e[3] = i; e[4] = fp; D.W.set(e[1] + '.' + i, [pi + 1, e[0], e[2], fp]);
  } });
}
// Schriftdateien, die eine Seite braucht (bei der Mischform manchmal auch die Nachbarseite)
export function schriftSeiten(p) {
  const s = new Set([p]);
  for (const z of D.L[p - 1]) if (z?.w) for (const e of z.w) s.add(e[4]);
  return [...s];
}
// alle Worteinträge einer Āya mit Seite: [[code, vi, typen, i, schriftseite, p], …]
export function ayaWoerter(vi) {
  const aus = [], p0 = D.V[vi][3];
  for (let p = Math.max(1, p0 - 1); p <= Math.min(604, p0 + 1); p++) for (const z of D.L[p - 1]) if (z?.w) for (const e of z.w) if (e[1] === vi) aus.push([...e, p]);
  return aus;
}

// Beginn der Aǧzāʾ im Madanī-Muṣḥaf (Seite)
const JUZ = [1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582];
export function juzVonSeite(p) { let j = 1; for (let i = 0; i < 30; i++) if (p >= JUZ[i]) j = i + 1; return j; }
export const juzStart = j => JUZ[j - 1];

// Namen der Sūren: eine Sprache kann im Kopf ihrer Datei eine eigene Liste nennen (suren: [...] oder 'arabisch')
export const sureName = s => { const l = gebiet('suren'); return l === 'arabisch' ? D.S[s][0] : Array.isArray(l) ? l[s - 1] : umschrift(D.S[s][1]); };
export const sureArabisch = s => D.S[s][0];
export const vers = vi => ({ s: D.V[vi][0], a: D.V[vi][1], b: D.V[vi][2], p: D.V[vi][3] });

export function abschnittName(e) {
  if (e.nr) return `${sureName(e.von[0])} ${e.nr}`;
  if (e.von[0] === e.bis[0]) return sureName(e.von[0]);
  return e.seite ? tx('daten.suren_bis', { a: sureName(e.von[0]), b: sureName(e.bis[0]) }) : tx('daten.sammelkarte');
}
export function bereichText(e) {
  return e.von[0] === e.bis[0] ? tx('daten.bis', { a: e.von[0], b: e.von[1], c: e.bis[1] }) : tx('daten.bis_2', { a: e.von[0], b: e.von[1], c: e.bis[0], d: e.bis[1] });
}
export const zahl = n => Math.round(n).toLocaleString(gebiet('zahl'));
// Prozentangabe in der Schreibweise der Sprache (Deutsch mit Abstand, Englisch ohne)
export const prozent = n => tx('allg.prozent', { n });
export const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const arZahl = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
