/* Etat de l'application : taches + projets, persistance localStorage,
   fusion multi-appareils (par updatedAt, avec pierres tombales pour les suppressions). */
(function (root) {
  'use strict';

  const LS_DATA = 'todo.data.v1';
  const LS_SETTINGS = 'todo.settings.v1';

  function nowISO() { return new Date().toISOString(); }
  function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  /* ---------- Fusion (pure, testable) ---------- */
  function mergeList(a, b) {
    const map = {};
    (a || []).forEach(function (x) { map[x.id] = x; });
    (b || []).forEach(function (x) {
      const cur = map[x.id];
      if (!cur || String(x.updatedAt || '') > String(cur.updatedAt || '')) map[x.id] = x;
    });
    return Object.keys(map).sort().map(function (k) { return map[k]; });
  }

  function normalizeDoc(doc) {
    doc = doc || {};
    return {
      schema: 1,
      tasks: mergeList(doc.tasks || [], []),
      projects: mergeList(doc.projects || [], [])
    };
  }

  function mergeDocs(local, remote) {
    if (!remote) return normalizeDoc(local);
    if (!local) return normalizeDoc(remote);
    return {
      schema: 1,
      tasks: mergeList(local.tasks, remote.tasks),
      projects: mergeList(local.projects, remote.projects)
    };
  }

  /* Purge : tombales > 60 j, terminees > 180 j (garde le fichier leger) */
  function purgeDoc(doc, nowMs) {
    nowMs = nowMs || Date.now();
    const D = 86400000;
    function fresh(ts, days) { return !ts || (nowMs - Date.parse(ts)) < days * D; }
    return {
      schema: 1,
      tasks: doc.tasks.filter(function (t) { return fresh(t.deletedAt, 60) && fresh(t.completedAt, 180); }),
      projects: doc.projects.filter(function (p) { return fresh(p.deletedAt, 60); })
    };
  }

  /* ---------- Store ---------- */
  const listeners = [];
  const Store = {
    state: { tasks: [], projects: [] },
    settings: { token: '', owner: 'Taaqz-13', repo: 'todo-data', branch: 'main', path: 'data.json' },

    load: function () {
      try {
        const d = localStorage.getItem(LS_DATA);
        if (d) { const doc = JSON.parse(d); this.state.tasks = doc.tasks || []; this.state.projects = doc.projects || []; }
      } catch (e) { console.warn('load data', e); }
      try {
        const s = localStorage.getItem(LS_SETTINGS);
        if (s) Object.assign(this.settings, JSON.parse(s));
      } catch (e) { console.warn('load settings', e); }
    },
    persist: function () {
      localStorage.setItem(LS_DATA, JSON.stringify(this.toDoc()));
    },
    saveSettings: function () {
      localStorage.setItem(LS_SETTINGS, JSON.stringify(this.settings));
    },
    subscribe: function (fn) { listeners.push(fn); },
    emit: function (kind) {
      listeners.forEach(function (fn) { try { fn(kind || 'change'); } catch (e) { console.error(e); } });
    },
    mutate: function (kind) {
      this.persist();
      this.emit(kind || 'change');
      if (root.Sync) root.Sync.schedule();
    },

    toDoc: function () {
      return purgeDoc(normalizeDoc({ tasks: this.state.tasks, projects: this.state.projects }));
    },
    applyDoc: function (doc) {
      const n = normalizeDoc(doc);
      this.state.tasks = n.tasks;
      this.state.projects = n.projects;
      localStorage.setItem(LS_DATA, JSON.stringify(n));
      this.emit('sync');
    },

    /* ---------- Taches ---------- */
    addTask: function (data) {
      const t = {
        id: uuid(),
        title: (data.title || '').trim(),
        notes: data.notes || '',
        projectId: data.projectId || null,
        due: data.due || null,
        priority: data.priority || 4,
        recur: data.recur || null,
        completedAt: null,
        deletedAt: null,
        createdAt: nowISO(),
        updatedAt: nowISO()
      };
      if (!t.title) return null;
      this.state.tasks.push(t);
      this.mutate('task-add');
      return t;
    },
    getTask: function (id) {
      return this.state.tasks.find(function (t) { return t.id === id; }) || null;
    },
    updateTask: function (id, patch) {
      const t = this.getTask(id);
      if (!t) return null;
      Object.assign(t, patch, { updatedAt: nowISO() });
      this.mutate('task-update');
      return t;
    },
    completeTask: function (id) {
      const t = this.getTask(id);
      if (!t) return null;
      const snapshot = { due: t.due, completedAt: t.completedAt };
      let rescheduled = false;
      if (t.recur && t.due) {
        const base = t.due > NLP.todayStr() ? t.due : NLP.todayStr();
        t.due = NLP.nextOccurrence(t.recur, base);
        rescheduled = true;
      } else {
        t.completedAt = nowISO();
      }
      t.updatedAt = nowISO();
      this.mutate('task-complete');
      return { task: t, snapshot: snapshot, rescheduled: rescheduled };
    },
    undoComplete: function (id, snapshot) {
      const t = this.getTask(id);
      if (!t) return;
      t.due = snapshot.due;
      t.completedAt = snapshot.completedAt;
      t.updatedAt = nowISO();
      this.mutate('task-update');
    },
    uncompleteTask: function (id) {
      const t = this.getTask(id);
      if (!t) return;
      t.completedAt = null;
      t.updatedAt = nowISO();
      this.mutate('task-update');
    },
    deleteTask: function (id) {
      const t = this.getTask(id);
      if (!t) return;
      t.deletedAt = nowISO();
      t.updatedAt = nowISO();
      this.mutate('task-delete');
    },

    /* ---------- Projets ---------- */
    addProject: function (name, color) {
      name = (name || '').trim();
      if (!name) return null;
      const existing = this.activeProjects().find(function (p) { return NLP.foldKey(p.name) === NLP.foldKey(name); });
      if (existing) return existing;
      const p = { id: uuid(), name: name, color: color || '#808080', createdAt: nowISO(), updatedAt: nowISO(), deletedAt: null };
      this.state.projects.push(p);
      this.mutate('project-add');
      return p;
    },
    getProject: function (id) {
      return this.state.projects.find(function (p) { return p.id === id && !p.deletedAt; }) || null;
    },
    updateProject: function (id, patch) {
      const p = this.state.projects.find(function (x) { return x.id === id; });
      if (!p) return;
      Object.assign(p, patch, { updatedAt: nowISO() });
      this.mutate('project-update');
    },
    deleteProject: function (id) {
      const self = this;
      this.state.tasks.forEach(function (t) {
        if (t.projectId === id && !t.deletedAt) { t.projectId = null; t.updatedAt = nowISO(); }
      });
      const p = this.state.projects.find(function (x) { return x.id === id; });
      if (p) { p.deletedAt = nowISO(); p.updatedAt = nowISO(); }
      this.mutate('project-delete');
    },
    activeProjects: function () {
      return this.state.projects
        .filter(function (p) { return !p.deletedAt; })
        .sort(function (a, b) { return a.name.localeCompare(b.name, 'fr'); });
    },

    /* ---------- Vues ---------- */
    openTasks: function () {
      return this.state.tasks.filter(function (t) { return !t.deletedAt && !t.completedAt; });
    },
    inbox: function () {
      return this.openTasks()
        .filter(function (t) { return !t.projectId; })
        .sort(function (a, b) { return a.createdAt < b.createdAt ? -1 : 1; });
    },
    byProject: function (pid) {
      return this.openTasks()
        .filter(function (t) { return t.projectId === pid; })
        .sort(function (a, b) { return a.createdAt < b.createdAt ? -1 : 1; });
    },
    todayView: function () {
      const today = NLP.todayStr();
      const t = this.openTasks().filter(function (x) { return x.due && x.due <= today; });
      const overdue = t.filter(function (x) { return x.due < today; }).sort(byDuePrio);
      const dueToday = t.filter(function (x) { return x.due === today; }).sort(byPrio);
      return { overdue: overdue, today: dueToday };
    },
    upcoming: function () {
      const today = NLP.todayStr();
      const groups = {};
      this.openTasks().forEach(function (t) {
        if (!t.due || t.due <= today) return;
        (groups[t.due] = groups[t.due] || []).push(t);
      });
      return Object.keys(groups).sort().map(function (d) {
        return { date: d, tasks: groups[d].sort(byPrio) };
      });
    },
    completed: function () {
      return this.state.tasks
        .filter(function (t) { return !t.deletedAt && t.completedAt; })
        .sort(function (a, b) { return a.completedAt < b.completedAt ? 1 : -1; })
        .slice(0, 100);
    },
    search: function (q) {
      const k = NLP.fold(q.trim());
      if (!k) return [];
      return this.state.tasks
        .filter(function (t) { return !t.deletedAt && NLP.fold(t.title + ' ' + (t.notes || '')).indexOf(k) >= 0; })
        .sort(function (a, b) { return (a.completedAt ? 1 : 0) - (b.completedAt ? 1 : 0) || (a.createdAt < b.createdAt ? -1 : 1); })
        .slice(0, 80);
    },
    counts: function () {
      const today = NLP.todayStr();
      let inbox = 0, todayN = 0;
      const perProject = {};
      this.openTasks().forEach(function (t) {
        if (!t.projectId) inbox++;
        else perProject[t.projectId] = (perProject[t.projectId] || 0) + 1;
        if (t.due && t.due <= today) todayN++;
      });
      return { inbox: inbox, today: todayN, perProject: perProject };
    },

    merge: mergeDocs,
    purge: purgeDoc,
    uuid: uuid
  };

  function byPrio(a, b) {
    return (a.priority - b.priority) || (a.createdAt < b.createdAt ? -1 : 1);
  }
  function byDuePrio(a, b) {
    return (a.due < b.due ? -1 : a.due > b.due ? 1 : 0) || byPrio(a, b);
  }

  const NLP = root.NLP || (typeof require !== 'undefined' ? require('./nlp.js') : null);

  if (typeof module !== 'undefined' && module.exports) module.exports = Store;
  else root.Store = Store;
})(typeof self !== 'undefined' ? self : this);
