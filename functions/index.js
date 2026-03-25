const { onValueWritten } = require("firebase-functions/v2/database");
const { initializeApp } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");
const { getDatabase } = require("firebase-admin/database");

initializeApp();

// ─────────────────────────────────────────────
// LUMIIA — Cloud Function notifications FCM
// Déclencheurs : Xpress créée, Tâche créée, Note créée/modifiée
// ─────────────────────────────────────────────

const DB_REGION = "europe-west1";

// Récupère tous les tokens FCM sauf ceux de l'auteur
async function getTokensExcept(excludeUser) {
  const db = getDatabase();
  const snap = await db.ref("workspace/tokens").get();
  if (!snap.exists()) return [];

  const tokens = [];
  snap.forEach((userSnap) => {
    if (userSnap.key === excludeUser) return;
    userSnap.forEach((deviceSnap) => {
      const data = deviceSnap.val();
      if (data && data.token) tokens.push(data.token);
    });
  });
  return tokens;
}

// Récupère tous les tokens de tous les utilisateurs
async function getAllTokens() {
  const db = getDatabase();
  const snap = await db.ref("workspace/tokens").get();
  if (!snap.exists()) return [];

  const tokens = [];
  snap.forEach((userSnap) => {
    userSnap.forEach((deviceSnap) => {
      const data = deviceSnap.val();
      if (data && data.token) tokens.push(data.token);
    });
  });
  return tokens;
}

// Récupère les tokens d'un utilisateur spécifique
async function getTokensForUser(userId) {
  const db = getDatabase();
  const snap = await db.ref(`workspace/tokens/${userId}`).get();
  if (!snap.exists()) return [];

  const tokens = [];
  snap.forEach((deviceSnap) => {
    const data = deviceSnap.val();
    if (data && data.token) tokens.push(data.token);
  });
  return tokens;
}

// Envoie les notifications FCM
async function sendNotifications(tokens, title, body) {
  if (!tokens.length) return;
  const messaging = getMessaging();

  // Envoyer par lots de 500 max (limite FCM)
  const chunks = [];
  for (let i = 0; i < tokens.length; i += 500) {
    chunks.push(tokens.slice(i, i + 500));
  }

  for (const chunk of chunks) {
    try {
      await messaging.sendEachForMulticast({
        tokens: chunk,
        notification: { title, body },
        android: {
          priority: "high",
          notification: { channelId: "lumiia_default" },
        },
        webpush: {
          headers: { Urgency: "high" },
          notification: { icon: "https://i-immersion.github.io/lumiia-workspace/icon-192.png" },
        },
      });
    } catch (err) {
      console.error("[FCM] Erreur envoi:", err);
    }
  }
}

// ── TRIGGER 1 : Xpress créée ──────────────────
exports.onXpressCreated = onValueWritten(
  {
    ref: "/workspace/items/{itemId}",
    region: DB_REGION,
  },
  async (event) => {
    const before = event.data.before.val();
    const after = event.data.after.val();

    // Seulement les créations (pas modifications, pas suppressions)
    if (before !== null || after === null) return;
    if (after.type !== "xpress") return;

    const author = after.owner || after.assignee || "inconnu";
    const content = after.content || "Nouvelle Xpress";
    const title = `⚡ Xpress de ${author}`;
    const body = content.length > 80 ? content.slice(0, 77) + "..." : content;

    const tokens = await getTokensExcept(author);
    await sendNotifications(tokens, title, body);
    console.log(`[FCM] Xpress notifiée à ${tokens.length} appareils`);
  }
);

// ── TRIGGER 2 : Tâche créée avec deadline ─────
exports.onTaskCreated = onValueWritten(
  {
    ref: "/workspace/items/{itemId}",
    region: DB_REGION,
  },
  async (event) => {
    const before = event.data.before.val();
    const after = event.data.after.val();

    // Seulement les créations
    if (before !== null || after === null) return;
    if (after.type !== "todo") return;
    if (!after.dueDate) return; // pas de deadline = pas de notif

    const author = after.owner || "inconnu";
    const assignee = after.assignee;
    const content = after.content || "Nouvelle tâche";
    const title = `✅ Tâche assignée`;
    const body = `${content} — deadline : ${after.dueDate}`;

    // Notifier l'assigné si différent de l'auteur
    let tokens = [];
    if (assignee && assignee !== author) {
      tokens = await getTokensForUser(assignee);
    }
    // + notifier tous sauf l'auteur
    const othersTokens = await getTokensExcept(author);
    const allTokens = [...new Set([...tokens, ...othersTokens])];

    await sendNotifications(allTokens, title, body);
    console.log(`[FCM] Tâche notifiée à ${allTokens.length} appareils`);
  }
);

// ── TRIGGER 3 : Note créée ou modifiée ────────
exports.onNoteWritten = onValueWritten(
  {
    ref: "/workspace/items/{itemId}",
    region: DB_REGION,
  },
  async (event) => {
    const before = event.data.before.val();
    const after = event.data.after.val();

    if (after === null) return; // suppression ignorée
    if (after.type !== "note") return;

    const isNew = before === null;
    const author = after.owner || after.assignee || "inconnu";
    const content = after.content || "Note";
    const title = isNew ? `📝 Note de ${author}` : `📝 Note modifiée par ${author}`;
    const body = content.length > 80 ? content.slice(0, 77) + "..." : content;

    // Ne notifier que si modification substantielle (évite les boucles)
    if (!isNew && before.content === after.content && before.title === after.title) return;

    const tokens = await getTokensExcept(author);
    await sendNotifications(tokens, title, body);
    console.log(`[FCM] Note notifiée à ${tokens.length} appareils`);
  }
);

// ── TRIGGER 4 : Rappel deadline < 24h ─────────
// Tourne toutes les heures, vérifie les tâches dont la deadline approche
exports.checkDeadlines = require("firebase-functions/v2/scheduler").onSchedule(
  {
    schedule: "every 60 minutes",
    region: DB_REGION,
  },
  async () => {
    const db = getDatabase();
    const snap = await db.ref("workspace/items").get();
    if (!snap.exists()) return;

    const now = Date.now();
    const in24h = now + 24 * 60 * 60 * 1000;
    const in1h = now + 60 * 60 * 1000;

    const tasks = [];
    snap.forEach((child) => {
      const item = child.val();
      if (item.type !== "todo" || item.done || !item.dueDate) return;

      // Convertir dueDate en timestamp
      let dueTs = null;
      if (item.dueTime) {
        dueTs = new Date(`${item.dueDate}T${item.dueTime}`).getTime();
      } else {
        dueTs = new Date(`${item.dueDate}T23:59:00`).getTime();
      }
      if (!dueTs || isNaN(dueTs)) return;

      // Fenêtre : entre maintenant et +24h (ou +1h)
      if (dueTs > now && dueTs <= in24h) {
        tasks.push({ ...item, dueTs });
      }
    });

    for (const task of tasks) {
      const isUrgent = task.dueTs <= in1h;
      const label = isUrgent ? "dans moins d'1h" : "dans moins de 24h";
      const title = isUrgent ? `🚨 Deadline imminente` : `⏰ Deadline demain`;
      const body = `${task.content || "Tâche"} — ${label}`;
      const assignee = task.assignee;

      let tokens = assignee ? await getTokensForUser(assignee) : await getAllTokens();
      await sendNotifications(tokens, title, body);
    }

    console.log(`[FCM] ${tasks.length} rappels deadline envoyés`);
  }
);
