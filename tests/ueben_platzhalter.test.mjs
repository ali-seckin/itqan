// Üben mit Aufnahme: Solange der Rekorder nach dem Aufdecken noch ausläuft, hält ein unsichtbarer Knopf den Platz des Play-Knopfs frei,
// damit die Knöpfe daneben nicht ruckeln (zwei Stellen: einzelne Āya und ganzer Abschnitt). Ohne Aufnahme gibt es keinen Platzhalter.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const app = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'js/app.js'), 'utf8');

test('Platzhalter für den Play-Knopf: nur während der Rekorder ausläuft, gleiche Klassen wie der Knopf, unsichtbar und nicht erreichbar', () => {
  const m = app.match(/const hoerenPlatz = \(\) => rec \? '([^']*)' : '';/);
  assert.ok(m, 'Platzhalter hängt an der laufenden Aufnahme (rec), sonst leer');
  assert.match(m[1], /class="knopf leise rund"/, 'dieselbe Größe wie der Play-Knopf');
  assert.match(m[1], /disabled/); assert.match(m[1], /tabindex="-1"/); assert.match(m[1], /aria-hidden="true"/); assert.match(m[1], /visibility:hidden/);
  assert.equal((app.match(/\$\{aufnahme \? `<button class="knopf leise rund" id="hoeren"[^`]*` : hoerenPlatz\(\)\}/g) || []).length, 2, 'beide Stellen: Bewertung und ganzer Abschnitt');
  assert.ok(!/id="hoeren"[^>]*hidden/.test(app), 'der echte Play-Knopf bleibt sichtbar');
});
