// World tab (spec 5.4), Me tab (5.5) and Settings (5.10).
// Stage 10A keeps World and Settings close to before with the new copy; Feed | Vault, History,
// Logbooks, Showcase and the validation Check come in stage 10C.

import { el, mount } from '../dom.js';
import { text, raw } from '../text.js';
import { APP_VERSION } from '../version.js';
import { ITEMS } from '../strings.js';
import { THEME_IDS, DEFAULT_THEME } from '../themes.js';
import { roomCard } from './room.js';
import { loadMetrics, checkList, copyValidation } from './validation.js';
import {
  state, saveSettings, addMetric, resetAllData,
} from '../store.js';
import { levelProgress } from '../model/record.js';
import { renderFeedSection, companionsOn } from './companions.js';
import {
  renderVaultSection, luckyLabel, luckyNumbersSheet, vaultVisible,
} from './vault.js';
import {
  backButton, group, navRow, infoRow, toggle, openSheet, closeSheet, showNote, segmented,
} from './widgets.js';
import { app } from './app.js';

// ---- World ----

let worldView = 'feed';

/** World (5.4): Feed | Vault when both are on; otherwise only the one that is. */
export function renderWorld(root) {
  const feed = companionsOn();
  const vault = vaultVisible();
  if (!feed) worldView = 'vault';
  if (!vault) worldView = 'feed';
  const L140 = raw('L140');
  const seg = feed && vault
    ? segmented([{ value: 'feed', label: L140[0] }, { value: 'vault', label: L140[1] }], worldView, (v) => { worldView = v; app.refresh(); })
    : null;
  const body = worldView === 'vault' ? renderVaultSection() : renderFeedSection();
  mount(root, el('div', { class: 'tab-page fade-in' },
    el('header', { class: 'page-head-tab' }, el('h1', { class: 'big-title' }, raw('L81')[2])),
    seg ? seg.node : null,
    body));
}

/** Open World on the Vault (S183 on the finish screen). */
export function showVault() {
  worldView = 'vault';
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
    roomCard(),
    group(raw('L142')[1], [
      navRow(L82[0], null, () => app.history()),
      navRow(L82[1], String(state.logbooks.length), () => app.logbooks()),
    ]),
    group(raw('L142')[2], [
      navRow(L82[2], themeName(), () => app.appearance()),
      navRow(L82[3], null, () => app.guide()),
      navRow(L82[4], null, () => app.settings()),
    ])));
}

function themeName() {
  const id = (state.player.equipped && state.player.equipped.theme) || DEFAULT_THEME;
  const i = THEME_IDS.indexOf(id);
  return ITEMS.themes[i === -1 ? 0 : i];
}

// ---- Reset all data (5.10.1): type RESET to confirm; gray only, no red ----

function resetSheet() {
  const input = el('input', {
    type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false',
  });
  const reset = el('button', { type: 'button', class: 'btn btn-primary btn-main', disabled: true }, raw('L164'));
  input.addEventListener('input', () => { reset.disabled = input.value.trim().toUpperCase() !== 'RESET'; });
  reset.addEventListener('click', async () => {
    if (reset.disabled) return;
    reset.disabled = true;
    try {
      await resetAllData();
    } catch {
      closeSheet({ instant: true });
      app.home();
      showNote(text('S317'));
      return;
    }
    window.location.reload();
  });
  openSheet([
    el('h2', { class: 'sheet-title' }, text('S312')),
    el('p', {}, text('S313')),
    el('p', { class: 'small muted' }, text('S314')),
    input,
    reset,
    el('button', { type: 'button', class: 'btn btn-text-wide', onclick: () => closeSheet() }, raw('L03')),
  ]);
}

// ---- Settings ----

export async function renderSettings(root) {
  const metrics = await loadMetrics();
  const check = checkList(metrics);
  const L79 = raw('L79');
  const checkRowsNodes = check
    ? check.rows.map((r) => el('div', { class: 'row row-check' },
      el('span', { class: 'row-main' }, el('span', { class: 'row-label small num' }, r.fact), r.tip ? el('span', { class: 'row-sub muted small' }, r.tip) : null),
      r.status ? el('span', { class: 'row-value small' }, r.status) : null))
    : [infoRow(L79[2])];
  const copied = el('p', { class: 'muted small', hidden: true }, text('S90'));
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
    group(check ? text('S284', { n: check.weekNo }) : text('S284', {}), [...checkRowsNodes, navRow(items[5], null, () => app.validation())]),
    group(raw('L157'), [
      infoRow(items[4]),
      el('button', { type: 'button', class: 'row row-tap', onclick: async () => { if (await copyValidation()) copied.hidden = false; } }, el('span', { class: 'row-label' }, raw('L78'))),
      navRow(raw('L163'), null, resetSheet),
    ], { note: text('S54') }),
    copied,
    el('p', { class: 'muted small num page-end' }, text('S64', { version: APP_VERSION }))));
}
