// World tab (spec 5.4), Me tab (5.5) and Settings (5.10).
// Stage 10A keeps World and Settings close to before with the new copy; Feed | Vault, History,
// Logbooks, Showcase and the validation Check come in stage 10C.

import { el, mount } from '../dom.js';
import { text, raw } from '../text.js';
import { APP_VERSION } from '../version.js';
import { state, saveSettings, addMetric } from '../store.js';
import { levelProgress } from '../model/record.js';
import { renderFeedSection, companionsOn } from './companions.js';
import { renderVaultSection, luckyLabel, luckyNumbersSheet } from './vault.js';
import {
  backButton, group, navRow, infoRow, toggle,
} from './widgets.js';
import { app } from './app.js';

// ---- World ----

export function renderWorld(root) {
  const sections = [renderFeedSection(), renderVaultSection()].filter(Boolean);
  mount(root, el('div', { class: 'tab-page fade-in' },
    el('header', { class: 'page-head-tab' }, el('h1', { class: 'big-title' }, raw('L81')[2])),
    ...sections));
}

// ---- Me ----

export function renderMe(root) {
  const L82 = raw('L82');
  const p = state.player;
  const lv = levelProgress(p.totalExp);
  const fill = el('span', { class: 'bar-fill' });
  fill.style.width = `${Math.round((lv.into / lv.need) * 100)}%`;
  mount(root, el('div', { class: 'tab-page fade-in' },
    el('header', { class: 'page-head-tab' }, el('h1', { class: 'big-title' }, raw('L81')[3])),
    el('section', { class: 'card level-card' },
      el('p', { class: 'level-big num' }, text('S276', { lv: lv.lv })),
      el('span', { class: 'bar' }, fill),
      el('p', { class: 'muted small num' }, text('L92', { x: lv.into, y: lv.need, lv: lv.lv + 1 })),
      el('hr', { class: 'rule' }),
      el('div', { class: 'mana-line' }, el('span', {}, raw('L141')), el('span', { class: 'mana-num num' }, String(p.mana || 0)))),
    group(raw('L142')[2], [
      navRow(L82[2], null, () => app.appearance()),
      navRow(L82[3], null, () => app.guide()),
      navRow(L82[4], null, () => app.settings()),
    ])));
}

// ---- Settings ----

export function renderSettings(root) {
  const items = raw('L69');
  const vaultOn = !(state.settings && state.settings.vaultOn === false);
  // Each switch is recorded for the validation data (spec 10).
  const setting = (label, on, key, what) => el('label', { class: 'row' },
    el('span', { class: 'row-label' }, label),
    toggle(on, async (v) => {
      await saveSettings({ ...state.settings, [key]: v });
      addMetric({
        type: 'toggle', what, on: v, at: Date.now(),
      });
      app.refresh();
    }, label));

  const lockedNote = el('p', { class: 'muted small', hidden: true }, text('S268'));
  const lucky = state.player.vaultUnlocked
    ? navRow(items[2], luckyLabel(), () => luckyNumbersSheet(() => app.refresh()))
    : el('button', { type: 'button', class: 'row row-tap row-off', onclick: () => { lockedNote.hidden = false; } },
      el('span', { class: 'row-label muted' }, items[2]),
      el('span', { class: 'row-value muted' }, raw('L83')[1]));

  mount(root, el('section', { class: 'page fade-in' },
    el('div', { class: 'page-top' }, backButton(() => app.back())),
    el('h1', { class: 'page-title' }, raw('L82')[4]),
    group(raw('L93')[3], [
      setting(items[0], companionsOn(), 'companionsOn', 'companions'),
      setting(items[1], vaultOn, 'vaultOn', 'vault'),
      lucky,
    ], { note: null }),
    lockedNote,
    group(null, [infoRow(items[4])], { note: text('S54') }),
    el('p', { class: 'muted small num page-end' }, text('S64', { version: APP_VERSION }))));
}
