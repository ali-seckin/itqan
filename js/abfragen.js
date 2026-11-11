// Itqān · Kurzübungen: andere Wege ins Gedächtnis als „Abschnitt von vorn“
// Seitenanfang, Anfang eines Ǧuzʾ, Übergang zwischen Abschnitten, Einstieg aus der Mitte, Titel, Zeile auf der Seite, Zwillinge.
// Alles nur aus dem eigenen Bereich (Pool). Die Übungen laufen im Üben-Bildschirm (Quelle „abfrage“), ohne Stufe und Karte zu ändern;
// markierte Fehlerwörter landen wie sonst bei den Fehlerstellen.
import { D, juzStart } from './daten.js';
import * as Z from './zustand.js';

const zufall = liste => liste[Math.floor(Math.random() * liste.length)];
export const abschnittVonAya = vi => D.A.find(e => vi >= e.v[0] && vi <= e.v[1]);
const imPool = vi => { const e = abschnittVonAya(vi); return !!e && Z.imBereich(e.id); };
const ersteAyaDerSeite = p => { for (const z of D.L[p - 1]) if (z?.w) return z.w[0][1]; return null; };
export const seiteVonAya = vi => D.W?.get(vi + '.0')?.[0] || D.V[vi][3];

function ziel(von, bis, mitKontext, art, n) {
  const e = abschnittVonAya(von);
  return `#ueben/${e.id}/abfrage/${von}_${bis}_${mitKontext ? 1 : 0}_${art}_${n}`;
}

// Hash der nächsten Übung dieser Art oder null, wenn der Bereich dafür nichts hergibt
export function naechste(art) {
  if (art === 'seite') {
    const ps = []; for (let p = 1; p <= 604; p++) { const vi = ersteAyaDerSeite(p); if (vi != null && imPool(vi)) ps.push([p, vi]); }
    if (!ps.length) return null; const [p, vi] = zufall(ps); return ziel(vi, vi, false, 'seite', p);
  }
  if (art === 'juz') {
    const js = []; for (let j = 1; j <= 30; j++) { const vi = ersteAyaDerSeite(juzStart(j)); if (vi != null && imPool(vi)) js.push([j, vi]); }
    if (!js.length) return null; const [j, vi] = zufall(js); return ziel(vi, vi, false, 'juz', j);
  }
  if (art === 'uebergang') {
    // Ende eines Abschnitts sichtbar, die nächste Āya wird gesprochen (nur wenn die nächste Āya nicht die erste ihrer Sūra ist, dann bliebe der Hinweis leer)
    const es = D.A.filter(e => Z.imBereich(e.id) && e.v[1] + 1 < D.V.length && D.V[e.v[1] + 1][1] > 1 && imPool(e.v[1] + 1));
    if (!es.length) return null; const e = zufall(es); return ziel(e.v[1] + 1, e.v[1] + 1, true, 'uebergang', e.id);
  }
  if (art === 'mitte') {
    const es = D.A.filter(e => Z.imBereich(e.id) && e.ayat >= 4);
    if (!es.length) return null;
    const e = zufall(es), m = e.v[0] + 1 + Math.floor(Math.random() * (e.ayat - 2));
    return ziel(m, Math.min(m + 2, e.v[1]), true, 'mitte', e.id);
  }
  if (art === 'titel') {
    const es = D.A.filter(e => Z.imBereich(e.id));
    if (!es.length) return null; const e = zufall(es); return ziel(e.v[0], e.v[0], false, 'titel', e.id);
  }
  return null;
}

// Zeile auf der Seite: Seite und Āya sind vorgegeben, gefragt ist die Zeile, in der die Āya beginnt
export function zeilenAufgabe() {
  const es = D.A.filter(e => Z.imBereich(e.id) && D.V[e.v[0]][1] > 0);
  if (!es.length) return null;
  for (let versuch = 0; versuch < 30; versuch++) {
    const e = zufall(es), vi = e.v[0], p = seiteVonAya(vi), zeilen = D.L[p - 1];
    const z = zeilen.findIndex(l => l?.w?.some(w => w[1] === vi && w[3] === 0));
    if (z >= 0) return { vi, p, zeile: z + 1, zeilenZahl: zeilen.length, s: D.V[vi][0], a: D.V[vi][1] };
  }
  return null;
}

// Zwillinge: ein bestätigtes Paar ähnlicher Stellen, von dem eine Stelle im eigenen Bereich liegt
let paare = null;
export async function zwillingsZiel() {
  paare ??= await fetch('daten/mutashabihat.json').then(r => r.json()).catch(() => []);
  const gut = paare.filter(p => imPool(p[0]) || imPool(p[1]));
  return gut.length ? `#vergleich/${zufall(gut).slice(0, 2).join('-')}/ueben` : null;
}
// Zwillings-Paar zu einem gerade geübten Abschnitt (von, bis: Āya-Bereich)
export async function zwillingZu(von, bis) {
  paare ??= await fetch('daten/mutashabihat.json').then(r => r.json()).catch(() => []);
  const p = paare.find(x => (x[0] >= von && x[0] <= bis) || (x[1] >= von && x[1] <= bis));
  return p ? { key: `${p[0]}-${p[1]}`, a: p[0], b: p[1] } : null;
}
