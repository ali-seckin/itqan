import { tx } from './sprache.js';
// Itqān · Versionsnummer und „Was ist neu“. Bei jeder Veröffentlichung: VERSION erhöhen und oben einen Eintrag ergänzen.
export const VERSION = '1.37';

// Adresse für „Rückmeldung senden“. Leer: die Rückmeldung wird über das Teilen-Menü oder als E-Mail ohne Empfänger verschickt.
export const RUECKMELDUNG_AN = '';

// Übergangsfunktionen bis zum Start mit eigenem Server und App-Store. Dann beide Schalter auf false:
// sicherungErinnern = Erinnerung ans Sichern auf der Seite Heute, installieren = Karte, Anleitung und Verweis zum Installieren.
// „Profil sichern“ und „Profil laden“ bleiben in jedem Fall.
export const UEBERGANG = { sicherungErinnern: true, installieren: true };

export const NEUIGKEITEN = [
  { v: '1.37', datum: '2026-11-12', titel: tx('version.langzeit_titel'), punkte: [
    tx('version.langzeit_1')
  ] },
  { v: '1.36', datum: '2026-11-12', titel: tx('version.kurz_titel'), punkte: [
    tx('version.kurz_1')
  ] },
  { v: '1.35', datum: '2026-11-12', titel: tx('version.wiedereinstieg_titel'), punkte: [
    tx('version.wiedereinstieg_1')
  ] },
  { v: '1.34', datum: '2026-11-12', titel: tx('version.gezoegern_titel'), punkte: [
    tx('version.gezoegern_1')
  ] },
  { v: '1.33', datum: '2026-11-11', titel: tx('version.einstordnung_titel'), punkte: [
    tx('version.einstordnung_1')
  ] },
  { v: '1.32', datum: '2026-11-11', titel: tx('version.sprachmitte_titel'), punkte: [
    tx('version.sprachmitte_1')
  ] },
  { v: '1.31', datum: '2026-11-11', titel: tx('version.heuteplan_titel'), punkte: [
    tx('version.heuteplan_1')
  ] },
  { v: '1.30', datum: '2026-11-11', titel: tx('version.sprachwahl_titel'), punkte: [
    tx('version.sprachwahl_1')
  ] },
  { v: '1.29', datum: '2026-11-11', titel: tx('version.abwaehlen_titel'), punkte: [
    tx('version.abwaehlen_1')
  ] },
  { v: '1.28', datum: '2026-11-11', titel: tx('version.auswahl_titel'), punkte: [
    tx('version.auswahl_1')
  ] },
  { v: '1.27', datum: '2026-11-11', titel: tx('version.glossar_titel'), punkte: [
    tx('version.glossar_1')
  ] },
  { v: '1.26', datum: '2026-11-11', titel: tx('version.aya_wahl_titel'), punkte: [
    tx('version.aya_wahl_1')
  ] },
  { v: '1.25', datum: '2026-11-11', titel: tx('version.datenquelle_titel'), punkte: [
    tx('version.datenquelle_1')
  ] },
  { v: '1.24', datum: '2026-11-11', titel: tx('version.rechtslinks_titel'), punkte: [
    tx('version.rechtslinks_1')
  ] },
  { v: '1.23', datum: '2026-11-11', titel: tx('version.doppelseite_titel'), punkte: [
    tx('version.doppelseite_1')
  ] },
  { v: '1.22', datum: '2026-11-11', titel: tx('version.sprachen3_titel'), punkte: [
    tx('version.sprachen3_1'),
    tx('version.sprachen3_2')
  ] },
  { v: '1.21', datum: '2026-11-11', titel: tx('version.sprachwahl2_titel'), punkte: [
    tx('version.sprachwahl2_1'),
    tx('version.sprachwahl2_2')
  ] },
  { v: '1.20', datum: '2026-11-11', titel: tx('version.urdu_titel'), punkte: [
    tx('version.urdu_1')
  ] },
  { v: '1.19', datum: '2026-11-11', titel: tx('version.reihenfolge_titel'), punkte: [
    tx('version.sprachwahl_1'),
    tx('version.reihenfolge_1')
  ] },
  { v: '1.18', datum: '2026-11-11', titel: tx('version.sprachen_titel'), punkte: [
    tx('version.sprachen_1'),
    tx('version.sprachen_2'),
    tx('version.sprachen_3')
  ] },
  { v: '1.17', datum: '2026-11-11', titel: tx('version.hilfe_titel'), punkte: [
    tx('version.hilfe_1'),
    tx('version.hilfe_2'),
    tx('version.hilfe_3')
  ] },
  { v: '1.16', datum: '2026-11-11', titel: tx('version.huelle_titel'), punkte: [
    tx('version.huelle_1'),
    tx('version.huelle_2'),
    tx('version.huelle_3')
  ] },
  { v: '1.15', datum: '2026-11-11', titel: tx('version.ganze_seiten_titel'), punkte: [
    tx('version.ganze_seiten_1'),
    tx('version.ganze_seiten_2'),
    tx('version.ganze_seiten_3')
  ] },
  { v: '1.14', datum: '2026-11-10', titel: tx('lernen.neu_titel'), punkte: [
    tx('lernen.neu_1'),
    tx('lernen.neu_2'),
    tx('lernen.neu_3')
  ] },
  { v: '1.13', datum: '2026-11-10', titel: tx('version.vorlesen_und_markieren_ohne_tippen'), punkte: [
    tx('version.jede_mushaf_seite_gibt_es_jetzt_auch_als'),
    tx('version.das_fehlerwort_laesst_sich_ohne_tippen'),
    tx('version.doppelseite_bei_seitengroesse_125_oder')
  ] },
  { v: '1.12', datum: '2026-11-10', titel: tx('version.fundament_fuer_mehrere_geraete'), punkte: [
    tx('version.unter_der_oberflaeche_fuehrt_itqan_jetzt'),
    tx('version.eine_sicherung_merkt_sich_ihren'),
    tx('version.neu_in_den_einstellungen_quellen_dort'),
    tx('version.bei_den_aehnlichen_stellen_steht_jetzt')
  ] },
  { v: '1.11', datum: '2026-11-10', titel: tx('version.ohne_netz_und_beim_tippen'), punkte: [
    tx('version.ohne_netz_bleibt_der_text_lesbar_fehlt'),
    tx('version.die_seiten_deines_heutigen_wird'),
    tx('version.beim_tippen_in_ein_suchfeld_oder'),
    tx('version.der_tag_beginnt_jetzt_um_3_uhr_ein_wird')
  ] },
  { v: '1.10', datum: '2026-11-10', titel: tx('version.lesbarkeit_und_hilfe'), punkte: [
    tx('version.seitengroesse_100_125_oder_150_die'),
    tx('version.zoomen_mit_zwei_fingern_ist_ueberall'),
    tx('version.besser_lesbar_in_hell_und_dunkel_alle'),
    tx('version.fuer_bildschirmleser_und_tastatur_jeder'),
    tx('version.neu_unter_profil_hilfe_und_glossar_mit')
  ] },
  { v: '1.9', datum: '2026-11-10', titel: tx('version.rueckblick_als_bild'), punkte: [
    tx('version.neu_unter_profil_der_rueckblick_eine'),
    tx('version.teilen_auf_iphone_und_android_direkt_aus'),
    tx('version.jeder_tag_hat_sein_zeichen_erfuellt'),
    tx('version.das_bild_entsteht_auf_deinem_geraet_und')
  ] },
  { v: '1.8', datum: '2026-11-10', titel: tx('version.mutasabihat_nachschlagen'), punkte: [
    tx('version.aehnliche_stellen_unter_profil_sind'),
    tx('version.suche_nach_stelle_2_48_sura_oder'),
    tx('version.unter_jeder_stelle_steht_wie_die'),
    tx('version.neuer_bereich_reihenfolge_81_faelle_in'),
    tx('version.von_den_fehlerstellen_fuehrt_ein_verweis')
  ] },
  { v: '1.7', datum: '2026-11-09', titel: tx('version.suche_und_aehnliche_stellen'), punkte: [
    tx('version.suche_im_ganzen_quran_ohne_vokale_auch'),
    tx('version.aehnliche_stellen_mutasabihat_unter'),
    tx('version.neuer_modus_unterscheiden_nur_die')
  ] },
  { v: '1.6', datum: '2026-11-09', titel: tx('version.klug_planen'), punkte: [
    tx('version.schwache_abschnitte_waehle_in_den'),
    tx('version.ruhetage_pro_wochentag_und_eine_pause'),
    tx('version.neue_auswertung_im_profil_fehlerarten')
  ] },
  { v: '1.5', datum: '2026-11-09', titel: tx('version.feinschliff_der_ueberschriften'), punkte: [
    tx('version.ain_und_hamza_in_der_umschrift'),
    tx('version.grosse_ueberschriften_etwas_enger')
  ] },
  { v: '1.4', datum: '2026-11-09', titel: tx('version.klarere_schrift'), punkte: [
    tx('version.echte_fette_schnitte_statt_kuenstlich'),
    tx('version.sieben_feste_schriftgroessen_statt_31'),
    tx('version.kleinste_beschriftungen_groesser_und')
  ] },
  { v: '1.3', datum: '2026-11-09', titel: tx('version.neues_zeichen'), punkte: [
    tx('version.itqan_hat_ein_neues_schlichtes_zeichen'),
    tx('version.es_ersetzt_die_laterne_auf_dem_home'),
    tx('version.hilfe_beim_aufdecken_heisst_jetzt_erstes'),
    tx('version.das_abhoeren_durch_eine_zweite_person')
  ] },
  { v: '1.2', datum: '2026-11-09', titel: tx('version.verlaesslich_pruefen'), punkte: [
    tx('version.vorige_aya_neu_bewerten_ein_fehltipp'),
    tx('version.doch_kein_fehler_fuehrt_nach_einem'),
    tx('version.angefangene_uebungen_bleiben_gespeichert'),
    tx('version.sofortkorrektur_die_ayat_mit_fehler'),
    tx('version.hilfe_wort_fuer_wort_statt_nur_des'),
    tx('version.eigener_tageswechsel_z_b_um_3_uhr_fuer'),
    tx('version.dezent_jemand_hoert_ab_oeffnet_den_text')
  ] },
  { v: '1.1', datum: '2026-11-09', titel: tx('version.schutz_und_testbetrieb'), punkte: [
    tx('version.profil_sichern_oeffnet_am_handy_das'),
    tx('version.vor_dem_laden_einer_sicherung_siehst_du'),
    tx('version.nach_sieben_tagen_ohne_sicherung'),
    tx('version.schnappschuesse_itqan_legt_taeglich_und'),
    tx('version.anleitung_zum_installieren_auf_dem_home'),
    tx('version.alle_seiten_speichern_zeigt_den_stand'),
    tx('version.versionsnummer_diese_neuigkeiten_und')
  ] },
  { v: '1.0', datum: '2026-11-09', titel: tx('version.ausgangsstand'), punkte: [
    tx('version.stand_der_sicherung_vor_dem_gutachten')
  ] }
];
