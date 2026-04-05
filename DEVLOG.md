# DEVLOG — LUMIIA Workspace
Journal technique des tentatives, bugs récurrents, et décisions avec contexte.
À lire avant chaque session de développement pour éviter de répéter les erreurs.

---

## Bugs récurrents — À surveiller systématiquement

### 1. Accents dans strings JS simples `''`
**Symptôme** : app complètement cassée au chargement, aucune fonction sur `window`
**Cause** : Chrome ES6 module est strict sur l'encodage.
**Solution** : remplacer par unicode (`\u00e9`) ou reformuler sans accent.
**Detection** : `node --check /tmp/check.mjs` après extraction du JS.

### 2. Fonctions perdant leur déclaration après str_replace
**Symptôme** : `TypeError: window.renderTodos is not a function`
**Cause** : le keyword `function` supprimé si le bloc à remplacer chevauche une déclaration.
**Solution** : `grep -n "function nomFonction"` après chaque str_replace sensible.
**Versions touchées** : v3.9, v4.4, **v8.3** (openProspectModal perdu son header)

### 3. Doublons de déclaration
**Symptôme** : `SyntaxError: Identifier 'X' has already been declared`
**Solution** : `grep -n "function nomFonction"` avant d'ajouter.
**Versions touchées** : v4.3, **v8.3** (selectProspectRelanceDate doublé)

### 4. Accolades mal fermées
**Symptôme** : fonctions orphelines après le bloc modifié
**Solution** : compter `{` et `}` dans chaque str_replace avec python3.
**Versions touchées** : v3.9, **v8.3** (accolade orpheline dans selectProspectRelanceDate)

### 5. Timezone UTC/local
**Symptôme** : dates décalées d'un jour
**Solution** : utiliser `localDateStr(date)` partout, jamais `.toISOString().split('T')[0]`

### 6. Variables de module ES6 non accessibles dans les onclicks HTML
**Symptôme** : `onclick="maVariable = valeur"` ne fait rien, `onclick="maFonction(maVariable)"` passe `undefined`
**Cause** : les variables déclarées dans un module ES6 ne sont pas sur `window`
**Solution** :
- Toujours exposer via `window.maFonction = maFonction`
- Ne jamais référencer des variables de module dans les attributs `onclick` HTML
- Utiliser des fonctions wrapper : `window.updateCatLabel = (idx, val) => { editingCats[idx].label = val; }`
- Pour les valeurs dynamiques dans onclick : calculer au moment du rendu, pas au clic
  - ❌ `onclick="setCrmView(crmView==='table'?'cards':'table')"` — `crmView` undefined au clic
  - ✅ `onclick="setCrmView('${crmView === 'table' ? 'cards' : 'table'}')"` — valeur calculée au rendu
**Versions touchées** : v8.4, v8.5, v8.6

### 7. `render()` ignorait `currentModule`
**Symptôme** : en CRM ou Dashboard, Firebase refresh → retour sur Notes
**Cause** : `render()` ne vérifiait que `currentTab`, pas `currentModule`
**Solution** : `if (currentModule) { render module } else { render tab }`
**Version corrigée** : v8.2, re-corrigée v8.5

### 8. Listener Firebase settings écrasait les catégories après sauvegarde
**Symptôme** : catégories disparaissent après `saveCats()`
**Cause** : `onValue(SETTINGS_REF)` déclenché après l'écriture Firebase, réécrit CATS avec l'ancienne valeur
**Solution** : ne réinitialiser CATS depuis Firebase que si vide (chargement initial uniquement)
**Version corrigée** : v8.5

---

## Tentatives échouées

### Notifications — Double notification téléphone (5 avril 2026)
**Ce qu'on a essayé** :
1. Filtrer par `device !== 'desktop'` dans la Cloud Function
2. SW détecte foreground via `clients.matchAll + visibilityState`
3. Tag notification stable sans `Date.now()`
4. Clés fixes `mobile`/`desktop` pour les tokens FCM

**Résultat** : double notification persistante sur téléphone
**Diagnostic probable** : Chrome Android + PWA installée = 2 contextes SW distincts recevant chacun la notification FCM, même avec 1 seul token mobile. Ou Chrome sync Google qui forward le token desktop sur Android.
**Décision finale** : accepter le double — l'une des deux ouvre la bonne fiche (clic fonctionnel), l'autre non. Non bloquant.

### Notifications — OAuth manuel (v4.8)
**Pourquoi abandonné** : Chrome bloque les popups sans geste utilisateur direct.

### Notifications — Service Worker seul
**Pourquoi abandonné** : ne fonctionne pas si Chrome est tué par Android (optimisation batterie).

### Notifications — Google Calendar (v4.8 → v5.x)
**Pourquoi abandonné** : dépendance à la config Google Agenda Android. FCM plus robuste.

### Projets en localStorage (avant v3.8)
**Pourquoi abandonné** : perdus au rechargement, non partagés. Firebase retenu.

---

## Décisions techniques avec contexte

### FCM pour les notifications (Mars 2026)
Seule solution couvrant Chrome fermé + veille profonde + tous utilisateurs sans config manuelle.
Cloud Function `sendXpressNotifications` tourne toutes les minutes, europe-west1.
Gère : xpress, notes, tâches (via `triggerAt`), prospects (via `echeanceAt`).

### Tokens FCM — clés fixes mobile/desktop (5 avril 2026)
Clés `mobile` et `desktop` dans `/workspace/fcm_tokens/{userId}/` au lieu de shortId aléatoire.
Garantit au maximum 1 token par type d'appareil. Les anciens tokens shortId doivent être nettoyés manuellement.

### Google Calendar supprimé (v6.5, 5 avril 2026)
155 lignes de dette technique supprimées. FCM couvre tous les cas.

### Firebase Auth email/password (v6.2, 5 avril 2026)
3 comptes : contact@lumiia.fr (em), aurelie@lumiia.fr (au), marion.duizabo@hotmail.com (ma)
Mot de passe commun : LUMIIA2026!
Règles Firebase : `auth != null`
Mapping email→ID : utilisé pour charger les items par owner.

### Navigation — Modules séparés des tabs quotidiens (v8.2, 5 avril 2026)
Tab bar = usage quotidien (Notes, Tâches, Projets, Semaine)
Boutons header = modules de pilotage (CRM, Dashboard, futur : Trésorerie)
`switchModule()` : toggle — recliquer ferme. `switchTab()` reset `currentModule`.

### Catégories globales — persistance Firebase (v8.4, 5 avril 2026)
`/workspace/settings/cats` dans Firebase Realtime DB.
Listener settings ne réécrase CATS que si vide (chargement initial).
`updateCatLabel(idx, val)` exposé sur window car oninput HTML ne peut pas accéder aux variables de module.

### Focus du jour — dans vue Semaine (v8.6, 5 avril 2026)
Fusionné dans la vue Semaine (en haut, avant le bloc retards).
Tâches `todayFlag` cochables directement depuis Semaine.
Bloc toujours visible même sans tâches flaggées.

### Interrupteur ☀ "Aujourd'hui" (v8.4, 5 avril 2026)
`todayFlag: boolean` sur les items de type `todo`.
Tâches flaggées apparaissent dans vue Semaine au jour d'aujourd'hui, quelle que soit leur date d'échéance.
Bouton ☀ sur chaque tâche non terminée dans la liste Tâches.

---

## Structure Firebase actuelle

```
/workspace/
  items/          → notes, todos, xpress (triggerAt pour notifs)
  projects/       → projets avec sous-catégories
  prospects/      → fiches CRM (echeanceAt pour notifs)
  settings/
    cats/         → catégories globales persistées
  fcm_tokens/
    {userId}/
      mobile/     → token FCM téléphone
      desktop/    → token FCM Mac/Chrome
```

---

## Notes sur l'environnement technique

### Validation syntaxe JS
```bash
python3 -c "
import re
with open('/home/claude/index.html') as f: content = f.read()
match = re.search(r'<script type=\"module\">(.*?)</script>', content, re.DOTALL)
js = match.group(1)
for url, stub in [
    ('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js','/tmp/fa.js'),
    ('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js','/tmp/fd.js'),
    ('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js','/tmp/fau.js'),
    ('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js','/tmp/fm.js'),
]: js = js.replace(url, stub)
with open('/tmp/check.mjs','w') as f: f.write(js)
" && node --check /tmp/check.mjs
```

### Déploiement Cloud Function
```bash
cd "/Users/emmanuelexbrayat/Dropbox/DB LUMIIA 2025/Outils APP Claude/Workspace/lumiia-workspace" && firebase deploy --only functions:sendXpressNotifications
```
La Cloud Function ne doit JAMAIS être livrée comme fichier téléchargeable — toujours via commande `cat > "...functions/index.js" << 'EOF' ... EOF` dans le terminal.

### Firebase config
```
projectId: lumiia-live
databaseURL: https://lumiia-live-default-rtdb.europe-west1.firebasedatabase.app
messagingSenderId: 823919513931
appId: 1:823919513931:web:6f6f3c7c6d1699457b18ce
```

### GitHub Pages + deployer.command
`deployer.command` fait `git add -A` → tous les fichiers inclus automatiquement.
Mise à jour ~2 minutes après push.
URL : https://i-immersion.github.io/lumiia-workspace/

---

## À faire (prochaines sessions)

- [ ] Migration Firebase Hosting (remplacer GitHub Pages)
- [ ] Connexion Workspace ↔ Trésorerie (Firebase Auth déjà en place des deux côtés)
- [ ] Module Trésorerie dans le header (bouton 💰)
- [ ] Upgrader Node.js vers v20 dans Firebase Functions (avertissement deprecation 2026-04-30)
