// Itqān · Simulation: Rhythmus „Klassisch“ gegen „Langzeit“ bei gleicher Tageslast
// Gedachte Person mit einem eigenen Vergessensverlauf je Abschnitt (wahre Stabilität zwischen 5 und 100 Tagen, Wachstum bei Erfolg, Verlust bei Fehlern).
// Achtung: Das Modell der Person ähnelt dem Modell von Itqān (beide folgen dem Muster der Abrufwahrscheinlichkeit, wie es die Forschung beschreibt),
// die Simulation zeigt also, dass die Planung ihr Modell sinnvoll nutzt, nicht, dass das Modell stimmt. Der Beleg für das Modell ist die Forschung, nicht diese Zahl.
// Aufruf aus dem Ordner app: node tests/simulation_langzeit.mjs
import { Z, D, frisch, naechsterTag } from './umgebung.mjs';

function zufall(start) { let h = start >>> 0; return () => { h = Math.imul(h ^ h >>> 15, 2246822507) + 0x9e3779b9 >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }; }

export function simulieren(rhythmus, { seeds = [1, 2, 3, 4], tage = 400, pensum = 5, ziel = 95, abschnitte = 400 } = {}) {
  let genau = 0, n = 0, aufwand = 0;
  for (const seed of seeds) {
    frisch({ pensum });
    const ids = D.A.slice(0, abschnitte).map(e => e.id);
    Z.P.einst.bereich = ids; Z.P.einst.zielQuote = ziel; Z.P.einst.rhythmus = rhythmus;
    const rnd = zufall(seed), S = new Map(), zuletzt = new Map();
    ids.forEach((id, i) => { S.set(id, [5, 15, 40, 100][Math.floor(rnd() * 4)]); zuletzt.set(id, -Math.floor(rnd() * 20)); });
    for (let tag = 1; tag <= tage; tag++) {
      const t = Z.tagesplan();
      for (const id of t.plan.filter(x => !t.fertig.includes(x))) {
        const dt = tag - (zuletzt.get(id) ?? tag), R = 1 / (1 + dt / (9 * S.get(id)));
        const r = Array.from({ length: D.A[id].ayat }, () => rnd() < R ? 'ok' : 'fehler');
        const fehler = r.includes('fehler');
        if (tag > tage / 2) { genau += r.filter(x => x === 'ok').length; n += r.length; aufwand++; }
        S.set(id, fehler ? Math.max(1, S.get(id) * 0.4) : Math.min(365, S.get(id) * (1.8 + 2.5 * (1 - R))));
        zuletzt.set(id, tag);
        Z.abschnittAbschliessen(id, r);
      }
      naechsterTag();
    }
  }
  return { rhythmus, treffer: 100 * genau / n, abschnitteProTag: aufwand / (seeds.length * tage / 2) };
}

if (process.argv[1]?.endsWith('simulation_langzeit.mjs')) {
  for (const r of ['khatma', 'langzeit']) { const x = simulieren(r); console.log(r.padEnd(9), `Treffer beim ersten Versuch ${x.treffer.toFixed(1)} %`, `· Abschnitte pro Tag ${x.abschnitteProTag.toFixed(2)}`); }
}
