// Itqān · Geführte Erklärung: dunkelt den Bildschirm ab, lässt ein Element ausgespart hell stehen
// und zeigt daneben einen kleinen Erklärkasten. Schritte: { ziel: () => Element | Element[] | null, titel, text }

const SPEICHER = 'itqan-fuehrung';
export function gesehen(name) { try { return !!JSON.parse(localStorage.getItem(SPEICHER) || '{}')[name]; } catch (e) { return true; } }
export function merken(name) { try { const o = JSON.parse(localStorage.getItem(SPEICHER) || '{}'); o[name] = 1; localStorage.setItem(SPEICHER, JSON.stringify(o)); } catch (e) {} }
export function zuruecksetzen() { try { localStorage.removeItem(SPEICHER); } catch (e) {} }
export const laeuft = () => !!document.querySelector('.fuehrung');

// gemeinsames Rechteck mehrerer Elemente, nur der sichtbare Teil
function rahmen(ziel) {
  const els = (Array.isArray(ziel) ? ziel : [ziel]).filter(x => x && x.isConnected);
  if (!els.length) return null;
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (const el of els) { const q = el.getBoundingClientRect(); if (!q.width && !q.height) continue; l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); }
  return l === Infinity ? null : { l, t, r, b };
}

export function fuehrung(schritte) {
  schritte = schritte.filter(s => !s.ziel || (() => { const z = s.ziel(); return Array.isArray(z) ? z.length : !!z; })());
  if (!schritte.length) return Promise.resolve();
  return new Promise(fertig => {
    const o = document.createElement('div'); o.className = 'fuehrung';
    o.innerHTML = `<div class="fh-loch"></div><div class="fh-box" role="dialog" aria-live="polite">
      <div class="fh-kopf"><span class="fh-nr"></span><button class="fh-weg">Überspringen</button></div>
      <h3></h3><p></p>
      <div class="fh-knoepfe"><button class="knopf leise klein fh-zurueck">Zurück</button><button class="knopf haupt klein fh-weiter">Weiter</button></div></div>`;
    document.body.appendChild(o);
    const loch = o.querySelector('.fh-loch'), box = o.querySelector('.fh-box');
    let i = 0, ziel = null;
    function lage() {
      const R = ziel ? rahmen(ziel) : null, pad = 7;
      if (!R) {   // ohne Ziel: ganzer Bildschirm abgedunkelt, Kasten in der Mitte
        loch.style.cssText = `left:50%;top:50%;width:0;height:0`;
        box.style.left = Math.max(12, (innerWidth - box.offsetWidth) / 2) + 'px';
        box.style.top = Math.max(12, (innerHeight - box.offsetHeight) / 2) + 'px';
        box.dataset.pfeil = '';
        return;
      }
      const l = Math.max(4, R.l - pad), t = Math.max(4, R.t - pad), r = Math.min(innerWidth - 4, R.r + pad), b = Math.min(innerHeight - 4, R.b + pad);
      loch.style.cssText = `left:${l}px;top:${t}px;width:${r - l}px;height:${b - t}px`;
      const bh = box.offsetHeight, bw = box.offsetWidth;
      const unten = innerHeight - b - 14 >= bh, oben = t - 14 >= bh;
      let top = unten && (!oben || t < innerHeight / 2) ? b + 12 : oben ? t - bh - 12 : Math.max(12, innerHeight - bh - 12);
      box.style.top = Math.max(12, Math.min(innerHeight - bh - 12, top)) + 'px';
      box.style.left = Math.max(12, Math.min(innerWidth - bw - 12, (l + r) / 2 - bw / 2)) + 'px';
      box.dataset.pfeil = top > b ? 'oben' : top + bh < t ? 'unten' : '';
      box.style.setProperty('--px', Math.max(18, Math.min(bw - 18, (l + r) / 2 - parseFloat(box.style.left))) + 'px');
    }
    function zeige(n) {
      i = n; const s = schritte[i];
      ziel = s.ziel ? s.ziel() : null;
      o.querySelector('.fh-nr').textContent = `${i + 1} von ${schritte.length}`;
      box.querySelector('h3').textContent = s.titel;
      box.querySelector('p').innerHTML = s.text;
      o.querySelector('.fh-zurueck').style.visibility = i ? 'visible' : 'hidden';
      o.querySelector('.fh-weiter').textContent = i === schritte.length - 1 ? (s.los || 'Verstanden') : 'Weiter';
      o.classList.toggle('ohne-ziel', !ziel);
      // Ziel auf der Seite (nicht in der festen Leiste) in die Mitte holen
      const erstes = Array.isArray(ziel) ? ziel[0] : ziel;
      if (erstes && !erstes.closest('.steuerung, .ueb-kopf')) {
        const R = rahmen(ziel);
        if (R && (R.t < 60 || R.b > innerHeight - 230)) erstes.scrollIntoView({ block: 'center' });
      }
      box.classList.remove('neu'); void box.offsetWidth; box.classList.add('neu');
      requestAnimationFrame(lage);
    }
    function schliessen() { removeEventListener('resize', lage); removeEventListener('scroll', lage, true); removeEventListener('keydown', taste, true); o.classList.add('weg'); setTimeout(() => o.remove(), 220); fertig(); }
    const taste = ev => { ev.stopPropagation(); if (ev.key === 'Escape') schliessen(); else if (ev.key === 'Enter' || ev.key === 'ArrowRight' || ev.key === ' ') { ev.preventDefault(); o.querySelector('.fh-weiter').click(); } else if (ev.key === 'ArrowLeft' && i) zeige(i - 1); };
    o.querySelector('.fh-weiter').onclick = () => i < schritte.length - 1 ? zeige(i + 1) : schliessen();
    o.querySelector('.fh-zurueck').onclick = () => i && zeige(i - 1);
    o.querySelector('.fh-weg').onclick = schliessen;
    addEventListener('resize', lage); addEventListener('scroll', lage, true); addEventListener('keydown', taste, true);
    addEventListener('hashchange', () => o.isConnected && schliessen(), { once: true });
    zeige(0);
  });
}
