// Itqān · Funktionen der Store-App (Capacitor-Hülle für App Store und Google Play). Im Browser ohne Wirkung.
// Erinnerung als echte Mitteilung (statt Kalendereintrag) und Statusleiste passend zum Hell- oder Dunkelmodus.
// Dazu die Kalenderdatei für den Browser (reine Funktion, ohne Zugriff auf Gerät oder Profil).
const C = globalThis.Capacitor;
export const NATIV = !!C?.isNativePlatform?.();
const PL = NATIV ? (C.Plugins || {}) : {};
const LN = PL.LocalNotifications, SB = PL.StatusBar;
export const mitteilungMoeglich = !!LN;

// Spiegel des Profils im Dateispeicher der Store-App: Die Web-Ansicht kann ihren localStorage bei Platznot leeren (iOS), eine Datei im
// App-Ordner bleibt. Gespiegelt wird nur das Profil (keine Anmeldedaten). Im Browser ohne Wirkung.
const FS = PL.Filesystem, SPIEGEL = 'itqan-profil-spiegel.json';
let spiegelUhr = null, spiegelText = null;
async function spiegelDatei(text) {
  try {
    if (text == null) await FS.deleteFile({ path: SPIEGEL, directory: 'DATA' });
    else await FS.writeFile({ path: SPIEGEL, data: text, directory: 'DATA', encoding: 'utf8' });
    return true;
  } catch (e) { return false; }
}
// text: das Profil als JSON; null, wenn das Profil bewusst gelöscht wurde (dann darf es nicht wiederkommen)
export function profilSpiegeln(text) {
  if (!FS) return;
  spiegelText = text;
  if (text == null) { clearTimeout(spiegelUhr); spiegelUhr = null; spiegelDatei(null); return; }
  if (spiegelUhr) return;                                              // gesammelt: höchstens alle 2,5 s eine Datei schreiben
  spiegelUhr = setTimeout(() => { spiegelUhr = null; spiegelDatei(spiegelText); }, 2500); spiegelUhr.unref?.();
}
export function spiegelSofort() { if (!FS || !spiegelUhr) return Promise.resolve(false); clearTimeout(spiegelUhr); spiegelUhr = null; return spiegelDatei(spiegelText); }
if (FS && typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden) spiegelSofort(); });
// Beim Start vor dem Laden des Profils: ist der Speicher der Web-Ansicht leer, die Datei aber da, kommt das Profil aus der Datei zurück.
export async function profilSpiegelHolen(schluessel) {
  if (!FS) return false;
  try {
    if (localStorage.getItem(schluessel)) return false;
    const r = await FS.readFile({ path: SPIEGEL, directory: 'DATA', encoding: 'utf8' });
    const text = typeof r?.data === 'string' ? r.data : '';
    const p = JSON.parse(text); if (!p || p.format !== 'itqan') return false;
    localStorage.setItem(schluessel, text); return true;
  } catch (e) { return false; }
}

// pro Gerät, nicht im Profil: die Erlaubnis gehört zum Gerät
// Kennungen: 1 = täglich (alle sieben Tage sind Wird-Tage), 11 bis 17 = je Wochentag, 21 bis 34 = einzelne Tage nach einer Pause
const SCHLUESSEL = 'itqan-mitteilung', ID = 1, ID_TAG = 10, ID_DANACH = 20, DANACH_MAX = 14;
const ALLE_IDS = [ID, ...Array.from({ length: 7 }, (_, i) => ID_TAG + 1 + i), ...Array.from({ length: DANACH_MAX }, (_, i) => ID_DANACH + 1 + i)];
export const mitteilungAn = () => { try { return localStorage.getItem(SCHLUESSEL) === '1'; } catch (e) { return false; } };
const merken = an => { try { localStorage.setItem(SCHLUESSEL, an ? '1' : '0'); } catch (e) {} };

// Plant die Mitteilungen neu (oder entfernt sie, wenn ausgeschaltet).
// inhalt = { zeit: 'HH:MM', titel, text, tage?: sieben Wahrheitswerte ab Montag (Wird-Tag oder Ruhetag), pause?: true, danach?: ['JJJJ-MM-TT', …] }
// Ruhetage bekommen keine Mitteilung. In einer Pause ruht alles; danach stehen die ersten Wird-Tage einzeln im Plan,
// bis die App wieder geöffnet wird (jeder Start plant neu).
export async function mitteilungPlanen(inhalt) {
  if (!LN) return false;
  try { await LN.cancel({ notifications: ALLE_IDS.map(id => ({ id })) }); } catch (e) {}
  if (!mitteilungAn()) return true;
  const [hour, minute] = String(inhalt?.zeit || '05:30').split(':').map(Number);
  // Auf Android ungefähr statt auf die Minute: kein SCHEDULE_EXACT_ALARM nötig (das Fenster beträgt bis zu einer Stunde), iOS ignoriert das Feld
  const kopf = { title: inhalt.titel, body: inhalt.text, isExactNotification: false };
  const tage = Array.isArray(inhalt.tage) && inhalt.tage.length === 7 ? inhalt.tage.map(Boolean) : Array(7).fill(true);
  let liste;
  if (inhalt.pause) {
    liste = (inhalt.danach || []).slice(0, DANACH_MAX).map((d, i) => { const [y, m, t] = String(d).split('-').map(Number); return { id: ID_DANACH + 1 + i, ...kopf, schedule: { at: new Date(y, m - 1, t, hour, minute), allowWhileIdle: true } }; })
      .filter(n => n.schedule.at.getTime() > Date.now());
  } else if (tage.every(Boolean)) liste = [{ id: ID, ...kopf, schedule: { on: { hour, minute }, allowWhileIdle: true } }];
  // Wochentag der Mitteilung: 1 = Sonntag bis 7 = Samstag; tage beginnt bei Montag
  else liste = tage.map((an, i) => an ? { id: ID_TAG + 1 + i, ...kopf, schedule: { on: { weekday: i === 6 ? 1 : i + 2, hour, minute }, allowWhileIdle: true } } : null).filter(Boolean);
  if (!liste.length) return true;
  try { await LN.schedule({ notifications: liste }); return true; } catch (e) { return false; }
}

// Wurde die Erlaubnis in den Einstellungen des Geräts entzogen, während der Schalter in der App noch an ist?
// Dann geht der Schalter aus und die Planung entfällt. Liefert true, wenn das gerade geschehen ist (die Oberfläche sagt es dann).
export async function mitteilungPruefen() {
  if (!LN || !mitteilungAn()) return false;
  try {
    const r = await LN.checkPermissions();
    if (r.display !== 'denied') return false;
  } catch (e) { return false; }
  merken(false);
  try { await LN.cancel({ notifications: ALLE_IDS.map(id => ({ id })) }); } catch (e) {}
  return true;
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
  merken(an);
  return mitteilungPlanen(inhalt);
}

// ---------- Kalenderdatei (Browser): wiederkehrender Termin mit Erinnerung ----------
// Feste Kennung (uid) und steigende Folgenummer (folge): Wer den Termin nach einer Änderung erneut einträgt, bekommt in den meisten
// Kalendern den alten ersetzt statt eines zweiten. tage: sieben Wahrheitswerte ab Montag; aus: einzelne Tage ohne Termin (Pause).
// Uhrzeit ohne Zeitzone: Der Termin wandert mit der Ortszeit des Geräts (für eine Erinnerung am Gebetsanker ist das richtig).
const icsText = t => String(t ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
// Zeilen höchstens 75 Oktette (RFC 5545), Fortsetzung mit einem Leerzeichen; ein Zeichen wird nie zerteilt
function icsFalten(zeile) {
  const enc = new TextEncoder(), teile = []; let jetzt = '', n = 0;
  for (const z of zeile) {
    const b = enc.encode(z).length, grenze = teile.length ? 74 : 75;
    if (n + b > grenze) { teile.push(jetzt); jetzt = ''; n = 0; }
    jetzt += z; n += b;
  }
  teile.push(jetzt);
  return teile.join('\r\n ');
}
export function kalenderDatei({ zeit = '05:30', titel, text, adresse = '', uid, folge = 0, tage, start, aus = [], stempel = new Date() }) {
  const [h, m] = String(zeit).split(':'), hm = `${String(h).padStart(2, '0')}${String(m || '0').padStart(2, '0')}00`;
  const an = Array.isArray(tage) && tage.length === 7 && tage.some(Boolean) ? tage.map(Boolean) : Array(7).fill(true);
  // erster Termin: der erste Wird-Tag ab dem Starttag (ein Starttag außerhalb der Regel ergäbe in manchen Kalendern einen Zusatztermin)
  const [y, mo, t] = String(start).split('-').map(Number), d0 = new Date(y, mo - 1, t);
  for (let i = 0; i < 7 && !an[(d0.getDay() + 6) % 7]; i++) d0.setDate(d0.getDate() + 1);
  const tag = d => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const KUERZEL = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  const regel = an.every(Boolean) ? 'RRULE:FREQ=DAILY' : `RRULE:FREQ=WEEKLY;BYDAY=${KUERZEL.filter((_, i) => an[i]).join(',')}`;
  const frei = [...new Set(aus)].filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().slice(0, 60).map(d => `${d.replace(/-/g, '')}T${hm}`);
  const zeilen = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Itqan//Wird//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${icsText(uid)}`, `SEQUENCE:${Math.max(0, Math.floor(folge) || 0)}`, `DTSTAMP:${stempel.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`,
    `DTSTART:${tag(d0)}T${hm}`, 'DURATION:PT20M', regel, ...(frei.length ? [`EXDATE:${frei.join(',')}`] : []),
    `SUMMARY:${icsText(titel)}`, `DESCRIPTION:${icsText(text)}${adresse ? icsText('. ' + adresse) : ''}`,
    'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(text)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
  return zeilen.map(icsFalten).join('\r\n') + '\r\n';
}

if (NATIV) {
  document.documentElement.classList.add('nativ');
  // Statusleiste: helle Schrift im Dunkelmodus, dunkle im Hellmodus (folgt data-modus, das die App setzt)
  const leiste = () => { if (SB) SB.setStyle({ style: document.documentElement.dataset.modus === 'dunkel' ? 'DARK' : 'LIGHT' }).catch(() => {}); };
  leiste();
  new MutationObserver(leiste).observe(document.documentElement, { attributes: true, attributeFilter: ['data-modus'] });
}
