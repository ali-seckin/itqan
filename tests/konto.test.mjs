// Itqān · Konto, Regressionstests zum Audit 1.99: S10 Abmelden, S11 Erneuern, S18 Code prüfen, S19 Konto löschen, S8 Captcha
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Z, frisch, gliederungSetzen, tagSetzenZurueck } from './umgebung.mjs';
import * as A from '../js/abgleich.js';
import * as K from '../js/konto.js';
import { attrappe } from './server_attrappe.mjs';

const urspruenglich = globalThis.localStorage;
let srv, zurueck;
A.autoSetzen(false);
after(() => { globalThis.localStorage = urspruenglich; Z.speicherSetzen(null); A.geraetWechsel(); gliederungSetzen('fort'); tagSetzenZurueck(); zurueck?.(); });
const speicherNeu = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() }; };
function neueWelt() { zurueck?.(); srv = attrappe(); zurueck = srv.einsetzen(); geraet(); }
function geraet(ls = speicherNeu()) { globalThis.localStorage = ls; Z.speicherSetzen(null); A.geraetWechsel(); return ls; }
const einloggen = async (email = 'ali@test.de') => { await A.codeSenden(email); return A.codePruefen(email, '123456'); };
const sitzung = () => JSON.parse(localStorage.getItem('itqan-konto'));
const veralten = () => { const s = sitzung(); s.ablauf = 0; localStorage.setItem('itqan-konto', JSON.stringify(s)); };

test('S10: Abmelden beendet nur die Sitzung dieses Geräts (scope=local), andere Geräte bleiben angemeldet', async () => {
  neueWelt(); const a = geraet(); await einloggen();
  const b = geraet(); await einloggen();
  assert.equal(srv.sitzungen(), 2);
  geraet(a);
  assert.equal(await A.abmelden(), true);
  assert.deepEqual(srv.abmeldungen, [{ scope: 'local', gueltig: true }]);
  assert.equal(srv.sitzungen(), 1, 'die Sitzung des anderen Geräts lebt');
  assert.equal(K.sitzung(), null);
  geraet(b); veralten();
  assert.ok(await K.api('/rest/v1/profile?select=sockel_n'), 'das andere Gerät kann weiter erneuern und lesen');
});

test('S10: abgelaufener Zugangsschlüssel wird vor dem Abmelden erneuert, damit der Server die Sitzung wirklich beendet', async () => {
  neueWelt(); await einloggen();
  srv.ablaufen();                                                 // der Server kennt den Schlüssel nicht mehr, das Gerät hält ihn noch für gültig
  assert.equal(await A.abmelden(), true);
  assert.deepEqual(srv.abmeldungen.map(x => x.gueltig), [false, true], 'erst abgelehnt, dann mit erneuertem Schlüssel');
  assert.equal(srv.sitzungen(), 0);
  await einloggen(); veralten();                                  // das Gerät weiß selbst, dass er abgelaufen ist
  assert.equal(await A.abmelden(), true);
  assert.equal(srv.abmeldungen.at(-1).gueltig, true); assert.equal(srv.sitzungen(), 0);
});

test('S10: lokal wird immer abgemeldet, auch ohne Netz oder wenn der Server ablehnt; die Abmeldung wird nachgeholt', async () => {
  neueWelt(); frisch(); await einloggen(); await A.abgleichen();
  srv.offline = true;
  assert.equal(await A.abmelden(), false);
  assert.equal(K.sitzung(), null); assert.equal(A.status().angemeldet, false); assert.equal(localStorage.getItem('itqan-abgleich'), null);
  assert.ok(Z.P, 'das Profil bleibt');
  assert.equal(srv.sitzungen(), 1, 'der Server weiß noch nichts');
  srv.offline = false;
  await K.abmeldenNachholen();
  assert.equal(srv.sitzungen(), 0, 'nachgeholt'); assert.equal(localStorage.getItem('itqan-konto-abmelden'), null);
  // der Server lehnt ab (5xx): lokal trotzdem abgemeldet, vorgemerkt
  await einloggen();
  srv.stoeren('/auth/v1/logout', { status: 500 });
  assert.equal(await A.abmelden(), false); assert.equal(K.sitzung(), null);
  await K.abmeldenNachholen(); assert.equal(srv.sitzungen(), 0);
  // der Server kennt die Sitzung nicht mehr: nichts vorzumerken
  await einloggen(); srv.ablaufen(); const s = sitzung(); s.r = 'falsch'; localStorage.setItem('itqan-konto', JSON.stringify(s));
  assert.equal(await A.abmelden(), false); assert.equal(K.sitzung(), null); assert.equal(localStorage.getItem('itqan-konto-abmelden'), null);
});

test('S11: 429 oder 5xx beim Erneuern löschen die Sitzung nicht, eine eindeutige Absage schon', async () => {
  neueWelt(); frisch(); await einloggen(); await A.abgleichen();
  for (const status of [429, 503, 408]) {
    veralten(); srv.stoeren('/auth/v1/token', { status, json: { msg: 'später' } });
    const r = await A.abgleichen();
    assert.equal(r.art, 'fehler', String(status)); assert.ok(K.sitzung(), `Sitzung bleibt bei ${status}`); assert.equal(A.status().angemeldet, true);
  }
  veralten(); srv.stoeren('/auth/v1/token', { status: 400, json: { msg: 'Unable to validate request' } });
  assert.equal((await A.abgleichen()).art, 'fehler'); assert.ok(K.sitzung(), 'ein 400 ohne Bezug zur Sitzung meldet nicht ab');
  assert.equal((await A.abgleichen()).art, 'ok', 'danach läuft es weiter');
  veralten(); srv.stoeren('/auth/v1/token', { status: 400, json: { error_code: 'refresh_token_already_used', msg: 'Invalid Refresh Token: Already Used' } });
  assert.equal((await A.abgleichen()).art, 'abgemeldet'); assert.equal(K.sitzung(), null);
});

test('S11: hat ein anderer Reiter inzwischen erneuert, meldet die Absage für den alten Schlüssel nicht ab', async () => {
  neueWelt(); await einloggen(); veralten();
  const echt = globalThis.fetch; let einmal = true;
  globalThis.fetch = async (url, opt) => {
    if (einmal && String(url).includes('/auth/v1/token')) {
      einmal = false;
      const alt = sitzung(), neu = JSON.parse(await (await echt(url, opt)).text());     // der andere Reiter verbraucht den Schlüssel …
      localStorage.setItem('itqan-konto', JSON.stringify({ ...alt, a: neu.access_token, r: neu.refresh_token, ablauf: Date.now() + 3e6 }));
      return echt(url, opt);                                                           // … dieser Reiter bekommt die Absage
    }
    return echt(url, opt);
  };
  try { assert.deepEqual(await K.api('/rest/v1/profile?select=sockel_n'), []); } finally { globalThis.fetch = echt; }
  assert.ok(K.sitzung(), 'weiter angemeldet');
});

test('S18: „zu viele Versuche“ bricht die Code-Prüfung sofort ab und ist von „Code falsch“ unterscheidbar', async () => {
  neueWelt(); await A.codeSenden('ali@test.de');
  srv.stoeren('/auth/v1/verify', { status: 429, json: { error_code: 'over_request_rate_limit', msg: 'zu viele' }, mal: 5 });
  const e = await A.codePruefen('ali@test.de', '000000').catch(x => x);
  assert.ok(e instanceof A.ServerFehler); assert.equal(e.status, 429);
  assert.equal(srv.anrufe('/auth/v1/verify'), 1, 'kein zweiter Versuch');
  assert.equal(A.codeFehlerArt(e), 'zu_oft');
  neueWelt(); await A.codeSenden('ali@test.de');
  const f = await A.codePruefen('ali@test.de', '000000').catch(x => x);
  assert.equal(A.codeFehlerArt(f), 'falsch'); assert.equal(f.code, 'otp_expired');
  srv.offline = true; assert.equal(A.codeFehlerArt(await A.codePruefen('ali@test.de', '123456').catch(x => x)), 'netz'); srv.offline = false;
  srv.stoeren('/auth/v1/verify', { status: 503 }); assert.equal(A.codeFehlerArt(await A.codePruefen('ali@test.de', '123456').catch(x => x)), 'server');
  assert.ok((await A.codePruefen('ali@test.de', '123456')).uid, 'der richtige Code gilt danach noch');
});

test('S19: Konto löschen lässt sich an eine frische Anmeldung binden; lokal wird danach immer abgemeldet', async () => {
  neueWelt(); frisch(); await einloggen(); await A.abgleichen();
  assert.ok(A.status().anmeldeAlter < 60000);
  const s = sitzung(); s.seit = Date.now() - 3600e3; localStorage.setItem('itqan-konto', JSON.stringify(s));
  await assert.rejects(A.kontoLoeschen({ hoechstAlter: 600e3 }), A.AnmeldungAltFehler);
  assert.equal(srv.profile.size, 1, 'nichts gelöscht'); assert.ok(K.sitzung());
  veralten(); await K.api('/rest/v1/profile?select=sockel_n');     // Erneuern macht die Anmeldung nicht jünger
  assert.ok(A.status().anmeldeAlter > 3000e3);
  await einloggen();                                              // neuer Code: frisch
  await A.kontoLoeschen({ hoechstAlter: 600e3 });
  assert.equal(srv.profile.size, 0); assert.equal(K.sitzung(), null); assert.equal(A.status().angemeldet, false);
});

test('S8: codeSenden gibt ein Captcha-Token an den Server weiter', async () => {
  neueWelt(); const echt = globalThis.fetch; const gesendet = [];
  globalThis.fetch = (url, opt) => { if (String(url).includes('/auth/v1/otp')) gesendet.push(JSON.parse(opt.body)); return echt(url, opt); };
  try { await A.codeSenden(' ali@test.de '); await A.codeSenden('ali@test.de', { captcha: 'tok' }); } finally { globalThis.fetch = echt; }
  assert.deepEqual(gesendet[0], { email: 'ali@test.de', create_user: true });
  assert.deepEqual(gesendet[1].gotrue_meta_security, { captcha_token: 'tok' });
});
