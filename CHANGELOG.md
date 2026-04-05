# CHANGELOG — LUMIIA Workspace
Toutes les modifications notables du projet, version par version.
Format : `[vX.Y] — date — description`

---

## [v8.6] — 5 avril 2026
- Focus du jour déplacé du Dashboard vers la vue **Semaine** (en haut, avant les retards)
- Focus du jour toujours visible même sans tâches flaggées (message d'invitation)
- Tâches dans Focus du jour cochables directement depuis la vue Semaine
- Correction bug réglages catégories : `updateCatLabel(idx, val)` exposé sur `window` (les `oninput` inline ne peuvent pas accéder aux variables de module ES6)
- Correction bug bouton VUE CRM : valeur calculée au rendu, plus de référence à `crmView` dans le `onclick` (variable de module non accessible globalement)

## [v8.5] — 5 avril 2026
- Correction `setCrmView` : force `currentModule = 'crm'` avant render
- Correction listener Firebase settings : ne réécrase plus CATS si déjà rempli (évite la perte des catégories après sauvegarde)
- Focus du jour dans Dashboard (temporaire, déplacé en v8.6)

## [v8.4] — 5 avril 2026
- Interrupteur ☀ "Traiter aujourd'hui" sur chaque tâche (`todayFlag: true`)
- CSS `.today-flagged` : fond jaune + bordure gauche ambrée
- Tâches `todayFlag` apparaissent dans vue Semaine au jour d'aujourd'hui (indépendamment de leur date d'échéance)
- `toggleTodayFlag(id)` exposé sur `window`
- Bloc "Focus du jour" dans Dashboard : barre de progression, message motivant dynamique
- Bug réglages catégories : `saveCats()` persiste dans Firebase `/workspace/settings/cats`
- Listener `onValue(SETTINGS_REF)` pour sync initiale des catégories
- VUE CRM : 2 boutons remplacés par toggle unique (Vue ▦ Cartes / Vue ≡ Tableau)
- CRM tableau : colonne ÉVÉNEMENT ajoutée

## [v8.3] — 5 avril 2026
- Correction bug critique : `openProspectModal` avait perdu son `function` header lors d'un str_replace — code du body s'exécutait hors fonction
- Correction accolade orpheline dans `selectProspectRelanceDate`
- `previousModule` mémorisé à l'ouverture d'une fiche détail → bouton ← Retour vers Dashboard ou CRM
- KPI cards Dashboard cliquables (Notes→Notes, Tâches→Tâches, Prospects→CRM)
- Montant prospects : "de devis actifs" à la place de "en jeu"
- `selectProspectRelanceDate(dateStr)` : sélection date précise pour les relances
- Input date synchronisé avec les boutons rapides de relance

## [v8.2] — 5 avril 2026
- Navigation restructurée : tab bar quotidien (Notes/Tâches/Projets/Semaine) + boutons modules header (CRM, 📊 Dashboard)
- `switchModule(module)` : toggle — recliquer ferme et revient aux tabs
- Highlight visuel bouton module actif
- **Module CRM** : vue tableau par défaut (Contact, Sujet, Statut, Dernière action, Relance, Montant) + toggle Tableau/Cartes
- Filtres statut dans CRM
- **Module Dashboard** : 4 KPI, 3 graphiques SVG (donut tâches, barres projets, donut prospects), 2 listes action (retards cliquables, activité récente)
- `render()` respecte `currentModule` en priorité sur les tabs (correction retour sur Notes)
- `switchTab()` reset `currentModule` et les boutons modules

## [v8.1] — 5 avril 2026
- Tokens FCM : clés fixes `mobile` et `desktop` au lieu de shortId aléatoire
- Maximum 1 token par type d'appareil par utilisateur
- Nettoyage des anciens tokens shortId dans Firebase

## [v8.0] — 5 avril 2026
- Service Worker détecte si l'app est visible avant d'afficher une notification système
- Foreground : SW envoie message à la page → bannière in-app (pas de doublon)
- Background : notification système normale
- Tag notification stable (`lumiia-{itemId}`) pour déduplication Android

## [v7.9] — 5 avril 2026
- `openItemFromNotification(itemId, itemType)` : routing unifié (xpress/note/todo/prospect)
- `openXpressFromNotification` conservé pour compatibilité
- SW passe `itemType` dans les données de notification
- Clic notification prospect → ouvre directement la fiche détail
- Cloud Function : envoie à tous les tokens (mobile + desktop)

## [v7.8] — 5 avril 2026
- Option C notifications : foreground = bannière in-app, background = notification système
- `onMessage` intercepte les notifications foreground (pas de doublon quand app active)
- SW `onBackgroundMessage` uniquement pour background

## [v7.7] — 5 avril 2026
- Champ `device: 'mobile'|'desktop'` ajouté aux tokens FCM à l'enregistrement
- Cloud Function filtre `device !== 'desktop'` (tentative de résolution doublon, abandonnée en v7.9)

## [v7.6] — 5 avril 2026
- Correction bug historique prospects : mauvais ID `modal-detail-body` → `detail-content`
- Dernier historique visible sur les cartes prospects (date + texte tronqué)
- Projet associé et montant visibles sur les cartes
- Section historique dans la fiche détail avec champ de saisie

## [v7.5] — 5 avril 2026 (version de départ session)

## [v6.5] — 5 avril 2026
- Suppression Google Calendar (155 lignes de dette technique)
- Navigation restructurée : tab bar quotidien + boutons header modules

## [v6.2 → v6.4] — 5 avril 2026
- Firebase Auth email/password activé
- 3 comptes créés : contact@lumiia.fr (em/admin), aurelie@lumiia.fr (au), marion.duizabo@hotmail.com (ma)
- Règles Firebase : `auth != null`
- Écran de connexion avec badge version
- Bouton déconnexion dans le menu utilisateur
- Mapping email → ID membre : contact@lumiia.fr→em, aurelie@lumiia.fr→au, marion.duizabo@hotmail.com→ma
- Cloud Function `sendXpressNotifications` : toutes les minutes, europe-west1
- Gère xpress, notes, tâches, prospects (champ `echeanceAt`)
- Tokens FCM : `mobile` et `desktop` clés fixes dans `/workspace/fcm_tokens/{userId}/`
- FCM SW avec déduplication par tag stable

---

## [v5.9] — Mars 2026
- Ajout onglet **Prospects** (mini-CRM) — visible admin uniquement
- Fiche prospect : prénom, nom, tel, email, sujet, type (devis/info), date événement, échéance relance, statut, notes
- Statuts : Nouveau / En cours / Clôturé / Archivé — filtres par statut
- Partage fiche via **WhatsApp** en un clic (message formaté + numéro pré-rempli)
- Alertes relances en retard (bannière rouge)
- Stockage Firebase `/workspace/prospects`

## [v5.8] — Mars 2026
- *(version déployée par Emmanuel entre sessions — contenu non reconstitué)*

## [v5.4 → v5.7] — Mars 2026
- *(versions déployées par Emmanuel entre sessions — contenu non reconstitué)*

## [v5.3] — Mars 2026
- Correction bug popup Google OAuth bloqué par Chrome (await intermédiaire entre clic et popup)
- Implémentation Google Identity Services (GIS) pour OAuth — remplace le flux manuel
- Suppression confirmation de suppression notes/tâches
- Correction logique overdue : `i.due < localDateStr(new Date())` cohérente entre Tâches et Semaine
- Google Tasks API activée sur Firebase project

## [v5.2] — Mars 2026
- Refonte OAuth Google : passage à GIS (`accounts.google.com/gsi/client`)
- Ajout `_pendingXpressReminder` pour traiter l'item Xpress après obtention du token
- Correction : le popup OAuth était bloqué car `requestAccessToken` appelé après `await save()`

## [v5.1] — Mars 2026
- Suppression confirmation de suppression (items notes/tâches)
- Correction overdue Tâches : utilise `localDateStr` au lieu de `new Date(i.due) < new Date()`

## [v5.0] — Mars 2026
- Remplacement OAuth manuel par Google Identity Services
- Ajout script GIS dans `<head>`
- Logs console pour diagnostiquer les appels Calendar

## [v4.9] — Mars 2026
- Modale Xpress refonte UX : interface tout-en-un sélecteur H:MM + boutons timer
- Ajout durées : 2min, 2h, 3h, 12h, 24h
- Indication "aujourd'hui à 19h00" ou "demain à 08h00" en temps réel

## [v4.8] — Mars 2026
- Intégration Google Calendar API pour notifications Xpress heure fixe
- Intégration Google Tasks API pour notifications Xpress compte à rebours
- OAuth Google via popup

## [v4.7] — Mars 2026
- Correction : `openXpressModal` ne demande la permission notification qu'une seule fois

## [v4.6] — Mars 2026
- **Feature Xpress** : nouveau type d'item note rapide avec rappel
- FAB menu contextuel : Note / Tâche / Xpress
- Notifications Web + vibration Android à l'échéance
- Restauration timers Xpress au rechargement

## [v4.5] — Mars 2026
- Correction `overdue` dans `renderTodos` : utilise `localDateStr`

## [v4.4] — Mars 2026
- Correction doublon `setSemaineFiltre` déclaré deux fois
- Correction `toggleDayAccordion` qui avait perdu sa déclaration `function`

## [v4.3] — Mars 2026
- Correction accents dans strings JS simples
- Suppression fonctions dépréciées

## [v4.2] — Mars 2026
- Correction crash module Chrome : accents dans strings JS

## [v4.1] — Mars 2026
- Filtres vue Semaine par projet/catégorie
- Sélecteur H:MM pour les heures
- Accordéon vue Semaine

## [v4.0] — Mars 2026
- Section En retard dans vue Semaine

## [v3.x → v1.x] — Mars 2026
- Voir historique précédent
