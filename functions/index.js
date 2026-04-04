const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { getMessaging } = require('firebase-admin/messaging');

if (!getApps().length) { initializeApp(); }

async function sendToUser(db, userId, title, body, xpressId, itemType) {
  const tokensSnap = await db.ref('workspace/fcm_tokens/' + userId).get();
  const tokensData = tokensSnap.val();
  if (!tokensData) return;
  const tokens = Object.values(tokensData).map(t => t.token).filter(Boolean);
  if (!tokens.length) return;
  await Promise.all(tokens.map(async (token) => {
    try {
      await getMessaging().send({
        token,
        notification: { title, body },
        data: { xpressId: xpressId || '', itemType: itemType || '' },
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });
    } catch(e) {
      if (e.code === 'messaging/registration-token-not-registered') {
        await db.ref('workspace/fcm_tokens/' + userId + '/' + token.slice(-8)).remove();
      }
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
        if (!['xpress', 'note', 'todo'].includes(item.type)) continue;
        if (!item.triggerAt || item.triggerAt > now) continue;
        if (item.notificationSent) continue;
        await db.ref('workspace/items/' + id + '/notificationSent').set(true);
        let title = '\u26a1 ' + (item.title || 'Rappel');
        let body = item.type === 'xpress'
          ? (item.xpressTime ? 'Rappel : ' + item.xpressTime : 'Minuteur Xpress echu')
          : item.type === 'note'
            ? (item.noteTime ? 'Note a ' + item.noteTime : 'Rappel de note')
            : (item.dueTime ? 'Tache a ' + item.dueTime : 'Rappel de tache');
        await sendToUser(db, item.owner, title, body, id, item.type);
      }
    }
    const prospectsSnap = await db.ref('workspace/prospects').get();
    const prospects = prospectsSnap.val();
    if (prospects) {
      for (const [id, p] of Object.entries(prospects)) {
        if (!p.echeanceAt || p.echeanceAt > now) continue;
        if (p.notifRelanceSent) continue;
        if (['archive', 'cloture'].includes(p.statut)) continue;
        await db.ref('workspace/prospects/' + id + '/notifRelanceSent').set(true);
        const title = '\uD83D\uDCCB Relance : ' + (p.prenom || '') + ' ' + (p.nom || '');
        const body = p.sujet || 'Prospect a relancer';
        await sendToUser(db, p.owner, title, body, id, 'prospect');
      }
    }
  }
);
