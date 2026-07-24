/* Interface : vues, saisie rapide, edition, projets, reglages. */
(function () {
  'use strict';

  /* ================= Icones (SVG inline, trait 1.7) ================= */
  function svg(inner, vb) {
    return '<svg viewBox="0 0 ' + (vb || 24) + ' ' + (vb || 24) + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }
  const I = {
    inbox: svg('<rect x="3.75" y="4.75" width="16.5" height="14.5" rx="2.5"/><path d="M3.75 13.25h4.7l1.7 2.5h3.7l1.7-2.5h4.7"/>'),
    today: svg('<rect x="3.75" y="5" width="16.5" height="15" rx="2.5"/><path d="M3.75 9.5h16.5M8.2 2.9v3.4M15.8 2.9v3.4"/><text x="12" y="17.4" text-anchor="middle" font-size="8.4" font-weight="700" fill="currentColor" stroke="none">' + new Date().getDate() + '</text>'),
    upcoming: svg('<rect x="3.75" y="5" width="16.5" height="15" rx="2.5"/><path d="M3.75 9.5h16.5M8.2 2.9v3.4M15.8 2.9v3.4"/><circle cx="8.5" cy="13.5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="13.5" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="13.5" r="1" fill="currentColor" stroke="none"/>'),
    browse: svg('<rect x="4" y="4" width="7" height="7" rx="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.8"/>'),
    search: svg('<circle cx="11" cy="11" r="6.25"/><path d="M15.6 15.6L20.3 20.3"/>'),
    settings: svg('<path d="M4 7.2h16M4 12h16M4 16.8h16"/><circle cx="9.2" cy="7.2" r="1.9" fill="var(--bg)"/><circle cx="15" cy="12" r="1.9" fill="var(--bg)"/><circle cx="7.5" cy="16.8" r="1.9" fill="var(--bg)"/>'),
    flag: svg('<path d="M6.2 21V4.4"/><path d="M6.2 5.1c2.1-1.2 4.1-1.2 6.1 0s4 1.2 5.5.2v7.6c-1.5 1-3.5 1-5.5-.2s-4-1.2-6.1 0"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    repeat: svg('<path d="M17.2 2.8l2.8 2.8-2.8 2.8"/><path d="M19.6 5.6H8.4a4.2 4.2 0 00-4.2 4.2v.9"/><path d="M6.8 21.2L4 18.4l2.8-2.8"/><path d="M4.4 18.4h11.2a4.2 4.2 0 004.2-4.2v-.9"/>'),
    chevron: svg('<path d="M9 6.5l5.5 5.5L9 17.5"/>'),
    x: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
    trash: svg('<path d="M4.7 6.7h14.6M9.8 6.3V4.6h4.4v1.7M6.7 6.9l.9 12.6h8.8l.9-12.6M10.1 10v6M13.9 10v6"/>'),
    dots: svg('<circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none"/>'),
    up: svg('<path d="M12 19V5.5M6.2 11.3L12 5.5l5.8 5.8"/>'),
    notes: svg('<path d="M5 6h14M5 10h14M5 14h9"/>'),
    cloud: svg('<path d="M7 18.6h10.2a3.9 3.9 0 10-.6-7.8 5.5 5.5 0 00-10.6 1.7A3.6 3.6 0 007 18.6z"/>'),
    cloudOff: svg('<path d="M7 18.6h10.2a3.9 3.9 0 10-.6-7.8 5.5 5.5 0 00-10.6 1.7A3.6 3.6 0 007 18.6z"/><path d="M4.5 4.5l15 15"/>'),
    cloudOk: svg('<path d="M7 18.6h10.2a3.9 3.9 0 10-.6-7.8 5.5 5.5 0 00-10.6 1.7A3.6 3.6 0 007 18.6z"/><path d="M9.3 13.4l2 2 3.6-3.9"/>'),
    cloudErr: svg('<path d="M7 18.6h10.2a3.9 3.9 0 10-.6-7.8 5.5 5.5 0 00-10.6 1.7A3.6 3.6 0 007 18.6z"/><path d="M12 9.8v3.4M12 15.9v.1"/>'),
    hash: svg('<path d="M9.6 4.2l-2.2 15.6M16.6 4.2l-2.2 15.6M4.6 9h16M3.4 15h16"/>'),
    circle: svg('<circle cx="12" cy="12" r="8.5"/>')
  };
  I.check = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.4 9.6l3 3 6.4-7"/></svg>';

  const PROJECT_COLORS = ['#db4035', '#ff9933', '#fad000', '#7ecc49', '#299438', '#6accbc', '#4073ff', '#884dff', '#af38eb', '#ff8d85', '#808080'];

  /* ================= Helpers ================= */
  const $ = function (s, el) { return (el || document).querySelector(s); };
  const $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function haptic() { if (navigator.vibrate) navigator.vibrate(8); }

  /* ================= Toast ================= */
  let toastTimer = null, toastUndo = null;
  function toast(msg, actionLabel, action) {
    const el = $('#toast');
    $('#toast-msg').textContent = msg;
    const btn = $('#toast-action');
    toastUndo = action || null;
    btn.textContent = actionLabel || '';
    btn.style.display = actionLabel ? '' : 'none';
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('on'); }, 4500);
  }

  /* ================= Rendu des taches ================= */
  function projectOf(t) { return t.projectId ? Store.getProject(t.projectId) : null; }

  function taskRowHTML(t, opts) {
    opts = opts || {};
    const p = projectOf(t);
    const done = !!t.completedAt;
    let meta = '';
    if (t.due && !opts.hideDate) {
      const lab = NLP.frDateLabel(t.due, NLP.todayStr());
      meta += '<span class="t-date ' + lab.cls + '">' + esc(lab.text) + (t.recur ? ' <span class="t-recur">' + I.repeat + '</span>' : '') + '</span>';
    } else if (t.recur) {
      meta += '<span class="t-date later"><span class="t-recur">' + I.repeat + '</span>' + esc(NLP.recurLabel(t.recur)) + '</span>';
    }
    if (t.notes) meta += '<span class="t-notes">' + I.notes + '</span>';
    let right = '';
    if (!opts.hideProject) {
      right = p
        ? '<span class="t-proj">' + esc(p.name) + ' <i style="background:' + esc(p.color) + '"></i></span>'
        : '<span class="t-proj">Inbox ' + '<i class="t-proj-inbox">' + '</i></span>';
    }
    return '<div class="task' + (done ? ' is-done' : '') + '" data-id="' + t.id + '">' +
      '<button class="check p' + (t.priority || 4) + (done ? ' done' : '') + '" aria-label="Terminer">' + I.check + '</button>' +
      '<div class="t-main">' +
      '<div class="t-title">' + esc(t.title) + '</div>' +
      (meta || right ? '<div class="t-meta"><span class="t-meta-l">' + meta + '</span>' + right + '</div>' : '') +
      '</div></div>';
  }

  function listHTML(tasks, opts) {
    return tasks.map(function (t) { return taskRowHTML(t, opts); }).join('');
  }

  function addRowHTML() {
    return '<button class="add-row">' + '<span class="add-row-ic">' + I.plus + '</span> Ajouter une tâche</button>';
  }

  function emptyHTML(icon, title, sub) {
    return '<div class="empty">' + icon + '<p class="empty-t">' + esc(title) + '</p>' + (sub ? '<p class="empty-s">' + esc(sub) + '</p>' : '') + '</div>';
  }

  /* ================= Vues ================= */
  const VIEWS = {
    today: function () {
      const v = Store.todayView();
      const d = new Date();
      let html = '<div class="view-head"><h1>Aujourd\'hui</h1><div class="vh-sub">' +
        NLP.DAY_SHORT[d.getDay()] + ' ' + d.getDate() + ' ' + NLP.MONTH_SHORT[d.getMonth()] + '</div></div>';
      if (v.overdue.length) {
        html += '<div class="sec-head overdue-head">En retard</div>' + listHTML(v.overdue);
      }
      if (v.today.length) {
        if (v.overdue.length) html += '<div class="sec-head">Aujourd\'hui</div>';
        html += listHTML(v.today, { hideDate: !v.overdue.length });
      }
      html += addRowHTML();
      if (!v.overdue.length && !v.today.length) {
        html += emptyHTML(I.today, 'Rien pour aujourd\'hui', 'Profite, ou capture ce que tu as en tête avec le bouton +');
      }
      return html;
    },
    inbox: function () {
      const tasks = Store.inbox();
      let html = '<div class="view-head"><h1>Boîte de réception</h1></div>';
      html += listHTML(tasks, { hideProject: true });
      html += addRowHTML();
      if (!tasks.length) html += emptyHTML(I.inbox, 'Inbox vide', 'Toutes tes idées en vrac atterrissent ici avant d\'être triées');
      return html;
    },
    upcoming: function () {
      const groups = Store.upcoming();
      const v = Store.todayView();
      let html = '<div class="view-head"><h1>À venir</h1></div>';
      if (v.overdue.length) html += '<div class="sec-head overdue-head">En retard</div>' + listHTML(v.overdue);
      if (v.today.length) html += '<div class="sec-head">Aujourd\'hui</div>' + listHTML(v.today, { hideDate: true });
      groups.forEach(function (g) {
        const lab = NLP.frDateLabel(g.date, NLP.todayStr());
        const dd = NLP.parseYMD(g.date);
        const full = NLP.DAY_SHORT[dd.getDay()] + ' ' + dd.getDate() + ' ' + NLP.MONTH_SHORT[dd.getMonth()];
        html += '<div class="sec-head">' + esc(lab.text) + (lab.text.indexOf(String(dd.getDate())) < 0 ? ' <span class="sec-sub">' + full + '</span>' : '') + '</div>';
        html += listHTML(g.tasks, { hideDate: true });
      });
      if (!groups.length && !v.overdue.length && !v.today.length) html += emptyHTML(I.upcoming, 'Rien de planifié', 'Tape "dem", "lundi" ou "12/08" en ajoutant une tâche pour la dater');
      html += addRowHTML();
      return html;
    },
    project: function (pid) {
      const p = Store.getProject(pid);
      if (!p) { location.hash = '#/inbox'; return ''; }
      const tasks = Store.byProject(pid);
      let html = '<div class="view-head vh-project"><h1><i class="p-dot" style="background:' + esc(p.color) + '"></i>' + esc(p.name) + '</h1>' +
        '<button class="iconbtn proj-menu-btn" data-pid="' + p.id + '">' + I.dots + '</button></div>';
      html += listHTML(tasks, { hideProject: true });
      html += addRowHTML();
      if (!tasks.length) html += emptyHTML(I.hash, 'Aucune tâche ici', 'Ajoute une tâche ou tape #' + p.name + ' depuis n\'importe où');
      return html;
    },
    browse: function () {
      const c = Store.counts();
      let html = '<div class="view-head"><h1>Parcourir</h1></div><div class="browse">';
      html += '<a class="b-item" href="#/inbox"><span class="b-ic">' + I.inbox + '</span>Boîte de réception<span class="b-cnt">' + (c.inbox || '') + '</span></a>';
      html += '<div class="b-sec">Mes projets</div>';
      Store.activeProjects().forEach(function (p) {
        html += '<a class="b-item" href="#/project/' + p.id + '"><i class="p-dot" style="background:' + esc(p.color) + '"></i>' + esc(p.name) +
          '<span class="b-cnt">' + (c.perProject[p.id] || '') + '</span></a>';
      });
      html += '<button class="b-item b-add" id="b-addproj"><span class="b-ic add">' + I.plus + '</span>Ajouter un projet</button>';
      html += '<div class="b-sec"></div>';
      html += '<a class="b-item" href="#/completed"><span class="b-ic">' + I.check + '</span>Terminées</a>';
      html += '<a class="b-item" href="#/settings"><span class="b-ic">' + I.settings + '</span>Réglages et synchro</a>';
      html += '</div>';
      return html;
    },
    completed: function () {
      const tasks = Store.completed();
      let html = '<div class="view-head"><h1>Terminées</h1></div>';
      if (!tasks.length) html += emptyHTML(I.check, 'Rien de terminé pour l\'instant', 'Les tâches cochées arrivent ici, tape sur le rond pour les restaurer');
      html += tasks.map(function (t) {
        const dd = new Date(t.completedAt);
        const lab = NLP.frDateLabel(NLP.fmt(dd), NLP.todayStr());
        const p = projectOf(t);
        return '<div class="task is-done" data-id="' + t.id + '">' +
          '<button class="check done p4" aria-label="Restaurer">' + I.check + '</button>' +
          '<div class="t-main"><div class="t-title">' + esc(t.title) + '</div>' +
          '<div class="t-meta"><span class="t-meta-l"><span class="t-date later">' + esc(lab.text) + '</span></span>' +
          (p ? '<span class="t-proj">' + esc(p.name) + ' <i style="background:' + esc(p.color) + '"></i></span>' : '') +
          '</div></div></div>';
      }).join('');
      return html;
    },
    search: function () {
      return '<div class="view-head"><h1>Rechercher</h1></div>' +
        '<div class="search-box">' + I.search + '<input id="search-input" type="search" placeholder="Chercher une tâche" autocomplete="off"></div>' +
        '<div id="search-results"></div>';
    },
    settings: function () {
      const s = Store.settings;
      const tok = s.token ? '••••••••' + s.token.slice(-4) : '';
      const c = Store.counts();
      const nDone = Store.completed().length;
      let syncLine;
      if (!s.token) syncLine = 'Mode local : les tâches restent sur cet appareil tant qu\'aucun token n\'est enregistré.';
      else if (Sync.status === 'error') syncLine = Sync.lastError;
      else syncLine = Sync.lastSync ? 'Dernière synchro : ' + new Date(Sync.lastSync).toLocaleString('fr-FR') : 'Pas encore synchronisé.';
      return '<div class="view-head"><h1>Réglages</h1></div>' +
        '<div class="set-sec"><h2>Synchronisation en ligne</h2>' +
        '<p class="set-p">Tes tâches sont enregistrées dans un dépôt GitHub privé (<b>' + esc(s.owner) + '/' + esc(s.repo) + '</b>) et synchronisées entre le PC et l\'iPhone.</p>' +
        '<div class="set-status ' + (Sync.status) + '">' + esc(syncLine) + '</div>' +
        '<label class="set-label">Token GitHub (fine-grained)</label>' +
        '<div class="set-row"><input id="set-token" type="password" placeholder="' + (tok || 'github_pat_...') + '" autocomplete="off">' +
        '<button id="set-token-save" class="btn-red">Enregistrer</button></div>' +
        '<div class="set-row set-actions"><button id="set-sync-now" class="btn-ghost">Synchroniser maintenant</button>' +
        (s.token ? '<button id="set-token-clear" class="btn-ghost danger">Retirer le token</button>' : '') + '</div>' +
        '<details class="set-help"><summary>Créer le token (une fois, 2 min)</summary><ol>' +
        '<li>Sur GitHub (connecté au compte <b>Taaqz-13</b>) : <b>Settings &gt; Developer settings &gt; Personal access tokens &gt; Fine-grained tokens &gt; Generate new token</b>.</li>' +
        '<li>Nom : <b>todo-sync</b>. Expiration : la plus longue possible.</li>' +
        '<li>Repository access : <b>Only select repositories</b> et choisir <b>todo-data</b>.</li>' +
        '<li>Permissions &gt; Repository permissions &gt; <b>Contents : Read and write</b>.</li>' +
        '<li>Générer, copier le token (il commence par <b>github_pat_</b>) et le coller ci-dessus sur chaque appareil.</li>' +
        '</ol></details></div>' +
        '<div class="set-sec"><h2>Données</h2>' +
        '<p class="set-p">' + c.inbox + ' dans l\'inbox, ' + Store.openTasks().length + ' tâches ouvertes, ' + nDone + ' terminées, ' + Store.activeProjects().length + ' projets.</p>' +
        '<div class="set-row set-actions"><button id="set-export" class="btn-ghost">Exporter (JSON)</button>' +
        '<label class="btn-ghost" for="set-import">Importer</label><input type="file" id="set-import" accept=".json" hidden></div></div>' +
        '<div class="set-sec"><h2>Application</h2>' +
        '<p class="set-p">Sur iPhone : ouvrir cette page dans Safari, bouton Partager, puis <b>Sur l\'écran d\'accueil</b>. L\'app se met à jour seule à l\'ouverture.</p>' +
        '<p class="set-p set-version">Tâches v1.0</p></div>';
    }
  };

  /* ================= Router ================= */
  let currentRoute = { name: 'today', pid: null };

  function parseHash() {
    const h = (location.hash || '#/today').replace(/^#\/?/, '');
    const parts = h.split('/');
    if (parts[0] === 'project' && parts[1]) return { name: 'project', pid: parts[1] };
    if (VIEWS[parts[0]]) return { name: parts[0], pid: null };
    return { name: 'today', pid: null };
  }

  function renderView() {
    currentRoute = parseHash();
    const view = $('#view');
    view.innerHTML = currentRoute.name === 'project' ? VIEWS.project(currentRoute.pid) : VIEWS[currentRoute.name]();
    view.scrollTop = 0;
    $('#main').scrollTop = 0;
    /* nav actif */
    $$('.tab, .sb-item').forEach(function (a) {
      const r = a.getAttribute('data-route');
      a.classList.toggle('active', r === '#/' + currentRoute.name);
    });
    $$('#sb-plist .sb-item').forEach(function (a) {
      a.classList.toggle('active', currentRoute.name === 'project' && a.getAttribute('data-route') === '#/project/' + currentRoute.pid);
    });
    if (currentRoute.name === 'search') {
      const inp = $('#search-input');
      inp.addEventListener('input', function () { renderSearchResults(inp.value); });
      setTimeout(function () { inp.focus(); }, 60);
    }
    if (currentRoute.name === 'settings') bindSettings();
    updateCounts();
  }

  function renderSearchResults(q) {
    const res = Store.search(q);
    const box = $('#search-results');
    if (!q.trim()) { box.innerHTML = ''; return; }
    box.innerHTML = res.length ? listHTML(res) : emptyHTML(I.search, 'Aucun résultat', 'Essaie un autre mot');
  }

  /* ================= Sidebar + compteurs ================= */
  function renderSidebarProjects() {
    const c = Store.counts();
    $('#sb-plist').innerHTML = Store.activeProjects().map(function (p) {
      return '<a class="sb-item" data-route="#/project/' + p.id + '" href="#/project/' + p.id + '">' +
        '<i class="p-dot" style="background:' + esc(p.color) + '"></i><span class="sb-txt">' + esc(p.name) + '</span>' +
        '<span class="cnt">' + (c.perProject[p.id] || '') + '</span></a>';
    }).join('');
  }

  function updateCounts() {
    const c = Store.counts();
    $('#tab-badge').textContent = c.today || '';
    $('#tab-badge').style.display = c.today ? '' : 'none';
    $('#sb-cnt-inbox').textContent = c.inbox || '';
    $('#sb-cnt-today').textContent = c.today || '';
    renderSidebarProjects();
    document.title = (c.today ? '(' + c.today + ') ' : '') + 'Tâches';
  }

  /* ================= Statut de synchro ================= */
  function renderSyncStatus() {
    const map = { off: I.cloudOff, syncing: I.cloud, ok: I.cloudOk, error: I.cloudErr };
    const html = map[Sync.status] || I.cloud;
    $('#tb-sync').innerHTML = html;
    $('#tb-sync').className = 'iconbtn sync-' + Sync.status;
    $('#sb-sync').innerHTML = html;
    $('#sb-sync').className = 'iconbtn sync-' + Sync.status;
    let line;
    if (Sync.status === 'off') line = 'Local uniquement';
    else if (Sync.status === 'syncing') line = 'Synchronisation...';
    else if (Sync.status === 'error') line = 'Erreur de synchro';
    else line = Sync.lastSync ? 'Synchro ' + new Date(Sync.lastSync).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
    $('#sb-syncline').textContent = line;
  }

  /* ================= Saisie rapide (composer) ================= */
  const qa = {
    open: false,
    ignored: new Set(),
    projectOverride: undefined,   /* undefined = auto ; null = inbox ; id ; {create:name} */
    priorityOverride: null,
    defaultProject: null,
    defaultDue: null,
    noDefaultDue: false
  };

  function qaContextDefaults() {
    qa.defaultProject = currentRoute.name === 'project' ? currentRoute.pid : null;
    qa.defaultDue = currentRoute.name === 'today' ? NLP.todayStr() : null;
    qa.noDefaultDue = false;
  }

  function openComposer() {
    qaContextDefaults();
    qa.ignored = new Set();
    qa.projectOverride = undefined;
    qa.priorityOverride = null;
    qa.open = true;
    $('#composer').classList.add('on');
    const inp = $('#qa-input');
    inp.value = '';
    renderQA();
    setTimeout(function () { inp.focus(); }, 50);
  }
  function closeComposer() {
    qa.open = false;
    $('#composer').classList.remove('on');
    $('#qa-pmenu').classList.remove('on');
  }

  function qaParse() {
    return NLP.parse($('#qa-input').value, { projects: Store.activeProjects(), ignored: qa.ignored });
  }

  function qaResolved(parsed) {
    /* due : la puce date n'apparait que pour un vrai token date (la recurrence a sa propre puce) */
    let due = parsed.due;
    let dueLabel = null, dueCls = null, dueKey = null;
    const dm = parsed.matches.filter(function (m) { return m.type === 'date'; })[0];
    if (due && dm) { const l = NLP.frDateLabel(due, NLP.todayStr()); dueLabel = dm.label || l.text; dueCls = l.cls; dueKey = 'm:date:' + dm.start; }
    else if (!due && qa.defaultDue && !qa.noDefaultDue) { due = qa.defaultDue; dueLabel = "Aujourd'hui"; dueCls = 'today'; dueKey = 'd:due'; }
    /* projet */
    let proj = null, projKey = null;
    if (qa.projectOverride !== undefined) {
      if (qa.projectOverride && qa.projectOverride.create) { proj = { create: true, name: qa.projectOverride.create }; projKey = 'o:project'; }
      else if (qa.projectOverride) { const p0 = Store.getProject(qa.projectOverride); if (p0) { proj = { id: p0.id, name: p0.name, color: p0.color }; projKey = 'o:project'; } }
      else { proj = null; projKey = null; }
    } else if (parsed.project) {
      const pm = parsed.matches.filter(function (m) { return m.type === 'project'; })[0];
      proj = parsed.project; projKey = pm ? 'm:project:' + pm.start : null;
      if (proj.id) { const pp = Store.getProject(proj.id); if (pp) proj.color = pp.color; }
    } else if (qa.defaultProject) {
      const dp = Store.getProject(qa.defaultProject);
      if (dp) { proj = { id: dp.id, name: dp.name, color: dp.color }; projKey = 'd:project'; }
    }
    /* priorite */
    let prio = qa.priorityOverride || parsed.priority || null;
    let prioKey = qa.priorityOverride ? 'o:priority' : null;
    if (!prioKey && parsed.priority) {
      const pmm = parsed.matches.filter(function (m) { return m.type === 'priority'; })[0];
      prioKey = pmm ? 'm:priority:' + pmm.start : null;
    }
    const rm = parsed.matches.filter(function (m) { return m.type === 'recur'; })[0];
    return {
      title: parsed.title, due: due, dueLabel: dueLabel, dueCls: dueCls, dueKey: dueKey,
      recur: parsed.recur, recurKey: rm ? 'm:recur:' + rm.start : null, recurLabel: rm ? rm.label : (parsed.recur ? NLP.recurLabel(parsed.recur) : null),
      priority: prio, prioKey: prioKey, project: proj, projKey: projKey
    };
  }

  function renderQA() {
    const parsed = qaParse();
    const r = qaResolved(parsed);
    let chips = '';
    if (r.due) chips += '<button class="chip chip-date ' + (r.dueCls || '') + '" data-k="' + esc(r.dueKey || '') + '">' + I.upcoming + esc(r.dueLabel) + '<span class="chip-x">' + I.x + '</span></button>';
    if (r.recur) chips += '<button class="chip" data-k="' + esc(r.recurKey || '') + '">' + I.repeat + esc(r.recurLabel || '') + '<span class="chip-x">' + I.x + '</span></button>';
    if (r.priority && r.priority < 4) chips += '<button class="chip chip-p' + r.priority + '" data-k="' + esc(r.prioKey || '') + '">' + I.flag + 'P' + r.priority + '<span class="chip-x">' + I.x + '</span></button>';
    if (r.project) chips += '<button class="chip" data-k="' + esc(r.projKey || '') + '">' +
      (r.project.create ? I.plus : '<i class="p-dot" style="background:' + esc(r.project.color || '#808080') + '"></i>') +
      esc(r.project.name) + (r.project.create ? ' (nouveau)' : '') + '<span class="chip-x">' + I.x + '</span></button>';
    $('#qa-chips').innerHTML = chips;
    /* bouton projet */
    $('#qa-project').innerHTML = (r.project ? '<i class="p-dot" style="background:' + esc(r.project.color || '#808080') + '"></i>' + esc(r.project.name) : I.inbox + 'Inbox');
    /* bouton priorite */
    const fp = r.priority && r.priority < 4 ? r.priority : null;
    $('#qa-flag').innerHTML = I.flag + (fp ? '<b class="qf-p' + fp + '">P' + fp + '</b>' : '');
    /* autocomplete projet */
    renderQAProjectMenu();
    $('#qa-submit').disabled = !r.title;
  }

  function renderQAProjectMenu() {
    const inp = $('#qa-input');
    const menu = $('#qa-pmenu');
    const m = /#([^\s#]*)$/.exec(inp.value);
    if (!m || document.activeElement !== inp) { menu.classList.remove('on'); return; }
    const key = NLP.foldKey(m[1]);
    const list = Store.activeProjects().filter(function (p) { return !key || NLP.foldKey(p.name).indexOf(key) === 0; });
    let html = list.map(function (p) {
      return '<button class="menu-item" data-act="pick" data-id="' + p.id + '"><i class="p-dot" style="background:' + esc(p.color) + '"></i>' + esc(p.name) + '</button>';
    }).join('');
    if (m[1] && !list.some(function (p) { return NLP.foldKey(p.name) === key; })) {
      html += '<button class="menu-item" data-act="create" data-name="' + esc(m[1]) + '">' + I.plus + 'Créer « ' + esc(m[1]) + ' »</button>';
    }
    if (!html) { menu.classList.remove('on'); return; }
    menu.innerHTML = html;
    menu.classList.add('on');
  }

  function qaSubmit() {
    const parsed = qaParse();
    const r = qaResolved(parsed);
    if (!r.title) {
      $('#qa-input').classList.add('shake');
      setTimeout(function () { $('#qa-input').classList.remove('shake'); }, 400);
      return;
    }
    let projectId = null;
    if (r.project) {
      if (r.project.create) {
        const np = Store.addProject(r.project.name, PROJECT_COLORS[Store.activeProjects().length % PROJECT_COLORS.length]);
        projectId = np ? np.id : null;
      } else projectId = r.project.id;
    }
    Store.addTask({ title: r.title, projectId: projectId, due: r.due, priority: r.priority || 4, recur: r.recur });
    haptic();
    const inp = $('#qa-input');
    inp.value = '';
    qa.ignored = new Set();
    renderQA();
    inp.focus();
  }

  /* ================= Edition d'une tache ================= */
  let edTaskId = null;

  function openEditor(id) {
    const t = Store.getTask(id);
    if (!t) return;
    edTaskId = id;
    $('#ed-title').value = t.title;
    $('#ed-notes').value = t.notes || '';
    $('#ed-date').value = t.due || '';
    /* projets */
    const sel = $('#ed-project');
    sel.innerHTML = '<option value="">Boîte de réception</option>' + Store.activeProjects().map(function (p) {
      return '<option value="' + p.id + '"' + (t.projectId === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>';
    }).join('');
    /* priorite */
    $$('#ed-prio button').forEach(function (b) {
      b.classList.toggle('sel', +b.getAttribute('data-p') === (t.priority || 4));
    });
    /* recurrence */
    const rsel = $('#ed-recur');
    let opts = '<option value="">Pas de répétition</option><option value="day">Tous les jours</option><option value="week">Toutes les semaines</option><option value="month">Tous les mois</option>';
    let cur = '';
    if (t.recur) {
      cur = t.recur.freq;
      if (t.recur.freq === 'day' && (t.recur.interval || 1) > 1) { opts += '<option value="keep">' + esc(NLP.recurLabel(t.recur)) + '</option>'; cur = 'keep'; }
    }
    rsel.innerHTML = opts;
    rsel.value = cur;
    $('#editor').classList.add('on');
    autoGrow($('#ed-title'));
  }

  function closeEditor() { $('#editor').classList.remove('on'); edTaskId = null; }

  function saveEditor() {
    const t = Store.getTask(edTaskId);
    if (!t) { closeEditor(); return; }
    const title = $('#ed-title').value.trim();
    if (!title) { $('#ed-title').classList.add('shake'); setTimeout(function () { $('#ed-title').classList.remove('shake'); }, 400); return; }
    const due = $('#ed-date').value || null;
    const pid = $('#ed-project').value || null;
    const pr = +($('#ed-prio .sel') ? $('#ed-prio .sel').getAttribute('data-p') : 4);
    const rv = $('#ed-recur').value;
    let recur = null;
    const ref = due ? NLP.parseYMD(due) : new Date();
    if (rv === 'keep') recur = t.recur;
    else if (rv === 'day') recur = { freq: 'day', interval: 1 };
    else if (rv === 'week') recur = { freq: 'week', weekday: ref.getDay() };
    else if (rv === 'month') recur = { freq: 'month', day: ref.getDate() };
    Store.updateTask(edTaskId, { title: title, notes: $('#ed-notes').value.trim(), due: due, projectId: pid, priority: pr, recur: recur });
    closeEditor();
  }

  function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }

  /* ================= Projets (creation / renommage) ================= */
  let pmEditId = null, pmColor = PROJECT_COLORS[0];

  function openProjectModal(editId) {
    pmEditId = editId || null;
    const p = editId ? Store.getProject(editId) : null;
    $('#pm-title').textContent = p ? 'Modifier le projet' : 'Nouveau projet';
    $('#pm-save').textContent = p ? 'Enregistrer' : 'Ajouter';
    $('#pm-name').value = p ? p.name : '';
    pmColor = p ? p.color : PROJECT_COLORS[(Store.activeProjects().length) % PROJECT_COLORS.length];
    $('#pm-colors').innerHTML = PROJECT_COLORS.map(function (c) {
      return '<button class="pm-color' + (c === pmColor ? ' sel' : '') + '" data-c="' + c + '" style="background:' + c + '"></button>';
    }).join('');
    $('#pmodal').classList.add('on');
    setTimeout(function () { $('#pm-name').focus(); }, 50);
  }
  function closeProjectModal() { $('#pmodal').classList.remove('on'); }

  function saveProjectModal() {
    const name = $('#pm-name').value.trim();
    if (!name) return;
    if (pmEditId) Store.updateProject(pmEditId, { name: name, color: pmColor });
    else {
      const p = Store.addProject(name, pmColor);
      if (p) location.hash = '#/project/' + p.id;
    }
    closeProjectModal();
  }

  /* ================= Confirmation ================= */
  let cfAction = null;
  function confirmDlg(msg, okLabel, action) {
    $('#cf-msg').textContent = msg;
    $('#cf-ok').textContent = okLabel || 'Supprimer';
    cfAction = action;
    $('#cfmodal').classList.add('on');
  }

  /* ================= Menu projet (renommer / supprimer) ================= */
  function projectMenu(pid, anchor) {
    const menu = $('#ctx-menu');
    menu.innerHTML =
      '<button class="menu-item" data-act="rename">Renommer / couleur</button>' +
      '<button class="menu-item danger" data-act="delete">Supprimer le projet</button>';
    menu.classList.add('on');
    const r = anchor.getBoundingClientRect();
    menu.style.top = (r.bottom + 6) + 'px';
    menu.style.right = Math.max(10, window.innerWidth - r.right) + 'px';
    menu.onclick = function (e) {
      const b = e.target.closest('.menu-item');
      if (!b) return;
      menu.classList.remove('on');
      if (b.getAttribute('data-act') === 'rename') openProjectModal(pid);
      else confirmDlg('Supprimer ce projet ? Ses tâches retournent dans la boîte de réception.', 'Supprimer', function () {
        Store.deleteProject(pid);
        location.hash = '#/inbox';
      });
    };
  }

  /* ================= Terminer une tache ================= */
  function completeFromRow(row) {
    const id = row.getAttribute('data-id');
    const t = Store.getTask(id);
    if (!t) return;
    if (t.completedAt) { Store.uncompleteTask(id); return; }
    row.classList.add('leaving');
    haptic();
    setTimeout(function () {
      const res = Store.completeTask(id);
      if (!res) return;
      if (res.rescheduled) {
        const lab = NLP.frDateLabel(res.task.due, NLP.todayStr());
        toast('Reportée : ' + lab.text, 'Annuler', function () { Store.undoComplete(id, res.snapshot); });
      } else {
        toast('1 tâche terminée', 'Annuler', function () { Store.undoComplete(id, res.snapshot); });
      }
    }, 220);
  }

  /* ================= Reglages ================= */
  function bindSettings() {
    $('#set-token-save').onclick = function () {
      const v = $('#set-token').value.trim();
      if (!v) return;
      Store.settings.token = v;
      Store.saveSettings();
      $('#set-token').value = '';
      toast('Token enregistré, synchronisation...');
      Sync.now('token').then(function () { if (currentRoute.name === 'settings') renderView(); });
    };
    const clr = $('#set-token-clear');
    if (clr) clr.onclick = function () {
      confirmDlg('Retirer le token de cet appareil ? Les tâches restent en local.', 'Retirer', function () {
        Store.settings.token = '';
        Store.saveSettings();
        Sync.status = 'off';
        renderView(); renderSyncStatus();
      });
    };
    $('#set-sync-now').onclick = function () {
      Sync.now('manual').then(function () { if (currentRoute.name === 'settings') renderView(); });
    };
    $('#set-export').onclick = function () {
      const blob = new Blob([JSON.stringify(Store.toDoc(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'taches-export-' + NLP.todayStr() + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
    };
    $('#set-import').onchange = function () {
      const f = this.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = function () {
        try {
          const doc = JSON.parse(rd.result);
          Store.applyDoc(Store.merge(Store.toDoc(), doc));
          Store.mutate('import');
          toast('Import fusionné');
          renderView();
        } catch (e) { toast('Fichier invalide'); }
      };
      rd.readAsText(f);
    };
  }

  /* ================= Evenements globaux ================= */
  function bind() {
    window.addEventListener('hashchange', renderView);

    /* clic dans la vue */
    $('#view').addEventListener('click', function (e) {
      const chk = e.target.closest('.check');
      if (chk) { e.stopPropagation(); completeFromRow(chk.closest('.task')); return; }
      const row = e.target.closest('.task');
      if (row) { openEditor(row.getAttribute('data-id')); return; }
      if (e.target.closest('.add-row')) { openComposer(); return; }
      const pm = e.target.closest('.proj-menu-btn');
      if (pm) { projectMenu(pm.getAttribute('data-pid'), pm); return; }
      if (e.target.closest('#b-addproj')) { openProjectModal(); return; }
    });

    /* boutons fixes */
    $('#fab').addEventListener('click', openComposer);
    $('#sb-add').addEventListener('click', openComposer);
    $('#sb-addproj').addEventListener('click', function () { openProjectModal(); });
    $('#tb-sync').addEventListener('click', function () { if (Sync.enabled()) Sync.now('tap'); else location.hash = '#/settings'; });
    $('#sb-sync').addEventListener('click', function () { if (Sync.enabled()) Sync.now('tap'); else location.hash = '#/settings'; });
    $('#toast-action').addEventListener('click', function () {
      if (toastUndo) toastUndo();
      $('#toast').classList.remove('on');
    });

    /* composer */
    $('#composer').addEventListener('click', function (e) { if (e.target === this) closeComposer(); });
    $('#qa-input').addEventListener('input', renderQA);
    $('#qa-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); qaSubmit(); }
      if (e.key === 'Escape') closeComposer();
    });
    $('#qa-input').addEventListener('blur', function () {
      setTimeout(function () { $('#qa-pmenu').classList.remove('on'); }, 150);
    });
    $('#qa-submit').addEventListener('click', qaSubmit);
    $('#qa-cancel').addEventListener('click', closeComposer);
    $('#qa-chips').addEventListener('click', function (e) {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      const k = chip.getAttribute('data-k');
      if (!k) return;
      if (k.indexOf('m:') === 0) qa.ignored.add(k.slice(2));
      else if (k === 'o:project') qa.projectOverride = undefined;
      else if (k === 'o:priority') qa.priorityOverride = null;
      else if (k === 'd:due') qa.noDefaultDue = true;
      else if (k === 'd:project') qa.defaultProject = null;
      renderQA();
      $('#qa-input').focus();
    });
    $('#qa-pmenu').addEventListener('mousedown', function (e) { e.preventDefault(); });
    $('#qa-pmenu').addEventListener('click', function (e) {
      const b = e.target.closest('.menu-item');
      if (!b) return;
      const inp = $('#qa-input');
      inp.value = inp.value.replace(/#([^\s#]*)$/, '').replace(/\s+$/, ' ');
      if (b.getAttribute('data-act') === 'pick') qa.projectOverride = b.getAttribute('data-id');
      else qa.projectOverride = { create: b.getAttribute('data-name') };
      $('#qa-pmenu').classList.remove('on');
      renderQA();
      inp.focus();
    });
    $('#qa-project').addEventListener('click', function () {
      const menu = $('#qa-pmenu');
      if (menu.classList.contains('on')) { menu.classList.remove('on'); return; }
      let html = '<button class="menu-item" data-act="pick" data-id="">' + I.inbox + 'Boîte de réception</button>';
      html += Store.activeProjects().map(function (p) {
        return '<button class="menu-item" data-act="pick" data-id="' + p.id + '"><i class="p-dot" style="background:' + esc(p.color) + '"></i>' + esc(p.name) + '</button>';
      }).join('');
      menu.innerHTML = html;
      menu.classList.add('on');
    });
    $('#qa-flag').addEventListener('click', function () {
      qa.priorityOverride = qa.priorityOverride ? (qa.priorityOverride % 4) + 1 : 1;
      if (qa.priorityOverride === 4) qa.priorityOverride = null;
      renderQA();
      $('#qa-input').focus();
    });

    /* editeur */
    $('#editor').addEventListener('click', function (e) { if (e.target === this) closeEditor(); });
    $('#ed-close').addEventListener('click', closeEditor);
    $('#ed-save').addEventListener('click', saveEditor);
    $('#ed-title').addEventListener('input', function () { autoGrow(this); });
    $('#ed-title').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); saveEditor(); } });
    $('#ed-delete').addEventListener('click', function () {
      const id = edTaskId;
      confirmDlg('Supprimer cette tâche ?', 'Supprimer', function () {
        const t = Store.getTask(id);
        Store.deleteTask(id);
        closeEditor();
        toast('Tâche supprimée', 'Annuler', function () { Store.updateTask(id, { deletedAt: null }); });
      });
    });
    $$('#ed-prio button').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('#ed-prio button').forEach(function (x) { x.classList.remove('sel'); });
        b.classList.add('sel');
      });
    });
    $$('.ed-quick button').forEach(function (b) {
      b.addEventListener('click', function () {
        const v = b.getAttribute('data-d');
        const today = NLP.parseYMD(NLP.todayStr());
        let d = '';
        if (v === 'today') d = NLP.todayStr();
        else if (v === 'tomorrow') d = NLP.fmt(NLP.addDays(today, 1));
        else if (v === 'weekend') d = NLP.parse('week-end', { today: NLP.todayStr() }).due;
        else if (v === 'nextweek') d = NLP.parse('sem pro', { today: NLP.todayStr() }).due;
        $('#ed-date').value = d;
      });
    });

    /* modales projet + confirm */
    $('#pmodal').addEventListener('click', function (e) { if (e.target === this) closeProjectModal(); });
    $('#pm-cancel').addEventListener('click', closeProjectModal);
    $('#pm-save').addEventListener('click', saveProjectModal);
    $('#pm-name').addEventListener('keydown', function (e) { if (e.key === 'Enter') saveProjectModal(); });
    $('#pm-colors').addEventListener('click', function (e) {
      const b = e.target.closest('.pm-color');
      if (!b) return;
      pmColor = b.getAttribute('data-c');
      $$('#pm-colors .pm-color').forEach(function (x) { x.classList.toggle('sel', x === b); });
    });
    $('#cfmodal').addEventListener('click', function (e) { if (e.target === this) this.classList.remove('on'); });
    $('#cf-cancel').addEventListener('click', function () { $('#cfmodal').classList.remove('on'); });
    $('#cf-ok').addEventListener('click', function () {
      $('#cfmodal').classList.remove('on');
      if (cfAction) cfAction();
      cfAction = null;
    });

    /* fermer le menu contextuel au clic ailleurs */
    document.addEventListener('click', function (e) {
      const menu = $('#ctx-menu');
      if (menu.classList.contains('on') && !e.target.closest('#ctx-menu') && !e.target.closest('.proj-menu-btn')) {
        menu.classList.remove('on');
      }
    });

    /* raccourcis clavier */
    document.addEventListener('keydown', function (e) {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      if (e.key === 'Escape') {
        if (qa.open) closeComposer();
        else if (edTaskId) closeEditor();
        else { closeProjectModal(); $('#cfmodal').classList.remove('on'); }
        return;
      }
      if (typing) return;
      if (e.key === 'q' || e.key === 'n') { e.preventDefault(); openComposer(); }
      if (e.key === '/') { e.preventDefault(); location.hash = '#/search'; }
    });
  }

  /* ================= Demarrage ================= */
  function iconize() {
    $$('[data-icon]').forEach(function (el) {
      const ic = I[el.getAttribute('data-icon')];
      if (ic) el.innerHTML = ic;
    });
  }

  function init() {
    Store.load();
    iconize();
    bind();
    Store.subscribe(function (kind) {
      if (kind === 'sync-status') { renderSyncStatus(); return; }
      renderView();
      if (kind === 'sync' && currentRoute.name === 'settings') return;
    });
    renderView();
    renderSyncStatus();
    Sync.init();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('sw', e); });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
