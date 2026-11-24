# Facturier : proformas, devis et factures (format tunisien)

Ce logiciel produit des factures proforma, des devis et des factures au même format que la proforma n° 260019/26 analysée dans [ANALYSE.md](ANALYSE.md). Il calcule tout automatiquement : TVA, timbre, TTC, montant en lettres et numérotation. Il génère ensuite un **PDF** prêt à envoyer.

- **Aucune installation** : un seul fichier, `dist/facturier.html`, à ouvrir d'un double-clic (Chrome, Edge ou Firefox).
- **Les données restent sur le poste** (stockage du navigateur), avec une sauvegarde et une restauration en fichier JSON.
- **PDF vectoriel A4** (texte net et sélectionnable, environ 6 Ko). Une connexion Internet est nécessaire au premier chargement du module PDF ; hors ligne, le bouton « Imprimer » reste disponible.

## Démarrer en 3 étapes

1. **Ma société** : saisissez la raison sociale, l'adresse, le matricule fiscal, le RC et le téléphone. Importez le **cachet** (une image PNG à fond transparent donne le meilleur rendu). C'est à faire une seule fois.
2. **Document** : choisissez le client et ajoutez les lignes. Les totaux se calculent seuls.
3. **Télécharger le PDF** : le document est numéroté, enregistré et téléchargé.

Une fois la proforma acceptée, **Convertir en facture** crée la facture avec son propre numéro et le timbre fiscal.

Au premier lancement, un exemple est chargé : la proforma 260019/26 (logiciel de gestion commerciale, 1 500,000 HT, TVA 7 %). L'identité de la société et du client y est fictive.

### Saisie de la désignation

```
Titre :        Gestion Commerciale Intégrée        → souligné
Description :  # 1) : Ventes                        → sous-titre en gras
               Gestion des ventes : devis, …        → élément en retrait
               Suivi des clients
               # 2) : Achats et stocks
               …
```

### Numérotation

| Jeton | Sens | Exemple (19ᵉ document, 14/10/2026) |
|---|---|---|
| `{AAAA}` | année | 2026 |
| `{AA}` | année sur 2 chiffres | 26 |
| `{MM}` | mois | 10 |
| `{N:4}` | compteur sur 4 chiffres | 0019 |

Le modèle par défaut `{AA}{N:4}/{AA}` donne **260019/26**. Chaque type de document a son propre compteur, remis à zéro chaque année. Le numéro est figé à l'enregistrement, et le logiciel signale tout doublon.

### Options d'affichage (par document)

Colonnes quantité et remise, total TTC, montant en lettres, timbre fiscal, cachet. Si vous décochez *Total TTC* et *Montant en lettres*, vous obtenez une reproduction à l'identique du modèle d'origine. La colonne quantité s'affiche d'elle-même dès qu'une ligne a une quantité différente de 1.

## Sauvegarde

Ouvert depuis un fichier, le logiciel enregistre les données dans le navigateur utilisé. Publié comme page Claude, il les enregistre dans l'espace privé du compte de chaque utilisateur. Elles disparaissent si vous effacez les données de navigation, et ne sont pas partagées entre plusieurs ordinateurs. Pensez à faire régulièrement **Historique → Exporter une sauvegarde**. L'import permet de restaurer ces données ou de les transférer sur un autre poste.

## Fiscalité

Les taux de TVA proposés (0, 7, 13, 19 %) et le timbre fiscal (1,000 DT par défaut, appliqué seulement aux factures) se modifient dans les Paramètres. Faites vérifier les valeurs en vigueur par votre comptable : elles changent avec les lois de finances.

## Structure du code

```
dist/facturier.html   version en un seul fichier (générée par npm run construire)
index.html            interface (formulaire à gauche, aperçu A4 à droite)
css/app.css           styles de l'interface
css/facture.css       gabarit A4 du document (cotes relevées sur l'original), règles d'impression
js/calculs.js         montants en millimes, totaux, formats, numérotation, contrôle du matricule fiscal
js/montant-lettres.js montants en toutes lettres (dinars / millimes, règles d'accord)
js/rendu.js           génération du document HTML, ajustement de la hauteur du tableau
js/stockage.js        état initial, export / import JSON
js/persistance.js     choix du stockage : compte Claude, navigateur ou mémoire
js/pdf.js             PDF vectoriel A4 (jsPDF) reprenant les cotes du gabarit
js/exemple.js         données de l'exemple
js/app.js             logique de l'interface
outils/construire.js  assemble le fichier unique dist/facturier.html
tests/                tests unitaires (Node.js)
ANALYSE.md            analyse de la facture d'origine
```

## Tests

```bash
npm test             # tests unitaires (Node.js 18 ou plus)
npm run construire   # régénère dist/facturier.html après une modification
```

Les tests couvrent les formats de montant, les totaux multi-taux avec remise et timbre, l'absence d'erreur d'arrondi, la numérotation, le matricule fiscal, les montants en lettres (accords de vingt, cent, mille, million), le rendu du document et l'échappement HTML.
