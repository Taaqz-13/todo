/* Service worker : file d'attente, envoi vers GitHub, menu contextuel, badge.
   Toute capture est d'abord ecrite en file locale (donc jamais perdue), puis envoyee.
   Si l'envoi echoue (hors ligne, token absent), la file est rejouee plus tard. */
importScripts('vendor/nlp.js', 'shared/core.js');

const RETRY_ALARM = 'todo-retry';

/* ---------- Stockage ---------- */
async function getState() {
  const d = await chrome.storage.local.get(['settings', 'queue', 'cache', 'lastSync', 'lastError']);
  return {
    settings: Object.assign({}, Core.DEFAULTS, d.settings || {}),
    queue: d.queue || [],
    cache: d.cache || Core.emptyDoc(),
    lastSync: d.lastSync || null,
    lastError: d.lastError || ''
  };
}
function setState(patch) { return chrome.storage.local.set(patch); }

/* Verrou : les lectures-modifications-ecritures de la file ne doivent pas se croiser
   (deux captures rapprochees, ou une capture pendant un envoi). */
let lock = Promise.resolve();
function withLock(fn) {
  const run = lock.then(fn, fn);
  lock = run.then(function () {}, function () {});
  return run;
}

/* ---------- Badge ---------- */
let badgeTimer = null;
async function paintBadge(pending, flash) {
  if (badgeTimer) { clearTimeout(badgeTimer); badgeTimer = null; }
  if (flash) {
    await chrome.action.setBadgeBackgroundColor({ color: '#058527' });
    await chrome.action.setBadgeText({ text: 'OK' });
    badgeTimer = setTimeout(function () { badgeTimer = null; paintBadge(pending); }, 1800);
    return;
  }
  if (pending > 0) {
    await chrome.action.setBadgeBackgroundColor({ color: '#eb8909' });
    await chrome.action.setBadgeText({ text: String(pending) });
  } else {
    await chrome.action.setBadgeText({ text: '' });
  }
}

/* ---------- Envoi ---------- */
let flushing = false;
let rerun = false;

async function flushQueue(opts) {
  opts = opts || {};
  if (flushing) { rerun = true; return getState(); }

  const st = await getState();
  if (!st.settings.token) {
    await setState({ lastError: st.queue.length ? 'Token manquant : à ajouter dans les réglages de l\'extension.' : '' });
    await paintBadge(st.queue.length);
    return getState();
  }

  flushing = true;
  try {
    const batch = st.queue.slice();
    const res = await Core.flush(fetch, st.settings, batch);

    /* On ne retire que ce qui vient d'etre envoye : une capture arrivee pendant
       l'envoi reste en file et partira au tour suivant. */
    const sent = {};
    batch.forEach(function (o) { if (o && o.task) sent[o.task.id] = true; });
    const remaining = await withLock(async function () {
      const fresh = await getState();
      const rest = fresh.queue.filter(function (o) { return !(o && o.task && sent[o.task.id]); });
      await setState({ queue: rest, cache: res.doc, lastSync: new Date().toISOString(), lastError: '' });
      return rest;
    });

    if (remaining.length) rerun = true;
    else await chrome.alarms.clear(RETRY_ALARM);
    await paintBadge(remaining.length, opts.flash && res.added > 0);
  } catch (e) {
    const online = (typeof navigator !== 'undefined') ? navigator.onLine : true;
    await setState({ lastError: Core.explain(e, online) });
    const now = await getState();
    await paintBadge(now.queue.length);
    if (now.queue.length) chrome.alarms.create(RETRY_ALARM, { delayInMinutes: 1, periodInMinutes: 1 });
  }
  flushing = false;

  if (rerun) {
    rerun = false;
    const st2 = await getState();
    if (st2.queue.length) return flushQueue(opts);
  }
  return getState();
}

async function enqueue(op) {
  const n = await withLock(async function () {
    const st = await getState();
    const queue = st.queue.concat([op]);
    await setState({ queue: queue });
    return queue.length;
  });
  await paintBadge(n);
  flushQueue({ flash: true });
  return n;
}

/* ---------- Capture depuis le menu contextuel ---------- */
async function captureSimple(title, notes) {
  title = String(title || '').trim().replace(/\s+/g, ' ').slice(0, 300);
  if (!title) return null;
  return enqueue({ task: Core.newTask({ title: title, notes: notes || '' }) });
}

chrome.runtime.onInstalled.addListener(function () {
  chrome.contextMenus.removeAll(function () {
    chrome.contextMenus.create({
      id: 'todo-selection',
      title: 'Capturer « %s » dans Tâches',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'todo-page',
      title: 'Capturer cette page dans Tâches',
      contexts: ['page', 'link']
    });
  });
  flushQueue();
});

chrome.runtime.onStartup.addListener(function () { flushQueue(); });

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId === 'todo-selection') {
    const src = (tab && tab.url) ? tab.url : '';
    captureSimple(info.selectionText, src ? 'Source : ' + src : '');
  } else if (info.menuItemId === 'todo-page') {
    const url = info.linkUrl || (tab && tab.url) || '';
    const title = info.linkUrl ? info.linkUrl : ((tab && tab.title) || url);
    captureSimple(title, url ? 'À voir : ' + url : '');
  }
});

chrome.alarms.onAlarm.addListener(function (a) {
  if (a.name === RETRY_ALARM) flushQueue();
});

/* ---------- Messages depuis la fenetre de capture ---------- */
chrome.runtime.onMessage.addListener(function (msg, sender, reply) {
  (async function () {
    if (msg.type === 'state') {
      const st = await getState();
      reply({
        pending: st.queue.length,
        lastSync: st.lastSync,
        lastError: st.lastError,
        projects: (st.cache.projects || []).filter(function (p) { return !p.deletedAt; }),
        settings: {
          owner: st.settings.owner, repo: st.settings.repo, branch: st.settings.branch, path: st.settings.path,
          hasToken: !!st.settings.token,
          tokenHint: st.settings.token ? '••••' + st.settings.token.slice(-4) : ''
        }
      });
      return;
    }
    if (msg.type === 'capture') {
      const pending = await enqueue(msg.op);
      reply({ ok: true, pending: pending });
      return;
    }
    if (msg.type === 'saveSettings') {
      const st = await getState();
      const next = Object.assign({}, st.settings, msg.patch || {});
      await setState({ settings: next, lastError: '' });
      const after = await flushQueue({ flash: true });
      reply({ ok: !after.lastError, lastError: after.lastError, hasToken: !!next.token });
      return;
    }
    if (msg.type === 'sync') {
      const after = await flushQueue({ flash: true });
      reply({
        ok: !after.lastError, lastError: after.lastError, pending: after.queue.length,
        projects: (after.cache.projects || []).filter(function (p) { return !p.deletedAt; })
      });
      return;
    }
    reply({ ok: false, error: 'message inconnu' });
  })();
  return true;   /* reponse asynchrone */
});
