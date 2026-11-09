// Itqān · Rückblick als Bild: eine Woche oder ein Monat, zum Aufheben oder Teilen
// Die Zahlen kommen aus zustand.js (rueckblick). Hier: Texte dazu und das Bild auf einer Zeichenfläche (1080 × 1350).
import { zahl } from './daten.js';
import { RAENGE } from './zustand.js';

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const WT_LANG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const teile = d => d.split('-').map(Number);
const wochentag = d => { const [y, m, t] = teile(d); return (new Date(y, m - 1, t).getDay() + 6) % 7; };

// ---------- Texte ----------
export function zeitraumTitel(R) {
  const [y1, m1, t1] = teile(R.von), [y2, m2, t2] = teile(R.bis);
  if (R.art === 'monat') return `${MONATE[m1 - 1]} ${y1}`;
  if (y1 !== y2) return `${t1}. ${MONATE[m1 - 1]} ${y1} bis ${t2}. ${MONATE[m2 - 1]} ${y2}`;
  if (m1 !== m2) return `${t1}. ${MONATE[m1 - 1]} bis ${t2}. ${MONATE[m2 - 1]} ${y2}`;
  return `${t1}. bis ${t2}. ${MONATE[m2 - 1]} ${y2}`;
}
export function seitenText(x) {
  if (x < 0.75) return 'weniger als 1 Seite';
  if (x >= 10) return `etwa ${zahl(x)} Seiten`;
  const h = Math.round(x * 2) / 2;
  return `etwa ${h.toLocaleString('de-DE')} ${h === 1 ? 'Seite' : 'Seiten'}`;
}
export function dauerText(sek) {
  const m = Math.max(1, Math.round(sek / 60));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}
const mz = (n, eins, viele) => `${zahl(n)} ${n === 1 ? eins : viele}`;
// was im Zeitraum erreicht wurde, das Wichtigste zuerst
export function ereignisse(R) {
  const n = R.neu, l = [];
  if (n.rang) l.push(`Neuer Rang: ${RAENGE[n.rang].n}`);
  if (n.khatma) l.push(n.khatma === 1 ? 'Ḫatma vollendet' : `${n.khatma} Ḫatmāt vollendet`);
  if (n.kette) l.push(`Kette von ${n.kette} Tagen erreicht`);
  if (n.ornamente) l.push(n.ornamente === 1 ? '1 neues Ornament' : `${n.ornamente} neue Ornamente`);
  if (n.vergoldet) l.push(mz(n.vergoldet, 'Ornament', 'Ornamente') + ' vergoldet');
  if (R.vor.ayat > 0 && R.ayat > R.vor.ayat) l.push(`${zahl(R.ayat - R.vor.ayat)} Āyāt mehr als ${R.art === 'monat' ? 'im Monat' : 'in der Woche'} davor`);
  return l;
}
// die vier Kacheln: [Wert, Bezeichnung]
export function kacheln(R) {
  return [
    [`${R.voll} von ${R.wird}`, 'Wird erfüllt'],
    [R.quote == null ? '·' : `${Math.floor(R.quote)} %`, 'sicher'],
    R.kette != null ? [zahl(R.kette), R.kette === 1 ? 'Tag Kette' : 'Tage Kette'] : [zahl(R.folge), R.folge === 1 ? 'Tag in Folge' : 'Tage in Folge'],
    [zahl(R.punkte), 'Itqān-Punkte']
  ];
}
export const unterzeile = R => [seitenText(R.seiten), mz(R.abschnitte, 'Abschnitt', 'Abschnitte'), ...(R.zeit >= 30 ? [dauerText(R.zeit)] : [])].join(' · ');
// der ganze Rückblick in Sätzen: Bildbeschreibung für Bildschirmleser und Text unter dem Bild
export function beschreibung(R, name = '') {
  const kopf = `${R.art === 'monat' ? 'Rückblick auf den Monat' : 'Rückblick auf die Woche vom'} ${zeitraumTitel(R)}${name ? ' von ' + name : ''}.`;
  if (R.leer) return [kopf, 'In diesem Zeitraum wurde nicht geübt.'];
  const s = [kopf,
    `${mz(R.ayat, 'Āya', 'Āyāt')} wiederholt, das sind ${seitenText(R.seiten)} in ${mz(R.abschnitte, 'Abschnitt', 'Abschnitten')}.`,
    `An ${mz(R.geuebt, 'Tag', 'Tagen')} geübt, der Wird wurde an ${R.voll} von ${mz(R.wird, 'Tag', 'Tagen')} erfüllt${R.nach ? `, davon ${R.nach} am Tag danach nachgeholt` : ''}.`,
    `${Math.floor(R.quote)} % der Āyāt ohne Fehler und ohne Hilfe${R.f + R.h ? ` (${mz(R.f, 'Fehler', 'Fehler')}, ${R.h} mit Hilfe)` : ''}.`,
    `${zahl(R.punkte)} Itqān-Punkte${R.zeit >= 30 ? `, Übungszeit ${dauerText(R.zeit)}` : ''}.`,
    R.kette != null ? `Die Kette steht bei ${mz(R.kette, 'Tag', 'Tagen')}.` : `Längste Folge erfüllter Tage: ${R.folge}.`];
  if (R.bester && R.geuebt > 1) s.push(`Stärkster Tag: ${WT_LANG[wochentag(R.bester.d)]}, ${teile(R.bester.d)[2]}. ${MONATE[teile(R.bester.d)[1] - 1]}, mit ${mz(R.bester.ayat, 'Āya', 'Āyāt')}.`);
  const e = ereignisse(R).filter(x => !x.includes(' davor'));
  if (e.length) s.push(`Erreicht: ${e.join(', ')}.`);
  if (R.vor.ayat > 0 && (!R.laufend || R.ayat > R.vor.ayat)) s.push(R.ayat === R.vor.ayat ? `Gleich viele Āyāt wie ${R.art === 'monat' ? 'im Monat' : 'in der Woche'} davor.`
    : `${zahl(Math.abs(R.ayat - R.vor.ayat))} Āyāt ${R.ayat > R.vor.ayat ? 'mehr' : 'weniger'} als ${R.art === 'monat' ? 'im Monat' : 'in der Woche'} davor (${zahl(R.vor.ayat)}).`);
  return s;
}
export const dateiName = (R, name = '') => `Itqan-Rueckblick-${R.art === 'monat' ? R.von.slice(0, 7) : R.von}${name ? '-' + name.replace(/[^\p{L}\p{N}]+/gu, '_') : ''}.png`;

// ---------- Bild ----------
export const BILD = { b: 1080, h: 1350 };
const KOPF = (g, w = 600) => `${w} ${g}px "Itqan Ain", Alegreya, Georgia, serif`;
const TEXT = (g, w = 400) => `${w} ${g}px "Alegreya Sans", system-ui, sans-serif`;
const NISCHE = 'M272 820 V470 C272 330 392 230 512 176 C632 230 752 330 752 470 V820 H672 V488 C672 384 592 314 512 270 C432 314 352 384 352 488 V820 Z', FLAMME = 'M512 452 C576 532 600 596 578 652 C566 684 540 706 512 712 C484 706 458 684 446 652 C424 596 448 532 512 452 Z';

// Farben des gewählten Erscheinungsbildes (Lesestube oder Tezhip)
export function farbenLesen() {
  const st = getComputedStyle(document.documentElement), f = n => st.getPropertyValue('--' + n).trim();
  const dunkel = document.documentElement.dataset.modus === 'dunkel';
  return { dunkel, bg: f('bg'), licht: dunkel ? '#17394a' : '#fbf3e2', text: f('text'), leise: f('leise'), akzent: dunkel ? f('akzent2') : f('akzent'), linie: f('akzent'),
    auf: f('aufAkzent'), z1: f('z1'), z2: f('z2'), flaeche: dunkel ? 'rgba(255,255,255,.055)' : '#fbf4e4', rand: dunkel ? 'rgba(212,175,106,.3)' : '#e1cfae' };
}
// Schriften laden, bevor gezeichnet wird (sonst zeichnet der Browser mit der Ersatzschrift)
export async function schriftenBereit(probe) {
  if (!document.fonts?.load) return;
  const text = probe + ' ʿʾ0123456789';
  try { await Promise.all([KOPF(60), KOPF(60, 700), TEXT(30), TEXT(30, 500), TEXT(30, 700)].map(f => document.fonts.load(f, text))); } catch (e) {}
}
function rund(c, x, y, b, h, r) {
  c.beginPath();
  if (c.roundRect) c.roundRect(x, y, b, h, r);
  else { c.moveTo(x + r, y); c.arcTo(x + b, y, x + b, y + h, r); c.arcTo(x + b, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + b, y, r); c.closePath(); }
}
// Text, der höchstens `breite` einnimmt: die Schrift wird nötigenfalls kleiner
function passend(c, text, x, y, breite, groesse, schrift) {
  let g = groesse; c.font = schrift(g);
  while (g > 18 && c.measureText(text).width > breite) { g -= 2; c.font = schrift(g); }
  c.fillText(text, x, y);
  return g;
}
function tagKreis(c, F, x, y, r, stand, inhalt) {
  c.save(); c.lineWidth = Math.max(3, r / 9);
  if (stand === 'voll') { c.fillStyle = F.akzent; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  else if (stand === 'nach') { c.strokeStyle = F.akzent; c.beginPath(); c.arc(x, y, r - c.lineWidth / 2, 0, 7); c.stroke(); }
  else if (stand === 'teil') {
    c.strokeStyle = F.akzent; c.beginPath(); c.arc(x, y, r - c.lineWidth / 2, 0, 7); c.stroke();
    c.fillStyle = F.akzent; c.globalAlpha = .38; c.beginPath(); c.arc(x, y, r - c.lineWidth, 0, Math.PI); c.fill();   // untere Hälfte
  }
  else if (stand === 'aus') { c.strokeStyle = F.leise; c.globalAlpha = .55; c.lineWidth = 2.5; c.beginPath(); c.arc(x, y, r - 1.5, 0, 7); c.stroke(); }
  else if (stand === 'ruhe') { c.fillStyle = F.leise; c.globalAlpha = .16; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  else { c.strokeStyle = F.leise; c.globalAlpha = .3; c.lineWidth = 2; c.setLineDash([6, 7]); c.beginPath(); c.arc(x, y, r - 1, 0, 7); c.stroke(); }
  c.restore();
  inhalt(stand === 'voll' ? F.auf : stand === 'nach' ? F.akzent : stand === 'teil' ? F.text : F.leise, stand === 'offen' || stand === 'vor' ? .45 : 1);
}
const haken = (c, x, y, g) => { c.beginPath(); c.moveTo(x - g * .42, y + g * .02); c.lineTo(x - g * .1, y + g * .32); c.lineTo(x + g * .44, y - g * .3); c.stroke(); };

// R: Ergebnis von Z.rueckblick, F: Farben (farbenLesen), name: steht im Kopf, wenn gewünscht
export function zeichnen(cv, R, F, name = '') {
  const B = BILD.b, H = BILD.h, c = cv.getContext('2d'), mitte = B / 2, monat = R.art === 'monat';
  cv.width = B; cv.height = H;
  // Grund mit Lichtschein von oben, doppelter Rahmen
  c.fillStyle = F.bg; c.fillRect(0, 0, B, H);
  const g = c.createRadialGradient(mitte, -160, 0, mitte, -160, 1100); g.addColorStop(0, F.licht); g.addColorStop(1, F.bg);
  c.fillStyle = g; c.fillRect(0, 0, B, H);
  c.strokeStyle = F.linie; c.globalAlpha = .55; c.lineWidth = 2.5; rund(c, 30, 30, B - 60, H - 60, 44); c.stroke();
  c.globalAlpha = .22; c.lineWidth = 1.5; rund(c, 42, 42, B - 84, H - 84, 34); c.stroke(); c.globalAlpha = 1;
  // Kopf: Zeichen, Name der App, rechts die Art
  const zh = 84, zs = zh / 684, zx = 86, zy = 84;
  c.save(); c.translate(zx - 232 * zs, zy - 156 * zs); c.scale(zs, zs);
  const zg = c.createLinearGradient(0, 156, 0, 840); zg.addColorStop(0, F.z1); zg.addColorStop(1, F.z2); c.fillStyle = zg;
  c.fill(new Path2D(NISCHE)); c.fill(new Path2D(FLAMME)); c.restore();
  c.textBaseline = 'alphabetic'; c.textAlign = 'left'; c.fillStyle = F.akzent; c.font = KOPF(58); c.fillText('Itqān', zx + 86, zy + 66);
  c.textAlign = 'right'; c.fillStyle = F.leise; c.font = TEXT(30, 500);
  try { c.letterSpacing = '4px'; } catch (e) {}
  c.fillText(monat ? 'MONATSRÜCKBLICK' : 'WOCHENRÜCKBLICK', B - 86, zy + 60);
  try { c.letterSpacing = '0px'; } catch (e) {}
  // Titel
  let y = monat ? 258 : 282;
  c.textAlign = 'center'; c.fillStyle = F.text; passend(c, zeitraumTitel(R), mitte, y, B - 180, monat ? 70 : 64, KOPF);
  if (name) { y += 50; c.fillStyle = F.leise; passend(c, name, mitte, y, B - 220, 36, x => TEXT(x, 500)); }
  // große Zahl
  const gz = monat ? 150 : 200;
  y += (name ? 0 : 20) + gz * .93;
  c.fillStyle = F.akzent; passend(c, R.leer ? '0' : zahl(R.ayat), mitte, y, B - 200, gz, KOPF);
  y += monat ? 52 : 62; c.fillStyle = F.text; c.font = KOPF(monat ? 40 : 46); c.fillText(R.ayat === 1 ? 'Āya wiederholt' : 'Āyāt wiederholt', mitte, y);
  y += monat ? 44 : 50; c.fillStyle = F.leise; passend(c, R.leer ? 'In diesem Zeitraum wurde nicht geübt.' : unterzeile(R), mitte, y, B - 180, 32, TEXT);
  // Tage
  if (monat) {
    const versatz = wochentag(R.von), reihen = Math.ceil((versatz + R.tage.length) / 7);
    const sp = 124, x0 = mitte - 3 * sp, r = reihen > 5 ? 26 : 27, zeile = reihen > 5 ? 58 : 64;   // sechs Kalenderzeilen rücken enger, damit unten eine Zeile Platz bleibt
    y += 58; c.font = TEXT(26, 500); c.fillStyle = F.leise;
    WT.forEach((w, i) => c.fillText(w, x0 + i * sp, y));
    y += 46;
    R.tage.forEach((t, i) => {
      const x = x0 + ((versatz + i) % 7) * sp, yy = y + Math.floor((versatz + i) / 7) * zeile;
      tagKreis(c, F, x, yy, r, t.stand, (farbe, a) => { c.save(); c.globalAlpha = a; c.fillStyle = farbe; c.font = TEXT(26, t.stand === 'voll' ? 700 : 500); c.textBaseline = 'middle'; c.fillText(String(i + 1), x, yy + 2); c.restore(); });
    });
    y += (reihen - 1) * zeile + r;
  } else {
    const sp = 134, x0 = mitte - 3 * sp, r = 50;
    y += 72; c.font = TEXT(30, 500); c.fillStyle = F.leise;
    WT.forEach((w, i) => c.fillText(w, x0 + i * sp, y));
    y += 76;
    R.tage.forEach((t, i) => {
      const x = x0 + i * sp;
      tagKreis(c, F, x, y, r, t.stand, (farbe, a) => {
        c.save(); c.globalAlpha = a;
        if (t.stand === 'voll' || t.stand === 'nach') { c.strokeStyle = farbe; c.lineWidth = 7; c.lineCap = 'round'; c.lineJoin = 'round'; haken(c, x, y, 40); }
        else if (t.stand === 'ruhe') { c.fillStyle = farbe; c.font = TEXT(26); c.textBaseline = 'middle'; c.fillText('Ruhe', x, y + 2); }
        c.restore();
      });
      if (t.ayat) { c.fillStyle = F.leise; c.font = TEXT(28); c.fillText(zahl(t.ayat), x, y + r + 40); }
    });
    y += r + 40;
  }
  // Legende
  y += monat ? 46 : 56;
  const leg = [['voll', 'Wird erfüllt'], ...(R.tage.some(t => t.stand === 'nach') ? [['nach', 'nachgeholt']] : []), ...(R.tage.some(t => t.stand === 'teil') ? [['teil', 'zum Teil']] : []), ...(R.tage.some(t => t.stand === 'ruhe') ? [['ruhe', 'Ruhetag']] : []), ...(R.tage.some(t => t.stand === 'aus') ? [['aus', 'ausgefallen']] : [])];
  c.font = TEXT(26); c.textAlign = 'left';
  const lb = leg.map(([, t]) => 34 + c.measureText(t).width), ges = lb.reduce((a, b) => a + b, 0) + 36 * (leg.length - 1);
  let lx = mitte - ges / 2;
  leg.forEach(([st, t], i) => { tagKreis(c, F, lx + 11, y - 9, 11, st, () => {}); c.fillStyle = F.leise; c.font = TEXT(26); c.textAlign = 'left'; c.fillText(t, lx + 34, y); lx += lb[i] + 36; });
  // vier Kacheln
  const kb = 222, kh = monat ? 132 : 150, luecke = 20, kx = mitte - (4 * kb + 3 * luecke) / 2;
  y += monat ? 30 : 44;
  kacheln(R).forEach(([wert, wort], i) => {
    const x = kx + i * (kb + luecke);
    c.fillStyle = F.flaeche; rund(c, x, y, kb, kh, 26); c.fill(); c.strokeStyle = F.rand; c.lineWidth = 2; c.stroke();
    c.textAlign = 'center'; c.fillStyle = F.akzent; passend(c, wert, x + kb / 2, y + kh * .48, kb - 28, monat ? 54 : 60, KOPF);
    c.fillStyle = F.leise; passend(c, wort, x + kb / 2, y + kh * .48 + (monat ? 40 : 46), kb - 20, 28, TEXT);
  });
  y += kh;
  // erreicht: höchstens drei Zeilen, so viele wie Platz ist
  const fuss = H - 78, platz = fuss - 50 - y, zh2 = 46, er = ereignisse(R).slice(0, Math.max(0, Math.min(3, Math.floor(platz / zh2))));
  let ey = y + (platz - er.length * zh2) / 2 + 34;
  c.textAlign = 'center';
  for (const e of er) {
    c.font = TEXT(32, 500); const b = c.measureText(e).width;
    c.fillStyle = F.akzent; c.save(); c.translate(mitte - b / 2 - 24, ey - 11); c.rotate(Math.PI / 4); c.fillRect(-6, -6, 12, 12); c.restore();
    c.fillStyle = F.text; c.fillText(e, mitte, ey); ey += zh2;
  }
  // Fuß
  c.strokeStyle = F.linie; c.globalAlpha = .3; c.lineWidth = 1.5; c.beginPath(); c.moveTo(mitte - 150, fuss - 44); c.lineTo(mitte + 150, fuss - 44); c.stroke(); c.globalAlpha = 1;
  c.fillStyle = F.leise; c.font = TEXT(28); c.fillText('Itqān · die Murāǧaʿa des ganzen Qurʾāns', mitte, fuss);
  return cv;
}
