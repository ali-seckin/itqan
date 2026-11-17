// Itqān · Auswahl dessen, was wiederholt wird: Ǧuzʾ → Sūren → Seiten
// Die Auswahl ist eine Menge von Āyāt (Uint8Array je Āya-Index), unabhängig von der Gliederung.
// Gespeichert wird sie als Āya-Bereiche in einst.auswahl; die Abschnitte dazu (einst.bereich) leitet Itqān für die
// gerade geladene Gliederung daraus ab. Ein Abschnitt zählt dazu, wenn mindestens die Hälfte seiner Buchstaben gewählt ist.
import { D, sureName, juzVonVers, esc } from './daten.js';
import { tx } from './sprache.js';

const seiteVon = vi => D.W?.get(vi + '.0')?.[0] || D.V[vi][3];

export const leer = () => new Uint8Array(D.V.length);
export const alles = () => new Uint8Array(D.V.length).fill(1);
export function ausBereiche(r) { const s = leer(); for (const [a, b] of r || []) s.fill(1, a, b + 1); return s; }
export function ausAbschnitten(ids) { const s = leer(); for (const id of ids) { const e = D.A[id]; if (e) s.fill(1, e.v[0], e.v[1] + 1); } return s; }
export function zuBereichen(s) {
  const r = []; let a = -1;
  for (let i = 0; i <= s.length; i++) { if (i < s.length && s[i]) { if (a < 0) a = i; } else if (a >= 0) { r.push([a, i - 1]); a = -1; } }
  return r;
}
export const istAlles = s => s.every(x => x === 1);
export const istLeer = s => !s.some(x => x === 1);
// Abschnitte der geladenen Gliederung; null = alles (ganzer Qurʾān, damit auch Ḫatma)
export function zuAbschnitten(s) {
  if (istAlles(s)) return null;
  const pre = new Uint32Array(s.length + 1), bu = new Uint32Array(s.length + 1);
  for (let i = 0; i < s.length; i++) { pre[i + 1] = pre[i] + (s[i] ? D.V[i][2] || 1 : 0); bu[i + 1] = bu[i] + (D.V[i][2] || 1); }
  return D.A.filter(e => (pre[e.v[1] + 1] - pre[e.v[0]]) * 2 >= bu[e.v[1] + 1] - bu[e.v[0]]).map(e => e.id);
}
// Seiten, die zu mindestens der Hälfte gewählt sind (für die Anzeige der Poolgröße)
export function seitenZahl(s) {
  const g = new Map(), w = new Map();
  for (let i = 0; i < s.length; i++) { const p = seiteVon(i), b = D.V[i][2] || 1; g.set(p, (g.get(p) || 0) + b); if (s[i]) w.set(p, (w.get(p) || 0) + b); }
  let n = 0; for (const [p, t] of g) if ((w.get(p) || 0) * 2 >= t) n++;
  return n;
}

// Baum Ǧuzʾ → Sūra-Teil → Seiten, aus den Āyāt der geladenen Daten
function baum() {
  const aus = Array.from({ length: 30 }, () => []);
  let teil = null;
  for (let vi = 0; vi < D.V.length; vi++) {
    const [su, ay] = D.V[vi], j = juzVonVers(vi);
    if (!teil || teil.s !== su || teil.j !== j) { teil = { s: su, j, v0: vi, v1: vi, a0: ay, a1: ay, seiten: [] }; aus[j - 1].push(teil); }
    teil.v1 = vi; teil.a1 = ay;
    const p = seiteVon(vi), l = teil.seiten[teil.seiten.length - 1];
    if (l && l.p === p) l.v1 = vi; else teil.seiten.push({ p, v0: vi, v1: vi });
  }
  const nAya = {}; for (const v of D.V) nAya[v[0]] = Math.max(nAya[v[0]] || 0, v[1]);
  for (const g of aus) for (const t of g) t.ganz = t.a0 === 1 && t.a1 === nAya[t.s];
  return aus;
}
const juzBereich = (b, j) => [b[j - 1][0].v0, b[j - 1][b[j - 1].length - 1].v1];

// Zeichnet die Auswahl in host. s wird verändert; onChange(s) folgt nach jeder Änderung.
// opts.leer: Hinweis, solange nichts gewählt ist (Alles abwählen ist erlaubt; ob das gilt, entscheidet der Aufrufer).
export function wahlZeichnen(host, s, onChange, opts = {}) {
  const B = baum();
  const knopf = (v0, v1, inhalt, klasse) => `<button type="button" class="${klasse}" data-v0="${v0}" data-v1="${v1}" aria-pressed="false">${inhalt}</button>`;
  const juzReihe = Array.from({ length: 30 }, (_, i) => { const [a, b] = juzBereich(B, i + 1); return knopf(a, b, i + 1, 'a-juz'); }).join('');
  host.innerHTML = `<div class="wahl-baum">
    <div class="reihe" style="margin:12px 0"><button type="button" class="knopf leise klein" data-alle>${tx('start.alle_30')}</button><button type="button" class="knopf leise klein" data-keine>${tx('start.keinen')}</button></div>
    <div class="juzwahl">${juzReihe}</div>
    <p class="unter a-summe" role="status" style="margin-top:10px"></p>
    <p class="unter a-leer verdeckt" role="alert" style="margin-top:4px"></p>
    <button type="button" class="knopf leise klein a-genauer" aria-expanded="false" style="margin-top:6px">${tx('auswahl.genauer')}</button>
    <div class="a-detail verdeckt"><p class="unter" style="margin:10px 0">${tx('auswahl.hinweis')}</p></div></div>`;
  const detail = host.querySelector('.a-detail'), summe = host.querySelector('.a-summe');
  let gebaut = false;
  const bauen = () => {
    detail.insertAdjacentHTML('beforeend', B.map((g, gi) => `<details class="a-gruppe" data-j="${gi + 1}"><summary><span>${tx('allg.guz_nr', { j: gi + 1 })}</span><span class="a-stand"></span></summary>
      ${g.map((t, ti) => `<div class="a-sure">${knopf(t.v0, t.v1, `<b>${t.s}. ${esc(sureName(t.s))}</b>${t.ganz ? '' : `<small>${tx('auswahl.aya_von_bis', { a: t.a0, b: t.a1 })}</small>`}`, 'a-chip')}${t.seiten.length > 1 ? `<button type="button" class="a-seiten" aria-expanded="false" data-g="${gi}" data-t="${ti}">${tx('auswahl.seiten')}</button>` : ''}</div>
        <div class="a-pages verdeckt" data-g="${gi}" data-t="${ti}">${t.seiten.map(p => knopf(p.v0, p.v1, p.p, 'a-page')).join('')}</div>`).join('')}</details>`).join(''));
    gebaut = true;
  };
  const stand = (pre, v0, v1) => { const n = pre[v1 + 1] - pre[v0]; return n === 0 ? 0 : n === v1 - v0 + 1 ? 2 : 1; };
  const aktualisieren = () => {
    const pre = new Uint32Array(s.length + 1); for (let i = 0; i < s.length; i++) pre[i + 1] = pre[i] + s[i];
    host.querySelectorAll('[data-v0]').forEach(el => {
      const st = stand(pre, +el.dataset.v0, +el.dataset.v1);
      el.classList.toggle('an', st === 2); el.classList.toggle('teil', st === 1);
      el.setAttribute('aria-pressed', st === 2 ? 'true' : st === 1 ? 'mixed' : 'false');
    });
    host.querySelectorAll('.a-gruppe').forEach(d => {
      const [a, b] = juzBereich(B, +d.dataset.j), st = stand(pre, a, b);
      d.querySelector('.a-stand').textContent = st === 2 ? tx('auswahl.ganz') : st === 1 ? tx('auswahl.teilweise') : '';
    });
    summe.textContent = tx('auswahl.summe', { n: seitenZahl(s) });
    const le = host.querySelector('.a-leer'); le.textContent = opts.leer || ''; le.classList.toggle('verdeckt', !istLeer(s));
  };
  const aendern = (v0, v1, an) => {
    s.fill(an ? 1 : 0, v0, v1 + 1);
    aktualisieren(); onChange(s);
  };
  host.onclick = ev => {
    const b = ev.target.closest('button'); if (!b || !host.contains(b)) return;
    if ('alle' in b.dataset) return aendern(0, s.length - 1, true);
    if ('keine' in b.dataset) return aendern(0, s.length - 1, false);
    if (b.classList.contains('a-genauer')) {
      const auf = detail.classList.toggle('verdeckt') === false; b.setAttribute('aria-expanded', auf);
      if (auf && !gebaut) { bauen(); aktualisieren(); } return;
    }
    if (b.classList.contains('a-seiten')) {
      const p = host.querySelector(`.a-pages[data-g="${b.dataset.g}"][data-t="${b.dataset.t}"]`);
      b.setAttribute('aria-expanded', p.classList.toggle('verdeckt') === false); return;
    }
    if (b.dataset.v0 != null) { const v0 = +b.dataset.v0, v1 = +b.dataset.v1; aendern(v0, v1, !(b.classList.contains('an'))); }
  };
  aktualisieren();
}
