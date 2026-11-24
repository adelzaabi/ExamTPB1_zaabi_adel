# Facturation : proformas, devis et factures (format tunisien)

Ce logiciel produit des factures proforma, des devis et des factures au même format que la proforma n° 260019/26 analysée dans [ANALYSE.md](ANALYSE.md). Il calcule tout automatiquement : TVA, timbre, TTC, montant en lettres et numérotation.

- **Aucune installation** : HTML, CSS et JavaScript sans dépendance. Il fonctionne hors ligne.
- **Les données restent sur le poste** (stockage du navigateur), avec une sauvegarde et une restauration en fichier JSON.
- **Export PDF** par la fonction d'impression du navigateur, au format A4.

## Lancer le logiciel

Double-cliquez sur `index.html` (Chrome, Edge ou Firefox récents).

Au premier lancement, un exemple est chargé : la proforma 260019/26 (logiciel de gestion commerciale, 1 500,000 HT, TVA 7 %). L'identité de la société et du client y est fictive : saisissez la vôtre dans **Paramètres**.

## Utilisation

1. **Paramètres** : raison sociale, adresse, matricule fiscal, RC, téléphone, logo et **cachet** (une image PNG à fond transparent donne le meilleur rendu). Réglez aussi les modèles de numérotation et le dernier numéro déjà utilisé.
2. **Nouveau** : choisissez *Facture proforma*, *Facture* ou *Devis*. Le numéro est attribué automatiquement.
3. **Client** : choisissez un client enregistré, ou saisissez-le puis « Enregistrer ce client dans la liste ».
4. **Lignes** : ajoutez une ligne vide ou un article du catalogue. Le bouton ★ enregistre une ligne dans le catalogue.
5. **Enregistrer** (ou Ctrl+S), puis **Imprimer / PDF**. Dans la fenêtre d'impression, choisissez « Enregistrer au format PDF », marges *par défaut* et « Graphiques d'arrière-plan » cochés.
6. Une fois la proforma acceptée : **Convertir en facture**. La facture reçoit son propre numéro et le timbre fiscal.

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

Colonnes quantité et remise, total TTC, montant en lettres, timbre fiscal, cachet. Si vous décochez *Total TTC* et *Montant en lettres*, vous obtenez une reproduction à l'identique du modèle d'origine.

## Sauvegarde

Les données sont stockées dans le navigateur utilisé. Elles disparaissent si vous effacez les données de navigation, et ne sont pas partagées entre plusieurs ordinateurs. Pensez à faire régulièrement **Historique → Exporter une sauvegarde**. L'import permet de restaurer ces données ou de les transférer sur un autre poste.

## Fiscalité

Les taux de TVA proposés (0, 7, 13, 19 %) et le timbre fiscal (1,000 DT par défaut, appliqué seulement aux factures) se modifient dans les Paramètres. Faites vérifier les valeurs en vigueur par votre comptable : elles changent avec les lois de finances.

## Structure du code

```
index.html            interface (formulaire à gauche, aperçu A4 à droite)
css/app.css           styles de l'interface
css/facture.css       gabarit A4 du document (cotes relevées sur l'original), règles d'impression
js/calculs.js         montants en millimes, totaux, formats, numérotation, contrôle du matricule fiscal
js/montant-lettres.js montants en toutes lettres (dinars / millimes, règles d'accord)
js/rendu.js           génération du document HTML, ajustement de la hauteur du tableau
js/stockage.js        enregistrement local, export / import JSON
js/exemple.js         données de l'exemple
js/app.js             logique de l'interface
tests/                tests unitaires (Node.js)
ANALYSE.md            analyse de la facture d'origine
```

## Tests

```bash
npm test        # ou : node --test tests/*.test.js   (Node.js 18 ou plus)
```

Les tests couvrent les formats de montant, les totaux multi-taux avec remise et timbre, l'absence d'erreur d'arrondi, la numérotation, le matricule fiscal, les montants en lettres (accords de vingt, cent, mille, million), le rendu du document et l'échappement HTML.
