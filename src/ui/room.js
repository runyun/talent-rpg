// Room and Showcase (spec 5.14, part of Me): the room drawing, keepsakes to place, all keepsakes,
// and furniture by position. Bought items stay forever; nothing fades when you don't practice.

import { el, mount } from '../dom.js';
import { text, raw } from '../text.js';
import { CONFIG } from '../config.js';
import { fmtDateKey } from '../time.js';
import { state, savePlayer, talentById } from '../store.js';
import { POSITIONS, ROOM_ITEMS, BUYABLE_ROOM_ITEMS } from '../data/room.js';
import { ROOM_DEFAULTS } from '../migrateV6.js';
import { roomSvg, itemSvg, isDay } from './roomArt.js';
import {
  backButton, group, navRow, openSheet, closeSheet,
} from './widgets.js';
import { app } from './app.js';

const keepsakeLabel = (k) => (k.stars ? `★${k.stars}` : k.rank);

function equippedRoom() {
  return { ...ROOM_DEFAULTS, ...((state.player.equipped && state.player.equipped.room) || {}) };
}

function placedKeepsakes() {
  return (state.player.keepsakes || []).filter((k) => k.placed).sort((a, b) => (a.placedAt || 0) - (b.placedAt || 0));
}

function waitingKeepsakes() {
  return (state.player.keepsakes || []).filter((k) => !k.placed);
}

/** The room as drawn now (Me card and Room page). */
export function roomPicture() {
  return roomSvg(equippedRoom(), placedKeepsakes().map(keepsakeLabel), isDay());
}

/** Me: the Room card (5.5 item 3). */
export function roomCard() {
  const waiting = waitingKeepsakes().length;
  const owned = (state.player.owned && state.player.owned.room) || [];
  const bought = BUYABLE_ROOM_ITEMS.filter((x) => owned.includes(x.code)).length;
  const line = waiting
    ? text('S305', { n: waiting })
    : text('S306', { owned: bought, total: BUYABLE_ROOM_ITEMS.length });
  return el('section', { class: 'group' },
    el('h2', { class: 'group-title' }, raw('L142')[0]),
    el('button', { type: 'button', class: 'card room-card', onclick: () => app.room() },
      roomPicture(),
      el('span', { class: 'row' }, el('span', { class: 'row-label muted small' }, line), el('span', { class: 'chev muted' }, '›'))));
}

function manaLine() {
  return el('span', { class: 'muted small' }, text('S267', { n: state.player.mana || 0 }));
}

async function place(k) {
  const p = state.player;
  const price = CONFIG.prices.keepsake;
  if ((p.mana || 0) < price) return;
  await savePlayer({
    ...p,
    mana: p.mana - price,
    keepsakes: (p.keepsakes || []).map((x) => (x.id === k.id ? { ...x, placed: true, placedAt: Date.now() } : x)),
    owned: { ...p.owned, keepsakes: [...((p.owned && p.owned.keepsakes) || []), k.id] },
  });
  app.refresh();
}

export function renderRoom(root) {
  const L158 = raw('L158');
  const L159 = raw('L159');
  const price = CONFIG.prices.keepsake;
  const mana = state.player.mana || 0;
  const rows = waitingKeepsakes().map((k) => {
    const t = talentById(k.talentId);
    const enough = mana >= price;
    return el('div', { class: 'row' },
      el('span', { class: 'row-main' },
        el('span', { class: 'row-label' }, text('S255', { talent: t ? t.name : '', rank: keepsakeLabel(k), date: fmtDateKey(k.date) })),
        enough ? null : el('span', { class: 'row-sub muted small' }, text('S285', { n: price - mana }))),
      el('button', {
        type: 'button', class: 'btn-small', disabled: !enough || undefined, onclick: () => place(k),
      }, `${raw('L143')} · ${text('S286', { price })}`));
  });
  rows.push(navRow(L158[3], String(placedKeepsakes().length), () => app.keepsakes()));
  const room = equippedRoom();
  const furniture = POSITIONS.map((pos, i) => {
    const item = ROOM_ITEMS[pos].find((x) => x.code === room[pos]) || ROOM_ITEMS[pos][0];
    return navRow(L159[i], item.name, () => furnitureSheet(pos, i));
  });
  mount(root, el('section', { class: 'page fade-in' },
    el('div', { class: 'page-top' }, backButton(() => app.back())),
    el('div', { class: 'page-head page-head-split' }, el('h1', { class: 'page-title' }, L158[0]), manaLine()),
    el('div', { class: 'card room-big' }, roomPicture()),
    group(L158[1], rows),
    group(L158[2], furniture)));
}

export function renderKeepsakes(root) {
  const tiles = placedKeepsakes().slice().reverse().map((k) => {
    const t = talentById(k.talentId);
    return el('div', { class: 'keepsake' },
      el('span', { class: 'keepsake-rank num' }, keepsakeLabel(k)),
      el('span', { class: 'small clip' }, t ? t.name : ''),
      el('span', { class: 'muted small num' }, fmtDateKey(k.date)));
  });
  mount(root, el('section', { class: 'page fade-in' },
    el('div', { class: 'page-top' }, backButton(() => app.back())),
    el('h1', { class: 'page-title' }, raw('L158')[3]),
    el('p', { class: 'muted small' }, text('S257')),
    el('div', { class: 'keepsake-grid' }, tiles)));
}

/** One position: 4 items to buy or use (5.14 Furniture). Bought items are put in use at once. */
function furnitureSheet(pos, index) {
  const owned = () => (state.player.owned && state.player.owned.room) || [];
  const inUse = () => equippedRoom()[pos];
  let picked = inUse();
  const action = el('div', { class: 'stack' });
  const tiles = ROOM_ITEMS[pos].map((item) => {
    const status = () => {
      if (inUse() === item.code) return `${item.name} · ${raw('L33')}`;
      if (!item.price || owned().includes(item.code)) return item.name;
      return `${item.name} · ${item.price}`;
    };
    const label = el('span', { class: 'tile-name small muted' }, status());
    const tile = el('button', {
      type: 'button',
      class: `preview-tile${picked === item.code ? ' on' : ''}`,
      onclick: () => {
        picked = item.code;
        sheet.querySelectorAll('.preview-tile').forEach((x) => x.classList.toggle('on', x === tile));
        paintAction();
      },
    }, el('span', { class: 'item-preview' }, itemSvg(pos, item.code)), label);
    return tile;
  });
  const sheet = el('div', { class: 'stack' },
    el('div', { class: 'page-head-split' }, el('h2', { class: 'sheet-title' }, raw('L159')[index]), manaLine()),
    el('div', { class: 'preview-grid cols-2' }, tiles),
    action);
  function paintAction() {
    const item = ROOM_ITEMS[pos].find((x) => x.code === picked);
    const mana = state.player.mana || 0;
    const have = !item.price || owned().includes(item.code);
    if (inUse() === item.code) {
      action.replaceChildren(el('button', { type: 'button', class: 'btn on', disabled: true }, raw('L33')));
    } else if (have) {
      action.replaceChildren(el('button', { type: 'button', class: 'btn btn-primary', onclick: () => equip(item, false) }, raw('L32')));
    } else {
      action.replaceChildren(
        el('button', {
          type: 'button', class: 'btn btn-primary', disabled: mana < item.price || undefined, onclick: () => equip(item, true),
        }, raw('L31')),
        mana < item.price ? el('p', { class: 'muted small' }, text('S285', { n: item.price - mana })) : null,
      );
    }
  }
  async function equip(item, buy) {
    const p = state.player;
    if (buy && (p.mana || 0) < item.price) return;
    await savePlayer({
      ...p,
      mana: buy ? p.mana - item.price : p.mana,
      owned: buy ? { ...p.owned, room: [...owned(), item.code] } : p.owned,
      equipped: { ...p.equipped, room: { ...equippedRoom(), [pos]: item.code } },
    });
    closeSheet();
    app.refresh();
  }
  paintAction();
  openSheet([sheet]);
}
