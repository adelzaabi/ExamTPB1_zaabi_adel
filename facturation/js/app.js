/* Facturation — logique de l'interface */
(function () {
  'use strict';

  const C = window.Calculs;
  const R = window.Rendu;
  const S = window.Stockage;
  const EX = window.Exemple;

  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  const esc = R.esc;
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function aujourdhui() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function lireChemin(obj, chemin) {
    return chemin.split('.').reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj);
  }
  function ecrireChemin(obj, chemin, valeur) {
    const cles = chemin.split('.');
    const derniere = cles.pop();
    const cible = cles.reduce((o, k) => {
      if (typeof o[k] !== 'object' || o[k] === null) o[k] = {};
      return o[k];
    }, obj);
    cible[derniere] = valeur;
  }
  function saisieNombre(n) {
    return String(C.lireNombre(n)).replace('.', ',');
  }

  // ======================================================================
  // État
  // ======================================================================
  const stockageOk = S.disponible();
  let etat = S.charger();
  const premierLancement = !etat;
  if (!etat) etat = S.etatInitial();
  let doc = null;
  let modifie = false;

  function toast(message, genre) {
    const el = document.createElement('div');
    el.className = `toast ${genre || ''}`;
    el.textContent = message;
    $('#toasts').appendChild(el);
    setTimeout(() => el.classList.add('sortie'), 3200);
    setTimeout(() => el.remove(), 3700);
  }

  function persister() {
    if (!S.enregistrer(etat) && stockageOk) {
      toast("Enregistrement impossible dans le navigateur (espace plein ?). Exportez une sauvegarde.", 'erreur');
    }
  }

  let minuterieBrouillon = null;
  function sauverBrouillon() {
    clearTimeout(minuterieBrouillon);
    minuterieBrouillon = setTimeout(() => {
      etat.brouillon = { doc, modifie };
      persister();
    }, 400);
  }

  function estEnregistre(d) {
    return etat.documents.some((x) => x.id === d.id);
  }

  function majEtatDoc() {
    const el = $('#etat-doc');
    const t = R.TYPES[doc.type] || R.TYPES.proforma;
    $('#titre-doc').textContent = `${t.libelle} n° ${doc.numero || '—'}${doc.client.nom ? ' · ' + doc.client.nom : ''}`;
    if (!estEnregistre(doc)) {
      el.textContent = '● Nouveau, non enregistré';
      el.className = 'etat modifie';
    } else if (modifie) {
      el.textContent = '● Modifications non enregistrées';
      el.className = 'etat modifie';
    } else {
      el.textContent = '✓ Enregistré';
      el.className = 'etat';
    }
  }

  function marquerModifie(valeur) {
    modifie = valeur !== false;
    majEtatDoc();
    sauverBrouillon();
  }

  // ======================================================================
  // Numérotation
  // ======================================================================
  function cleCompteur(type, date) {
    return `${type}-${C.annee(date)}`;
  }
  function prochainSeq(type, date) {
    return (parseInt(etat.compteurs[cleCompteur(type, date)], 10) || 0) + 1;
  }
  function numeroAutomatique() {
    if (!doc.numeroAuto) return;
    doc.seq = prochainSeq(doc.type, doc.date);
    doc.numero = C.formaterNumero(etat.parametres.modeles[doc.type] || '{N:4}', doc.seq, doc.date);
    const champ = $('#onglet-document [data-champ="numero"]');
    if (champ) champ.value = doc.numero;
  }

  // ======================================================================
  // Documents
  // ======================================================================
  function ligneVide() {
    return { titre: '', description: '', qte: 1, prixHT: 0, remise: 0, tva: C.lireNombre(etat.parametres.tvaDefaut) };
  }

  function nouveauDocument(type) {
    const p = etat.parametres;
    const t = type || 'proforma';
    return {
      id: S.uid(),
      type: t,
      numero: '',
      numeroAuto: true,
      seq: null,
      date: aujourdhui(),
      bonLivraison: '',
      client: { code: '', nom: '', adresse: '', mf: '' },
      lignes: [ligneVide()],
      nbTitre: t === 'facture' ? '' : p.nbTitre,
      nbTexte: t === 'facture' ? '' : p.nbTexte,
      options: Object.assign({}, R.OPTIONS_DEFAUT, { timbre: t === 'facture' }),
      creeLe: null,
      modifieLe: null,
    };
  }

  function ouvrir(d, estModifie) {
    doc = clone(d);
    doc.options = Object.assign({}, R.OPTIONS_DEFAUT, doc.options || {});
    doc.client = Object.assign({ code: '', nom: '', adresse: '', mf: '' }, doc.client || {});
    doc.lignes = Array.isArray(doc.lignes) ? doc.lignes : [];
    if (doc.numeroAuto) numeroAutomatique();
    remplirFormulaire();
    rendreLignes();
    majApercu();
    marquerModifie(!!estModifie);
  }

  function confirmerAbandon() {
    return !modifie || window.confirm('Le document en cours contient des modifications non enregistrées. Les abandonner ?');
  }

  function enregistrer() {
    doc.numero = String(doc.numero || '').trim();
    if (!doc.numero) {
      toast('Le numéro du document est obligatoire.', 'erreur');
      return false;
    }
    const t = R.TYPES[doc.type];
    const doublon = etat.documents.find((d) => d.id !== doc.id && d.type === doc.type && d.numero === doc.numero);
    if (doublon && !window.confirm(`Un document « ${t.libelle} ${doc.numero} » existe déjà. Enregistrer quand même ?`)) {
      return false;
    }
    const maintenant = new Date().toISOString();
    doc.modifieLe = maintenant;
    const i = etat.documents.findIndex((d) => d.id === doc.id);
    if (doc.numeroAuto && doc.seq) {
      const k = cleCompteur(doc.type, doc.date);
      etat.compteurs[k] = Math.max(parseInt(etat.compteurs[k], 10) || 0, doc.seq);
    }
    doc.numeroAuto = false; // une fois enregistré, le numéro est figé
    if (i < 0) {
      doc.creeLe = maintenant;
      etat.documents.unshift(clone(doc));
    } else {
      etat.documents[i] = clone(doc);
    }
    persister();
    marquerModifie(false);
    rendreParametres();
    toast(`${t.libelle} ${doc.numero} ${doc.type === 'devis' ? 'enregistré' : 'enregistrée'}.`, 'succes');
    return true;
  }

  function copierDocument(source, type) {
    const copie = clone(source);
    copie.id = S.uid();
    copie.type = type || source.type;
    copie.numero = '';
    copie.numeroAuto = true;
    copie.seq = null;
    copie.date = aujourdhui();
    copie.creeLe = null;
    copie.modifieLe = null;
    copie.options = Object.assign({}, R.OPTIONS_DEFAUT, source.options || {});
    if (copie.type !== source.type) copie.options.timbre = copie.type === 'facture';
    return copie;
  }

  // ======================================================================
  // Formulaire du document
  // ======================================================================
  function remplirFormulaire() {
    $$('#onglet-document [data-champ]:not([data-ligne])').forEach((el) => {
      const v = lireChemin(doc, el.dataset.champ);
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = v === undefined || v === null ? '' : v;
    });
    $$('#onglet-document [data-mf]').forEach(verifierMF);
    majChoixClient();
    majChoixArticle();
  }

  function optionsTva(selectionne) {
    const taux = etat.parametres.taux.slice();
    const v = C.lireNombre(selectionne);
    if (!taux.includes(v)) taux.push(v);
    return taux.sort((a, b) => a - b)
      .map((t) => `<option value="${t}"${t === v ? ' selected' : ''}>${esc(C.formatTaux(t))}</option>`).join('');
  }

  function rendreLignes() {
    const liste = $('#liste-lignes');
    if (!doc.lignes.length) {
      liste.innerHTML = '<p class="vide">Aucune ligne. Ajoutez une ligne vide ou un article du catalogue.</p>';
      majTotauxLignes();
      return;
    }
    liste.innerHTML = doc.lignes.map((l, i) => `
      <div class="carte-ligne" data-index="${i}">
        <div class="carte-entete">
          <strong>Ligne ${i + 1}</strong>
          <span class="carte-boutons">
            <button type="button" data-action="monter-ligne" data-index="${i}" title="Monter"${i === 0 ? ' disabled' : ''}>↑</button>
            <button type="button" data-action="descendre-ligne" data-index="${i}" title="Descendre"${i === doc.lignes.length - 1 ? ' disabled' : ''}>↓</button>
            <button type="button" data-action="catalogue-ligne" data-index="${i}" title="Enregistrer dans le catalogue">★</button>
            <button type="button" class="danger" data-action="supprimer-ligne" data-index="${i}" title="Supprimer">✕</button>
          </span>
        </div>
        <label>Titre (souligné)<input data-ligne="${i}" data-champ="titre" value="${esc(l.titre)}" autocomplete="off"></label>
        <label>Description<textarea data-ligne="${i}" data-champ="description" rows="${Math.min(12, Math.max(3, String(l.description || '').split('\n').length + 1))}">${esc(l.description)}</textarea></label>
        <div class="grille-4">
          <label>Qté<input data-ligne="${i}" data-champ="qte" data-type="nombre" inputmode="decimal" value="${esc(saisieNombre(l.qte === undefined ? 1 : l.qte))}"></label>
          <label>Prix unitaire HT<input data-ligne="${i}" data-champ="prixHT" data-type="nombre" inputmode="decimal" value="${esc(saisieNombre(l.prixHT))}"></label>
          <label>Remise %<input data-ligne="${i}" data-champ="remise" data-type="nombre" inputmode="decimal" value="${esc(saisieNombre(l.remise))}"></label>
          <label>TVA<select data-ligne="${i}" data-champ="tva" data-type="nombre">${optionsTva(l.tva)}</select></label>
        </div>
        <div class="total-ligne">Total HT : <strong data-total-ligne="${i}"></strong></div>
      </div>`).join('');
    majTotauxLignes();
  }

  function majTotauxLignes() {
    const tot = R.totauxDocument(doc, etat.parametres);
    $$('[data-total-ligne]').forEach((el) => {
      const l = tot.lignes[+el.dataset.totalLigne];
      el.textContent = l ? C.formatMontant(l.totalHT) : '';
    });
    const morceaux = [['Total HT', tot.totalHT], ['TVA', tot.totalTVA]];
    if (doc.options.timbre) morceaux.push(['Timbre', tot.timbre]);
    morceaux.push(['TTC', tot.totalTTC]);
    $('#resume-totaux').innerHTML = morceaux
      .map(([l, v]) => `<span>${l} : <strong>${C.formatMontant(v)}</strong></span>`).join('');
  }

  function verifierMF(el) {
    const r = C.validerMF(el.value);
    el.classList.toggle('invalide', !r.valide);
    const msg = el.parentElement && el.parentElement.querySelector('.message-mf');
    if (msg) msg.textContent = r.valide ? '' : 'Format attendu : 7 chiffres/clé/code TVA/catégorie/000 (ex. 1234567/A/A/M/000)';
  }

  let apercuPlanifie = false;
  function planifierApercu() {
    if (apercuPlanifie) return;
    apercuPlanifie = true;
    requestAnimationFrame(() => {
      apercuPlanifie = false;
      majApercu();
    });
  }

  function majApercu() {
    $('#apercu').innerHTML = R.rendreDocument(doc, etat.parametres);
    R.ajusterRemplissage($('#apercu .page'));
    ajusterEchelle();
    majTotauxLignes();
    majEtatDoc();
  }

  function ajusterEchelle() {
    const zone = $('#zone-apercu');
    const page = $('#apercu .page');
    if (!page) return;
    const style = getComputedStyle(zone);
    const dispo = zone.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const echelle = Math.min(1, dispo / page.offsetWidth);
    $('#apercu').style.transform = `scale(${echelle})`;
    const conteneur = $('#apercu-echelle');
    conteneur.style.width = `${page.offsetWidth * echelle}px`;
    conteneur.style.height = `${page.offsetHeight * echelle}px`;
  }

  function changement() {
    marquerModifie(true);
    planifierApercu();
  }

  $('#onglet-document').addEventListener('input', (e) => {
    const el = e.target;
    const champ = el.dataset.champ;
    if (!champ || !doc) return;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.type === 'nombre') v = C.lireNombre(v);

    if (el.dataset.ligne !== undefined) {
      const ligne = doc.lignes[+el.dataset.ligne];
      if (ligne) ligne[champ] = v;
    } else {
      ecrireChemin(doc, champ, v);
      if (champ === 'numero') doc.numeroAuto = false;
      if (champ === 'type') {
        doc.options.timbre = v === 'facture';
        $('#onglet-document [data-champ="options.timbre"]').checked = doc.options.timbre;
      }
      if ((champ === 'type' || champ === 'date') && !estEnregistre(doc)) numeroAutomatique();
    }
    if (el.hasAttribute('data-mf')) verifierMF(el);
    changement();
  });

  // ======================================================================
  // Listes déroulantes clients / articles
  // ======================================================================
  function majChoixClient() {
    const clients = etat.clients.slice().sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr'));
    $('#choix-client').innerHTML = `<option value="">${clients.length ? '— Choisir un client —' : '— Aucun client enregistré —'}</option>` +
      clients.map((c) => `<option value="${esc(c.id)}">${esc(c.code)} — ${esc(c.nom)}</option>`).join('');
  }
  function majChoixArticle() {
    const articles = etat.articles.slice().sort((a, b) => String(a.titre).localeCompare(String(b.titre), 'fr'));
    $('#choix-article').innerHTML = `<option value="">${articles.length ? '— Article du catalogue —' : '— Catalogue vide —'}</option>` +
      articles.map((a) => `<option value="${esc(a.id)}">${esc(a.titre || a.ref)} — ${C.formatMontant(a.prixHT)}</option>`).join('');
  }

  function appliquerClient(c) {
    doc.client = { code: c.code || '', nom: c.nom || '', adresse: c.adresse || '', mf: c.mf || '' };
    remplirFormulaire();
    changement();
  }

  $('#choix-client').addEventListener('change', (e) => {
    const c = etat.clients.find((x) => x.id === e.target.value);
    if (c) appliquerClient(c);
    e.target.value = '';
  });

  function ligneDepuisArticle(a) {
    return { titre: a.titre || '', description: a.description || '', qte: 1, prixHT: C.lireNombre(a.prixHT), remise: 0, tva: C.lireNombre(a.tva) };
  }

  function codeClientSuivant() {
    const max = etat.clients.reduce((m, c) => {
      const n = parseInt(c.code, 10);
      return Number.isFinite(n) && n < 9999 ? Math.max(m, n) : m;
    }, 0);
    return String(max + 1).padStart(4, '0');
  }

  // ======================================================================
  // Onglet Clients
  // ======================================================================
  function rendreClients() {
    const filtre = $('#filtre-clients').value.trim().toLowerCase();
    const liste = etat.clients
      .filter((c) => !filtre || [c.code, c.nom, c.adresse, c.mf].join(' ').toLowerCase().includes(filtre))
      .sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr'));
    $('#table-clients').innerHTML = liste.length ? `<table class="liste">
      <thead><tr><th>Code</th><th>Nom</th><th>Adresse</th><th></th></tr></thead>
      <tbody>${liste.map((c) => `<tr>
        <td>${esc(c.code)}</td>
        <td>${esc(c.nom)}${c.mf ? `<br><small>${esc(c.mf)}</small>` : ''}</td>
        <td>${esc(c.adresse)}</td>
        <td class="actions-ligne">
          <button type="button" class="petit" data-action="client-utiliser" data-id="${esc(c.id)}">Utiliser</button>
          <button type="button" class="petit" data-action="client-modifier" data-id="${esc(c.id)}">Modifier</button>
          <button type="button" class="petit danger" data-action="client-supprimer" data-id="${esc(c.id)}">✕</button>
        </td></tr>`).join('')}</tbody></table>`
      : '<p class="vide">Aucun client.</p>';
  }

  function viderFormClient() {
    ['cl-id', 'cl-code', 'cl-nom', 'cl-adresse', 'cl-mf', 'cl-tel'].forEach((id) => { $('#' + id).value = ''; });
    $('#titre-form-client').textContent = 'Nouveau client';
    verifierMF($('#cl-mf'));
  }

  function enregistrerClient(donnees) {
    const c = Object.assign({}, donnees);
    if (!String(c.nom || '').trim()) {
      toast('Le nom du client est obligatoire.', 'erreur');
      return null;
    }
    if (!String(c.code || '').trim()) c.code = codeClientSuivant();
    const memeCode = etat.clients.find((x) => x.code === c.code && x.id !== c.id);
    if (memeCode) {
      if (!c.id && window.confirm(`Le code ${c.code} existe déjà (${memeCode.nom}). Mettre à jour ce client ?`)) {
        c.id = memeCode.id;
      } else {
        toast(`Le code client ${c.code} est déjà utilisé.`, 'erreur');
        return null;
      }
    }
    if (!c.id) c.id = S.uid();
    const i = etat.clients.findIndex((x) => x.id === c.id);
    if (i < 0) etat.clients.push(c);
    else etat.clients[i] = Object.assign(etat.clients[i], c);
    persister();
    majChoixClient();
    rendreClients();
    return c;
  }

  // ======================================================================
  // Onglet Catalogue
  // ======================================================================
  function rendreArticles() {
    const filtre = $('#filtre-articles').value.trim().toLowerCase();
    const liste = etat.articles
      .filter((a) => !filtre || [a.ref, a.titre, a.description].join(' ').toLowerCase().includes(filtre))
      .sort((a, b) => String(a.titre).localeCompare(String(b.titre), 'fr'));
    $('#table-articles').innerHTML = liste.length ? `<table class="liste">
      <thead><tr><th>Réf.</th><th>Titre</th><th>Prix HT</th><th>TVA</th><th></th></tr></thead>
      <tbody>${liste.map((a) => `<tr>
        <td>${esc(a.ref)}</td><td>${esc(a.titre)}</td>
        <td class="montant">${C.formatMontant(a.prixHT)}</td><td>${esc(C.formatTaux(a.tva))}</td>
        <td class="actions-ligne">
          <button type="button" class="petit" data-action="article-ajouter" data-id="${esc(a.id)}">Ajouter</button>
          <button type="button" class="petit" data-action="article-modifier" data-id="${esc(a.id)}">Modifier</button>
          <button type="button" class="petit danger" data-action="article-supprimer" data-id="${esc(a.id)}">✕</button>
        </td></tr>`).join('')}</tbody></table>`
      : '<p class="vide">Catalogue vide. Utilisez ★ sur une ligne du document pour l\'y enregistrer.</p>';
  }

  function viderFormArticle() {
    ['ar-id', 'ar-ref', 'ar-titre', 'ar-description', 'ar-prix'].forEach((id) => { $('#' + id).value = ''; });
    $('#ar-tva').innerHTML = optionsTva(etat.parametres.tvaDefaut);
    $('#titre-form-article').textContent = 'Nouvel article / service';
  }

  function enregistrerArticle(donnees) {
    const a = Object.assign({}, donnees);
    if (!String(a.titre || '').trim() && !String(a.ref || '').trim()) {
      toast("Indiquez au moins un titre ou une référence pour l'article.", 'erreur');
      return null;
    }
    if (!a.id) a.id = S.uid();
    const i = etat.articles.findIndex((x) => x.id === a.id);
    if (i < 0) etat.articles.push(a);
    else etat.articles[i] = a;
    persister();
    majChoixArticle();
    rendreArticles();
    return a;
  }

  // ======================================================================
  // Onglet Historique
  // ======================================================================
  function rendreDocuments() {
    const filtre = $('#filtre-documents').value.trim().toLowerCase();
    const liste = etat.documents
      .filter((d) => !filtre || [d.numero, d.client && d.client.nom, d.client && d.client.code, (R.TYPES[d.type] || {}).libelle]
        .join(' ').toLowerCase().includes(filtre))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.numero).localeCompare(String(a.numero)));
    $('#table-documents').innerHTML = liste.length ? `<table class="liste">
      <thead><tr><th>Document</th><th>Date</th><th>Client</th><th>TTC</th><th></th></tr></thead>
      <tbody>${liste.map((d) => `<tr class="${doc && d.id === doc.id ? 'courant' : ''}">
        <td><span class="badge ${esc(d.type)}">${esc((R.TYPES[d.type] || {}).libelle || d.type)}</span><br>${esc(d.numero)}</td>
        <td>${esc(C.formatDate(d.date))}</td>
        <td>${esc(d.client && d.client.nom)}</td>
        <td class="montant">${C.formatMontant(R.totauxDocument(d, etat.parametres).totalTTC)}</td>
        <td class="actions-ligne">
          <button type="button" class="petit" data-action="doc-ouvrir" data-id="${esc(d.id)}">Ouvrir</button>
          <button type="button" class="petit" data-action="doc-dupliquer" data-id="${esc(d.id)}">Copier</button>
          <button type="button" class="petit danger" data-action="doc-supprimer" data-id="${esc(d.id)}">✕</button>
        </td></tr>`).join('')}</tbody></table>`
      : '<p class="vide">Aucun document enregistré.</p>';
  }

  function telecharger(nom, contenu, type) {
    const blob = new Blob([contenu], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ======================================================================
  // Onglet Paramètres
  // ======================================================================
  function rendreParametres() {
    const p = etat.parametres;
    $$('#onglet-parametres [data-param]').forEach((el) => {
      const cle = el.dataset.param;
      if (cle === 'tvaDefaut') return;
      const v = lireChemin(p, cle);
      if (document.activeElement === el) return;
      el.value = cle === 'taux' ? p.taux.join(', ') : cle === 'timbre' ? saisieNombre(v) : (v === undefined ? '' : v);
    });
    $('#param-tva-defaut').innerHTML = optionsTva(p.tvaDefaut);
    const an = C.annee(doc ? doc.date : aujourdhui());
    $('#libelle-compteurs').textContent = `Dernier numéro utilisé en ${an} (le prochain document prendra ce nombre + 1) :`;
    $$('#onglet-parametres [data-compteur]').forEach((el) => {
      if (document.activeElement !== el) el.value = parseInt(etat.compteurs[`${el.dataset.compteur}-${an}`], 10) || 0;
    });
    ['logo', 'cachet'].forEach((k) => {
      $('#vignette-' + k).innerHTML = p.societe[k] ? `<img src="${esc(p.societe[k])}" alt="">` : '<span class="aide">Aucune image</span>';
    });
    $$('#onglet-parametres [data-mf]').forEach(verifierMF);
  }

  $('#onglet-parametres').addEventListener('input', (e) => {
    const el = e.target;
    const p = etat.parametres;
    if (el.dataset.param) {
      const cle = el.dataset.param;
      let v = el.value;
      if (cle === 'taux') {
        v = v.split(/[;,\s]+/).map((x) => x.trim()).filter(Boolean).map(C.lireNombre);
        if (!v.length) return;
        v = Array.from(new Set(v)).sort((a, b) => a - b);
      } else if (cle === 'timbre' || cle === 'tvaDefaut') {
        v = C.lireNombre(v);
      }
      ecrireChemin(p, cle, v);
      if (cle === 'taux') {
        $('#param-tva-defaut').innerHTML = optionsTva(p.tvaDefaut);
        rendreLignes();
      }
      if (cle.startsWith('modeles.')) numeroAutomatique();
      if (el.hasAttribute('data-mf')) verifierMF(el);
    } else if (el.dataset.compteur) {
      const an = C.annee(doc ? doc.date : aujourdhui());
      etat.compteurs[`${el.dataset.compteur}-${an}`] = Math.max(0, parseInt(el.value, 10) || 0);
      numeroAutomatique();
    } else {
      return;
    }
    persister();
    planifierApercu();
  });

  function lireImage(fichier, tailleMax) {
    return new Promise((ok, ko) => {
      if (!/^image\//.test(fichier.type)) {
        ko(new Error("Le fichier choisi n'est pas une image."));
        return;
      }
      const lecteur = new FileReader();
      lecteur.onerror = () => ko(lecteur.error);
      lecteur.onload = () => {
        const img = new Image();
        img.onload = () => {
          const r = Math.min(1, tailleMax / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * r));
          canvas.height = Math.max(1, Math.round(img.height * r));
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          ok(canvas.toDataURL('image/png'));
        };
        img.onerror = () => ko(new Error('Image illisible.'));
        img.src = lecteur.result;
      };
      lecteur.readAsDataURL(fichier);
    });
  }

  $('#onglet-parametres').addEventListener('change', (e) => {
    const el = e.target;
    if (el.type !== 'file' || !el.dataset.image || !el.files[0]) return;
    lireImage(el.files[0], 700)
      .then((url) => {
        etat.parametres.societe[el.dataset.image] = url;
        persister();
        rendreParametres();
        planifierApercu();
        toast('Image enregistrée.', 'succes');
      })
      .catch((err) => toast(err.message, 'erreur'))
      .finally(() => { el.value = ''; });
  });

  function chargerExemple() {
    const p = etat.parametres;
    Object.assign(p.societe, EX.societe);
    Object.assign(p, EX.parametres);
    if (!p.taux.includes(EX.article.tva)) p.taux = p.taux.concat(EX.article.tva).sort((a, b) => a - b);
    if (!etat.clients.some((c) => c.code === EX.client.code)) etat.clients.push(Object.assign({ id: S.uid(), tel: '' }, EX.client));
    if (!etat.articles.some((a) => a.ref === EX.article.ref)) etat.articles.push(Object.assign({ id: S.uid() }, EX.article));
    etat.compteurs[EX.compteur.cle] = Math.max(parseInt(etat.compteurs[EX.compteur.cle], 10) || 0, EX.compteur.valeur);
    persister();
    const d = Object.assign(nouveauDocument(EX.document.type), clone(EX.document));
    ouvrir(d, true);
    rendreParametres();
    toast("Exemple chargé : proforma 260019/26 (cliquez « Enregistrer » pour la conserver).", 'succes');
  }

  // ======================================================================
  // Actions (boutons)
  // ======================================================================
  const ACTIONS = {
    nouveau() {
      if (!confirmerAbandon()) return;
      ouvrir(nouveauDocument($('#nouveau-type').value), false);
      montrerOnglet('document');
    },
    enregistrer,
    dupliquer() {
      if (!confirmerAbandon()) return;
      ouvrir(copierDocument(doc), true);
      toast('Copie créée avec un nouveau numéro.', 'succes');
    },
    convertir() {
      if (doc.type === 'facture') {
        toast('Ce document est déjà une facture.');
        return;
      }
      if (!confirmerAbandon()) return;
      const f = copierDocument(doc, 'facture');
      f.bonLivraison = '';
      ouvrir(f, true);
      toast('Facture créée à partir du document : vérifiez puis enregistrez.', 'succes');
    },
    imprimer() {
      majApercu();
      window.print();
    },
    'numero-auto'() {
      doc.numeroAuto = true;
      numeroAutomatique();
      changement();
    },
    'memoriser-client'() {
      const existant = etat.clients.find((c) => c.code && c.code === doc.client.code);
      const c = enregistrerClient(Object.assign({}, existant || {}, doc.client, { id: existant ? existant.id : undefined }));
      if (c) {
        if (c.code !== doc.client.code) {
          doc.client.code = c.code;
          remplirFormulaire();
          changement();
        }
        toast(`Client ${c.code} — ${c.nom} enregistré.`, 'succes');
      }
    },
    'ajouter-ligne'() {
      doc.lignes.push(ligneVide());
      rendreLignes();
      changement();
      const champs = $$('#liste-lignes [data-champ="titre"]');
      if (champs.length) champs[champs.length - 1].focus();
    },
    'ajouter-article'() {
      const a = etat.articles.find((x) => x.id === $('#choix-article').value);
      if (!a) {
        toast('Choisissez un article dans la liste.');
        return;
      }
      doc.lignes.push(ligneDepuisArticle(a));
      rendreLignes();
      changement();
    },
    'monter-ligne'(b) {
      const i = +b.dataset.index;
      if (i <= 0) return;
      [doc.lignes[i - 1], doc.lignes[i]] = [doc.lignes[i], doc.lignes[i - 1]];
      rendreLignes();
      changement();
    },
    'descendre-ligne'(b) {
      const i = +b.dataset.index;
      if (i >= doc.lignes.length - 1) return;
      [doc.lignes[i + 1], doc.lignes[i]] = [doc.lignes[i], doc.lignes[i + 1]];
      rendreLignes();
      changement();
    },
    'supprimer-ligne'(b) {
      const i = +b.dataset.index;
      const l = doc.lignes[i];
      if ((l.titre || l.description || C.lireNombre(l.prixHT)) && !window.confirm(`Supprimer la ligne ${i + 1} ?`)) return;
      doc.lignes.splice(i, 1);
      rendreLignes();
      changement();
    },
    'catalogue-ligne'(b) {
      const l = doc.lignes[+b.dataset.index];
      const existant = etat.articles.find((a) => a.titre && a.titre === l.titre);
      const a = enregistrerArticle({
        id: existant ? existant.id : undefined,
        ref: existant ? existant.ref : '',
        titre: l.titre, description: l.description, prixHT: C.lireNombre(l.prixHT), tva: C.lireNombre(l.tva),
      });
      if (a) toast(existant ? 'Article du catalogue mis à jour.' : 'Ligne ajoutée au catalogue.', 'succes');
    },

    // --- clients
    'client-enregistrer'() {
      const c = enregistrerClient({
        id: $('#cl-id').value || undefined,
        code: $('#cl-code').value.trim(),
        nom: $('#cl-nom').value.trim(),
        adresse: $('#cl-adresse').value.trim(),
        mf: $('#cl-mf').value.trim(),
        tel: $('#cl-tel').value.trim(),
      });
      if (c) {
        viderFormClient();
        toast('Client enregistré.', 'succes');
      }
    },
    'client-vider': viderFormClient,
    'client-utiliser'(b) {
      const c = etat.clients.find((x) => x.id === b.dataset.id);
      if (c) {
        appliquerClient(c);
        montrerOnglet('document');
      }
    },
    'client-modifier'(b) {
      const c = etat.clients.find((x) => x.id === b.dataset.id);
      if (!c) return;
      $('#cl-id').value = c.id;
      $('#cl-code').value = c.code || '';
      $('#cl-nom').value = c.nom || '';
      $('#cl-adresse').value = c.adresse || '';
      $('#cl-mf').value = c.mf || '';
      $('#cl-tel').value = c.tel || '';
      $('#titre-form-client').textContent = `Modifier le client ${c.code}`;
      verifierMF($('#cl-mf'));
      $('#cl-nom').focus();
    },
    'client-supprimer'(b) {
      const c = etat.clients.find((x) => x.id === b.dataset.id);
      if (!c || !window.confirm(`Supprimer le client ${c.code} — ${c.nom} ? (les documents existants ne sont pas modifiés)`)) return;
      etat.clients = etat.clients.filter((x) => x.id !== c.id);
      persister();
      majChoixClient();
      rendreClients();
    },

    // --- catalogue
    'article-enregistrer'() {
      const a = enregistrerArticle({
        id: $('#ar-id').value || undefined,
        ref: $('#ar-ref').value.trim(),
        titre: $('#ar-titre').value.trim(),
        description: $('#ar-description').value,
        prixHT: C.lireNombre($('#ar-prix').value),
        tva: C.lireNombre($('#ar-tva').value),
      });
      if (a) {
        viderFormArticle();
        toast('Article enregistré.', 'succes');
      }
    },
    'article-vider': viderFormArticle,
    'article-ajouter'(b) {
      const a = etat.articles.find((x) => x.id === b.dataset.id);
      if (!a) return;
      doc.lignes.push(ligneDepuisArticle(a));
      rendreLignes();
      changement();
      montrerOnglet('document');
    },
    'article-modifier'(b) {
      const a = etat.articles.find((x) => x.id === b.dataset.id);
      if (!a) return;
      $('#ar-id').value = a.id;
      $('#ar-ref').value = a.ref || '';
      $('#ar-titre').value = a.titre || '';
      $('#ar-description').value = a.description || '';
      $('#ar-prix').value = saisieNombre(a.prixHT);
      $('#ar-tva').innerHTML = optionsTva(a.tva);
      $('#titre-form-article').textContent = `Modifier l'article ${a.ref || a.titre}`;
      $('#ar-titre').focus();
    },
    'article-supprimer'(b) {
      const a = etat.articles.find((x) => x.id === b.dataset.id);
      if (!a || !window.confirm(`Supprimer l'article « ${a.titre || a.ref} » du catalogue ?`)) return;
      etat.articles = etat.articles.filter((x) => x.id !== a.id);
      persister();
      majChoixArticle();
      rendreArticles();
    },

    // --- historique
    'doc-ouvrir'(b) {
      const d = etat.documents.find((x) => x.id === b.dataset.id);
      if (!d || !confirmerAbandon()) return;
      ouvrir(d, false);
      montrerOnglet('document');
    },
    'doc-dupliquer'(b) {
      const d = etat.documents.find((x) => x.id === b.dataset.id);
      if (!d || !confirmerAbandon()) return;
      ouvrir(copierDocument(d), true);
      montrerOnglet('document');
    },
    'doc-supprimer'(b) {
      const d = etat.documents.find((x) => x.id === b.dataset.id);
      if (!d) return;
      const t = (R.TYPES[d.type] || {}).libelle;
      if (!window.confirm(`Supprimer définitivement « ${t} ${d.numero} » ?`)) return;
      etat.documents = etat.documents.filter((x) => x.id !== d.id);
      persister();
      rendreDocuments();
      if (doc && doc.id === d.id) marquerModifie(true);
    },
    exporter() {
      telecharger(`facturation-sauvegarde-${aujourdhui()}.json`, S.exporter(etat), 'application/json');
    },
    importer() {
      $('#fichier-import').click();
    },

    // --- paramètres
    'image-supprimer'(b) {
      etat.parametres.societe[b.dataset.image] = '';
      persister();
      rendreParametres();
      planifierApercu();
    },
    'charger-exemple'() {
      if (!confirmerAbandon()) return;
      chargerExemple();
    },
    reinitialiser() {
      if (!window.confirm('Effacer TOUTES les données (société, clients, catalogue, documents) ? Pensez à exporter une sauvegarde avant.')) return;
      etat = S.etatInitial();
      persister();
      modifie = false;
      ouvrir(nouveauDocument('proforma'), false);
      rendreParametres();
      rendreClients();
      rendreArticles();
      rendreDocuments();
      toast('Toutes les données ont été effacées.');
    },
  };

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b || b.disabled) return;
    const action = ACTIONS[b.dataset.action];
    if (action) {
      e.preventDefault();
      action(b);
    }
  });

  $('#fichier-import').addEventListener('change', (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    f.text().then((texte) => {
      const nouvel = S.importer(texte);
      const n = nouvel.documents.length;
      if (!window.confirm(`Remplacer toutes les données actuelles par la sauvegarde (${n} document${n > 1 ? 's' : ''}, ${nouvel.clients.length} client(s)) ?`)) return;
      etat = nouvel;
      persister();
      modifie = false;
      ouvrir(etat.documents[0] ? etat.documents[0] : nouveauDocument('proforma'), false);
      rendreParametres();
      rendreDocuments();
      toast('Sauvegarde importée.', 'succes');
    }).catch(() => toast('Fichier de sauvegarde illisible.', 'erreur'));
  });

  ['clients', 'articles', 'documents'].forEach((k) => {
    $(`#filtre-${k}`).addEventListener('input', () => ({ clients: rendreClients, articles: rendreArticles, documents: rendreDocuments })[k]());
  });
  $$('[data-mf]').forEach((el) => el.addEventListener('input', () => verifierMF(el)));

  // ======================================================================
  // Onglets
  // ======================================================================
  function montrerOnglet(nom) {
    $$('.onglets button').forEach((b) => b.classList.toggle('actif', b.dataset.onglet === nom));
    $$('.panneau').forEach((p) => p.classList.toggle('actif', p.id === `onglet-${nom}`));
    if (nom === 'clients') rendreClients();
    if (nom === 'catalogue') rendreArticles();
    if (nom === 'historique') rendreDocuments();
    if (nom === 'parametres') rendreParametres();
  }
  $$('.onglets button').forEach((b) => b.addEventListener('click', () => montrerOnglet(b.dataset.onglet)));

  // ======================================================================
  // Impression, raccourcis, fermeture
  // ======================================================================
  let titreAvantImpression = document.title;
  window.addEventListener('beforeprint', () => {
    titreAvantImpression = document.title;
    document.title = R.nomFichier(doc); // nom proposé pour le PDF
  });
  window.addEventListener('afterprint', () => { document.title = titreAvantImpression; });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      enregistrer();
    }
  });
  window.addEventListener('beforeunload', () => {
    if (!modifie) return;
    clearTimeout(minuterieBrouillon);
    etat.brouillon = { doc, modifie };
    persister();
  });
  if (window.ResizeObserver) new ResizeObserver(ajusterEchelle).observe($('#zone-apercu'));
  else window.addEventListener('resize', ajusterEchelle);

  // ======================================================================
  // Démarrage
  // ======================================================================
  if (!stockageOk) $('#alerte-stockage').hidden = false;
  viderFormArticle();
  if (premierLancement) {
    chargerExemple();
  } else if (etat.brouillon && etat.brouillon.doc) {
    ouvrir(etat.brouillon.doc, !!etat.brouillon.modifie);
  } else {
    ouvrir(nouveauDocument('proforma'), false);
  }
  rendreParametres();
})();
