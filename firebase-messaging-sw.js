importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBPgjVFKrP80qX_hlfUFqL168XONfNIBA4",
  authDomain: "lumiia-live.firebaseapp.com",
  databaseURL: "https://lumiia-live-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "lumiia-live",
  storageBucket: "lumiia-live.firebasestorage.app",
  messagingSenderId: "823919513931",
  appId: "1:823919513931:web:6f6f3c7c6d1699457b18ce"
});

const messaging = firebase.messaging();
const APP_URL = 'https://i-immersion.github.io/lumiia-workspace/';
const DB_URL = 'https://lumiia-live-default-rtdb.europe-west1.firebasedatabase.app';

// Lire le token Firebase Auth depuis IndexedDB
async function getAuthToken() {
  return new Promise((resolve) => {
    const req = indexedDB.open('lumiia-auth', 1);
    req.onsuccess = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('tokens')) { resolve(null); return; }
      const tx = db.transaction('tokens', 'readonly');
      const store = tx.objectStore('tokens');
      const get = store.get('idToken');
      get.onsuccess = () => resolve(get.result?.value || null);
      get.onerror = () => resolve(null);
    };
    req.onerror = () => resolve(null);
  });
}

// Reporter un item dans Firebase via REST
async function snoozeItem(itemId, itemType, delayMs) {
  const token = await getAuthToken();
  if (!token) return;
  const newTime = Date.now() + delayMs;
  const path = itemType === 'prospect'
    ? '/workspace/prospects/' + itemId + '.json'
    : '/workspace/items/' + itemId + '.json';
  const body = itemType === 'prospect'
    ? { echeanceAt: newTime, notifRelanceSent: false }
    : { triggerAt: newTime, notificationSent: false };
  await fetch(DB_URL + path + '?auth=' + token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

messaging.onBackgroundMessage(async payload => {
  const title    = payload.notification?.title || '\u26a1 LUMIIA Workspace';
  const body     = payload.notification?.body  || '';
  const itemId   = payload.data?.xpressId || '';
  const itemType = payload.data?.itemType || 'xpress';

  const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  const appOpen = clientList.some(c => c.url.startsWith(APP_URL) && c.visibilityState === 'visible');

  if (appOpen) {
    clientList.forEach(c => {
      if (c.url.startsWith(APP_URL)) {
        c.postMessage({ type: 'OPEN_XPRESS', xpressId: itemId, itemType, title, body });
      }
    });
    return;
  }

  self.registration.showNotification(title, {
    body,
    icon: '/lumiia-workspace/icon-192.png',
    badge: '/lumiia-workspace/icon-192.png',
    tag: 'lumiia-' + itemId,
    renotify: true,
    data: { itemId, itemType },
    actions: [
      { action: 'open',     title: '\uD83D\uDCCB Ouvrir' },
      { action: 'snooze5',  title: '\u23F0 +5 min' },
      { action: 'snooze1h', title: '\uD83D\uDD50 +1 h' },
    ],
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const { itemId, itemType } = event.notification.data || {};
  const action = event.action;

  if (action === 'snooze5') {
    event.waitUntil(snoozeItem(itemId, itemType, 5 * 60 * 1000));
    return;
  }
  if (action === 'snooze1h') {
    event.waitUntil(snoozeItem(itemId, itemType, 60 * 60 * 1000));
    return;
  }

  // 'open' ou clic direct sur la notif
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.startsWith(APP_URL)) {
          client.focus();
          if (itemId) client.postMessage({ type: 'OPEN_XPRESS', xpressId: itemId, itemType });
          return;
        }
      }
      const params = itemId ? '?item=' + itemId + '&type=' + (itemType || 'xpress') : '';
      return clients.openWindow(APP_URL + params);
    })
  );
});
