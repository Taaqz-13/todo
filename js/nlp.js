/* Analyse de saisie rapide en francais : dates, recurrences, priorites, projets.
   Zero dependance. Utilisable dans le navigateur (window.NLP) et sous Node (tests). */
(function (root) {
  'use strict';

  /* ---------- Utilitaires dates (heure fixee a midi pour eviter les surprises DST) ---------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmt(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseYMD(s) { const p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0); }
  function todayStr() { return fmt(new Date()); }
  function addDays(d, n) { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function addMonthsClamp(d, n, wantedDay) {
    const day = wantedDay || d.getDate();
    const x = new Date(d.getFullYear(), d.getMonth() + n, 1, 12);
    const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
    x.setDate(Math.min(day, last));
    return x;
  }
  function diffDays(a, b) { /* b - a en jours civils */
    const ax = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const bx = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((bx - ax) / 86400000);
  }

  const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const DAY_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  const MONTH_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const MONTH_NAMES = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  /* Prochain jour de semaine cible (0=dim..6=sam). allowToday : accepte aujourd'hui. */
  function nextWeekday(from, target, allowToday) {
    let delta = (target - from.getDay() + 7) % 7;
    if (delta === 0 && !allowToday) delta = 7;
    return addDays(from, delta);
  }

  /* ---------- Normalisation (longueur preservee : les index restent alignes) ---------- */
  function fold(s) {
    return s.toLowerCase()
      .replace(/[’ʼ]/g, "'")
      .replace(/[àâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[îï]/g, 'i')
      .replace(/[ôö]/g, 'o').replace(/[ùûü]/g, 'u').replace(/ç/g, 'c');
  }
  function foldKey(s) { return fold(s).replace(/[^a-z0-9]/g, ''); }

  /* ---------- Libelles ---------- */
  function frDateLabel(dueStr, refStr) {
    const due = parseYMD(dueStr);
    const ref = refStr ? parseYMD(refStr) : new Date();
    const d = diffDays(ref, due);
    let text;
    if (d === 0) text = "Aujourd'hui";
    else if (d === 1) text = 'Demain';
    else if (d === -1) text = 'Hier';
    else if (d > 1 && d < 7) text = DAY_NAMES[due.getDay()];
    else {
      text = due.getDate() + ' ' + MONTH_SHORT[due.getMonth()];
      if (due.getFullYear() !== ref.getFullYear()) text += ' ' + due.getFullYear();
    }
    let cls = 'later';
    if (d < 0) cls = 'overdue';
    else if (d === 0) cls = 'today';
    else if (d === 1) cls = 'tomorrow';
    else if (d < 7) cls = 'week';
    return { text: text, cls: cls, days: d };
  }

  function recurLabel(recur) {
    if (!recur) return '';
    if (recur.freq === 'day') return recur.interval > 1 ? 'Tous les ' + recur.interval + ' jours' : 'Tous les jours';
    if (recur.freq === 'week') return 'Tous les ' + DAY_NAMES[recur.weekday] + 's';
    if (recur.freq === 'month') return 'Tous les mois (le ' + recur.day + ')';
    return '';
  }

  /* Prochaine occurrence STRICTEMENT apres fromStr */
  function nextOccurrence(recur, fromStr) {
    const from = parseYMD(fromStr);
    if (recur.freq === 'day') return fmt(addDays(from, recur.interval || 1));
    if (recur.freq === 'week') return fmt(nextWeekday(from, recur.weekday, false));
    if (recur.freq === 'month') {
      const day = recur.day || from.getDate();
      /* ce mois-ci si encore a venir, sinon mois suivant */
      const last = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
      if (from.getDate() < Math.min(day, last)) {
        return fmt(new Date(from.getFullYear(), from.getMonth(), Math.min(day, last), 12));
      }
      const nm = new Date(from.getFullYear(), from.getMonth() + 1, 1, 12);
      const lastNm = new Date(nm.getFullYear(), nm.getMonth() + 1, 0).getDate();
      nm.setDate(Math.min(day, lastNm));
      return fmt(nm);
    }
    return null;
  }

  /* ---------- Analyse ---------- */
  const WD = { lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, dimanche: 0, lun: 1, mar: 2, mer: 3, jeu: 4, ven: 5, sam: 6, dim: 0 };
  const MONTHS = {
    janvier: 0, janv: 0, fevrier: 1, fevr: 1, fev: 1, mars: 2, avril: 3, avr: 3, mai: 4, juin: 5,
    juillet: 6, juil: 6, aout: 7, septembre: 8, sept: 8, octobre: 9, oct: 9, novembre: 10, nov: 10, decembre: 11, dec: 11
  };

  const LB = "(?<=^|[^a-z0-9])";      /* frontiere gauche */
  const RB = "(?=$|[^a-z0-9])";       /* frontiere droite */

  function parse(text, opts) {
    opts = opts || {};
    const projects = (opts.projects || []).filter(function (p) { return !p.deletedAt; });
    const today = opts.today ? parseYMD(opts.today) : parseYMD(todayStr());
    const ignored = opts.ignored || new Set();

    const folded = fold(text);
    const matches = [];
    const blocked = [];
    let due = null, recur = null, priority = null, project = null;

    function overlaps(s, e) {
      return blocked.some(function (r) { return s < r.e && e > r.s; });
    }
    function claim(m) {
      if (!m || overlaps(m.start, m.end)) return false;
      blocked.push({ s: m.start, e: m.end });
      if (ignored.has(m.type + ':' + m.start)) { m.ignored = true; return false; }
      matches.push(m);
      return true;
    }
    function scan(re, type, make) {
      const rx = new RegExp(re.source, re.flags.indexOf('g') >= 0 ? re.flags : re.flags + 'g');
      let m;
      while ((m = rx.exec(folded)) !== null) {
        const payload = make(m);
        if (!payload) continue;
        payload.type = type;
        payload.start = m.index;
        payload.end = m.index + m[0].length;
        if (claim(payload)) return payload;
        if (payload.ignored) return null;
      }
      return null;
    }

    /* 1) Recurrences (avant les jours de semaine simples) */
    if (!recur) {
      const r = scan(new RegExp(LB + "(chaque|tous les|toutes les)\\s+(\\d+\\s+)?(jours?|semaines?|mois|lundis?|mardis?|mercredis?|jeudis?|vendredis?|samedis?|dimanches?)" + RB, 'g'), 'recur', function (m) {
        const n = m[2] ? parseInt(m[2], 10) : 1;
        const unit = m[3].replace(/s$/, '');
        if (unit === 'jour') return { recur: { freq: 'day', interval: n }, due: fmt(today), label: n > 1 ? 'Tous les ' + n + ' jours' : 'Tous les jours' };
        if (unit === 'semaine') return { recur: { freq: 'week', weekday: today.getDay() }, due: fmt(today), label: 'Toutes les semaines' };
        if (unit === 'moi') return { recur: { freq: 'month', day: today.getDate() }, due: fmt(today), label: 'Tous les mois' };
        const wd = WD[unit];
        if (wd !== undefined) return { recur: { freq: 'week', weekday: wd }, due: fmt(nextWeekday(today, wd, true)), label: 'Tous les ' + unit + 's' };
        return null;
      });
      if (r) { recur = r.recur; due = r.due; }
    }

    /* 2) Dates explicites, de la plus specifique a la plus courte.
       Une seule date est retenue ; une recurrence peut etre completee par une date de depart. */
    let dateDone = false;
    function setDue(m) { if (m && m.due) { due = m.due; dateDone = true; } return m; }

    /* apres-demain */
    if (!dateDone) setDue(scan(new RegExp(LB + "apres[- ]demain" + RB, 'g'), 'date', function () {
      return { due: fmt(addDays(today, 2)), label: 'Après-demain' };
    }));

    /* jj/mm ou jj/mm/aaaa */
    if (!dateDone) setDue(scan(new RegExp(LB + "(\\d{1,2})\\/(\\d{1,2})(?:\\/(\\d{2,4}))?" + RB, 'g'), 'date', function (m) {
      const dd = parseInt(m[1], 10), mm = parseInt(m[2], 10);
      if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return null;
      let yy = m[3] ? parseInt(m[3], 10) : today.getFullYear();
      if (m[3] && yy < 100) yy += 2000;
      let d = new Date(yy, mm - 1, dd, 12);
      if (d.getDate() !== dd) return null; /* 31/02 etc. */
      if (!m[3] && diffDays(today, d) < 0) d = new Date(yy + 1, mm - 1, dd, 12);
      const lab = frDateLabel(fmt(d), fmt(today));
      return { due: fmt(d), label: lab.text };
    }));

    /* "12 aout", "1er janvier" */
    if (!dateDone) setDue(scan(new RegExp(LB + "(\\d{1,2}|1er)\\s+(janvier|janv|fevrier|fevr|fev|mars|avril|avr|mai|juin|juillet|juil|aout|septembre|sept|octobre|oct|novembre|nov|decembre|dec)" + RB, 'g'), 'date', function (m) {
      const dd = m[1] === '1er' ? 1 : parseInt(m[1], 10);
      const mm = MONTHS[m[2]];
      if (dd < 1 || dd > 31 || mm === undefined) return null;
      let d = new Date(today.getFullYear(), mm, dd, 12);
      if (d.getDate() !== dd) return null;
      if (diffDays(today, d) < 0) d = new Date(today.getFullYear() + 1, mm, dd, 12);
      const lab = frDateLabel(fmt(d), fmt(today));
      return { due: fmt(d), label: lab.text };
    }));

    /* "dans N jours / semaines / mois" */
    if (!dateDone) setDue(scan(new RegExp(LB + "dans\\s+(\\d+)\\s+(jours?|semaines?|mois)" + RB, 'g'), 'date', function (m) {
      const n = parseInt(m[1], 10);
      const unit = m[2];
      let d;
      if (unit.indexOf('jour') === 0) d = addDays(today, n);
      else if (unit.indexOf('semaine') === 0) d = addDays(today, n * 7);
      else d = addMonthsClamp(today, n);
      const lab = frDateLabel(fmt(d), fmt(today));
      return { due: fmt(d), label: lab.text };
    }));

    /* semaine prochaine */
    if (!dateDone) setDue(scan(new RegExp(LB + "(semaine prochaine|semaine pro|sem pro)" + RB, 'g'), 'date', function () {
      return { due: fmt(nextWeekday(today, 1, false)), label: 'Semaine prochaine' };
    }));

    /* week-end */
    if (!dateDone) setDue(scan(new RegExp(LB + "(ce\\s+)?(week[- ]?end)" + RB, 'g'), 'date', function () {
      const d = today.getDay() === 0 ? today : nextWeekday(today, 6, true);
      return { due: fmt(d), label: 'Ce week-end' };
    }));

    /* "le 15" : prochaine occurrence de ce jour du mois */
    if (!dateDone) setDue(scan(new RegExp(LB + "le\\s+(\\d{1,2})" + RB, 'g'), 'date', function (m) {
      const dd = parseInt(m[1], 10);
      if (dd < 1 || dd > 31) return null;
      let d = new Date(today.getFullYear(), today.getMonth(), dd, 12);
      if (d.getDate() !== dd || diffDays(today, d) < 0) {
        d = new Date(today.getFullYear(), today.getMonth() + 1, 1, 12);
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(dd, last));
      }
      const lab = frDateLabel(fmt(d), fmt(today));
      return { due: fmt(d), label: 'Le ' + dd + ' (' + lab.text + ')' };
    }));

    /* jours de semaine (complets puis abreges) */
    if (!dateDone) setDue(scan(new RegExp(LB + "(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)" + RB, 'g'), 'date', function (m) {
      const wd = WD[m[1]];
      const d = nextWeekday(today, wd, true);
      return { due: fmt(d), label: DAY_NAMES[wd].charAt(0).toUpperCase() + DAY_NAMES[wd].slice(1) };
    }));
    if (!dateDone) setDue(scan(new RegExp(LB + "(lun|mar|mer|jeu|ven|sam|dim)" + RB, 'g'), 'date', function (m) {
      const wd = WD[m[1]];
      const d = nextWeekday(today, wd, true);
      return { due: fmt(d), label: DAY_NAMES[wd].charAt(0).toUpperCase() + DAY_NAMES[wd].slice(1) };
    }));

    /* aujourd'hui / demain */
    if (!dateDone) setDue(scan(new RegExp(LB + "(aujourd'hui|aujourdhui|ajd|auj)" + RB, 'g'), 'date', function () {
      return { due: fmt(today), label: "Aujourd'hui" };
    }));
    if (!dateDone) setDue(scan(new RegExp(LB + "(demain|dem)" + RB, 'g'), 'date', function () {
      return { due: fmt(addDays(today, 1)), label: 'Demain' };
    }));

    /* 3) Priorite p1..p4 */
    const pm = scan(new RegExp(LB + "p([1-4])" + RB, 'g'), 'priority', function (m) {
      return { priority: parseInt(m[1], 10), label: 'P' + m[1] };
    });
    if (pm) priority = pm.priority;

    /* 4) Projet : #token */
    const prx = /#([^\s#]+)/g;
    let m;
    while ((m = prx.exec(text)) !== null) {
      const start = m.index, end = m.index + m[0].length;
      if (overlaps(start, end)) continue;
      const tokenKey = foldKey(m[1]);
      if (!tokenKey) continue;
      let found = null;
      const cands = projects.filter(function (p) { return foldKey(p.name).indexOf(tokenKey) === 0; });
      if (cands.length) {
        cands.sort(function (a, b) { return a.name.length - b.name.length; });
        const exact = cands.filter(function (p) { return foldKey(p.name) === tokenKey; });
        found = (exact[0] || cands[0]);
      }
      const payload = found
        ? { type: 'project', start: start, end: end, project: { id: found.id, name: found.name }, label: '# ' + found.name }
        : { type: 'project', start: start, end: end, project: { create: true, name: m[1] }, label: '# ' + m[1] + ' (nouveau)' };
      blocked.push({ s: start, e: end });
      if (!ignored.has('project:' + start)) { matches.push(payload); project = payload.project; }
      break;
    }

    /* 5) Reconstruction du titre sans les tokens consommes */
    let title = text;
    matches.slice().sort(function (a, b) { return b.start - a.start; }).forEach(function (mm) {
      title = title.slice(0, mm.start) + title.slice(mm.end);
    });
    title = title.replace(/\s{2,}/g, ' ').replace(/^[\s,;:.!-]+|[\s,;:.!-]+$/g, '').trim();

    return { title: title, due: due, recur: recur, priority: priority, project: project, matches: matches };
  }

  const API = {
    parse: parse, fmt: fmt, parseYMD: parseYMD, todayStr: todayStr, addDays: addDays,
    frDateLabel: frDateLabel, recurLabel: recurLabel, nextOccurrence: nextOccurrence,
    fold: fold, foldKey: foldKey, DAY_NAMES: DAY_NAMES, DAY_SHORT: DAY_SHORT, MONTH_SHORT: MONTH_SHORT, MONTH_NAMES: MONTH_NAMES
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.NLP = API;
})(typeof self !== 'undefined' ? self : this);
