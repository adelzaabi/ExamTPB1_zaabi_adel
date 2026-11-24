/*
 * Calculs et formats propres aux factures tunisiennes :
 *  - montants en dinars à 3 décimales (millimes), calculés en entiers pour éviter les erreurs d'arrondi ;
 *  - format d'affichage « 1 500,000 » ;
 *  - TVA par taux, timbre fiscal, total TTC ;
 *  - numérotation paramétrable (ex. modèle « {AA}{N:4}/{AA} » -> 260019/26) ;
 *  - contrôle de forme du matricule fiscal (ex. 1234567/A/A/M/000).
 */
(function (racine, fabrique) {
  const api = fabrique();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else racine.Calculs = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ESPACE = ' '; // espace insécable entre les milliers

  /** Lit un nombre saisi à la française (« 1 500,250 », « 7 », « 1.500,25 »). */
  function lireNombre(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (v === null || v === undefined) return 0;
    let s = String(v).replace(/[\s  ]/g, '').replace('%', '');
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }

  function versMillimes(v) {
    return Math.round(lireNombre(v) * 1000);
  }

  /** 1500 -> "1 500,000" */
  function formatMontant(v, decimales) {
    const dec = decimales === undefined ? 3 : decimales;
    const n = lireNombre(v);
    const facteur = Math.pow(10, dec);
    const total = Math.round(Math.abs(n) * facteur);
    const entier = Math.floor(total / facteur).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE);
    const frac = dec > 0 ? ',' + String(total % facteur).padStart(dec, '0') : '';
    return (n < 0 && total > 0 ? '-' : '') + entier + frac;
  }

  /** 7 -> "07%", 19 -> "19%", 5.5 -> "5,5%" */
  function formatTaux(t) {
    const n = lireNombre(t);
    return (Number.isInteger(n) ? String(n).padStart(2, '0') : String(n).replace('.', ',')) + '%';
  }

  /** Quantité : 1 -> "1", 2.5 -> "2,5" */
  function formatQuantite(q) {
    const n = Math.round(lireNombre(q) * 1000) / 1000;
    return String(n).replace('.', ',');
  }

  /** "2026-10-14" -> "14-10-2026" */
  function formatDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? `${m[3]}-${m[2]}-${m[1]}` : String(iso || '');
  }

  function annee(iso) {
    const a = parseInt(String(iso || '').slice(0, 4), 10);
    return Number.isFinite(a) && a > 999 ? a : new Date().getFullYear();
  }

  /**
   * Numéro de document à partir d'un modèle.
   * Jetons : {AAAA} année, {AA} année sur 2 chiffres, {MM} mois, {N} ou {N:4} séquence complétée par des zéros.
   */
  function formaterNumero(modele, sequence, dateIso) {
    const a = String(annee(dateIso));
    const mois = (/^\d{4}-(\d{2})/.exec(String(dateIso || '')) || [])[1] ||
      String(new Date().getMonth() + 1).padStart(2, '0');
    return String(modele || '{N}')
      .replace(/\{AAAA\}/g, a)
      .replace(/\{AA\}/g, a.slice(-2))
      .replace(/\{MM\}/g, mois)
      .replace(/\{N(?::(\d+))?\}/g, (_, largeur) => String(sequence).padStart(Number(largeur || 1), '0'));
  }

  /** Montants d'une ligne, en millimes. */
  function calculerLigne(ligne) {
    const qte = lireNombre(ligne.qte === undefined || ligne.qte === '' ? 1 : ligne.qte);
    const brut = Math.round(qte * versMillimes(ligne.prixHT));
    const remise = Math.round(brut * lireNombre(ligne.remise) / 100);
    return { brut, remise, net: brut - remise, taux: lireNombre(ligne.tva) };
  }

  /**
   * Totaux d'un document. Les montants rendus sont en dinars (arrondis au millime).
   * options.timbre : montant du timbre fiscal à ajouter (0 si non applicable).
   */
  function calculerTotaux(lignes, options) {
    const o = options || {};
    const parTaux = new Map();
    let totalHT = 0;
    const detail = (lignes || []).map((l) => {
      const c = calculerLigne(l);
      totalHT += c.net;
      parTaux.set(c.taux, (parTaux.get(c.taux) || 0) + c.net);
      return { totalHT: c.net / 1000, remise: c.remise / 1000 };
    });
    let totalTVA = 0;
    const recapTva = Array.from(parTaux.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([taux, base]) => {
        const montant = Math.round(base * taux / 100);
        totalTVA += montant;
        return { taux, base: base / 1000, montant: montant / 1000 };
      });
    const timbre = versMillimes(o.timbre || 0);
    return {
      lignes: detail,
      recapTva,
      totalHT: totalHT / 1000,
      totalTVA: totalTVA / 1000,
      timbre: timbre / 1000,
      totalTTC: (totalHT + totalTVA + timbre) / 1000,
    };
  }

  /**
   * Contrôle de forme du matricule fiscal tunisien :
   * 7 chiffres + clé (lettre) + code TVA (A, B, D, N, P) + catégorie (M, C, P, N, E) + n° d'établissement (3 chiffres).
   * Les barres obliques et un préfixe « TVA » sont tolérés. Un champ vide est accepté (client particulier).
   */
  function validerMF(valeur) {
    const brut = String(valeur || '').trim().toUpperCase().replace(/^(TVA|MF)\s*:?\s*/, '');
    if (!brut) return { valide: true, normalise: '' };
    const m = /^(\d{7})\s*\/?\s*([A-Z])\s*\/?\s*([ABDNP])\s*\/?\s*([MCPNE])\s*\/?\s*(\d{3})$/.exec(brut);
    if (!m) return { valide: false, normalise: brut };
    return { valide: true, normalise: `${m[1]}/${m[2]}/${m[3]}/${m[4]}/${m[5]}` };
  }

  return {
    lireNombre, versMillimes, formatMontant, formatTaux, formatQuantite, formatDate,
    annee, formaterNumero, calculerLigne, calculerTotaux, validerMF,
  };
});
