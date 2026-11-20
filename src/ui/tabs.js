// World tab (spec 5.2.1), Me tab (5.2.2) and Settings (5.10).

import { el, mount } from '../dom.js';
import { text, raw } from '../text.js';
import { APP_VERSION } from '../version.js';
import { state, saveSettings, addMetric } from '../store.js';
import { renderFeedSection, companionsOn } from './companions.js';
import { renderVaultSection, luckyLabel, luckyNumbersSheet } from './vault.js';
import { backButton } from './widgets.js';
import { app } from './app.js';

// ---- World: Feed and System Vault ----

export function renderWorld(root) {
  const sections = [renderFeedSection(), renderVaultSection()].filter(Boolean);
  if (sections.length) sections[0].classList.add('section-first');
  mount(root, el('div', { class: 'tab-page fade-in' }, ...sections));
}

// ---- Me: Mana Stones, then Appearance, Guide, Settings ----

export function renderMe(root) {
  const L82 = raw('L82');
  const open = [() => app.appearance(), () => app.guide(), () => app.settings()];
  mount(root, el('div', { class: 'tab-page fade-in' },
    el('section', { class: 'section section-first' },
      el('div', { class: 'item-row' },
        el('span', {}, raw('L68')[0]),
        el('span', { class: 'num' }, String(state.player.magicStones || 0))),
      ...L82.map((label, i) => el('button', { type: 'button', class: 'nav-row', onclick: open[i] },
        el('span', {}, label),
        el('span', { class: 'muted', 'aria-hidden': 'true' }, '›'))))));
}

// ---- Settings (4 items, names in L69) ----

function onOffRow(label, on, onChange) {
  const onOff = raw('L39');
  return el('div', { class: 'row setting-row' },
    el('h3', {}, label),
    el('div', { class: 'seg' }, [true, false].map((v, i) => el('button', {
      type: 'button',
      class: `seg-btn${on === v ? ' on' : ''}`,
      'aria-pressed': on === v ? 'true' : 'false',
      onclick: async () => {
        if (on !== v) await onChange(v);
      },
    }, onOff[i]))));
}

export function renderSettings(root) {
  const items = raw('L69');
  const vaultOn = !(state.settings && state.settings.vaultOn === false);
  // Each switch is recorded for the validation data (spec 10).
  const companions = onOffRow(items[0], companionsOn(), async (v) => {
    await saveSettings({ ...state.settings, companionsOn: v });
    addMetric({
      type: 'toggle', what: 'companions', on: v, at: Date.now(),
    });
    app.refresh();
  });
  const vault = onOffRow(items[1], vaultOn, async (v) => {
    await saveSettings({ ...state.settings, vaultOn: v });
    addMetric({
      type: 'toggle', what: 'vault', on: v, at: Date.now(),
    });
    app.refresh();
  });
  const lucky = el('div', { class: 'row setting-row' },
    el('h3', {}, items[2]),
    el('button', { type: 'button', class: 'btn num', onclick: () => luckyNumbersSheet(() => app.refresh()) }, luckyLabel()));

  mount(root, el('section', { class: 'page fade-in' },
    el('div', { class: 'page-top' }, backButton(() => app.back())),
    el('h1', { class: 'page-title' }, raw('L60')[6]),
    companions,
    vault,
    lucky,
    // About your data: S54, the Validation data page, and the version.
    el('div', { class: 'row' },
      el('h3', {}, items[4]),
      el('p', {}, text('S54')),
      el('button', { type: 'button', class: 'btn', onclick: () => app.validation() }, items[5]),
      el('p', { class: 'muted small num' }, text('S64', { version: APP_VERSION })))));
}
