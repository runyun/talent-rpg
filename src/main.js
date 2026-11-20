// App entry: register the offline worker, open storage, render.

import { openDb, requestPersistence, touchOpen, put } from './db.js';
import { mount } from './dom.js';
import { isStandalone, renderInstall } from './ui/install.js';
import { renderHome } from './ui/home.js';

const root = document.getElementById('app');

function registerWorker() {
  if (!('serviceWorker' in navigator)) return;
  // updateViaCache: 'none' makes the browser always fetch the latest sw.js to check for a new version.
  // The new version waits and is used on the next open (see sw.js).
  navigator.serviceWorker.register('sw.js', { scope: './', updateViaCache: 'none' }).catch((err) => {
    console.warn('Service worker registration failed', err);
  });
}

async function boot() {
  registerWorker();

  const db = await openDb();
  requestPersistence();
  const { player } = await touchOpen(db);

  // Validation metric (spec 4.12): one record per open.
  put(db, 'metrics', { type: 'open', openedAt: Date.now(), secondsToStart: null, practiced: false }).catch(() => {});

  const showHome = () => mount(root, ...renderHome({ player }));

  if (!isStandalone()) {
    mount(root, renderInstall({ onContinue: showHome }));
  } else {
    showHome();
  }
}

boot().catch((err) => {
  console.error(err);
});
