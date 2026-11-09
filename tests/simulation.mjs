// Itqān · Simulation des Reglers „Schwache Abschnitte“ mit einer gedachten Person (Ganzer Qurʾān, 5 Abschnitte am Tag):
// jeder zehnte Abschnitt fällt ihr schwer (5 % Fehler je Āya), ein weiterer Zehntel mittel (1,5 %), der Rest leicht (0,2 %).
// Gemessen: Tage bis zur ersten Ḫatma und wie oft Abschnitte mit Fehlern in den ersten 200 Tagen
// außerhalb der Fehlerwiederholung drankommen (Runde und Festigen).
// Aufruf für die Übersicht: node tests/simulation.mjs (aus dem Ordner app)
import { Z, D, frisch, naechsterTag } from './umgebung.mjs';

function zufall(start) { let h = start >>> 0; return () => { h = Math.imul(h ^ h >>> 15, 2246822507) + 0x9e3779b9 >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }; }
const klasse = id => id % 10 === 0 ? 0.05 : id % 10 === 5 ? 0.015 : 0.002;

export function simulieren(stufe, seeds = [1, 2, 3, 4, 5, 6, 7, 8], tage = 200) {
  let summeKhatma = 0, regSchwach = 0, nSchwach = 0;
  for (const seed of seeds) {
    frisch({ pensum: 5 }); Z.P.einst.schwaechen = stufe;
    const rnd = zufall(seed), mitFehler = new Set(), regulaer = new Map();
    for (let tag = 1; tag <= 500; tag++) {
      const t = Z.tagesplan();
      for (const id of t.plan.filter(x => !t.fertig.includes(x))) {
        const r = Array.from({ length: D.A[id].ayat }, () => rnd() < klasse(id) ? 'fehler' : 'ok');
        if (tag <= tage) { if (t.art[id] !== 'fehler') regulaer.set(id, (regulaer.get(id) || 0) + 1); if (r.includes('fehler')) mitFehler.add(id); }
        Z.abschnittAbschliessen(id, r);
      }
      if (Z.P.zyklus.khatma >= 1) { summeKhatma += tag; break; }
      naechsterTag();
    }
    for (const id of mitFehler) { regSchwach += regulaer.get(id) || 0; nSchwach++; }
  }
  return { stufe, khatma: summeKhatma / seeds.length, regulaerSchwach: regSchwach / nSchwach };
}

if (process.argv[1]?.endsWith('simulation.mjs')) {
  const basis = simulieren('khatma');
  for (const s of ['khatma', 'ausgewogen', 'schwaechen']) {
    const r = s === 'khatma' ? basis : simulieren(s);
    console.log(s.padEnd(11), `Ḫatma nach ${r.khatma.toFixed(1)} Tagen (${(100 * (r.khatma / basis.khatma - 1)).toFixed(1)} %)`,
      `· schwache Abschnitte außerhalb der Fehlerwiederholung ×${(r.regulaerSchwach / basis.regulaerSchwach).toFixed(2)}`);
  }
}
