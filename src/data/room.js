// Room items (copy sheet part 9, "Room"): codes, positions and prices. Names are in strings.js
// (ITEMS.room, same order). The first item of each position is free and the default.

import { ITEMS } from '../strings.js';

export const POSITIONS = ['window', 'wall', 'desk', 'lamp', 'chair', 'plant', 'rug'];

const PRICES = {
  window: [0, 25, 25, 25],
  wall: [0, 15, 15, 15],
  desk: [0, 25, 25, 25],
  lamp: [0, 15, 15, 15],
  chair: [0, 20, 20, 20],
  plant: [0, 15, 15, 15],
  rug: [0, 15, 15, 15],
};

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** ROOM_ITEMS[position] = [{ code, name, price, position }] */
export const ROOM_ITEMS = Object.freeze(Object.fromEntries(POSITIONS.map((pos) => [pos, ITEMS.room[pos].map((name, i) => ({
  code: slug(name), name, price: PRICES[pos][i], position: pos,
}))])));

export function roomItem(code) {
  for (const pos of POSITIONS) {
    const found = ROOM_ITEMS[pos].find((x) => x.code === code);
    if (found) return found;
  }
  return null;
}

/** Items that can be bought (S306 {total}). */
export const BUYABLE_ROOM_ITEMS = POSITIONS.flatMap((pos) => ROOM_ITEMS[pos].filter((x) => x.price > 0));

// Finish effects (spec 3.3, copy sheet part 9): Check is free; the others cost 20 Mana.
export const FINISH_EFFECTS = Object.freeze(ITEMS.finishEffects.map((name, i) => ({ code: slug(name), name, price: i === 0 ? 0 : 20 })));
