// RSM Messenger service worker.
// Network-first for the app shell so a new deploy is picked up immediately (the old cache-first
// worker kept serving a stale app until the cache was cleared by hand). Cache is only an offline fallback.
const CACHE_NAME = 'rsm-messenger-v3';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never touch API, uploads, sockets or non-GET requests
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/socket.io')) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => cached || (req.mode === 'navigate' ? caches.match('/') : undefined))
      )
  );
});

// Background push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { body: event.data.text() };
  }
  const isCall = data.data && data.data.callId;
  event.waitUntil(
    self.registration.showNotification(data.title || 'RSM Messenger', {
      body: data.body || 'New message received',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: isCall ? 'rsm-call' : data.data && data.data.chatId ? `chat-${data.data.chatId}` : undefined,
      requireInteraction: Boolean(isCall),
      data: data.data || {}
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
