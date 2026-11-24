/*
 * Assemble index.html + css/ + js/ en un seul fichier :
 *   dist/facturier.html   version autonome (double-clic, à envoyer par e-mail)
 *   dist/page-claude.html contenu de page pour une publication Claude (sans squelette HTML)
 * Usage : node outils/construire.js
 */
const fs = require('fs');
const path = require('path');

const racine = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(racine, f), 'utf8');
let html = lire('index.html');

html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, f) => `<style>\n${lire(f)}</style>`);
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, f) =>
  `<script>\n${lire(f).replace(/<\/script/gi, '<\\/script')}</script>`);

fs.mkdirSync(path.join(racine, 'dist'), { recursive: true });
fs.writeFileSync(path.join(racine, 'dist/facturier.html'), html);

// Page Claude : le squelette (doctype, html, head, body, meta) est ajouté à la publication
let page = html
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<html[^>]*>\s*/i, '')
  .replace(/<\/html>\s*$/i, '')
  .replace(/<head>\s*/i, '')
  .replace(/<\/head>\s*/i, '')
  .replace(/<body>\s*/i, '')
  .replace(/<\/body>\s*/i, '')
  .replace(/\s*<meta charset="utf-8">/i, '')
  .replace(/\s*<meta name="viewport"[^>]*>/i, '');
fs.writeFileSync(path.join(racine, 'dist/page-claude.html'), page.trim() + '\n');

for (const f of ['dist/facturier.html', 'dist/page-claude.html']) {
  console.log(`${f} : ${(fs.statSync(path.join(racine, f)).size / 1024).toFixed(0)} Ko`);
}
