/*
 * Persistance locale (navigateur) + sauvegarde / restauration en fichier JSON.
 * Toutes les données restent sur le poste de l'utilisateur.
 */
(function (racine, fabrique) {
  const api = fabrique();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else racine.Stockage = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CLE = 'facturation-tn-v1';
  const VERSION = 1;

  function etatInitial() {
    return {
      version: VERSION,
      parametres: {
        societe: { nom: '', adresse: '', mf: '', tel: '', rc: '', email: '', rib: '', logo: '', cachet: '' },
        modeles: { proforma: '{AA}{N:4}/{AA}', facture: '{AA}{N:4}/{AA}', devis: 'D{AA}{N:4}/{AA}' },
        timbre: 1,
        tvaDefaut: 19,
        taux: [0, 7, 13, 19],
        nbTitre: '',
        nbTexte: '',
      },
      compteurs: {},
      clients: [],
      articles: [],
      documents: [],
      brouillon: null,
    };
  }

  function estObjet(x) {
    return x !== null && typeof x === 'object' && !Array.isArray(x);
  }

  /** Complète un état chargé avec les valeurs par défaut (compatibilité ascendante). */
  function normaliser(brut) {
    if (!estObjet(brut)) throw new Error('Format de sauvegarde invalide');
    const base = etatInitial();
    const p = estObjet(brut.parametres) ? brut.parametres : {};
    const etat = {
      version: VERSION,
      parametres: Object.assign({}, base.parametres, p, {
        societe: Object.assign({}, base.parametres.societe, estObjet(p.societe) ? p.societe : {}),
        modeles: Object.assign({}, base.parametres.modeles, estObjet(p.modeles) ? p.modeles : {}),
        taux: Array.isArray(p.taux) && p.taux.length ? p.taux.map(Number).filter(Number.isFinite) : base.parametres.taux,
      }),
      compteurs: estObjet(brut.compteurs) ? brut.compteurs : {},
      clients: Array.isArray(brut.clients) ? brut.clients.filter(estObjet) : [],
      articles: Array.isArray(brut.articles) ? brut.articles.filter(estObjet) : [],
      documents: Array.isArray(brut.documents) ? brut.documents.filter(estObjet) : [],
      brouillon: estObjet(brut.brouillon) ? brut.brouillon : null,
    };
    return etat;
  }

  function disponible() {
    try {
      const k = '__facturation_test__';
      localStorage.setItem(k, k);
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  function charger() {
    try {
      const brut = localStorage.getItem(CLE);
      return brut ? normaliser(JSON.parse(brut)) : null;
    } catch (e) {
      return null;
    }
  }

  function enregistrer(etat) {
    try {
      localStorage.setItem(CLE, JSON.stringify(etat));
      return true;
    } catch (e) {
      return false;
    }
  }

  function exporter(etat) {
    const copie = Object.assign({}, etat, { exporteLe: new Date().toISOString() });
    delete copie.brouillon;
    return JSON.stringify(copie, null, 2);
  }

  function importer(texte) {
    return normaliser(JSON.parse(texte));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  return { CLE, etatInitial, normaliser, disponible, charger, enregistrer, exporter, importer, uid };
});
