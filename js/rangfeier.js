// Itqān · Freischaltung eines neuen Ranges: eine einmalige, ruhige Vollbild-Überlagerung (etwa 3 Sekunden)
// Wird erst beim ersten Gebrauch geladen (dynamischer Import in js/app.js, Datei steht im Offline-Vorrat).
// Zwei Teile: Logik ohne Oberfläche (ausstehend, feiern, gesehenMerken: in Tests prüfbar) und die Ansicht (zeigen).
//
// Einmalig: Ein Rang-Ereignis entsteht nur im Moment des Aufstiegs (zustand.js, abschnittAbschliessen) und wird nie gespeichert.
// Dazu merkt sich das Profil im Feld rangGesehen den höchsten Rang, dessen Freischaltung schon gezeigt wurde. Das Feld darf fehlen
// (ältere Profile): dann gilt 0. Gemerkt wird, bevor die Überlagerung erscheint: wer sie überspringt oder die App währenddessen schließt,
// sieht sie nicht noch einmal.
import { RAENGE } from './zustand.js';
import { tx } from './sprache.js';
import { ueberlagerung, hintergrundSperren } from './sperre.js';

// ---------- Logik ----------
export const gesehenLesen = P => { const g = P?.rangGesehen; return Number.isInteger(g) && g >= 0 ? g : 0; };
// Trägt den Rang ein; false, wenn er nicht höher ist als der schon gemerkte (dann bleibt alles, wie es ist)
export function gesehenMerken(P, r) {
  if (!P || typeof P !== 'object' || !Number.isInteger(r) || r <= gesehenLesen(P)) return false;
  P.rangGesehen = r; return true;
}
// Welche Freischaltungen aus den Ereignissen eines Abschlusses sind noch zu zeigen? Aufsteigend, jeder Rang höchstens einmal.
export function ausstehend(ereignisse, gesehen = 0) {
  const g = Number.isInteger(gesehen) ? gesehen : 0, art = new Set();
  for (const x of Array.isArray(ereignisse) ? ereignisse : []) if (x && x.typ === 'rang' && Number.isInteger(x.r) && x.r > g && x.r < RAENGE.length) art.add(x.r);
  return [...art].sort((a, b) => a - b);
}
// Zeigt alle noch nicht gezeigten Ränge nacheinander. zeigen(r) liefert ein Versprechen, das beim Schließen endet.
// Merken und Speichern kommen vor dem Zeigen, ein Fehler darin oder in der Ansicht bricht nie den Ablauf der App ab.
// Rückgabe: die Ränge, für die gezeigt wurde.
export async function feiern(ereignisse, { P, speichern, zeigen }) {
  const gezeigt = [];
  if (!P) return gezeigt;
  for (const r of ausstehend(ereignisse, gesehenLesen(P))) {
    if (gesehenMerken(P, r)) { try { speichern?.(); } catch (e) { console.warn('Rangfeier: Merken', e); } }
    try { await zeigen(r); gezeigt.push(r); } catch (e) { console.warn('Rangfeier', e); }
  }
  return gezeigt;
}

// ---------- Ansicht ----------
// Das Itqān-Zeichen (Nische mit Flamme), dieselben Umrisse wie das App-Symbol in js/app.js
const NISCHE = 'M272 820 V470 C272 330 392 230 512 176 C632 230 752 330 752 470 V820 H672 V488 C672 384 592 314 512 270 C432 314 352 384 352 488 V820 Z';
const FLAMME = 'M512 452 C576 532 600 596 578 652 C566 684 540 706 512 712 C484 706 458 684 446 652 C424 596 448 532 512 452 Z';
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ESC[c]);
// Intensität: höhere Ränge bekommen mehr Gold (Stufe 1 bis 4: Rang 1-3, 4-6, 7-9, 10-12)
export const stufeVon = r => r <= 3 ? 1 : r <= 6 ? 2 : r <= 9 ? 3 : 4;
// feste Folge von Zufallszahlen je Rang: die Funken fallen bei jedem Zeigen gleich
const zufall = start => { let s = (start * 2654435761) >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const punkt = (R, grad) => { const w = grad * Math.PI / 180; return [(120 + R * Math.cos(w)).toFixed(2), (120 + R * Math.sin(w)).toFixed(2)]; };
// Stern aus zwei Quadraten (Rubʿ al-Ḥizb), um drehung Grad gedreht
const stern = (R, drehung) => [0, 45].map(v => `M${[0, 1, 2, 3].map(k => punkt(R, drehung + v + 90 * k).join(' ')).join('L')}Z`);
const zeichne = (d, wann, dauer, klasse = '') => `<path class="rf-z ${klasse}" pathLength="100" style="--d:${wann}ms;--t:${dauer}ms" d="${d}"/>`;

export function emblem(r) {
  const stufe = stufeVon(r), arme = [];
  // zwölf Bögen, einer je erreichtem Rang leuchtet
  for (let i = 0; i < 12; i++) {
    const a0 = -90 + i * 30 + 3, [x0, y0] = punkt(98, a0), [x1, y1] = punkt(98, a0 + 24);
    arme.push(zeichne(`M${x0} ${y0}A98 98 0 0 1 ${x1} ${y1}`, 760 + i * 70, 560, i < r ? 'rf-bogen an' : 'rf-bogen'));
  }
  const rest = [];
  if (stufe >= 2) rest.push(...stern(84, -90).map(d => zeichne(d, 650, 1100, 'rf-stern')));
  if (stufe >= 3) rest.push(...stern(70, -67.5).map(d => zeichne(d, 820, 1100, 'rf-stern zwei')));
  return `<svg class="rf-svg" viewBox="0 0 240 240" aria-hidden="true" focusable="false">
    <defs><linearGradient id="rf-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F1DDA8"/><stop offset=".55" stop-color="#D4AF6A"/><stop offset="1" stop-color="#B58E48"/></linearGradient></defs>
    <circle class="rf-z rf-rand" cx="120" cy="120" r="112" pathLength="100" style="--d:260ms;--t:1100ms"/>
    <circle class="rf-z rf-rand dunn" cx="120" cy="120" r="${stufe >= 2 ? 59.4 : 66}" pathLength="100" style="--d:520ms;--t:900ms"/>
    ${arme.join('')}${rest.join('')}
    <svg x="80" y="68" width="80" height="97.7" viewBox="232 156 560 684" overflow="visible">
      <path class="rf-fuell" d="${NISCHE}" fill="url(#rf-gold)"/><path class="rf-fuell f2" d="${FLAMME}" fill="url(#rf-gold)"/>
      <path class="rf-z rf-linie" pathLength="100" style="--d:820ms;--t:1100ms" d="${NISCHE}"/><path class="rf-z rf-linie" pathLength="100" style="--d:1300ms;--t:700ms" d="${FLAMME}"/>
    </svg></svg>`;
}
const arKern = s => String(s ?? '').replace(/[ً-ٰٟۖ-ۭ]/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[ہھۃ]/g, 'ه').replace(/\s+/g, '');

// Baut die Überlagerung und gibt ein Versprechen zurück, das beim Schließen endet (nie mit Fehler).
// opt: { ruhig (Bewegung reduziert, sonst aus der Systemeinstellung), vibrieren (Vorgabe true), hinter (Bereiche, die währenddessen ruhen) }
export function zeigen(r, opt = {}) {
  return new Promise(fertig => {
    let wurzel = null, hinterGesperrt = false;
    const aufraeumen = () => { try { wurzel?.remove(); } catch (e) { /* schon weg */ } if (hinterGesperrt) { hinterGesperrt = false; try { hintergrundSperren(false); } catch (e) { /* egal */ } } };
    try {
      const R = RAENGE[r];
      if (!R || !(r > 0) || typeof document === 'undefined') { fertig(false); return; }
      if (document.querySelector('.rf')) { fertig(false); return; }   // es steht schon eine da (doppeltes Tippen)
      const ruhig = opt.ruhig ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
      const stufe = stufeVon(r), n = R.n, de = R.de, zufallsZahl = zufall(r + 1);
      const doppelt = arKern(n) === arKern(R.ar);   // arabische Oberfläche: der Name stünde zweimal da
      const funken = Array.from({ length: 8 + 3 * stufe }, (_, i) => {
        const x = 8 + zufallsZahl() * 84, hoehe = 90 + zufallsZahl() * 150, dx = (zufallsZahl() - .5) * 70, gr = 2.6 + zufallsZahl() * 3, d = 1450 + zufallsZahl() * 900, t = 1500 + zufallsZahl() * 700;
        return `<i style="left:${x.toFixed(1)}%;--h:${hoehe.toFixed(0)}px;--dx:${dx.toFixed(0)}px;--g:${gr.toFixed(1)}px;--d:${d.toFixed(0)}ms;--t:${t.toFixed(0)}ms"></i>`;
      }).join('');
      wurzel = document.createElement('div');
      wurzel.className = `rf rf-s${stufe}${ruhig ? ' rf-ruhig' : ''}`; wurzel.dataset.rang = String(r);
      wurzel.setAttribute('role', 'dialog'); wurzel.setAttribute('aria-modal', 'true'); wurzel.setAttribute('aria-labelledby', 'rf-name'); wurzel.setAttribute('aria-describedby', 'rf-de');
      wurzel.innerHTML = `<button type="button" class="rf-flaeche" aria-label="${esc(tx('rangfeier.ueberspringen'))}"></button>
        <div class="rf-mitte">
          <div class="rf-emblem" aria-hidden="true"><i class="rf-kern"></i><i class="rf-welle"></i><i class="rf-welle zwei"></i>${emblem(r)}<div class="rf-funken">${funken}</div></div>
          <div class="rf-text">
            <p class="rf-etikett">${esc(tx('rangfeier.titel'))}</p>
            <div class="rf-ar" lang="ar" dir="rtl" ${doppelt ? 'id="rf-name"' : ''}>${esc(R.ar)}</div>
            ${doppelt ? '' : `<h2 class="rf-name" id="rf-name">${esc(n)}</h2>`}
            <p class="rf-de" id="rf-de">${esc(de)}</p>
            <p class="rf-stufe">${esc(tx('rangkarte.rang_von', { a: r + 1, n: RAENGE.length }))}</p>
            <button type="button" class="rf-weiter" disabled>${esc(tx('allg.weiter'))}</button>
          </div>
        </div>`;
      const flaeche = wurzel.querySelector('.rf-flaeche'), weiter = wurzel.querySelector('.rf-weiter'), ziel = opt.hinter ?? [document.getElementById('app'), document.getElementById('nav')];
      let laeuft = true, zu = false, timer = 0, zittern = 0;
      const beende = () => {   // ruhiger Endzustand: alles steht, nur noch der Knopf zählt
        if (!laeuft) return; laeuft = false; clearTimeout(timer); clearTimeout(zittern);
        wurzel.classList.add('rf-fertig'); weiter.disabled = false;
        weiter.focus({ preventScroll: true }); flaeche.disabled = true;
      };
      const schliessen = () => { if (zu) return; zu = true; clearTimeout(timer); clearTimeout(zittern); ende(() => fertig(true)); };
      document.body.appendChild(wurzel); hintergrundSperren(true); hinterGesperrt = true;
      const ende = ueberlagerung(wurzel, grund => {
        zu = true; clearTimeout(timer); clearTimeout(zittern);
        hintergrundSperren(false); hinterGesperrt = false;
        if (grund === 'wechsel') { wurzel.remove(); fertig(true); return; }
        wurzel.classList.add('rf-weg'); setTimeout(() => wurzel.remove(), 260);
        if (grund === 'zurueck') fertig(true);   // bei 'selbst' ruft schliessen() erst nach dem Verlauf auf
      }, { hinter: ziel, escape: () => { if (laeuft) beende(); else schliessen(); }, fokus: () => flaeche });
      flaeche.onclick = () => { if (laeuft) beende(); };
      weiter.onclick = schliessen;
      wurzel.addEventListener('animationend', ev => { if (ev.target === weiter) beende(); });
      timer = setTimeout(beende, ruhig ? 2600 : 4800);   // falls der Browser Animationen anhält
      // kurze Berührung im Moment des Aufleuchtens (nur wo es geht, nie bei reduzierter Bewegung, kein Ton)
      if (!ruhig && opt.vibrieren !== false) zittern = setTimeout(() => { try { navigator.vibrate?.([20, 40, 20]); } catch (e) { /* nicht überall erlaubt */ } }, 1750);
    } catch (e) {
      console.warn('Rangfeier', e); aufraeumen(); fertig(false);
    }
  });
}
