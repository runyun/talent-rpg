// Appearance (spec 5.13, 7.6): themes, badges, title frames, legendary titles.
// Every item is shown as it really looks; tap one for a bigger preview with Buy / Use.
// Items only change looks; they never affect levels.

import { el, mount, svg } from '../dom.js';
import { text, raw, tagOf } from '../text.js';
import { ITEMS } from '../strings.js';
import { CONFIG } from '../config.js';
import { state, savePlayer } from '../store.js';
import { FRAME_CODES } from '../model/vault.js';
import { levelFromExp } from '../model/session.js';
import { THEME_CODES } from '../themes.js';
import {
  bar, backButton, openSheet, closeSheet,
} from './widgets.js';
import { app } from './app.js';

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

/** Apply the equipped theme right away. */
export function applyTheme(code) {
  document.documentElement.dataset.theme = THEME_CODES.includes(code) ? code : 'pureBlack';
}

export function badgeIcon(code) {
  const node = svg(BADGE_SHAPES[code] || BADGE_SHAPES.circle);
  node.classList.add('badge');
  return node;
}

function frameNode(frame, label) {
  return el('span', { class: `title-frame frame-${frame || 'none'}` }, label);
}

/** The equipped legendary title in its frame (shown after S50 in the top row). */
export function titleNode(player) {
  const title = player.equipped && player.equipped.title;
  if (!title) return null;
  return frameNode(player.equipped.titleFrame, title);
}

function owned(kind) {
  return (state.player.owned && state.player.owned[kind]) || [];
}

async function buy(kind, code, price) {
  const p = state.player;
  if ((p.magicStones || 0) < price) return;
  await savePlayer({ ...p, magicStones: p.magicStones - price, owned: { ...p.owned, [kind]: [...owned(kind), code] } });
  closeSheet();
  app.refresh();
}

async function use(slot, code) {
  const p = state.player;
  await savePlayer({ ...p, equipped: { ...p.equipped, [slot]: code } });
  if (slot === 'theme') applyTheme(code);
  closeSheet();
  app.refresh();
}

// ---- Previews ----

/** A small task card drawn in a theme: background and texture, frame, a tag, a bar, Start. */
function themePreview(code, big = false) {
  return el('span', { class: `theme-preview${big ? ' big' : ''}`, 'data-theme': code },
    el('span', { class: 'preview-card frame' },
      el('span', { class: 'preview-tag' }, el('span', { class: 'sys-tag' }, tagOf('S01'))),
      bar(0.6, code),
      el('span', { class: 'btn btn-invert preview-start' }, raw('L01'))));
}

function badgePreview(code, big = false) {
  return el('span', { class: `badge-preview${big ? ' big' : ''}` }, badgeIcon(code));
}

/** Your current title (or Lv) in a frame, at the size of the top row. */
function framePreview(code) {
  const p = state.player;
  const label = (p.equipped && p.equipped.title) || text('S50', { lv: levelFromExp(p.totalExp) });
  return el('span', { class: 'frame-preview top-row' }, frameNode(code, label));
}

function titlePreview(title) {
  const frame = state.player.equipped && state.player.equipped.titleFrame;
  return el('span', { class: 'frame-preview top-row' }, frameNode(frame, title));
}

// ---- Items ----

/**
 * item = { kind, slot, code, name, price, preview(big) }
 * Status line under a tile: name and price, or In use.
 */
function status(item) {
  const inUse = state.player.equipped && state.player.equipped[item.slot] === item.code;
  const isOwned = owned(item.kind).includes(item.code);
  if (inUse) return `${item.name} · ${raw('L33')}`;
  if (isOwned || !item.price) return item.name;
  return `${item.name} · ${item.price}`;
}

function detailSheet(item) {
  const inUse = state.player.equipped && state.player.equipped[item.slot] === item.code;
  const isOwned = owned(item.kind).includes(item.code) || !item.price;
  let action;
  if (inUse) action = el('button', { type: 'button', class: 'btn on', disabled: true }, raw('L33'));
  else if (isOwned) action = el('button', { type: 'button', class: 'btn btn-primary', onclick: () => use(item.slot, item.code) }, raw('L32'));
  else {
    action = el('button', {
      type: 'button',
      class: 'btn btn-primary',
      disabled: (state.player.magicStones || 0) < item.price || undefined,
      onclick: () => buy(item.kind, item.code, item.price),
    }, `${raw('L31')} · ${item.price}`);
  }
  openSheet(el('div', { class: 'stack' },
    el('div', { class: 'preview-big' }, item.preview(true)),
    el('p', { class: 'small muted' }, status(item)),
    action));
}

function tile(item) {
  return el('button', { type: 'button', class: 'preview-tile', onclick: () => detailSheet(item) },
    item.preview(false),
    el('span', { class: 'tile-name small muted' }, status(item)));
}

function group(title, items, columns) {
  return el('section', { class: 'section' },
    el('h2', { class: 'section-title' }, title),
    el('div', { class: `preview-grid cols-${columns}` }, items.map(tile)));
}

export function renderAppearance(root) {
  const L68 = raw('L68');
  const prices = CONFIG.prices;
  const titles = owned('legendaryTitles');

  const themes = THEME_CODES.map((code, i) => ({
    kind: 'themes', slot: 'theme', code, name: ITEMS.themes[i], price: prices.theme, preview: (big) => themePreview(code, big),
  }));
  const badges = BADGE_CODES.map((code, i) => ({
    kind: 'badges', slot: 'badge', code, name: ITEMS.badges[i], price: prices.badge, preview: (big) => badgePreview(code, big),
  }));
  const frames = FRAME_CODES.map((code, i) => ({
    kind: 'titleFrames', slot: 'titleFrame', code, name: ITEMS.titleFrames[i], price: prices.titleFrame, preview: () => framePreview(code),
  }));
  const legendary = titles.map((title) => ({
    kind: 'legendaryTitles', slot: 'title', code: title, name: title, price: 0, preview: () => titlePreview(title),
  }));

  mount(root, el('section', { class: 'page fade-in' },
    el('div', { class: 'page-top' }, backButton(() => app.back())),
    el('h1', { class: 'page-title' }, raw('L60')[4]),
    el('div', { class: 'item-row' }, el('span', {}, L68[0]), el('span', { class: 'num' }, String(state.player.magicStones || 0))),
    group(L68[1], themes, 2),
    group(L68[2], badges, 4),
    group(L68[3], frames, 2),
    legendary.length ? group(L68[4], legendary, 2) : null));
}
