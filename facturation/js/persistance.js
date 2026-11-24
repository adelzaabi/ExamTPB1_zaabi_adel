/*
 * Où sont enregistrées les données :
 *  - « compte » : publié comme page Claude, dans l'espace privé de l'utilisateur (capacité db) ;
 *  - « local »  : fichier ouvert sur le poste, dans le stockage du navigateur ;
 *  - « memoire » : aucun stockage possible (navigation privée stricte…).
 * L'application garde l'état complet en mémoire ; enregistrer() le recopie (écritures groupées).
 */
(function (racine, fabrique) {
  const api = fabrique(typeof module === 'object' && module.exports ? require('./stockage') : racine.Stockage);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else racine.Persistance = api;
})(typeof self !== 'undefined' ? self : this, function (S) {
  'use strict';

  const DELAI_CHARGEMENT = 10000;

  function dansVisionneuse() {
    return typeof window !== 'undefined' && !!window.claude && typeof window.claude.use === 'function';
  }

  function capacite(nom) {
    if (!dansVisionneuse()) return Promise.resolve(null);
    try {
      return Promise.resolve(window.claude.use(nom)).catch(() => null);
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  function avecDelai(promesse, ms) {
    return new Promise((ok, ko) => {
      const minuterie = setTimeout(() => ko({ code: 'delai', message: 'délai dépassé' }), ms);
      promesse.then((v) => { clearTimeout(minuterie); ok(v); }, (e) => { clearTimeout(minuterie); ko(e); });
    });
  }

  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const copie = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));

  // ---------------------------------------------------------------- navigateur
  function moteurLocal() {
    const ok = S.disponible();
    return {
      mode: ok ? 'local' : 'memoire',
      charger: () => Promise.resolve(ok ? S.charger() : null),
      enregistrer: (etat) => (ok ? S.enregistrer(etat) : true),
    };
  }

  // ---------------------------------------------------------------- compte (db)
  async function moteurCompte(surErreur) {
    const [db, user] = await Promise.all([capacite('db'), capacite('user')]);
    if (!db || !user) return null;
    let uid = null;
    try { uid = await user.id(); } catch (e) { uid = null; }
    if (!uid) return null;

    const base = `data/users/${uid}`;
    const refs = {
      etat: db.doc(`${base}/etat`),
      brouillon: db.doc(`${base}/brouillon`),
      logo: db.doc(`${base}/logo`),
      cachet: db.doc(`${base}/cachet`),
    };
    refs.documents = refs.etat.collection('documents');

    const ecrit = { etat: null, brouillon: null, logo: null, cachet: null, docs: new Map() };
    let courant = null;
    let minuterie = null;
    let enCours = false;
    let aRefaire = false;

    function instantane(etat) {
      const p = etat.parametres;
      return {
        etat: JSON.stringify({
          version: etat.version,
          parametres: Object.assign({}, p, { societe: Object.assign({}, p.societe, { logo: '', cachet: '' }) }),
          compteurs: etat.compteurs,
          clients: etat.clients,
          articles: etat.articles,
        }),
        logo: p.societe.logo || '',
        cachet: p.societe.cachet || '',
        brouillon: etat.brouillon ? JSON.stringify(etat.brouillon) : '',
        docs: new Map(etat.documents.map((d) => [String(d.id), JSON.stringify(d)])),
      };
    }

    async function reessayer(action) {
      try {
        return await action();
      } catch (e) {
        if (e && e.code === 'unavailable') {
          await pause(400 + Math.random() * 800);
          return action();
        }
        throw e;
      }
    }

    async function synchroniser() {
      if (enCours) { aRefaire = true; return; }
      enCours = true;
      try {
        do {
          aRefaire = false;
          const s = instantane(courant);
          if (s.etat !== ecrit.etat) {
            await reessayer(() => refs.etat.set(JSON.parse(s.etat)));
            ecrit.etat = s.etat;
          }
          for (const k of ['logo', 'cachet']) {
            if (s[k] !== ecrit[k]) {
              await reessayer(() => (s[k] ? refs[k].set({ data: s[k] }) : refs[k].delete()));
              ecrit[k] = s[k];
            }
          }
          for (const [id, json] of s.docs) {
            if (ecrit.docs.get(id) !== json) {
              await reessayer(() => refs.documents.doc(id).set(JSON.parse(json)));
              ecrit.docs.set(id, json);
            }
          }
          for (const id of Array.from(ecrit.docs.keys())) {
            if (!s.docs.has(id)) {
              await reessayer(() => refs.documents.doc(id).delete());
              ecrit.docs.delete(id);
            }
          }
          if (s.brouillon !== ecrit.brouillon) {
            await reessayer(() => (s.brouillon ? refs.brouillon.set({ valeur: JSON.parse(s.brouillon) }) : refs.brouillon.delete()));
            ecrit.brouillon = s.brouillon;
          }
        } while (aRefaire);
      } catch (e) {
        if (surErreur) surErreur(e);
      } finally {
        enCours = false;
      }
    }

    return {
      mode: 'compte',
      async charger() {
        const [e, b, l, c, docs] = await avecDelai(Promise.all([
          refs.etat.get(), refs.brouillon.get(), refs.logo.get(), refs.cachet.get(), refs.documents.get(),
        ]), DELAI_CHARGEMENT);
        if (!e.exists) return null; // premier lancement
        const brut = copie(e.data());
        brut.parametres = brut.parametres || {};
        brut.parametres.societe = Object.assign({}, brut.parametres.societe, {
          logo: l.exists ? String((l.data() || {}).data || '') : '',
          cachet: c.exists ? String((c.data() || {}).data || '') : '',
        });
        brut.documents = docs.docs.filter((d) => d.exists).map((d) => copie(d.data()))
          .sort((a, b2) => String(b2.creeLe || '').localeCompare(String(a.creeLe || '')));
        brut.brouillon = b.exists ? copie((b.data() || {}).valeur) : null;
        const etat = S.normaliser(brut);
        const s = instantane(etat);
        ecrit.etat = s.etat;
        ecrit.logo = s.logo;
        ecrit.cachet = s.cachet;
        ecrit.brouillon = s.brouillon;
        ecrit.docs = new Map(s.docs);
        return etat;
      },
      enregistrer(etat) {
        courant = etat;
        clearTimeout(minuterie);
        minuterie = setTimeout(synchroniser, 500);
        return true;
      },
    };
  }

  /**
   * Choisit le stockage et charge l'état (null au premier lancement).
   * Si les données du compte ne peuvent pas être lues, on n'écrit surtout pas dessus :
   * on passe au stockage du navigateur et on le signale (avertissement).
   */
  async function ouvrir(surErreur) {
    let avertissement = '';
    if (dansVisionneuse()) {
      try {
        const m = await moteurCompte(surErreur);
        if (m) return { moteur: m, etat: await m.charger(), avertissement };
      } catch (e) {
        avertissement = 'Vos documents enregistrés en ligne n’ont pas pu être chargés. '
          + 'Le travail de cette session est conservé dans ce navigateur seulement. Rechargez la page plus tard.';
      }
    }
    const m = moteurLocal();
    return { moteur: m, etat: await m.charger(), avertissement };
  }

  return { ouvrir, capacite, dansVisionneuse };
});
