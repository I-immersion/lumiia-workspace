// LUMIIA Workspace — Cloud Function notifications FCM v8
const { onValueWritten } = require("firebase-functions/v2/database");
const { initializeApp } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");
const { getDatabase } = require("firebase-admin/database");

const app = initializeApp({
  databaseURL: "https://lumiia-live-default-rtdb.europe-west1.firebasedatabase.app"
});
const DB_URL = "https://lumiia-live-default-rtdb.europe-west1.firebasedatabase.app";
const DB_REGION = "europe-west1";

async function getTokensForUser(userId) {
  const snap = await getDatabase(app, DB_URL).ref("workspace/tokens/" + userId).get();
  if (!snap.exists()) return [];
  return Object.values(snap.val() || {}).filter(d => d && d.token).map(d => d.token);
}

async function sendAndMark(itemId, tokens, title, body) {
  if (tokens.length) {
    try {
      await getMessaging(app).sendEachForMulticast({
        tokens, notification: { title, body }, android: { priority: "high" }
      });
      console.log("[FCM] v8 sent=" + tokens.length + " " + title);
    } catch (err) {
      console.error("[FCM] v8 err=" + err.message);
    }
  }
  // Toujours marquer pour eviter re-execution
  await getDatabase(app, DB_URL).ref("workspace/items/" + itemId + "/fcmNotified").set(true);
}

exports.onXpressCreated = onValueWritten(
  { ref: "/workspace/items/{itemId}", region: DB_REGION },
  async function(event) {
    const after = event.data.after.val();
    // Ignorer suppressions, mauvais type, ou deja notifie
    if (!after || after.type !== "xpress" || after.fcmNotified) return;
    const author = after.owner || after.assignee || "inconnu";
    const body = after.title || after.content || "Nouvelle Xpress";
    console.log("[FCM] v8 onXpress id=" + event.params.itemId + " author=" + author);
    const tokens = await getTokensForUser(author);
    console.log("[FCM] v8 tokens=" + tokens.length + " for=" + author);
    await sendAndMark(event.params.itemId, tokens, "Xpress de " + author, body);
  }
);

exports.onNoteWritten = onValueWritten(
  { ref: "/workspace/items/{itemId}", region: DB_REGION },
  async function(event) {
    const after = event.data.after.val();
    if (!after || after.type !== "note" || after.fcmNotified) return;
    const author = after.owner || after.assignee || "inconnu";
    const tokens = await getTokensForUser(author);
    await sendAndMark(event.params.itemId, tokens, "Note de " + author, after.content || after.title || "Nouvelle note");
  }
);

exports.onTaskCreated = onValueWritten(
  { ref: "/workspace/items/{itemId}", region: DB_REGION },
  async function(event) {
    const after = event.data.after.val();
    if (!after || after.type !== "todo" || !after.dueDate || after.fcmNotified) return;
    const author = after.owner || "inconnu";
    const assignee = after.assignee;
    const body = (after.content || after.title || "Tache") + " deadline: " + after.dueDate;
    const t1 = assignee ? await getTokensForUser(assignee) : [];
    const t2 = await getTokensForUser(author);
    const tokens = [...new Set([...t1, ...t2])];
    await sendAndMark(event.params.itemId, tokens, "Tache assignee", body);
  }
);

exports.checkDeadlines = require("firebase-functions/v2/scheduler").onSchedule(
  { schedule: "every 60 minutes", region: DB_REGION },
  async function() {
    const snap = await getDatabase(app, DB_URL).ref("workspace/items").get();
    if (!snap.exists()) return;
    const now = Date.now();
    const in24h = now + 86400000;
    const in1h = now + 3600000;
    let count = 0;
    snap.forEach(child => {
      const item = child.val();
      if (item.type !== "todo" || item.done || !item.dueDate) return;
      const dueTs = item.dueTime
        ? new Date(item.dueDate + "T" + item.dueTime).getTime()
        : new Date(item.dueDate + "T23:59:00").getTime();
      if (dueTs > now && dueTs <= in24h) {
        const assignee = item.assignee || item.owner;
        if (assignee) getTokensForUser(assignee).then(tokens => {
          if (tokens.length) getMessaging(app).sendEachForMulticast({
            tokens,
            notification: {
              title: dueTs <= in1h ? "Deadline imminente" : "Deadline demain",
              body: (item.content || item.title || "Tache") + (dueTs <= in1h ? " < 1h" : " < 24h")
            },
            android: { priority: "high" }
          });
        });
        count++;
      }
    });
    console.log("[FCM] v8 deadlines=" + count);
  }
);
