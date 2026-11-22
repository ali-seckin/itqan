// Itqān · Lernprotokoll: die Zustimmung gehört zu einem Profil. Wechselt das Profil, endet sie auf jedem Weg (Audit 1.99, N7)
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Z, D, frisch, tagSetzenZurueck } from './umgebung.mjs';
import * as F from '../js/forschung.js';

after(() => { Z.abschlussHakenSetzen(null); tagSetzenZurueck(); });
const ok = id => Array.from({ length: D.A[id].ayat }, () => 'ok');

test('Ein anderes Profil beendet die Zustimmung, es wird nichts mehr aufgezeichnet', () => {
  frisch({ pensum: 2 }); Z.abschlussHakenSetzen(F.eintragen);
  F.einschalten(Z.P.erstellt); assert.equal(F.an(), true);
  const id = Z.tagesplan().plan[0]; Z.abschnittAbschliessen(id, ok(id));
  assert.equal(F.warteschlange().length, 1, 'mit dem eigenen Profil wird aufgezeichnet');
  Z.P.erstellt = '2031-01-01T00:00:00.000Z';                       // ein anderes Profil liegt jetzt auf dem Gerät (zum Beispiel vom Konto übernommen)
  const id2 = Z.tagesplan().plan[1] ?? Z.tagesplan().plan[0]; Z.abschnittAbschliessen(id2, ok(id2));
  assert.equal(F.an(), false, 'die Zustimmung ist beendet');
  assert.equal(F.warteschlange().length, 0, 'die Warteschlange ist leer');
});

test('Zustimmung aus einer früheren Fassung ohne Profilbindung wird beim ersten Eintrag gebunden', () => {
  frisch({ pensum: 2 }); Z.abschlussHakenSetzen(F.eintragen);
  F.einschalten();                                                 // wie in 2.00: ohne Profil
  const id = Z.tagesplan().plan[0]; Z.abschnittAbschliessen(id, ok(id));
  assert.equal(F.an(), true); assert.equal(F.warteschlange().length, 1);
  assert.equal(JSON.parse(localStorage.getItem('itqan-forschung')).profil, Z.P.erstellt);
});
