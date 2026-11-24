// Itqān · Abzeichen der 13 Ränge (SVG, ohne Bilddateien, ohne Abhängigkeiten).
// Eine runde Medaille auf dem Petrol der App. Das Material steigt mit dem Rang (Bronze 1 bis 3, Silber 4 bis 6, Gold 7 bis 9,
// Gold mit Email 10 bis 12, Licht 13), ab Rang 7 steht das Abschnittszeichen (Stern) hinter der Medaille. Das Zeichen in der Mitte ist je Rang eigen
// und zeigt die Bedeutung des Namens, ohne Lebewesen:
//  1 Keimling, 2 Flamme, 3 sieben Tage, 4 Salomonsknoten, 5 Wachturm, 6 Siegel in Achtstern-Form, 7 offenes Buch, 8 Waage, 9 Schreibfeder,
//  10 Baum mit Wurzeln, 11 Mihrab, 12 Knoten (gewebter Achtstern mit Lichtpunkt, Ṯabt heißt Festigkeit), 13 Strahlenstern.
// Die drei letzten Ränge lesen sich als Weg: erst durch den Mihrab, dann die Festigkeit mit dem Licht, am Ende das Licht selbst.
// Die Entwürfe und das Werkzeug dazu liegen in werkzeuge/abzeichen. abzeichen(i) liefert ein SVG als Text; jede Abfrage bekommt eigene
// Kennungen für Verlauf und Masken, damit mehrere Abzeichen auf einer Seite nicht ineinandergreifen.
const STOFF = {
  bronze: ['#F2C890', '#B7772F', '#6B4017'],
  silber: ['#F8FBFC', '#B5C2C7', '#66777E'],
  gold: ['#FCEEC0', '#D4AF6A', '#8A6419'],
  licht: ['#FFFFFF', '#F6E3A6', '#C79A3B']
};
const STOFF_VON = ['bronze', 'bronze', 'bronze', 'silber', 'silber', 'silber', 'gold', 'gold', 'gold', 'gold', 'gold', 'gold', 'licht'];
const SKALA = [1.2, 1.2, 1.15, 1.15, 1.2, 1.1, 1.15, 1.08, 1.15, 1.15, 1.15, 1.15, 1.05];
export const ANZAHL = 13;

const r2 = x => Math.round(x * 100) / 100;
const pt = (r, a) => [r2(100 + r * Math.cos(a * Math.PI / 180)), r2(100 + r * Math.sin(a * Math.PI / 180))];
const stern = (n, ro, ri, cx = 100, cy = 100, rot = -90) => Array.from({ length: n * 2 }, (_, i) => { const r = i % 2 ? ri : ro, a = rot + i * 180 / n; return `${r2(cx + r * Math.cos(a * Math.PI / 180))},${r2(cy + r * Math.sin(a * Math.PI / 180))}`; }).join(' ');
const punkte = (n, r, g, farbe, op = 1) => Array.from({ length: n }, (_, i) => { const [x, y] = pt(r, -90 + i * 360 / n); return `<circle cx="${x}" cy="${y}" r="${g}" fill="${farbe}" opacity="${op}"/>`; }).join('');

// M: Füllung im Material, C: Farbe der Aussparungen (Grund der Medaille), u: Kennung für Masken
function zeichen(i, M, C, u, h, d) {   // h: Glanzlicht, d: Schattenton des Materials
  switch (i) {
    case 0: return `<path d="M100 137 V100" stroke="${M}" stroke-width="5" stroke-linecap="round" fill="none"/>
      <path d="M100 104 C82 104 70 93 68 77 C86 77 99 88 100 104Z" fill="${M}"/><path d="M100 96 C116 96 129 85 131 69 C114 69 101 80 100 96Z" fill="${M}"/>
      <path d="M82 139 H118" stroke="${M}" stroke-width="4" stroke-linecap="round"/>`;
    case 1: return `<path d="M100 60 C104 78 126 90 126 112 A26 26 0 0 1 74 112 C74 98 84 90 91 79 C93 88 97 93 101 93 C97 82 97 72 100 60Z" fill="${M}"/>
      <path d="M100 98 C104 108 112 114 112 124 A12 12 0 0 1 88 124 C88 116 96 112 100 98Z" fill="${C}"/>`;
    case 2: return `<circle cx="100" cy="100" r="31" fill="none" stroke="${M}" stroke-width="2.2"/>${punkte(7, 31, 7.2, M)}<circle cx="100" cy="100" r="10" fill="${M}"/><circle cx="100" cy="100" r="4.4" fill="${C}"/>`;
    case 3: {   // Salomonsknoten: zwei Schlaufen, vier Kreuzungen wechseln über und unter (Lücke per Maske), das Pflegen als Band, das hält
      const sch = `stroke="${M}" stroke-width="7.5" fill="none"`, l = (id, liste) => `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200"><rect width="200" height="200" fill="#fff"/>${liste.map(([x, y]) => `<rect x="${x - 8.5}" y="${y - 8.5}" width="17" height="17" fill="#000"/>`).join('')}</mask>`;
      return `${l(u + 'k1', [[120, 80], [80, 120]])}${l(u + 'k2', [[80, 80], [120, 120]])}<rect x="56" y="80" width="88" height="40" rx="11" ${sch} mask="url(#${u}k1)"/><rect x="80" y="56" width="40" height="88" rx="11" ${sch} mask="url(#${u}k2)"/>`;
    }
    case 4: return `<rect x="70" y="134" width="60" height="5" rx="2" fill="${M}"/><rect x="78" y="90" width="44" height="44" fill="${M}"/>
      <rect x="78" y="76" width="10" height="16" fill="${M}"/><rect x="95" y="76" width="10" height="16" fill="${M}"/><rect x="112" y="76" width="10" height="16" fill="${M}"/>
      <path d="M92 134 V114 a8 8 0 0 1 16 0 V134Z" fill="${C}"/><rect x="98" y="99" width="4" height="9" rx="1" fill="${C}"/>`;
    case 5: {   // Siegel in Achtstern-Form: der Rand folgt dem Abschnittszeichen (zwei Quadrate mit weichen Ecken), Perlenring, kleiner Stern; vollkommen symmetrisch
      const perlen = Array.from({ length: 16 }, (_, k) => { const [x, y] = pt(24.5, k * 22.5 - 90); return `<circle cx="${x}" cy="${y}" r="1.4" fill="${C}"/>`; }).join('');
      return `<rect x="67" y="67" width="66" height="66" rx="11" fill="${M}"/><rect x="67" y="67" width="66" height="66" rx="11" fill="${M}" transform="rotate(45 100 100)"/>
        <circle cx="100" cy="100" r="31" fill="none" stroke="${d}" stroke-opacity=".5" stroke-width="2.4"/><circle cx="100" cy="100" r="27.6" fill="none" stroke="${h}" stroke-opacity=".6" stroke-width="1.2"/>
        <circle cx="100" cy="100" r="21" fill="none" stroke="${C}" stroke-width="1.5"/>${perlen}<polygon points="${stern(8, 13, 7.6)}" fill="${C}"/><circle cx="100" cy="100" r="3" fill="${M}"/>`;
    }
    case 6: return `<path d="M100 84 C90 76 76 74 62 78 V128 C76 124 90 126 100 134Z" fill="${M}"/><path d="M100 84 C110 76 124 74 138 78 V128 C124 124 110 126 100 134Z" fill="${M}"/>
      <path d="M100 84 V134" stroke="${C}" stroke-width="2.6"/>
      <g stroke="${C}" stroke-width="2" stroke-linecap="round" fill="none"><path d="M70 92 C78 90 86 91 92 94"/><path d="M70 104 C78 102 86 103 92 106"/><path d="M70 116 C78 114 86 115 92 118"/><path d="M130 92 C122 90 114 91 108 94"/><path d="M130 104 C122 102 114 103 108 106"/><path d="M130 116 C122 114 114 115 108 118"/></g>
      <polygon points="${stern(8, 9, 5.5, 100, 66)}" fill="${M}"/>`;
    case 7: return `<rect x="98" y="72" width="4" height="58" fill="${M}"/><circle cx="100" cy="68" r="5.5" fill="${M}"/><path d="M80 136 H120 L113 129 H87 Z" fill="${M}"/>
      <path d="M58 82 H142" stroke="${M}" stroke-width="4.4" stroke-linecap="round"/>
      <g stroke="${M}" stroke-width="1.8" stroke-linecap="round" fill="none"><path d="M58 84 L47 112 M58 84 L69 112"/><path d="M142 84 L131 112 M142 84 L153 112"/></g>
      <path d="M44 112 H72 A14 14 0 0 1 44 112Z" fill="${M}"/><path d="M128 112 H156 A14 14 0 0 1 128 112Z" fill="${M}"/>`;
    case 8: return `<path d="M68 134 L76 108 L118 66 L134 82 L92 124 Z" fill="${M}"/>
      <path d="M68 134 L85 117" stroke="${C}" stroke-width="1.8" stroke-linecap="round"/><path d="M113 71 L129 87" stroke="${C}" stroke-width="2.2"/>
      <path d="M60 143 C76 136 96 145 138 134" fill="none" stroke="${M}" stroke-width="3.2" stroke-linecap="round"/>`;
    case 9: return `<circle cx="100" cy="80" r="19" fill="${M}"/><circle cx="83" cy="94" r="15" fill="${M}"/><circle cx="117" cy="94" r="15" fill="${M}"/><rect x="95" y="98" width="10" height="27" fill="${M}"/>
      <path d="M91 79 C95 73 105 73 109 79" fill="none" stroke="${C}" stroke-width="2.2" stroke-linecap="round"/>
      <g stroke="${M}" stroke-width="3.4" stroke-linecap="round" fill="none"><path d="M100 124 C99 132 91 136 80 135"/><path d="M100 124 C101 132 109 136 120 135"/><path d="M100 124 V139"/></g>`;
    case 10: return `<rect x="60" y="132" width="80" height="6" rx="2" fill="${M}"/>
      <path d="M70 132 V96 C70 76 85 64 100 64 C115 64 130 76 130 96 V132Z" fill="${M}"/><path d="M84 132 V99 C84 87 92 79 100 79 C108 79 116 87 116 99 V132Z" fill="${C}"/>
      <polygon points="${stern(8, 9, 5.5, 100, 102)}" fill="${M}"/>`;
    case 11: {   // Knoten: zwei Quadrate zum Achtstern verflochten, acht Kreuzungen wechseln über und unter, die untere Schlinge hat dort eine Lücke (Maske)
      const a = 38, k = r2(0.4142 * a), rr = r2(a * 1.4142), sch = `stroke="${M}" stroke-width="7.5" stroke-linejoin="round" fill="none"`, c = (x, y) => [100 + x, 100 + y];
      const luecke = (id, liste) => `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200"><rect width="200" height="200" fill="#fff"/>${liste.map(([[x, y], w]) => `<rect x="${r2(x - 6.5)}" y="${r2(y - 7)}" width="13" height="14" fill="#000" transform="rotate(${w} ${x} ${y})"/>`).join('')}</mask>`;
      const quad = `<polygon points="${[[a, -a], [a, a], [-a, a], [-a, -a]].map(([x, y]) => `${100 + x},${100 + y}`).join(' ')}" ${sch} mask="url(#${u}k1)"/>`;
      const raute = `<polygon points="${[[rr, 0], [0, rr], [-rr, 0], [0, -rr]].map(([x, y]) => `${r2(100 + x)},${r2(100 + y)}`).join(' ')}" ${sch} mask="url(#${u}k2)"/>`;
      const ungerade = [[c(a, -k), 45], [c(k, a), 135], [c(-a, k), 45], [c(-k, -a), 135]], gerade = [[c(a, k), 90], [c(-k, a), 0], [c(-a, -k), 90], [c(k, -a), 0]];
      return `${luecke(u + 'k1', gerade)}${luecke(u + 'k2', ungerade)}${raute}${quad}<circle cx="100" cy="100" r="17" fill="url(#${u}l)"/><circle cx="100" cy="100" r="5" fill="#FFF3CC"/>`;
    }
    default: {   // Strahlenstern: sechzehn lange und sechzehn kurze Strahlen um eine Mitte
      const lang = Array.from({ length: 16 }, (_, k) => { const a = -90 + k * 22.5; return `<polygon points="${pt(18, a - 5).join(',')} ${pt(46, a).join(',')} ${pt(18, a + 5).join(',')}" fill="${M}"/>`; }).join('');
      const kurz = Array.from({ length: 16 }, (_, k) => { const a = -90 + 11.25 + k * 22.5; return `<polygon points="${pt(18, a - 3.2).join(',')} ${pt(33, a).join(',')} ${pt(18, a + 3.2).join(',')}" fill="${M}"/>`; }).join('');
      return `${lang}${kurz}<circle cx="100" cy="100" r="16" fill="${M}"/><circle cx="100" cy="100" r="11" fill="${C}"/><polygon points="${stern(8, 8, 4.6)}" fill="${M}"/>`;
    }
  }
}

let zaehler = 0;
// i: 0 bis 12. name: zugänglicher Name; ohne Name ist das Abzeichen reiner Schmuck (aria-hidden), weil der Rang daneben im Text steht.
export function abzeichen(i, name = '') {
  i = Number.isInteger(i) && i >= 0 && i < ANZAHL ? i : 0;
  const u = 'abz' + (++zaehler) + '-', [h, m, d] = STOFF[STOFF_VON[i]], email = i >= 9;
  // Der Grund folgt dem Modus der App: --abz-n0..2 (Gold, Silber, Bronze) und --abz-e0..2 (Email, Ränge 10 bis 13) stehen in css/itqan.css; ohne CSS gilt das dunkle Petrol
  const pre = email ? 'e' : 'n', grund = (email ? ['#2A7380', '#17505B', '#0F3A45'] : ['#16404E', '#10303E', '#0A2230']).map((f, k) => `var(--abz-${pre}${k},${f})`), C = grund[1], kante = `url(#${u}m)`;
  let hinten = '', leiste = '', innen = '';
  if (i >= 6 && i <= 8) hinten += `<polygon points="${stern(8, 100, 84)}" fill="${kante}" stroke="${d}" stroke-opacity=".45" stroke-width="1" stroke-linejoin="round"/>`;
  if (i >= 9 && i <= 11) hinten += `<polygon points="${stern(16, 100, 89)}" fill="${kante}" stroke="${d}" stroke-opacity=".45" stroke-width="1" stroke-linejoin="round"/>`;
  if (i === 12) hinten += `<circle cx="100" cy="100" r="108" fill="url(#${u}g)"/><polygon points="${stern(16, 104, 90)}" fill="${kante}" stroke="${d}" stroke-opacity=".5" stroke-width="1" stroke-linejoin="round"/><polygon points="${stern(16, 96, 84, 100, 100, -78.75)}" fill="${h}" stroke="${d}" stroke-opacity=".4" stroke-width="1" stroke-linejoin="round"/>`;
  const perlen = { 3: 16, 4: 24, 5: 32, 7: 16, 8: 24, 10: 32, 11: 32, 12: 32 }[i];
  if (perlen) leiste += punkte(perlen, 84, 2.1, d, .65);
  if ([1, 4, 5, 6, 8, 9, 10, 11, 12].includes(i)) innen += `<circle cx="100" cy="100" r="71" fill="none" stroke="${kante}" stroke-width="1.3" opacity=".85"/>`;
  if ([5, 10, 11, 12].includes(i)) innen += `<circle cx="100" cy="100" r="67.5" fill="none" stroke="${kante}" stroke-width=".8" opacity=".6"/>`;
  if ([2, 7, 9].includes(i)) innen += punkte(36, 71, 1.25, kante);
  if (i === 8 || i === 11) leiste += punkte(i === 8 ? 8 : 16, 94, 3, h);
  if (i === 12) leiste += `<circle cx="100" cy="5" r="6.5" fill="${h}" stroke="${d}" stroke-width="1.2"/><circle cx="100" cy="5" r="2.6" fill="${C}"/>`;
  const [ax, ay] = pt(86, 200), [bx, by] = pt(86, 250);
  const beschriftung = name ? `role="img" aria-label="${String(name).replace(/[&<>"]/g, '')}"` : 'aria-hidden="true" focusable="false"';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 216 216" ${beschriftung}>
<defs><linearGradient id="${u}m" gradientUnits="userSpaceOnUse" x1="30" y1="14" x2="170" y2="186"><stop offset="0" stop-color="${h}"/><stop offset=".5" stop-color="${m}"/><stop offset="1" stop-color="${d}"/></linearGradient>
<radialGradient id="${u}l"><stop offset="0" stop-color="#FFF3CC" stop-opacity=".95"/><stop offset=".45" stop-color="#F6E3A6" stop-opacity=".45"/><stop offset="1" stop-color="#F6E3A6" stop-opacity="0"/></radialGradient>
<radialGradient id="${u}g"><stop offset=".62" stop-color="#F6E3A6" stop-opacity=".5"/><stop offset="1" stop-color="#F6E3A6" stop-opacity="0"/></radialGradient>
<radialGradient id="${u}f" cx=".38" cy=".3" r=".9"><stop offset="0" stop-color="${grund[0]}"/><stop offset=".6" stop-color="${grund[1]}"/><stop offset="1" stop-color="${grund[2]}"/></radialGradient></defs>
${hinten}<circle cx="100" cy="100" r="88" fill="${kante}" stroke="${d}" stroke-opacity=".5" stroke-width="1"/>${leiste}
<circle cx="100" cy="100" r="79" fill="${d}" opacity=".55"/><circle cx="100" cy="100" r="77" fill="url(#${u}f)"/>${innen}
<g transform="translate(100 100) scale(${SKALA[i]}) translate(-100 -100)">${zeichen(i, kante, C, u, h, d)}</g>
<path d="M${ax} ${ay} A86 86 0 0 1 ${bx} ${by}" fill="none" stroke="#FFFFFF" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>
</svg>`;
  return svg.replace(/(fill|stroke|stop-color)="(var\([^"]*\))"/g, 'style="$1:$2"');
}
