// Guide (spec 5.12): one block per feature with its status (L83).
// Explains only: no "unlock now" buttons, progress hints or countdowns.

import { el, mount } from '../dom.js';
import { raw, guide } from '../text.js';
import { state } from '../store.js';
import { CONFIG } from '../config.js';
import { companionsOn } from './companions.js';
import { backButton } from './widgets.js';
import { app } from './app.js';

const KEYS = ['G01', 'G02', 'G03', 'G04', 'G05', 'G06', 'G07', 'G08', 'G09', 'G10', 'G11', 'G12', 'G13'];

const atLeastRank = (talent, rank) => CONFIG.ranks.indexOf(talent.rank) >= CONFIG.ranks.indexOf(rank);
const allAttrs = () => [...state.attrs.values()].flat().filter(Boolean);

/** Has the feature been met yet? Features without an Unlock line are open from the start. */
const UNLOCKED = {
  // A trial was taken (not only the baseline).
  G07: () => state.trials.some((t) => t.kind === 'trial' || t.kind === 'retry'),
  G08: () => state.sessions.some((s) => s.crit),
  G09: () => state.sessions.some((s) => s.crit && s.crit.type === 'stones')
    || (state.player.magicStones || 0) > 0,
  G10: () => allAttrs().some((a) => a.plateau || a.plateauCount),
  G12: () => Boolean(state.player.vaultUnlocked),
  G13: () => state.talents.some((t) => t.reachedCAt || atLeastRank(t, 'C')),
};

/** Settings that can switch a feature off (G11 Companions, G12 System Vault). */
const OFF = {
  G11: () => !companionsOn(),
  G12: () => Boolean(state.settings && state.settings.vaultOn === false),
};

/** 'open' | 'locked' | 'off' */
export function guideStatus(key) {
  if (OFF[key] && OFF[key]()) return 'off';
  const entry = guide(key);
  if (!entry.unlock) return 'open';
  return UNLOCKED[key] && UNLOCKED[key]() ? 'open' : 'locked';
}

export function renderGuide(root) {
  const L83 = raw('L83');
  const blocks = KEYS.map((key) => {
    const g = guide(key);
    const st = guideStatus(key);
    const label = { open: L83[0], locked: L83[1], off: L83[2] }[st];
    return el('div', { class: 'guide-block' },
      el('div', { class: 'talent-head' },
        el('h3', {}, g.title),
        el('span', { class: `small${st === 'open' ? '' : ' muted'}` }, label)),
      el('p', {}, g.text),
      st === 'locked' ? el('p', { class: 'muted small' }, g.unlock) : null);
  });
  mount(root, el('section', { class: 'page fade-in' },
    el('div', { class: 'page-top' }, backButton(() => app.back())),
    el('h1', { class: 'page-title' }, raw('L60')[5]),
    ...blocks));
}
