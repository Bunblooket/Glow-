const CACHE = 'theplan-v1';
const FILES = ['./', './index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  return self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

let schedule = [];

self.addEventListener('message', e => {
  if (e.data?.type === 'SCHEDULE') {
    schedule = e.data.schedule || [];
  }
});

// Check every minute and fire matching notifications
setInterval(async () => {
  if (!schedule.length) return;
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit',
    hour12: false, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const p = {};
  parts.forEach(x => p[x.type] = x.value);
  const timeStr = `${p.hour}:${p.minute}`;
  const dateStr = `${p.year}-${p.month}-${p.day}`;
  const dowMap = {Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:0};
  const dow = dowMap[p.weekday] ?? -1;

  for (const n of schedule) {
    if (n.time !== timeStr) continue;
    if (n.days && !n.days.includes(dow)) continue;
    if (n.from && dateStr < n.from) continue;
    if (n.until && dateStr > n.until) continue;
    await self.registration.showNotification(n.title, {
      body: n.body || '',
      icon: './icon.png',
      badge: './icon.png',
      vibrate: [200, 100, 200],
      tag: n.tag || n.time,
      renotify: true
    });
  }
}, 60000);

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('./'));
});
