/* Noyau partage de l'extension : forme des donnees, encodage, application des captures
   et dialogue avec l'API GitHub. Aucune dependance a chrome.* ni au DOM : testable sous Node.
   Charge apres vendor/nlp.js (utilise NLP.foldKey). */
(function (root) {
  'use strict';

  const NLP = root.NLP || (typeof require !== 'undefined' ? require('../vendor/nlp.js') : null);
  const API = 'https://api.github.com';

  const DEFAULTS = { token: '', owner: 'Taaqz-13', repo: 'todo-data', branch: 'main', path: 'data.json' };

  function nowISO() { return new Date().toISOString(); }
  function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  function emptyDoc() { return { schema: 1, tasks: [], projects: [] }; }

  /* ---------- base64 <-> UTF-8 (les accents doivent survivre au transport) ---------- */
  function b64encode(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }
  function b64decode(b64) {
    const bin = atob(String(b64).replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  /* ---------- Fabrication des objets (meme forme que la web app) ---------- */
  function newTask(fields) {
    const ts = nowISO();
    return Object.assign({
      id: uuid(), title: '', notes: '', projectId: null, due: null, priority: 4, recur: null,
      completedAt: null, deletedAt: null, createdAt: ts, updatedAt: ts
    }, fields || {});
  }
  function newProject(name, color) {
    const ts = nowISO();
    return { id: uuid(), name: String(name || '').trim(), color: color || '#808080', createdAt: ts, updatedAt: ts, deletedAt: null };
  }

  const COLORS = ['#db4035', '#ff9933', '#fad000', '#7ecc49', '#299438', '#6accbc', '#4073ff', '#884dff', '#af38eb', '#ff8d85', '#808080'];
  function pickColor(n) { return COLORS[(n || 0) % COLORS.length]; }

  /* ---------- Application des captures SUR le document distant ----------
     L'extension n'ajoute que du contenu : elle ne modifie ni ne supprime jamais
     l'existant, donc aucune perte possible meme si le distant est plus recent.
     Idempotent : rejouer une capture deja presente (id connu) ne duplique rien. */
  function applyOps(remote, ops) {
    const doc = {};
    Object.keys(remote || {}).forEach(function (k) { doc[k] = remote[k]; });
    doc.schema = 1;
    doc.tasks = (remote && Array.isArray(remote.tasks)) ? remote.tasks.slice() : [];
    doc.projects = (remote && Array.isArray(remote.projects)) ? remote.projects.slice() : [];

    const taskIds = {};
    doc.tasks.forEach(function (t) { taskIds[t.id] = true; });
    const projIds = {};
    doc.projects.forEach(function (p) { projIds[p.id] = true; });

    let added = 0;
    (ops || []).forEach(function (op) {
      if (!op || !op.task) return;
      const task = Object.assign({}, op.task);

      if (op.project) {
        /* Le projet a peut-etre ete cree entre-temps sur un autre appareil : on rattache
           au jumeau existant plutot que de creer un doublon. */
        const key = NLP.foldKey(op.project.name);
        const twin = doc.projects.filter(function (p) { return !p.deletedAt && NLP.foldKey(p.name) === key; })[0];
        if (twin) {
          task.projectId = twin.id;
        } else if (!projIds[op.project.id]) {
          doc.projects.push(op.project);
          projIds[op.project.id] = true;
          task.projectId = op.project.id;
        }
      }

      if (!taskIds[task.id]) {
        doc.tasks.push(task);
        taskIds[task.id] = true;
        added++;
      }
    });
    return { doc: doc, added: added };
  }

  /* ---------- API GitHub ---------- */
  function headers(s) {
    return {
      'Authorization': 'Bearer ' + s.token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    };
  }
  function contentsUrl(s) {
    return API + '/repos/' + s.owner + '/' + s.repo + '/contents/' + s.path;
  }
  function httpErr(r) {
    const e = new Error('GitHub ' + r.status);
    e.status = r.status;
    return e;
  }

  async function pull(fetchFn, s, stamp) {
    const url = contentsUrl(s) + '?ref=' + encodeURIComponent(s.branch) + '&t=' + (stamp || Date.now());
    const r = await fetchFn(url, { headers: headers(s) });
    if (r.status === 404) return { doc: null, sha: null };
    if (!r.ok) throw httpErr(r);
    const j = await r.json();
    let doc = null;
    try { doc = JSON.parse(b64decode(j.content || '')); } catch (e) { doc = null; }
    return { doc: doc, sha: j.sha };
  }

  async function push(fetchFn, s, text, sha, message) {
    const body = { message: message || 'capture extension', content: b64encode(text), branch: s.branch };
    if (sha) body.sha = sha;
    const r = await fetchFn(contentsUrl(s), { method: 'PUT', headers: headers(s), body: JSON.stringify(body) });
    if (!r.ok) throw httpErr(r);
    return r.json();
  }

  /* Envoie les captures en attente. Rejoue en cas de conflit d'ecriture (sha perime).
     Retourne { doc, added } ; leve une erreur si l'envoi echoue (la file reste intacte). */
  async function flush(fetchFn, s, ops, stampFn) {
    const stamp = stampFn || function () { return Date.now(); };
    if (!ops || !ops.length) {
      const only = await pull(fetchFn, s, stamp());
      return { doc: only.doc || emptyDoc(), added: 0 };
    }
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const remote = await pull(fetchFn, s, stamp());
      const res = applyOps(remote.doc || emptyDoc(), ops);
      if (!res.added) return { doc: res.doc, added: 0 };  /* deja enregistrees */
      try {
        await push(fetchFn, s, JSON.stringify(res.doc), remote.sha,
          'capture : ' + res.added + ' élément(s) depuis Chrome');
        return { doc: res.doc, added: res.added };
      } catch (e) {
        lastErr = e;
        if (e.status !== 409 && e.status !== 422) throw e;
      }
    }
    throw lastErr || new Error('conflit persistant');
  }

  function explain(e, online) {
    if (online === false) return 'Hors ligne : envoi dès que la connexion revient.';
    if (!e) return '';
    if (e.status === 401) return 'Token invalide ou expiré. À remettre dans les réglages.';
    if (e.status === 403) return 'Accès refusé par GitHub (droits ou limite atteinte).';
    if (e.status === 404) return 'Dépôt introuvable : le token a-t-il accès au dépôt indiqué ?';
    if (e.status === 409 || e.status === 422) return 'Conflit d\'écriture, nouvelle tentative en cours.';
    return 'Envoi impossible pour le moment (' + (e.message || e) + ').';
  }

  const Core = {
    DEFAULTS: DEFAULTS, COLORS: COLORS, pickColor: pickColor,
    nowISO: nowISO, uuid: uuid, emptyDoc: emptyDoc,
    b64encode: b64encode, b64decode: b64decode,
    newTask: newTask, newProject: newProject,
    applyOps: applyOps, pull: pull, push: push, flush: flush, explain: explain
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
  else root.Core = Core;
})(typeof self !== 'undefined' ? self : this);
