# Analyse de la facture proforma n° 260019/26

## 1. Nature du document

| Élément | Constat |
|---|---|
| Type | **Facture proforma** : offre de prix chiffrée envoyée avant la vente. Elle n'a pas de valeur comptable et n'oblige pas au paiement. Elle sert de base à la commande (ou à un financement, une ouverture de crédit…). |
| Émetteur | Société de services informatiques (Ariana), assujettie à la TVA |
| Objet | Vente d'un logiciel de **gestion commerciale intégrée** (ventes, achats, stock, statistiques) avec mise en place, formation et accompagnement |
| Outil utilisé | Microsoft Word 2013 (métadonnées du PDF) : document **saisi à la main**, sans calcul ni numérotation automatiques |
| Format | A4 portrait, une page, police Times New Roman |

## 2. Structure : les 8 zones du document

| # | Zone | Contenu | Position / mise en forme |
|---|---|---|---|
| 1 | En-tête émetteur | Raison sociale (gras), adresse, matricule fiscal (« TVA… »), téléphone, registre de commerce (RC) | Haut gauche |
| 2 | Cadre client | Code, Nom, Adresse, Code TVA (matricule fiscal du client) | Haut droite, encadré |
| 3 | Titre | « FACTURE PROFORMA » | Bandeau pleine largeur, fond gris clair |
| 4 | Références | Numéro, Date (JJ-MM-AAAA), Bon de livraison | 3 cases sous le titre, en gras |
| 5 | Corps | Colonnes **Désignation / Prix HT / TVA / Total HT** | En-tête gris ; colonnes prolongées jusqu'à ~213 mm du haut de la page |
| 6 | Note « NB » | Ce que comprend l'offre (programmes, formation, encadrement au démarrage) | Sous le tableau, à gauche |
| 7 | Totaux | Total HT, Total TVA | Sous le tableau, à droite ; libellés sur fond gris |
| 8 | Validation | Cachet rond et signature | En bas à droite |

La **désignation** est hiérarchisée sur 3 niveaux :
titre du produit **souligné** → sections numérotées **en gras** (« 1) : Ventes », « 2) : Achats et stocks »…) → fonctionnalités **en retrait**.

## 3. Données et règles de calcul

| Donnée | Valeur | Règle |
|---|---|---|
| Monnaie | Dinar tunisien (DT) | **3 décimales** (millimes), espace entre les milliers, virgule décimale : `1 500,000` |
| Quantité | 1 (implicite) | Pas de colonne quantité : Total HT = Prix HT |
| Prix HT | 1 500,000 | — |
| Taux de TVA | 7 % (affiché `07%`) | Taux sur 2 chiffres |
| Total HT | 1 500,000 | Σ (quantité × prix unitaire HT − remise) |
| Total TVA | 105,000 | 1 500,000 × 7 % |
| **Total TTC** | **1 605,000** (absent du document) | Total HT + TVA (+ timbre fiscal sur une facture définitive) |
| Numéro | 260019/26 | Probablement **AA + compteur sur 4 chiffres + /AA** : 19ᵉ proforma de 2026 |
| Code client | 9999 | Code générique, souvent réservé au client « divers / passager » dans les logiciels de gestion. C'est cohérent avec le Code TVA vide (particulier). |
| Matricule fiscal | `NNNNNNN/X/A/M/000` | 7 chiffres / clé / code TVA / catégorie / n° d'établissement secondaire |

## 4. Anomalies relevées

### Mentions absentes
1. **Total TTC (net à payer) absent** : le client ne voit pas la somme réellement due (1 605,000 DT).
2. **Montant en toutes lettres absent**. En Tunisie, l'usage est d'écrire : « Arrêtée la présente facture proforma à la somme de : Mille six cent cinq dinars ».
3. Ni **durée de validité** de l'offre, ni **conditions de paiement** (acompte, échéances), ni **délai** de mise en place.
4. Pas de **colonne quantité** (nombre de postes ou de licences).
5. Pas de **RIB** pour un éventuel acompte.
6. Pas de **timbre fiscal**. C'est normal sur une proforma, mais il devra figurer sur la facture définitive (montant fixé par la loi de finances).

### Fautes de saisie
| Sur le document | Correction |
|---|---|
| Gestion Commerciale Integrée | Intégrée |
| Echenacier client | Échéancier client |
| Factures non Apurees | non apurées |
| Gestion des impayes | impayés |
| Gestion des bons de reception | réception |
| Gestion avoirs fournisseur / Suivi des fournisseur | des avoirs fournisseurs / des fournisseurs |
| Gestion des entrees et des Sorties | entrées et des sorties |
| Mouvement détailleé du produit (…, numéro piece) | détaillé, numéro de pièce |
| Banque , Date échéance | Banque, date d'échéance |

### Mise en forme
- « TVA1234567/… » (forme imprimée) : le libellé est collé au numéro. Il faut écrire « TVA : … » ou « MF : … ».
- Indentation irrégulière (« Transfert comptable » est décalé par rapport aux autres lignes).
- Les montants sont alignés sur la 2ᵉ ligne de la désignation au lieu de la première.

Ces défauts viennent tous de la **saisie manuelle sous Word**. Un logiciel dédié les élimine.

## 5. Réponse : ce que le logiciel automatise

| Problème constaté | Solution dans le logiciel |
|---|---|
| Calculs faits à la main | Totaux HT, TVA par taux, timbre et TTC calculés en **millimes entiers** (aucune erreur d'arrondi) |
| TTC et montant en lettres absents | Ajoutés automatiquement (options désactivables pour une reproduction à l'identique) |
| Numérotation manuelle | Compteur par type de document et par année, modèle paramétrable `{AA}{N:4}/{AA}` → 260019/26 |
| Ressaisie du client et du produit | Fichier clients et catalogue d'articles réutilisables |
| Proforma puis facture ressaisie | Bouton **« Convertir en facture »** (nouveau numéro de facture, timbre fiscal ajouté) |
| Matricule fiscal mal formé | Contrôle du format à la saisie |
| Mise en page fragile | Gabarit A4 fixe reproduisant le modèle, export PDF par l'impression du navigateur |
| Fautes de frappe | Descriptions enregistrées une fois (corrigées) dans le catalogue |
| Cachet ajouté à la main | Image du cachet importée une fois, placée automatiquement |

## 6. Modèle de données retenu

```
Société     : nom, adresse, matricule fiscal, RC, téléphone, email, RIB, logo, cachet
Client      : code, nom, adresse, matricule fiscal, téléphone
Article     : référence, titre, description, prix HT, taux TVA
Document    : type (proforma | facture | devis), numéro, date, bon de livraison,
              client (copie figée), lignes[], note NB, options d'affichage
Ligne       : titre, description, quantité, prix unitaire HT, remise %, taux TVA
Compteurs   : dernier numéro par type et par année (ex. proforma-2026 = 19)
```

Le client est **copié** dans le document au moment de la saisie. Ainsi, modifier plus tard la fiche du client ne change pas une facture déjà émise.
