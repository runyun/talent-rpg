// Service worker: offline cache and quiet updates.
//
// Update behavior (spec section 2):
// - The app always opens from the cached version right away.
// - The browser checks sw.js in the background. A new version installs and downloads all files,
//   then waits. It takes over only when every window of the app is closed, so the new version
//   appears on the next open. No skipWaiting, no clients.claim, no reload, no prompt.
// - Only old caches are deleted on activate. IndexedDB (user data) is never touched here.

const VERSION = '0.2.0';
const CACHE = `talent-rpg-${VERSION}`;

const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/theme.css',
  './src/main.js',
  './src/version.js',
  './src/strings.js',
  './src/text.js',
  './src/config.js',
  './src/db.js',
  './src/dom.js',
  './src/store.js',
  './src/time.js',
  './src/metronome.js',
  './src/data/companions.js',
  './src/model/card.js',
  './src/model/knobs.js',
  './src/model/schedule.js',
  './src/model/session.js',
  './src/model/tasks.js',
  './src/ui/app.js',
  './src/ui/addTalent.js',
  './src/ui/finish.js',
  './src/ui/home.js',
  './src/ui/install.js',
  './src/ui/sheets.js',
  './src/ui/talent.js',
  './src/ui/timer.js',
  './src/ui/welcome.js',
  './src/ui/widgets.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k.startsWith('talent-rpg-') && k !== CACHE).map((k) => caches.delete(k)),
    )),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE)
        .then((cache) => cache.match('./index.html'))
        .then((res) => res || fetch(req)),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE)
      .then((cache) => cache.match(req, { ignoreSearch: true }))
      .then((res) => res || fetch(req)),
  );
});
