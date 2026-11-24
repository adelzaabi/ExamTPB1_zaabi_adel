/*
 * Génération du document A4 (HTML) au format de la facture analysée :
 * en-tête société à gauche, cadre client à droite, bandeau titre gris,
 * ligne Numéro / Date / Bon de livraison, tableau Désignation / Prix HT / TVA / Total HT
 * étiré jusqu'en bas de page, note « NB », cadre des totaux, zone cachet.
 */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) {
    module.exports = fabrique(require('./calculs'), require('./montant-lettres'));
  } else {
    racine.Rendu = fabrique(racine.Calculs, racine.MontantLettres);
  }
})(typeof self !== 'undefined' ? self : this, function (C, ML) {
  'use strict';

  const TYPES = {
    proforma: { titre: 'FACTURE PROFORMA', libelle: 'Facture proforma', arrete: 'Arrêtée la présente facture proforma' },
    facture: { titre: 'FACTURE', libelle: 'Facture', arrete: 'Arrêtée la présente facture' },
    devis: { titre: 'DEVIS', libelle: 'Devis', arrete: 'Arrêté le présent devis' },
  };

  const OPTIONS_DEFAUT = { qte: false, remise: false, ttc: true, lettres: true, timbre: false, cachet: true };

  // Position du bas du tableau dans le modèle d'origine (mm depuis le haut de la page)
  const BAS_TABLEAU_MM = 213;
  const HAUTEUR_PAGE_MM = 297;
  const MARGE_BAS_MM = 12;
  const HAUTEUR_CACHET_MM = 45;
  const HAUTEUR_CACHET_MIN_IMAGE_MM = 22;

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  function imageSure(src) {
    return typeof src === 'string' && /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(src) ? src : '';
  }

  /**
   * Désignation riche : titre souligné, puis description où
   *   « # texte » = sous-titre en gras, ligne vide = espace, autre ligne = élément en retrait.
   */
  function rendreDesignation(ligne) {
    let h = '';
    if (ligne.titre && String(ligne.titre).trim()) h += `<div class="d-titre">${esc(ligne.titre.trim())}</div>`;
    String(ligne.description || '').split(/\r?\n/).forEach((brut) => {
      const t = brut.trim();
      if (!t) h += '<div class="d-vide"></div>';
      else if (t.startsWith('#')) h += `<div class="d-section">${esc(t.replace(/^#+\s*/, ''))}</div>`;
      else h += `<div class="d-item">${esc(t)}</div>`;
    });
    return h;
  }

  /** Options d'affichage ; la colonne quantité apparaît d'office dès qu'une quantité n'est pas 1. */
  function options(doc) {
    const o = Object.assign({}, OPTIONS_DEFAUT, doc.options || {});
    const qteDe = (l) => C.lireNombre(l.qte === undefined || l.qte === '' ? 1 : l.qte);
    if (!o.qte && (doc.lignes || []).some((l) => qteDe(l) !== 1)) o.qte = true;
    return o;
  }

  function totauxDocument(doc, parametres) {
    const o = options(doc);
    return C.calculerTotaux(doc.lignes, { timbre: o.timbre ? (parametres && parametres.timbre) || 0 : 0 });
  }

  function rendreDocument(doc, parametres) {
    const p = parametres || {};
    const s = p.societe || {};
    const t = TYPES[doc.type] || TYPES.proforma;
    const o = options(doc);
    const cl = doc.client || {};
    const lignes = doc.lignes || [];
    const tot = totauxDocument(doc, p);

    // --- En-tête société
    const infos = [];
    String(s.adresse || '').split(/\r?\n/).filter((x) => x.trim()).forEach((x) => infos.push(esc(x.trim())));
    if (s.mf) infos.push(`TVA : ${esc(s.mf)}`);
    if (s.tel) infos.push(`Tel : ${esc(s.tel)}`);
    if (s.rc) infos.push(`RC : ${esc(s.rc)}`);
    if (s.email) infos.push(`Email : ${esc(s.email)}`);
    if (s.rib) infos.push(`RIB : ${esc(s.rib)}`);
    const logo = imageSure(s.logo);

    const champClient = (lib, val) =>
      `<div class="ligne"><span class="lib">${lib}</span><span class="val">: ${esc(val)}</span></div>`;

    // --- Colonnes du tableau
    const cols = [{ cle: 'des', titre: 'Désignation', largeur: null }];
    if (o.qte) cols.push({ cle: 'qte', titre: 'Qté', largeur: 12 });
    cols.push({ cle: 'pu', titre: o.qte ? 'P.U. HT' : 'Prix HT', largeur: 20 });
    if (o.remise) cols.push({ cle: 'rem', titre: 'Rem.', largeur: 11 });
    cols.push({ cle: 'tva', titre: 'TVA', largeur: 10 }, { cle: 'tot', titre: 'Total HT', largeur: 23 });

    const cellule = (cle, l, i) => {
      switch (cle) {
        case 'des': return `<td class="des">${rendreDesignation(l)}</td>`;
        case 'qte': return `<td class="num">${esc(C.formatQuantite(l.qte === undefined || l.qte === '' ? 1 : l.qte))}</td>`;
        case 'pu': return `<td class="num">${C.formatMontant(l.prixHT)}</td>`;
        case 'rem': return `<td class="num">${C.lireNombre(l.remise) ? esc(C.formatTaux(l.remise)) : ''}</td>`;
        case 'tva': return `<td class="num centre">${esc(C.formatTaux(l.tva))}</td>`;
        default: return `<td class="num">${C.formatMontant(tot.lignes[i].totalHT)}</td>`;
      }
    };

    const corps = lignes.map((l, i) => `<tr class="article">${cols.map((c) => cellule(c.cle, l, i)).join('')}</tr>`).join('');

    // --- Totaux
    const lignesTotaux = [['Total HT', tot.totalHT, '']];
    if (tot.recapTva.length > 1) {
      tot.recapTva.forEach((r) => lignesTotaux.push([`TVA ${C.formatTaux(r.taux)}`, r.montant, '']));
    }
    lignesTotaux.push(['Total TVA', tot.totalTVA, '']);
    if (o.timbre) lignesTotaux.push(['Timbre fiscal', tot.timbre, '']);
    if (o.ttc) lignesTotaux.push([o.timbre ? 'Net à payer TTC' : 'Total TTC', tot.totalTTC, 'net']);

    const nbTitre = String(doc.nbTitre || '').trim();
    const nbLignes = String(doc.nbTexte || '').split(/\r?\n/).filter((x) => x.trim());
    const nb = nbTitre || nbLignes.length
      ? `<div class="nb"><div class="nb-entete"><span class="nb-lib">NB</span> : <span class="nb-titre">${esc(nbTitre)}</span></div>${
        nbLignes.map((x) => `<div>${esc(x.trim())}</div>`).join('')}</div>`
      : '<div class="nb"></div>';

    const cachet = o.cachet ? imageSure(s.cachet) : '';

    return `<div class="page type-${esc(doc.type)}">
  <div class="contenu">
    <div class="entete">
      <div class="societe">
        ${logo ? `<div class="logo"><img src="${logo}" alt=""></div>` : ''}
        <div class="nom">${esc(s.nom || '')}</div>
        ${infos.map((x) => `<div>${x}</div>`).join('')}
      </div>
      <div class="cadre-client">
        ${champClient('Code', cl.code)}
        ${champClient('Nom', cl.nom)}
        ${champClient('Adresse', cl.adresse)}
        <div class="ligne"><span class="lib">Code TVA</span><span class="val">: ${esc(cl.mf)}</span></div>
      </div>
    </div>

    <table class="bandeau">
      <tr><td colspan="3" class="titre gris-clair">${t.titre}</td></tr>
      <tr>
        <td class="ref num-doc">Numéro : ${esc(doc.numero)}</td>
        <td class="ref date-doc">Date :${esc(C.formatDate(doc.date))}</td>
        <td class="ref bl-doc">Bon de livraison : ${esc(doc.bonLivraison)}</td>
      </tr>
    </table>

    <table class="lignes">
      <colgroup>${cols.map((c) => (c.largeur ? `<col style="width:${c.largeur}mm">` : '<col>')).join('')}</colgroup>
      <thead><tr>${cols.map((c) => `<th class="gris">${c.titre}</th>`).join('')}</tr></thead>
      <tbody>
        ${corps}
        <tr class="remplissage">${cols.map(() => '<td></td>').join('')}</tr>
      </tbody>
    </table>

    <div class="pied">
      <div class="pied-gauche">
        ${nb}
        ${o.lettres ? `<div class="lettres">${t.arrete} à la somme de : <strong>${esc(ML.montantEnLettres(tot.totalTTC))}</strong>.</div>` : ''}
      </div>
      <div class="pied-droite">
        <table class="totaux">
          ${lignesTotaux.map(([lib, val, cls]) =>
            `<tr class="${cls}"><td class="lib gris">${esc(lib)}</td><td class="val">${C.formatMontant(val)}</td></tr>`).join('')}
        </table>
        <div class="zone-cachet">${cachet ? `<img src="${cachet}" alt="Cachet">` : ''}</div>
      </div>
    </div>
  </div>
</div>`;
  }

  /**
   * Prolonge les colonnes du tableau jusqu'au niveau du modèle (213 mm),
   * sans faire déborder le reste du document sur une deuxième page.
   * À appeler dans le navigateur après insertion du HTML.
   */
  function ajusterRemplissage(page) {
    if (!page) return;
    const table = page.querySelector('table.lignes');
    const contenu = page.querySelector('.contenu');
    const rangee = page.querySelector('tr.remplissage');
    if (!table || !contenu || !rangee) return;
    const MM = 96 / 25.4;
    const limite = (HAUTEUR_PAGE_MM - MARGE_BAS_MM - 2) * MM; // bas utile de la page 1
    const bas = () => contenu.offsetTop + contenu.offsetHeight;

    // 1) Zone cachet : 45 mm par défaut ; on la réduit si elle seule ferait passer le document sur 2 pages
    const zone = page.querySelector('.zone-cachet');
    const img = zone && zone.querySelector('img');
    rangee.style.height = '0px';
    const zoneNormale = () => {
      zone.style.minHeight = `${HAUTEUR_CACHET_MM}mm`;
      zone.style.marginTop = '';
      if (img) img.style.maxHeight = '';
    };
    if (zone) {
      zoneNormale();
      const depassement = bas() - limite;
      if (depassement > 0) {
        const marge = 2 * MM;
        const avant = parseFloat(getComputedStyle(zone).marginTop) || 0;
        const plancher = img ? HAUTEUR_CACHET_MIN_IMAGE_MM * MM : 0;
        const hauteur = Math.max(plancher, HAUTEUR_CACHET_MM * MM + (avant - marge) - depassement);
        zone.style.marginTop = `${marge}px`;
        zone.style.minHeight = `${Math.floor(hauteur)}px`;
        if (img) img.style.maxHeight = `${Math.floor(hauteur)}px`;
        // document de plusieurs pages de toute façon : zone normale sur la dernière page
        if (bas() > limite) zoneNormale();
      }
    }

    // 2) Prolonge les colonnes jusqu'à 213 mm comme sur le modèle, sans créer de 2e page
    const versModele = BAS_TABLEAU_MM * MM - (table.offsetTop + table.offsetHeight);
    const placeRestante = limite - bas();
    const h = Math.max(0, Math.min(versModele, placeRestante));
    rangee.style.height = `${Math.floor(h)}px`;
  }

  /** Nom de fichier proposé à l'impression PDF. */
  function nomFichier(doc) {
    const t = TYPES[doc.type] || TYPES.proforma;
    const num = String(doc.numero || '').replace(/[\\/:*?"<>|]+/g, '-');
    const client = String((doc.client && doc.client.nom) || '').replace(/[\\/:*?"<>|]+/g, '-').trim();
    return [t.libelle, num, client].filter(Boolean).join(' - ');
  }

  return { TYPES, OPTIONS_DEFAUT, optionsEffectives: options, esc, rendreDesignation, rendreDocument, totauxDocument, ajusterRemplissage, nomFichier };
});
