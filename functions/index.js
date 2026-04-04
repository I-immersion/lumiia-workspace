const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { getMessaging } = require('firebase-admin/messaging');

if (!getApps().length) { initializeApp(); }

exports.sendXpressNotifications = onSchedule(
  { schedule: 'every 1 minutes', region: 'europe-west1', timeZone: 'Europe/Paris' },
  async () => {
    const db = getDatabase();
    const now = Date.now();
    const itemsSnap = await db.ref('workspace/items').get();
    const items = itemsSnap.val();
    if (!items) return;
    for (const [id, item] of Object.entries(items)) {
      if (item.type !== 'xpress') continue;
      if (!item.triggerAt || item.triggerAt > now) continue;
      if (item.notificationSent) continue;
      await db.ref('workspace/items/' + id + '/notificationSent').set(true);
      const tokensSnap = await db.ref('workspace/fcm_tokens/' + item.owner).get();
      const tokensData = tokensSnap.val();
      if (!tokensData) continue;
      const tokens = Object.values(tokensData).map(t => t.token).filter(Boolean);
      if (!tokens.length) continue;
      await Promise.all(tokens.map(async (token) => {
        try {
          await getMessaging().send({
            token,
            notification: {
              title: '\u26a1 ' + (item.title || 'Rappel Xpress'),
              body: item.xpressTime ? 'Rappel : ' + item.xpressTime : 'Minuteur Xpress echu',
            },
            android: { priority: 'high' },
          });
        } catch(e) {
          if (e.code === 'messaging/registration-token-not-registered') {
            await db.ref('workspace/fcm_tokens/' + item.owner + '/' + token.slice(-8)).remove();
          }
        }
      }));
    }
  }
);
