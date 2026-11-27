// Guide (spec 5.12): How it works (9 steps) and one row per feature with its status (L83).
// Explains only: no "unlock now" buttons, progress hints or countdowns.

import { el, mount } from '../dom.js';
import {
  raw, text, guide, how, GUIDE_KEYS, HOW_KEYS,
} from '../text.js';
import { state } from '../store.js';
import { companionsOn } from './companions.js';
import { backButton, group, navRow } from './widgets.js';
import { app } from './app.js';

// Groups in L93 order (index 1-4); the group of each feature is in the copy (G series).
const GROUPS = ['Practice', 'Growth', 'World', 'Rewards'];

/** Has the feature been met yet? Features without an Unlock line are open from the start. */
const UNLOCKED = {
  G18: () => state.talents.some((t) => t.challenge && t.challenge.openRank),
  G19: () => state.talents.some((t) => t.plateau && (t.plateau.active || t.plateau.since)),
  G21: () => (state.player.gate || []).length > 0 || [...state.weeks.values()].some((w) => w.nextWeekConfirmed),
  G08: () => state.sessions.some((s) => s.crit),
  G09: () => state.sessions.some((s) => s.crit && s.crit.type !== 'ticket') || (state.player.mana || 0) > 0,
  G22: () => state.talents.some((t) => t.rank && t.rank !== 'E'),
  G12: () => Boolean(state.player.vaultUnlocked),
};

/** Settings that switch a feature off (G11 Companions, G12 System Vault). */
const OFF = {
  G11: () => !companionsOn(),
  G12: () => Boolean(state.settings && state.settings.vaultOn === false),
};

/** 'open' | 'locked' | 'off' */
export function guideStatus(key) {
  if (OFF[key] && OFF[key]()) return 'off';
  if (!guide(key).unlock) return 'open';
  return UNLOCKED[key] && UNLOCKED[key]() ? 'open' : 'locked';
}

export function renderGuide(root) {
  const L83 = raw('L83');
  const L93 = raw('L93');
  const tags = { open: 'tag tag-solid small', locked: 'tag tag-frame small', off: 'tag tag-dashed small' };
  const groups = GROUPS.map((name, gi) => group(L93[gi + 1], GUIDE_KEYS.filter((k) => guide(k).group === name).map((key) => {
    const g = guide(key);
    const st = guideStatus(key);
    const details = el('div', { class: 'row-details', hidden: true },
      el('p', { class: 'small' }, g.text),
      st === 'locked' ? el('p', { class: 'muted small' }, g.unlock) : null);
    const row = el('button', {
      type: 'button',
      class: 'row row-tap row-guide',
      'aria-expanded': 'false',
      onclick: () => {
        details.hidden = !details.hidden;
        row.setAttribute('aria-expanded', details.hidden ? 'false' : 'true');
      },
    },
    el('span', { class: 'row-main' }, el('span', { class: 'row-label' }, g.title), details),
    el('span', { class: tags[st] }, { open: L83[0], locked: L83[1], off: L83[2] }[st]));
    return row;
  })));

  mount(root, el('section', { class: 'page fade-in' },
    el('div', { class: 'page-top' }, backButton(() => app.back())),
    el('h1', { class: 'page-title' }, raw('L82')[3]),
    group(null, [navRow(L93[0], text('L156', { n: HOW_KEYS.length }), () => app.howItWorks())]),
    ...groups));
}

export function renderHowItWorks(root) {
  mount(root, el('section', { class: 'page fade-in' },
    el('div', { class: 'page-top' }, backButton(() => app.guide())),
    el('h1', { class: 'page-title' }, raw('L93')[0]),
    el('ol', { class: 'how' }, HOW_KEYS.map((key) => {
      const h = how(key);
      return el('li', { class: 'how-step' },
        el('p', { class: 'row-label' }, h.title),
        el('p', { class: 'small' }, h.text),
        el('p', { class: 'muted small' }, h.example));
    }))));
}
