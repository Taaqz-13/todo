/* Verifie que l'extension est chargeable par Chrome AVANT d'aller cliquer dans
   chrome://extensions. Attrape les erreurs qui font echouer l'installation sans
   message clair. Lancer : node tools/check-extension.js */
const fs = require('fs');
const path = require('path');

const EXT = path.join(__dirname, '..', 'extension');
const errors = [];
const warns = [];
let checks = 0;

function check(cond, msg) {
  checks++;
  if (!cond) errors.push(msg);
}
function exists(rel) { return fs.existsSync(path.join(EXT, rel)); }
function read(rel) { return fs.readFileSync(path.join(EXT, rel), 'utf8'); }

/* ---------- manifest ---------- */
let m = null;
try {
  m = JSON.parse(read('manifest.json'));
} catch (e) {
  errors.push('manifest.json illisible : ' + e.message);
}

if (m) {
  check(m.manifest_version === 3, 'manifest_version doit valoir 3');
  check(typeof m.name === 'string' && m.name.length > 0 && m.name.length <= 75, 'name absent ou trop long');
  check(/^\d+(\.\d+){0,3}$/.test(String(m.version)), 'version invalide (chiffres separes par des points)');
  check(!m.description || m.description.length <= 132, 'description : 132 caracteres maximum (' + ((m.description || '').length) + ')');

  /* piege classique : default_locale sans arborescence _locales = refus de chargement */
  if (m.default_locale) {
    check(exists(path.join('_locales', m.default_locale, 'messages.json')),
      'default_locale="' + m.default_locale + '" declare mais _locales/' + m.default_locale + '/messages.json est absent : Chrome refusera l extension');
  } else {
    check(!exists('_locales'), 'dossier _locales present mais default_locale absent du manifest');
  }

  /* service worker */
  if (m.background) {
    check(!!m.background.service_worker, 'en MV3, background doit utiliser service_worker');
    check(!m.background.scripts, 'background.scripts est du MV2, interdit en MV3');
    if (m.background.service_worker) {
      check(exists(m.background.service_worker), 'service worker introuvable : ' + m.background.service_worker);
      if (exists(m.background.service_worker)) {
        const sw = read(m.background.service_worker);
        const imp = sw.match(/importScripts\(([^)]*)\)/);
        if (imp) {
          imp[1].split(',').forEach(function (raw) {
            const f = raw.trim().replace(/^['"]|['"]$/g, '');
            if (f) check(exists(f), 'importScripts pointe vers un fichier absent : ' + f);
          });
        }
        check(!/\bdocument\b/.test(sw.replace(/\/\*[\s\S]*?\*\//g, '')),
          'le service worker ne doit pas utiliser document (pas de DOM dans un worker)');
        check(!/localStorage/.test(sw), 'localStorage est indisponible dans un service worker : utiliser chrome.storage');
      }
    }
  }

  /* action + popup */
  if (m.action) {
    if (m.action.default_popup) {
      check(exists(m.action.default_popup), 'popup introuvable : ' + m.action.default_popup);
      if (exists(m.action.default_popup)) {
        const html = read(m.action.default_popup);
        const scripts = html.match(/<script\b[^>]*>/gi) || [];
        scripts.forEach(function (tag) {
          check(/\bsrc=/.test(tag), 'script inline interdit par la CSP des extensions : ' + tag.slice(0, 60));
          const src = (tag.match(/src=["']([^"']+)["']/) || [])[1];
          if (src) {
            check(!/^https?:/.test(src), 'script distant interdit en MV3 : ' + src);
            check(exists(src), 'script du popup introuvable : ' + src);
          }
        });
        (html.match(/<link\b[^>]*href=["']([^"']+)["']/gi) || []).forEach(function (tag) {
          const href = (tag.match(/href=["']([^"']+)["']/) || [])[1];
          if (href && !/^https?:/.test(href)) check(exists(href), 'feuille de style introuvable : ' + href);
        });
        check(!/\son\w+=/.test(html), 'attribut evenement inline (onclick=...) interdit par la CSP');
      }
    }
    Object.keys(m.action.default_icon || {}).forEach(function (size) {
      check(exists(m.action.default_icon[size]), 'icone d action introuvable : ' + m.action.default_icon[size]);
    });
  }

  Object.keys(m.icons || {}).forEach(function (size) {
    check(exists(m.icons[size]), 'icone introuvable : ' + m.icons[size]);
  });
  check(!!(m.icons && m.icons['128']), 'une icone 128x128 est attendue');

  /* permissions */
  const KNOWN = ['storage', 'contextMenus', 'alarms', 'activeTab', 'tabs', 'notifications', 'scripting',
    'clipboardWrite', 'clipboardRead', 'idle', 'downloads', 'cookies', 'webRequest', 'unlimitedStorage', 'offscreen'];
  (m.permissions || []).forEach(function (p) {
    check(KNOWN.indexOf(p) >= 0, 'permission inconnue ou risquee : ' + p);
    check(!/^https?:\/\//.test(p), 'les URL vont dans host_permissions, pas dans permissions : ' + p);
  });
  (m.host_permissions || []).forEach(function (h) {
    check(/^(https?|wss?):\/\//.test(h) || h === '<all_urls>', 'host_permission mal formee : ' + h);
    if (h === '<all_urls>' || /^\*:\/\/\*\//.test(h)) warns.push('host_permission tres large : ' + h);
  });

  /* commands */
  Object.keys(m.commands || {}).forEach(function (name) {
    const c = m.commands[name];
    check(!!c.description || name === '_execute_action', 'commande sans description : ' + name);
    const key = c.suggested_key && (c.suggested_key.default || c.suggested_key.windows);
    if (key) {
      check(/^(Ctrl|Alt|Command|MacCtrl|Ctrl\+Shift|Alt\+Shift|Command\+Shift)\+[A-Z0-9]$/.test(key) ||
        /^(Ctrl|Alt|Command)\+(Shift\+)?[A-Z0-9]$/.test(key),
        'raccourci mal forme : ' + key);
      check(['Ctrl+T', 'Ctrl+N', 'Ctrl+W', 'Ctrl+Shift+T', 'Ctrl+Shift+N', 'Ctrl+Shift+W', 'Ctrl+Shift+Q'].indexOf(key) < 0,
        'raccourci reserve par Chrome : ' + key);
    }
  });
}

/* ---------- coherence avec la web app ---------- */
const shared = [['js/nlp.js', 'extension/vendor/nlp.js']];
shared.forEach(function (pair) {
  checks++;
  const a = fs.readFileSync(path.join(__dirname, '..', pair[0]));
  const b = fs.existsSync(path.join(__dirname, '..', pair[1])) ? fs.readFileSync(path.join(__dirname, '..', pair[1])) : null;
  if (!b || !a.equals(b)) errors.push('copie partagee desynchronisee : ' + pair[1] + ' (lancer node tools/sync-shared.js)');
});

/* ---------- rapport ---------- */
warns.forEach(function (w) { console.log('AVERTISSEMENT : ' + w); });
if (errors.length) {
  console.log('\nECHEC : ' + errors.length + ' probleme(s) bloquant(s) sur ' + checks + ' verifications\n');
  errors.forEach(function (e) { console.log('  - ' + e); });
  process.exit(1);
}
console.log(checks + ' verifications, extension chargeable par Chrome');
