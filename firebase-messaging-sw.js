// LUMIIA Workspace — service worker des notifications — v8.54
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
const ACTION_URL = 'https://europe-west1-lumiia-live.cloudfunctions.net/workspaceNotifAction';
const ICON = '/lumiia-workspace/icon-192.png';

// La nouvelle version prend la main tout de suite
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

// ── Chemin historique (notifications envoyées avant v8.54, sans code) : jeton de session en IndexedDB
async function getAuthToken() {
  return new Promise((resolve) => {
    const req = indexedDB.open('lumiia-auth', 1);
    req.onsuccess = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('tokens')) { resolve(null); return; }
      const get = db.transaction('tokens', 'readonly').objectStore('tokens').get('idToken');
      get.onsuccess = () => resolve(get.result?.value || null);
      get.onerror = () => resolve(null);
    };
    req.onerror = () => resolve(null);
  });
}
async function snoozeItemLegacy(itemId, itemType, delayMs) {
  const token = await getAuthToken();
  if (!token || !itemId) return;
  const newTime = Date.now() + delayMs;
  const path = itemType === 'prospect' ? '/workspace/prospects/' + itemId + '.json' : '/workspace/items/' + itemId + '.json';
  const body = itemType === 'prospect' ? { echeanceAt: newTime, notifRelanceSent: false } : { triggerAt: newTime, notificationSent: false };
  await fetch(DB_URL + path + '?auth=' + token, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

// ── v8.54 : action par code à usage unique (fonctionne même app fermée depuis des jours)
async function doAction(code, action) {
  try {
    const r = await fetch(ACTION_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, action }) });
    return await r.json();
  } catch (e) { return { ok: false }; }
}

function readPayload(payload) {
  const d = payload.data || {};
  const n = payload.notification || {};
  const itemId = d.xpressId || d.itemId || '';
  return {
    title: d.title || n.title || '⚡ LUMIIA Workspace',
    body: d.body || n.body || '',
    itemId,
    itemType: d.itemType || 'xpress',
    view: d.view || '',
    code: d.code || '',
    tag: d.tag || ('lumiia-' + itemId),
  };
}

function actionsFor(p) {
  if (p.itemType === 'digest') return p.code ? [{ action: 'done', title: '✅ Fait' }, { action: 'open', title: '📋 Ma semaine' }] : [];
  if (p.itemType === 'todo' && p.code) return [{ action: 'done', title: '✅ Fait' }, { action: 'snooze1h', title: '🕐 +1 h' }];
  return [{ action: 'snooze5', title: '⏰ +5 min' }, { action: 'snooze1h', title: '🕐 +1 h' }];
}

messaging.onBackgroundMessage(async payload => {
  const p = readPayload(payload);
  const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  const appOpen = clientList.some(c => c.url.startsWith(APP_URL) && c.visibilityState === 'visible');
  if (appOpen) {
    clientList.forEach(c => {
      if (c.url.startsWith(APP_URL)) c.postMessage({ type: 'OPEN_XPRESS', xpressId: p.itemId, itemType: p.itemType, title: p.title, body: p.body, view: p.view });
    });
    return;
  }
  // Un envoi ancien format (bloc « notification ») est déjà affiché par Firebase : ne pas le doubler
  if (payload.notification) return;
  return self.registration.showNotification(p.title, {
    body: p.body,
    icon: ICON,
    badge: ICON,
    tag: p.tag,
    renotify: true,
    data: p,
    actions: actionsFor(p),
  });
});

async function confirmNotif(title, body, tag) {
  await self.registration.showNotification(title, { body: body || '', tag: tag || 'lumiia-ok', icon: ICON, badge: ICON, silent: true, renotify: false });
  await new Promise(r => setTimeout(r, 4000));
  const list = await self.registration.getNotifications({ tag: tag || 'lumiia-ok' });
  list.forEach(x => x.close());
}

async function openApp(p, forceView) {
  const view = forceView || p.view || '';
  const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const c of list) {
    if (c.url.startsWith(APP_URL)) {
      await c.focus();
      c.postMessage(view ? { type: 'OPEN_VIEW', view } : { type: 'OPEN_XPRESS', xpressId: p.itemId, itemType: p.itemType });
      return;
    }
  }
  const q = view ? '?view=' + view : (p.itemId ? '?item=' + p.itemId + '&type=' + (p.itemType || 'xpress') : '');
  return clients.openWindow(APP_URL + q);
}

self.addEventListener('notificationclick', event => {
  const n = event.notification;
  const p = n.data || {};
  const action = event.action;
  n.close();

  if (action === 'done' || action === 'snooze5' || action === 'snooze1h') {
    event.waitUntil((async () => {
      if (p.code) {
        const r = await doAction(p.code, action);
        if (r && r.ok) {
          if (action === 'done') await confirmNotif('✅ Fait', r.title || '', p.tag);
          return;
        }
        // échec (code expiré, réseau...) : on ouvre l'app pour terminer à la main
        return openApp(p, action === 'done' ? 'semaine' : '');
      }
      if (action !== 'done') return snoozeItemLegacy(p.itemId, p.itemType, action === 'snooze5' ? 5 * 60000 : 60 * 60000);
      return openApp(p, 'semaine');
    })());
    return;
  }
  // clic sur la notification ou bouton « Ma semaine »
  event.waitUntil(openApp(p, action === 'open' ? 'semaine' : ''));
});
