// LUMIIA Workspace — Firebase Messaging Service Worker v1.1
// Rôle unique : recevoir les notifications push FCM quand Chrome est fermé ou en arrière-plan

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

// Notifications reçues quand l'app est en arrière-plan ou Chrome fermé
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};

  self.registration.showNotification(title || 'LUMIIA', {
    body: body || '',
    icon: icon || '/lumiia-workspace/icon-192.png',
    badge: '/lumiia-workspace/icon-192.png',
    tag: payload.data?.tag || 'lumiia-notif',
    renotify: true,
    data: payload.data || {}
  });
});

// Clic sur la notification → ouvrir/focus l'app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = 'https://i-immersion.github.io/lumiia-workspace/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes('lumiia-workspace') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
