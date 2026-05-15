const CACHE = 'theplan-v3';
const BASE = '/glowup/';
const FILES = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icon.png',
  BASE + 'icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Only handle requests within our scope
  if (!url.pathname.startsWith(BASE)) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        // Cache successful GET responses
        if (e.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      }).catch(() => caches.match(BASE + 'index.html'));
    })
  );
});

// Notification schedule storage
let schedule = [];

self.addEventListener('message', e => {
  if (e.data?.type === 'SCHEDULE') {
    schedule = e.data.schedule || [];
  }
});

// Notification checker — runs every minute
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
        icon: BASE + 'icon.png',
        badge: BASE + 'icon.png',
        vibrate: [200, 100, 200],
        tag: n.tag || n.time,
        renotify: true,
        silent: false
      });
    } catch(err) { console.log('notif error:', err); }
  }
}, 60000);

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:'window'}).then(list => {
      for (const c of list) {
        if (c.url.includes('/glowup') && 'focus' in c) return c.focus();
      }
      return clients.openWindow(BASE);
    })
  );
});
