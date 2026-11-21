// Itqān · Serverdateien (konzept/server), Regressionstests zum Audit 1.99 (S5, S8, S12, S14, S15): Die SQL-Dateien lassen sich hier
// nicht ausführen. Geprüft wird nur, was sich am Text prüfen lässt: leerer Suchpfad, Grenzen vorhanden, Nachtrag und Stammdateien
// im gleichen Wortlaut, und dass die App genau die Funktionen und Parameter ruft, die das SQL anlegt.
// Die Regeln selbst prüft werkzeuge/server/test_server.mjs gegen den echten Server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const ordner = new URL('../../konzept/server/', import.meta.url);
const da = existsSync(new URL('nachtrag_2026-11-21.sql', ordner));
const lies = n => readFileSync(new URL(n, ordner), 'utf8').replace(/\r\n/g, '\n');
const opt = { skip: !da && 'ohne konzept/server (nur im Gesamtprojekt)' };
// Rümpfe der Funktionen: Name → Text von „create or replace function“ bis zum schließenden $$;
const funktionen = sql => Object.fromEntries([...sql.matchAll(/create or replace function public\.(\w+)\([\s\S]*?\$\$[\s\S]*?\$\$;/g)].map(m => [m[1], m[0]]));

test('S15: jede Funktion mit security definer hat einen leeren Suchpfad, keine nutzt „search_path = public“', opt, () => {
  for (const datei of ['schema.sql', 'forschung.sql', 'nachtrag_2026-11-21.sql']) {
    const sql = lies(datei), f = funktionen(sql);
    assert.ok(Object.keys(f).length > 0, datei);
    assert.ok(!/search_path\s*=\s*public/.test(sql), `${datei}: search_path = public`);
    for (const [name, text] of Object.entries(f)) {
      assert.match(text, /set search_path = ''/, `${datei}: ${name} ohne leeren Suchpfad`);
      // mit leerem Suchpfad muss jede Tabelle mit Schema genannt sein (neu und alt sind die Übergangstabellen der Auslöser)
      const rumpf = text.replace(/--.*$/gm, '');
      for (const m of rumpf.matchAll(/(?:from|join|update|insert into)\s+([a-z_]+)(?!\.)/g)) assert.ok(['neu', 'alt'].includes(m[1]), `${datei}: ${name} nennt ${m[1]} ohne Schema`);
    }
  }
});

test('Nachtrag und Stammdateien haben denselben Wortlaut', opt, () => {
  const n = funktionen(lies('nachtrag_2026-11-21.sql')), stamm = { ...funktionen(lies('schema.sql')), ...funktionen(lies('forschung.sql')) };
  assert.deepEqual(Object.keys(n).sort(), ['eintraege_abzug', 'eintraege_aufraeumen', 'eintraege_grenzen', 'forschung_grenzen', 'forschung_loeschen', 'sockel_setzen']);
  for (const [name, text] of Object.entries(n)) assert.equal(stamm[name], text, name);
  assert.ok(stamm.konto_loeschen, 'konto_loeschen bleibt in schema.sql');
});

test('S5 / S8: Grenzen für forschung und eintraege sind als Auslöser angelegt, der Nachtrag ist wiederholbar', opt, () => {
  const n = lies('nachtrag_2026-11-21.sql');
  for (const [tabelle, name, ereignis] of [['forschung', 'forschung_grenzen', 'insert'], ['eintraege', 'eintraege_grenzen', 'insert'], ['eintraege', 'eintraege_abzug', 'delete']]) {
    assert.ok(n.includes(`drop trigger if exists ${name} on public.${tabelle};`), `${name}: erst entfernen`);
    assert.match(n, new RegExp(`create trigger ${name} after ${ereignis} on public\\.${tabelle}\\s+referencing (new|old) table as (neu|alt) for each statement execute function public\\.${name}\\(\\);`));
  }
  const f = funktionen(n);
  for (const wort of ['je_aufruf', 'je_tag', 'je_nummer', 'gesamt']) assert.ok(f.forschung_grenzen.includes(wort), wort);
  for (const wort of ['max_zeilen', 'max_bytes']) assert.ok(f.eintraege_grenzen.includes(wort), wort);
  // wiederholbar: nichts wird ohne „if not exists“, „or replace“ oder vorheriges „drop … if exists“ angelegt
  assert.ok(!/create table (?!if not exists)/.test(n)); assert.ok(!/create index (?!if not exists)/.test(n)); assert.ok(!/create function/.test(n));
  for (const m of n.matchAll(/add constraint (\w+)/g)) assert.ok(n.includes(`drop constraint if exists ${m[1]};`), m[1]);
  assert.match(n, /^begin;$/m); assert.match(n, /^commit;\s*$/m);
  // niemand ohne Anmeldung darf die Kontofunktionen rufen
  for (const name of ['sockel_setzen', 'eintraege_aufraeumen']) assert.match(n, new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon;`));
});

test('S12 / S14: die App ruft die Funktionen mit genau den Parametern, die das SQL anlegt', opt, () => {
  const sql = funktionen(lies('nachtrag_2026-11-21.sql')), app = readFileSync(new URL('../js/abgleich.js', import.meta.url), 'utf8');
  const kopf = sql.sockel_setzen.split('returns')[0], parameter = [...kopf.matchAll(/\b(p_\w+)\s+(?:integer|bigint|text|jsonb)/g)].map(m => m[1]);
  assert.deepEqual(parameter, ['p_n', 'p_z', 'p_g', 'p_stand', 'p_erwartet_n', 'p_erwartet_z', 'p_erwartet_g']);
  const aufruf = app.split("rpc/sockel_setzen'")[1].split('});')[0];
  for (const p of parameter) assert.ok(aufruf.includes(p + ':'), `abgleich.js sendet ${p}`);
  assert.ok(app.includes("rpc/eintraege_aufraeumen'")); assert.ok(sql.eintraege_aufraeumen.includes('e.sockel_n < p.sockel_n'));
  assert.match(sql.sockel_setzen, /return 'konflikt'/); assert.match(sql.sockel_setzen, /return 'ok'/);
});
