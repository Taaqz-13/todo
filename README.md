# Tâches

App perso de capture d'idées et de suivi de tâches (PWA, style Todoist), synchronisée entre PC et iPhone.

- **Live** : https://taaqz-13.github.io/todo/
- **Données** : dépôt GitHub privé `Taaqz-13/todo-data` (fichier `data.json`), synchro via l'API Contents.
- **Hors ligne** : l'app fonctionne sans réseau (localStorage + service worker), la synchro fusionne au retour.

## Raccourcis de saisie

| Tape... | Résultat |
|---|---|
| `ajd`, `auj`, `aujourd'hui` | échéance aujourd'hui |
| `dem`, `demain`, `après-demain` | demain / après-demain |
| `lundi` ... `dim` | prochain jour de semaine |
| `12/08`, `3 janvier`, `le 15` | date précise |
| `dans 3 jours`, `sem pro`, `week-end` | dates relatives |
| `chaque lundi`, `tous les jours`, `tous les 3 jours`, `tous les mois` | tâche récurrente |
| `#simplest` | projet (autocomplétion, création à la volée) |
| `p1` à `p4` | priorité |

## Activer la synchro sur un appareil

1. Ouvrir l'app, aller dans Réglages.
2. Créer un token GitHub fine-grained (compte Taaqz-13) limité au dépôt `todo-data`, permission Contents : Read and write.
3. Coller le token dans Réglages et Enregistrer. À refaire une fois par appareil.

## Dev local

Serveur statique au choix, par exemple : `python -m http.server 8642 --directory .`
Tests du parser : `node tests/nlp.test.js`
