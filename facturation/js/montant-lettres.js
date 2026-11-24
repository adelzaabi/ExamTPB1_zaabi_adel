/*
 * Conversion d'un montant en toutes lettres (français, dinars tunisiens).
 *   montantEnLettres(1605)      -> "Mille six cent cinq dinars"
 *   montantEnLettres(12.5)      -> "Douze dinars et cinq cents millimes"
 * Orthographe traditionnelle : traits d'union entre dizaines et unités,
 * « et » pour 21, 31… 71, accord de « vingt » et « cent » (quatre-vingts, deux cents)
 * sauf devant « mille ».
 */
(function (racine, fabrique) {
  const api = fabrique();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else racine.MontantLettres = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const UNITES = [
    'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
    'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
    'dix-sept', 'dix-huit', 'dix-neuf',
  ];
  const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante',
    'soixante', 'quatre-vingt', 'quatre-vingt'];

  // 1..99. « final » = le nombre n'est pas suivi de « mille » (quatre-vingts prend un s).
  function moinsDeCent(n, final) {
    if (n < 20) return UNITES[n];
    const d = Math.floor(n / 10);
    const u = n % 10;
    if (d === 7 || d === 9) {
      if (d === 7 && u === 1) return 'soixante et onze';
      return DIZAINES[d] + '-' + UNITES[10 + u];
    }
    if (u === 0) return d === 8 ? (final ? 'quatre-vingts' : 'quatre-vingt') : DIZAINES[d];
    if (u === 1 && d !== 8) return DIZAINES[d] + ' et un';
    return DIZAINES[d] + '-' + UNITES[u];
  }

  // 1..999
  function moinsDeMille(n, final) {
    const c = Math.floor(n / 100);
    const r = n % 100;
    const morceaux = [];
    if (c === 1) morceaux.push('cent');
    else if (c > 1) morceaux.push(UNITES[c] + ' ' + (r === 0 && final ? 'cents' : 'cent'));
    if (r > 0) morceaux.push(moinsDeCent(r, final));
    return morceaux.join(' ');
  }

  /** Entier positif (jusqu'à 999 999 999 999) en lettres. */
  function nombreEnLettres(nombre) {
    let n = Math.floor(Math.abs(Number(nombre) || 0));
    if (n === 0) return 'zéro';
    if (n > 999999999999) throw new RangeError('Nombre trop grand');
    const milliards = Math.floor(n / 1e9);
    const millions = Math.floor(n / 1e6) % 1000;
    const milliers = Math.floor(n / 1e3) % 1000;
    const reste = n % 1000;
    const morceaux = [];
    // devant million(s)/milliard(s) (noms), vingt et cent s'accordent : « deux cents millions »
    if (milliards) morceaux.push(milliards === 1 ? 'un milliard' : moinsDeMille(milliards, true) + ' milliards');
    if (millions) morceaux.push(millions === 1 ? 'un million' : moinsDeMille(millions, true) + ' millions');
    // « mille » est invariable et ne prend pas « un » ; vingt/cent restent invariables devant lui
    if (milliers) morceaux.push(milliers === 1 ? 'mille' : moinsDeMille(milliers, false) + ' mille');
    if (reste) morceaux.push(moinsDeMille(reste, true));
    return morceaux.join(' ');
  }

  function majuscule(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  /**
   * Montant en dinars (3 décimales = millimes) en toutes lettres.
   * options.devise / devisePluriel / sousUnite / sousUnitePluriel pour une autre monnaie.
   */
  function montantEnLettres(montant, options) {
    const o = Object.assign({
      devise: 'dinar', devisePluriel: 'dinars',
      sousUnite: 'millime', sousUnitePluriel: 'millimes', decimales: 3,
    }, options || {});
    const facteur = Math.pow(10, o.decimales);
    const total = Math.round(Math.abs(Number(montant) || 0) * facteur);
    const entier = Math.floor(total / facteur);
    const fraction = total % facteur;

    const morceaux = [];
    if (entier > 0 || fraction === 0) {
      let txt = nombreEnLettres(entier) + ' ';
      // « un million de dinars », « deux milliards de dinars »
      if (entier >= 1e6 && entier % 1e6 === 0) txt += 'de ';
      txt += entier > 1 ? o.devisePluriel : o.devise;
      morceaux.push(txt);
    }
    if (fraction > 0) {
      morceaux.push(nombreEnLettres(fraction) + ' ' + (fraction > 1 ? o.sousUnitePluriel : o.sousUnite));
    }
    const signe = Number(montant) < 0 && total > 0 ? 'moins ' : '';
    return majuscule(signe + morceaux.join(' et '));
  }

  return { nombreEnLettres, montantEnLettres };
});
