// Itqān · Funktionen der Store-App (Capacitor-Hülle für App Store und Google Play). Im Browser ohne Wirkung.
// Erinnerung als echte Mitteilung (statt Kalendereintrag) und Statusleiste passend zum Hell- oder Dunkelmodus.
const C = globalThis.Capacitor;
export const NATIV = !!C?.isNativePlatform?.();
const PL = NATIV ? (C.Plugins || {}) : {};
const LN = PL.LocalNotifications, SB = PL.StatusBar;
export const mitteilungMoeglich = !!LN;

const SCHLUESSEL = 'itqan-mitteilung', ID = 1;   // pro Gerät, nicht im Profil: die Erlaubnis gehört zum Gerät
export const mitteilungAn = () => { try { return localStorage.getItem(SCHLUESSEL) === '1'; } catch (e) { return false; } };

// Plant die tägliche Mitteilung neu (oder entfernt sie, wenn ausgeschaltet). inhalt = { zeit: 'HH:MM', titel, text }
export async function mitteilungPlanen(inhalt) {
  if (!LN) return false;
  try { await LN.cancel({ notifications: [{ id: ID }] }); } catch (e) {}
  if (!mitteilungAn()) return true;
  const [hour, minute] = String(inhalt?.zeit || '05:30').split(':').map(Number);
  try {
    await LN.schedule({ notifications: [{ id: ID, title: inhalt.titel, body: inhalt.text, schedule: { on: { hour, minute }, allowWhileIdle: true } }] });
    return true;
  } catch (e) { return false; }
}

// Ein- oder ausschalten; beim Einschalten fragt das Gerät einmal um Erlaubnis. Ergebnis false = nicht erlaubt.
export async function mitteilungSchalten(an, inhalt) {
  if (!LN) return false;
  if (an) {
    try {
      let r = await LN.checkPermissions();
      if (r.display !== 'granted') r = await LN.requestPermissions();
      if (r.display !== 'granted') return false;
    } catch (e) { return false; }
  }
  try { localStorage.setItem(SCHLUESSEL, an ? '1' : '0'); } catch (e) {}
  return mitteilungPlanen(inhalt);
}

if (NATIV) {
  document.documentElement.classList.add('nativ');
  // Statusleiste: helle Schrift im Dunkelmodus, dunkle im Hellmodus (folgt data-modus, das die App setzt)
  const leiste = () => { if (SB) SB.setStyle({ style: document.documentElement.dataset.modus === 'dunkel' ? 'DARK' : 'LIGHT' }).catch(() => {}); };
  leiste();
  new MutationObserver(leiste).observe(document.documentElement, { attributes: true, attributeFilter: ['data-modus'] });
}
