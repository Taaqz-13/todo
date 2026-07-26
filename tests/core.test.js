/* Tests du noyau de l'extension Chrome. Lancer : node tests/core.test.js */
global.NLP = require('../extension/vendor/nlp.js');
const Core = require('../extension/shared/core.js');

let fails = 0, runs = 0;
function eq(actual, expected, label) {
  runs++;
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) { fails++; console.log('FAIL ' + label + '\n  attendu : ' + b + '\n  obtenu  : ' + a); }
}
function ok(cond, label) { eq(!!cond, true, label); }

/* ---------- encodage ---------- */
const ACC = 'idée : relancer Cegid à propos du crédit d\'impôt (ça urge) - ok';
eq(Core.b64decode(Core.b64encode(ACC)), ACC, 'aller-retour base64 avec accents');
eq(Core.b64decode(Core.b64encode('')), '', 'base64 chaine vide');
const LONG = 'é'.repeat(50000);
eq(Core.b64decode(Core.b64encode(LONG)).length, 50000, 'base64 gros contenu');

/* ---------- forme des objets ---------- */
const t = Core.newTask({ title: 'test' });
eq(Object.keys(t).sort(), ['completedAt', 'createdAt', 'deletedAt', 'due', 'id', 'notes', 'priority', 'projectId', 'recur', 'title', 'updatedAt'], 'champs de tache identiques a la web app');
eq(t.priority, 4, 'priorite par defaut');
eq(t.completedAt, null, 'tache non terminee');
const pr = Core.newProject('Simplest');
eq(Object.keys(pr).sort(), ['color', 'createdAt', 'deletedAt', 'id', 'name', 'updatedAt'], 'champs de projet');

/* ---------- applyOps : ajout seul, jamais de perte ---------- */
const remote = {
  schema: 1,
  tasks: [{ id: 'r1', title: 'existante', updatedAt: '2026-07-24T10:00:00.000Z', deletedAt: null, completedAt: null }],
  projects: [{ id: 'p1', name: 'Cegid', color: '#4073ff', deletedAt: null, updatedAt: '2026-07-24T10:00:00.000Z' }]
};
let op1 = { task: Core.newTask({ id: 'n1', title: 'nouvelle' }) };
let res = Core.applyOps(remote, [op1]);
eq(res.added, 1, 'une capture ajoutee');
eq(res.doc.tasks.length, 2, 'la tache distante est conservee');
eq(res.doc.tasks[0].id, 'r1', 'ordre : distant en premier');
eq(res.doc.projects.length, 1, 'aucun projet cree sans raison');
ok(remote.tasks.length === 1, 'le document distant d origine n est pas mute');

/* idempotence : rejouer la meme capture ne duplique pas */
res = Core.applyOps(res.doc, [op1]);
eq(res.added, 0, 'capture deja presente : rien ajoute');
eq(res.doc.tasks.length, 2, 'pas de doublon');

/* creation de projet */
const npr = Core.newProject('Univers Cheval', '#7ecc49');
res = Core.applyOps(remote, [{ project: npr, task: Core.newTask({ id: 'n2', title: 'avec projet', projectId: npr.id }) }]);
eq(res.doc.projects.length, 2, 'projet cree');
eq(res.doc.tasks[1].projectId, npr.id, 'tache rattachee au projet cree');

/* projet deja cree ailleurs entre-temps : on se rattache au jumeau, pas de doublon */
const twin = { id: 'p-twin', name: 'univers cheval', color: '#299438', deletedAt: null, updatedAt: '2026-07-24T11:00:00.000Z' };
const remote2 = { schema: 1, tasks: [], projects: [twin] };
res = Core.applyOps(remote2, [{ project: Core.newProject('Univers Cheval'), task: Core.newTask({ id: 'n3', title: 'x', projectId: 'peu-importe' }) }]);
eq(res.doc.projects.length, 1, 'jumeau reconnu : pas de projet en double');
eq(res.doc.tasks[0].projectId, 'p-twin', 'tache rattachee au jumeau existant');

/* champs inconnus du distant preserves (compatibilite future) */
res = Core.applyOps({ schema: 1, tasks: [], projects: [], reglagesFuturs: { x: 1 } }, [op1]);
eq(res.doc.reglagesFuturs, { x: 1 }, 'cle distante inconnue conservee');

/* distant vide ou absent */
res = Core.applyOps(Core.emptyDoc(), [op1]);
eq(res.doc.tasks.length, 1, 'depot vide : la capture passe');

/* ---------- flush contre un faux GitHub ---------- */
function fakeGitHub(opts) {
  opts = opts || {};
  const state = { file: opts.file || null, sha: opts.file ? 'sha-0' : null, puts: 0, gets: 0, conflicts: opts.conflicts || 0 };
  const fetchFn = async function (url, init) {
    init = init || {};
    const method = init.method || 'GET';
    if (!init.headers || !init.headers.Authorization) throw new Error('appel sans authentification');
    if (method === 'GET') {
      state.gets++;
      if (opts.failGet) return { ok: false, status: opts.failGet, json: async () => ({}) };
      if (!state.file) return { ok: false, status: 404, json: async () => ({ message: 'Not Found' }) };
      return { ok: true, status: 200, json: async () => ({ content: Core.b64encode(state.file), sha: state.sha }) };
    }
    state.puts++;
    if (state.conflicts > 0) { state.conflicts--; return { ok: false, status: 409, json: async () => ({}) }; }
    const body = JSON.parse(init.body);
    if (state.file && body.sha !== state.sha) return { ok: false, status: 409, json: async () => ({}) };
    state.file = Core.b64decode(body.content);
    state.sha = 'sha-' + state.puts;
    return { ok: true, status: 200, json: async () => ({ content: { sha: state.sha } }) };
  };
  return { state: state, fetch: fetchFn };
}
const S = { token: 'factice', owner: 'o', repo: 'r', branch: 'main', path: 'data.json' };

(async function () {
  /* depot inexistant : le fichier est cree */
  let gh = fakeGitHub();
  let out = await Core.flush(gh.fetch, S, [{ task: Core.newTask({ id: 'a', title: 'première idée à noter' }) }]);
  eq(out.added, 1, 'flush cree le fichier absent');
  eq(JSON.parse(gh.state.file).tasks[0].title, 'première idée à noter', 'accents intacts apres aller-retour reseau');

  /* conflit d ecriture : rejoue et finit par passer */
  gh = fakeGitHub({ file: JSON.stringify({ schema: 1, tasks: [], projects: [] }), conflicts: 1 });
  out = await Core.flush(gh.fetch, S, [{ task: Core.newTask({ id: 'b', title: 'malgré le conflit' }) }]);
  eq(out.added, 1, 'flush aboutit apres un 409');
  eq(gh.state.puts, 2, 'un seul rejeu necessaire');
  eq(JSON.parse(gh.state.file).tasks.length, 1, 'capture bien ecrite');

  /* modification distante entre le pull et le push : rien n est ecrase */
  gh = fakeGitHub({ file: JSON.stringify({ schema: 1, tasks: [{ id: 'phone', title: 'venue du téléphone', updatedAt: '2026-07-24T12:00:00.000Z' }], projects: [] }) });
  out = await Core.flush(gh.fetch, S, [{ task: Core.newTask({ id: 'c', title: 'venue de Chrome' }) }]);
  const merged = JSON.parse(gh.state.file);
  eq(merged.tasks.map(function (x) { return x.id; }), ['phone', 'c'], 'la tache du telephone survit a la capture Chrome');

  /* conflit permanent : erreur remontee, la file reste a rejouer */
  gh = fakeGitHub({ file: '{"schema":1,"tasks":[],"projects":[]}', conflicts: 9 });
  let threw = null;
  try { await Core.flush(gh.fetch, S, [{ task: Core.newTask({ id: 'd', title: 'x' }) }]); } catch (e) { threw = e; }
  ok(threw, 'conflit permanent : erreur levee (file conservee par l appelant)');
  eq(gh.state.puts, 3, 'trois tentatives maximum');

  /* token invalide */
  gh = fakeGitHub({ failGet: 401 });
  threw = null;
  try { await Core.flush(gh.fetch, S, [{ task: Core.newTask({ id: 'e', title: 'x' }) }]); } catch (e) { threw = e; }
  eq(threw && threw.status, 401, 'erreur 401 propagee');
  eq(Core.explain(threw), 'Token invalide ou expiré. À remettre dans les réglages.', 'message clair pour un token mort');
  eq(Core.explain(null, false), 'Hors ligne : envoi dès que la connexion revient.', 'message hors ligne');
  eq(Core.explain({ status: 404 }), 'Dépôt introuvable : le token a-t-il accès au dépôt indiqué ?', 'message depot introuvable');

  /* file vide : simple rafraichissement, aucune ecriture */
  gh = fakeGitHub({ file: '{"schema":1,"tasks":[],"projects":[{"id":"p9","name":"Simplest","deletedAt":null}]}' });
  out = await Core.flush(gh.fetch, S, []);
  eq(gh.state.puts, 0, 'file vide : aucun envoi');
  eq(out.doc.projects[0].name, 'Simplest', 'projets recuperes pour l autocompletion');

  /* le parser partage se comporte pareil que dans la web app */
  const p = NLP.parse('relancer Cegid dem p1 #cegid', {
    today: '2026-07-24',
    projects: [{ id: 'p1', name: 'Cegid' }]
  });
  eq(p.due, '2026-07-25', 'raccourci date dans l extension');
  eq(p.priority, 1, 'raccourci priorite dans l extension');
  eq(p.project && p.project.id, 'p1', 'raccourci projet dans l extension');
  eq(p.title, 'relancer Cegid', 'titre nettoye dans l extension');

  console.log(runs + ' tests, ' + fails + ' echec(s)');
  process.exit(fails ? 1 : 0);
})();
