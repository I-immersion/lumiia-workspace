# CHANGELOG — LUMIIA Workspace

Toutes les modifications notables du projet, version par version.
Format : `[vX.Y] — date — description`

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
- Logs console pour diagnostiquer les appels Calendar (`✅ Event Calendar créé` / `❌ Calendar error`)

## [v4.9] — Mars 2026
- Modale Xpress refonte UX : suppression des 3 boutons Aucun/Heure/Timer
- Interface tout-en-un : sélecteur H:MM direct + boutons timer sur la même ligne
- Ajout durées : 2min, 2h, 3h, 12h, 24h
- Indication "aujourd'hui à 19h00" ou "demain à 08h00" en temps réel
- Correction accent "Tâche" dans le FAB menu (était `\u00e2che` en HTML)

## [v4.8] — Mars 2026
- Intégration Google Calendar API pour notifications Xpress heure fixe
- Intégration Google Tasks API pour notifications Xpress compte à rebours
- OAuth Google via popup — première autorisation demandée au clic "Créer"
- Rappel automatique Google Calendar pour tâches avec date d'échéance
- Client ID OAuth : `823919513931-igf7jdknqhioqdr0dssig4en4ubn08mu.apps.googleusercontent.com`

## [v4.7] — Mars 2026
- Correction : `openXpressModal` ne demande la permission notification qu'une seule fois (flag `lumiia-notif-asked`)

## [v4.6] — Mars 2026
- **Feature Xpress** : nouveau type d'item note rapide
- FAB menu contextuel : Note / Tâche / Xpress
- Modale Xpress : titre + rappel (heure fixe ou compte à rebours 5/10/15/30/60 min)
- Cartes Xpress : bord bleu `#38bdf8`, badge ⚡, timer countdown, bouton ✕
- Conversion Xpress → Note ou Tâche depuis le détail
- Notifications Web + vibration Android à l'échéance
- Restauration des timers Xpress au rechargement (`restoreXpressTimers`)
- Stockage Xpress dans Firebase `/workspace/items` (type: 'xpress')

## [v4.5] — Mars 2026
- Correction `overdue` dans `renderTodos` : utilise `localDateStr` (cohérence timezone)
- Correction `isOverdue` dans `renderTodoItem` et `openDetail`

## [v4.4] — Mars 2026
- Correction doublon `setSemaineFiltre` déclaré deux fois (crash module)
- Correction `toggleDayAccordion` qui avait perdu sa déclaration `function`

## [v4.3] — Mars 2026
- Correction accents dans strings JS simples (crash Chrome)
- Correction `selectNotePrio` qui avait perdu sa déclaration `function`
- Suppression fonctions dépréciées : `USERS`, `shareInvite`, `cycleSortOrder`

## [v4.2] — Mars 2026
- Correction crash module Chrome : accents dans strings JS (`tâches`, `catégorie`, etc.)
- Scan systématique des strings JS simples et remplacement par unicode

## [v4.1] — Mars 2026
- Filtres vue Semaine : chips par projet/catégorie (`setSemaineFiltre`)
- Sélecteur H:MM pour les heures (notes et tâches) — remplace les boutons prédéfinis
- Accordéon vue Semaine : Aujourd'hui plein, 6 autres jours collapsés (flèche ›)
- Correction timezone : `localDateStr(date)` pour toutes les comparaisons de date
- Fusion notes + tâches dans la Semaine, triées par heure puis priorité

## [v4.0] — Mars 2026
- Section **En retard** dans vue Semaine (au-dessus d'Aujourd'hui), fond rouge
- Logique overdue cohérente entre Tâches et Semaine
- Tri tâches par heure dans chaque journée Semaine

## [v3.9] — Mars 2026
- Correction `selectProject` : accolades mal fermées
- Correction `selectNotePrio` : déclaration `function` perdue
- Nettoyage code : suppression variables mortes, commentaires obsolètes

## [v3.8] — Mars 2026
- **Projets dans Firebase** `/workspace/projects` (plus localStorage)
- `editItem` restaure projet/subcat dans le picker à l'édition
- Correction affichage modale note : dot inline au lieu de classe CSS manquante
- Boutons Modifier/Supprimer inversés (Modifier à gauche)
- Catégories masquées si projet sélectionné (`cat-picker-global-section`)
- Fonction `saveProjects` async (Firebase)

## [v3.7] — Mars 2026
- *(version de référence avant session du 24 mars)*

## [v3.x] — Mars 2026
- Vue **Semaine** : Aujourd'hui plein + 6 jours accordéon
- Vue **Projets** : grille + vue détail avec sous-catégories
- Sous-catégories par projet
- FAB `+` avec menu contextuel
- Validation de tâches (`validateBy`, badge `✓ XXX`)
- Système de membres (localStorage `lumiia-members`)

## [v2.x] — Mars 2026
- Architecture multi-utilisateurs (Emmanuel admin, Aurélie, Marion)
- Visibilité des tâches par utilisateur
- Badge validation + feedback visuel
- Tri 3 états priorité
- Correction bug assignation (`updateMemberSelects` manquant)
- Correction 5 tâches Firebase (assignee bloqué sur 'em')

## [v1.x] — Mars 2026
- Version initiale : Notes + Checklist + To-do
- Firebase Realtime Database
- Catégories globales (Perso, Admin, Courant)
- Projets (LUMIIA, SIGNAL, Raffinés)
- PWA (manifest, icône, mobile-web-app-capable)
- Filtre par projet/catégorie
- Priorités (Urgent / Normal / Plus tard)
