/* Synchronisation en ligne : le fichier data.json d'un depot GitHub prive
   sert de source partagee entre les appareils (PC, iPhone).
   - Hors ligne ou sans token : l'app fonctionne en local, rien n'est perdu.
   - A chaque synchro : lecture distante -> fusion -> ecriture si necessaire.
   - Conflits d'ecriture (sha perime) : relecture + refusion, 3 tentatives. */
(function (root) {
  'use strict';

  const API = 'https://api.github.com';

  const Sync = {
    status: 'off',          /* off | syncing | ok | error */
    lastSync: null,         /* ISO */
    lastError: '',
    _timer: null,
    _running: false,
    _pending: false,

    enabled: function () { return !!(Store.settings.token && Store.settings.repo && Store.settings.owner); },

    schedule: function () {
      if (!this.enabled()) return;
      clearTimeout(this._timer);
      const self = this;
      this._timer = setTimeout(function () { self.now('auto'); }, 2500);
    },

    now: async function (trigger) {
      if (!this.enabled()) { this.status = 'off'; this._emit(); return; }
      if (this._running) { this._pending = true; return; }
      this._running = true;
      this.status = 'syncing';
      this._emit();
      try {
        let remote = await this._get();
        let merged = Store.merge(Store.toDoc(), remote.doc);
        let body = JSON.stringify(merged);
        if (!remote.doc || JSON.stringify(Store.purge(remote.doc)) !== JSON.stringify(Store.purge(merged))) {
          let sha = remote.sha;
          for (let i = 0; i < 3; i++) {
            try {
              await this._put(body, sha);
              break;
            } catch (e) {
              if ((e.status === 409 || e.status === 422) && i < 2) {
                remote = await this._get();
                merged = Store.merge(Store.toDoc(), remote.doc);
                body = JSON.stringify(merged);
                sha = remote.sha;
              } else { throw e; }
            }
          }
        }
        Store.applyDoc(merged);
        this.lastSync = new Date().toISOString();
        localStorage.setItem('todo.lastSync', this.lastSync);
        this.status = 'ok';
        this.lastError = '';
      } catch (e) {
        this.status = 'error';
        this.lastError = this._explain(e);
        console.warn('sync', e);
      }
      this._running = false;
      this._emit();
      if (this._pending) {
        this._pending = false;
        const self = this;
        setTimeout(function () { self.now('pending'); }, 1000);
      }
    },

    _headers: function () {
      return {
        'Authorization': 'Bearer ' + Store.settings.token,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      };
    },
    _url: function () {
      const s = Store.settings;
      return API + '/repos/' + s.owner + '/' + s.repo + '/contents/' + s.path;
    },

    _get: async function () {
      const r = await fetch(this._url() + '?ref=' + Store.settings.branch + '&t=' + Date.now(), { headers: this._headers() });
      if (r.status === 404) return { doc: null, sha: null };
      if (!r.ok) throw this._err(r);
      const j = await r.json();
      const bytes = Uint8Array.from(atob((j.content || '').replace(/\n/g, '')), function (c) { return c.charCodeAt(0); });
      const text = new TextDecoder('utf-8').decode(bytes);
      let doc = null;
      try { doc = JSON.parse(text); } catch (e) { doc = null; }
      return { doc: doc, sha: j.sha };
    },

    _put: async function (text, sha) {
      const bytes = new TextEncoder().encode(text);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      }
      const body = {
        message: 'sync ' + new Date().toISOString(),
        content: btoa(bin),
        branch: Store.settings.branch
      };
      if (sha) body.sha = sha;
      const r = await fetch(this._url(), { method: 'PUT', headers: this._headers(), body: JSON.stringify(body) });
      if (!r.ok) throw this._err(r);
      return r.json();
    },

    _err: function (r) {
      const e = new Error('GitHub ' + r.status);
      e.status = r.status;
      return e;
    },
    _explain: function (e) {
      if (!navigator.onLine) return 'Hors ligne : la synchro reprendra automatiquement.';
      if (e.status === 401) return 'Token invalide ou expiré. Vérifie-le dans les réglages.';
      if (e.status === 403) return 'Accès refusé par GitHub (limite ou droits insuffisants).';
      if (e.status === 404) return 'Dépôt introuvable : vérifie que le token a accès à ' + Store.settings.owner + '/' + Store.settings.repo + '.';
      return 'Erreur de synchro (' + (e.message || e) + ').';
    },

    _emit: function () { Store.emit('sync-status'); },

    init: function () {
      this.lastSync = localStorage.getItem('todo.lastSync') || null;
      const self = this;
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') self.now('visible');
      });
      window.addEventListener('online', function () { self.now('online'); });
      setInterval(function () {
        if (document.visibilityState === 'visible') self.now('interval');
      }, 5 * 60 * 1000);
      if (this.enabled()) this.now('boot');
      else this.status = 'off';
    }
  };

  root.Sync = Sync;
})(typeof self !== 'undefined' ? self : this);
