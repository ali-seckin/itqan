// Itqān · Beispielrechnung: Tage bis zum ersten ganzen Durchlauf bei 10, 20 und 30 Aǧzāʾ, Mindest- und Idealmenge, ohne, mit durchschnittlichen und mit vielen Fehlern
// Aufruf aus dem Ordner app: node tests/beispielrechnung.mjs
import { Z, D, frisch, naechsterTag } from './umgebung.mjs';
import { juzVonVers } from '../js/daten.js';

function zufall(start) { let h = start >>> 0; return () => { h = Math.imul(h ^ h >>> 15, 2246822507) + 0x9e3779b9 >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }; }

function lauf({ ids, n, fehler, seed, max = 4000 }) {
  frisch({ pensum: n });
  Z.P.einst.bereich = ids; Z.P.einst.rhythmus = 'langzeit'; Z.P.einst.zielQuote = 90;
  const rnd = zufall(seed); let alleGeprueft = null, alleGefestigt = null, paesse = 0, wdh = 0, fehlerSumme = 0;
  for (let tag = 1; tag <= max; tag++) {
    const t = Z.tagesplan();
    for (const id of t.plan.filter(x => !t.fertig.includes(x))) {
      const ok = rnd() >= fehler;
      paesse++; if (t.art[id] === 'fehler') wdh++; if (!ok) fehlerSumme++;
      Z.abschnittAbschliessen(id, Array.from({ length: D.A[id].ayat }, (_, i) => !ok && i === 0 ? 'fehler' : 'ok'));
    }
    if (alleGeprueft == null && ids.every(id => Z.karte(id).n > 0)) alleGeprueft = tag;
    if (alleGefestigt == null && ids.every(id => Z.karte(id).st >= 2)) { alleGefestigt = tag; break; }
    naechsterTag();
  }
  return { alleGeprueft, alleGefestigt, paesse, wdh, fehlerSumme };
}

const gebiete = [['30 Aǧzāʾ (1 bis 30)', 1, 30, 604], ['20 Aǧzāʾ (11 bis 30)', 11, 30, 404], ['10 Aǧzāʾ (21 bis 30)', 21, 30, 203]];
const quoten = [['ohne Fehler', 0], ['durchschnittlich (15 %)', 0.15], ['viele Fehler (35 %)', 0.35]];
frisch({ pensum: 1 });
for (const [name, a, b, seiten] of gebiete) {
  const ids = D.A.filter(e => { const j = juzVonVers(e.v[0]); return j >= a && j <= b; }).map(e => e.id);
  const em = Z.pensumEmpfehlung(ids.length);
  console.log(`\n${name}: ${seiten} Seiten, ${ids.length} Abschnitte · Mindestmenge ${em.minimal}, Idealmenge ${em.ideal} Abschnitte am Tag`);
  for (const [label, n] of [['Minimum', em.minimal], ['Ideal', em.ideal]]) {
    for (const [ql, q] of quoten) {
      const r = [1, 2, 3].map(seed => lauf({ ids, n, fehler: q, seed }));
      const m = k => Math.round(r.reduce((s, x) => s + x[k], 0) / r.length);
      console.log(`  ${label.padEnd(7)} ${String(n).padStart(2)}/Tag · ${ql.padEnd(24)} alles einmal geprüft: ${String(m('alleGeprueft')).padStart(4)} Tage · alles gefestigt: ${r.some(x => x.alleGefestigt == null) ? 'nicht erreicht (über 4000 Tage)' : String(m('alleGefestigt')).padStart(4) + ' Tage'} · Fehlerwiederholungen: ${Math.round(100 * m('wdh') / m('paesse'))} % der Durchgänge`);
    }
  }
}
