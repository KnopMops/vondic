/* Vondic PWA Service Worker — Web Push notifications */

self.addEventListener('push', function (event) {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Вондик', body: event.data.text() };
  }

  const title = data.title || 'Вондик';
  const options = {
    body: data.body || 'Новое сообщение',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: data.data || {},
    actions: [
      { action: 'open', title: 'Открыть' },
    ],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/feed';

  if (data.type === 'incoming_call') {
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
        if (client.url.includes('vondic.ru') && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('notificationclose', function (event) {
  // Optional: track dismissal
});

/* Re-subscribe on pushsubscriptionchange (required for iOS PWA) */
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
