// Einstieg: zuerst die Sprache laden, dann die App. So stehen alle Texte bereit, bevor ein Modul der App läuft.
// Diese Datei hat bewusst keine statischen Importe und nur schlichte Schreibweise: Sie muss auch dann laufen, wenn ein Modul
// der App nicht lädt oder der Browser zu alt ist. Dann zeigt sie eine Notansicht statt des ewigen Ladebilds.
var dok = document, wurzel = dok.documentElement;
var FEHLER_KEY = 'itqan-letzter-fehler';   // derselbe Schlüssel wie in app.js: die Rückmeldung nennt den letzten Fehler
var FRIST_FEHLER = 4000, FRIST_STILLE = 20000;

// Steht noch das Ladebild aus index.html? (Die App ersetzt den Inhalt von #app, sobald sie läuft.)
function laedtNoch() { return !!dok.querySelector('#app .lade-logo'); }

function fehlerMerken(e, wo) {
  try {
    var kette = e && e.stack ? String(e.stack).split('\n').slice(0, 4).join(' / ') : '';
    var zeile = (new Date().toISOString().slice(0, 19) + ' ' + wo + ': ' + (e && e.name) + ': ' + (e && e.message) + ' | ' + kette).slice(0, 700);
    localStorage.setItem(FEHLER_KEY, zeile);
  } catch (x) { /* ohne Speicher bleibt nur die Konsole */ }
}

// Notansicht: reines DOM ohne Abhängigkeit von Sprache und App. Die festen Texte (Deutsch und Englisch) stehen als Vorlagen
// in index.html: not-laden, not-langsam, not-alt, not-rahmen. Fehlt die Vorlage (alte Startseite), bleibt ein Knopf.
var ladebild = null;   // das Ladebild aus index.html, für „Trotzdem öffnen“
function notansicht(art, beimKnopf) {
  var app = dok.getElementById('app'), vorlage = dok.getElementById('not-' + art) || dok.getElementById('not-laden'), kasten;
  if (!app) return;
  if (vorlage && vorlage.content && vorlage.content.firstElementChild) kasten = vorlage.content.firstElementChild.cloneNode(true);
  else {
    kasten = dok.createElement('div'); kasten.className = 'not'; kasten.dir = 'ltr';
    var ersatz = dok.createElement('button'); ersatz.type = 'button'; ersatz.className = 'knopf haupt'; ersatz.textContent = 'Reload';
    kasten.appendChild(ersatz);
  }
  var knopf = kasten.querySelector('button');
  if (knopf) knopf.onclick = beimKnopf || function () { location.reload(); };
  if (!ladebild) ladebild = app.querySelector('.lade');
  while (app.firstChild) app.removeChild(app.firstChild);
  app.appendChild(kasten);
}

// Globale Fänger: jeden unbehandelten Fehler festhalten. Steht danach immer noch das Ladebild, hilft die Notansicht weiter.
var notUhr = 0;
function spaeterPruefen(frist, art) { clearTimeout(notUhr); notUhr = setTimeout(function () { if (laedtNoch()) notansicht(art || 'laden'); }, frist); }
addEventListener('error', function (e) {
  fehlerMerken(e.error || { name: 'Error', message: (e.message || 'Fehler') + (e.filename ? ' (' + String(e.filename).split('/').pop() + ':' + e.lineno + ')' : '') }, 'global');
  if (laedtNoch()) spaeterPruefen(FRIST_FEHLER);
});
addEventListener('unhandledrejection', function (e) {
  var g = e.reason;
  fehlerMerken(g && typeof g === 'object' ? g : { name: 'Ablehnung', message: String(g) }, 'zusage');
  if (laedtNoch()) spaeterPruefen(FRIST_FEHLER);
});
spaeterPruefen(FRIST_STILLE, 'langsam');   // auch ohne Fehlermeldung (hängendes Netz) bleibt das Ladebild nicht für immer

function starten() {
  // huelle.js zuerst auswerten (Anpassungen für die Store-App), dann Sprache, dann die App
  import('./huelle.js')
    .then(function () { return import('./sprache.js'); })
    .then(function (m) { return m.ladeSprache(); })
    .then(function () { return import('./app.js'); })
    .catch(function (e) { fehlerMerken(e, 'laden'); clearTimeout(notUhr); notansicht('laden'); });
}

// Schutz gegen Einbetten in fremde Seiten (ein Antwortkopf dafür lässt sich bei diesem Hoster nicht setzen)
var fremderRahmen = false;
try { fremderRahmen = top !== self && top.location.origin !== location.origin; } catch (x) { fremderRahmen = true; }

// Mindestausstattung: Container-Einheiten (Muṣḥaf-Seiten) und Array.prototype.at. Fehlt etwas, kommt zuerst der Hinweis.
var modern = false;
try { modern = !!(window.CSS && CSS.supports && CSS.supports('width', '1cqw') && Array.prototype.at); } catch (x) { /* dann gilt der Browser als zu alt */ }

if (fremderRahmen) {
  clearTimeout(notUhr);
  notansicht('rahmen', function () { window.open(location.href, '_blank', 'noopener'); });
} else if (!modern) {
  clearTimeout(notUhr);
  // „Trotzdem öffnen“: das Ladebild wieder einsetzen und die App wie gewohnt starten
  notansicht('alt', function () {
    var app = dok.getElementById('app');
    while (app.firstChild) app.removeChild(app.firstChild);
    if (ladebild) app.appendChild(ladebild);
    spaeterPruefen(FRIST_STILLE, 'langsam'); starten();
  });
} else starten();

// Neue Fassung: bei der Rückkehr in die App höchstens stündlich nachsehen, aber nicht mitten in einer Übung
// (dort ist die untere Leiste ausgeblendet). Ein Wechsel des Workers wird am Wurzelelement vermerkt, damit die App darauf hinweisen kann.
if ('serviceWorker' in navigator && navigator.serviceWorker) {
  try {
    var sw = navigator.serviceWorker, zuletzt = Date.now(), gesteuert = !!sw.controller;
    dok.addEventListener('visibilitychange', function () {
      var leiste = dok.getElementById('nav');
      if (dok.hidden || Date.now() - zuletzt < 3600000 || (leiste && leiste.classList.contains('verdeckt'))) return;
      zuletzt = Date.now();
      sw.getRegistration().then(function (r) { if (r) return r.update(); }).catch(function () {});
    });
    sw.addEventListener('controllerchange', function () {
      if (gesteuert) { wurzel.dataset.neueVersion = '1'; dispatchEvent(new Event('itqan-neue-version')); }
      gesteuert = true;
    });
  } catch (x) { /* ohne Worker (Store-App, privates Fenster) entfällt das */ }
}
