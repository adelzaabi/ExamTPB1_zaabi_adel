// Tests : node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/calculs');
const ML = require('../js/montant-lettres');
const R = require('../js/rendu');
const S = require('../js/stockage');
const EX = require('../js/exemple');

const NBSP = ' ';

test('format des montants à la tunisienne (3 décimales, espace des milliers)', () => {
  assert.equal(C.formatMontant(1500), `1${NBSP}500,000`);
  assert.equal(C.formatMontant(105), '105,000');
  assert.equal(C.formatMontant(1234567.891), `1${NBSP}234${NBSP}567,891`);
  assert.equal(C.formatMontant(0), '0,000');
  assert.equal(C.formatMontant(-12.5), '-12,500');
  assert.equal(C.formatMontant(0.0004), '0,000');
});

test('lecture des nombres saisis', () => {
  assert.equal(C.lireNombre('1 500,250'), 1500.25);
  assert.equal(C.lireNombre('1.500,25'), 1500.25);
  assert.equal(C.lireNombre('7%'), 7);
  assert.equal(C.lireNombre(''), 0);
  assert.equal(C.lireNombre('abc'), 0);
  assert.equal(C.lireNombre(12), 12);
});

test('taux, dates, quantités', () => {
  assert.equal(C.formatTaux(7), '07%');
  assert.equal(C.formatTaux(19), '19%');
  assert.equal(C.formatTaux(0), '00%');
  assert.equal(C.formatDate('2026-10-14'), '14-10-2026');
  assert.equal(C.formatQuantite(2.5), '2,5');
  assert.equal(C.formatQuantite(1), '1');
});

test('numérotation : le modèle {AA}{N:4}/{AA} redonne 260019/26', () => {
  assert.equal(C.formaterNumero('{AA}{N:4}/{AA}', 19, '2026-10-14'), '260019/26');
  assert.equal(C.formaterNumero('FA-{AAAA}-{MM}-{N:3}', 7, '2027-01-05'), 'FA-2027-01-007');
  assert.equal(C.formaterNumero('{N}', 12, '2026-01-01'), '12');
});

test('totaux de la facture analysée : HT 1 500,000 / TVA 7 % 105,000 / TTC 1 605,000', () => {
  const t = C.calculerTotaux([{ qte: 1, prixHT: 1500, tva: 7 }]);
  assert.equal(t.totalHT, 1500);
  assert.equal(t.totalTVA, 105);
  assert.equal(t.totalTTC, 1605);
  assert.deepEqual(t.recapTva, [{ taux: 7, base: 1500, montant: 105 }]);
});

test('totaux : plusieurs taux, remise, quantité décimale et timbre', () => {
  const t = C.calculerTotaux([
    { qte: 2, prixHT: '100,500', tva: 19, remise: 10 }, // 201,000 - 20,100 = 180,900
    { qte: 2.5, prixHT: 40, tva: 7 }, // 100,000
    { prixHT: 10, tva: 0 }, // qté absente = 1
  ], { timbre: 1 });
  assert.equal(t.lignes[0].totalHT, 180.9);
  assert.equal(t.totalHT, 290.9);
  assert.deepEqual(t.recapTva.map((r) => [r.taux, r.montant]), [[0, 0], [7, 7], [19, 34.371]]);
  assert.equal(t.totalTVA, 41.371);
  assert.equal(t.timbre, 1);
  assert.equal(t.totalTTC, 333.271);
});

test('pas d’erreur d’arrondi flottant (calcul en millimes)', () => {
  const t = C.calculerTotaux([{ qte: 3, prixHT: 0.1, tva: 19 }, { qte: 1, prixHT: 0.2, tva: 19 }]);
  assert.equal(t.totalHT, 0.5);
  assert.equal(t.totalTVA, 0.095);
  assert.equal(t.totalTTC, 0.595);
});

test('matricule fiscal', () => {
  assert.deepEqual(C.validerMF('1234567/A/A/M/000'), { valide: true, normalise: '1234567/A/A/M/000' });
  assert.equal(C.validerMF('TVA1234567/A/A/M/000').valide, true); // forme imprimée sur la facture
  assert.equal(C.validerMF('1234567AAM000').normalise, '1234567/A/A/M/000');
  assert.equal(C.validerMF('').valide, true); // client particulier : champ vide accepté
  assert.equal(C.validerMF('12345/L/A/M/000').valide, false);
  assert.equal(C.validerMF('1234567/A/Z/M/000').valide, false);
});

test('nombres en lettres (règles d’accord)', () => {
  const cas = {
    0: 'zéro', 1: 'un', 16: 'seize', 17: 'dix-sept', 21: 'vingt et un', 22: 'vingt-deux',
    71: 'soixante et onze', 72: 'soixante-douze', 80: 'quatre-vingts', 81: 'quatre-vingt-un',
    91: 'quatre-vingt-onze', 99: 'quatre-vingt-dix-neuf', 100: 'cent', 101: 'cent un',
    200: 'deux cents', 201: 'deux cent un', 280: 'deux cent quatre-vingts', 1000: 'mille',
    1605: 'mille six cent cinq', 2000: 'deux mille', 21000: 'vingt et un mille',
    80000: 'quatre-vingt mille', 200000: 'deux cent mille', 1000000: 'un million',
    2000000: 'deux millions', 80000000: 'quatre-vingts millions', 200000000: 'deux cents millions',
    1000000000: 'un milliard', 1234567: 'un million deux cent trente-quatre mille cinq cent soixante-sept',
  };
  for (const [n, attendu] of Object.entries(cas)) assert.equal(ML.nombreEnLettres(Number(n)), attendu, `n = ${n}`);
});

test('montants en lettres (dinars et millimes)', () => {
  assert.equal(ML.montantEnLettres(1605), 'Mille six cent cinq dinars');
  assert.equal(ML.montantEnLettres(1500), 'Mille cinq cents dinars');
  assert.equal(ML.montantEnLettres(1), 'Un dinar');
  assert.equal(ML.montantEnLettres(12.5), 'Douze dinars et cinq cents millimes');
  assert.equal(ML.montantEnLettres(0.001), 'Un millime');
  assert.equal(ML.montantEnLettres(0), 'Zéro dinar');
  assert.equal(ML.montantEnLettres(2000000), 'Deux millions de dinars');
  assert.equal(ML.montantEnLettres(333.271), 'Trois cent trente-trois dinars et deux cent soixante et onze millimes');
});

test('rendu : la proforma d’exemple contient les zones de la facture d’origine', () => {
  const param = Object.assign(S.etatInitial().parametres, { societe: Object.assign({}, EX.societe) });
  const doc = Object.assign({ numero: '260019/26' }, JSON.parse(JSON.stringify(EX.document)));
  const html = R.rendreDocument(doc, param);
  for (const attendu of [
    'SOCIÉTÉ EXEMPLE INFORMATIQUE', 'TVA : 1234567/A/A/M/000', 'RC : B000000000', 'CLIENT EXEMPLE', 'FACTURE PROFORMA',
    'Numéro : 260019/26', 'Date :14-10-2026', 'Bon de livraison :', '<div class="d-titre">Gestion Commerciale Intégrée</div>',
    '<div class="d-section">1) : Ventes</div>', `1${NBSP}500,000`, '07%', '105,000', 'Total TTC', `1${NBSP}605,000`,
    'Arrêtée la présente facture proforma à la somme de : <strong>Mille six cent cinq dinars</strong>',
    'cette offre comporte',
  ]) assert.ok(html.includes(attendu), `absent du rendu : ${attendu}`);
});

test('rendu : options d’affichage et échappement HTML', () => {
  const param = S.etatInitial().parametres;
  const doc = {
    type: 'facture', numero: '<b>1</b>', date: '2026-11-24', client: { nom: '<script>alert(1)</script>' },
    lignes: [{ titre: 'A & B', description: '', qte: 2, prixHT: 10, remise: 0, tva: 19 }],
    options: { qte: true, ttc: true, timbre: true, lettres: false },
  };
  const html = R.rendreDocument(doc, param);
  assert.ok(!html.includes('<script>alert'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('A &amp; B'));
  assert.ok(html.includes('<th class="gris">Qté</th>'));
  assert.ok(html.includes('Timbre fiscal'));
  assert.ok(html.includes('Net à payer TTC'));
  assert.ok(html.includes('24,800')); // 20 + 3,800 TVA + 1,000 timbre
  assert.ok(!html.includes('à la somme de'));
});

test('stockage : normalisation d’une ancienne sauvegarde incomplète', () => {
  const e = S.normaliser({ parametres: { societe: { nom: 'X' } }, documents: [{ id: 'a' }, null] });
  assert.equal(e.parametres.societe.nom, 'X');
  assert.equal(e.parametres.modeles.facture, '{AA}{N:4}/{AA}');
  assert.equal(e.documents.length, 1);
  assert.throws(() => S.importer('[]'));
});
