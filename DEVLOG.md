# DEVLOG — LUMIIA Workspace
Journal technique des tentatives, bugs récurrents, et décisions avec contexte.
À lire avant chaque session de développement pour éviter de répéter les erreurs.

---

## Bugs récurrents — À surveiller systématiquement

### 1. Accents dans strings JS simples `''`
**Symptôme** : app complètement cassée au chargement, aucune fonction sur `window`
**Cause** : Chrome ES6 module est strict sur l'encodage. Les strings `'tâche'`, `'catégorie'`, `'Supprimer'` en strings simples JS crashent le module silencieusement.
**Solution** : remplacer par unicode (`\u00e2che`) ou reformuler sans accent.
**Detection** : tester avec `vm.runInNewContext` SANS nettoyage préalable — simuler Chrome exactement.
**Fichiers concernés** : strings dans `textContent =`, `btn.title =`, seedDemo, tout JS hors template literals.

### 2. Fonctions perdant leur déclaration après str_replace
**Symptôme** : `TypeError: window.renderTodos is not a function` ou équivalent
**Cause** : lors d'un str_replace complexe, le keyword `function` peut être supprimé si le bloc à remplacer chevauche une déclaration.
**Solution** : toujours vérifier avec `grep -n "function nomFonction"` après chaque str_replace sensible.
**Versions touchées** : v3.9 (selectNotePrio), v4.4 (toggleDayAccordion)

### 3. Doublons de déclaration (`const`, `let`, `function`)
**Symptôme** : `SyntaxError: Identifier 'X' has already been declared`
**Cause** : ajout d'une fonction qui existait déjà ailleurs dans le code.
**Solution** : `grep -n "function nomFonction\|let nomVariable\|const nomVariable"` avant d'ajouter.
**Versions touchées** : v4.3 (setSemaineFiltre déclaré deux fois)

### 4. Accolades mal fermées dans les blocs str_replace
**Symptôme** : fonctions après le bloc modifié deviennent orphelines (code hors fonction)
**Cause** : str_replace sur un bloc avec des `if/else` imbriqués, accolade fermante manquante.
**Solution** : compter les `{` et `}` dans chaque str_replace. Tester avec le validateur après.
**Versions touchées** : v3.9 (selectProject)

### 5. Timezone UTC/local
**Symptôme** : tâche du "23 mars à 19h" affichée le "22 mars" ou "24 mars"
**Cause** : `new Date().toISOString().split('T')[0]` retourne la date UTC. En France (UTC+2), à 23h locale c'est déjà le lendemain en UTC.
**Solution** : utiliser `localDateStr(date)` partout pour les comparaisons de date.
**Fonction** : `localDateStr = (d) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')`

---

## Tentatives échouées

### Notifications — Flux OAuth manuel (v4.8)
**Ce qu'on a essayé** : implémentation OAuth 2.0 manuel avec `URLSearchParams` + popup `window.open` + polling `popup.location.hash`.
**Pourquoi ça a échoué** : Chrome bloque les popups qui ne sont pas déclenchés directement par un geste utilisateur. Avoir un `await save()` entre le clic et `window.open()` rompt la chaîne du geste.
**Solution retenue** : Google Identity Services (GIS) — bibliothèque officielle Google qui gère le popup nativement.

### Notifications — iframe silencieuse OAuth (v4.8)
**Ce qu'on a essayé** : tenter une auth silencieuse via `<iframe src="accounts.google.com/...?prompt=none">` puis fallback popup.
**Pourquoi ça a échoué** : l'iframe ne peut pas communiquer avec la page parent (CORS), le message `postMessage` n'arrive jamais. Timeout après 3s → fallback popup → bloqué par Chrome.
**Solution retenue** : GIS gère le flux silencieux en interne.

### Notifications — Service Worker
**Ce qu'on a évalué** : SW pour notifications même Chrome en arrière-plan.
**Pourquoi abandonné** : FCM couvre tous les cas (Chrome fermé, veille profonde) sans les limites du SW. Le SW ne fonctionne pas si Chrome est complètement tué par Android (optimisation batterie agressive Samsung notamment). FCM est la seule vraie solution robuste.

### Notifications — Google Calendar seul (v4.8 → v5.x)
**Ce qu'on a essayé** : créer des événements Calendar avec alarme popup 0 minute via API REST.
**Résultat** : les événements étaient bien créés (confirmé dans Google Agenda), mais pas de notification reçue pendant les tests.
**Diagnostic** : les événements de test étaient créés avec une heure déjà passée. Calendar ne notifie pas rétrospectivement. Une fois ce bug corrigé (v5.3), le flux Calendar fonctionne techniquement mais nécessite que Google Agenda Android soit configuré correctement. Abandonné au profit de FCM.

### Projets en localStorage (avant v3.8)
**Ce qu'on a essayé** : stocker les projets créés via l'UI en localStorage.
**Pourquoi ça a échoué** : perdus au rechargement de page, non partagés entre utilisateurs, non synchronisés entre appareils.
**Solution retenue** : Firebase `/workspace/projects` avec `onValue` temps réel.

---

## Décisions techniques avec contexte

### FCM retenu pour les notifications
**Date** : Mars 2026
**Contexte** : après avoir exploré SW, Calendar, et OAuth manuel, aucune solution n'était vraiment robuste.
**Décision** : FCM (Firebase Cloud Messaging) est la seule solution qui couvre Chrome fermé + veille profonde + tous les utilisateurs sans config manuelle. Tu as déjà Firebase en place. Implémentation nécessite une Cloud Function.
**À implémenter** : Cloud Function Firebase + enregistrement token FCM par appareil au démarrage de l'app.

### Architecture notifications Xpress actuelle (en attente FCM)
**État** : Google Calendar pour heure fixe (fonctionne si Agenda Android configuré), Google Tasks pour compte à rebours (nécessite Tasks API activée). Code Google Calendar à supprimer une fois FCM implémenté.

### Catégories globales vs sous-catégories projet
**Décision** : si un projet est sélectionné dans la modale, les catégories globales sont masquées — uniquement les sous-catégories du projet. Si "Aucun projet", les catégories globales sont affichées.
**Raison** : cohérence — pas de sens d'affecter à la fois un projet et une catégorie globale.

### `localDateStr` obligatoire pour toutes les dates
**Décision** : ne jamais utiliser `.toISOString().split('T')[0]` pour les dates locales.
**Raison** : décalage UTC/local en France (UTC+2 en été) qui décale d'un jour les comparaisons.

---

## Notes sur l'environnement technique

### Testeur Node.js vs Chrome
Le testeur `vm.runInNewContext` valide la syntaxe JS mais **ne détecte pas** les accents dans les strings — Node.js gère bien l'unicode, Chrome ES6 module non. Toujours scanner les strings JS simples avec accents manuellement avant génération.

### GitHub Pages + deployer.command
Le déploiement via `deployer.command` fait un `git push` vers `i-immersion/lumiia-workspace`. GitHub Pages met à jour en ~2 minutes. La version déployée est visible sur `https://i-immersion.github.io/lumiia-workspace/`.

### Firebase config
```
projectId: lumiia-live
databaseURL: https://lumiia-live-default-rtdb.europe-west1.firebasedatabase.app
Client OAuth: 823919513931-igf7jdknqhioqdr0dssig4en4ubn08mu.apps.googleusercontent.com
Testeurs Google OAuth : emmanuel.exbrayat@gmail.com, aureliehurtado2@gmail.com
```

### Structure Firebase
```
/workspace/items      → notes, todos, xpress
/workspace/projects   → projets avec sous-catégories
/workspace/prospects  → fiches prospects (CRM simplifié)
```
