/* Tests du service worker de l'extension, avec un faux chrome.* et un faux GitHub.
   Lancer : node tests/background.test.js */
const path = require('path');

let fails = 0, runs = 0;
function eq(actual, expected, label) {
  runs++;
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) { fails++; console.log('FAIL ' + label + '\n  attendu : ' + b + '\n  obtenu  : ' + a); }
}
function ok(cond, label) { eq(!!cond, true, label); }
const wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

/* ---------- Faux GitHub ---------- */
const gh = { file: null, sha: null, puts: 0, gets: 0, mode: 'ok' };
function resetGH(file) {
  gh.file = file || null;
  gh.sha = file ? 'sha-0' : null;
  gh.puts = 0; gh.gets = 0; gh.mode = 'ok';
}
global.fetch = async function (url, init) {
  init = init || {};
  const method = init.method || 'GET';
  if (gh.mode === 'offline') throw new TypeError('Failed to fetch');
  if (gh.mode === '401') return { ok: false, status: 401, json: async () => ({}) };
  if (method === 'GET') {
    gh.gets++;
    if (!gh.file) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ content: Core.b64encode(gh.file), sha: gh.sha }) };
  }
  gh.puts++;
  const body = JSON.parse(init.body);
  if (gh.file && body.sha !== gh.sha) return { ok: false, status: 409, json: async () => ({}) };
  gh.file = Core.b64decode(body.content);
  gh.sha = 'sha-' + gh.puts;
  return { ok: true, status: 200, json: async () => ({}) };
};

/* ---------- Faux chrome.* ---------- */
const store = {};
const listeners = {};
const badge = { text: '', color: '' };
const menus = [];
const alarms = {};

global.chrome = {
  storage: {
    local: {
      get: async function (keys) {
        const out = {};
        (Array.isArray(keys) ? keys : [keys]).forEach(function (k) {
          if (store[k] !== undefined) out[k] = JSON.parse(JSON.stringify(store[k]));
        });
        return out;
      },
      set: async function (patch) {
        Object.keys(patch).forEach(function (k) { store[k] = JSON.parse(JSON.stringify(patch[k])); });
      }
    }
  },
  action: {
    setBadgeText: async function (o) { badge.text = o.text; },
    setBadgeBackgroundColor: async function (o) { badge.color = o.color; }
  },
  contextMenus: {
    removeAll: function (cb) { menus.length = 0; if (cb) cb(); },
    create: function (o) { menus.push(o); },
    onClicked: { addListener: function (fn) { listeners.menu = fn; } }
  },
  alarms: {
    create: async function (name, o) { alarms[name] = o; },
    clear: async function (name) { delete alarms[name]; },
    onAlarm: { addListener: function (fn) { listeners.alarm = fn; } }
  },
  runtime: {
    onInstalled: { addListener: function (fn) { listeners.installed = fn; } },
    onStartup: { addListener: function (fn) { listeners.startup = fn; } },
    onMessage: { addListener: function (fn) { listeners.message = fn; } }
  }
};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });

/* ---------- Chargement du service worker ---------- */
global.self = global;
global.NLP = require('../extension/vendor/nlp.js');
global.Core = require('../extension/shared/core.js');
global.importScripts = function () { /* deja charge ci-dessus */ };
require('../extension/background.js');

function msg(payload) {
  return new Promise(function (resolve) {
    listeners.message(payload, {}, resolve);
  });
}
async function queueLen() { return (store.queue || []).length; }

(async function () {
  /* --- menus crees a l'installation --- */
  listeners.installed();
  eq(menus.map(function (m) { return m.id; }), ['todo-selection', 'todo-page'], 'menus contextuels crees');
  ok(/Capturer/.test(menus[0].title), 'libelle du menu selection');

  /* --- 1. capture sans token : rien n'est perdu, message clair --- */
  resetGH();
  let r = await msg({ type: 'capture', op: { task: Core.newTask({ id: 'q1', title: 'idée sans token' }) } });
  eq(r.ok, true, 'capture acceptee meme sans token');
  await wait(30);
  eq(await queueLen(), 1, 'la capture reste en file sans token');
  eq(badge.text, '1', 'badge indique 1 en attente');
  eq(gh.puts, 0, 'aucun envoi tente sans token');
  ok(/Token manquant/.test(store.lastError), 'erreur explicite : token manquant');

  /* --- 2. on renseigne le token : la file part --- */
  r = await msg({ type: 'saveSettings', patch: { token: 'factice', owner: 'o', repo: 'r', branch: 'main', path: 'data.json' } });
  await wait(30);
  eq(r.hasToken, true, 'token enregistre');
  eq(await queueLen(), 0, 'file videe apres envoi');
  eq(JSON.parse(gh.file).tasks.map(function (t) { return t.title; }), ['idée sans token'], 'capture arrivee sur le depot, accents intacts');
  eq(store.lastError, '', 'aucune erreur residuelle');

  /* --- 3. capture normale --- */
  await msg({ type: 'capture', op: { task: Core.newTask({ id: 'q2', title: 'relancer le syndic' }) } });
  await wait(40);
  eq(await queueLen(), 0, 'capture envoyee immediatement');
  eq(JSON.parse(gh.file).tasks.length, 2, 'deux taches sur le depot');

  /* --- 4. hors ligne : la capture est conservee et une relance est programmee --- */
  gh.mode = 'offline';
  navigator.onLine = false;
  await msg({ type: 'capture', op: { task: Core.newTask({ id: 'q3', title: 'idée dans le métro' }) } });
  await wait(40);
  eq(await queueLen(), 1, 'hors ligne : capture conservee en file');
  ok(/Hors ligne/.test(store.lastError), 'message hors ligne affiche');
  ok(alarms['todo-retry'], 'relance automatique programmee');
  eq(badge.text, '1', 'badge en attente hors ligne');

  /* retour du reseau : la relance envoie ce qui restait */
  gh.mode = 'ok';
  navigator.onLine = true;
  await listeners.alarm({ name: 'todo-retry' });
  await wait(60);
  eq(await queueLen(), 0, 'file videe au retour du reseau');
  const titres = JSON.parse(gh.file).tasks.map(function (t) { return t.title; });
  eq(titres.indexOf('idée dans le métro') >= 0, true, 'la capture faite hors ligne est bien arrivee');
  eq(alarms['todo-retry'], undefined, 'relance annulee une fois la file vide');

  /* --- 5. capture pendant un envoi en cours : elle ne doit pas etre perdue --- */
  let release = null;
  const slow = new Promise(function (res) { release = res; });
  const realFetch = global.fetch;
  let firstGet = true;
  global.fetch = async function (url, init) {
    if (firstGet && (!init || !init.method || init.method === 'GET')) { firstGet = false; await slow; }
    return realFetch(url, init);
  };
  const p1 = msg({ type: 'capture', op: { task: Core.newTask({ id: 'slowA', title: 'pendant envoi A' }) } });
  await wait(20);
  const p2 = msg({ type: 'capture', op: { task: Core.newTask({ id: 'slowB', title: 'pendant envoi B' }) } });
  await wait(20);
  release();
  await Promise.all([p1, p2]);
  await wait(150);
  global.fetch = realFetch;
  eq(await queueLen(), 0, 'file entierement videe apres la course');
  const all = JSON.parse(gh.file).tasks.map(function (t) { return t.title; });
  eq(all.filter(function (t) { return t === 'pendant envoi A'; }).length, 1, 'capture A envoyee une seule fois');
  eq(all.filter(function (t) { return t === 'pendant envoi B'; }).length, 1, 'capture B non perdue pendant l envoi');

  /* --- 6. menu contextuel : selection et page --- */
  await listeners.menu(
    { menuItemId: 'todo-selection', selectionText: '  la façade   est à refaire  ' },
    { url: 'https://exemple.fr/article', title: 'Un article' }
  );
  await wait(60);
  let doc = JSON.parse(gh.file);
  let last = doc.tasks[doc.tasks.length - 1];
  eq(last.title, 'la façade est à refaire', 'selection nettoyee et accentuee');
  eq(last.notes, 'Source : https://exemple.fr/article', 'URL source conservee en note');

  await listeners.menu({ menuItemId: 'todo-page' }, { url: 'https://exemple.fr/tarifs', title: 'Nos tarifs' });
  await wait(60);
  doc = JSON.parse(gh.file);
  last = doc.tasks[doc.tasks.length - 1];
  eq(last.title, 'Nos tarifs', 'capture de la page : titre repris');
  eq(last.notes, 'À voir : https://exemple.fr/tarifs', 'capture de la page : URL en note');

  /* selection vide : on ne cree rien */
  const before = JSON.parse(gh.file).tasks.length;
  await listeners.menu({ menuItemId: 'todo-selection', selectionText: '   ' }, { url: 'https://x.fr' });
  await wait(40);
  eq(JSON.parse(gh.file).tasks.length, before, 'selection vide ignoree');

  /* --- 7. token invalide : message clair, capture conservee --- */
  gh.mode = '401';
  await msg({ type: 'capture', op: { task: Core.newTask({ id: 'q9', title: 'token mort' }) } });
  await wait(60);
  eq(await queueLen(), 1, 'token invalide : capture conservee');
  ok(/Token invalide/.test(store.lastError), 'message token invalide');
  gh.mode = 'ok';
  await msg({ type: 'sync' });
  await wait(60);
  eq(await queueLen(), 0, 'synchro manuelle repare la situation');

  /* --- 8. etat renvoye a la fenetre de capture --- */
  const st = await msg({ type: 'state' });
  eq(st.settings.hasToken, true, 'etat : token present');
  eq(st.settings.tokenHint, '••••tice', 'etat : token masque');
  eq(st.pending, 0, 'etat : rien en attente');
  ok(st.lastSync, 'etat : date de derniere synchro');
  ok(Array.isArray(st.projects), 'etat : liste de projets pour l autocompletion');

  /* le token ne doit jamais sortir du service worker */
  eq(JSON.stringify(st).indexOf('factice'), -1, 'le token complet n est pas transmis a la fenetre');

  /* --- 9. projets remontes pour l autocompletion --- */
  gh.file = JSON.stringify({
    schema: 1, tasks: [],
    projects: [{ id: 'pp', name: 'Simplest', color: '#299438', deletedAt: null },
               { id: 'pz', name: 'Ancien', color: '#808080', deletedAt: '2026-07-01T10:00:00.000Z' }]
  });
  gh.sha = 'sha-x';
  const sync = await msg({ type: 'sync' });
  eq(sync.projects.map(function (p) { return p.name; }), ['Simplest'], 'projets supprimes filtres');

  console.log(runs + ' tests, ' + fails + ' echec(s)');
  process.exit(fails ? 1 : 0);
})();
