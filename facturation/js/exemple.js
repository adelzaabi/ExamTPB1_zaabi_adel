/*
 * Données d'exemple : contenu de la facture proforma n° 260019/26 analysée
 * (textes repris avec l'orthographe corrigée). L'identité de la société et du client
 * est remplacée par des valeurs fictives de même format : saisissez les vôtres dans
 * l'onglet Paramètres. Le cachet n'est volontairement pas reproduit : chaque société
 * importe le sien.
 */
(function (racine, fabrique) {
  const api = fabrique();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else racine.Exemple = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DESCRIPTION = [
    '# 1) : Ventes',
    'Gestion des ventes : devis, commandes, factures, acomptes, avoirs',
    'Suivi des clients',
    'Règlement clients (partiel, global)',
    'Gestion et suivi du portefeuille',
    'Échéancier client',
    'Factures non apurées et risque clients',
    'Gestion des impayés',
    'Transfert comptable',
    '# 2) : Achats et stocks (commandes fournisseurs et réapprovisionnement)',
    'Gestion des bons de réception',
    'Gestion des factures d’achat',
    'Gestion des avoirs fournisseurs',
    'Suivi des fournisseurs',
    'Règlement fournisseurs',
    'Engagement fournisseurs / Banque, date d’échéance',
    '# 3) : Stock',
    'Gestion des entrées et des sorties',
    'Suivi périodique du stock',
    'Stock physique',
    'Valeur du stock',
    'Mouvement détaillé du produit (date, numéro de pièce)',
    '# 4) : Statistiques détaillées',
  ].join('\n');

  const NB_TEXTE = [
    '-L’élaboration des programmes de traitement correspondants',
    '-La formation du personnel appelé à exploiter les nouveaux programmes',
    '-L’encadrement du personnel utilisateur dans la phase de démarrage.',
  ].join('\n');

  return {
    societe: {
      nom: 'SOCIÉTÉ EXEMPLE INFORMATIQUE',
      adresse: 'Rue de l\u2019Exemple, Ariana',
      mf: '1234567/A/A/M/000',
      tel: '70 000 000',
      rc: 'B000000000',
      email: '',
      rib: '',
    },
    parametres: { tvaDefaut: 7, nbTitre: 'cette offre comporte', nbTexte: NB_TEXTE },
    client: { code: '9999', nom: 'CLIENT EXEMPLE', adresse: 'RADES', mf: '' },
    article: {
      ref: 'GCI', titre: 'Gestion Commerciale Intégrée', description: DESCRIPTION, prixHT: 1500, tva: 7,
    },
    // le compteur 2026 des proformas est à 18 : le document reçoit le n° 260019/26
    compteur: { cle: 'proforma-2026', valeur: 18 },
    document: {
      type: 'proforma',
      date: '2026-10-14',
      bonLivraison: '',
      client: { code: '9999', nom: 'CLIENT EXEMPLE', adresse: 'RADES', mf: '' },
      lignes: [{ titre: 'Gestion Commerciale Intégrée', description: DESCRIPTION, qte: 1, prixHT: 1500, remise: 0, tva: 7 }],
      nbTitre: 'cette offre comporte',
      nbTexte: NB_TEXTE,
      options: { qte: false, remise: false, ttc: true, lettres: true, timbre: false, cachet: true },
    },
  };
});
