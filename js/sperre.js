// Itqān · Hintergrund festhalten, solange ein Fenster oder Blatt offen ist (Rad, Touchpad und Wischen am Handy)
let offen = 0;
const karteVon = el => el.closest?.('.dialog-karte, .lk-blatt');
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
