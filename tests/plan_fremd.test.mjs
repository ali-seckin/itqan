// Ein Plan aus einer anderen Gliederung (Profil im Modus „Ganze Seiten“ direkt nach dem Anlegen) wird beim Start bereinigt
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Z, D, gliederungSetzen, tagSetzen, tagSetzenZurueck } from './umgebung.mjs';
after(() => { gliederungSetzen('fort'); tagSetzenZurueck(); });

test('Plan aus der Abschnitts-Gliederung wird im Seitenmodus neu geplant', async () => {
  gliederungSetzen('fort'); localStorage.clear(); tagSetzen('2026-11-14'); tagSetzenZurueck();
  Z.neuesProfil({ name: 'T', pensum: 6, reihenfolge: 'zufall', modus: 'seite' });
  const alt = Z.tagesplan().plan;
  assert.ok(alt.length);
  gliederungSetzen('seite', 'v2');
  await Z.gliederungAbgleichen();
  assert.equal(Z.plaeneBereinigen(), 1);
  const neu = Z.tagesplan();
  assert.ok(neu.plan.length && neu.plan.every(id => D.A[id]));
  assert.equal(Z.plaeneBereinigen(), 0);
});
test('angefangener Tag behält nur vorhandene Einheiten', async () => {
  gliederungSetzen('fort'); localStorage.clear(); tagSetzen('2026-11-14'); tagSetzenZurueck();
  Z.neuesProfil({ name: 'T', pensum: 3, modus: 'seite' });
  const t = Z.tagesplan(); t.plan.push(700, 701); t.fertig.push(t.plan[0]); t.punkte = 50;
  gliederungSetzen('seite', 'v2');
  assert.equal(Z.plaeneBereinigen(), 1);
  const n = Z.tagesplan(); assert.ok(n.plan.every(id => D.A[id])); assert.equal(n.fertig.length, 1);
});
