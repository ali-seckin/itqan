// Projekt unterstützen: freiwillige Unterstützung über PayPal, nur in der Android-App.
// Der Schalter SPENDE.an steht auf false, solange Googles Antwort und der Status als Privatperson offen sind (Entscheidung 24.11.2026:
// im ersten Paket aus, später an). Schaltet man ihn ein, erscheinen der Eintrag unter Profil › Mehr, das Info-Fenster und das Freitagsfenster.
// Ohne Schalter oder auf iPhone und im Browser bleibt alles unsichtbar. Die Fenster selbst stehen in js/app.js.
export const SPENDE = { an: false, url: 'https://www.paypal.me/aliseckin1' };
export const SPENDE_MERKER = 'itqan-spende-freitag';

// Android-App (Capacitor), nicht Browser und nicht iPhone
export const istAndroidApp = (g = globalThis) => !!g.Capacitor?.isNativePlatform?.() && g.Capacitor?.getPlatform?.() === 'android';
export const spendeMoeglich = (g = globalThis, schalter = SPENDE) => !!schalter.an && istAndroidApp(g);

// Tag als JJJJ-MM-TT nach der Ortszeit des Geräts
export const tagKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// Freitag, und das Fenster wurde an diesem Tag noch nicht gezeigt
export const freitagFaellig = (d = new Date(), gemerkt = '') => d.getDay() === 5 && gemerkt !== tagKey(d);
// Nicht mitten im Üben oder in der Einführung: nur auf den ruhigen Ansichten
export const ruheRoute = hash => ['', 'heute', 'karte', 'mushaf', 'uebungen', 'profil'].includes(String(hash ?? '').replace(/^#/, '').split(/[/?]/)[0]);
