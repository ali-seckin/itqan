// Itqān · Tests zu Etappe 5: Mutašābihāt nachschlagen (Gruppen ähnlicher Verse, Reihenfolge-Fälle), offline
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { D, lies } from './umgebung.mjs';
const S = await import('../js/suche.js');
const NL = await import('../js/aehnlich.js');
const TEXT = lies('daten/text.json'), PAARE = lies('daten/mutashabihat.json');
S.datenSetzen(TEXT, PAARE);
NL.datenSetzen(lies('daten/aehnlich.json'), PAARE);
const A = await NL.laden(), t = await S.textLaden();
const vi = (s, a) => D.V.findIndex(v => v[0] === s && v[1] === a);
const gruppen = (q, F) => NL.familienListe(A, t, NL.anfrage(q), F);
const faelle = q => NL.faelleListe(A, t, NL.anfrage(q));

test('Daten: 300 Gruppen mit 750 Stellen, 81 Reihenfolge-Fälle, alle Verweise lösen auf', () => {
  assert.equal(A.f.length, 300);
  assert.equal(A.stellen, 750);
  assert.equal(A.faelle.length, 81);
  assert.equal(A.t.length, 7);
  for (const f of A.f) {
    assert.ok(f.s.length >= 2, f.k + ' hat weniger als zwei Stellen');
    assert.ok(NL.ART[f.art], f.k + ': Art ' + f.art);
    for (const x of f.was) assert.ok(NL.WAS[x], f.k + ': was ' + x);
    for (const x of f.wo) assert.ok(NL.WO[x], f.k + ': wo ' + x);
    if (f.art !== 'gleich') assert.ok(f.wo.length, f.k + ' ohne Ort des Unterschieds');
    for (const v of f.v) for (const x of v.g) {
      assert.ok(D.V[x], f.k + ': Āya ' + x);
      for (const j of v.d) assert.ok(j < t.u[x].length, `${f.k}: Wort ${j} in ${NL.stelleKurz(x)}`);
    }
    for (const [k] of [...(f.vor || []), ...(f.nach || [])]) assert.ok(A.FK[k], f.k + ' verweist auf ' + k);
    for (const k of [...(f.auch || []), ...(f.verw || [])]) assert.ok(A.FK[k], f.k + ' verweist auf ' + k);
    for (const k of f.t || []) assert.ok(A.TK[k], f.k + ' verweist auf den Fall ' + k);
  }
  for (const x of A.faelle) {
    assert.ok(x.ta && x.tb, x.k + ' ohne Wortlaut');
    assert.ok(x.ab.length >= x.ba.length && x.ba.length >= 1, x.k + ': die häufigere Folge steht nicht vorn');
    for (const [v, i, j] of [...x.ab, ...x.ba]) assert.ok(i < j && j < t.u[v].length, `${x.k}: Wörter ${i} bis ${j} in ${NL.stelleKurz(v)}`);
    for (const k of x.f) assert.ok(A.FK[k], x.k + ' verweist auf ' + k);
  }
});

test('Anfrage: Stelle, Sūrennummer, Sūrenname und arabische Wörter', () => {
  assert.equal(NL.anfrage('').aktiv, false);
  assert.equal(NL.anfrage('2:48').vi, vi(2, 48));
  assert.equal(NL.anfrage(' 2 48 ').vi, vi(2, 48));
  assert.equal(NL.anfrage('2.48').vi, vi(2, 48));
  assert.equal(NL.anfrage('2:999').vi, -1);
  assert.equal(NL.anfrage('55').sureQ, 55);
  assert.equal(NL.anfrage('Ar-Raḥmān').name, 'arrahman');
  assert.equal(NL.anfrage('غَفُورٞ رَّحِيمٞ').text, 'غفوررحيم');
  assert.equal(NL.anfrage('', 7).aktiv, true);
});

test('Nachschlagen: 2:48 führt zu 2:123 und zum Reihenfolge-Fall, eine fremde Stelle zu nichts', () => {
  const l = gruppen('2:48');
  assert.ok(l.length >= 1);
  assert.ok(l.some(e => e.f.s.includes(vi(2, 123))), '2:123 fehlt in der Gruppe zu 2:48');
  assert.equal(l[0].erst, vi(2, 48));
  assert.ok(faelle('2:48').some(x => x.s.includes(vi(2, 123))), 'Reihenfolge-Fall zu 2:48 fehlt');
  assert.equal(gruppen('2:999').length, 0);
  assert.equal(faelle('2:999').length, 0);
});

test('Nachschlagen: Sūra als Nummer, als Name und als Auswahl geben dasselbe', () => {
  const nr = gruppen('55').map(e => e.f.k);
  assert.ok(nr.length >= 1);
  assert.deepEqual(gruppen('rahman').map(e => e.f.k), nr);
  assert.deepEqual(NL.familienListe(A, t, NL.anfrage('', 55)).map(e => e.f.k), nr);
  for (const [s, n] of A.suren) assert.ok(D.S[s] && n >= 1);
});

test('Nachschlagen: arabische Wörter ohne Vokale finden Gruppen und Fälle', () => {
  const l = faelle('غفور رحيم');
  assert.ok(l.length >= 1 && l.some(x => x.ta.includes('غَفُور')), 'Fall غفور رحيم fehlt');
  assert.ok(gruppen('حطة').some(e => e.f.s.includes(vi(2, 58)) && e.f.s.includes(vi(7, 161))), 'Gruppe 2:58 und 7:161 fehlt');
});

test('Filter: Art, Größe, Bereich und Reihenfolge', () => {
  assert.deepEqual(['gleich', 'fast', 'aehnlich'].map(art => gruppen('', { art }).length), [75, 29, 196]);
  assert.deepEqual(['2', '3', '6'].map(gr => gruppen('', { gr }).length), [236, 54, 10]);   // Paare, 3 bis 5, 6 und mehr Stellen
  for (const was of Object.keys(NL.WAS)) assert.ok(gruppen('', { was }).length >= 1, 'kein Fall für ' + was);
  const juz30 = x => D.V[x][0] >= 78, im = gruppen('', { nur: juz30 });
  assert.ok(im.length >= 1 && im.length < 300);
  assert.ok(im.every(e => e.f.s.some(juz30)));
  const mushaf = gruppen('');
  for (let i = 1; i < mushaf.length; i++) assert.ok(mushaf[i - 1].erst <= mushaf[i].erst);
  const gross = gruppen('', { sort: 'gross' });
  assert.equal(gross[0].f.s.length, 31);
  // als Verwechslung markierte Āya: ihre Gruppe steht oben
  const letzte = mushaf.at(-1).f, oben = gruppen('', { zuerst: new Set([letzte.s[0]]) });
  assert.equal(oben[0].f.k, letzte.k);
  assert.equal(oben[0].oben, true);
});

test('Paare zum Unterscheiden: jedes bestätigte Paar hängt an mindestens einer Gruppe', () => {
  const an = new Map();
  for (const f of A.f) for (const p of f.paare) an.set(p.key, (an.get(p.key) || 0) + 1);
  assert.equal(an.size, PAARE.length);
  const gemeinsam = A.f.reduce((n, f) => n + f.paare.filter(p => f.s.includes(p.a) && f.s.includes(p.b)).length, 0);
  assert.ok(gemeinsam >= PAARE.length - 1);
});

test('Texte: Fortsetzung, Merksatz, Regel und Markierung', () => {
  assert.equal(NL.danach(t, vi(1, 7)), '');                                   // Ende der Sūra
  assert.equal(NL.danach(t, vi(114, 6)), '');                                 // Ende des Qurʾān
  assert.equal(NL.danach(t, vi(1, 1)), t.u[vi(1, 2)].slice(0, 4).join(' '));  // 1:2 hat vier Wörter
  assert.ok(NL.danach(t, vi(2, 1)).endsWith(' …'));
  const gleich = A.f.find(f => f.art === 'gleich'), anders = A.f.find(f => f.art === 'aehnlich');
  assert.match(NL.merksatz(gleich), /^Derselbe Wortlaut/);
  assert.match(NL.merksatz(anders), /^Der Unterschied liegt (am|in der) /);
  for (const x of A.faelle) {
    const { satz, regel } = NL.fallSatz(x);
    assert.ok(satz.length > 10 && !/[–—]/.test(satz));
    assert.equal(regel, x.ab.length >= 3 && x.ab.length >= 2 * x.ba.length);
    const [v, i, j] = x.ab[0], m = NL.markFuer(x, x.ab[0]);
    assert.equal(m(i), 'kern'); assert.equal(m(j), 'kern');
    if (i > 0) assert.equal(m(i - 1), '');
    assert.equal(m(j + 1), '');
    assert.ok(v >= 0);
  }
});

test('Offline und Version: neue Dateien im Service Worker, Neuigkeiten zur Version', async () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  for (const d of ['js/aehnlich.js', 'daten/aehnlich.json']) assert.ok(sw.includes(`'${d}'`), d + ' fehlt in der Offline-Liste');
  const { VERSION, NEUIGKEITEN } = await import('../js/version.js');
  assert.equal(NEUIGKEITEN[0].v, VERSION);
  for (const p of NEUIGKEITEN[0].punkte) assert.ok(!/[–—]/.test(p), 'Gedankenstrich in den Neuigkeiten');
});
