// Sprachschicht: Alle Texte der Oberfläche stehen in einer Sprachdatei (js/sprache/<code>.js), der Code nennt nur Schlüssel.
// Deutsch ist die Grundsprache und immer geladen. Fehlt ein Schlüssel in einer anderen Sprache, erscheint der deutsche Text.
//
// Form einer Meldung:
//   Text mit HTML bleibt, wie er ist.           'Noch <b>offen</b>'
//   Platzhalter in geschweiften Klammern.       'Seite {seite}'
//   Mehrzahl nach den Regeln der Sprache.       '{n, plural, one {Tag} other {Tage}}'
//     Zweige: one, other, dazu je nach Sprache zero, two, few, many. Ein genauer Wert geht vor: '=0 {kein Tag}'.
// Eine Übersetzung behält dieselben Platzhalter und dieselben HTML-Marken wie der deutsche Text.
import de from './sprache/de.js';

// frei: Die Sprache erscheint in den Einstellungen zur Auswahl. Ohne Freigabe ist sie nur über ?sprache=<code> erreichbar (für das Lektorat).
export const SPRACHEN = [
  { code: 'de', name: 'Deutsch', frei: true, los: 'Weiter auf Deutsch' },
  { code: 'en', name: 'English', frei: true, los: 'Continue in English' },
  { code: 'tr', name: 'Türkçe', frei: true, los: 'Türkçe devam et' },
  { code: 'ar', name: 'العربية', frei: true, los: 'المتابعة بالعربية', rtl: true },
  { code: 'ur', name: 'اردو', frei: true, los: 'اردو میں جاری رکھیں', rtl: true },
  { code: 'fr', name: 'Français', frei: true, los: 'Continuer en français' },
  { code: 'es', name: 'Español', frei: true, los: 'Continuar en español' },
];
// los: Text des Bestätigungsknopfs in der Sprachwahl, in der jeweiligen Sprache selbst
const MERKER = 'itqan-sprache';

let texte = de;
let regel = null;
let wandel = null;
const fertig = new Map();
// Fassung der Meldungen für einen Lernmodus: Im Bereich <fassung> der Sprachdatei steht unter 'bereich__name' der Text,
// der in diesem Modus an die Stelle von 'bereich.name' tritt (Modus „Ganze Seiten“: Seiten statt Abschnitte).
// Fassung 'durchlauf': Wer nicht alle 30 Aǧzāʾ wiederholt, macht keine Ḫatma, sondern einen Durchlauf. Beides zugleich: 'durchlauf_ganzseite'.
let modusFassung = null, durchlauf = false, fassungen = [];
function fassungenBauen() {
  fassungen = [...(durchlauf && modusFassung ? ['durchlauf_' + modusFassung] : []), ...(durchlauf ? ['durchlauf'] : []), ...(modusFassung ? [modusFassung] : [])];
  fertig.clear();
}
export function fassungSetzen(f) { if (f !== modusFassung) { modusFassung = f; fassungenBauen(); } }
export function durchlaufSetzen(d) { if (!!d !== durchlauf) { durchlauf = !!d; fassungenBauen(); } }

// Angaben der geladenen Sprache: gebiet('code'), gebiet('datum'), gebiet('zahl'), gebiet('hidschri'), gebiet('richtung')
export const gebiet = art => texte._[art] ?? de._[art];

// Arabische Namen stehen in den Daten in der deutschen Umschrift (DMG). Eine Sprache mit anderem Brauch nennt im Kopf
// ihrer Datei die Ersetzungen: umschrift: [['ǧ', 'j'], ['š', 'sh'], ...]. Ohne diese Angabe bleibt der Name, wie er ist.
export function umschrift(name) {
  const u = texte._.umschrift;
  if (!u) return name;
  wandel ||= { muster: new RegExp(u.map(p => p[0]).join('|'), 'g'), nach: new Map(u) };
  return name.replace(wandel.muster, m => wandel.nach.get(m));
}

// Beim ersten Start fragt die App nach der Sprache, solange keine gewählt ist
export function spracheGewaehlt() {
  try { return !!localStorage.getItem(MERKER) || new URLSearchParams(location.search).has('sprache'); } catch { return true; }
}
// Vorschlag aus den Spracheinstellungen des Geräts
export function geraeteSprache() {
  try { for (const l of navigator.languages || [navigator.language]) { const c = String(l).slice(0, 2).toLowerCase(); if (SPRACHEN.some(s => s.code === c && s.frei)) return c; } } catch { /* ohne Fenster */ }
  return 'de';
}
export function spracheMerken(code) {
  try { localStorage.setItem(MERKER, code); } catch { /* ohne Speicher bleibt es bei Deutsch */ }
}

// Vor dem Start der App: Sprache bestimmen und laden. In den Tests (ohne Fenster) bleibt es bei Deutsch.
export async function ladeSprache() {
  let code = 'de';
  try {
    const wunsch = new URLSearchParams(location.search).get('sprache');
    if (wunsch && SPRACHEN.some(s => s.code === wunsch)) localStorage.setItem(MERKER, wunsch);
    const gemerkt = localStorage.getItem(MERKER);
    if (SPRACHEN.some(s => s.code === gemerkt)) code = gemerkt;
  } catch { /* kein Fenster oder kein Speicher */ }
  if (code === 'de') return;
  try {
    texte = (await import(`./sprache/${code}.js`)).default;
  } catch {
    texte = de;
    return;
  }
  regel = null;
  wandel = null;
  fertig.clear();
  document.documentElement.lang = gebiet('code');
  document.documentElement.dir = gebiet('richtung');
  statisch();
}

// Texte, die schon in index.html stehen
function statisch() {
  for (const el of document.querySelectorAll('[data-tx]')) {
    const t = tx(el.dataset.tx);
    const knoten = [...el.childNodes].filter(k => k.nodeType === 3 && k.nodeValue.trim()).pop();
    if (knoten) knoten.nodeValue = t; else el.textContent = t;
  }
  for (const el of document.querySelectorAll('[data-tx-label]')) el.setAttribute('aria-label', tx(el.dataset.txLabel));
  for (const el of document.querySelectorAll('[data-tx-content]')) el.setAttribute('content', tx(el.dataset.txContent));
}

// Der Text zu einem Schlüssel 'bereich.name', mit Werten für die Platzhalter
export function tx(schluessel, w) {
  let f = fertig.get(schluessel);
  if (f === undefined) {
    const p = schluessel.indexOf('.');
    const b = schluessel.slice(0, p), s = schluessel.slice(p + 1);
    let eigen;
    for (const fa of fassungen) { eigen = texte[fa]?.[b + '__' + s] ?? de[fa]?.[b + '__' + s]; if (eigen !== undefined) break; }
    const roh = eigen ?? texte[b]?.[s] ?? de[b]?.[s] ?? schluessel;
    f = roh.includes('{') ? bauen(roh) : roh;
    fertig.set(schluessel, f);
  }
  return typeof f === 'string' ? f : f(w || {});
}

const mehrzahl = n => (regel ||= new Intl.PluralRules(gebiet('code'))).select(n);

// Meldung mit Platzhaltern einmal zerlegen, danach nur noch zusammensetzen
function bauen(t) {
  let i = 0;
  const folge = innen => {
    const teile = [];
    let s = '';
    while (i < t.length) {
      const c = t[i];
      if (c === '}' && innen) break;
      if (c !== '{') { s += c; i++; continue; }
      if (s) { teile.push(s); s = ''; }
      let j = ++i;
      while (j < t.length && t[j] !== ',' && t[j] !== '}') j++;
      const name = t.slice(i, j).trim();
      i = j + 1;
      if (t[j] !== ',') { teile.push(w => String(w[name])); continue; }
      i = t.indexOf(',', i) + 1;
      const zweige = {};
      for (;;) {
        while (t[i] === ' ') i++;
        if (i >= t.length || t[i] === '}') { i++; break; }
        j = t.indexOf('{', i);
        const wahl = t.slice(i, j).trim();
        i = j + 1;
        zweige[wahl] = folge(true);
        i++;
      }
      teile.push(w => {
        const n = w[name];
        const z = zweige['=' + n] ?? (typeof n === 'number' ? zweige[mehrzahl(n)] : undefined) ?? zweige.other;
        return z ? z(w) : '';
      });
    }
    if (s) teile.push(s);
    return w => { let a = ''; for (const x of teile) a += typeof x === 'string' ? x : x(w); return a; };
  };
  return folge(false);
}
