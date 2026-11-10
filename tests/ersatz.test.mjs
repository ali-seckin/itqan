// Itqān · Tests zur Ersatzschrift: Fehlt die Schrift einer Seite, steht derselbe Text in einfacher Schrift
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { D, lies } from './umgebung.mjs';
const M = await import('../js/mushaf.js');
const TEXT = lies('daten/text.json'), U = TEXT.u.map(x => x.split('|'));

test('Ersatzschrift: Jede Āya hat im Seitenbild genau ein Stück mehr als im Text (das Endzeichen)', () => {
  for (const f of ['daten/layout_v1.json', 'daten/layout_v2.json']) {
    const n = new Map();
    for (const seite of lies(f)) for (const z of seite) if (z?.w) for (const e of z.w) n.set(e[1], (n.get(e[1]) || 0) + 1);
    assert.equal(n.size, U.length, f);
    U.forEach((w, vi) => assert.equal(n.get(vi), w.length + 1, `${f}, Āya ${vi}`));
  }
});

test('Ersatzschrift: Wort, Endzeichen mit Nummer und Marken für Stoppzeichen', () => {
  M.textSetzen(U);
  assert.equal(M.ersatz(0, 0), U[0][0]);
  assert.equal(M.ersatz(0, U[0].length), '١');                       // 1:1, Endzeichen
  const vi = D.V.findIndex(v => v[0] === 2 && v[1] === 255);
  assert.equal(M.ersatz(vi, U[vi].length), '٢٥٥');
  assert.ok(M.ersatz(vi, 1, 'wq').endsWith('<span class="wq"></span>'));
  assert.ok(M.ersatz(vi, 1, 'wn').endsWith('<span class="wq la"></span>'));
  assert.equal(M.ersatz(vi, 1, 'ow'), U[vi][1]);
});
