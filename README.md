# Tâches

Capture d'idées et suivi de tâches perso. Trois façons d'y accéder, un seul jeu de données.

| Surface | Où | À quoi ça sert |
|---|---|---|
| Web app (PWA) | https://taaqz-13.github.io/todo/ | Consulter, organiser, cocher. Installable sur iPhone et sur PC. |
| Extension Chrome | dossier `extension/` | Capturer en un raccourci clavier sans quitter l'onglet en cours. |
| Données | dépôt privé `Taaqz-13/todo-data` (`data.json`) | Source unique, synchronisée entre tous les appareils. |

**Hors ligne** : les deux surfaces fonctionnent sans réseau et envoient au retour de la connexion. Rien n'est perdu.

## Raccourcis de saisie

Valables dans la web app comme dans l'extension (même analyseur, `js/nlp.js`).

| Tape... | Résultat |
|---|---|
| `ajd`, `auj`, `aujourd'hui` | échéance aujourd'hui |
| `dem`, `demain`, `après-demain` | demain, après-demain |
| `lundi` ... `dim` | prochain jour de semaine |
| `12/08`, `3 janvier`, `1er août`, `le 15` | date précise |
| `dans 3 jours`, `dans 2 semaines`, `sem pro`, `week-end` | dates relatives |
| `chaque lundi`, `tous les jours`, `tous les 3 jours`, `tous les mois` | tâche récurrente |
| `#simplest` | projet (autocomplétion, création à la volée) |
| `p1` à `p4` | priorité |

Une tâche récurrente cochée n'est pas terminée : elle est reportée à l'occurrence suivante.

## Installer l'extension Chrome

1. `chrome://extensions` puis activer **Mode développeur** (en haut à droite).
2. **Charger l'extension non empaquetée** et choisir le dossier `C:\Users\louis\todo-app\extension`.
3. Épingler l'icône à la barre d'outils, puis ouvrir la fenêtre de capture et coller le token dans **Réglages**.
4. Raccourci par défaut `Ctrl+Maj+K`, modifiable sur `chrome://extensions/shortcuts`.

Le dossier doit rester en place : Chrome le lit à chaque démarrage.

Dans la fenêtre de capture : **Entrée** enregistre et ferme, **Ctrl+Entrée** enregistre et enchaîne, le bouton lien joint l'URL de l'onglet en cours. Clic droit sur une sélection ou une page pour capturer sans ouvrir la fenêtre.

## Activer la synchro sur un appareil

1. Créer un token GitHub fine-grained (compte Taaqz-13) limité au dépôt `todo-data`, permission **Contents : Read and write**.
2. Le coller dans les Réglages de la web app, et dans les Réglages de l'extension.
3. À refaire une fois par appareil et par navigateur. Le token ne quitte jamais l'appareil.

## Architecture

```
index.html, css/, js/        web app (PWA, service worker network-first)
  js/nlp.js                  analyseur de saisie : LA source de vérité, partagée
  js/store.js                état + fusion multi-appareils (par updatedAt, tombales deletedAt)
  js/sync.js                 synchro GitHub de la web app
extension/                   extension Chrome (Manifest V3)
  popup.*                    fenêtre de capture
  background.js              file d'attente, envoi, menu contextuel, badge
  shared/core.js             forme des données, encodage, envoi (sans chrome.* : testable)
  vendor/nlp.js              copie de js/nlp.js (voir ci-dessous)
tools/sync-shared.js         recopie js/nlp.js vers extension/vendor/
tests/                       tests Node + banc de test de la fenêtre de capture
```

L'extension n'ajoute jamais que du contenu au dépôt : elle relit le fichier distant, y insère ses captures et réécrit. Elle ne peut donc rien écraser, même si le téléphone a modifié quelque chose entre-temps.

## Dev

```bash
node tests/nlp.test.js && node tests/core.test.js && node tests/background.test.js
```

Après toute modification de `js/nlp.js`, relancer `node tools/sync-shared.js` pour mettre à jour la copie de l'extension, sinon les deux surfaces divergent.

Serveur local : `python -m http.server 8642 --directory .`
Banc de test de la fenêtre de capture (sans installer l'extension) : http://localhost:8642/tests/popup-harness.html
