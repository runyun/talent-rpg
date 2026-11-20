// App entry: register the offline worker, open storage, route between screens.

import { openDb, requestPersistence, touchOpen, put } from './db.js';
import { mount } from './dom.js';
import {
  state, loadState, loadActive, savePlayer,
} from './store.js';
import { app } from './ui/app.js';
import { isStandalone, renderInstall } from './ui/install.js';
import { renderWelcome } from './ui/welcome.js';
import { renderHome } from './ui/home.js';
import { renderAddTalent } from './ui/addTalent.js';
import { renderTalent } from './ui/talent.js';
import { renderTimer, stopTimer } from './ui/timer.js';
import { renderFinish } from './ui/finish.js';
import { closeSheet } from './ui/widgets.js';

const root = document.getElementById('app');
let screen = null;

function registerWorker() {
  if (!('serviceWorker' in navigator)) return;
  // updateViaCache: 'none' makes the browser always fetch the latest sw.js to check for a new version.
  // The new version downloads in the background and waits for the next open (see sw.js).
  navigator.serviceWorker.register('sw.js', { scope: './', updateViaCache: 'none' }).catch((err) => {
    console.warn('Service worker registration failed', err);
  });
}

/**
 * Called once at startup, before anything is shown. If a new version finished downloading
 * during an earlier open, switch to it now and reload once. Returns true when reloading.
 * Never called later, so the app is not reloaded while in use or when it returns from the background.
 */
async function applyWaitingUpdate() {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg || !reg.waiting) return false;
    const switched = new Promise((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
      setTimeout(resolve, 3000);
    });
    reg.waiting.postMessage('skipWaiting');
    await switched;
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

function show(name) {
  if (screen === 'timer' && name !== 'timer') stopTimer();
  closeSheet();
  screen = name;
}

app.home = () => {
  const keepScroll = screen === 'home';
  show('home');
  const y = window.scrollY;
  renderHome(root);
  window.scrollTo(0, keepScroll ? y : 0);
};

app.welcome = () => {
  show('welcome');
  mount(root, renderWelcome({ onContinue: () => app.addTalent({ onboarding: true }) }));
};

app.addTalent = ({ onboarding = false } = {}) => {
  show('addTalent');
  window.scrollTo(0, 0);
  mount(root, renderAddTalent({
    onboarding,
    onCancel: () => app.home(),
    onDone: async () => {
      if (onboarding) await savePlayer({ ...state.player, onboardingDone: true });
      app.home();
    },
  }));
};

app.talent = (talentId) => {
  show('talent');
  window.scrollTo(0, 0);
  renderTalent(root, talentId);
};

app.timer = (active) => {
  show('timer');
  window.scrollTo(0, 0);
  renderTimer(root, active);
};

app.finish = (active) => {
  show('finish');
  window.scrollTo(0, 0);
  renderFinish(root, active);
};

// Keep the home card current (slot windows open and close with the clock).
setInterval(() => {
  if (screen === 'home' && !document.querySelector('.sheet-backdrop')) app.home();
}, 30 * 1000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && screen === 'home' && !document.querySelector('.sheet-backdrop')) app.home();
});

async function boot() {
  if (await applyWaitingUpdate()) return;
  registerWorker();

  const db = await openDb();
  requestPersistence();
  await touchOpen(db);
  await loadState(db);

  // Validation metric (spec 4.12): one record per open.
  state.openedAt = Date.now();
  state.openMetricId = await put(db, 'metrics', {
    type: 'open', openedAt: state.openedAt, secondsToStart: null, practiced: false,
  }).catch(() => null);

  // A session that was running when the app was closed.
  const active = await loadActive();
  if (active && active.status === 'running') {
    app.timer(active);
    return;
  }
  if (active && active.status === 'finished') {
    app.finish(active);
    return;
  }

  if (!state.player.onboardingDone) {
    if (!isStandalone()) {
      screen = 'install';
      mount(root, renderInstall({ onContinue: () => app.welcome() }));
    } else {
      app.welcome();
    }
    return;
  }
  app.home();
}

boot().catch((err) => {
  console.error(err);
});
