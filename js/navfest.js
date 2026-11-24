// Untere Leiste: sitzt immer an der Unterkante der sichtbaren Fläche.
// Der iPhone-Browser lässt feste Leisten nach der Tastatur, nach dem Wechsel der Ansicht oder nach dem Zurückkehren aus dem Hintergrund
// gelegentlich an einem alten Rechteck hängen (die Leiste steht dann mitten im Bild). Ein bloßes „bottom: 0“ erneuert sich dabei nicht.
// Darum setzt dieses Modul die Lage selbst: Es misst die sichtbare Höhe und schreibt „top“ ins Style-Attribut. Das erzwingt eine neue
// Berechnung. Es prüft bei jedem Anlass, der die Lage verändern kann, und zusätzlich alle halbe Sekunde, solange das Fenster sichtbar ist.
// Ohne Skript gilt weiter die Vorgabe des Stylesheets (bottom: 0); beim Zoomen (Scale ungleich 1) gibt das Modul die Lage ans Stylesheet zurück.
export function navFest(nav, win = window, doc = document, takt = 500) {
  const vv = win.visualViewport;
  let plan = 0, aus = false;
  const hoehe = () => Math.max(win.innerHeight || 0, vv ? Math.round((vv.height || 0) + (vv.offsetTop || 0)) : 0);
  function setze() {
    plan = 0;
    if (aus || !nav.isConnected || doc.hidden) return;
    if (vv && Math.abs((vv.scale ?? 1) - 1) > 0.02) { nav.style.top = ''; nav.style.bottom = ''; return; }
    const r = nav.getBoundingClientRect?.(), h = Math.ceil((r && r.height) || nav.offsetHeight), ganz = hoehe();
    if (!h || !ganz) return;
    const soll = (ganz - h) + 'px';
    // Stimmt der Wert im Style, aber nicht im Bild (die Leiste hängt am alten Rechteck), wird er geräumt und neu geschrieben
    if (r && nav.style.top === soll && Math.abs(r.bottom - ganz) > 1.5) { nav.style.top = ''; void nav.offsetHeight; }
    if (nav.style.top !== soll || nav.style.bottom !== 'auto') { nav.style.bottom = 'auto'; nav.style.top = soll; }
  }
  const bald = () => { if (!plan) plan = (win.requestAnimationFrame ? win.requestAnimationFrame(setze) : win.setTimeout(setze, 16)) || 1; };
  const nachher = () => { bald(); [80, 250, 600, 1400].forEach(t => win.setTimeout(setze, t)); };
  const lose = [];
  const hoere = (ziel, art, f, opt) => { if (!ziel?.addEventListener) return; ziel.addEventListener(art, f, opt); lose.push(() => ziel.removeEventListener?.(art, f, opt)); };
  ['resize', 'orientationchange', 'pageshow', 'focus'].forEach(a => hoere(win, a, nachher));
  hoere(win, 'scroll', bald, { passive: true });
  hoere(win, 'touchstart', bald, { passive: true, capture: true });
  ['focusin', 'focusout', 'visibilitychange'].forEach(a => hoere(doc, a, nachher));
  hoere(vv, 'resize', nachher); hoere(vv, 'scroll', bald);
  const uhr = win.setInterval(setze, takt);
  setze();
  return { setze, stop() { aus = true; win.clearInterval(uhr); lose.forEach(f => f()); } };
}
