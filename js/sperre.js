// Itqān · Hintergrund festhalten, solange ein Fenster oder Blatt offen ist (Rad, Touchpad und Wischen am Handy)
let offen = 0;
const karteVon = el => el.closest?.('.dialog-karte, .lk-blatt, .orn-karte');
const beiTouch = ev => { const k = karteVon(ev.target); if (!k || k.scrollHeight <= k.clientHeight + 1) ev.preventDefault(); };
const beiRad = ev => {
  const k = karteVon(ev.target);
  if (!k) { ev.preventDefault(); return; }
  const oben = k.scrollTop <= 0 && ev.deltaY < 0, unten = k.scrollTop + k.clientHeight >= k.scrollHeight - 1 && ev.deltaY > 0;
  if (k.scrollHeight <= k.clientHeight + 1 || oben || unten) ev.preventDefault();
};
export function hintergrundSperren(an) {
  if (an) {
    if (offen++ === 0) { document.documentElement.classList.add('sperre'); addEventListener('touchmove', beiTouch, { passive: false }); addEventListener('wheel', beiRad, { passive: false }); }
  } else if (offen > 0 && --offen === 0) {
    document.documentElement.classList.remove('sperre'); removeEventListener('touchmove', beiTouch); removeEventListener('wheel', beiRad);
  }
}
// Sicherung: bleibt die Sperre nach einem Seitenwechsel hängen (Fenster ohne Schließen entfernt), wird sie hier gelöst
export function hintergrundFreigeben() { if (!offen && !document.documentElement.classList.contains('sperre')) return; offen = 0; document.documentElement.classList.remove('sperre'); removeEventListener('touchmove', beiTouch); removeEventListener('wheel', beiRad); }

// ---------- Überlagerungen (Vollbild, Blatt, Ornament-Fenster, Erklärung) ----------
// Gemeinsames Verhalten: Beim Öffnen entsteht ein eigener Schritt im Verlauf, die Zurück-Taste schließt also nur die Überlagerung.
// Escape schließt, die Tabulatortaste bleibt darin, der Fokus kehrt danach an seinen alten Platz zurück, die Seite dahinter ruht (inert).
// raeumen(grund) baut die Überlagerung ab; grund: 'zurueck' (Zurück-Taste), 'wechsel' (andere Ansicht), 'selbst' (Knopf, Escape).
// Rückgabe: ende(danach): schließt; danach() läuft, sobald der eigene Schritt aus dem Verlauf genommen ist (erst dann darf die Adresse wechseln).
let eigenerSchritt = 0;
export const eigenerRueckschritt = () => eigenerSchritt > 0;
export function ueberlagerung(el, raeumen, { hinter = [], escape = null, fokus = null } = {}) {
  const vorher = document.activeElement, starr = hinter.filter(x => x && !x.inert);
  let offen = true, eintrag = false;
  try { history.pushState({ ...(history.state || {}), itqanLage: 1 }, ''); eintrag = true; } catch (e) { /* ohne Verlauf bleibt es bei Escape und Knopf */ }
  starr.forEach(x => { x.inert = true; });
  const fokusbar = () => [...el.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.getClientRects().length);
  const taste = ev => {
    if (ev.key === 'Escape') { ev.stopPropagation(); if (escape) escape(); else ende(); return; }
    if (ev.key !== 'Tab') return;
    const f = fokusbar(); if (!f.length) { ev.preventDefault(); return; }
    const drin = el.contains(document.activeElement);
    if (ev.shiftKey && (!drin || document.activeElement === f[0])) { ev.preventDefault(); f[f.length - 1].focus(); }
    else if (!ev.shiftKey && (!drin || document.activeElement === f[f.length - 1])) { ev.preventDefault(); f[0].focus(); }
  };
  const beiZurueck = () => schluss('zurueck'), beiWechsel = () => schluss('wechsel');
  function schluss(grund, danach) {
    if (!offen) return; offen = false;
    removeEventListener('keydown', taste, true); removeEventListener('popstate', beiZurueck); removeEventListener('hashchange', beiWechsel);
    starr.forEach(x => { x.inert = false; });
    raeumen(grund);
    if (grund !== 'wechsel' && vorher?.isConnected) vorher.focus({ preventScroll: true });
    if (grund !== 'selbst' || !eintrag) { danach?.(); return; }
    // den eigenen Schritt wieder aus dem Verlauf nehmen
    let erledigt = false; eigenerSchritt++;
    const dann = () => { if (erledigt) return; erledigt = true; eigenerSchritt--; removeEventListener('popstate', dann); danach?.(); };
    addEventListener('popstate', dann); setTimeout(dann, 500); history.back();
  }
  const ende = danach => schluss('selbst', danach);
  // Verweise in der Überlagerung: erst schließen, dann dorthin (sonst bliebe der eigene Schritt im Verlauf stehen)
  el.addEventListener('click', ev => {
    const a = ev.target.closest?.('a[href^="#"]'); if (!a || !offen || ev.defaultPrevented) return;
    ev.preventDefault(); const ziel = a.getAttribute('href'); ende(() => { location.hash = ziel; });
  });
  addEventListener('keydown', taste, true); addEventListener('popstate', beiZurueck); addEventListener('hashchange', beiWechsel);
  if (fokus !== false) requestAnimationFrame(() => { if (offen) (typeof fokus === 'function' ? fokus() : fokus || fokusbar()[0])?.focus?.({ preventScroll: true }); });
  return ende;
}
