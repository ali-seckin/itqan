// Itqān · Übersetzungen der Āyāt (Tanzil.net, unverändert, nur nicht kommerziell). Je Sprache eine Datei mit dem Text jeder Āya in der Reihenfolge von daten/verse.json;
// sie wird beim ersten Antippen geladen und bleibt danach auf dem Gerät (Service Worker). Erzeugt von werkzeuge/uebersetzung/bauen.py.
export const UEBERSETZUNGEN = ['de', 'en', 'tr', 'fr', 'es', 'ur'];
const geladen = new Map();
export function uebersetzungLaden(code) {
  if (!UEBERSETZUNGEN.includes(code)) return Promise.resolve(null);
  if (!geladen.has(code)) geladen.set(code, fetch(`daten/uebersetzung/${code}.json?v=1`).then(r => { if (!r.ok) throw new Error(code); return r.json(); }).catch(() => { geladen.delete(code); return null; }));
  return geladen.get(code);
}
