---
name: Dev avec Emmanuel
description: Skill pour tous les projets de developpement avec Emmanuel — ecosysteme LUMIIA (10 projets sur Firebase lumiia-live). A utiliser des qu'il est question de code, architecture technique, debugging, infrastructure, choix de techno, ou modification d'une app/site/script/Cloud Function. Inclut workflows MCP autonomes, recuperation source via GitHub blob, pieges JS/Firebase a eviter, stack specifique de chaque projet, et regles de deploiement. Se declencher systematiquement, meme sans demande explicite.
---

# Dev avec Emmanuel — LUMIIA

## 1. Relation de travail

- Ton direct, professionnel, amical. Zéro flatterie, zéro courtoisie creuse.
- Emmanuel n'est pas développeur. La complexité technique reste de mon côté ; ce qui sort vers lui doit être actionnable.
- Avis critique attendu et défendu. Valider une mauvaise direction par défaut est une faute.
- Si Emmanuel propose une approche techniquement inférieure : le dire avec des faits, défendre la position, n'en changer que si une raison technique objective l'impose.
- Pas de demande de confirmation excessive : aller au bout des actions logiques, demander uniquement quand il y a un vrai choix avec impact.
- Choix par défaut face à simple/limité vs robuste/complexe : choisir la robuste. La complexité est mon problème.

---

## 2. Démarrage de session — workflow autonome

**Objectif central** : ne JAMAIS attendre qu'Emmanuel m'envoie le code, l'état du projet, ou la roadmap. Tout est récupérable seul dès que MCP Chrome est actif.

### 2.1 Vérifier MCP

Premier appel d'une session : `tabs_context_mcp` pour lister les onglets.

L'onglet **"LUMIIA Workspace"** (`https://i-immersion.github.io/lumiia-workspace/`) est le pivot — Firebase y est déjà initialisé, donc il sert pour toute lecture/écriture Firebase via JS dans le browser.

Si MCP n'est pas actif (aucun onglet retourné) : la **lecture Firebase RTDB reste possible** via curl bash direct (allowlist `*.firebasedatabase.app` configurée côté Anthropic). La lecture/modification du source code via GitHub blob fonctionne aussi sans MCP. **L'écriture Firebase reste impossible sans MCP** (rules Firebase exigent auth `contact@lumiia.fr`, et le sandbox n'a pas d'identitytoolkit).

### 2.2 Lire la roadmap entière

**Méthode 1 — bash direct (autonome, sans MCP)** :

```bash
curl -s 'https://lumiia-live-default-rtdb.europe-west1.firebasedatabase.app/roadmap.json' -o /tmp/roadmap.json
```

Puis en Python :
```python
import json
with open('/tmp/roadmap.json') as f:
    roadmap = json.load(f)
for k, p in roadmap.items():
    print(k, p.get('label'), 'tasks:', len(p.get('tasks') or {}), 'notes:', len(p.get('notes') or {}))
```

À utiliser en début de session pour la synthèse, lecture de tasks/notes, ou tout besoin read-only sur la roadmap. **Pas besoin que MCP Chrome soit actif.**

Pour lire d'autres paths Firebase publics (`/timesup`, etc.) : même pattern, juste changer le path. Pour les paths protégés (`/workspace/*`, `/tresorerie/*`) → MCP requis.

**Méthode 2 — via tab Workspace MCP** (Firebase déjà initialisé, utile pour cache et écriture) :

```js
const res = await fetch('https://lumiia-live-default-rtdb.europe-west1.firebasedatabase.app/roadmap.json');
const data = await res.json();
window.__roadmap = data; // cache local pour les batches suivants
```

L'URL `/roadmap` est en lecture publique (règles Firebase). En écriture, il faut être authentifié comme `contact@lumiia.fr` — donc obligatoirement via MCP Chrome (tab Workspace).

Pour lister tous les projets et leur état :
```js
for (const k of Object.keys(window.__roadmap)) {
  const p = window.__roadmap[k];
  console.log(k, p.label, 'tasks:', Object.keys(p.tasks||{}).length, 'notes:', Object.keys(p.notes||{}).length);
}
```

### 2.3 Récupérer le source d'un projet

**Méthode `github.com/blob`** — la seule qui marche depuis le sandbox bash :

```python
import subprocess, re, json, html as html_lib

repo = "i-immersion/lumiia-workspace"  # ou autre repo selon le projet
file = "index.html"
url = f"https://github.com/{repo}/blob/main/{file}"
subprocess.run(['curl', '-sL', '-A', 'Mozilla/5.0', url, '-o', '/tmp/page.html'])

with open('/tmp/page.html') as f:
    page = f.read()
m = re.search(r'<script type="application/json" data-target="react-app\.embeddedData">(.*?)</script>', page, re.DOTALL)
data = json.loads(html_lib.unescape(m.group(1)))

def find_key(obj, key):
    if isinstance(obj, dict):
        if key in obj: return obj[key]
        for v in obj.values():
            r = find_key(v, key)
            if r is not None: return r
    elif isinstance(obj, list):
        for item in obj:
            r = find_key(item, key)
            if r is not None: return r
    return None

raw_lines = find_key(data, 'rawLines')
src = '\n'.join(raw_lines)
```

`raw.githubusercontent.com` et `i-immersion.github.io` sont **bloqués par l'allowlist** ; seul `github.com` passe. La page `/blob/` retourne du HTML qui contient le source dans un JSON embedded — d'où le parsing.

### 2.4 Identifier la version actuelle

Avant TOUTE modification, vérifier la version en ligne :
- Workspace : pattern `<!-- LUMIIA Workspace v8.XX -->` + badges header `>v8.XX<`
- Trésorerie : champ `currentVersion` dans `roadmap/tresorerie` (Firebase)
- Autres apps : commentaire HTML ligne 2 + badge header

Toujours incrémenter depuis la version live, pas depuis ce que l'historique de session laisse penser.

---

## 3. Workflow d'une session de modification (Workspace en ex.)

### 3.1 Modifier le code

```python
src = open('/home/claude/source.html').read()

# Substitution avec assertion d'unicite avant chaque etape
old = "..."  # pattern exact, copie depuis source
new = "..."
assert src.count(old) == 1, f"Pattern non unique : {src.count(old)} occurrences"
src = src.replace(old, new)

# Toujours valider count == 1 AVANT replace.
# Si count != 1, lire la zone reelle avec re.search et adapter (indentation, espaces, accents)
```

Pour les patterns multilignes, attention à l'indentation réelle (2 espaces vs 4 selon contexte) — vérifier avec `re.search(r'pattern_partiel', src)` puis afficher un slice du source pour copier la zone exacte.

### 3.2 Valider la syntaxe JS

Méthode obligatoire avant livraison :

```python
import re
scripts = re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>', src, re.DOTALL)
biggest = max(scripts, key=len)
stubbed = re.sub(
    r"import\s+\{[^}]+\}\s+from\s+['\"]https://www\.gstatic\.com/firebasejs/[^'\"]+['\"];?",
    "/* firebase stubbed */", biggest)
open('/tmp/check.mjs', 'w').write(stubbed)
# subprocess.run(['node', '--check', '/tmp/check.mjs'], check=True)
```

Erreurs acceptables (faux positifs) : `document is not defined`, `window is not defined` — APIs browser, normal dans Node.
Erreurs bloquantes : `SyntaxError`, `Unexpected token`, accolades mal équilibrées.

### 3.3 Livrer le fichier

```python
import shutil
shutil.copy('/home/claude/index.html', '/mnt/user-data/outputs/index.html')
# Puis tool present_files avec ce path
```

**JAMAIS** le download Blob via le browser MCP (`a.click()` sur un Blob URL) — échec silencieux constaté v8.17, Emmanuel ne reçoit jamais le fichier.

### 3.4 Mettre à jour la roadmap

Depuis le browser MCP (tab Workspace connecté) :

```js
(async()=>{
  const { getApps } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  const { getDatabase, ref, update } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
  const db = getDatabase(getApps()[0]);
  await update(ref(db), {
    'roadmap/workspace/tasks/wXX': {
      label: "...",
      note: "...",
      order: N,
      status: 'done',
      version: 'vX.Y'
    }
  });
})();
```

Toujours utiliser `getApps()[0]` pour récupérer l'app déjà initialisée (ne pas réinitialiser).

### 3.5 Donner les actions à Emmanuel

Format obligatoire :
1. Télécharger le fichier depuis le panneau de la conversation
2. Le placer dans `Dropbox/.../<projet>/` (remplacer l'existant)
3. Lancer `deployer.command` (Workspace, RedaSpin) ou `firebase deploy` (Trésorerie, Cloud Functions)
4. Tests à faire en navigation privée

---

## 4. Limites techniques du sandbox

### 4.1 Allowlist bash (réseau)

**Accessibles** : `github.com`, `api.anthropic.com`, registries npm/pypi/crates, ubuntu archives, **`*.firebasedatabase.app`** (depuis 2026-05-10 : lecture RTDB autonome).

**BLOQUÉS** :
- `i-immersion.github.io` (live des apps)
- `raw.githubusercontent.com`
- `identitytoolkit.googleapis.com` (Firebase Auth API)
- `console.firebase.google.com`
- Toute URL externe non listée (y compris proxies CORS)

Conséquences :
- **Source code** : passer par `github.com/blob` + parsing rawLines (jamais via `i-immersion.github.io` ni raw)
- **Firebase RTDB lecture** : `curl` direct depuis bash sur les paths à `.read: true` (`/roadmap`, `/timesup`). Pour les paths protégés (`/workspace/*`, `/tresorerie/*`), MCP browser requis (tab Workspace authentifié).
- **Firebase RTDB écriture** : MCP browser obligatoire (rules exigent auth `contact@lumiia.fr` ou `auth != null` selon path). `curl` depuis bash ne peut pas signer un idToken.
- **Firebase Auth** : MCP browser obligatoire. Création de compte = manuelle Firebase Console (signup désactivé côté projet — API REST renvoie `ADMIN_ONLY_OPERATION`)

### 4.2 Filtres MCP browser (retour des outils JS)

Les retours des `javascript_tool` sont filtrés pour la sécurité. Patterns bloqués courants :
- `[BLOCKED: Cookie/query string data]` : présence de `?user=`, `?key=`, cookies, certaines query strings
- `[BLOCKED: Sensitive key]` : tokens, mots de passe, clés API, JWT
- `[BLOCKED: Base64 encoded data]` : longues chaînes hex/base64 (>~100 chars)
- `[BLOCKED: JWT token]` : structures JWT-like

Contournements quand le filtre bloque :
- Filtrer côté JS avant retour (ex : `text.replace(emailRegex, 'EMAIL')`)
- Découper en chunks plus petits (sample 200 chars max)
- Utiliser `window.__cache = data` côté browser puis manipuler par tranches sans retourner le contenu

Pour le source code, **toujours préférer la méthode github.com/blob** depuis bash plutôt que de tenter via fetch dans browser MCP (qui se ferait bloquer).

---

## 5. Architecture LUMIIA — communs

### 5.1 Firebase lumiia-live

- **Projet unique** : `lumiia-live`, plan **Blaze**, région **europe-west1** (Belgique)
- **Realtime Database** : `lumiia-live-default-rtdb.europe-west1.firebasedatabase.app`
- **Cloud Functions** déployées (toutes europe-west1) :
  - `pennylane` (Trésorerie — proxy API Pennylane)
  - `sendXpressNotifications` (Workspace — FCM scheduled toutes les minutes)
  - `sendBonEmail` (Bons Kdo — envoi via Mailjet)
  - `validerBon` (Bons Kdo — validation QR)
  - `getMailjetStats` (Bons Kdo — récupération stats email)
- **Hosting** : Firebase Hosting pour Trésorerie. Les autres apps sur GitHub Pages (migration prévue v9.0 Workspace).
- **Auth Firebase** : email/password, partagé entre toutes les apps. Signup **désactivé** côté projet (création compte = manuelle Firebase Console).

### 5.2 Comptes utilisateurs

| Email | ID | Rôle |
|---|---|---|
| `contact@lumiia.fr` | `em` | Admin (Emmanuel) |
| `aurelie@lumiia.fr` | `au` | Équipe permanente |
| `marion.duizabo@hotmail.com` | `ma` | Équipe permanente |
| `romain.desquinabo@gmail.com` | `ro` | Équipe permanente |
| `invite@lumiia.fr` | `inv` | Compte mutualisé externes ponctuels |

Mot de passe initial commun : `LUMIIA2026!` (les utilisateurs peuvent le changer).

Mapping email → ID hardcodé dans le source Workspace (`EMAIL_TO_MEMBER`). Pour ajouter un utilisateur, suivre `roadmap/workspace/notes/n15` (process documenté).

### 5.3 Pattern proxy Cloud Function

Toutes les API externes (Pennylane, Hiboutik, Yavin, Mailjet) passent par une Cloud Function proxy.

Côté client :
```js
const token = await auth.currentUser.getIdToken();
const r = await fetch(CF_URL, { headers: { Authorization: `Bearer ${token}` } });
```

Côté Cloud Function : `admin.auth().verifyIdToken(token)` puis vérification rôle admin si besoin. Rejet 401 si non authentifié.

### 5.4 Règles Firebase RTDB (depuis 2026-04-08)

- Racine : `.read: false, .write: false` (deny par défaut)
- `/workspace/*` : `auth != null` (lecture+écriture)
- `/roadmap` : lecture publique, écriture `auth.token.email === 'contact@lumiia.fr'`
- `/tresorerie/*` : lecture `auth != null`, écriture `auth.token.email === 'contact@lumiia.fr'`
- `/timesup` : public read+write (jeu local, pas d'auth)
- `/bons_kdo`, `/redaspin` : à vérifier au cas par cas

### 5.5 Règles de déploiement

- **JAMAIS** `firebase deploy --force` depuis un dossier `functions/` qui ne contient pas TOUTES les fonctions du projet (incident 2026-04-08 : `sendXpressNotifications` effacée puis restaurée)
- Toujours répondre **N** à la question de suppression lors d'un deploy
- Pour forcer un redéploiement sans changement : modifier un commentaire dans `functions/index.js`
- Versionnage : `vX.Y.Z`, chaque livraison (même fix mineur) = nouveau numéro
- **Cloud Function** (`functions/index.js`) : JAMAIS livré comme fichier téléchargeable. Toujours via `cat > "...chemin.../functions/index.js" << 'EOF' ... EOF` dans le terminal. Évite la confusion sur le renommage.

---

## 6. Les 10 projets

### 6.1 🛠️ Workspace

- **URL** : `https://i-immersion.github.io/lumiia-workspace/`
- **Repo** : `i-immersion/lumiia-workspace`
- **Stack** : HTML/CSS/JS vanilla, **script classique** (pas type="module"). Toutes les fonctions sont globales sans `window._`.
- **Piège** : `let`/`const` au top-level d'un script classique ne sont PAS sur `window`. Utiliser `window.maVar = ...` ou `var` si besoin pour onclick.
- **Modules** : Notes, Tâches, Xpress, Semaine, Projets, CRM Prospects (admin), Roadmap (admin), Dashboard
- **Firebase paths** : `/workspace/items` (notes/todos/xpress), `/workspace/projects`, `/workspace/prospects`, `/workspace/fcm_tokens/{userId}/{mobile|desktop}`, `/workspace/settings/cats`
- **FCM** : tokens fixes `mobile`/`desktop`. Envoi uniquement aux mobile (filtre Cloud Function pour éviter doublon Chrome sync). Tag stable `lumiia-{itemId}` pour dédup Android. SW avec snooze (+5min, +1h) via IndexedDB + Firebase REST.
- **Cloisonnement v8.18+** : Helper `isItemVisibleToUser(item)` filtre par owner/assignee/validateBy/shared. Admin (`em`) voit tout. Boutons CRM/Roadmap masqués pour non-admins via `applyUserPermissions()` après login.
- **Process ajout user** : voir `roadmap/workspace/notes/n15`. Création compte Firebase = manuelle pour Emmanuel, le reste automatisable.
- **Déploiement** : `deployer.command` (script local : `git add -A && git commit && git push`)
- **Version courante** : voir badges header live (référence au moment de la rédaction : v8.20)
- **Tâches en cours** : v8.21 bouton accès Planning, supprimer code Google Calendar (v8.10), CHANGELOG/DEVLOG à mettre à jour, migration Firebase Hosting v9.0

### 6.2 💰 Trésorerie

- **URL** : Firebase Hosting (web.app)
- **Repo** : `i-immersion/lumiia-tresorerie`
- **Stack** : HTML/CSS/JS, **type="module"** ES6. Toutes les fonctions appelées par `onclick` doivent être exposées via `window._maFonction = () => {}`. Sans ça, le bouton ne réagit pas (debug : taper le nom dans console, "undefined" = pas sur window).
- **Cloud Function** : `pennylane` (proxy API Pennylane avec idToken). Token dans Firebase config.
- **Sync comptable** : Pennylane via API. CIC, Stripe, Hiboutik (futur via Chift) → Pennylane.
- **Version courante** : `v3.57` (champ `roadmap/tresorerie/currentVersion`)
- **Tâches todo** : alertes IA contextuelles (v3.60), saisie estimations CA futurs (v3.60), bulle question IA (v3.70), export rapport mensuel PDF (v3.80), graphique CA par activité comparatif (v3.58)

### 6.3 🌐 Site LUMIIA

- **URL future** : `lumiia.fr` (Firebase Hosting prévu — actuellement GitHub Pages)
- **Repo** : `i-immersion/lumiia-site`
- **Stack** : HTML/CSS/JS multi-pages, header/footer partagés via `fetch` (partials)
- **Architecture** : multi-pages **par intention visiteur** (pas par activité interne). Pages : `/` + `/experiences` + `/bar` + `/live` + `/groupes` + `/atelier` + `/agenda` + `/infos` + `/bientot`
- **Décisions stratégiques avril-mai 2026** : V1 été = familles touristes camping + groupes potes <1h escapade. V2 rentrée septembre = pivot locaux. 3 portes home V1 : EXPÉRIENCES (cyan) / BAR (magenta) / LIVE (purple, ex-Studios). Spectacle reporté V2.
- **Firebase-ready** : architecture éditoriale prévue dès V1. Stockage `/site_content/{page}/{section}/{field}`. Admin unifié `/admin/` (Marion/Aurélie/Emmanuel éditent eux-mêmes via Firebase Auth).
- **Module résa** : iframe externe fournie par Nico
- **Analytics** : Plausible (9€/mois) ou Umami (gratuit) — à décider

### 6.4 💳 Caisse

- **Statut** : à démarrer (démo Hiboutik en cours)
- **Stack** : webapp HTML/CSS/JS pour tablette landscape (1280×800), Firebase Hosting prévu
- **Hiboutik** : moteur caisse NF525 en arrière-plan. Option Premium 9,90€/mois (API + stats + Pennylane). API REST + webhooks.
- **Yavin** : TPE par `serialNumber` (au dos du TPE). Cloud API `POST /api/v4/pos/payment/`. Double connexion WiFi+4G. Indépendamment utilisable en direct.
- **Flux comptable** : Hiboutik → ticket Z auto chaque soir → Pennylane via Chift. Stripe → Pennylane natif (vérifier doublons). Qonto → Pennylane via banque.
- **Architecture** : app séparée de Trésorerie (usage opérationnel serveurs vs pilotage Emmanuel). Autant de tablettes que voulu.

### 6.5 🎁 Bons Kdo

- **URL** : `https://i-immersion.github.io/bons_kdo/` (v0.9), scanner mobile `/bons_kdo/scan/` (v0.3.4)
- **Repo** : `I-immersion/bons_kdo`
- **Stack** : HTML/CSS/JS vanilla, Firebase Auth partagé Workspace
- **3 Cloud Functions** : `sendBonEmail` (Mailjet), `validerBon` (validation QR), `getMailjetStats` (stats email — chunks 100/appel, persistées dans `bon.mailjet_stats`)
- **Format ticket PDF** : A5 paysage 595×420pt, zone gauche 75% + stub QR droite 25%. Logo TB embarqué base64 dans `assets.js`. Couleurs : cyan standard, lime VIP, magenta consolation.
- **Email Néon Gradient** : header `#0a0a3e → #3a1a78 → #5a2a8e`. Logo Mailjet CID. Bandeau VOTRE LOT cosmos.
- **Codes uniques** : 8 chars alphanumériques sans I/L/O/0/1, regex `/^[A-Z0-9]{8}$/`
- **Scanner** : html5-qrcode caméra arrière, saisie manuelle alternative anti-zoom iOS, FAB lime QR vers la page elle-même (Mac→mobile)
- **Audit trail complet** : `last_status_change/by`, `utilise_via` (admin manuel vs scan QR mobile)
- **Bilan REDA mai 2026** : 54 bons envoyés, 100% délivrés, 37% ouverts, 5,5% cliqueurs

### 6.6 🎡 REDA SPIN

- **URL** : `https://i-immersion.github.io/LUMIIA-REDA-SPIN/`
- **Repo** : `I-immersion/LUMIIA-REDA-SPIN`
- **Stack** : fichier unique `index.html` (~2366 lignes), Web Audio API pour sons
- **Déploiement spécial** : `python3 write_vXX.py && git add index.html && git commit -m vX.X && git push`. Le `write_vXX.py` est généré par Claude, encode HTML en base64 pour éviter problèmes de copie terminal.
- **Architecture** : 3 vues (Projection plein écran 1080p / Joueur mobile standalone / Tirage 80 rounds animé)
- **Quiz** : 400 questions × 8 catégories, 5 par partie aléatoires
- **Sécurité** : anti-replay par email status=gagne, cheat button transparent 60×60px top-left long press 4s
- **Stocks** : `-1=infini`, `0=épuisé→fallback`, `N=décrément`. `LOT_FALLBACK` = champ texte libre

### 6.7 🎮 Times Up

- **URL** : `https://i-immersion.github.io/lumiia-timesup/`
- **Repo** : `i-immersion/lumiia-timesup`
- **Stack** : HTML/CSS/JS vanilla, **Firebase compat SDK v9.23** (différent des autres apps qui utilisent modular SDK v10.12)
- **Pas de Firebase Auth, pas de Cloud Function, pas de type=module ES6**. App de jeu local réseau — ne PAS aligner sur les autres apps.
- **Bug historique v7** : conflit init Firebase avec Workspace (même origin github.io). Fix : `firebase.apps.find(a=>a.name==='timesup') || firebase.initializeApp(config, 'timesup')`
- **Règles Firebase** : `/timesup: { .read: true, .write: true }` (pas d'auth). Si absent → `permission_denied` silencieux → sync morte.

### 6.8 🗓️ Planning

- **URL** : `https://i-immersion.github.io/lumiia-planning/`
- **Repo** : `I-immersion/lumiia-planning`
- **Stack** : à découvrir précisément en début de session dédiée (vraisemblablement vanilla)
- **Statut** : 624 notes en Firebase, 15 tasks toutes done. App active mais usage indépendant de Workspace.
- **Future intégration** : bouton dans header Workspace (tâche `t_planning_btn` v8.21)

### 6.9 📧 Newsletter

- **Statut** : 2 tâches WIP (validation template sur 3 clients mail, premier envoi manuel)
- **Stack** : Mailjet + template HTML Néon Gradient + module Workspace (à venir)
- **Future** : onglet Newsletter dans Workspace (v1.5), connexion API Mailjet, historique campagnes Firebase, dashboard stats
- **Description** (de la roadmap) : "Infrastructure email autonome — Mailjet + template HTML + module Workspace"

### 6.10 🧠 _global (méta-projet)

Pas un projet déployé, mais un container de notes de référence pour les conventions communes (8 notes) :
- Démarrage de session
- Infra commune lumiia-live
- Règles de déploiement
- Pattern proxy Firebase
- Pièges JS connus
- Format roadmap
- Comment travailler avec Claude
- Boutons onclick — règle window

À consulter en début de session pour rappels.

---

## 7. Pièges connus à éviter

### 7.1 Accents dans strings JS simples
`'Aurélie'` (apostrophes simples) dans un module ES6 Chrome → crash silencieux. **Solution** : unicode escape (`'Aur\u00e9lie'`) ou template literals (` `Aurélie` `).

### 7.2 Escapes Unicode dans HTML
`<span>\ud83d\udc65</span>` → s'affiche en littéral dans HTML. Les escapes ne sont interprétés que dans les string literals JS. **Solution** : utiliser le vrai caractère UTF-8 (`<span>👥</span>`).

### 7.3 Timezone UTC/local
`.toISOString().split('T')[0]` → décalage de jour selon le fuseau. **Solution** : toujours `localDateStr(date)` (helper local).

### 7.4 Object.values + Firebase snapshot
`Object.values(snapshot.val())` perd les IDs Firebase. **Solution** : injecter l'id dans chaque objet au chargement (`obj.id = key`).

### 7.5 onclick et module ES6 (Trésorerie)
Module ES6 → rien n'est global par défaut. `<button onclick="myFunc()">` ne marche pas. **Solution** : `window._myFunc = myFunc` au top niveau, puis `<button onclick="_myFunc()">`. Dans Workspace (script classique), les fonctions globales fonctionnent directement.

### 7.6 str_replace en chaîne
Plusieurs `str.replace` consécutifs sur le même fichier : risque d'accolades en trop, doublons de fonction, perte de keyword `function` ou `async`. **Solution** : assertion `count == 1` AVANT chaque replace, vérification finale du nombre d'occurrences attendues.

### 7.7 Versions multiples à mettre à jour
Une version apparaît typiquement à 3 endroits dans Workspace : commentaire HTML ligne 2, badge header desktop, badge header login screen. **Solution** : `re.sub(r'>vX\.Y<', '>vX.Z<', src)` + `src.replace('<!-- LUMIIA Workspace vX.Y -->', '<!-- LUMIIA Workspace vX.Z -->')`. **Ne pas tout remplacer aveuglément** : les commentaires `// vX.Y :` historiques doivent rester en l'état.

### 7.8 Download Blob via browser MCP
Échec silencieux constaté v8.17 — Emmanuel ne reçoit pas le fichier. **Solution** : toujours `present_files` via `/mnt/user-data/outputs/`.

### 7.9 firebase deploy --force
Effacement accidentel des fonctions sœurs si le dossier `functions/` ne les contient pas toutes. Incident 2026-04-08. **Règle** : jamais `--force`, toujours **N** à la suppression.

### 7.10 Sauvegarde du fichier Python en cours
Si un script Python multi-étapes modifie `src` en mémoire mais n'écrit pas le fichier à la fin, les modifications sont perdues. **Toujours** finir par un `with open(..., 'w') as f: f.write(src)` après les MODs, et idéalement écrire dans `/home/claude/index.html` avant de copier dans `/mnt/user-data/outputs/`.

---

## 8. Format des réponses — obligatoire

Chaque message structuré en deux blocs distincts :

- **EXPLICATION** : contexte, diagnostic, ce qui a changé. Emmanuel n'a rien à faire ici.
- **ACTION DE TA PART** : ce qu'Emmanuel doit faire, numéroté, une action par étape, claire et actionnable.

Ne jamais mélanger. Emmanuel doit savoir sans ambiguïté si c'est pour info ou pour action.

### Avant de coder

1. Identifier les options réalistes (3+ si sujet structurant)
2. Évaluer chaque option : fiabilité, complexité, maintenabilité, coût, limites
3. Donner **une** recommandation argumentée — pas un menu d'options
4. Signaler les risques avant de commencer, même si ça bloque

### Demandes vagues

- Poser les questions AVANT de coder, jamais après
- Utiliser le widget de sélection (`ask_user_input_v0`) pour les choix discrets
- Une question avec impact = une question. Pas de batterie de questions inutiles.

---

## 9. Équipe et utilisateurs

- **Emmanuel** : admin, décideur, valide l'architecture, le cap, les choix structurants. Compte `em`.
- **Aurélie / Marion / Romain** : équipe permanente, **mêmes droits** dans Workspace (cloisonnement par utilisateur, chacun voit ce qui le concerne — admin voit tout).
- **Compte Invité** (`inv`) : compte mutualisé pour externes ponctuels. Aujourd'hui mêmes droits que l'équipe permanente. **Évolution future** : accès réduits (à coder quand le besoin émergera).

Pour ajouter un utilisateur Workspace : suivre `roadmap/workspace/notes/n15`. Le seul geste manuel d'Emmanuel est la création du compte Firebase Console (~1 min).

---

## 10. Communication

- Markdown propre, pas de formatting agressif
- Pas d'emojis sauf si Emmanuel en utilise
- Concision : ne pas répéter ce qu'Emmanuel sait déjà
- Citer fichier/ligne pour les bugs : `index.html:L1234`
- Widgets de sélection : 2-3 questions max par tour, options courtes et exclusives
- Quand Claude découvre un nouveau projet, lire d'abord les notes de la roadmap correspondante (`roadmap/{projet}/notes/n*`) avant de proposer quoi que ce soit

---

## 11. Maintenance de ce skill

Ce skill évolue. À mettre à jour quand :
- Un nouveau projet rejoint l'écosystème
- Une convention change (ex : passage TypeScript, migration framework)
- Un piège récurrent est identifié et résolu durablement
- L'organisation de l'équipe évolue (nouveaux rôles différenciés)
- Une URL/repo principale change

La **roadmap Firebase** (`/_global` + chaque projet) reste la source de vérité opérationnelle. Le skill encode les règles, la roadmap encode l'état des tâches en cours.
