// Itqān · Spiegel des Profils in der Store-App: Profil überlebt das Leeren des Web-Speichers, bewusstes Löschen bleibt gelöscht
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Z, frisch, tagSetzenZurueck } from './umgebung.mjs';

after(() => { Z.spiegelHakenSetzen(null); delete globalThis.Capacitor; delete globalThis.document; delete globalThis.MutationObserver; tagSetzenZurueck(); });
const dateien = new Map();
globalThis.Capacitor = { isNativePlatform: () => true, Plugins: { Filesystem: {
  writeFile: async ({ path, data }) => { dateien.set(path, data); },
  readFile: async ({ path }) => { if (!dateien.has(path)) throw new Error('nicht da'); return { data: dateien.get(path) }; },
  deleteFile: async ({ path }) => { if (!dateien.delete(path)) throw new Error('nicht da'); }
} } };
// nativ.js richtet in der Store-App die Statusleiste ein und braucht dafür ein Dokument: eine kleine Attrappe
globalThis.document = { hidden: false, addEventListener() {}, documentElement: { classList: { add() {} }, dataset: {} } };
globalThis.MutationObserver = class { observe() {} };
const N = await import('../js/nativ.js?spiegel');
const S = Z.PROFIL_SCHLUESSEL;

test('Jedes Schreiben des Profils geht an den Haken, das Löschen mit null', () => {
  const rufe = []; frisch({ pensum: 2 }); Z.spiegelHakenSetzen(x => rufe.push(x));
  Z.speichern();
  assert.equal(rufe.length, 1); assert.equal(JSON.parse(rufe[0]).format, 'itqan');
  Z.loeschen(); assert.equal(rufe.at(-1), null);
});

test('Spiegel: schreiben, nach dem Leeren des Web-Speichers zurückholen', async () => {
  dateien.clear(); frisch({ pensum: 2 });
  const text = JSON.stringify(Z.P);
  N.profilSpiegeln(text); await N.spiegelSofort();
  assert.equal([...dateien.values()][0], text);
  const ls = globalThis.localStorage, vorher = ls.getItem(S);
  ls.removeItem(S);                                            // das Betriebssystem leert den Web-Speicher
  assert.equal(await N.profilSpiegelHolen(S), true);
  assert.equal(ls.getItem(S), text); assert.equal(vorher === null || vorher === text, true);
});

test('Spiegel: ein vorhandenes Profil wird nie überschrieben', async () => {
  frisch({ pensum: 2 }); const ls = globalThis.localStorage;
  ls.setItem(S, JSON.stringify({ format: 'itqan', name: 'Eigenes' }));
  dateien.set('itqan-profil-spiegel.json', JSON.stringify({ format: 'itqan', name: 'Alt' }));
  assert.equal(await N.profilSpiegelHolen(S), false);
  assert.equal(JSON.parse(ls.getItem(S)).name, 'Eigenes');
});

test('Spiegel: bewusst gelöschtes Profil kommt nicht zurück, beschädigte Datei wird ignoriert', async () => {
  frisch({ pensum: 2 }); const ls = globalThis.localStorage;
  N.profilSpiegeln(JSON.stringify(Z.P)); await N.spiegelSofort();
  N.profilSpiegeln(null); await new Promise(r => setTimeout(r, 10));
  assert.equal(dateien.size, 0, 'die Datei ist weg');
  ls.removeItem(S); assert.equal(await N.profilSpiegelHolen(S), false); assert.equal(ls.getItem(S), null);
  dateien.set('itqan-profil-spiegel.json', '{kaputt');
  assert.equal(await N.profilSpiegelHolen(S), false);
  dateien.set('itqan-profil-spiegel.json', JSON.stringify({ format: 'anders' }));
  assert.equal(await N.profilSpiegelHolen(S), false);
});
