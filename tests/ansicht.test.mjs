// Itqān · Tests zur Einfachen Ansicht: Voreinstellung, alte Profile, Wechsel ohne Datenverlust, Abgleich über das Journal
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Z, frisch, wirdErfuellen } from './umgebung.mjs';

test('Ansicht: ein neues Profil ohne Angabe zeigt „Alle Optionen“, mit „einfach“ die Einfache Ansicht', () => {
  frisch();
  assert.equal(Z.istEinfach(), false);
  assert.equal(Z.P.einst.ansicht, 'voll');
  frisch({ ansicht: 'einfach' });
  assert.equal(Z.istEinfach(), true);
});

test('Ansicht: ein altes Profil ohne den Schlüssel gilt als „Alle Optionen“', () => {
  frisch();
  delete Z.P.einst.ansicht;
  assert.equal(Z.istEinfach(), false);
});

test('Ansicht: der Wechsel ändert keinen Lernstand', () => {
  frisch();
  wirdErfuellen();
  const stand = () => JSON.stringify({ k: Z.P.karten, t: Z.P.tage, s: Z.P.summe, kette: Z.P.kette, z: Z.P.zyklus });
  const vorher = stand();
  Z.P.einst.ansicht = 'einfach'; Z.speichern();
  assert.equal(stand(), vorher);
  Z.P.einst.ansicht = 'voll'; Z.speichern();
  assert.equal(stand(), vorher);
});

test('Ansicht: der Wechsel kommt als Einstellungs-Eintrag ins Journal und gilt beim Nachbau', () => {
  Z.geraetSetzen('aaa'); Z.logGrenze(1e9);
  frisch();
  const sockel = JSON.parse(JSON.stringify(Z.P)); sockel.log = [];
  Z.P.einst.ansicht = 'einfach'; Z.speichern();
  const ei = Z.P.log.filter(e => e.y === 'ei' && e.k === 'einst.ansicht');
  assert.equal(ei.length, 1);
  assert.equal(ei[0].w, 'einfach');
  assert.equal(Z.nachbau(sockel, Z.P.log).einst.ansicht, 'einfach');
  Z.logGrenze(0);
});
