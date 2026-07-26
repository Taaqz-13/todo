/* Fenetre de capture : saisie + raccourcis (NLP), envoi au service worker. */
(function () {
  'use strict';

  const $ = function (s) { return document.querySelector(s); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function svg(inner) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  }
  const I = {
    cal: svg('<rect x="3.75" y="5" width="16.5" height="15" rx="2.5"/><path d="M3.75 9.5h16.5M8.2 2.9v3.4M15.8 2.9v3.4"/>'),
    flag: svg('<path d="M6.2 21V4.4"/><path d="M6.2 5.1c2.1-1.2 4.1-1.2 6.1 0s4 1.2 5.5.2v7.6c-1.5 1-3.5 1-5.5-.2s-4-1.2-6.1 0"/>'),
    repeat: svg('<path d="M17.2 2.8l2.8 2.8-2.8 2.8"/><path d="M19.6 5.6H8.4a4.2 4.2 0 00-4.2 4.2v.9"/><path d="M6.8 21.2L4 18.4l2.8-2.8"/><path d="M4.4 18.4h11.2a4.2 4.2 0 004.2-4.2v-.9"/>'),
    inbox: svg('<rect x="3.75" y="4.75" width="16.5" height="14.5" rx="2.5"/><path d="M3.75 13.25h4.7l1.7 2.5h3.7l1.7-2.5h4.7"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    x: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
    up: svg('<path d="M12 19V5.5M6.2 11.3L12 5.5l5.8 5.8"/>'),
    link: svg('<path d="M9.5 13.5a4 4 0 015.7-5.7l2.3 2.3a4 4 0 01-5.7 5.7"/><path d="M14.5 10.5a4 4 0 01-5.7 5.7l-2.3-2.3a4 4 0 015.7-5.7"/>'),
    gear: svg('<path d="M4 7.2h16M4 12h16M4 16.8h16"/>'),
    back: svg('<path d="M15 6.5L9.5 12l5.5 5.5"/>'),
    check: svg('<path d="M5 12.4l4 4 9.5-10"/>')
  };

  /* ---------- Etat local de la saisie ---------- */
  const ui = {
    projects: [],
    projectOverride: undefined,   /* undefined = auto (#tag), null = inbox, id, {create:nom} */
    priorityOverride: null,
    ignored: new Set(),
    page: null,                   /* {title, url} si la page est jointe */
    attach: false,
    busy: false
  };

  function send(msg) {
    return new Promise(function (resolve) {
      chrome.runtime.sendMessage(msg, function (r) { resolve(r || {}); });
    });
  }

  /* ---------- Analyse + puces ---------- */
  function parsed() {
    return NLP.parse($('#qa').value, { projects: ui.projects, ignored: ui.ignored });
  }

  function resolved() {
    const p = parsed();
    const dm = p.matches.filter(function (m) { return m.type === 'date'; })[0];
    const rm = p.matches.filter(function (m) { return m.type === 'recur'; })[0];

    let proj = null, projKey = null;
    if (ui.projectOverride !== undefined) {
      if (ui.projectOverride && ui.projectOverride.create) {
        proj = { create: true, name: ui.projectOverride.create }; projKey = 'o';
      } else if (ui.projectOverride) {
        const found = ui.projects.filter(function (x) { return x.id === ui.projectOverride; })[0];
        if (found) { proj = { id: found.id, name: found.name, color: found.color }; projKey = 'o'; }
      }
    } else if (p.project) {
      const pm = p.matches.filter(function (m) { return m.type === 'project'; })[0];
      proj = p.project; projKey = pm ? 'm:project:' + pm.start : null;
      if (proj.id) {
        const full = ui.projects.filter(function (x) { return x.id === proj.id; })[0];
        if (full) proj.color = full.color;
      }
    }

    const prio = ui.priorityOverride || p.priority || null;
    const prioKey = ui.priorityOverride ? 'o' : (p.priority ? 'm:priority:' + p.matches.filter(function (m) { return m.type === 'priority'; })[0].start : null);

    return {
      title: p.title, due: p.due, recur: p.recur,
      dateLabel: dm ? dm.label : null, dateKey: dm ? 'm:date:' + dm.start : null,
      recurLabel: rm ? rm.label : null, recurKey: rm ? 'm:recur:' + rm.start : null,
      priority: prio, prioKey: prioKey, project: proj, projKey: projKey
    };
  }

  function render() {
    const r = resolved();
    let chips = '';
    if (r.dateLabel) {
      const cls = r.due ? NLP.frDateLabel(r.due, NLP.todayStr()).cls : '';
      chips += '<button class="chip ' + cls + '" data-k="' + esc(r.dateKey) + '">' + I.cal + esc(r.dateLabel) + '<span class="x">' + I.x + '</span></button>';
    }
    if (r.recurLabel) chips += '<button class="chip" data-k="' + esc(r.recurKey) + '">' + I.repeat + esc(r.recurLabel) + '<span class="x">' + I.x + '</span></button>';
    if (r.priority && r.priority < 4) chips += '<button class="chip cp' + r.priority + '" data-k="' + esc(r.prioKey || '') + '">' + I.flag + 'P' + r.priority + '<span class="x">' + I.x + '</span></button>';
    if (r.project) {
      chips += '<button class="chip" data-k="' + esc(r.projKey || '') + '">' +
        (r.project.create ? I.plus : '<i class="dot" style="background:' + esc(r.project.color || '#808080') + '"></i>') +
        esc(r.project.name) + (r.project.create ? ' (nouveau)' : '') + '<span class="x">' + I.x + '</span></button>';
    }
    if (ui.attach && ui.page) {
      let host = ui.page.url;
      try { host = new URL(ui.page.url).hostname.replace(/^www\./, ''); } catch (e) {}
      chips += '<button class="chip" data-k="page">' + I.link + esc(host) + '<span class="x">' + I.x + '</span></button>';
    }
    $('#chips').innerHTML = chips;

    $('#b-proj').innerHTML = r.project
      ? '<i class="dot" style="background:' + esc(r.project.color || '#808080') + '"></i>' + esc(r.project.name)
      : I.inbox + 'Inbox';
    const fp = r.priority && r.priority < 4 ? r.priority : null;
    $('#b-flag').innerHTML = I.flag + (fp ? '<b class="bp' + fp + '">P' + fp + '</b>' : '');
    $('#b-page').innerHTML = I.link;
    $('#b-page').classList.toggle('act', ui.attach);
    $('#b-add').disabled = !r.title && !(ui.attach && ui.page);
    renderProjectMenu();
  }

  function renderProjectMenu() {
    const inp = $('#qa');
    const menu = $('#pmenu');
    const m = /#([^\s#]*)$/.exec(inp.value);
    if (!m || document.activeElement !== inp) { if (!menu.dataset.forced) menu.classList.remove('on'); return; }
    delete menu.dataset.forced;
    const key = NLP.foldKey(m[1]);
    const list = ui.projects.filter(function (p) { return !key || NLP.foldKey(p.name).indexOf(key) === 0; });
    let html = list.map(function (p) {
      return '<button class="mi" data-act="pick" data-id="' + p.id + '"><i class="dot" style="background:' + esc(p.color) + '"></i>' + esc(p.name) + '</button>';
    }).join('');
    if (m[1] && !list.some(function (p) { return NLP.foldKey(p.name) === key; })) {
      html += '<button class="mi" data-act="create" data-name="' + esc(m[1]) + '">' + I.plus + 'Créer « ' + esc(m[1]) + ' »</button>';
    }
    if (!html) { menu.classList.remove('on'); return; }
    menu.innerHTML = html;
    menu.classList.add('on');
  }

  /* ---------- Enregistrement ---------- */
  function flash(text) {
    const el = $('#flash');
    el.innerHTML = I.check + '<span>' + esc(text) + '</span>';
    el.classList.add('on');
    setTimeout(function () { el.classList.remove('on'); }, 1400);
  }

  async function save(keepOpen) {
    if (ui.busy) return;
    const r = resolved();
    let title = r.title;
    if (!title && ui.attach && ui.page) title = ui.page.title || ui.page.url;
    if (!title) {
      $('#qa').classList.add('shake');
      setTimeout(function () { $('#qa').classList.remove('shake'); }, 340);
      return;
    }

    const op = { task: null };
    let projectId = null;
    if (r.project) {
      if (r.project.create) {
        op.project = Core.newProject(r.project.name, Core.pickColor(ui.projects.length));
        projectId = op.project.id;
      } else {
        projectId = r.project.id;
      }
    }
    op.task = Core.newTask({
      title: title,
      notes: (ui.attach && ui.page) ? ui.page.url : '',
      projectId: projectId,
      due: r.due || null,
      priority: r.priority || 4,
      recur: r.recur || null
    });

    ui.busy = true;
    const res = await send({ type: 'capture', op: op });
    ui.busy = false;
    if (!res.ok) { setStatus('Capture impossible, réessaie.', 'err'); return; }

    if (op.project) ui.projects = ui.projects.concat([op.project]);

    if (keepOpen) {
      $('#qa').value = '';
      ui.ignored = new Set();
      ui.projectOverride = undefined;
      ui.priorityOverride = null;
      ui.attach = false;
      render();
      $('#qa').focus();
      flash('Enregistré');
      refreshStatus();
    } else {
      flash('Enregistré');
      setTimeout(function () { window.close(); }, 420);
    }
  }

  /* ---------- Statut ---------- */
  function setStatus(text, cls) {
    const el = $('#status');
    el.textContent = text;
    el.className = 'status' + (cls ? ' ' + cls : '');
  }

  async function refreshStatus() {
    const st = await send({ type: 'state' });
    if (st.projects) ui.projects = st.projects;
    if (!st.settings || !st.settings.hasToken) {
      setStatus('Token à ajouter dans les réglages', 'err');
      return st;
    }
    if (st.pending) { setStatus(st.pending + ' en attente d\'envoi', 'err'); return st; }
    if (st.lastError) { setStatus(st.lastError, 'err'); return st; }
    if (st.lastSync) {
      setStatus('Synchronisé ' + new Date(st.lastSync).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), 'ok');
    } else {
      setStatus('Prêt');
    }
    return st;
  }

  /* ---------- Reglages ---------- */
  function showPane(which) {
    $('#capture').classList.toggle('on', which === 'capture');
    $('#settings').classList.toggle('on', which === 'settings');
    if (which === 'capture') $('#qa').focus();
    else $('#s-token').focus();
  }

  async function openSettings() {
    const st = await send({ type: 'state' });
    const s = st.settings || {};
    $('#s-token').value = '';
    $('#s-token').placeholder = s.tokenHint || 'github_pat_...';
    $('#s-owner').value = s.owner || '';
    $('#s-repo').value = s.repo || '';
    $('#s-branch').value = s.branch || 'main';
    $('#s-path').value = s.path || 'data.json';
    $('#s-status').textContent = s.hasToken ? 'Token déjà enregistré sur ce navigateur.' : 'Aucun token enregistré.';
    $('#s-status').className = 'status' + (s.hasToken ? ' ok' : ' err');
    showPane('settings');
  }

  async function saveSettings() {
    const patch = {
      owner: $('#s-owner').value.trim(),
      repo: $('#s-repo').value.trim(),
      branch: $('#s-branch').value.trim() || 'main',
      path: $('#s-path').value.trim() || 'data.json'
    };
    const tok = $('#s-token').value.trim();
    if (tok) patch.token = tok;
    const r = await send({ type: 'saveSettings', patch: patch });
    $('#s-token').value = '';
    if (r.lastError) {
      $('#s-status').textContent = r.lastError;
      $('#s-status').className = 'status err';
    } else {
      $('#s-status').textContent = r.hasToken ? 'Enregistré, synchronisation vérifiée.' : 'Enregistré (token manquant).';
      $('#s-status').className = 'status ' + (r.hasToken ? 'ok' : 'err');
      if (r.hasToken) setTimeout(function () { showPane('capture'); refreshStatus(); }, 900);
    }
  }

  /* ---------- Liaisons ---------- */
  function bind() {
    const inp = $('#qa');
    inp.addEventListener('input', render);
    inp.addEventListener('keydown', function (e) {
      const menu = $('#pmenu');
      const open = menu.classList.contains('on');

      /* Fleches : surligne un projet de la liste. Entree n'y touche pas : elle enregistre,
         car le projet est deja resolu par la saisie (#tag). Tab prend la suggestion. */
      if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        const items = Array.prototype.slice.call(menu.querySelectorAll('.mi'));
        if (!items.length) return;
        let i = items.indexOf(menu.querySelector('.mi.sel'));
        i = e.key === 'ArrowDown' ? (i + 1) % items.length : (i <= 0 ? items.length - 1 : i - 1);
        items.forEach(function (el) { el.classList.remove('sel'); });
        items[i].classList.add('sel');
        items[i].scrollIntoView({ block: 'nearest' });
        return;
      }
      if (open && e.key === 'Tab') {
        const target = menu.querySelector('.mi.sel') || menu.querySelector('.mi');
        if (target) { e.preventDefault(); target.click(); return; }
      }
      if (open && e.key === 'Enter') {
        const sel = menu.querySelector('.mi.sel');
        if (sel) { e.preventDefault(); sel.click(); return; }
      }
      if (e.key === 'Enter') { e.preventDefault(); menu.classList.remove('on'); save(e.ctrlKey || e.metaKey); return; }
      if (e.key === 'Escape') {
        if (open) { e.preventDefault(); menu.classList.remove('on'); delete menu.dataset.forced; return; }
        window.close();
      }
    });

    $('#b-add').addEventListener('click', function () { save(false); });

    $('#chips').addEventListener('click', function (e) {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      const k = chip.getAttribute('data-k');
      if (k === 'page') ui.attach = false;
      else if (k === 'o') { ui.projectOverride = undefined; ui.priorityOverride = null; }
      else if (k && k.indexOf('m:') === 0) ui.ignored.add(k.slice(2));
      render();
      $('#qa').focus();
    });

    $('#pmenu').addEventListener('mousedown', function (e) { e.preventDefault(); });
    $('#pmenu').addEventListener('click', function (e) {
      const b = e.target.closest('.mi');
      if (!b) return;
      const inp2 = $('#qa');
      inp2.value = inp2.value.replace(/#([^\s#]*)$/, '');
      if (b.getAttribute('data-act') === 'pick') ui.projectOverride = b.getAttribute('data-id');
      else ui.projectOverride = { create: b.getAttribute('data-name') };
      $('#pmenu').classList.remove('on');
      render();
      inp2.focus();
    });

    $('#b-proj').addEventListener('click', function () {
      const menu = $('#pmenu');
      if (menu.classList.contains('on')) { menu.classList.remove('on'); delete menu.dataset.forced; return; }
      let html = '<button class="mi" data-act="pick" data-id="">' + I.inbox + 'Boîte de réception</button>';
      html += ui.projects.map(function (p) {
        return '<button class="mi" data-act="pick" data-id="' + p.id + '"><i class="dot" style="background:' + esc(p.color) + '"></i>' + esc(p.name) + '</button>';
      }).join('');
      menu.innerHTML = html;
      menu.dataset.forced = '1';
      menu.classList.add('on');
    });

    $('#b-flag').addEventListener('click', function () {
      const cur = ui.priorityOverride || 4;
      const next = cur >= 3 ? null : cur + 1;
      ui.priorityOverride = ui.priorityOverride ? next : 1;
      render();
      $('#qa').focus();
    });

    $('#b-page').addEventListener('click', function () {
      if (!ui.page) return;
      ui.attach = !ui.attach;
      const inp3 = $('#qa');
      if (ui.attach && !inp3.value.trim() && ui.page.title) inp3.value = ui.page.title;
      render();
      inp3.focus();
    });

    $('#b-open').addEventListener('click', function () {
      chrome.tabs.create({ url: 'https://taaqz-13.github.io/todo/' });
    });
    $('#b-set').addEventListener('click', openSettings);
    $('#b-back').addEventListener('click', function () { showPane('capture'); refreshStatus(); });
    $('#b-save').addEventListener('click', saveSettings);
    $('#s-token').addEventListener('keydown', function (e) { if (e.key === 'Enter') saveSettings(); });
    $('#b-sync').addEventListener('click', async function () {
      $('#s-status').textContent = 'Synchronisation...';
      $('#s-status').className = 'status';
      const r = await send({ type: 'sync' });
      $('#s-status').textContent = r.lastError || 'Synchronisation réussie.';
      $('#s-status').className = 'status ' + (r.lastError ? 'err' : 'ok');
      if (r.projects) ui.projects = r.projects;
    });
  }

  async function init() {
    showPane('capture');
    bind();
    render();

    const st = await refreshStatus();
    if (st.settings && !st.settings.hasToken) openSettings();
    render();

    /* page en cours, pour la joindre en un clic */
    if (chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const t = tabs && tabs[0];
        if (t && t.url && /^https?:/.test(t.url)) {
          ui.page = { title: (t.title || '').trim(), url: t.url };
          render();
        } else {
          $('#b-page').style.display = 'none';
        }
      });
    }

    /* rafraichit la liste des projets en arriere-plan */
    send({ type: 'sync' }).then(function (r) {
      if (r && r.projects) { ui.projects = r.projects; render(); }
      refreshStatus();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
