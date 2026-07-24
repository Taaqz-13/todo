/* Tests du parser de saisie rapide. Lancer : node tests/nlp.test.js */
const NLP = require('../js/nlp.js');

let fails = 0, runs = 0;
function eq(actual, expected, label) {
  runs++;
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) { fails++; console.log('FAIL ' + label + '\n  attendu : ' + b + '\n  obtenu  : ' + a); }
}

/* Reference : vendredi 24 juillet 2026 */
const T = '2026-07-24';
const projects = [
  { id: 'a1', name: 'Simplest' },
  { id: 'a2', name: 'Custom Ton Clavier' },
  { id: 'a3', name: 'Cegid' }
];
function p(text, opts) { return NLP.parse(text, Object.assign({ today: T, projects: projects }, opts)); }

/* ---- dates simples ---- */
eq(p('appeler le plombier ajd').due, '2026-07-24', 'ajd = aujourd\'hui');
eq(p('appeler le plombier ajd').title, 'appeler le plombier', 'titre nettoye');
eq(p("relancer aujourd'hui le client").due, '2026-07-24', "aujourd'hui en milieu de phrase");
eq(p('envoyer facture dem').due, '2026-07-25', 'dem = demain');
eq(p('envoyer facture demain').due, '2026-07-25', 'demain');
eq(p('rdv apres-demain').due, '2026-07-26', 'apres-demain');
eq(p('rdv après-demain').due, '2026-07-26', 'apres-demain accentue');

/* ---- jours de semaine (vendredi 24/07) ---- */
eq(p('reunion lundi').due, '2026-07-27', 'lundi = prochain lundi');
eq(p('reunion lun').due, '2026-07-27', 'abreviation lun');
eq(p('appel vendredi').due, '2026-07-24', 'vendredi = ajd si meme jour');
eq(p('tondre samedi').due, '2026-07-25', 'samedi');
eq(p('demande mar').due, '2026-07-28', 'abreviation mar');
eq(p('aller au marché').due, null, 'marché ne matche pas mar');
eq(p('demander un devis').due, null, 'demander ne matche pas dem');

/* ---- expressions ---- */
eq(p('point client semaine prochaine').due, '2026-07-27', 'semaine prochaine = lundi suivant');
eq(p('point client sem pro').due, '2026-07-27', 'sem pro');
eq(p('rando ce week-end').due, '2026-07-25', 'week-end = samedi qui vient');
eq(p('dans 3 jours relancer').due, '2026-07-27', 'dans 3 jours');
eq(p('bilan dans 2 semaines').due, '2026-08-07', 'dans 2 semaines');
eq(p('resilier dans 1 mois').due, '2026-08-24', 'dans 1 mois');
eq(p('payer le loyer le 1').due, '2026-08-01', 'le 1 = prochain 1er du mois');
eq(p('payer urssaf le 15').due, '2026-08-15', 'le 15 (24 juillet passe -> 15 aout)');

/* ---- dates explicites ---- */
eq(p('anniversaire 12/08').due, '2026-08-12', 'jj/mm');
eq(p('anniversaire 12/8').due, '2026-08-12', 'jj/m');
eq(p('cloture 03/02').due, '2027-02-03', 'jj/mm deja passe -> annee suivante');
eq(p('audit 15/01/2027').due, '2027-01-15', 'jj/mm/aaaa');
eq(p('audit 15/01/27').due, '2027-01-15', 'jj/mm/aa');
eq(p('noel 25 decembre').due, '2026-12-25', 'jour + mois');
eq(p('conf 3 janvier').due, '2027-01-03', 'jour + mois passe -> annee suivante');
eq(p('facture 1er aout').due, '2026-08-01', '1er aout');
eq(p('rapport 31/02').due, null, 'date impossible ignoree');

/* ---- recurrences ---- */
let r = p('sortir poubelles chaque lundi');
eq(r.recur, { freq: 'week', weekday: 1 }, 'chaque lundi -> recurrence hebdo');
eq(r.due, '2026-07-27', 'chaque lundi -> premiere echeance');
eq(r.title, 'sortir poubelles', 'titre sans la recurrence');
r = p('vitamines tous les jours');
eq(r.recur, { freq: 'day', interval: 1 }, 'tous les jours');
eq(r.due, '2026-07-24', 'tous les jours -> demarre ajd');
r = p('facturation tous les mois');
eq(r.recur, { freq: 'month', day: 24 }, 'tous les mois');
r = p('arroser tous les 3 jours');
eq(r.recur, { freq: 'day', interval: 3 }, 'tous les 3 jours');
r = p('review toutes les semaines');
eq(r.recur, { freq: 'week', weekday: 5 }, 'toutes les semaines -> jour courant');

/* ---- priorites ---- */
eq(p('deploiement p1').priority, 1, 'p1');
eq(p('deploiement p1').title, 'deploiement', 'titre sans p1');
eq(p('ranger p4 le garage').priority, 4, 'p4 en milieu');
eq(p('preparer p2p reseau').priority, null, 'p2p ne matche pas');

/* ---- projets ---- */
let pr = p('poser le velux #simplest');
eq(pr.project, { id: 'a1', name: 'Simplest' }, '#simplest -> projet Simplest');
eq(pr.title, 'poser le velux', 'titre sans le tag projet');
pr = p('repondre prospect #ctc dem');
eq(pr.project && pr.project.create, true, '#ctc inconnu -> creation proposee');
pr = p('kit switches #customtonclavier');
eq(pr.project && pr.project.id, 'a2', 'nom colle multi-mots matche');
pr = p('kit switches #custom');
eq(pr.project && pr.project.id, 'a2', 'prefixe matche');

/* ---- combos ---- */
let c = p('relancer cegid dem p1 #cegid');
eq(c.due, '2026-07-25', 'combo date');
eq(c.priority, 1, 'combo priorite');
eq(c.project && c.project.id, 'a3', 'combo projet');
eq(c.title, 'relancer cegid', 'combo titre nettoye');

c = p('point equipe chaque lundi p2');
eq(c.recur, { freq: 'week', weekday: 1 }, 'combo recurrence');
eq(c.priority, 2, 'combo recurrence + priorite');

/* ---- ignores (chip retiree par l'utilisateur) ---- */
let base = p('appeler dem');
const k = base.matches[0].type + ':' + base.matches[0].start;
let ig = p('appeler dem', { ignored: new Set([k]) });
eq(ig.due, null, 'token ignore -> pas de date');
eq(ig.title, 'appeler dem', 'token ignore -> reste dans le titre');

/* ---- helpers ---- */
eq(NLP.frDateLabel('2026-07-24', T).text, "Aujourd'hui", 'label ajd');
eq(NLP.frDateLabel('2026-07-25', T).text, 'Demain', 'label demain');
eq(NLP.frDateLabel('2026-07-23', T).cls, 'overdue', 'label retard');
eq(NLP.frDateLabel('2026-07-28', T).text, 'mardi', 'label jour proche');
eq(NLP.frDateLabel('2026-08-12', T).text, '12 août', 'label date');
eq(NLP.frDateLabel('2027-01-15', T).text, '15 janv. 2027', 'label autre annee');
eq(NLP.nextOccurrence({ freq: 'week', weekday: 1 }, '2026-07-27'), '2026-08-03', 'next occurrence hebdo');
eq(NLP.nextOccurrence({ freq: 'day', interval: 3 }, '2026-07-24'), '2026-07-27', 'next occurrence 3 jours');
eq(NLP.nextOccurrence({ freq: 'month', day: 31 }, '2026-08-31'), '2026-09-30', 'next occurrence mois clampe');
eq(NLP.nextOccurrence({ freq: 'month', day: 15 }, '2026-07-24'), '2026-08-15', 'next occurrence mois');

console.log(runs + ' tests, ' + fails + ' echec(s)');
process.exit(fails ? 1 : 0);
