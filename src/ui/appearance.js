// Appearance (spec 5.13, 7.6): themes, finish effects, title frames and legendary titles
// (badges were retired in data v6). Every item is shown as it really looks; tap one for a bigger
// preview with Buy / Use.

import { el, mount } from '../dom.js';
import { text, raw } from '../text.js';
import { ITEMS } from '../strings.js';
import { CONFIG } from '../config.js';
import { state, savePlayer } from '../store.js';
import { FRAME_CODES } from '../model/vault.js';
import { levelFromExp } from '../model/record.js';
import { DEFAULT_THEME, THEME_IDS } from '../themes.js';
import { FINISH_EFFECTS } from '../data/room.js';
import { effectSvg } from './effects.js';
import {
  backButton, openSheet, closeSheet,
} from './widgets.js';
import { app } from './app.js';

/** Apply a theme to the whole app right away. */
export function applyTheme(code) {
  document.documentElement.dataset.theme = THEME_IDS.includes(code) ? code : DEFAULT_THEME;
}

function frameNode(frame, label) {
  return el('span', { class: `title-frame frame-${frame || 'none'}` }, label);
}

/** The equipped legendary title in its frame (title row of Today). */
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
  if ((p.mana || 0) < price) return;
  await savePlayer({ ...p, mana: p.mana - price, owned: { ...p.owned, [kind]: [...owned(kind), code] } });
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

/** A small Today card in a theme: frame, role tag, Today's target with a big number, a bit of the week, the button. */
function themePreview(code, big = false) {
  const cells = [0, 1, 2, 3].map((i) => el('span', { class: `week-cell${i < 2 ? ' done' : ''}${i === 2 ? ' is-today' : ''}` },
    el('span', { class: 'week-box' })));
  return el('span', { class: `theme-preview${big ? ' big' : ''}`, 'data-theme': code },
    el('span', { class: 'week-cells' }, cells),
    el('span', { class: 'card' },
      el('span', { class: 'card-name' }, el('span', { class: 'tag tag-solid' }, raw('L45'))),
      el('span', { class: 'card-target' },
        el('span', { class: 'part-label small muted' }, raw('L97')),
        el('span', { class: 'target-big num' }, el('span', { class: 'target-num' }, [...'100'].map((d) => el('span', { class: 'dg' }, d)))))),
    el('span', { class: 'btn btn-primary btn-main' }, raw('L100')));
}

function effectPreview(code) {
  return el('span', { class: 'fx-tile' }, effectSvg(code, { still: true }));
}

/** Big preview of a finish effect: a small Passed screen; plays once, Play plays again. */
function effectDemo(code) {
  const holder = el('span', {}, effectSvg(code));
  const play = el('button', {
    type: 'button',
    class: 'btn',
    onclick: () => holder.replaceChildren(effectSvg(code)),
  }, raw('L160'));
  return el('span', { class: 'stack' },
    el('span', { class: 'fx-demo' }, holder,
      el('span', { class: 'finish-big' }, raw('L111')),
      el('span', { class: 'num' }, text('S170', { old: '96', new: '100 BPM' }))),
    play);
}

/** Your current title (or Lv) in a frame, at real size. */
function framePreview(code) {
  const p = state.player;
  const label = (p.equipped && p.equipped.title) || text('S276', { lv: levelFromExp(p.totalExp) });
  return el('span', { class: 'frame-preview' }, frameNode(code, label));
}

function titlePreview(title) {
  const frame = state.player.equipped && state.player.equipped.titleFrame;
  return el('span', { class: 'frame-preview' }, frameNode(frame, title));
}

// ---- Items ----

/** Under a tile: "name · price" (not owned), name (owned), "name · In use". */
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
  const mana = state.player.mana || 0;
  const parts = [el('div', { class: 'preview-big' }, item.preview(true)), el('p', { class: 'small muted' }, status(item))];
  if (inUse) parts.push(el('button', { type: 'button', class: 'btn on', disabled: true }, raw('L33')));
  else if (isOwned) parts.push(el('button', { type: 'button', class: 'btn btn-primary', onclick: () => use(item.slot, item.code) }, raw('L32')));
  else {
    parts.push(el('button', {
      type: 'button',
      class: 'btn btn-primary',
      disabled: mana < item.price || undefined,
      onclick: () => buy(item.kind, item.code, item.price),
    }, raw('L31')));
    if (mana < item.price) parts.push(el('p', { class: 'muted small' }, text('S285', { n: item.price - mana })));
  }
  openSheet(parts);
}

function tile(item) {
  return el('button', { type: 'button', class: 'preview-tile', onclick: () => detailSheet(item) },
    item.preview(false),
    el('span', { class: 'tile-name small muted' }, status(item)));
}

function itemGroup(title, items, columns) {
  return el('section', { class: 'group' },
    el('h2', { class: 'group-title' }, title),
    el('div', { class: `preview-grid cols-${columns}` }, items.map(tile)));
}

/** S310 once after badges were retired with a refund (4.14). */
function refundLine() {
  const n = state.player.badgeRefund || 0;
  if (!n) return null;
  savePlayer({ ...state.player, badgeRefund: 0 });
  return el('p', { class: 'muted small' }, text('S310', { n }));
}

export function renderAppearance(root) {
  const L68 = raw('L68');
  const prices = CONFIG.prices;
  const titles = owned('legendaryTitles');

  const themes = THEME_IDS.map((code, i) => ({
    kind: 'themes', slot: 'theme', code, name: ITEMS.themes[i], price: i === 0 ? 0 : prices.theme, preview: (big) => themePreview(code, big),
  }));
  const effects = FINISH_EFFECTS.map((f) => ({
    kind: 'finishEffects', slot: 'finishEffect', code: f.code, name: f.name, price: f.price, preview: (big) => (big ? effectDemo(f.code) : effectPreview(f.code)),
  }));
  const frames = FRAME_CODES.map((code, i) => ({
    kind: 'titleFrames', slot: 'titleFrame', code, name: ITEMS.titleFrames[i], price: code === 'none' ? 0 : prices.titleFrame, preview: () => framePreview(code),
  }));
  const legendary = titles.map((title) => ({
    kind: 'legendaryTitles', slot: 'title', code: title, name: title, price: 0, preview: () => titlePreview(title),
  }));

  mount(root, el('section', { class: 'page fade-in' },
    el('div', { class: 'page-top' }, backButton(() => app.back())),
    el('h1', { class: 'page-title' }, raw('L82')[2]),
    el('p', { class: 'muted' }, text('S267', { n: state.player.mana || 0 })),
    refundLine(),
    itemGroup(L68[0], themes, 2),
    itemGroup(L68[1], effects, 3),
    itemGroup(L68[2], frames, 2),
    legendary.length ? itemGroup(L68[3], legendary, 2) : null));
}
