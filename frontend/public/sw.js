/* Vondic PWA Service Worker — Web Push Notifications & iOS Standalone Support */

const CACHE_NAME = 'vondic-pwa-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/logo.png',
  '/favicon.ico',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS).catch(function () {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('push', function (event) {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Вондик', body: event.data.text() };
  }

  const title = data.title || 'Вондик';
  const isCall = data.data?.type === 'incoming_call' || data.type === 'incoming_call';

  const options = {
    body: data.body || (isCall ? 'Входящий звонок...' : 'Новое сообщение'),
    icon: '/logo.png',
    badge: '/logo.png',
    data: data.data || data,
    tag: isCall ? 'call_notification' : (data.data?.message_id || 'vondic_notification'),
    renotify: true,
    vibrate: isCall ? [500, 250, 500, 250, 500] : [200, 100, 200],
    actions: isCall
      ? [
          { action: 'answer', title: 'Принять' },
          { action: 'decline', title: 'Отклонить' },
        ]
      : [{ action: 'open', title: 'Открыть' }],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/feed';

  if (event.action === 'decline') {
    return;
  }

  if (data.type === 'incoming_call' || data.call_id) {
    url = `/feed/messages?call=${data.call_id || ''}`;
  } else if (data.type === 'friend_request') {
    url = '/feed/friends';
  } else if (data.type === 'support_reply') {
    url = '/feed/support';
  } else if (data.chat_id) {
    url = `/feed/messages?chat=${data.chat_id}`;
  } else if (data.sender_id) {
    url = `/feed/messages?chat=${data.sender_id}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

/* Re-subscribe on pushsubscriptionchange (iOS Safari PWA compatibility) */
self.addEventListener('pushsubscriptionchange', function (event) {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options).then(function (subscription) {
      const sub = subscription.toJSON();
      return fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          user_id: null,
          platform: /iPhone|iPad|iPod/.test(self.navigator.userAgent) ? 'ios_pwa' : 'web',
        }),
      });
    })
  );
});
