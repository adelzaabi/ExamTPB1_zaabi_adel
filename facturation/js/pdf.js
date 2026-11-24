/*
 * Génération d'un PDF vectoriel A4 (jsPDF) reprenant les cotes du gabarit HTML :
 * texte net et sélectionnable, fichier léger, sans passer par la boîte d'impression.
 * Nécessite window.jspdf (jsPDF 2.x, chargé depuis un CDN).
 */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) {
    module.exports = fabrique(require('./calculs'), require('./montant-lettres'), require('./rendu'));
  } else {
    racine.PdfFacture = fabrique(racine.Calculs, racine.MontantLettres, racine.Rendu);
  }
})(typeof self !== 'undefined' ? self : this, function (C, ML, R) {
  'use strict';

  const PT = 25.4 / 72; // 1 point en mm
  const PAGE = { gauche: 11, droite: 198, largeur: 187, haut: 12, limite: 283 };
  const BAS_TABLEAU_MODELE = 213;
  const GRIS_CLAIR = 217;
  const GRIS = 166;
  const TRAIT = 0.2;

  /** Les polices standard du PDF couvrent le Latin-1 : remplacement des autres caractères. */
  function txt(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/[‘’ʼ′]/g, "'")
      .replace(/[“”″]/g, '"')
      .replace(/[–—−]/g, '-')
      .replace(/…/g, '...')
      .replace(/œ/g, 'oe').replace(/Œ/g, 'OE')
      .replace(/[    ]/g, ' ')
      .replace(/€/g, 'EUR')
      .replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/g, '?');
  }

  function imageSure(src) {
    const m = typeof src === 'string' && /^data:image\/(png|jpe?g);base64,/i.exec(src);
    return m ? { src, format: /png/i.test(m[1]) ? 'PNG' : 'JPEG' } : null;
  }

  function generer(doc, parametres, options) {
    const lib = (options && options.jspdf) || (typeof window !== 'undefined' && window.jspdf);
    if (!lib || !lib.jsPDF) throw new Error('Le module PDF n’est pas chargé (connexion Internet nécessaire).');
    const pdf = new lib.jsPDF({ unit: 'mm', format: 'a4', compress: true });

    const p = parametres || {};
    const s = p.societe || {};
    const t = R.TYPES[doc.type] || R.TYPES.proforma;
    const o = R.optionsEffectives(doc);
    const cl = doc.client || {};
    const lignes = doc.lignes || [];
    const tot = R.totauxDocument(doc, p);

    pdf.setProperties({ title: R.nomFichier(doc), subject: t.libelle, creator: 'Facturier' });
    pdf.setLineWidth(TRAIT);
    pdf.setDrawColor(0);
    pdf.setTextColor(0);

    // ------------------------------------------------------------------ outils
    function police(taillePt, gras) {
      pdf.setFont('times', gras ? 'bold' : 'normal');
      pdf.setFontSize(taillePt);
    }
    // ligne de base d'un texte de taille S (pt) centré dans une ligne de hauteur L (mm), comme en CSS
    function base(haut, L, taillePt) {
      const S = taillePt * PT;
      return haut + (L - 1.107 * S) / 2 + 0.891 * S;
    }
    function souligner(x, y, largeur, taillePt) {
      pdf.setLineWidth(Math.max(0.12, taillePt * PT * 0.05));
      pdf.line(x, y + taillePt * PT * 0.12, x + largeur, y + taillePt * PT * 0.12);
      pdf.setLineWidth(TRAIT);
    }
    /** Écrit une ligne ; retourne sa hauteur. */
    function ecrire(texte, x, haut, taillePt, opt) {
      const op = Object.assign({ gras: false, align: 'left', L: taillePt * PT * 1.2, souligne: false }, opt || {});
      police(taillePt, op.gras);
      const t1 = txt(texte);
      const y = base(haut, op.L, taillePt);
      pdf.text(t1, x, y, { align: op.align, baseline: 'alphabetic' });
      if (op.souligne && t1) {
        const w = pdf.getTextWidth(t1);
        souligner(op.align === 'right' ? x - w : op.align === 'center' ? x - w / 2 : x, y, w, taillePt);
      }
      return op.L;
    }
    function couper(texte, largeurMax, taillePt, gras) {
      police(taillePt, gras);
      return pdf.splitTextToSize(txt(texte), largeurMax);
    }
    /** Texte à plusieurs styles avec retour à la ligne ; retourne la hauteur. */
    function ecrireRiche(morceaux, x, haut, largeurMax, taillePt, L, dessiner) {
      const mots = [];
      morceaux.forEach((m) => txt(m.texte).split(/(\s+)/).forEach((w) => { if (w) mots.push({ w, gras: !!m.gras }); }));
      const largeurDe = (m) => { police(taillePt, m.gras); return pdf.getTextWidth(m.w); };
      const lignesR = [];
      let ligne = [];
      let lx = 0;
      mots.forEach((m) => {
        const espace = /^\s+$/.test(m.w);
        const w = largeurDe(espace ? { w: ' ', gras: m.gras } : m);
        if (espace) {
          if (ligne.length) { ligne.push({ w: ' ', gras: m.gras, l: w }); lx += w; }
          return;
        }
        if (lx + w > largeurMax && ligne.length) {
          while (ligne.length && ligne[ligne.length - 1].w === ' ') ligne.pop();
          lignesR.push(ligne);
          ligne = [];
          lx = 0;
        }
        ligne.push({ w: m.w, gras: m.gras, l: w });
        lx += w;
      });
      if (ligne.length) lignesR.push(ligne);
      if (dessiner !== false) {
        lignesR.forEach((lg, i) => {
          let cx = x;
          const y = base(haut + i * L, L, taillePt);
          lg.forEach((m) => { police(taillePt, m.gras); pdf.text(m.w, cx, y); cx += m.l; });
        });
      }
      return lignesR.length * L;
    }
    function imageAjustee(img, cx, haut, largeurMax, hauteurMax, centrer) {
      let w = largeurMax;
      let h = hauteurMax;
      try {
        const pr = pdf.getImageProperties(img.src);
        const r = Math.min(largeurMax / pr.width, hauteurMax / pr.height);
        w = pr.width * r;
        h = pr.height * r;
      } catch (e) { /* proportions inconnues : cadre complet */ }
      pdf.addImage(img.src, img.format, centrer ? cx - w / 2 : cx, haut, w, h, undefined, 'FAST');
      return h;
    }

    // ------------------------------------------------------------------ en-tête
    const xs = PAGE.gauche + 1.3;
    let y = 26;
    const logo = imageSure(s.logo);
    if (logo) { imageAjustee(logo, xs, y, 60, 16, false); y += 17.5; }
    couper(s.nom || '', 88, 12, true).forEach((l) => { y += ecrire(l, xs, y, 12, { gras: true, L: 12 * PT * 1.15 }); });
    const infos = [];
    String(s.adresse || '').split(/\r?\n/).filter((x) => x.trim()).forEach((x) => infos.push(x.trim()));
    if (s.mf) infos.push(`TVA : ${s.mf}`);
    if (s.tel) infos.push(`Tel : ${s.tel}`);
    if (s.rc) infos.push(`RC : ${s.rc}`);
    if (s.email) infos.push(`Email : ${s.email}`);
    if (s.rib) infos.push(`RIB : ${s.rib}`);
    infos.forEach((info) => couper(info, 88, 10, false).forEach((l) => { y += ecrire(l, xs, y, 10, { L: 10 * PT * 1.2 }); }));
    const basSociete = y;

    // cadre client
    const cx0 = 103;
    const cy0 = 28.5;
    const Lc = 12 * PT * 1.15;
    let cy = cy0 + 1;
    [['Code', cl.code], ['Nom', cl.nom], ['Adresse', cl.adresse], ['Code TVA', cl.mf]].forEach(([lib, val]) => {
      const morceaux = couper(`: ${val || ''}`, 95 - 2.4 - 21, 12, false);
      ecrire(lib, cx0 + 1.2, cy, 12, { L: Lc });
      morceaux.forEach((m, i) => ecrire(m, cx0 + 1.2 + 21, cy + i * Lc, 12, { L: Lc }));
      cy += morceaux.length * Lc;
    });
    const hClient = Math.max(23.5, cy + 1 - cy0);
    pdf.rect(cx0, cy0, 95, hClient);

    // ------------------------------------------------------------------ bandeau
    const B = Math.max(26 + 30, basSociete, cy0 + hClient) + 18;
    pdf.setFillColor(GRIS_CLAIR);
    pdf.rect(PAGE.gauche, B, PAGE.largeur, 6, 'FD');
    ecrire(t.titre, PAGE.gauche + PAGE.largeur / 2, B, 14, { gras: true, align: 'center', L: 6 });
    const largeursRef = [47.5, 73, PAGE.largeur - 47.5 - 73];
    const textesRef = [`Numéro : ${doc.numero || ''}`, `Date :${C.formatDate(doc.date)}`, `Bon de livraison : ${doc.bonLivraison || ''}`];
    let rx = PAGE.gauche;
    largeursRef.forEach((w, i) => {
      pdf.rect(rx, B + 6, w, 9.4);
      const L = 12 * PT * 1.2;
      ecrire(textesRef[i], rx + (i === 2 ? 1.3 : 1), B + 6 + 9.4 - 0.4 - L, 12, { gras: true, L });
      rx += w;
    });

    // ------------------------------------------------------------------ tableau
    const cols = [{ cle: 'des', titre: 'Désignation' }];
    if (o.qte) cols.push({ cle: 'qte', titre: 'Qté', l: 12 });
    cols.push({ cle: 'pu', titre: o.qte ? 'P.U. HT' : 'Prix HT', l: 20 });
    if (o.remise) cols.push({ cle: 'rem', titre: 'Rem.', l: 11 });
    cols.push({ cle: 'tva', titre: 'TVA', l: 10 }, { cle: 'tot', titre: 'Total HT', l: 23 });
    cols[0].l = PAGE.largeur - cols.slice(1).reduce((a, c) => a + c.l, 0);
    let cxCol = PAGE.gauche;
    cols.forEach((c) => { c.x = cxCol; cxCol += c.l; });

    const H_ENTETE = 8.7;
    const L_DES = 4.43;
    let hautTableau = B + 6 + 9.4 + 2.8;

    function enteteTableau(haut) {
      pdf.setFillColor(GRIS);
      pdf.rect(PAGE.gauche, haut, PAGE.largeur, H_ENTETE, 'F');
      const L = 9 * PT * 1.2;
      cols.forEach((c) => ecrire(c.titre, c.x + c.l / 2, haut + (H_ENTETE - L) / 2, 9, { gras: true, align: 'center', L }));
    }
    function cadreTableau(haut, bas) {
      pdf.rect(PAGE.gauche, haut, PAGE.largeur, bas - haut);
      pdf.line(PAGE.gauche, haut + H_ENTETE, PAGE.droite, haut + H_ENTETE);
      cols.slice(1).forEach((c) => pdf.line(c.x, haut, c.x, bas));
    }

    enteteTableau(hautTableau);
    y = hautTableau + H_ENTETE;
    const valeurs = (l, i) => ({
      qte: C.formatQuantite(l.qte === undefined || l.qte === '' ? 1 : l.qte),
      pu: C.formatMontant(l.prixHT),
      rem: C.lireNombre(l.remise) ? C.formatTaux(l.remise) : '',
      tva: C.formatTaux(l.tva),
      tot: C.formatMontant(tot.lignes[i].totalHT),
    });

    const desLargeur = cols[0].l - 2.4;
    lignes.forEach((l, i) => {
      y += i === 0 ? 0.6 : 0.8 + 3;
      // éléments de la désignation
      const elements = [];
      if (l.titre && String(l.titre).trim()) elements.push({ texte: String(l.titre).trim(), taille: 11, souligne: true, retrait: 0 });
      String(l.description || '').split(/\r?\n/).forEach((brut) => {
        const t2 = brut.trim();
        if (!t2) elements.push({ vide: true });
        else if (t2.startsWith('#')) elements.push({ texte: t2.replace(/^#+\s*/, ''), taille: 9, gras: true, retrait: 0 });
        else elements.push({ texte: t2, taille: 11, retrait: 3.5 });
      });
      if (!elements.length) elements.push({ vide: true });

      let premiere = true;
      const ecrireMontants = (haut) => {
        const v = valeurs(l, i);
        const L = 10 * PT * 1.2;
        cols.slice(1).forEach((c) => {
          const centre = c.cle === 'tva';
          ecrire(v[c.cle], centre ? c.x + c.l / 2 : c.x + c.l - 1.2, haut, 10, { align: centre ? 'center' : 'right', L });
        });
      };
      elements.forEach((el) => {
        const sousLignes = el.vide ? [null] : couper(el.texte, desLargeur - el.retrait, el.taille, el.gras);
        sousLignes.forEach((sl) => {
          const h = el.vide ? 2 : L_DES;
          if (y + h > PAGE.limite + 2) { // saut de page dans le tableau
            cadreTableau(hautTableau, y + 0.8);
            pdf.addPage();
            hautTableau = PAGE.haut;
            enteteTableau(hautTableau);
            y = hautTableau + H_ENTETE + 0.6;
          }
          if (premiere) { ecrireMontants(y); premiere = false; }
          if (sl !== null) ecrire(sl, cols[0].x + 1.2 + el.retrait, y, el.taille, { gras: el.gras, souligne: el.souligne, L: L_DES });
          y += h;
        });
      });
    });
    const finLignes = y + 0.8;

    // ------------------------------------------------------------------ pied : mesures
    const LARGEUR_GAUCHE = PAGE.largeur - 56 - 6;
    const nbTitre = String(doc.nbTitre || '').trim();
    const nbLignes = String(doc.nbTexte || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    const avecNb = !!(nbTitre || nbLignes.length);
    const L_NB_TITRE = 12 * PT * 1.05;
    const L_NB = 10 * PT * 1.15;
    const nbCoupees = [];
    nbLignes.forEach((x) => couper(x, LARGEUR_GAUCHE, 10, false).forEach((c) => nbCoupees.push(c)));
    const hNb = avecNb ? L_NB_TITRE + nbCoupees.length * L_NB : 0;
    const L_LETTRES = 10.5 * PT * 1.25;
    const morceauxLettres = [
      { texte: `${t.arrete} à la somme de : ` },
      { texte: ML.montantEnLettres(tot.totalTTC), gras: true },
      { texte: '.' },
    ];
    const hLettres = o.lettres ? 4 + ecrireRiche(morceauxLettres, 0, 0, LARGEUR_GAUCHE, 10.5, L_LETTRES, false) : 0;
    const hGauche = hNb + hLettres;

    const lignesTotaux = [['Total HT', tot.totalHT, false]];
    if (tot.recapTva.length > 1) tot.recapTva.forEach((r) => lignesTotaux.push([`TVA ${C.formatTaux(r.taux)}`, r.montant, false]));
    lignesTotaux.push(['Total TVA', tot.totalTVA, false]);
    if (o.timbre) lignesTotaux.push(['Timbre fiscal', tot.timbre, false]);
    if (o.ttc) lignesTotaux.push([o.timbre ? 'Net à payer TTC' : 'Total TTC', tot.totalTTC, true]);
    const H_TOT = 5.2;
    const hTotaux = lignesTotaux.length * H_TOT;
    const cachet = o.cachet ? imageSure(s.cachet) : null;

    // hauteur du bas du tableau et de la zone cachet (mêmes règles que l'aperçu)
    const hPied = (zone, marge) => Math.max(hGauche, hTotaux + marge + zone);
    let basTableau = finLignes;
    let zone = 45;
    let margeZone = 5;
    let piedPageSuivante = false;
    if (finLignes + hPied(45, 5) <= PAGE.limite) {
      basTableau = Math.max(finLignes, Math.min(BAS_TABLEAU_MODELE, PAGE.limite - hPied(45, 5)));
    } else {
      const plancher = cachet ? 22 : 0;
      const dispo = PAGE.limite - finLignes - Math.max(hGauche, hTotaux + 2);
      if (dispo >= plancher && finLignes + Math.max(hGauche, hTotaux) <= PAGE.limite) {
        zone = Math.min(45, Math.max(0, dispo));
        margeZone = 2;
      } else {
        piedPageSuivante = true;
      }
    }
    cadreTableau(hautTableau, basTableau);

    // ------------------------------------------------------------------ pied : dessin
    let F = basTableau;
    if (piedPageSuivante) { pdf.addPage(); F = PAGE.haut; }

    let yg = F;
    if (avecNb) {
      const yb = base(F, L_NB_TITRE, 12);
      let x = PAGE.gauche;
      [['NB', 9], [' : ', 10], [nbTitre, 12]].forEach(([morceau, taille]) => {
        if (!morceau) return;
        police(taille, true);
        const m = txt(morceau);
        pdf.text(m, x, yb);
        const w = pdf.getTextWidth(m);
        souligner(x, yb, w, taille);
        x += w;
      });
      yg += L_NB_TITRE;
      nbCoupees.forEach((c) => { yg += ecrire(c, PAGE.gauche, yg, 10, { L: L_NB }); });
    }
    if (o.lettres) {
      yg += 4;
      yg += ecrireRiche(morceauxLettres, PAGE.gauche, yg, LARGEUR_GAUCHE, 10.5, L_LETTRES);
    }

    const xt = PAGE.droite - 56;
    let yt = F;
    lignesTotaux.forEach(([lib, val, net]) => {
      pdf.setFillColor(GRIS);
      pdf.rect(xt, yt, 33, H_TOT, 'FD');
      pdf.rect(xt + 33, yt, 23, H_TOT);
      const L = 9.5 * PT * 1.2;
      const haut = yt + (H_TOT - L) / 2;
      ecrire(lib, xt + 33 / 2, haut, 9.5, { gras: net, align: 'center', L });
      ecrire(C.formatMontant(val), PAGE.droite - 1.2, haut, 9.5, { gras: net, align: 'right', L });
      yt += H_TOT;
    });
    if (cachet && zone > 0) imageAjustee(cachet, xt + 28 - 11, yt + margeZone, 50, zone, true);

    return pdf;
  }

  /** PDF sous forme d'ArrayBuffer (pour un enregistrement ou un téléchargement). */
  function genererOctets(doc, parametres, options) {
    return generer(doc, parametres, options).output('arraybuffer');
  }

  return { generer, genererOctets, txt };
});
