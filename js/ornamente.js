// Itqān · 114 Ornamente, eines je Sūra. Jedes wird aus Sūra-Nummer und Länge erzeugt (kein Bild, reines SVG):
// kurze Sūren eine Blüte (so viele Blätter wie Āyāt, wenn es höchstens zwölf sind), mittlere ein Medaillon mit Bögen,
// lange ein Medaillon mit Sternflechtband und Strahlen, die sieben längsten eine große Šamsa wie im Tezhip.
import { D, arZahl } from './daten.js';

// Farbklänge nach Tezhip und İznik: Grund (innen, außen), Hauptfarbe, Zweitfarbe, Akzent
const PAL = [
  { n: 'Lapislazuli', g: ['#24477f', '#132a52'], a: '#4a7fd0', b: '#a9c8f0', c: '#e9c56b' },
  { n: 'Türkis', g: ['#13696c', '#0a4043'], a: '#33aaa5', b: '#a6e3da', c: '#f0c76a' },
  { n: 'Karmin', g: ['#8a2431', '#55131d'], a: '#cf4b56', b: '#f6b3ad', c: '#f2cf78' },
  { n: 'Smaragd', g: ['#1d5d3c', '#0f3823'], a: '#45a46b', b: '#b2e0bc', c: '#ecc96c' },
  { n: 'Indigo', g: ['#353071', '#1c1946'], a: '#7466cc', b: '#c3baf3', c: '#ebc86f' },
  { n: 'Safran', g: ['#93521a', '#5c310b'], a: '#df9535', b: '#f8d79a', c: '#fff1c4' },
  { n: 'Rosenholz', g: ['#7e3654', '#4f1f35'], a: '#cc6890', b: '#f5bfd1', c: '#f1d081' },
  { n: 'İznik', g: ['#fbf4e3', '#eadbbb'], a: '#2457a6', b: '#c4402f', c: '#2b8c7d', hell: 1 },
  { n: 'Petrol', g: ['#17505a', '#0b2e34'], a: '#e3805f', b: '#f5ccb0', c: '#e8c76f' },
  { n: 'Pflaume', g: ['#552350', '#30112c'], a: '#a7579d', b: '#e2b3da', c: '#efc871' },
  { n: 'Oliv', g: ['#555e24', '#323712'], a: '#99a542', b: '#dde2a3', c: '#f2d27b' },
  { n: 'Himmel', g: ['#30709c', '#1b4566'], a: '#71b1dc', b: '#d4e9f7', c: '#f3d27e' },
  { n: 'Elfenbein', g: ['#fcf6e7', '#efe2c3'], a: '#b77d2c', b: '#3f6f9f', c: '#a3402f', hell: 1 },
  { n: 'Jade', g: ['#2d6a5a', '#173d33'], a: '#d9a441', b: '#9fd3c0', c: '#f6e3a4' }
];
const FORMEN = ['mandel', 'kolben', 'spitz', 'tulpe', 'herz'];

const f = x => Math.round(x * 100) / 100;
const pol = (r, w) => `${f(r * Math.cos(w))} ${f(r * Math.sin(w))}`;   // w im Bogenmaß, 0 = oben (siehe -PI/2 unten)
const RAD = Math.PI / 180;

// Größe 1 bis 5 je Sūra nach ihrer Länge im Druck 1405 (Zeilen durch 15, auf ganze Seiten gerundet):
// 1 = unter einer Seite, 2 = 1 bis 4 Seiten, 3 = 5 bis 9, 4 = 10 bis 20, 5 = über 20 Seiten. al-Fātiḥah hat ausnahmsweise Größe 3.
const GROESSE = '155555545444333444344434343433224333333433322322222222222222222222222222222222221121111121111111111111111111111111';
export const groesse = s => +GROESSE[s - 1];
// Gestalt des Ornaments: 1 Blüte, 2 Medaillon mit Bögen, 3 Medaillon mit Sternflechtband und Strahlen, 4 große Šamsa
export const klasse = s => s === 1 ? 4 : [0, 1, 2, 3, 3, 4][groesse(s)];
export const KLASSEN_TEXT = ['', 'Eine Blüte', 'Ein Medaillon mit Bögen', 'Ein Medaillon mit Sternflechtband und Strahlen', 'Eine große Šamsa (Sonnenmedaillon) für eine der sieben längsten Sūren'];

// Parameter je Sūra, so verteilt, dass keine zwei Ornamente gleich sind und Nachbarn verschiedene Farben haben
let PARAM = null;
function parameter() {
  if (PARAM) return PARAM;
  PARAM = []; const belegt = new Set();
  for (let s = 1; s <= 114; s++) {
    const k = klasse(s), ayat = D.S[s][2];
    const blaetter = k === 1 && ayat >= 3 && ayat <= 12 ? ayat : s === 1 ? 7 : [8, 10, 12, 16][(s * 7) % (k >= 3 ? 4 : 3)];
    let pal = (s * 5) % PAL.length, form = (s * 3 + Math.floor(s / 5)) % FORMEN.length, rand = s % 3, form2 = (form + 2 + (s % 2)) % FORMEN.length;
    let sig = () => [k, blaetter, pal, form, form2, rand].join('|');
    while (belegt.has(sig())) { form = (form + 1) % FORMEN.length; if (belegt.has(sig())) rand = (rand + 1) % 3; }
    belegt.add(sig());
    PARAM[s] = { k, blaetter, pal: PAL[pal], form, form2, rand, ayat, stern: { 7: 3, 8: 3, 10: 3, 12: 5, 16: 6 }[blaetter] || 3 };
  }
  return PARAM;
}

// ---------- Bausteine ----------
// Blatt entlang der x-Achse von r0 bis r1 mit halber Breite w (wird danach gedreht)
function blatt(form, r0, r1, w) {
  const L = r1 - r0, m = (r0 + r1) / 2;
  switch (form) {
    case 'mandel': return `M${f(r0)} 0Q${f(m)} ${f(-w * 2)} ${f(r1)} 0Q${f(m)} ${f(w * 2)} ${f(r0)} 0Z`;
    case 'kolben': return `M${f(r0)} 0C${f(r0 + L * .4)} ${f(-w * .25)} ${f(r1)} ${f(-w * 1.25)} ${f(r1)} 0C${f(r1)} ${f(w * 1.25)} ${f(r0 + L * .4)} ${f(w * .25)} ${f(r0)} 0Z`;
    case 'spitz': return `M${f(r0)} 0C${f(r0 + L * .2)} ${f(-w * 1.35)} ${f(r1 - L * .45)} ${f(-w * 1.1)} ${f(r1)} 0C${f(r1 - L * .45)} ${f(w * 1.1)} ${f(r0 + L * .2)} ${f(w * 1.35)} ${f(r0)} 0Z`;
    case 'tulpe': return `M${f(r0)} 0C${f(r0 + L * .3)} ${f(-w * 1.15)} ${f(r1 - L * .35)} ${f(-w * 1.45)} ${f(r1 - L * .1)} ${f(-w * 1.05)}Q${f(r1 - L * .32)} ${f(-w * .35)} ${f(r1)} 0Q${f(r1 - L * .32)} ${f(w * .35)} ${f(r1 - L * .1)} ${f(w * 1.05)}C${f(r1 - L * .35)} ${f(w * 1.45)} ${f(r0 + L * .3)} ${f(w * 1.15)} ${f(r0)} 0Z`;
    default: return `M${f(r0)} 0C${f(r0 + L * .15)} ${f(-w * 1.5)} ${f(r1 + L * .04)} ${f(-w * 1.55)} ${f(r1)} ${f(-w * .28)}L${f(r1 - L * .17)} 0L${f(r1)} ${f(w * .28)}C${f(r1 + L * .04)} ${f(w * 1.55)} ${f(r0 + L * .15)} ${f(w * 1.5)} ${f(r0)} 0Z`;
  }
}
// n Blätter im Kreis, mit innerer Ader in der Zweitfarbe
function rosette(id, n, form, r0, r1, w, farbe, ader, gold, dreh = 0, linie = .8) {
  const pid = id + 'b' + (++zaehler);
  let s = `<defs><g id="${pid}"><path d="${blatt(form, r0, r1, w)}" fill="${farbe}" stroke="${gold}" stroke-width="${linie}"/>`;
  if (ader) s += `<path d="${blatt(form, r0 + (r1 - r0) * .22, r1 - (r1 - r0) * .16, w * .42)}" fill="${ader}" opacity=".9"/>`;
  s += `</g></defs>`;
  for (let i = 0; i < n; i++) s += `<use href="#${pid}" transform="rotate(${f(dreh - 90 + i * 360 / n)})"/>`;
  return s;
}
function sternPfad(n, R, r, dreh = 0) {
  let d = '';
  for (let i = 0; i < 2 * n; i++) d += (i ? 'L' : 'M') + pol(i % 2 ? r : R, (dreh - 90) * RAD + i * Math.PI / n);
  return d + 'Z';
}
// Sternflechtband {n/k}: Linien zwischen jedem k-ten Punkt
function flechtstern(n, k, R) {
  let d = '';
  const ggt = (a, b) => b ? ggt(b, a % b) : a, g = ggt(n, k);
  for (let st = 0; st < g; st++) {
    let i = st; d += 'M' + pol(R, -Math.PI / 2 + i * 2 * Math.PI / n);
    do { i = (i + k) % n; d += 'L' + pol(R, -Math.PI / 2 + i * 2 * Math.PI / n); } while (i !== st);
    d += 'Z';
  }
  return d;
}
// Bogenrand: n Bögen nach außen um den Radius r
function boegen(n, r, tiefe) {
  let d = '';
  for (let i = 0; i <= n; i++) {
    const p = pol(r, -Math.PI / 2 + i * 2 * Math.PI / n);
    if (!i) d += 'M' + p; else { const sehne = 2 * r * Math.sin(Math.PI / n); d += `A${f(sehne / 2 + tiefe)} ${f(sehne / 2 + tiefe)} 0 0 1 ${p}`; }
  }
  return d + 'Z';
}
const perlen = (n, r, g, farbe, dreh = 0) => Array.from({ length: n }, (_, i) => { const [x, y] = pol(r, (dreh - 90) * RAD + i * 2 * Math.PI / n).split(' '); return `<circle cx="${x}" cy="${y}" r="${g}" fill="${farbe}"/>`; }).join('');
// Strahlen (Tığ): schmale Spitzen nach außen, abwechselnd lang und kurz
function strahlen(n, r0, lang, kurz, breite, farbe) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const w = -Math.PI / 2 + i * 2 * Math.PI / n, r1 = i % 2 ? kurz : lang, b = breite * (i % 2 ? .7 : 1) / r0;
    s += `<path d="M${pol(r0, w - b)}L${pol(r1, w)}L${pol(r0, w + b)}Z" fill="${farbe}"/>`;
  }
  return s;
}
function mitte(id, s, r, P, gold) {
  const z = arZahl(s), gr = z.length === 1 ? r * 1.3 : z.length === 2 ? r * 1.15 : r * .92;
  return `<circle r="${f(r + 2.4)}" fill="${gold}"/><circle r="${f(r)}" fill="url(#${id}m)"/>`
    + `<text y="${f(gr * .34)}" text-anchor="middle" font-family="'Geeza Pro','Noto Naskh Arabic','Traditional Arabic','Segoe UI',Tahoma,serif" font-weight="600" font-size="${f(gr)}" fill="${P.hell ? P.a : '#f6e3a4'}">${z}</text>`;
}

let zaehler = 0;
// stufe: 0 = noch nicht gesammelt, 2 = gesammelt (gefestigt), 4 = vergoldet (mutqan)
export function ornamentSVG(s, stufe = 2, klasseCss = '') {
  const p = parameter()[s], P = p.pal, id = 'o' + s + '_' + (++zaehler);
  const gold = `url(#${id}g)`, n = p.blaetter, F = FORMEN[p.form], F2 = FORMEN[p.form2];
  const defs = `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbeab0"/><stop offset=".45" stop-color="#d8b05a"/><stop offset="1" stop-color="#8f6526"/></linearGradient>
    <radialGradient id="${id}r"><stop offset="0" stop-color="${P.g[0]}"/><stop offset="1" stop-color="${P.g[1]}"/></radialGradient>
    <radialGradient id="${id}m"><stop offset="0" stop-color="${P.hell ? '#fffaf0' : P.g[0]}"/><stop offset="1" stop-color="${P.hell ? P.g[1] : P.g[1]}"/></radialGradient></defs>`;
  const bw = (r0, r1, m = n) => Math.min((r1 - r0) * .2, Math.PI * (r0 + r1) / 2 / m * .48);   // Blattbreite, die nicht überlappt
  let k = '';
  if (p.k === 1) {
    k += `<circle r="86" fill="url(#${id}r)" stroke="${gold}" stroke-width="2.4"/>`;
    k += p.rand === 0 ? perlen(28, 92.5, 2.3, gold) : p.rand === 1 ? `<circle r="92" fill="none" stroke="${gold}" stroke-width="1.4"/><circle r="95.5" fill="none" stroke="${gold}" stroke-width=".7"/>`
      : `<path d="${boegen(24, 88, 2)}" fill="none" stroke="${gold}" stroke-width="1.3"/>`;
    const m = n < 6 ? n * 2 : n;
    k += `<path d="${sternPfad(m, 76, 44, 180 / m)}" fill="${P.b}" opacity=".2" stroke="${gold}" stroke-width=".7"/>`;
    k += rosette(id, n, FORMEN[p.form2], 24, 52, Math.min(n < 6 ? 12 : 7, Math.PI * 38 / n * .4), P.c, null, gold, 180 / n, .5);
    k += rosette(id, n, F, 20, 79, Math.min(n < 6 ? 19 : 15, Math.min((79 - 20) * .32, Math.PI * 49.5 / n * .5)), P.a, P.b, gold);
    k += perlen(n, 80, 2.4, P.c, 180 / n);
    k += mitte(id, s, 15, P, gold);
  } else if (p.k === 2) {
    k += `<path d="${boegen(n >= 12 ? n : n * 2, 84, 3)}" fill="url(#${id}r)" stroke="${gold}" stroke-width="2.2"/>`;
    k += p.rand === 2 ? strahlen(n * 2, 86, 97, 93, 2.2, P.a) : perlen(n * 2, 93, 2, gold, 180 / (n * 2));
    k += `<path d="${sternPfad(n, 76, 52, 180 / n)}" fill="${P.b}" opacity=".22" stroke="${gold}" stroke-width=".8"/>`;
    k += rosette(id, n, F, 19, 72, bw(19, 72) * 1.05, P.a, P.b, gold);
    k += rosette(id, n, F2, 24, 50, bw(24, 50) * .8, P.c, null, gold, 180 / n, .6);
    k += `<circle r="80" fill="none" stroke="${gold}" stroke-width=".7" stroke-dasharray="1.5 2.5"/>`;
    k += mitte(id, s, 15.5, P, gold);
  } else if (p.k === 3) {
    k += strahlen(n * 3, 85, 99, 94, 2.4, P.a);
    k += `<circle r="86" fill="url(#${id}r)"/><circle r="86" fill="none" stroke="${gold}" stroke-width="2.6"/><circle r="81.5" fill="none" stroke="${gold}" stroke-width=".8"/>`;
    k += rosette(id, n * 2, F2, 63, 80, bw(63, 80, n * 2) * .9, P.b, null, gold, 0, .6);
    k += `<path d="${flechtstern(n, p.stern, 60)}" fill="none" stroke="${gold}" stroke-width="1.7" stroke-linejoin="round"/>`;
    k += rosette(id, n, F, 17, 58, bw(17, 58) * .95, P.a, P.b, gold, 180 / n);
    k += `<path d="${sternPfad(n, 26, 18.5)}" fill="${gold}"/>`;
    k += mitte(id, s, 15, P, gold);
  } else {
    // große Šamsa
    k += strahlen(n * 4, 81, 98, 91, 2.6, P.a);
    k += perlen(n * 4, 92.5, 1.1, gold, 45 / n);
    k += `<path d="${boegen(n * 2, 82, 2.5)}" fill="${gold}"/><path d="${boegen(n * 2, 78.5, 2.5)}" fill="url(#${id}r)"/>`;
    k += perlen(n * 3, 74.5, 1.6, gold);
    k += rosette(id, n * 2, 'tulpe', 54, 71, bw(54, 71, n * 2) * .95, P.b, null, gold, 0, .55);
    k += `<path d="${flechtstern(n, p.stern, 54)}" fill="none" stroke="${gold}" stroke-width="2.4" stroke-linejoin="round"/>`;
    k += `<path d="${flechtstern(n, p.stern, 54)}" fill="none" stroke="${P.g[1]}" stroke-width=".7" stroke-linejoin="round"/>`;
    k += rosette(id, n, F, 18, 52, bw(18, 52) * 1.05, P.a, P.b, gold, 180 / n, .9);
    k += rosette(id, n, F2, 21, 37, bw(21, 37) * .7, P.c, null, gold, 0, .5);
    k += `<path d="${sternPfad(n, 25, 18)}" fill="${gold}"/>`;
    k += mitte(id, s, 15, P, gold);
  }
  if (stufe >= 4) k += `<circle r="${p.k >= 3 ? 99 : 98}" fill="none" stroke="${gold}" stroke-width="2.2"/>`;
  return `<svg class="ornament k${p.k}${stufe ? '' : ' zu'}${stufe >= 4 ? ' gold' : ''}${klasseCss ? ' ' + klasseCss : ''}" viewBox="-101 -101 202 202" role="img" aria-label="Ornament Sūra ${s}">${defs}${k}</svg>`;
}
export const ornamentInfo = s => { const p = parameter()[s]; return { klasse: p.k, blaetter: p.blaetter, ayat: p.ayat, farbe: p.pal.n }; };
