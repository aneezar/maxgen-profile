// MediCare Pro — Service Worker
const CACHE = 'medicare-pro-v1';
const SHELL = [
  './',
  './index.html',
  './css/app.css',
  './js/config.js',
  './js/db.js',
  './js/sync.js',
  './js/app.js',
  './js/modules/patients.js',
  './js/modules/appointments.js',
  './js/modules/consultations.js',
  './js/modules/pregnancy.js',
  './js/modules/anc.js',
  './js/modules/prescriptions.js',
  './js/modules/billing.js',
  './js/modules/labs.js',
  './js/modules/ultrasound.js',
  './js/modules/reports.js',
  './js/modules/settings.js',
  './js/modules/dashboard.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  // Never cache Supabase API calls
  if (url.includes('supabase.co') || url.includes('supabase.io')) return;
  // Cache-first for app shell
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
