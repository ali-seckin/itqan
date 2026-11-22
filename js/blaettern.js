// Itqān · Blättern im Muṣḥaf: eine Pipeline für alle Ansichten (Muṣḥaf-Ansicht und Vollbild, Einzel- und Doppelseite, Handy und PC).
//
// Aufbau:
//  1. Reine Logik ohne DOM (testbar): Entscheidung Einzel-/Doppelseite, Paarbildung, Nachbarn, Zustandsautomat des Blätterns.
//  2. Stapel: hält drei Blätter im DOM (vorige, aktuelle, nächste Einheit), alle fertig gerendert, Schriften geladen. Geblättert wird nur mit
//     transform und opacity auf dem Compositor (Web Animations API, translate3d). Am Ende wird das schon sichtbare Nachbarblatt zur aktuellen Seite
//     befördert (Rollen tauschen, kein Neurendern, kein Pop). Erst danach wird im Leerlauf das nächste Nachbarblatt vorbereitet.
//     Schnelles zweites Blättern beschleunigt die laufende Bewegung (playbackRate) und reiht sich an, Gegenrichtung kehrt sie um (reverse):
//     Die Bewegung bleibt stetig, es gibt keinen Sprung.

export const SEITEN = 604;
export const DAUER = 320;                         // ms, ein Blatt
export const KURVE = 'cubic-bezier(.22,.7,.2,1)'; // ease-out, passend zum Buch
export const ABSTAND = 120;                       // ms Ruhe nach der Landung, bevor das nächste Nachbarblatt vorbereitet wird
export const MAX_WARTEND = 3;                     // so viele weitere Blätter dürfen sich hinter einer laufenden Bewegung anreihen

// ---------- 1. Reine Logik ----------
const klemme = p => Math.min(SEITEN, Math.max(1, Math.round(+p) || 1));
// Doppelseite wie im Madanī-Muṣḥaf: ungerade Seite rechts, gerade links
export const paarVon = p => (p % 2 ? [p, p + 1] : [p - 1, p]).filter(x => x >= 1 && x <= SEITEN);
// Die Einheit, die auf einmal zu sehen ist: ein Paar oder eine einzelne Seite
export const einheitVon = (p, dop) => { p = klemme(p); return dop ? paarVon(p) : [p]; };
// Nachbareinheit: richtung +1 weiter im Buch (höhere Seitenzahlen), -1 zurück; null am Rand des Buches
export function nachbar(einheit, richtung, dop) {
  const e = richtung > 0 ? einheit[einheit.length - 1] + 1 : einheit[0] - 1;
  return e < 1 || e > SEITEN ? null : einheitVon(e, dop);
}
export const gleich = (a, b) => !!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]);

// Doppelseite auf Tablet und PC (kürzere Bildschirmseite mindestens 600 und Fensterbreite mindestens 700) und am Handy im Querformat (Breite mindestens 600).
// vorher: die bisherige Entscheidung. Wer schon Doppelseite zeigt, behält sie, bis das Fenster um 24 px unter die Schwelle fällt
// (kein Hin und Her, wenn die Fensterbreite genau auf der Schwelle schwankt).
export function doppelEntscheid({ breite, hoehe, schirmKurz }, vorher = null) {
  const b = breite + (vorher === true ? 24 : 0);
  return (schirmKurz >= 600 && b >= 700) || (b > hoehe && b >= 600);
}

// Zustandsautomat: ruhe -> wartet (Nachbarblatt noch nicht bereit) -> laeuft (Bewegung) -> ruhe. Umkehren: laeuft -> zurueck -> ruhe.
// Er kennt nur Einheiten und Richtungen; das DOM führt seine Aktionen aus.
export function neuerAutomat(seite, dop) {
  let doppelt = !!dop, jetzt = einheitVon(seite, doppelt), phase = 'ruhe', lauf = null, wartend = 0, ende = null, danach = 0, zaehler = 0;
  const neuerLauf = r => {
    const ziel = nachbar(jetzt, r, doppelt); if (!ziel) return null;
    lauf = { id: ++zaehler, richtung: r, ziel }; phase = 'wartet'; wartend = 0; ende = ziel; danach = 0; return lauf;
  };
  const leer = () => { lauf = null; phase = 'ruhe'; wartend = 0; ende = null; danach = 0; };
  const A = {
    get jetzt() { return jetzt; }, get phase() { return phase; }, get lauf() { return lauf; }, get wartend() { return wartend; }, get doppel() { return doppelt; },
    // Anfrage zu blättern. Rückgabe: Liste von Aktionen für das DOM
    anfrage(r) {
      r = r > 0 ? 1 : -1;
      if (phase === 'ruhe') { const l = neuerLauf(r); return l ? [{ art: 'start', lauf: l }] : [{ art: 'rand' }]; }
      if (phase === 'zurueck') { danach = r; return [{ art: 'vormerken' }]; }   // erst die Umkehr zu Ende, dann in die neue Richtung
      if (r !== lauf.richtung) {                  // Gegenrichtung
        if (phase === 'wartet') { leer(); return [{ art: 'verwerfen' }]; }
        phase = 'zurueck'; wartend = 0; ende = null; danach = 0; return [{ art: 'umkehren' }];
      }
      // gleiche Richtung: anreihen, solange danach noch ein Blatt kommt
      const weiter = nachbar(ende, r, doppelt);
      if (!weiter || wartend >= MAX_WARTEND) return [{ art: 'rand' }];
      wartend++; ende = weiter;
      return [{ art: 'beschleunigen', rate: 1 + 1.6 * wartend }];
    },
    // Das Nachbarblatt ist da, die Bewegung beginnt
    bereit(id) { if (!lauf || lauf.id !== id || phase !== 'wartet') return false; phase = 'laeuft'; return true; },
    // Die Bewegung ist zu Ende (rueckwaerts: sie lief zum Ausgangspunkt zurück). Rückgabe: wohin befördert wurde und was als Nächstes beginnt
    fertig(id, rueckwaerts = false) {
      if (!lauf || lauf.id !== id) return { befoerdert: null, weiter: null };
      if (rueckwaerts) { const d = danach; leer(); return { befoerdert: null, weiter: d ? A.anfrage(d).find(a => a.art === 'start')?.lauf || null : null }; }
      const r = lauf.richtung, links = wartend; jetzt = lauf.ziel;
      lauf = null; phase = 'ruhe'; ende = null; wartend = 0;
      let weiter = null;
      if (links > 0) { weiter = neuerLauf(r); if (weiter) wartend = links - 1; }
      return { befoerdert: jetzt, weiter };
    },
    verwerfen() { leer(); },
    // Angereihte Blätter fallen weg (Zoom, Sprung): die laufende Bewegung endet noch, danach folgt nichts mehr
    stopp() { wartend = 0; danach = 0; if (lauf) ende = lauf.ziel; },
    // Sprung (Gehe zu, Seitenregler) oder Wechsel zwischen Einzel- und Doppelseite: alles zurücksetzen
    springen(s, dop2 = doppelt) { doppelt = !!dop2; jetzt = einheitVon(s, doppelt); leer(); },
  };
  return A;
}

// ---------- 2. Stapel (DOM) ----------
const leerlauf = (f, zeit = 600) => typeof requestIdleCallback === 'function' ? requestIdleCallback(f, { timeout: zeit }) : setTimeout(f, 0);
const leerlaufAus = h => { if (h == null) return; if (typeof cancelIdleCallback === 'function') cancelIdleCallback(h); };   // (ohne cancelIdleCallback lief der Ersatz über setTimeout, siehe leerlauf)
const nbName = r => r > 0 ? 'nach' : 'vor';

// o: { feld, id, seite, doppel, aktuell, bauen(einheit) -> Promise<Element>, einsetzen(el, einheit), breite(), ruhig(), beiStart(el), beiBefoerdert(einheit, el, richtung) }
//   feld: Elternknoten der Blätter. aktuell: das schon im DOM stehende aktuelle Blatt. bauen: fertig gerendertes Blatt mit geladenen Schriften, nicht eingesetzt.
//   einsetzen: nach dem Einfügen ins DOM (Zeilen einpassen, Grenzen zeichnen, Textfassung). id: wird dem aktuellen Blatt gegeben (id="seite").
export class Stapel {
  constructor(o) {
    this.o = o; this.tot = false; this.epoche = 0; this.idleT = null; this.idleI = null; this.timer = null;
    this.a = neuerAutomat(o.seite, o.doppel);
    this.platz = { jetzt: o.aktuell, vor: null, nach: null };
    this.bau = { vor: null, nach: null };
    this.anim = null; this.rueck = false; this.zug = null; this.feder = null;
    this.rolle(o.aktuell, 'jetzt');
    this.vorbereiten();
  }
  get jetzt() { return this.platz.jetzt; }
  get einheit() { return this.a.jetzt; }
  get doppel() { return this.a.doppel; }
  get laeuft() { return this.a.phase !== 'ruhe'; }
  rolle(el, r) {
    el.classList.toggle('blatt-jetzt', r === 'jetzt'); el.classList.toggle('blatt-nb', r !== 'jetzt');
    if (r === 'jetzt') { el.removeAttribute('aria-hidden'); if (this.o.id) el.id = this.o.id; }
    else { el.setAttribute('aria-hidden', 'true'); if (this.o.id && el.id === this.o.id) el.removeAttribute('id'); }
  }
  // ----- Nachbarn vorbereiten (im Leerlauf, nie während einer Bewegung) -----
  vorbereiten(zuerst = 1) {
    if (this.tot || this.idleT != null || this.idleI != null) return;
    // erst ein kurzer Abstand zur Landung (dort liegt schon Arbeit), dann im Leerlauf
    this.idleT = setTimeout(() => { this.idleT = null; this.idleI = leerlauf(async () => {
      this.idleI = null;
      if (this.tot || this.a.phase !== 'ruhe' || this.zug) return;   // nach der Bewegung wird neu angestoßen
      const r = [zuerst, -zuerst].find(x => !this.platz[nbName(x)] && nachbar(this.a.jetzt, x, this.a.doppel));
      if (r == null) return;
      const el = await this.bereit(r); if (!el) return;   // ließ sich nicht bauen: nicht endlos neu versuchen, das Blättern baut es dann selbst
      this.vorbereiten(zuerst);   // das andere Nachbarblatt in einem eigenen Leerlauf, damit keine lange Aufgabe entsteht
    }); }, ABSTAND);
  }
  idleAus() { if (this.idleT != null) clearTimeout(this.idleT); if (this.idleI != null) leerlaufAus(this.idleI); this.idleT = this.idleI = null; }
  bereit(r) {
    const n = nbName(r);
    if (this.platz[n]) return Promise.resolve(this.platz[n]);
    if (this.bau[n]) return this.bau[n];
    const z = nachbar(this.a.jetzt, r, this.a.doppel); if (!z) return Promise.resolve(null);
    const ep = this.epoche;
    const p = (async () => {
      let el = null;
      try { el = await this.o.bauen(z); } catch (e) { el = null; }
      // inzwischen woanders: das gebaute Blatt wird verworfen
      if (!el || this.tot || ep !== this.epoche || !gleich(nachbar(this.a.jetzt, r, this.a.doppel), z)) return null;
      this.rolle(el, 'nb'); el.dataset.nb = n; this.o.feld.appendChild(el);
      this.platz[n] = el; this.o.einsetzen?.(el, z);
      return el;
    })();
    this.bau[n] = p; p.finally(() => { if (this.bau[n] === p) this.bau[n] = null; });
    return p;
  }
  // ----- Blättern -----
  // r: +1 weiter im Buch, -1 zurück. versatz: Weg des Fingers in px (Wischen), die Bewegung setzt dort an. tempo: Tempo des Fingers beim Loslassen in px/ms,
  // ein schneller Wisch setzt sich in einer kürzeren Bewegung fort. Rückgabe false: am Rand des Buches
  blaettern(r, versatz = 0, tempo = 0) {
    if (this.tot) return false;
    let ok = true;
    for (const x of this.a.anfrage(r)) {
      if (x.art === 'rand') { ok = false; }
      else if (x.art === 'start') this.starten(x.lauf, versatz, tempo);
      else if (x.art === 'beschleunigen') this.anim?.forEach(a => { try { a.updatePlaybackRate(x.rate); } catch (e) { /* ältere Browser */ } });
      else if (x.art === 'umkehren') this.umkehren();
    }
    return ok;
  }
  async starten(lauf, versatz = 0, tempo = 0) {
    const ep = this.epoche, r = lauf.richtung;
    this.federAus();
    const el = await this.bereit(r);
    if (this.tot || ep !== this.epoche || this.a.lauf?.id !== lauf.id) return;   // inzwischen verworfen
    if (!el) { this.a.verwerfen(); this.zugAufraeumen(); this.springen(lauf.ziel[0]); return; }      // Blatt ließ sich nicht bauen: ohne Bewegung dorthin
    this.a.bereit(lauf.id);
    const cur = this.platz.jetzt;
    this.o.beiStart?.(cur, lauf.ziel);
    if (this.o.ruhig()) { this.zugAufraeumen(); this.befoerdern(); return; }
    const W = this.o.breite(), rest = Math.max(0, W * r - versatz) * r;   // Weg, den das aktuelle Blatt noch hat
    const dauer = tempo > 0.4 ? Math.round(Math.min(DAUER, Math.max(180, rest / tempo))) : DAUER;   // Fingertempo setzt sich fort
    const opt = { duration: dauer, easing: KURVE, fill: 'both' };
    for (const e of [cur, el]) e.style.willChange = 'transform';
    el.classList.add('blatt-gleitet');
    const rate = 1 + 1.6 * this.a.wartend;
    const a1 = cur.animate([{ transform: `translate3d(${versatz}px,0,0)` }, { transform: `translate3d(${r * W}px,0,0)` }], opt);
    const a2 = el.animate([{ transform: `translate3d(${-r * W + versatz}px,0,0)` }, { transform: 'translate3d(0,0,0)' }], opt);
    if (rate !== 1) { a1.playbackRate = rate; a2.playbackRate = rate; }
    this.anim = [a1, a2]; this.rueck = false; this.zug = null;
    a1.onfinish = () => this.animFertig(lauf.id);
    clearTimeout(this.timer); this.timer = setTimeout(() => this.animFertig(lauf.id), dauer + 500);   // falls ein verdecktes Fenster keine Bilder zeichnet
  }
  animFertig(id) {
    if (!this.anim || this.a.lauf?.id !== id) return;
    if (this.rueck) this.abbruchEnde(); else this.befoerdern();
  }
  umkehren() {
    if (!this.anim) { this.a.verwerfen(); return; }
    this.rueck = true; this.anim.forEach(a => a.reverse());
  }
  // Am Ende: das sichtbare Nachbarblatt wird zur aktuellen Seite (Rollen tauschen). Endzustand setzen und Animationen im selben Bild löschen:
  // Der Zoom (Inline-Transform) bleibt sichtbar, weil keine Animation ihre Endstellung behält.
  befoerdern() {
    const lauf = this.a.lauf; if (!lauf) return;
    const r = lauf.richtung, n = nbName(r), g = nbName(-r);
    const alt = this.platz.jetzt, neu = this.platz[n], weg = this.platz[g];
    clearTimeout(this.timer); const an = this.anim; this.anim = null; this.rueck = false;
    this.rolle(neu, 'jetzt'); this.rolle(alt, 'nb'); delete neu.dataset.nb; alt.dataset.nb = g;
    for (const e of [alt, neu]) { e.style.transform = ''; e.style.willChange = ''; e.classList.remove('blatt-gleitet'); }
    an?.forEach(a => a.cancel());
    weg?.remove();   // zwei Blätter zurück: nicht mehr gebraucht
    this.platz = { jetzt: neu, vor: g === 'vor' ? alt : null, nach: g === 'nach' ? alt : null };
    this.bau = { vor: null, nach: null };   // laufende Bauaufträge gehören zur alten Lage
    const f = this.a.fertig(lauf.id);
    this.o.beiBefoerdert?.(this.a.jetzt, neu, r);
    if (f.weiter) this.starten(f.weiter, 0); else this.vorbereiten(r);
  }
  abbruchEnde() {   // die umgekehrte Bewegung ist am Ausgangspunkt angekommen: alles bleibt, wie es war
    const lauf = this.a.lauf; if (!lauf) return;
    const el = this.platz[nbName(lauf.richtung)], cur = this.platz.jetzt;
    clearTimeout(this.timer); const an = this.anim; this.anim = null; this.rueck = false;
    for (const e of [cur, el]) if (e) { e.style.transform = ''; e.style.willChange = ''; e.classList.remove('blatt-gleitet'); }
    an?.forEach(a => a.cancel());
    const f = this.a.fertig(lauf.id, true);
    if (f.weiter) this.starten(f.weiter, 0); else this.vorbereiten();
  }
  // sofort: eine laufende Bewegung ist augenblicklich am Ziel (vor dem Zoomen)
  sofort() {
    this.a.stopp();
    if (this.anim) { if (this.rueck) this.abbruchEnde(); else this.befoerdern(); }
    else if (this.a.phase === 'wartet') this.a.verwerfen();
    this.zugAufraeumen();
  }
  // ----- Wischen: Das aktuelle Blatt und das Nachbarblatt folgen dem Finger -----
  ziehen(dx) {
    if (this.tot || this.a.phase !== 'ruhe' || !dx) return;
    this.federAus();
    const r = dx > 0 ? 1 : -1, W = this.o.breite(), cur = this.platz.jetzt;
    const el = this.platz[nbName(r)], rand = !nachbar(this.a.jetzt, r, this.a.doppel);
    if (!this.zug) { this.zug = { r: 0, el: null, dx: 0 }; cur.style.willChange = 'transform'; this.bereit(r); }
    const z = this.zug;
    if (z.r !== r) {   // Richtung gewechselt: das andere Nachbarblatt weg
      if (z.el) { z.el.style.transform = ''; z.el.style.willChange = ''; z.el.classList.remove('blatt-gleitet'); }
      z.r = r; z.el = null; if (!rand) this.bereit(r);
    }
    if (el && !rand && z.el !== el) { z.el = el; el.style.willChange = 'transform'; el.classList.add('blatt-gleitet'); }
    const x = rand ? dx * 0.3 : dx;   // am Rand des Buches: Gummiband
    cur.style.transform = `translate3d(${x}px,0,0)`;
    if (z.el) z.el.style.transform = `translate3d(${x - r * W}px,0,0)`;
    z.dx = x;
  }
  // blaettern: true = zur Einheit in Richtung r (+1 weiter, -1 zurück), false = zurückfedern. r: Richtung des Fingers; ohne Angabe die des Zuges
  loslassen(blaettern, r = 0, tempo = 0) {
    const z = this.zug; this.zug = null;
    r = r || z?.r || 0;
    if (blaettern && r && nachbar(this.a.jetzt, r, this.a.doppel)) {
      if (z && z.r !== r) { this.zugAufraeumenFuer(z); return this.blaettern(r, 0); }   // Finger kehrte zuletzt um: ohne Versatz
      return this.blaettern(r, z?.dx || 0, tempo);
    }
    if (z) this.zurueckfedern(z);
    return false;
  }
  zurueckfedern(z) {
    const cur = this.platz.jetzt, W = this.o.breite(), el = z.el, r = z.r;
    if (this.o.ruhig()) { this.zugAufraeumenFuer(z); return; }
    const opt = { duration: 220, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' };
    const an = [cur.animate([{ transform: `translate3d(${z.dx}px,0,0)` }, { transform: 'translate3d(0,0,0)' }], opt)];
    if (el) an.push(el.animate([{ transform: `translate3d(${z.dx - r * W}px,0,0)` }, { transform: `translate3d(${-r * W}px,0,0)` }], opt));
    this.feder = { an, cur, el };
    an[0].onfinish = () => this.federAus();
  }
  federAus() {
    const f = this.feder; if (!f) return; this.feder = null;
    for (const e of [f.cur, f.el]) if (e) { e.style.transform = ''; e.style.willChange = ''; if (e !== f.cur) e.classList.remove('blatt-gleitet'); }
    f.an.forEach(a => a.cancel());
  }
  zugAufraeumenFuer(z) {
    const cur = this.platz.jetzt;
    if (cur) { cur.style.transform = ''; cur.style.willChange = ''; }
    if (z?.el) { z.el.style.transform = ''; z.el.style.willChange = ''; z.el.classList.remove('blatt-gleitet'); }
  }
  zugAufraeumen() { const z = this.zug; this.zug = null; if (z) this.zugAufraeumenFuer(z); this.federAus(); }
  // ----- Sprung, Neuaufbau -----
  // Die Seite wird ohne Bewegung ersetzt (Seitenregler, Gehe zu, Drehen, Größenänderung). dop: optional neue Betriebsart.
  async springen(seite, dop = this.a.doppel) {
    if (this.tot) return;
    const ep = ++this.epoche; this.bau = { vor: null, nach: null };
    this.zugAufraeumen(); this.anim?.forEach(a => a.cancel()); this.anim = null; this.rueck = false; clearTimeout(this.timer);
    this.a.springen(seite, dop);
    const z = this.a.jetzt;
    let el = null; try { el = await this.o.bauen(z); } catch (e) { el = null; }
    if (!el || this.tot || ep !== this.epoche) return;
    const alte = [this.platz.jetzt, this.platz.vor, this.platz.nach].filter(Boolean);
    this.rolle(el, 'jetzt'); this.o.feld.appendChild(el);
    this.platz = { jetzt: el, vor: null, nach: null };
    for (const e of alte) e.remove();
    this.o.einsetzen?.(el, z);
    this.o.beiBefoerdert?.(z, el, 0);
    this.vorbereiten();
  }
  zerstoeren() {
    this.tot = true; this.idleAus(); clearTimeout(this.timer);
    this.anim?.forEach(a => a.cancel()); this.anim = null; this.zugAufraeumen();
  }
}
