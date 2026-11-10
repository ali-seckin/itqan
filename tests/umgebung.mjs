// Itqān · Testumgebung für Node: Speicher, Dateizugriff und Uhr nachbilden, Daten aus app/daten laden.
// Aufruf aus dem Ordner app: node --test tests/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
export const lies = pfad => JSON.parse(readFileSync(join(APP, pfad), 'utf8'));

// localStorage als einfache Map
const speicher = new Map();
globalThis.localStorage = {
  getItem: k => speicher.has(k) ? speicher.get(k) : null,
  setItem: (k, v) => speicher.set(k, String(v)),
  removeItem: k => speicher.delete(k),
  clear: () => speicher.clear()
};
// fetch liest Dateien aus dem App-Ordner (für die Gliederungen)
globalThis.fetch = async url => {
  try { const d = readFileSync(join(APP, String(url))); return { ok: true, json: async () => JSON.parse(d) }; }
  catch (e) { return { ok: false, json: async () => null }; }
};

const daten = await import('../js/daten.js');
export const Z = await import('../js/zustand.js');
export const D = daten.D;

// Gliederung laden wie ladeDaten, nur ohne Layout
export function gliederungSetzen(modus = 'fort', ausgabe = 'v2') {
  const G = daten.gliederungVon(modus, ausgabe);
  const A = lies(G.datei);
  for (const e of A) e.juz = daten.juzVonSeite(e.seiten[0]);
  Object.assign(D, { A, V: lies('daten/verse.json'), S: lies('daten/suren.json'), modus, gliederung: G.name, ausgabe: modus === 'seite' ? ausgabe : 'v1' });
  daten.modusAnwenden(A, modus);
}
gliederungSetzen('fort');

// Uhr: ein fester Tag um 12 Uhr Ortszeit
let jetzt = new Date(2026, 0, 5, 12);
Z.uhrSetzen(() => new Date(jetzt));
// nach Tests mit eigener Uhr wieder auf die Testuhr umstellen
export const tagSetzenZurueck = () => Z.uhrSetzen(() => new Date(jetzt));
export function tagSetzen(datum) { const [y, m, d] = datum.split('-').map(Number); jetzt = new Date(y, m - 1, d, 12); }
export const naechsterTag = (n = 1) => tagSetzen(Z.plusTage(Z.heute(), n));

// frisches Profil an einem bestimmten Tag
export function frisch({ datum = '2026-01-05', pensum = 3, modus = 'fort', ...rest } = {}) {
  localStorage.clear(); gliederungSetzen(modus); tagSetzen(datum); tagSetzenZurueck();
  return Z.neuesProfil({ name: 'Test', pensum, modus, ...rest });
}
// den heutigen Wird mit einem Ergebnis je Āya abschließen ('ok', 'hilfe', 'fehler')
export function wirdErfuellen(ergebnis = () => 'ok') {
  const t = Z.tagesplan(), aus = [];
  for (const id of t.plan.filter(x => !t.fertig.includes(x))) {
    const e = D.A[id];
    aus.push(Z.abschnittAbschliessen(id, Array.from({ length: e.ayat }, (_, i) => ergebnis(i, id))));
  }
  return aus;
}
