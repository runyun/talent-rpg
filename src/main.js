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
import {
  renderCompanion, renderGreeting, needsGreeting, companionsOn,
} from './ui/companions.js';
import { initialWorld, catchUp } from './model/companionSim.js';
import { vaultCatchUp } from './model/vault.js';
import { renderVaultRules, vaultVisible } from './ui/vault.js';
import { renderValidation } from './ui/validation.js';
import { applyTheme, renderAppearance } from './ui/appearance.js';
import { dateKey } from './time.js';
import { app } from './ui/app.js';
import { isStandalone, renderInstall } from './ui/install.js';
import { renderWelcome } from './ui/welcome.js';
import { renderToday, renderTalentsTab } from './ui/home.js';
import { renderWorld, renderMe, renderSettings } from './ui/tabs.js';
import { renderGuide } from './ui/guide.js';
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

// ---- Screens and tabs (spec 5.0) ----
// Tab roots: today, talents, world, me. Pages (talent, companion, vault rules, appearance,
// guide, settings, validation) keep the tab bar. Timer, finish, trial, add talent, first use
// and the rank-up screen are full screen without it.

const TABS = ['today', 'talents', 'world', 'me'];
let currentTab = 'today';
let route = null; // { name, arg } of the screen on show, for app.refresh()

const tabBar = el('nav', { class: 'tabbar', hidden: true });
document.body.append(tabBar);

function worldVisible() {
  return companionsOn() || vaultVisible();
}

function paintTabBar(active) {
  const labels = raw('L81');
  tabBar.replaceChildren(...TABS.map((name, i) => {
    if (name === 'world' && !worldVisible()) return null;
    return el('button', {
      type: 'button',
      class: `tab${name === active ? ' on' : ''}`,
      'aria-current': name === active ? 'page' : undefined,
      onclick: () => app.tab(name),
    }, labels[i]);
  }).filter(Boolean));
}

/** Leave the current screen. withTabs: the tab whose bar is shown, or null for full screen. */
function show(name, withTabs = null, arg = null) {
  if (screen === 'timer' && name !== 'timer') stopTimer();
  if (screen === 'trial') leaveTrial();
  stopPlaying();
  closeSheet();
  const same = route && route.name === name && route.arg === arg;
  const y = window.scrollY;
  screen = name;
  route = { name, arg };
  tabBar.hidden = !withTabs;
  document.body.classList.toggle('with-tabs', Boolean(withTabs));
  if (withTabs) paintTabBar(withTabs);
  // Same screen again (a refresh): keep the scroll position after rendering.
  return () => window.scrollTo(0, same ? y : 0);
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

/** A tab root. Today is where the app always opens (spec 5.0). */
app.tab = (name) => {
  if (name === 'world' && !worldVisible()) name = 'today';
  if (name === 'today' && needsGreeting()) {
    // First meeting with 3 companions (spec 5.7 step 4), once.
    show('greeting')();
    renderGreeting(root);
    return;
  }
  currentTab = name;
  const scroll = show(`tab:${name}`, name);
  if (name === 'today') renderToday(root);
  else if (name === 'talents') renderTalentsTab(root);
  else if (name === 'world') renderWorld(root);
  else renderMe(root);
  scroll();
};

app.home = () => app.tab('today');

/** Back arrow of a page: the tab it was opened from. */
app.back = () => app.tab(currentTab);

/** Draw the current screen again with fresh data (after a change made on it). */
app.refresh = () => {
  if (!route) return;
  const { name, arg } = route;
  if (name.startsWith('tab:')) app.tab(name.slice(4));
  else if (name === 'talent') app.talent(arg);
  else if (name === 'companion') app.companion(arg);
  else if (name === 'vaultRules') app.vaultRules(arg);
  else if (name === 'appearance') app.appearance();
  else if (name === 'guide') app.guide();
  else if (name === 'settings') app.settings();
  else if (name === 'validation') app.validation();
  else app.home();
};

/** A page with the tab bar. tab: the tab that stays selected. */
function page(name, tab, arg, render) {
  currentTab = tab;
  const scroll = show(name, tab, arg);
  const done = render();
  if (done && done.then) done.then(scroll);
  else scroll();
}

app.talent = (talentId) => page('talent', currentTab, talentId, () => renderTalent(root, talentId));
app.companion = (id) => page('companion', 'world', id, () => renderCompanion(root, id));
app.vaultRules = (draw = null) => page('vaultRules', 'world', draw, () => renderVaultRules(root, draw));
app.appearance = () => page('appearance', 'me', null, () => renderAppearance(root));
app.guide = () => page('guide', 'me', null, () => renderGuide(root));
app.settings = () => page('settings', 'me', null, () => renderSettings(root));
app.validation = () => page('validation', 'me', null, () => renderValidation(root));

// ---- Full-screen screens ----

app.welcome = () => {
  show('welcome')();
  mount(root, renderWelcome({ onContinue: () => app.addTalent({ onboarding: true }) }));
};

app.addTalent = ({ onboarding = false } = {}) => {
  const from = currentTab;
  show('addTalent')();
  mount(root, renderAddTalent({
    onboarding,
    onCancel: () => app.tab(from),
    onDone: async (talent) => {
      if (onboarding) await savePlayer({ ...state.player, onboardingDone: true });
      // Baseline now or later (spec 5.6 step 5).
      show('baselinePrompt')();
      mount(root, el('section', { class: 'finish fade-in' },
        el('div', { class: 'card frame card-auto' }, el('p', { class: 'task' }, text('S08', { talent: talent.name, piece: talent.trialWork }))),
        el('div', { class: 'focus-bottom' },
          el('button', { type: 'button', class: 'btn btn-primary btn-start', onclick: () => app.trial({ talentId: talent.id, kind: 'baseline' }) }, raw('L09')),
          el('button', { type: 'button', class: 'btn', onclick: () => (onboarding ? app.home() : app.tab(from)) }, raw('L11')))));
    },
  }));
};

app.trial = ({ talentId, kind, role }) => {
  show('trial')();
  renderTrial(root, { talentId, kind, role });
};

app.timer = (active) => {
  show('timer')();
  renderTimer(root, active);
};

app.finish = (active) => {
  show('finish')();
  renderFinish(root, active);
};

// Keep Today current (slot windows open and close with the clock).
// Not while a sheet is open, a recording plays, or a text field is being typed in.
const canRefresh = () => screen === 'tab:today'
  && !document.querySelector('.sheet-backdrop')
  && !isPlaying()
  && !(document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName));
setInterval(() => {
  if (canRefresh()) app.refresh();
}, 30 * 1000);
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || !screen || !screen.startsWith('tab:')) return;
  await dailyChecks();
  if (canRefresh()) app.refresh();
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
