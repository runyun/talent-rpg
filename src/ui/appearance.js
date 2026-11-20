// Appearance (spec 5.2 item 6, 7.6): Mana Stones, themes, badges, title frames, legendary titles.
// Items only change looks; they never affect levels.

import { el, svg } from '../dom.js';
import { raw } from '../text.js';
import { ITEMS } from '../strings.js';
import { CONFIG } from '../config.js';
import { state, savePlayer } from '../store.js';
import { FRAME_CODES } from '../model/vault.js';
import { app } from './app.js';

export const THEME_CODES = [
  'pureBlack', 'terminal', 'amberScreen', 'notebook', 'washi', 'newspaper',
  'blueprint', 'nightSky', 'forest', 'neon', 'daylight', 'highContrast',
];
export const BADGE_CODES = ['circle', 'square', 'triangle', 'diamond', 'hexagon', 'doubleCircle', 'cross', 'star'];

const BADGE_SHAPES = {
  circle: '<circle cx="12" cy="12" r="8"/>',
  square: '<rect x="4.5" y="4.5" width="15" height="15"/>',
  triangle: '<path d="M12 4l8 15H4z"/>',
  diamond: '<path d="M12 3l8 9-8 9-8-9z"/>',
  hexagon: '<path d="M12 3.5l7.5 4.3v8.4L12 20.5l-7.5-4.3V7.8z"/>',
  doubleCircle: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/>',
  cross: '<path d="M12 4v16M4 12h16"/>',
  star: '<path d="M12 3.5l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6-4.5-4.1 6-.7z"/>',
};

/** Apply the equipped theme right away (only colors, fonts and lines change). */
export function applyTheme(code) {
  document.documentElement.dataset.theme = code || 'pureBlack';
}

export function badgeIcon(code) {
  const node = svg(BADGE_SHAPES[code] || BADGE_SHAPES.circle);
  node.classList.add('badge');
  return node;
}

/** The equipped legendary title in its frame (shown after S50 in the top row). */
export function titleNode(player) {
  const title = player.equipped && player.equipped.title;
  if (!title) return null;
  const frame = (player.equipped && player.equipped.titleFrame) || 'none';
  return el('span', { class: `title-frame frame-${frame}` }, title);
}

function owned(kind) {
  return (state.player.owned && state.player.owned[kind]) || [];
}

async function buy(kind, code, price) {
  const p = state.player;
  if (p.magicStones < price) return;
  await savePlayer({ ...p, magicStones: p.magicStones - price, owned: { ...p.owned, [kind]: [...owned(kind), code] } });
  app.home();
}

async function use(slot, code) {
  const p = state.player;
  await savePlayer({ ...p, equipped: { ...p.equipped, [slot]: code } });
  if (slot === 'theme') applyTheme(code);
  app.home();
}

/** One row: name + In use / Use / Buy · price. */
function itemRow(label, { kind, slot, code, price, preview }) {
  const isOwned = owned(kind).includes(code);
  const inUse = state.player.equipped && state.player.equipped[slot] === code;
  let button;
  if (inUse) button = el('button', { type: 'button', class: 'seg-btn on', disabled: true }, raw('L33'));
  else if (isOwned) button = el('button', { type: 'button', class: 'seg-btn', onclick: () => use(slot, code) }, raw('L32'));
  else {
    button = el('button', {
      type: 'button',
      class: 'seg-btn',
      disabled: state.player.magicStones < price || undefined,
      onclick: () => buy(kind, code, price),
    }, `${raw('L31')} · ${price}`);
  }
  return el('div', { class: 'item-row' }, el('span', { class: 'item-name' }, preview || null, label), button);
}

export function renderAppearanceSection() {
  const L68 = raw('L68');
  const prices = CONFIG.prices;
  const p = state.player;
  const titles = owned('legendaryTitles');
  return el('section', { class: 'section' },
    el('h2', { class: 'section-title' }, raw('L60')[5]),
    el('div', { class: 'item-row' }, el('span', {}, L68[0]), el('span', { class: 'num' }, String(p.magicStones || 0))),
    el('h3', { class: 'item-head muted small' }, L68[1]),
    ...THEME_CODES.map((code, i) => itemRow(ITEMS.themes[i], {
      kind: 'themes', slot: 'theme', code, price: prices.theme, preview: el('span', { class: `swatch swatch-${code}` }),
    })),
    el('h3', { class: 'item-head muted small' }, L68[2]),
    ...BADGE_CODES.map((code, i) => itemRow(ITEMS.badges[i], {
      kind: 'badges', slot: 'badge', code, price: prices.badge, preview: badgeIcon(code),
    })),
    el('h3', { class: 'item-head muted small' }, L68[3]),
    ...FRAME_CODES.map((code, i) => itemRow(ITEMS.titleFrames[i], {
      kind: 'titleFrames', slot: 'titleFrame', code, price: prices.titleFrame,
    })),
    titles.length ? el('h3', { class: 'item-head muted small' }, L68[4]) : null,
    ...titles.map((title) => itemRow(title, { kind: 'legendaryTitles', slot: 'title', code: title, price: 0 })));
}
