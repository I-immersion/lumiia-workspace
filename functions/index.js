const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { getMessaging } = require('firebase-admin/messaging');
if (!getApps().length) { initializeApp(); }

// ════════════════════════════════════════════════════════════════════
// 1. WORKSPACE — sendXpressNotifications (existant, inchangé)
// ════════════════════════════════════════════════════════════════════
async function sendToUser(db, userId, title, body, itemId, itemType) {
  const tokensSnap = await db.ref('workspace/fcm_tokens/' + userId).get();
  const tokensData = tokensSnap.val();
  if (!tokensData) return;
  const tokens = Object.values(tokensData).filter(t => t.token).map(t => t.token);
  if (!tokens.length) return;
  await Promise.all(tokens.map(async (token) => {
    try {
      await getMessaging().send({
        token,
        notification: { title, body },
        data: { xpressId: itemId || '', itemType: itemType || '' },
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });
    } catch(e) {
      if (e.code === 'messaging/registration-token-not-registered') await db.ref('workspace/fcm_tokens/' + userId + '/' + token.slice(-8)).remove();
    }
  }));
}
exports.sendXpressNotifications = onSchedule(
  { schedule: 'every 1 minutes', region: 'europe-west1', timeZone: 'Europe/Paris' },
  async () => {
    const db = getDatabase();
    const now = Date.now();
    const itemsSnap = await db.ref('workspace/items').get();
    const items = itemsSnap.val();
    if (items) {
      for (const [id, item] of Object.entries(items)) {
        if (!['xpress','note','todo'].includes(item.type)) continue;
        if (!item.triggerAt || item.triggerAt > now || item.notificationSent) continue;
        await db.ref('workspace/items/' + id + '/notificationSent').set(true);
        const title = '\u26a1 ' + (item.title || 'Rappel');
        const body = item.type === 'xpress' ? (item.xpressTime ? 'Rappel : ' + item.xpressTime : 'Minuteur echu') : item.type === 'note' ? (item.noteTime ? 'Note a ' + item.noteTime : 'Rappel de note') : (item.dueTime ? 'Tache a ' + item.dueTime : 'Rappel de tache');
        await sendToUser(db, item.owner, title, body, id, item.type);
      }
    }
    const prospectsSnap = await db.ref('workspace/prospects').get();
    const prospects = prospectsSnap.val();
    if (prospects) {
      for (const [id, p] of Object.entries(prospects)) {
        if (!p.echeanceAt || p.echeanceAt > now || p.notifRelanceSent) continue;
        if (['archive','cloture'].includes(p.statut)) continue;
        await db.ref('workspace/prospects/' + id + '/notifRelanceSent').set(true);
        await sendToUser(db, p.owner, '\uD83D\uDCCB Relance prospect : ' + (p.prenom||'') + ' ' + (p.nom||''), p.sujet || 'Prospect a relancer', id, 'prospect');
      }
    }
  }
);

// ════════════════════════════════════════════════════════════════════
// 2. BONS KDO — sendBonEmail + validerBon + getMailjetStats
// ════════════════════════════════════════════════════════════════════
const bonsKdo = require('./bons_kdo');
exports.sendBonEmail = bonsKdo.sendBonEmail;
exports.validerBon = bonsKdo.validerBon;
exports.getMailjetStats = bonsKdo.getMailjetStats;
