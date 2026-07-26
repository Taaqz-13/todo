/* Copie les fichiers partages entre la web app et l'extension Chrome.
   A relancer apres toute modification de js/nlp.js : node tools/sync-shared.js */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAIRS = [
  ['js/nlp.js', 'extension/vendor/nlp.js']
];

let changed = 0;
PAIRS.forEach(function (pair) {
  const src = path.join(ROOT, pair[0]);
  const dst = path.join(ROOT, pair[1]);
  const a = fs.readFileSync(src);
  const b = fs.existsSync(dst) ? fs.readFileSync(dst) : null;
  if (b && a.equals(b)) {
    console.log('inchange  ' + pair[1]);
    return;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, a);
  console.log('copie     ' + pair[0] + ' -> ' + pair[1]);
  changed++;
});
console.log(changed ? changed + ' fichier(s) mis a jour' : 'tout est deja synchronise');
