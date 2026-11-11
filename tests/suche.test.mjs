// Itqān · Tests zu Etappe 4: Suche ohne Vokale (50 Probesuchen), Mutašābihāt, offline
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Z, D, lies, frisch } from './umgebung.mjs';
const S = await import('../js/suche.js');
const TEXT = lies('daten/text.json'), PAARE = lies('daten/mutashabihat.json'), PROBE = lies('tests/probesuchen.json');
S.datenSetzen(TEXT, PAARE);
const vi = (s, a) => D.V.findIndex(v => v[0] === s && v[1] === a);
const findet = async (q, ...stellen) => {
  const r = await S.suchen(q), da = new Set(r.liste.map(x => x.vi));
  for (const [s, a] of stellen) assert.ok(da.has(vi(s, a)), `„${q}“ findet ${s}:${a} nicht (${r.liste.length} Treffer)`);
  return r;
};

test('Probesuchen: 40 Wortfolgen aus einer vereinfachten Fassung finden ihre Āya', async () => {
  assert.equal(PROBE.auto.length, 40);
  for (const p of PROBE.auto) { const [s, a] = p.k.split(':').map(Number); await findet(p.q, [s, a]); }
});

test('Probesuchen: zehn typische Eingaben von Hand', async () => {
  await findet('الحي القيوم', [2, 255], [3, 2], [20, 111]);
  await findet('حطة', [2, 58], [7, 161]);                          // Tāʾ marbūṭa
  await findet('الصلاة', [2, 3], [2, 43]);                         // Uthmani schreibt ٱلصَّلَوٰةَ
  await findet('إياك نعبد', [1, 5]);                                // Hamza unter Alif
  await findet('قل هو الله أحد', [112, 1]);
  await findet('يؤمنون', [2, 3], [2, 4]);                          // Hamza auf Wāw
  await findet('إبراهيم', [2, 124], [14, 35]);
  await findet('ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', [1, 1], [1, 3]);           // voll vokalisiert eingegeben
  await findet('الحی القیوم', [2, 255]);                           // persische Tastatur
  const r = await S.suchen('2:255'); assert.equal(r.stelle, vi(2, 255));
});

test('Suche: Treffer markieren die richtigen Wörter, auch mit vorangestelltem wa-', async () => {
  const r = await S.suchen('الارض'), x = r.liste.find(y => y.vi === vi(2, 255));
  const woerter = TEXT.n[vi(2, 255)].split(' ');
  assert.ok(x); for (const i of x.woerter) assert.ok(woerter[i].includes('الارض'));
  assert.equal(x.woerter.size, 2);                                  // في الأرض und والأرض
  assert.ok(r.anzahl >= r.liste.length);
});

test('Suche: zu kurze Eingaben und Stellen außerhalb des Qurʾān', async () => {
  assert.ok((await S.suchen('ا')).zuKurz);
  assert.equal((await S.suchen('115:1')).stelle, null);
  assert.equal((await S.suchen('36 1')).stelle, vi(36, 1));
});

test('Suchtext: 6236 Āyāt, nur arabische Buchstaben, Wortzahl wie im Muṣḥaf', () => {
  assert.equal(TEXT.n.length, 6236); assert.equal(TEXT.u.length, 6236);
  for (let v = 0; v < 6236; v++) {
    assert.match(TEXT.n[v], /^[ء-ي ]+$/);
    assert.equal(TEXT.n[v].split(' ').length, TEXT.u[v].split('|').length);
  }
  assert.equal(S.normal('ٱلْحَىُّ ٱلْقَيُّومُ'), 'الحي القيوم');
});

test('Offline: Suchtext, Paare und Suchmodul gehören zum App-Gerüst', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  for (const f of ['daten/text.json', 'daten/mutashabihat.json', 'js/suche.js']) assert.ok(sw.includes(`'${f}'`), f);
});

test('Mutašābihāt: bekannte Paare sind dabei', () => {
  const hat = (a, b) => PAARE.some(p => p[0] === vi(...a) && p[1] === vi(...b));
  for (const [a, b] of [[[2, 58], [7, 161]], [[2, 35], [7, 19]], [[2, 49], [7, 141]], [[3, 126], [8, 10]], [[2, 136], [3, 84]]]) assert.ok(hat(a, b), `${a} ~ ${b}`);
});

test('Mutašābihāt: jede Paarung ist spielbar (Unterschiede vorhanden, Wortnummern gültig, nicht wortgleich)', () => {
  assert.ok(PAARE.length > 300);
  for (const [a, b, s, da, db] of PAARE) {
    const la = TEXT.u[a].split('|').length, lb = TEXT.u[b].split('|').length;
    assert.ok(a < b && s >= 60 && s < 100);
    assert.ok(da.length + db.length > 0);
    assert.ok(da.every(i => i >= 0 && i < la) && db.every(i => i >= 0 && i < lb));
    assert.notEqual(TEXT.n[a], TEXT.n[b]);
  }
});

test('Unterscheiden: Ergebnisse je Paar werden gezählt', () => {
  frisch();
  Z.unterscheidenMerken('10-20', true); Z.unterscheidenMerken('10-20', false);
  assert.deepEqual({ n: Z.P.mutash['10-20'].n, ok: Z.P.mutash['10-20'].ok, letzt: Z.P.mutash['10-20'].letzt }, { n: 2, ok: 1, letzt: 0 });
});
