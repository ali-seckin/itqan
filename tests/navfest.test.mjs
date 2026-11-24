// Untere Leiste (js/navfest.js): sitzt an der Unterkante der sichtbaren Fläche, heilt sich selbst, gibt beim Zoomen die Lage zurück
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { navFest } from '../js/navfest.js';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');

function umgebung(o = {}) {
  const ziel = (extra = {}) => Object.assign({
    ev: {},
    addEventListener(a, f) { (this.ev[a] ||= []).push(f); },
    removeEventListener(a, f) { this.ev[a] = (this.ev[a] || []).filter(x => x !== f); },
    los(a) { (this.ev[a] || []).forEach(f => f()); }
  }, extra);
  const rahmen = [], zeiten = []; let uhr = null;
  const vv = ziel({ scale: 1, height: 800, offsetTop: 0 });
  const win = ziel({
    innerHeight: 800, visualViewport: vv,
    requestAnimationFrame: f => { rahmen.push(f); return rahmen.length; },
    setTimeout: (f, t) => { zeiten.push([f, t]); return zeiten.length; },
    setInterval: f => { uhr = f; return 1; }, clearInterval: () => { uhr = null; }
  });
  const doc = ziel({ hidden: false });
  const nav = { isConnected: true, offsetHeight: 80, style: { top: '', bottom: '' } };
  Object.assign(win, o.win || {}); Object.assign(vv, o.vv || {});
  return { win, vv, doc, nav, rahmen, zeiten, tick: () => uhr?.(), laeuft: () => uhr !== null, lauf: () => { const r = rahmen.splice(0); r.forEach(f => f()); } };
}

test('Leiste: sitzt gleich beim Start an der Unterkante (top = Höhe minus Leistenhöhe, bottom auto)', () => {
  const u = umgebung(); navFest(u.nav, u.win, u.doc);
  assert.equal(u.nav.style.top, '720px'); assert.equal(u.nav.style.bottom, 'auto');
});

test('Leiste: hängt sie an einem alten Rechteck, holt sie der Takt zurück', () => {
  const u = umgebung(); navFest(u.nav, u.win, u.doc);
  u.nav.style.top = '420px';   // so stand sie im Fehlerbild: mitten im Bild
  u.tick();
  assert.equal(u.nav.style.top, '720px');
});

test('Leiste: nach der Tastatur (höhere Fläche, Wechsel des Fokus) rückt sie nach unten', () => {
  const u = umgebung(); navFest(u.nav, u.win, u.doc);
  u.win.innerHeight = 500; u.vv.height = 500; u.doc.los('focusin'); u.lauf();
  assert.equal(u.nav.style.top, '420px');
  u.win.innerHeight = 800; u.vv.height = 800; u.doc.los('focusout'); u.lauf();
  assert.equal(u.nav.style.top, '720px');
  assert.ok(u.zeiten.some(([, t]) => t >= 1000), 'nach dem Fokus wird auch später noch einmal gemessen');
});

test('Leiste: Rückkehr aus dem Hintergrund, Drehen und Scrollen lösen eine Prüfung aus', () => {
  for (const [ziel, art] of [['doc', 'visibilitychange'], ['win', 'pageshow'], ['win', 'orientationchange'], ['win', 'resize'], ['win', 'scroll'], ['win', 'touchstart'], ['vv', 'resize'], ['vv', 'scroll']]) {
    const u = umgebung(); navFest(u.nav, u.win, u.doc);
    u.nav.style.top = '1px'; u[ziel].los(art); u.lauf();
    assert.equal(u.nav.style.top, '720px', `${ziel}:${art}`);
  }
});

test('Leiste: gezoomt (Scale ungleich 1) gilt wieder das Stylesheet, danach setzt sie sich neu', () => {
  const u = umgebung(); navFest(u.nav, u.win, u.doc);
  u.vv.scale = 1.4; u.tick();
  assert.equal(u.nav.style.top, ''); assert.equal(u.nav.style.bottom, '');
  u.vv.scale = 1; u.tick();
  assert.equal(u.nav.style.top, '720px');
});

test('Leiste: verborgenes Fenster, getrennte oder höhenlose Leiste bleiben unberührt', () => {
  const u = umgebung(); navFest(u.nav, u.win, u.doc);
  u.doc.hidden = true; u.nav.style.top = '5px'; u.tick(); assert.equal(u.nav.style.top, '5px');
  u.doc.hidden = false; u.nav.offsetHeight = 0; u.tick(); assert.equal(u.nav.style.top, '5px');
  u.nav.offsetHeight = 80; u.nav.isConnected = false; u.tick(); assert.equal(u.nav.style.top, '5px');
});

test('Leiste: die sichtbare Höhe zählt auch, wenn nur der visuelle Rahmen höher ist (iPhone nach der Tastatur)', () => {
  const u = umgebung({ win: { innerHeight: 505 }, vv: { height: 816, offsetTop: 0 } }); navFest(u.nav, u.win, u.doc);
  assert.equal(u.nav.style.top, '736px');
});

test('Leiste: stimmt der Style, aber nicht das Bild (am alten Rechteck), wird der Wert geräumt und neu geschrieben', () => {
  const u = umgebung(); const schreib = []; let wert = '';
  u.nav.style = { bottom: '', get top() { return wert; }, set top(v) { schreib.push(v); wert = v; } };
  let unten = 800; u.nav.getBoundingClientRect = () => ({ height: 80, bottom: unten });
  navFest(u.nav, u.win, u.doc);
  assert.equal(wert, '720px'); const n0 = schreib.length;
  u.tick(); assert.equal(schreib.length, n0, 'stimmt alles, wird nicht neu geschrieben');
  unten = 380;   // das Bild hängt, der Style sagt weiter 720px
  u.tick(); assert.deepEqual(schreib.slice(n0), ['', '720px']);
});

test('Leiste: stop beendet Takt und Beobachter', () => {
  const u = umgebung(); const f = navFest(u.nav, u.win, u.doc);
  assert.ok(u.laeuft()); f.stop(); assert.ok(!u.laeuft());
  assert.equal((u.doc.ev.focusin || []).length, 0); assert.equal((u.win.ev.resize || []).length, 0);
  u.nav.style.top = '1px'; f.setze(); assert.equal(u.nav.style.top, '1px');
});

test('Leiste: im Programm eingebunden, im Vorrat des Service Workers, Vorgabe im Stylesheet bleibt', () => {
  const app = readFileSync(join(APP, 'js/app.js'), 'utf8'), sw = readFileSync(join(APP, 'sw.js'), 'utf8'), css = readFileSync(join(APP, 'css/itqan.css'), 'utf8');
  assert.ok(app.includes("import { navFest } from './navfest.js'") && /navFest\(nav\)/.test(app));
  assert.ok(sw.includes("'js/navfest.js'"));
  assert.match(css, /\.nav\{position:fixed;left:0;right:0;bottom:0;/);
});
