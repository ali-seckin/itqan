// Itqān · Audit 1.99, Behebung Oberfläche Teil 2: Abhaken und offene Kontrolle (N4), Zwischenstand je Abschnitt (B-31),
// Dauer ohne Profil (Startseite), Kalenderdatei (P15), Mitteilungen der Store-App (P12), Seitenschriften (P19)
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Z, D, frisch, naechsterTag, tagSetzenZurueck } from './umgebung.mjs';
import { kalenderDatei } from '../js/nativ.js';

after(() => { tagSetzenZurueck(); });
const ok = id => Array(D.A[id].ayat).fill('ok');
const falsch = id => Array(D.A[id].ayat).fill('fehler');

test('N4: Abhaken erfüllt eine offene Kontrolle nicht, der Wird zählt trotzdem', () => {
  frisch({ pensum: 1 });
  const id = Z.tagesplan().plan[0];
  Z.abschnittAbschliessen(id, falsch(id));
  const nach = { ...Z.karte(id) };
  assert.ok(nach.kon, 'nach einem deutlichen Fehler steht eine Kontrolle an');
  naechsterTag();
  const t = Z.tagesplan();
  assert.ok(t.plan.includes(id)); assert.equal(t.art[id], 'fehler');
  const r = Z.abschnittAbhaken(id);
  assert.ok(r);
  const k = Z.karte(id);
  assert.equal(k.kon, nach.kon, 'die Kontrolle bleibt stehen');
  assert.equal(k.S, nach.S, 'das Modell bleibt, wie es war');
  assert.equal(k.zul, nach.zul, 'abgehakt gilt nicht als geprüft');
  assert.ok(Z.tagesplan().fertig.includes(id), 'für den Tagesplan zählt das Abhaken');
  naechsterTag();
  const t2 = Z.tagesplan();
  assert.ok(t2.plan.includes(id), 'am nächsten Tag steht der Abschnitt wieder im Plan'); assert.equal(t2.art[id], 'fehler');
  Z.abschnittAbschliessen(id, ok(id));
  assert.equal(Z.karte(id).kon, null, 'erst die Prüfung in der App erfüllt die Kontrolle');
});

test('N4: abgehakt und am selben Tag fehlerfrei in der App geprüft erfüllt die Kontrolle', () => {
  frisch({ pensum: 1 });
  const id = Z.tagesplan().plan[0];
  Z.abschnittAbschliessen(id, falsch(id));
  naechsterTag(); Z.tagesplan();
  assert.ok(Z.abschnittAbhaken(id));
  const r = Z.abschnittAbschliessen(id, ok(id), 'frei');
  assert.equal(r.wiederholung, false); assert.equal(Z.karte(id).kon, null);
});

test('N4: ohne offene Kontrolle bleibt das Abhaken, wie es war (Eintrag älterer Versionen ohne kb ebenso)', () => {
  frisch({ pensum: 1 });
  const id = Z.tagesplan().plan[0];
  assert.ok(Z.abschnittAbhaken(id));
  assert.equal(Z.karte(id).zul, Z.heute()); assert.equal(Z.karte(id).ah, Z.heute()); assert.equal(Z.karte(id).st, 0);
});

test('Pause, die erst morgen beginnt (heute schon geübt), lässt sich zurücknehmen', () => {
  frisch({ pensum: 1 });
  const id = Z.tagesplan().plan[0];
  Z.abschnittAbschliessen(id, ok(id));
  Z.pauseBeginnen(7);
  assert.equal(Z.pauseJetzt(), null); assert.equal(Z.P.pausen.length, 1); assert.equal(Z.P.pausen[0].von, Z.plusTage(Z.heute(), 1));
  assert.ok(Z.pauseBeenden(), 'die künftige Pause wird beendet');
  assert.equal(Z.P.pausen.length, 0);
  assert.equal(Z.pauseBeenden(), false, 'ohne Pause gibt es nichts zu beenden');
  assert.ok(Z.tagesplan().fertig.includes(id), 'der geübte Tag bleibt, wie er war');
});

test('B-31: Zwischenstände je Abschnitt, Löschen trifft nur den genannten, die alte Form wird gelesen', () => {
  frisch({ datum: '2026-03-01' });
  Z.zwischenstandSpeichern(4, '', ['ok', 'fehler']);
  Z.zwischenstandSpeichern(5, '', ['ok']);
  Z.zwischenstandSpeichern(4, 'bonus', ['zoegern']);
  assert.deepEqual(Z.zwischenstandLaden(4, '').erg, ['ok', 'fehler']);
  assert.deepEqual(Z.zwischenstandLaden(5, '').erg, ['ok']);
  assert.deepEqual(Z.zwischenstandLaden(4, 'bonus').erg, ['zoegern']);
  assert.equal(Z.zwischenstand().id, 4); assert.equal(Z.zwischenstand().quelle, 'bonus');
  Z.zwischenstandLoeschen(5, '');
  assert.equal(Z.zwischenstandLaden(5, ''), null);
  assert.deepEqual(Z.zwischenstandLaden(4, '').erg, ['ok', 'fehler'], 'der andere angefangene Abschnitt bleibt');
  Z.zwischenstandLoeschen(4, 'bonus'); Z.zwischenstandLoeschen(4, '');
  assert.equal(localStorage.getItem('itqan-zwischenstand'), null, 'ohne Rest bleibt kein Schlüssel liegen');
  // Form der Versionen bis 1.99: ein einziger Stand
  localStorage.setItem('itqan-zwischenstand', JSON.stringify({ id: 7, quelle: '', erg: ['ok'], tag: Z.heute(), gliederung: D.gliederung }));
  assert.deepEqual(Z.zwischenstandLaden(7, '').erg, ['ok']);
  Z.zwischenstandSpeichern(8, '', ['fehler']);
  assert.deepEqual(Z.zwischenstandLaden(7, '').erg, ['ok']); assert.deepEqual(Z.zwischenstandLaden(8, '').erg, ['fehler']);
  naechsterTag();
  assert.equal(Z.zwischenstandLaden(7, ''), null); assert.equal(Z.zwischenstand(), null);
  Z.zwischenstandSpeichern(9, '', ['ok']);
  assert.deepEqual(Object.keys(JSON.parse(localStorage.getItem('itqan-zwischenstand')).liste), ['9|'], 'am neuen Tag sind die alten Stände fort');
  Z.zwischenstandLoeschen();
});

test('Startseite: Dauer ohne Profil stimmt mit der Spanne eines frischen Profils überein', () => {
  frisch({ pensum: 3 });
  const N = Z.reihe().length, mit = Z.khatmaSpanne(), ohne = Z.khatmaSpanneFuer(N, 3);
  assert.deepEqual(ohne, mit);
  assert.ok(ohne.bis >= ohne.von && ohne.von >= Math.ceil(N / 3));
  const klein = Z.khatmaSpanneFuer(26, 1);
  assert.ok(Number.isFinite(klein.von) && klein.von >= 26);
  assert.deepEqual(Z.khatmaSpanneFuer(0, 3), { von: 0, bis: 0 });
});

test('P15 Kalenderdatei: feste Kennung, Folgenummer, nur Wird-Tage, Pause ausgenommen, Texte maskiert, Zeilen höchstens 75 Oktette', () => {
  const basis = { zeit: '05:30', titel: 'Itqān · Wird, nach dem Faǧr; täglich', text: 'Zeit für dein Wird\nmit einem sehr langen Zusatz, der sicher über fünfundsiebzig Oktette hinausreicht, äöü ÄÖÜ ß', adresse: 'https://app.itqan.at/', uid: 'itqan-wird-abc@itqan.at', stempel: new Date(Date.UTC(2026, 10, 21, 8, 0, 0)) };
  const a = kalenderDatei({ ...basis, folge: 0, tage: [true, true, true, true, false, true, true], start: '2026-11-20', aus: ['2026-11-23', '2026-11-24', 'unsinn'] });
  const b = kalenderDatei({ ...basis, folge: 1, zeit: '21:05', tage: Array(7).fill(true), start: '2026-11-20' });
  const entfaltet = t => t.replace(/\r\n /g, '');
  for (const ics of [a, b]) {
    assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
    for (const z of ics.split('\r\n')) assert.ok(new TextEncoder().encode(z).length <= 75, 'Zeile zu lang: ' + z);
    assert.match(entfaltet(ics), /UID:itqan-wird-abc@itqan\.at\r\n/);
  }
  assert.match(a, /SEQUENCE:0\r\n/); assert.match(b, /SEQUENCE:1\r\n/);
  // der 20.11.2026 ist ein Freitag und hier Ruhetag: der erste Termin liegt am Samstag
  assert.match(a, /DTSTART:20261121T053000\r\n/);
  assert.match(a, /RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,SA,SU\r\n/);
  assert.match(a, /EXDATE:20261123T053000,20261124T053000\r\n/);
  assert.match(b, /DTSTART:20261120T210500\r\n/); assert.match(b, /RRULE:FREQ=DAILY\r\n/); assert.doesNotMatch(b, /EXDATE/);
  const ea = entfaltet(a);
  assert.match(ea, /SUMMARY:Itqān · Wird\\, nach dem Faǧr\\; täglich\r\n/);
  assert.match(ea, /DESCRIPTION:Zeit für dein Wird\\nmit einem sehr langen Zusatz\\, der.*ß\. https:\/\/app\.itqan\.at\/\r\n/);
  assert.doesNotMatch(a, /\d{13}@/, 'keine Kennung aus der Uhrzeit');
});

test('P12 Mitteilungen: je Wird-Tag eine Planung, in der Pause nur die Tage danach, entzogene Erlaubnis schaltet ab', async () => {
  // Attrappe der Hülle: Liste geplanter Kennungen
  const geplant = new Map(); let erlaubnis = 'granted';
  const LN = {
    cancel: async ({ notifications }) => { for (const n of notifications) geplant.delete(n.id); },
    schedule: async ({ notifications }) => { for (const n of notifications) geplant.set(n.id, n); },
    checkPermissions: async () => ({ display: erlaubnis }), requestPermissions: async () => ({ display: erlaubnis })
  };
  const vorher = { C: globalThis.Capacitor, d: globalThis.document, M: globalThis.MutationObserver };
  globalThis.Capacitor = { isNativePlatform: () => true, Plugins: { LocalNotifications: LN } };
  globalThis.document = { documentElement: { classList: { add() {} }, dataset: {} } };
  globalThis.MutationObserver = class { observe() {} };
  try {
    const N = await import('../js/nativ.js?huelle');
    assert.equal(N.NATIV, true); assert.equal(N.mitteilungMoeglich, true);
    const inhalt = { zeit: '05:30', titel: 'Itqān · Wird', text: 'Zeit für dein Wird' };
    assert.equal(await N.mitteilungSchalten(true, { ...inhalt, tage: Array(7).fill(true) }), true);
    assert.deepEqual([...geplant.keys()], [1], 'alle Tage: eine tägliche Planung');
    await N.mitteilungPlanen({ ...inhalt, tage: Array(7).fill(true) });
    assert.equal(geplant.size, 1, 'zweimal geplant bleibt eine Planung');
    // Freitag (Index 4) ist Ruhetag
    await N.mitteilungPlanen({ ...inhalt, tage: [true, true, true, true, false, true, true] });
    assert.deepEqual([...geplant.keys()].sort((a, b) => a - b), [11, 12, 13, 14, 16, 17]);
    assert.deepEqual([...geplant.values()].map(n => n.schedule.on.weekday).sort(), [1, 2, 3, 4, 5, 7], 'kein Freitag (6)');
    // Pause: nichts Wiederkehrendes, nur die ersten Wird-Tage danach
    const jahr = new Date().getFullYear() + 1;
    await N.mitteilungPlanen({ ...inhalt, tage: Array(7).fill(true), pause: true, danach: [`${jahr}-01-10`, `${jahr}-01-11`] });
    assert.deepEqual([...geplant.keys()], [21, 22]);
    assert.ok([...geplant.values()].every(n => n.schedule.at instanceof Date && !n.schedule.on));
    await N.mitteilungPlanen({ ...inhalt, pause: true, danach: [] });
    assert.equal(geplant.size, 0);
    // Erlaubnis in den Einstellungen des Geräts entzogen
    await N.mitteilungPlanen({ ...inhalt });
    erlaubnis = 'denied';
    assert.equal(await N.mitteilungPruefen(), true);
    assert.equal(N.mitteilungAn(), false); assert.equal(geplant.size, 0);
    assert.equal(await N.mitteilungPruefen(), false, 'danach gibt es nichts mehr zu melden');
    assert.equal(await N.mitteilungSchalten(true, inhalt), false, 'ohne Erlaubnis lässt sie sich nicht einschalten');
    // Ausschalten (Profil löschen) entfernt jede Planung
    erlaubnis = 'granted';
    await N.mitteilungSchalten(true, { ...inhalt, tage: [true, false, true, false, true, false, true] });
    assert.equal(geplant.size, 4);
    await N.mitteilungSchalten(false);
    assert.equal(geplant.size, 0);
  } finally {
    globalThis.Capacitor = vorher.C; globalThis.document = vorher.d; globalThis.MutationObserver = vorher.M;
    try { localStorage.removeItem('itqan-mitteilung'); } catch (e) {}
  }
});

test('P19 Seitenschriften: höchstens 40 bleiben angemeldet, sichtbare Seiten und zuletzt gebrauchte bleiben', async () => {
  const M = await import('../js/mushaf.js');
  const fonts = new Set(), sichtbar = [1, 2], namen = () => new Set([...fonts].map(f => f.family));
  const vorher = { d: globalThis.document, F: globalThis.FontFace, f: globalThis.fetch };
  globalThis.FontFace = class { constructor(name) { this.family = name; } load() { return Promise.resolve(this); } };
  globalThis.document = { fonts: { add: f => fonts.add(f), delete: f => fonts.delete(f) }, querySelector: sel => sichtbar.some(p => sel.includes(`data-p="${p}"`)) ? {} : null };
  globalThis.fetch = async url => /schriften\//.test(String(url)) ? { ok: true, arrayBuffer: async () => new ArrayBuffer(8) } : vorher.f(url);
  try {
    for (let p = 1; p <= 100; p++) assert.equal(await M.schrift(p), true);
    assert.equal(fonts.size, 40);
    for (const n of ['qp1', 'qp2', 'qp63', 'qp100']) assert.ok(namen().has(n), n + ' fehlt');
    assert.ok(!namen().has('qp3') && !namen().has('qp62'));
    await M.schrift(63);                       // gerade gebraucht: rückt ans Ende der Reihe
    assert.equal(await M.schrift(101), true);
    assert.ok(namen().has('qp63') && !namen().has('qp64'), 'abgemeldet wird die am längsten nicht gebrauchte');
    assert.equal(await M.schrift(3), true, 'eine abgemeldete Seite lädt bei Bedarf neu');
    assert.equal(fonts.size, 40);
  } finally { globalThis.document = vorher.d; globalThis.FontFace = vorher.F; globalThis.fetch = vorher.f; }
});
