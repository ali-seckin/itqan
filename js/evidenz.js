import { tx, gebiet } from './sprache.js';
// Itqān · Seite „Evidenz und Grenzen“: ehrlich, was das Lernmodell belegt und was nicht.
// Die Zahlen stehen hier an einer Stelle und stammen aus der Endprüfung der Simulation (werkzeuge/lernmodell/final_ergebnis_9000.md):
// welten: Zahl der Testwelten, klassisch und langzeit: kleinster und größter Vorsprung im Primärendpunkt über die vier Pensen
// (Tabelle „Gepaarter Unterschied“, Zeilen Klassisch und Langzeit (alt)), schwach: größter Rückstand hinter dem besten alten Modus
// (Tabelle „Nach Welttyp“). tests/evidenz.test.mjs prüft sie gegen diese Datei. Wer sie ändert, ändert auch die Website (werkzeuge/website/texte.py).
export const ZAHLEN = { welten: 66, klassisch: [1.3, 3.7], langzeit: [0.2, 5.6], schwach: 3.1 };

const dez = n => n.toLocaleString(gebiet('zahl'), { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Der Inhalt der Ansicht (Route #evidenz). zurueckPfeil: das Symbol des Zurück-Knopfs aus app.js
export function evidenzHTML(zurueckPfeil = '') {
  const w = ZAHLEN.welten, [k1, k2] = ZAHLEN.klassisch, [l1, l2] = ZAHLEN.langzeit;
  return `<button class="zurueck" data-ziel="#profil">${zurueckPfeil}${tx('allg.profil')}</button>
    <div class="marke">${tx('evidenz.titel')}<small>${tx('evidenz.untertitel')}</small></div>
    <div class="hinweisbox ev-kern">${tx('evidenz.kern')}</div>
    <h2 class="titel-klein">${tx('evidenz.tut_h')}</h2>
    <div class="abschnitt ev"><ul class="ev-liste">
      <li>${tx('evidenz.tut_1')}</li><li>${tx('evidenz.tut_2')}</li><li>${tx('evidenz.tut_3')}</li><li>${tx('evidenz.tut_4')}</li><li>${tx('evidenz.tut_5')}</li>
    </ul></div>
    <h2 class="titel-klein">${tx('evidenz.stuetzt_h')}</h2>
    <div class="abschnitt ev"><p>${tx('evidenz.stuetzt_1')}</p>
      <p>${tx('evidenz.stuetzt_2', { welten: w })}</p>
      <p>${tx('evidenz.stuetzt_3', { kvon: dez(k1), kbis: dez(k2), lvon: dez(l1), lbis: dez(l2) })}</p>
      <p>${tx('evidenz.stuetzt_4', { schwach: dez(ZAHLEN.schwach) })}</p>
      <p class="unter">${tx('evidenz.stuetzt_5')}</p></div>
    <h2 class="titel-klein">${tx('evidenz.nicht_h')}</h2>
    <div class="abschnitt ev"><ul class="ev-liste ev-offen">
      <li>${tx('evidenz.nicht_1')}</li><li>${tx('evidenz.nicht_2')}</li><li>${tx('evidenz.nicht_3')}</li><li>${tx('evidenz.nicht_4')}</li><li>${tx('evidenz.nicht_5')}</li>
    </ul></div>
    <h2 class="titel-klein">${tx('evidenz.pruefung_h')}</h2>
    <div class="abschnitt ev"><ul class="ev-liste">
      <li>${tx('evidenz.pruefung_1')}</li><li>${tx('evidenz.pruefung_2')}</li><li>${tx('evidenz.pruefung_3')}</li>
    </ul></div>
    <h2 class="titel-klein">${tx('evidenz.versprechen_h')}</h2>
    <div class="abschnitt ev"><ul class="ev-liste ev-offen">
      <li>${tx('evidenz.versprechen_1')}</li><li>${tx('evidenz.versprechen_2')}</li><li>${tx('evidenz.versprechen_3')}</li>
    </ul></div>
    <p class="unter ev-stand">${tx('evidenz.stand', { welten: w })}</p>
    <p class="unter ev-stand">${tx('evidenz.frage')}</p>
    <a class="knopf leise" href="#rueckmeldung" style="text-decoration:none;margin-top:10px">${tx('profil.rueckmeldung_senden')}</a>`;
}
