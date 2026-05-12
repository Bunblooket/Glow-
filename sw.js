const CACHE_NAME = 'glowup-v1';
const urlsToCache = ['./', './index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(urlsToCache)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || 'Glow Up';
  const options = {
    body: data.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'glowup',
    renotify: true,
    data: { url: data.url || './' }
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data.url || './'));
});

// Local notification scheduling via message passing
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_NOTIFICATIONS') {
    // Store notification schedule
    self.notificationSchedule = e.data.schedule;
  }
});

// Check and fire local notifications every minute
setInterval(async () => {
  if (!self.notificationSchedule) return;
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
  const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  for (const notif of self.notificationSchedule) {
    if (notif.time !== timeStr) continue;
    if (notif.days && !notif.days.includes(dayOfWeek)) continue;
    if (notif.from && dateStr < notif.from) continue;
    if (notif.until && dateStr > notif.until) continue;

    await self.registration.showNotification(notif.title, {
      body: notif.body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [200, 100, 200],
      tag: notif.tag || notif.time,
      renotify: true
    });
  }
}, 60000);
