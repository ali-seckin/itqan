// Itqān · Versionsnummer und „Was ist neu“. Bei jeder Veröffentlichung: VERSION erhöhen und oben einen Eintrag ergänzen.
export const VERSION = '1.11';

// Adresse für „Rückmeldung senden“. Leer: die Rückmeldung wird über das Teilen-Menü oder als E-Mail ohne Empfänger verschickt.
export const RUECKMELDUNG_AN = '';

export const NEUIGKEITEN = [
  { v: '1.11', datum: '2026-11-10', titel: 'Ohne Netz und beim Tippen', punkte: [
    'Ohne Netz bleibt der Text lesbar: Fehlt die Muṣḥaf-Schrift einer Seite, zeigt Itqān dieselben Zeilen in einfacher Schrift. Sobald du wieder Netz hast, kommt die Muṣḥaf-Schrift von selbst zurück.',
    'Die Seiten deines heutigen Wird speichert Itqān jetzt im Hintergrund. Alle 604 Seiten auf einmal sicherst du in den Einstellungen unter „Offline“.',
    'Beim Tippen in ein Suchfeld oder Textfeld weicht die Menüleiste. Sie rutscht nicht mehr über die Tastatur.',
    'Der Tag beginnt jetzt um 3 Uhr: Ein Wird nach Mitternacht zählt noch zum Vortag. Ändern kannst du das in den Einstellungen.'
  ] },
  { v: '1.10', datum: '2026-11-10', titel: 'Lesbarkeit und Hilfe', punkte: [
    'Seitengröße 100, 125 oder 150 %: Die Muṣḥaf-Seite wird größer, beim Üben folgt sie der Stelle, an der du bist. Dazu drei Schriftgrößen für die App.',
    'Zoomen mit zwei Fingern ist überall erlaubt. Knöpfe und Verweise sind mindestens 44 Punkte groß.',
    'Besser lesbar in Hell und Dunkel: Alle Texte halten den Kontrast für gut lesbare Schrift ein.',
    'Für Bildschirmleser und Tastatur: Jeder Knopf hat einen Namen, der Fokus ist sichtbar, die aufgedeckte Āya wird angesagt.',
    'Neu unter Profil: Hilfe und Glossar mit Antworten auf die häufigsten Fragen und allen Begriffen der App.'
  ] },
  { v: '1.9', datum: '2026-11-10', titel: 'Rückblick als Bild', punkte: [
    'Neu unter Profil: der Rückblick. Eine Woche oder ein Monat als Bild, mit Āyāt, erfüllten Tagen, Sicherheit, Kette und Punkten.',
    'Teilen auf iPhone und Android direkt aus der App, am Computer als Bilddatei. Mit oder ohne deinen Namen.',
    'Jeder Tag hat sein Zeichen: erfüllt, nachgeholt, zum Teil, Ruhetag oder ausgefallen. Darunter steht alles noch einmal in Worten.',
    'Das Bild entsteht auf deinem Gerät und folgt deinem Erscheinungsbild, hell oder dunkel.'
  ] },
  { v: '1.8', datum: '2026-11-10', titel: 'Mutašābihāt nachschlagen', punkte: [
    'Ähnliche Stellen unter Profil sind jetzt ein Nachschlagewerk: 300 Gruppen ähnlicher Verse mit 750 Stellen, auch die wortgleichen Āyāt.',
    'Suche nach Stelle (2:48), Sūra oder arabischen Wörtern. Filter nach Art des Unterschieds, nach seinem Ort in der Āya und nach Größe der Gruppe.',
    'Unter jeder Stelle steht, wie die folgende Āya beginnt. Gruppen, die meist aufeinander folgen, sind miteinander verknüpft.',
    'Neuer Bereich „Reihenfolge“: 81 Fälle, in denen dieselben Wörter in anderer Reihenfolge stehen, mit Regel und Ausnahmen.',
    'Von den Fehlerstellen führt ein Verweis direkt zur passenden Gruppe.'
  ] },
  { v: '1.7', datum: '2026-11-09', titel: 'Suche und ähnliche Stellen', punkte: [
    'Suche im ganzen Qurʾān ohne Vokale, auch offline: im Muṣḥaf oben auf die Lupe. Eine Stelle wie 2:255 springt direkt dorthin.',
    'Ähnliche Stellen (Mutašābihāt) unter Profil: zwei Āyāt nebeneinander, die Unterschiede markiert.',
    'Neuer Modus „Unterscheiden“: Nur die abweichenden Wörter sind verdeckt, du rezitierst beide Stellen und prüfst dich.'
  ] },
  { v: '1.6', datum: '2026-11-09', titel: 'Klug planen', punkte: [
    'Schwache Abschnitte: wähle in den Einstellungen zwischen „Ḫatma zuerst“, „Ausgewogen“ und „Schwächen zuerst“. Zusätzliche Wiederholungen stehen als „Festigen“ im Tagesplan.',
    'Ruhetage pro Wochentag und eine Pause bis zu 30 Tage. Die Kette wartet und läuft danach weiter.',
    'Neue Auswertung im Profil: Fehlerarten, Sūren mit Fehlern, Quote je Woche und Zeit je Abschnitt.'
  ] },
  { v: '1.5', datum: '2026-11-09', titel: 'Feinschliff der Überschriften', punkte: [
    'ʿAin und Hamza in der Umschrift kräftiger und deutlicher, etwa in „ʿalaikum“ oder „Juzʾ“.',
    'Große Überschriften etwas enger gesetzt und dadurch ruhiger.'
  ] },
  { v: '1.4', datum: '2026-11-09', titel: 'Klarere Schrift', punkte: [
    'Echte fette Schnitte statt künstlich verdickter Buchstaben.',
    'Sieben feste Schriftgrößen statt 31, dadurch ruhiger und einheitlicher.',
    'Kleinste Beschriftungen größer und besser lesbar, Zahlen gleich breit.'
  ] },
  { v: '1.3', datum: '2026-11-09', titel: 'Neues Zeichen', punkte: [
    'Itqān hat ein neues, schlichtes Zeichen: eine Nische mit einer Flamme, nach Sūra an-Nūr 24:35.',
    'Es ersetzt die Laterne auf dem Home-Bildschirm, im Browser, auf der Startseite, beim Abschluss und in der Kette.',
    'Hilfe beim Aufdecken heißt jetzt „Erstes Wort“, danach „Noch ein Wort“.',
    'Das Abhören durch eine zweite Person heißt jetzt „Jemand hört ab“.'
  ] },
  { v: '1.2', datum: '2026-11-09', titel: 'Verlässlich prüfen', punkte: [
    'Vorige Āya neu bewerten: Ein Fehltipp lässt sich zurücknehmen, auch die markierten Stellen.',
    '„Doch kein Fehler“ führt nach einem versehentlichen „Fehler“ zurück.',
    'Angefangene Übungen bleiben gespeichert und lassen sich am selben Tag fortsetzen.',
    'Sofortkorrektur: Die Āyāt mit Fehler kommen am Ende des Abschnitts gleich noch einmal.',
    'Hilfe Wort für Wort statt nur des ersten Wortes.',
    'Eigener Tageswechsel, z. B. um 3 Uhr, für ein Wird nach Mitternacht.',
    'Dezent: „Jemand hört ab“ öffnet den Text für eine zweite Person, die Fehler aufs Wort tippt.'
  ] },
  { v: '1.1', datum: '2026-11-09', titel: 'Schutz und Testbetrieb', punkte: [
    'Profil sichern öffnet am Handy das Teilen-Menü: in Dateien, iCloud Drive oder per WhatsApp an dich selbst.',
    'Vor dem Laden einer Sicherung siehst du, was darin steht.',
    'Nach sieben Tagen ohne Sicherung erinnert dich Heute daran.',
    'Schnappschüsse: Itqān legt täglich und vor wichtigen Schritten eine Kopie auf dem Gerät ab, die du zurückholen kannst.',
    'Anleitung zum Installieren auf dem Home-Bildschirm.',
    'Alle Seiten speichern zeigt den Stand und lässt sich nach einem Abbruch fortsetzen.',
    'Versionsnummer, diese Neuigkeiten und „Rückmeldung senden“ im Profil.'
  ] },
  { v: '1.0', datum: '2026-11-09', titel: 'Ausgangsstand', punkte: [
    'Stand der Sicherung vor dem Gutachten Teil A: 114 Ornamente, Doppelseite auf PC und Tablet, geführte Erklärung beim ersten Üben.'
  ] }
];
