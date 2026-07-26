# Reprise du projet Tâches

Document de reprise : où en est le projet, comment relancer le chantier, ce qui reste à faire.
Dernière mise à jour : 26 juillet 2026.

## État actuel

Le système est en production et utilisé. Trois surfaces, un seul fichier de données.

| Élément | État |
|---|---|
| Web app (PWA) | En ligne : https://taaqz-13.github.io/todo/ - installée sur iPhone |
| Extension Chrome | Fonctionnelle, chargée en mode développeur depuis `extension/` |
| Données | Dépôt privé `Taaqz-13/todo-data`, fichier `data.json` |
| Déploiement | Push sur `main` → GitHub Actions → Pages (environ 1 min) |
| Tests | 142 tests Node + 46 vérifications de chargeabilité de l'extension |

Fonctions livrées : inbox complète (tout ce qui est ouvert, groupé En retard / Planifiées / Sans date), projets avec couleurs, raccourcis de saisie en français, récurrences, priorités p1-p4, vues Aujourd'hui / À venir / Terminées, recherche, mode clair et sombre, hors ligne, ouverture directe sur la saisie en mobile, capture Chrome en `Ctrl+Maj+K` avec menu contextuel.

## Relancer le chantier

```bash
cd ~/todo-app
node tests/nlp.test.js && node tests/core.test.js && node tests/background.test.js
node tools/check-extension.js
python -m http.server 8642 --directory .
```

Trois réflexes avant tout commit :

1. Modifié `js/nlp.js` ? Lancer `node tools/sync-shared.js` (sinon l'extension et la web app divergent).
2. Touché à l'extension ? Lancer `node tools/check-extension.js` avant de recharger dans Chrome.
3. Vérifier le rendu réel, pas seulement les tests : `tests/popup-harness.html` permet de tester la fenêtre de capture dans un onglet normal, sans recharger l'extension.

Après un push, l'app se met à jour seule au lancement suivant (service worker en revalidation forcée). Sur iPhone, fermer complètement l'app puis la rouvrir.

## Pièges déjà rencontrés (ne pas les repayer)

| Piège | Ce qui se passe | Solution retenue |
|---|---|---|
| GitHub Pages, build classique | "Page build failed" sans détail sur un dépôt neuf, même avec `.nojekyll` | Déploiement par workflow `actions/deploy-pages` (`.github/workflows/pages.yml`). Le champ `status` de l'API `/pages` peut rester "errored" alors que le site est servi : se fier au code HTTP. |
| Cache de 10 minutes de Pages | Rechargement juste après un déploiement = mélange ancien/nouveau JS, écran vide | Service worker en `cache: 'no-cache'` (revalidation par ETag) |
| `default_locale` dans le manifeste | Chrome refuse de charger l'extension si `_locales/` n'existe pas | Retiré, et couvert par `tools/check-extension.js` |
| File d'attente de l'extension | Vider la file après envoi effaçait une capture arrivée pendant l'envoi | Ne retirer que les identifiants réellement envoyés, puis relancer |
| Entrée dans une liste de suggestions | Il fallait appuyer deux fois pour enregistrer | Entrée enregistre toujours ; flèches + Entrée pour choisir, Tab pour compléter |
| Clavier iOS au lancement | Safari interdit l'ouverture automatique du clavier sans geste | Le champ est ouvert et actif, un appui fait monter le clavier. Non contournable. |

## Pistes d'amélioration

Classées par rapport valeur / effort. Rien n'est engagé.

### Fort intérêt, effort modéré

- **Capture vocale iPhone** : accepter `?add=texte` dans l'URL pour créer une tâche au lancement, puis créer un raccourci Siri qui dicte et ouvre cette URL. Permet "Dis Siri, note que..." sans ouvrir l'app.
- **Report rapide** : balayer une tâche vers la droite pour la repousser à demain, vers la gauche pour la supprimer.
- **Réordonner à la main** : glisser-déposer dans une liste, avec un champ `order` dans la tâche.
- **Publier l'extension sur le Chrome Web Store** (5 $ une fois) : plus de mode développeur, installation sur tous les Chrome connectés au compte.

### Utile, effort plus lourd

- **Rappels et notifications** : Web Push fonctionne sur iOS 16.4+ pour une PWA installée, mais demande un serveur d'envoi (Hermès pourrait le faire). Sans serveur, se limiter à des notifications locales quand l'app est ouverte.
- **Sous-tâches** et **sections dans un projet** : change la structure de données, prévoir une migration du `data.json`.
- **Heure d'échéance** en plus de la date.
- **Récurrences avancées** : tous les 2 mardis, jours ouvrés, dernier vendredi du mois.

### Confort

- Étiquettes transverses (`@urgent`) en plus des projets.
- Corbeille consultable (les suppressions sont conservées 60 jours en base mais invisibles).
- Filtres enregistrés (par projet et priorité), export CSV.
- Priorité par défaut par projet.

## Limites assumées

- Pas de temps réel : la synchro se fait à l'ouverture, au retour sur l'app, au retour du réseau et toutes les 5 minutes. Suffisant pour un usage personnel, à revoir si plusieurs personnes éditent en même temps.
- Un token par appareil, à remettre à chaque expiration. C'est le prix du "pas de serveur, pas d'abonnement".
- L'historique complet des modifications vit dans les commits du dépôt de données : c'est la sauvegarde, et elle permet de récupérer un état antérieur en cas de fausse manipulation.
