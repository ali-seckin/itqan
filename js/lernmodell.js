// Itqān · Einheitliches Lernmodell, reine Funktionen ohne Zustand und ohne Browser (geprüft mit werkzeuge/lernmodell). Alle Zahlen in PAR sind begründete Setzungen,
// Herkunft, Unsicherheit und Empfindlichkeit stehen in konzept/lernmodell_einheitlich/DOSSIER.md.
//
// Kernidee: Jeder Abschnitt hat eine Stabilität S (Tage, nach denen noch 90 % abrufbar sind). Die Abrufwahrscheinlichkeit R sinkt nach einer
// Potenzkurve. Fällig ist ein Abschnitt, wenn R den Zielwert erreicht. Drei Arten von Plätzen teilen sich das Tagespensum:
//   1. Modellplätze: das, was am stärksten verblasst ist (niedrigstes R), samt Kontrolle am Folgetag nach einem deutlichen Fehler
//      (bei jedem Pensum mindestens ein Platz; im Umlauf kommt sie zum Pensum hinzu)
//   2. Zyklusplätze: ein fester Anteil für den am längsten nicht besuchten Abschnitt (Garantie der Tradition: nichts bleibt ungepflegt, Durchlauf)
//   3. Erstprüfungsplätze: Abschnitte des Altbestands, die in der App noch nie geprüft wurden (Anteil nach Rückstau, Untergrenze neuMin)
// Neues Auswendiglernen (Lektionen Ḥifẓ, Ḍabṭ, Itqān) ist davon getrennt und übergibt den Abschnitt nach der Lektion mit sLern und einer Kontrolle am Folgetag.

export const PAR = {
  d: 0.5,            // Exponent der Vergessenskurve (FSRS-4.5/5: 0,5; FSRS-4: 1,0)
  rZiel: 0.90,       // Zielwert der Abrufwahrscheinlichkeit beim Wiedersehen
  G: 26, w: 0.17, k: 0.8,   // Wachstum: S' = S (1 + G S^-w (e^(k (1-R)) - 1) H), Struktur wie FSRS, Niveau auf Faktor 2,3 bei S 20 und R 0,9 gesetzt
  maxWachstum: 5,    // Deckel auf den Faktor je Wiedersehen
  zoegern: 0.6,      // Zuwachsanteil bei Zögern (FSRS-Hard 0,60)
  lapseC: 1.0, lapseP: 0.55,   // Vollständiger Ausfall: S' = max(1, C S^P) (FSRS-6 nach 365 Tagen: 6 Tage; hier 26, weil Abschnitte meist Teilausfälle haben)
  psi0: 0.5, psi1: 1.0,        // Anteil des Ausfalls: psi = min(1, psi0 + psi1 · Fehleranteil)
  kontrolleAb: 0.25, // Fehleranteil, ab dem der Abschnitt am Folgetag kontrolliert wird (0 = nie); Rest regelt S
  kontrolleAnteil: 0.25, // so viele Plätze (Anteil des Pensums, abgerundet, mindestens einer) gehen vorrangig an Kontrollen am Folgetag, die älteste zuerst
  kontrolleZusatz: true, // im Umlauf kommen diese Plätze zum Pensum hinzu: innerhalb des Pensums kosten sie dort den Durchlauf (Simulation Basis 11000, Pensum 1 und 2: 2,3 und 1,7 Punkte)
  sMin: 1, sMax: 3650,
  sLern: 0.6,        // Anfangsstabilität nach abgeschlossener Lektion: erstes Wiedersehen am Folgetag
  sErstSauber: 25, sErstZoegern: 12, sErstFehler: 3,   // erste Prüfung eines schon gelernten Abschnitts: Start aus dem Ergebnis
  neuMin: 0.5, neuMax: 0.9, druckStart: 1, druckEnde: 5,  // Anteil der Erstprüfung nach Rückstau (Rückstau = Fälliges / Pensum)
  zAnteil: 0.25,     // Anteil der Plätze für den am längsten nicht besuchten Abschnitt
  umlaufAb: 365,     // reicht das Pensum nicht für einen Durchlauf in so vielen Tagen (Abschnitte / Pensum größer), läuft der Plan als Umlauf: erst alles Ungeprüfte, dann der älteste zuerst.
                     // Fälliges bekommt im Umlauf keinen eigenen Platz (ein Platz für das niedrigste R kostet dort beide Endpunkte), es kommt spätestens nach einem Umlauf wieder
  kMax: 1.5,         // Obergrenze der Guthaben für Bruchteile von Plätzen
  lernRueckstau: 1.0, lernOffenMax: 3,   // Ḥifẓ-Tempo: neue Lektion nur, wenn höchstens ein Tag Fälliges wartet und höchstens drei Lektionen laufen
};

export const faktor = d => Math.pow(0.9, -1 / d) - 1;
export const abruf = (t, S, d = PAR.d) => S > 0 ? Math.pow(1 + faktor(d) * Math.max(0, t) / S, -d) : 0;
export const intervall = (S, r = PAR.rZiel, d = PAR.d) => S / faktor(d) * (Math.pow(r, -1 / d) - 1);

// Ergebnis eines Durchgangs: v Verse, f Fehler (inklusive Hilfe), z Gezögert. k: bisheriger Zustand (oder null)
export function nachUebung(k, tag, { v, f, z }, par = PAR) {
  const n = k?.n || 0, neu = { ...(k || {}), n: n + 1, zul: tag };
  const anteilF = f / Math.max(1, v), lapse = f > 0 && par.kontrolleAb > 0 && anteilF >= par.kontrolleAb;
  neu.kon = lapse ? tag + 1 : null;
  if (!n) {
    neu.S = f ? Math.max(par.sMin, par.sErstFehler * (1 - Math.min(1, anteilF))) : z ? par.sErstZoegern : par.sErstSauber;
    neu.lap = f ? 1 : 0; if (f) neu.lt = tag;
    return neu;
  }
  const S0 = k.S > 0 ? k.S : par.sMin, boden = Math.min(par.sMin, S0);   // nach einer Lektion liegt S unter sMin: ein Ausfall darf es nicht anheben
  if (k.zul === tag) {                       // zweite Wertung am selben Tag: kein Zuwachs, ein Ausfall zählt nur einmal je Tag
    neu.n = n; if (!f || k.lt === tag) { neu.kon = k.kon ?? null; return neu; }
  }
  const R = abruf(tag - k.zul, S0, par.d);
  if (f) {
    const voll = Math.max(par.sMin, par.lapseC * Math.pow(S0, par.lapseP));
    const psi = Math.min(1, par.psi0 + par.psi1 * anteilF);
    neu.S = Math.max(boden, Math.min(S0, S0 * Math.pow(voll / S0, psi)));
    neu.lap = (k.lap || 0) + 1; neu.lt = tag;
  } else {
    const H = z ? par.zoegern : 1;
    const wachs = Math.min(par.maxWachstum - 1, par.G * Math.pow(S0, -par.w) * (Math.exp(par.k * (1 - R)) - 1) * H);
    neu.S = Math.min(par.sMax, S0 * (1 + Math.max(0.0, wachs)));
  }
  return neu;
}

// Nach einer Lektion: der Abschnitt tritt mit kleiner Stabilität in den Wiederholungskreis, das erste Wiedersehen ist als Kontrolle am Folgetag gesichert
export const nachLektion = (tag, par = PAR) => ({ S: par.sLern, zul: tag, n: 1, lap: 0, kon: tag + 1 });


// Tagesplan. karten: Objekt oder Map id -> {S, zul, n, kon}; reihe: alle Abschnitts-IDs in der Reihenfolge des Nutzers;
// kn: Guthaben Erstprüfung, kz: Guthaben Zyklus. nRegime: übliches Pensum je Tag für die Wahl des Regimes (ohne Angabe gilt n): ein halbes Pensum
// im Wiedereinstieg oder ein einzelner Zusatzabschnitt wechselt so nicht das Regime. zusatz: false hält den Plan auch im Umlauf bei n.
// Rückgabe: { plan: [{id, art}], kn, kz, faellig, zyklusTage }; art: kontrolle, faellig, erst, zyklus, vorgezogen
export function planen({ karten, reihe, tag, n, kn = 0, kz = 0, nRegime, zusatz = true, par = PAR }) {
  const get = id => karten instanceof Map ? karten.get(id) : karten[id];
  const gepr = [], neu = [];
  for (const id of reihe) { const k = get(id); (k && k.n ? gepr : neu).push(id); }
  const faellig = [], rest = [];
  for (const id of gepr) {
    const k = get(id), alter = tag - k.zul;
    if (k.kon != null && k.kon <= tag) { faellig.push([id, -1e9 + k.kon, 'kontrolle', true]); continue; }   // die älteste Kontrolle zuerst
    const R = abruf(alter, k.S, par.d), due = R <= par.rZiel + 1e-9;
    (due ? faellig : rest).push([id, R, 'faellig', due]);
  }
  faellig.sort((a, b) => a[1] - b[1]); rest.sort((a, b) => a[1] - b[1]);
  const umlauf = par.umlaufAb > 0 && reihe.length / (nRegime > 0 ? nRegime : Math.max(1, n)) > par.umlaufAb, zA = umlauf ? 1 : par.zAnteil, nMin = umlauf ? 1 : par.neuMin, nMax = umlauf ? 1 : par.neuMax;
  const p = faellig.filter(x => x[2] === 'kontrolle' || x[3]).length / Math.max(1, n);
  const q = p <= par.druckStart ? nMax : p >= par.druckEnde ? nMin : nMax - (nMax - nMin) * (p - par.druckStart) / (par.druckEnde - par.druckStart);
  // Kontrollen am Folgetag zuerst: bei jedem Pensum mindestens ein Platz, im Umlauf zusätzlich zum Pensum
  const nKon = par.kontrolleAnteil > 0 && n > 0 ? Math.min(faellig.filter(x => x[2] === 'kontrolle').length, Math.max(1, Math.floor(n * par.kontrolleAnteil + 1e-9)), n) : 0;
  const nPlan = n + (umlauf && zusatz && par.kontrolleZusatz ? nKon : 0), nR = nPlan - nKon;
  const kn0 = kn + n * q, nErst = Math.max(0, Math.min(nR, neu.length, Math.floor(kn0 + 1e-9)));
  const kz0 = kz + n * zA, nZyk = Math.max(0, Math.min(nR - nErst, gepr.length, Math.floor(kz0 + 1e-9)));
  const plan = [], drin = new Set(), dazu = (id, art) => { if (plan.length >= nPlan || drin.has(id)) return false; plan.push({ id, art }); drin.add(id); return true; };
  let erstGenutzt = 0, zykGenutzt = 0;
  for (const [id, , art] of faellig) if (art === 'kontrolle' && plan.length < nKon) dazu(id, art);
  for (const [id, , art] of faellig) { if (plan.length >= nPlan - nErst - nZyk) break; dazu(id, art); }
  for (const id of neu) { if (erstGenutzt >= nErst) break; if (dazu(id, 'erst')) erstGenutzt++; }
  if (nZyk) {
    const aelter = gepr.filter(id => !drin.has(id)).map(id => [id, tag - get(id).zul, abruf(tag - get(id).zul, get(id).S, par.d)]).sort((a, b) => b[1] - a[1] || a[2] - b[2]);   // älteste zuerst, bei Gleichstand das niedrigste R
    for (const [id] of aelter) { if (zykGenutzt >= nZyk) break; if (dazu(id, 'zyklus')) zykGenutzt++; }
  }
  for (const [id, , art] of faellig) dazu(id, art);
  for (const id of neu) if (dazu(id, 'erst')) erstGenutzt++;
  for (const [id] of rest) dazu(id, 'vorgezogen');
  const zyklusTage = gepr.length ? Math.round(gepr.length / Math.max(0.01, n * zA)) : 0;
  return { plan, kn: Math.round(Math.max(0, Math.min(par.kMax, kn0 - erstGenutzt)) * 1000) / 1000, kz: Math.round(Math.max(0, Math.min(par.kMax, kz0 - zykGenutzt)) * 1000) / 1000, faellig: faellig.filter(x => x[2] === 'kontrolle' || x[3]).length, zyklusTage };
}

// Ḥifẓ-Tempo: darf heute eine neue Lektion beginnen? Wiederholung geht vor (Simulation hifz.mjs: ohne Bremse kippt der Plan, mit Bremse wächst der Bestand ohne Rückstau).
// n: Pensum, faellig: Zahl der heute fälligen Abschnitte samt Kontrollen, offen: begonnene Lektionen.
export function lernTempo({ n, faellig, offen }, par = PAR) {
  if (offen >= par.lernOffenMax) return { ok: false, grund: 'offen' };
  if (faellig / Math.max(1, n) > par.lernRueckstau) return { ok: false, grund: 'rueckstau' };
  return { ok: true, grund: 'platz' };
}
