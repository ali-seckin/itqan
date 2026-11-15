// Itqān · Simulation der Tagesmischung (Fehlerwiederholung, Fälliges, Neues) für 1 bis 12 Abschnitte am Tag
// Gedachte Person: kennt den Text von früher (wahre Stabilität je Abschnitt um 40 Tage, 6 bis 300), vergisst ungeprüfte Abschnitte weiter,
// besteht einen Abschnitt mit der Wahrscheinlichkeit der Abrufwahrscheinlichkeit R = 1 / (1 + t / (9 S)); Erfolg: S wächst, Fehler: S fällt.
// Gemessen wird, wie viel vom ganzen Gebiet am Ende des Jahres noch sicher sitzt (mittlere wahre Abrufwahrscheinlichkeit über ALLE Abschnitte),
// wie viel schon geprüft wurde und wie viele Wiederholungen beim ersten Versuch gelangen.
// Aufruf aus dem Ordner app: node tests/simulation_takt.mjs
import { Z, D, frisch, naechsterTag } from './umgebung.mjs';

function zufall(start) { let h = start >>> 0; return () => { h = Math.imul(h ^ h >>> 15, 2246822507) + 0x9e3779b9 >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }; }
const normal = rnd => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());

export function simulieren({ n = 3, N = 739, rhythmus = 'langzeit', ziel = 90, takt = {}, tage = 365, seed = 1 } = {}) {
  const alt = { ...Z.TAKT }; Object.assign(Z.TAKT, takt);
  try {
    frisch({ pensum: n });
    const ids = D.A.slice(0, N).map(e => e.id);
    Z.P.einst.bereich = ids; Z.P.einst.zielQuote = ziel; Z.P.einst.rhythmus = rhythmus;
    const rnd = zufall(seed), S = new Map(), zuletzt = new Map();
    for (const id of ids) { S.set(id, Math.min(300, Math.max(6, Math.exp(Math.log(40) + 0.8 * normal(rnd))))); zuletzt.set(id, -Math.floor(20 + rnd() * 480)); }
    let treffer = 0, wdh = 0, neuTage = 0, ersteWoche = 0;
    for (let tag = 1; tag <= tage; tag++) {
      const t = Z.tagesplan();
      for (const id of t.plan.filter(x => !t.fertig.includes(x))) {
        const geprueft = Z.karte(id).n > 0, R = 1 / (1 + (tag - zuletzt.get(id)) / (9 * S.get(id)));
        const ok = rnd() < R;
        if (geprueft && tag > tage / 2) { wdh++; if (ok) treffer++; }
        if (!geprueft) neuTage++;
        S.set(id, ok ? Math.min(365, S.get(id) * (1.8 + 2.5 * (1 - R))) : Math.max(1, S.get(id) * 0.4));
        zuletzt.set(id, tag);
        Z.abschnittAbschliessen(id, Array.from({ length: D.A[id].ayat }, (_, i) => !ok && i === 0 ? 'fehler' : 'ok'));
      }
      naechsterTag();
    }
    let summe = 0, geprueft = 0;
    for (const id of ids) { summe += 1 / (1 + (tage + 1 - zuletzt.get(id)) / (9 * S.get(id))); if (Z.karte(id).n > 0) geprueft++; }
    const faellig = ids.filter(id => { const k = Z.karte(id); return k.n && Z.abruf(Z.tageZwischen(k.zul, Z.heute()), Z.stabilitaet(k)) < ziel / 100; }).length;
    return { n, N, sitzt: 100 * summe / ids.length, geprueft: 100 * geprueft / ids.length, trefferWdh: wdh ? 100 * treffer / wdh : null, rueckstau: faellig };
  } finally { Object.assign(Z.TAKT, alt); }
}

const POL = {
  'vorher': { takt: { neuMin: 0, neuMax: 0, neuKlassisch: 0.5, S0: 4, ketteLangzeit: [1, 3, 7], fehlerMax: 0.5 }, ziel: 95 },
  'ohneGarantie': { takt: { neuMin: 0, neuMax: 0 }, ziel: 90 },
  'neu': { takt: {}, ziel: 90 },
  'neuZiel95': { takt: {}, ziel: 95 },
  'neu25-70': { takt: { neuMin: 0.25, neuMax: 0.7 }, ziel: 90 },
  'neu10-40': { takt: { neuMin: 0.1, neuMax: 0.4 }, ziel: 90 },
  'klassisch': { takt: {}, ziel: 90, rhythmus: 'khatma' },
  'A 30-75 S20': { takt: { neuMin: 0.3, neuMax: 0.75, S0: 20 }, ziel: 90 },
  'B 35-80 S20 d1-5': { takt: { neuMin: 0.35, neuMax: 0.8, S0: 20, druckStart: 1, druckEnde: 5 }, ziel: 90 },
  'C 25-70 S20': { takt: { neuMin: 0.25, neuMax: 0.7, S0: 20 }, ziel: 90 },
  'neu40-80': { takt: { neuMin: 0.4, neuMax: 0.8 }, ziel: 90 },
  'neu50-90': { takt: { neuMin: 0.5, neuMax: 0.9 }, ziel: 90 },
  'neu40-80 S20': { takt: { neuMin: 0.4, neuMax: 0.8, S0: 20 }, ziel: 90 },
  'neu40-80 S30 d6': { takt: { neuMin: 0.4, neuMax: 0.8, S0: 30, druckEnde: 6 }, ziel: 90 },
  'neu60-90 S20': { takt: { neuMin: 0.6, neuMax: 0.9, S0: 20 }, ziel: 90 },
};
if (process.argv[1]?.endsWith('simulation_takt.mjs')) {
  const N = +(process.argv[2] || 739), ns = (process.argv[3] || '1,2,3,5,8').split(',').map(Number);
  const nur = process.argv[4] ? process.argv[4].split(',') : Object.keys(POL);
  for (const [name, p] of Object.entries(POL)) {
    if (!nur.includes(name)) continue;
    for (const n of ns) {
      const t0 = Date.now(), x = simulieren({ n, N, takt: p.takt, ziel: p.ziel, rhythmus: p.rhythmus || 'langzeit' });
      console.log(`${name.padEnd(8)} N=${N} n=${String(n).padStart(2)}  sitzt ${x.sitzt.toFixed(1)} %  geprüft ${x.geprueft.toFixed(0)} %  Wiederholung gelingt ${x.trefferWdh == null ? '-' : x.trefferWdh.toFixed(0)} %  Rückstau ${x.rueckstau}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
  }
}
