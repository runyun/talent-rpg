// App entry: register the offline worker, open storage, route between screens.

import { openDb, requestPersistence, touchOpen, put } from './db.js';
import { el, mount } from './dom.js';
import { text, raw } from './text.js';
import {
  state, loadState, loadActive, savePlayer, applyUpdates, saveWorld, practicesSince, saveVaultCatchUp,
} from './store.js';
import { plateauUpdates, returnUpdates } from './model/plateau.js';
import { renderTrial, leaveTrial } from './ui/trial.js';
import { stopPlaying, isPlaying } from './ui/media.js';
import { renderCompanion, renderGreeting, needsGreeting } from './ui/companions.js';
import { initialWorld, catchUp } from './model/companionSim.js';
import { vaultCatchUp } from './model/vault.js';
import { renderVaultRules } from './ui/vault.js';
import { renderValidation } from './ui/validation.js';
import { applyTheme } from './ui/appearance.js';
import { dateKey } from './time.js';
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

// Note kept on the phone: "a new version finished downloading during an earlier open".
const UPDATE_READY_KEY = 'talent-rpg-update-ready';

function readUpdateNote() {
  try {
    return localStorage.getItem(UPDATE_READY_KEY) === '1';
  } catch {
    return false;
  }
}

function writeUpdateNote(on) {
  try {
    if (on) localStorage.setItem(UPDATE_READY_KEY, '1');
    else localStorage.removeItem(UPDATE_READY_KEY);
  } catch {
    // storage unavailable: the update then waits until the app is fully closed
  }
}

/** Leave the note as soon as a new version is downloaded and waiting (during this open). */
async function watchForUpdate() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const note = () => { if (reg.waiting) writeUpdateNote(true); };
    note();
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') note(); });
    });
  } catch {
    // ignore
  }
}

/**
 * Called once at startup, before anything is shown. If a new version finished downloading
 * during an EARLIER open (the note), switch to it now and reload once. A version that finished
 * downloading while this open was starting waits for the next open (spec section 2).
 * Returns true when reloading. Never called later, so the app is not reloaded while in use.
 */
async function applyWaitingUpdate() {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg || !reg.waiting) {
      writeUpdateNote(false); // nothing waiting (or it already took over): forget old notes
      return false;
    }
    if (!readUpdateNote()) {
      writeUpdateNote(true); // downloaded just now: use it on the next open
      return false;
    }
    writeUpdateNote(false);
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
  if (screen === 'trial') leaveTrial();
  stopPlaying();
  closeSheet();
  screen = name;
}

/** Daily rule checks: return card (7 days away), Plateau Dungeon start / end, companion days. */
async function dailyChecks() {
  const now = new Date();
  const back = returnUpdates(state, now);
  if (back) await applyUpdates(back);
  const plateau = plateauUpdates(state, now);
  await applyUpdates(plateau);
  await companionCatchUp(now);
  await vaultCatchUpNow(now);
}

/** Companion tickets and every draw that is due (spec 7.8: computed at each open). */
async function vaultCatchUpNow(now) {
  const since = state.vault
    ? state.vault.ticketedThrough
    : dateKey(new Date(state.player.firstOpenedAt - 86400000));
  const practices = await practicesSince(since);
  const out = await vaultCatchUp({
    vault: state.vault,
    world: state.world,
    practices,
    tickets: state.tickets,
    firstOpenedAt: state.player.firstOpenedAt,
    now,
  });
  const changed = !state.vault || out.newTickets.length || out.draws.length
    || JSON.stringify(out.vault) !== JSON.stringify(state.vault);
  if (changed) await saveVaultCatchUp(out);
}

/** Simulate the companions from the last simulated day up to today (spec 7.9). */
async function companionCatchUp(now) {
  const today = dateKey(now);
  const world = state.world
    ? structuredClone(state.world)
    : initialWorld(dateKey(new Date(state.player.firstOpenedAt)));
  if (world.global.simulatedThrough >= today) return;
  const items = catchUp(world, today);
  await saveWorld(world, items);
}

app.home = () => {
  if (needsGreeting()) {
    // First meeting with 3 companions (spec 5.7 step 4), once.
    show('greeting');
    window.scrollTo(0, 0);
    renderGreeting(root);
    return;
  }
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
    onDone: async (talent) => {
      if (onboarding) await savePlayer({ ...state.player, onboardingDone: true });
      // Step 7 (spec 5.6): baseline now or later.
      show('baselinePrompt');
      mount(root, el('section', { class: 'finish fade-in' },
        el('div', { class: 'card frame card-auto' }, el('p', { class: 'task' }, text('S08', { talent: talent.name, piece: talent.trialWork }))),
        el('div', { class: 'focus-bottom' },
          el('button', { type: 'button', class: 'btn btn-primary btn-start', onclick: () => app.trial({ talentId: talent.id, kind: 'baseline' }) }, raw('L09')),
          el('button', { type: 'button', class: 'btn', onclick: () => app.home() }, raw('L11')))));
    },
  }));
};

app.validation = () => {
  show('validation');
  window.scrollTo(0, 0);
  renderValidation(root);
};

app.vaultRules = () => {
  show('vaultRules');
  window.scrollTo(0, 0);
  renderVaultRules(root);
};

app.companion = (id) => {
  show('companion');
  window.scrollTo(0, 0);
  renderCompanion(root, id);
};

app.trial = ({ talentId, kind, role }) => {
  show('trial');
  window.scrollTo(0, 0);
  renderTrial(root, { talentId, kind, role });
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
// Not while a sheet is open, a recording plays, or a text field is being typed in.
const canRefresh = () => screen === 'home'
  && !document.querySelector('.sheet-backdrop')
  && !isPlaying()
  && !(document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName));
setInterval(() => {
  if (canRefresh()) app.home();
}, 30 * 1000);
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || screen !== 'home') return;
  await dailyChecks();
  if (canRefresh()) app.home();
});

async function boot() {
  if (await applyWaitingUpdate()) return;
  registerWorker();
  watchForUpdate();

  const db = await openDb();
  requestPersistence();
  await touchOpen(db);
  await loadState(db);
  applyTheme(state.player.equipped && state.player.equipped.theme);

  // Validation metric (spec 4.12): one record per open.
  state.openedAt = Date.now();
  state.openMetricId = await put(db, 'metrics', {
    type: 'open', openedAt: state.openedAt, secondsToStart: null, practiced: false,
  }).catch(() => null);

  await dailyChecks();

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
