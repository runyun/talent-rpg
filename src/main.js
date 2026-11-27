// App entry: register the offline worker, open storage, route between screens.

import { openDb, requestPersistence, touchOpen, put } from './db.js';
import { mount } from './dom.js';
import { raw } from './text.js';
import {
  state, loadState, savePlayer, saveWorld, practicesSince, saveVaultCatchUp, applyUpdates,
} from './store.js';
import {
  renderCompanion, renderGreeting, needsGreeting, companionsOn,
} from './ui/companions.js';
import { initialWorld, catchUp, ensureJoined } from './model/companionSim.js';
import { vaultCatchUp } from './model/vault.js';
import { renderVaultRules, vaultVisible } from './ui/vault.js';
import { applyTheme, renderAppearance } from './ui/appearance.js';
import { dateKey } from './time.js';
import { el } from './dom.js';
import { app } from './ui/app.js';
import { isStandalone, renderInstall } from './ui/install.js';
import { renderWelcome } from './ui/welcome.js';
import { renderToday } from './ui/today.js';
import { renderTalentsTab } from './ui/talents.js';
import {
  renderTalent, renderNeedsWork, renderTalentPage, renderTargetStep,
} from './ui/talent.js';
import { renderChallengeIntro, renderChallengeRun, renderChallengeResult } from './ui/challenge.js';
import { returnUpdates } from './model/challenge.js';
import { renderWorld, renderMe, renderSettings } from './ui/tabs.js';
import { renderGuide, renderHowItWorks } from './ui/guide.js';
import { renderValidation } from './ui/validation.js';
import { renderHistory, renderLogbooks, renderLogbook } from './ui/records.js';
import { renderRoom, renderKeepsakes } from './ui/room.js';
import { renderAddTalent } from './ui/addTalent.js';
import { renderFinish, stopFinish } from './ui/finish.js';
import { closeSheet, sheetIsOpen, hideNote } from './ui/widgets.js';

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
// Tab roots: today, talents, world, me. Pages keep the tab bar and go back to where they were
// opened from. Finish, Add talent, Set up, Ask AI and first use are full screen without it.

const TABS = ['today', 'talents', 'world', 'me'];
let currentTab = 'today';
let route = null; // { name, arg, arg2 } of the screen on show
let history = []; // pages opened on top of the current tab root
let cleanupFlow = null;

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
function show(next, withTabs = null) {
  if (cleanupFlow) {
    cleanupFlow();
    cleanupFlow = null;
  }
  if (screen === 'finish' && next.name !== 'finish') stopFinish();
  closeSheet({ instant: true });
  if (next.name !== 'tab:today') hideNote();
  const same = route && route.name === next.name && route.arg === next.arg && route.arg2 === next.arg2;
  const y = window.scrollY;
  screen = next.name;
  route = next;
  tabBar.hidden = !withTabs;
  document.body.classList.toggle('with-tabs', Boolean(withTabs));
  document.body.classList.toggle('on-today', next.name === 'tab:today');
  if (withTabs) paintTabBar(withTabs);
  // Same screen again (a refresh): keep the scroll position.
  return () => window.scrollTo(0, same ? y : 0);
}

/** Daily catch-up at every open: companion days and vault draws (spec 7.8, 7.9). */
async function dailyChecks() {
  const now = new Date();
  // Back after 7 days or more: every target one step easier, once (spec 6.16).
  const back = returnUpdates(state, now);
  if (back) await applyUpdates(back);
  await companionCatchUp(now);
  await vaultCatchUpNow(now);
}

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

async function companionCatchUp(now) {
  const today = dateKey(now);
  const startDay = dateKey(new Date(state.player.firstOpenedAt));
  const world = state.world ? structuredClone(state.world) : initialWorld(startDay);
  const joinedNow = ensureJoined(world, startDay, state.player.weeklyWins);
  if (world.global.simulatedThrough >= today && !joinedNow) return;
  const items = catchUp(world, today);
  await saveWorld(world, items);
}

/** A tab root. Today is where the app always opens (spec 5.0). */
app.tab = (name, { refresh = false } = {}) => {
  if (name === 'world' && !worldVisible()) name = 'today';
  if (name === 'today' && needsGreeting()) {
    // First meeting with 3 companions (spec 5.17 step 4), once.
    show({ name: 'greeting' })();
    renderGreeting(root);
    return;
  }
  currentTab = name;
  history = [];
  const scroll = show({ name: `tab:${name}` }, name);
  if (name === 'today') renderToday(root, { refresh });
  else if (name === 'talents') renderTalentsTab(root);
  else if (name === 'world') renderWorld(root);
  else renderMe(root);
  if (!refresh) scroll();
};

app.home = () => app.tab('today');

/** Draw the current screen again with fresh data. force: Today redraws even when nothing changed. */
app.refresh = ({ force = false } = {}) => {
  if (!route) return;
  const { name } = route;
  if (name.startsWith('tab:')) app.tab(name.slice(4), { refresh: !force });
  else if (PAGES[name]) openPage(route, { push: false });
  else app.home();
};

// Pages with the tab bar.
const PAGES = {
  talent: (r) => {
    renderTalent(root, r.arg, r.opts || {});
    r.opts = null; // open the checks sheet only once
  },
  targetStep: (r) => renderTargetStep(root, r.arg),
  needsWork: (r) => renderNeedsWork(root, r.arg),
  talentPage: (r) => renderTalentPage(root, r.arg, r.arg2),
  companion: (r) => renderCompanion(root, r.arg),
  vaultRules: (r) => renderVaultRules(root, r.arg),
  appearance: () => renderAppearance(root),
  guide: () => renderGuide(root),
  howItWorks: () => renderHowItWorks(root),
  settings: () => renderSettings(root),
  validation: () => renderValidation(root),
  history: () => renderHistory(root),
  logbooks: () => renderLogbooks(root),
  logbook: (r) => renderLogbook(root, r.arg),
  room: () => renderRoom(root),
  keepsakes: () => renderKeepsakes(root),
};

function openPage(r, { push = true } = {}) {
  if (push && route && route.name !== r.name && (PAGES[route.name] || route.name.startsWith('tab:'))) {
    if (PAGES[route.name]) history.push(route);
  }
  const scroll = show(r, currentTab);
  PAGES[r.name](r);
  scroll();
}

/** Back arrow of a page: the page or tab it was opened from. */
app.back = () => {
  const prev = history.pop();
  if (prev) openPage(prev, { push: false });
  else app.tab(currentTab);
};

app.talent = (id, opts) => openPage({ name: 'talent', arg: id, opts });
app.targetStep = (id) => openPage({ name: 'targetStep', arg: id });
app.needsWork = (id) => openPage({ name: 'needsWork', arg: id });
app.talentPage = (id, which) => openPage({ name: 'talentPage', arg: id, arg2: which });
app.companion = (id) => openPage({ name: 'companion', arg: id });
app.vaultRules = (draw = null) => openPage({ name: 'vaultRules', arg: draw });
app.appearance = () => openPage({ name: 'appearance' });
app.guide = () => openPage({ name: 'guide' });
app.howItWorks = () => openPage({ name: 'howItWorks' });
app.settings = () => openPage({ name: 'settings' });
app.validation = () => openPage({ name: 'validation' });
app.history = () => openPage({ name: 'history' });
app.logbooks = () => openPage({ name: 'logbooks' });
app.logbook = (id) => openPage({ name: 'logbook', arg: id });
app.room = () => openPage({ name: 'room' });
app.keepsakes = () => openPage({ name: 'keepsakes' });

// ---- Full-screen screens ----

app.welcome = () => {
  show({ name: 'welcome' })();
  mount(root, renderWelcome({ onContinue: () => app.addTalent({ onboarding: true }) }));
};

app.addTalent = ({ onboarding = false } = {}) => {
  const from = currentTab;
  show({ name: 'addTalent' })();
  cleanupFlow = renderAddTalent(root, {
    onboarding,
    onCancel: () => app.tab(from),
    onDone: async () => {
      if (onboarding) {
        await savePlayer({ ...state.player, onboardingDone: true });
        app.home();
        return;
      }
      app.tab(from === 'today' ? 'today' : 'talents');
    },
  });
};

app.setup = (talentId) => {
  const from = currentTab;
  show({ name: 'setup', arg: talentId })();
  cleanupFlow = renderAddTalent(root, {
    setupId: talentId,
    onCancel: () => app.tab(from),
    onDone: () => app.home(),
  });
};

// Challenge and Checkpoint (spec 5.7): full screen.
let challengeFrom = null;
/** Back from a challenge intro: the page or tab it was opened from. */
app.challengeBack = () => {
  if (challengeFrom && PAGES[challengeFrom.name]) openPage(challengeFrom, { push: false });
  else app.tab(currentTab);
};
app.challenge = (talentId) => {
  if (route && route.name !== 'challengeRun') challengeFrom = route;
  show({ name: 'challenge', arg: talentId })();
  renderChallengeIntro(root, talentId, 'challenge');
};
app.checkpoint = (talentId) => {
  show({ name: 'checkpoint', arg: talentId })();
  renderChallengeIntro(root, talentId, 'checkpoint');
};
app.challengeRun = (talentId) => {
  show({ name: 'challengeRun', arg: talentId })();
  renderChallengeRun(root, talentId);
};
app.challengeResult = (data) => {
  show({ name: 'challengeResult' })();
  renderChallengeResult(root, data);
};

app.finish = (data) => {
  hideNote();
  show({ name: 'finish' })();
  renderFinish(root, data);
};

// Keep Today current (slot windows open and close with the clock). Only what changed is
// redrawn (renderToday compares). Not while a sheet is open or a text field is in use.
const canRefresh = () => screen === 'tab:today'
  && !sheetIsOpen()
  && !(document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName));
setInterval(() => {
  if (canRefresh()) app.refresh();
}, 30 * 1000);
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || !screen || !screen.startsWith('tab:') || !state.player) return;
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
  applyTheme();

  // Validation metric (spec 4.12): one record per open.
  state.openedAt = Date.now();
  state.openMetricId = await put(db, 'metrics', { type: 'open', openedAt: state.openedAt, practiced: false }).catch(() => null);

  await dailyChecks();

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
