// Itqān · Rückblick als Bild: eine Woche oder ein Monat, zum Aufheben oder Teilen
// Die Zahlen kommen aus zustand.js (rueckblick). Hier: Texte dazu und das Bild auf einer Zeichenfläche (1080 × 1350).
import { zahl, prozent } from './daten.js';
import { RAENGE } from './zustand.js';
import { tx, gebiet } from './sprache.js';

const MONATE = [tx('rueckblick.januar'), tx('rueckblick.februar'), tx('rueckblick.maerz'), tx('rueckblick.april'), tx('rueckblick.mai'), tx('rueckblick.juni'), tx('rueckblick.juli'), tx('rueckblick.august'), tx('rueckblick.september'), tx('rueckblick.oktober'), tx('rueckblick.november'), tx('rueckblick.dezember')];
const WT = [tx('rueckblick.mo'), tx('rueckblick.di'), tx('rueckblick.mi'), tx('rueckblick.do'), tx('rueckblick.fr'), tx('rueckblick.sa'), tx('rueckblick.so')];
const WT_LANG = [tx('rueckblick.montag'), tx('rueckblick.dienstag'), tx('rueckblick.mittwoch'), tx('rueckblick.donnerstag'), tx('rueckblick.freitag'), tx('rueckblick.samstag'), tx('rueckblick.sonntag')];
const teile = d => d.split('-').map(Number);
const wochentag = d => { const [y, m, t] = teile(d); return (new Date(y, m - 1, t).getDay() + 6) % 7; };

// ---------- Texte ----------
export function zeitraumTitel(R) {
  const [y1, m1, t1] = teile(R.von), [y2, m2, t2] = teile(R.bis);
  const w = { t1, t2, y1, y2, m1: MONATE[m1 - 1], m2: MONATE[m2 - 1] };
  if (R.art === 'monat') return tx('rueckblick.spanne_monat', w);
  if (y1 !== y2) return tx('rueckblick.spanne_jahre', w);
  if (m1 !== m2) return tx('rueckblick.spanne_monate', w);
  return tx('rueckblick.spanne_tage', w);
}
export function seitenText(x) {
  if (x < 0.75) return tx('rueckblick.weniger_als_1_seite');
  if (x >= 10) return tx('rueckblick.etwa_seiten', { x: zahl(x) });
  const h = Math.round(x * 2) / 2;
  return tx('rueckblick.etwa_seiten_2', { h: h.toLocaleString(gebiet('zahl')), n: h });
}
export function dauerText(sek) {
  const m = Math.max(1, Math.round(sek / 60));
  return m < 60 ? tx('rueckblick.min', { m }) : tx('rueckblick.h_min', { a: Math.floor(m / 60), b: m % 60 });
}
// Zahl und Zählwort: die Meldung wählt die Form nach den Regeln der Sprache, {z} ist die Zahl in ihrer Schreibweise
const mz = n => ({ z: zahl(n), n });
// was im Zeitraum erreicht wurde, das Wichtigste zuerst
export function ereignisse(R, vergleich = true) {
  const n = R.neu, l = [];
  if (n.rang) l.push(tx('rueckblick.neuer_rang', { n: RAENGE[n.rang].n }));
  if (n.khatma) l.push(n.khatma === 1 ? tx('rueckblick.hatma_vollendet') : tx('rueckblick.hatmat_vollendet', { khatma: n.khatma }));
  if (n.kette) l.push(tx('rueckblick.kette_von_tagen_erreicht', { kette: n.kette }));
  if (n.ornamente) l.push(n.ornamente === 1 ? tx('rueckblick.1_neues_ornament') : tx('rueckblick.neue_ornamente', { ornamente: n.ornamente }));
  if (n.vergoldet) l.push(tx('rueckblick.vergoldet', { vergoldet: tx('rueckblick.z_ornamente', mz(n.vergoldet)) }));
  if (vergleich && R.vor.ayat > 0 && R.ayat > R.vor.ayat) l.push(tx('rueckblick.ayat_mehr_als_davor', { a: zahl(R.ayat - R.vor.ayat), b: R.art === 'monat' ? tx('rueckblick.im_monat') : tx('rueckblick.in_der_woche') }));
  return l;
}
// die vier Kacheln: [Wert, Bezeichnung]
export function kacheln(R) {
  return [
    [tx('rueckblick.von', { voll: R.voll, wird: R.wird }), tx('rueckblick.wird_erfuellt')],
    [R.quote == null ? '·' : prozent(Math.floor(R.quote)), tx('allg.sicher')],
    R.kette != null ? [zahl(R.kette), tx('rueckblick.tage_kette', { n: R.kette })] : [zahl(R.folge), tx('rueckblick.tage_in_folge', { n: R.folge })],
    [zahl(R.punkte), tx('allg.itqan_punkte')]
  ];
}
export const unterzeile = R => [seitenText(R.seiten), tx('rueckblick.z_abschnitte', mz(R.abschnitte)), ...(R.zeit >= 30 ? [dauerText(R.zeit)] : [])].join(' · ');
// der ganze Rückblick in Sätzen: Bildbeschreibung für Bildschirmleser und Text unter dem Bild
export function beschreibung(R, name = '') {
  const kopf = `${R.art === 'monat' ? tx('rueckblick.rueckblick_auf_den_monat') : tx('rueckblick.rueckblick_auf_die_woche_vom')} ${zeitraumTitel(R)}${name ? ` ${tx('rueckblick.von_2', { name })}` : ''}.`;
  if (R.leer) return [kopf, tx('rueckblick.in_diesem_zeitraum_wurde_nicht_geuebt')];
  const s = [kopf,
    tx('rueckblick.wiederholt_das_sind_in', { ayat: tx('rueckblick.z_ayat', mz(R.ayat)), seiten: seitenText(R.seiten), abschnitte: tx('rueckblick.z_abschnitten', mz(R.abschnitte)) }),
    tx('rueckblick.an_geuebt_der_wird_wurde_an_von_erfuellt', { geuebt: tx('rueckblick.z_tagen', mz(R.geuebt)), voll: R.voll, wird: tx('rueckblick.z_tagen', mz(R.wird)), a: R.nach ? tx('rueckblick.davon_am_tag_danach_nachgeholt', { nach: R.nach }) : '' }),
    tx('rueckblick.der_ayat_ohne_fehler_und_ohne_hilfe', { quote: Math.floor(R.quote), a: R.f + R.h ? ` ${tx('rueckblick.mit_hilfe', { f: tx('rueckblick.z_fehler', mz(R.f)), h: R.h })}` : '' }),
    tx('rueckblick.itqan_punkte', { punkte: zahl(R.punkte), a: R.zeit >= 30 ? tx('rueckblick.uebungszeit', { zeit: dauerText(R.zeit) }) : '' }),
    R.kette != null ? tx('rueckblick.die_kette_steht_bei', { kette: tx('rueckblick.z_tagen', mz(R.kette)) }) : tx('rueckblick.laengste_folge_erfuellter_tage', { folge: R.folge })];
  if (R.bester && R.geuebt > 1) s.push(tx('rueckblick.staerkster_tag_mit', { a: WT_LANG[wochentag(R.bester.d)], b: teile(R.bester.d)[2], c: MONATE[teile(R.bester.d)[1] - 1], ayat: tx('rueckblick.z_ayat', mz(R.bester.ayat)) }));
  const e = ereignisse(R, false);
  if (e.length) s.push(tx('rueckblick.erreicht', { e: e.join(', ') }));
  if (R.vor.ayat > 0 && (!R.laufend || R.ayat > R.vor.ayat)) s.push(R.ayat === R.vor.ayat ? tx('rueckblick.gleich_viele_ayat_wie_davor', { a: R.art === 'monat' ? tx('rueckblick.im_monat') : tx('rueckblick.in_der_woche') })
    : tx('rueckblick.ayat_als_davor', { a: zahl(Math.abs(R.ayat - R.vor.ayat)), b: R.ayat > R.vor.ayat ? tx('rueckblick.mehr') : tx('rueckblick.weniger'), c: R.art === 'monat' ? tx('rueckblick.im_monat') : tx('rueckblick.in_der_woche'), ayat: zahl(R.vor.ayat) }));
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
  c.textBaseline = 'alphabetic'; c.textAlign = 'left'; c.fillStyle = F.akzent; c.font = KOPF(58); c.fillText(tx('allg.itqan'), zx + 86, zy + 66);
  c.textAlign = 'right'; c.fillStyle = F.leise; c.font = TEXT(30, 500);
  try { c.letterSpacing = '4px'; } catch (e) {}
  c.fillText(monat ? tx('rueckblick.monatsrueckblick') : tx('rueckblick.wochenrueckblick'), B - 86, zy + 60);
  try { c.letterSpacing = '0px'; } catch (e) {}
  // Titel
  let y = monat ? 258 : 282;
  c.textAlign = 'center'; c.fillStyle = F.text; passend(c, zeitraumTitel(R), mitte, y, B - 180, monat ? 70 : 64, KOPF);
  if (name) { y += 50; c.fillStyle = F.leise; passend(c, name, mitte, y, B - 220, 36, x => TEXT(x, 500)); }
  // große Zahl
  const gz = monat ? 150 : 200;
  y += (name ? 0 : 20) + gz * .93;
  c.fillStyle = F.akzent; passend(c, R.leer ? '0' : zahl(R.ayat), mitte, y, B - 200, gz, KOPF);
  y += monat ? 52 : 62; c.fillStyle = F.text; c.font = KOPF(monat ? 40 : 46); c.fillText(tx('rueckblick.ayat_wiederholt', { n: R.ayat }), mitte, y);
  y += monat ? 44 : 50; c.fillStyle = F.leise; passend(c, R.leer ? tx('rueckblick.in_diesem_zeitraum_wurde_nicht_geuebt') : unterzeile(R), mitte, y, B - 180, 32, TEXT);
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
        else if (t.stand === 'ruhe') { c.fillStyle = farbe; c.font = TEXT(26); c.textBaseline = 'middle'; c.fillText(tx('rueckblick.ruhe'), x, y + 2); }
        c.restore();
      });
      if (t.ayat) { c.fillStyle = F.leise; c.font = TEXT(28); c.fillText(zahl(t.ayat), x, y + r + 40); }
    });
    y += r + 40;
  }
  // Legende
  y += monat ? 46 : 56;
  const leg = [['voll', tx('rueckblick.wird_erfuellt')], ...(R.tage.some(t => t.stand === 'nach') ? [['nach', tx('rueckblick.nachgeholt')]] : []), ...(R.tage.some(t => t.stand === 'teil') ? [['teil', tx('rueckblick.zum_teil')]] : []), ...(R.tage.some(t => t.stand === 'ruhe') ? [['ruhe', tx('allg.ruhetag')]] : []), ...(R.tage.some(t => t.stand === 'aus') ? [['aus', tx('rueckblick.ausgefallen')]] : [])];
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
  c.fillStyle = F.leise; c.font = TEXT(28); c.fillText(`${tx('allg.itqan')} · ${tx('rueckblick.die_muragaa_des_ganzen_qurans')}`, mitte, fuss);
  return cv;
}
