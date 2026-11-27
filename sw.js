// Service worker: offline cache and quiet updates.
//
// Update behavior (spec section 2):
// - The app always opens from the cached version right away.
// - The browser checks sw.js in the background. A new version installs and downloads all files,
//   then waits. No prompt, and never a reload while the app is in use.
// - On the next open, the page sees the waiting version before showing anything and sends
//   'skipWaiting' (see main.js). iOS often keeps a swiped-away Home Screen app alive, so waiting
//   for "all windows closed" alone is not reliable there.
// - Only old caches are deleted on activate. IndexedDB (user data) is never touched here.

const VERSION = '0.8.0-d';
const CACHE = `talent-rpg-${VERSION}`;

const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/config.js',
  './src/db.js',
  './src/dom.js',
  './src/format.js',
  './src/main.js',
  './src/migrateV5.js',
  './src/migrateV6.js',
  './src/rng.js',
  './src/store.js',
  './src/strings.js',
  './src/text.js',
  './src/theme.css',
  './src/themes.js',
  './src/time.js',
  './src/version.js',
  './src/data/companions.js',
  './src/data/room.js',
  './src/data/stories.js',
  './src/model/challenge.js',
  './src/model/companionSim.js',
  './src/model/practice.js',
  './src/model/record.js',
  './src/model/roles.js',
  './src/model/schedule.js',
  './src/model/today.js',
  './src/model/validation.js',
  './src/model/vault.js',
  './src/ui/addTalent.js',
  './src/ui/app.js',
  './src/ui/appearance.js',
  './src/ui/challenge.js',
  './src/ui/companions.js',
  './src/ui/finish.js',
  './src/ui/guide.js',
  './src/ui/install.js',
  './src/ui/records.js',
  './src/ui/report.js',
  './src/ui/room.js',
  './src/ui/roomArt.js',
  './src/ui/sheets.js',
  './src/ui/sunday.js',
  './src/ui/tabs.js',
  './src/ui/talent.js',
  './src/ui/talents.js',
  './src/ui/today.js',
  './src/ui/validation.js',
  './src/ui/vault.js',
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

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
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
