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

messaging.onBackgroundMessage(async payload => {
  const title    = payload.notification?.title || '\u26a1 LUMIIA Workspace';
  const body     = payload.notification?.body  || '';
  const itemId   = payload.data?.xpressId || '';
  const itemType = payload.data?.itemType || 'xpress';

  // Vérifier si l'app est déjà ouverte en foreground
  const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  const appOpen = clientList.some(c => c.url.startsWith(APP_URL) && c.visibilityState === 'visible');

  if (appOpen) {
    // App déjà visible → envoyer juste un message pour la bannière in-app
    clientList.forEach(c => {
      if (c.url.startsWith(APP_URL)) {
        c.postMessage({ type: 'OPEN_XPRESS', xpressId: itemId, itemType, title, body });
      }
    });
    return; // Pas de notification système
  }

  // App en arrière-plan → notification système
  self.registration.showNotification(title, {
    body,
    icon: '/lumiia-workspace/icon-192.png',
    badge: '/lumiia-workspace/icon-192.png',
    tag: 'lumiia-' + itemId + '-' + Date.now(),
    renotify: true,
    data: { itemId, itemType },
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const { itemId, itemType } = event.notification.data || {};
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
