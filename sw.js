const CACHE = 'theplan-v4';
const BASE = '/glowup/';
const FILES = [
  '/glowup/index.html',
  '/glowup/manifest.json',
  '/glowup/icon.png',
  '/glowup/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (!url.pathname.startsWith(BASE)) return;

  e.respondWith(
    caches.match('/glowup/index.html').then(cached => {
      // Always serve index.html for any /glowup/ navigation
      if (e.request.mode === 'navigate') {
        return cached || fetch('/glowup/index.html');
      }
      // For other assets try cache first, then network
      return caches.match(e.request).then(r => {
        return r || fetch(e.request).then(response => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return response;
        });
      });
    })
  );
});

let schedule = [];

self.addEventListener('message', e => {
  if (e.data?.type === 'SCHEDULE') schedule = e.data.schedule || [];
});

setInterval(async () => {
  if (!schedule.length) return;
  const now = new Date();
  const parts = {};
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit', minute: '2-digit', hour12: false,
    weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now).forEach(x => parts[x.type] = x.value);
  const timeStr = `${parts.hour}:${parts.minute}`;
  const dateStr = `${parts.year}-${parts.month}-${parts.day}`;
  const dowMap = {Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:0};
  const dow = dowMap[parts.weekday] ?? -1;
  for (const n of schedule) {
    if (n.time !== timeStr) continue;
    if (n.days && !n.days.includes(dow)) continue;
    if (n.from && dateStr < n.from) continue;
    if (n.until && dateStr > n.until) continue;
    try {
      await self.registration.showNotification(n.title, {
        body: n.body || '',
        icon: '/glowup/icon.png',
        badge: '/glowup/icon.png',
        vibrate: [200, 100, 200],
        tag: n.tag || n.time,
        renotify: true
      });
    } catch(err) {}
  }
}, 60000);

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:'window'}).then(list => {
      for (const c of list) {
        if (c.url.includes('/glowup') && 'focus' in c) return c.focus();
      }
      return clients.openWindow('/glowup/index.html');
    })
  );
});
