/* Tests des vues calculees par le store (A venir, Tableau). Lancer : node tests/store.test.js */
const NLP = require('../js/nlp.js');
const Store = require('../js/store.js');

let fails = 0, runs = 0;
function eq(actual, expected, label) {
  runs++;
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) { fails++; console.log('FAIL ' + label + '\n  attendu : ' + b + '\n  obtenu  : ' + a); }
}

/* Les vues lisent la vraie date du jour : les echeances sont posees par rapport a elle. */
const T = NLP.parseYMD(NLP.todayStr());
function day(n) { return NLP.fmt(NLP.addDays(T, n)); }
function eom(add) { const d = new Date(T.getFullYear(), T.getMonth() + 1 + (add || 0), 0, 12); return NLP.fmt(d); }
let seq = 0;
function task(f) {
  seq++;
  return Object.assign({ id: 't' + seq, title: 't' + seq, projectId: null, due: null, dueGran: null, priority: 4,
    recur: null, completedAt: null, deletedAt: null, createdAt: '2026-01-01T00:00:' + (10 + seq) + '.000Z' }, f);
}

Store.state.projects = [
  { id: 'pB', name: 'Simplest', color: '#4073ff', deletedAt: null },
  { id: 'pA', name: 'Cegid', color: '#db4035', deletedAt: null },
  { id: 'pX', name: 'Ancien', color: '#808080', deletedAt: '2026-01-01T00:00:00.000Z' }
];

/* ---------- Tableau ---------- */
Store.state.tasks = [
  task({ id: 'sansdate-p4', projectId: 'pA' }),
  task({ id: 'sansdate-p1', projectId: 'pA', priority: 1 }),
  task({ id: 'mois', projectId: 'pA', due: eom(1), dueGran: 'month' }),
  task({ id: 'demain', projectId: 'pA', due: day(1) }),
  task({ id: 'retard', projectId: 'pA', due: day(-3) }),
  task({ id: 'auj-p3', projectId: 'pA', due: day(0), priority: 3 }),
  task({ id: 'auj-p1', projectId: 'pA', due: day(0), priority: 1 }),
  task({ id: 'inbox', due: day(2) }),
  task({ id: 'orphelin', projectId: 'pX' }),
  task({ id: 'fini', projectId: 'pA', due: day(0), completedAt: '2026-01-02T00:00:00.000Z' }),
  task({ id: 'supprime', projectId: 'pB', deletedAt: '2026-01-02T00:00:00.000Z' })
];
let b = Store.board();
eq(b.map(function (c) { return c.project ? c.project.id : 'inbox'; }), ['inbox', 'pA', 'pB'], 'colonnes : sans projet puis projets actifs par ordre alphabetique');
eq(b[1].tasks.map(function (t) { return t.id; }),
  ['retard', 'auj-p1', 'auj-p3', 'demain', 'mois', 'sansdate-p1', 'sansdate-p4'],
  'colonne : retard, puis date, priorite a date egale, mois, puis sans date par priorite');
eq(b[0].tasks.map(function (t) { return t.id; }), ['inbox', 'orphelin'], 'tache d\'un projet supprime : colonne sans projet');
eq(b[2].tasks.length, 0, 'terminees et supprimees absentes');

/* ---------- A venir : categorie mois ---------- */
Store.state.tasks = [
  task({ id: 'jour1', due: day(1) }),
  task({ id: 'mois-cour', due: eom(0), dueGran: 'month' }),
  task({ id: 'mois-suiv', due: eom(1), dueGran: 'month' }),
  task({ id: 'jour-suiv', due: NLP.fmt(new Date(T.getFullYear(), T.getMonth() + 1, 3, 12)) }),
  task({ id: 'jour-fin', due: eom(1) })
];
const up = Store.upcoming();
const shape = up.map(function (g) { return g.kind + ':' + g.tasks.map(function (t) { return t.id; }).join(','); });
/* Le dernier jour du mois, la categorie du mois courant est due aujourd'hui : elle passe dans Aujourd'hui */
const lastDay = day(0) === eom(0);
eq(shape.indexOf('month:mois-suiv') < shape.indexOf('day:jour-suiv'), true, 'categorie du mois en tete de ses jours');
eq(shape.indexOf('day:jour-suiv') < shape.indexOf('day:jour-fin'), true, 'jours du mois dans l\'ordre');
eq(shape.indexOf('day:jour-fin') >= 0, true, 'tache datee au dernier jour sans categorie : reste un jour');
if (!lastDay) eq(shape[0], 'month:mois-cour', 'mois en cours : categorie en tete');
eq(up.filter(function (g) { return g.kind === 'month'; }).every(function (g) { return g.tasks.every(function (t) { return t.dueGran === 'month'; }); }), true, 'categorie mois : que des taches "dans le mois"');

console.log(runs + ' tests, ' + fails + ' echec(s)');
process.exit(fails ? 1 : 0);
