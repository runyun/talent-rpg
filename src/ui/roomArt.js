// The room drawing (spec 5.14): a front view in lines, main text color for lines, card color for
// fills, black, white and gray only, no textures or gradients. Each item is our own SVG markup.
// Window: day (sun and cloud) from 06:00 to 18:00, night (moon and stars) otherwise; decided when
// the page is drawn, never animated or redrawn on a timer.

import { svg } from '../dom.js';
import { POSITIONS } from '../data/room.js';

const W = 320;
const H = 220;
const FLOOR = 172;

// Where each position sits (for single-item previews).
export const BOXES = {
  window: [14, 30, 92, 92],
  wall: [118, 34, 84, 70],
  desk: [96, 96, 140, 80],
  lamp: [176, 60, 90, 116],
  chair: [118, 120, 70, 56],
  plant: [258, 112, 56, 64],
  rug: [70, 168, 180, 46],
};

const sky = (day) => (day
  ? '<circle cx="40" cy="52" r="7"/><path d="M58 70h20a6 6 0 0 0-6-8 8 8 0 0 0-14 4z"/>'
  : '<path d="M44 46a9 9 0 1 0 8 12 7 7 0 1 1-8-12z"/><path d="M70 50l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM62 72l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/>');

const ART = {
  window: {
    'small-window': (day) => `<rect x="24" y="40" width="56" height="64" class="fill"/>${sky(day)}<path d="M52 40v64M24 72h56"/>`,
    'city-view': (day) => `<rect x="20" y="36" width="72" height="78" class="fill"/>${sky(day)}<path d="M20 114v-22h10v-12h10v18h8v-26h12v20h10v-12h10v34"/><path d="M56 36v78"/>`,
    'mountain-view': (day) => `<rect x="20" y="36" width="72" height="78" class="fill"/>${sky(day)}<path d="M20 114l22-30 12 14 16-24 22 40"/><path d="M56 36v18"/>`,
    'sea-view': (day) => `<rect x="20" y="36" width="72" height="78" class="fill"/>${sky(day)}<path d="M20 92h72M24 100q6-4 12 0t12 0 12 0 12 0 12 0M24 108q6-4 12 0t12 0 12 0 12 0 12 0"/><path d="M56 36v56"/>`,
  },
  wall: {
    none: () => '',
    clock: () => '<circle cx="160" cy="62" r="18" class="fill"/><path d="M160 62v-11M160 62l8 5"/>',
    'poster-frame': () => '<rect x="136" y="42" width="48" height="56" class="fill"/><rect x="143" y="49" width="34" height="42"/><path d="M146 86l9-12 7 8 5-6 8 10"/>',
    calendar: () => '<rect x="138" y="44" width="44" height="50" class="fill"/><path d="M138 56h44M149 56v38M160 56v38M171 56v38M138 68h44M138 80h44"/>',
  },
  desk: {
    'folding-table': () => '<path d="M110 132h112"/><path d="M122 132l40 40M210 132l-40 40"/>',
    'writing-desk': () => '<rect x="106" y="128" width="120" height="8" class="fill"/><path d="M112 136v36M220 136v36"/><rect x="184" y="136" width="36" height="20" class="fill"/><path d="M196 146h12"/>',
    'standing-desk': () => '<rect x="108" y="104" width="116" height="7" class="fill"/><path d="M128 111v61M204 111v61M118 172h20M194 172h20"/>',
    workbench: () => '<rect x="104" y="126" width="124" height="12" class="fill"/><path d="M110 138v34M222 138v34M110 158h112"/>',
  },
  lamp: {
    none: () => '',
    'desk-lamp': () => '<path d="M200 128h16M208 128l-6-22 12-10"/><path d="M210 92l14 4-4 10z" class="fill"/>',
    'floor-lamp': () => '<path d="M248 172h16M256 172V84"/><path d="M242 84h28l-6-16h-16z" class="fill"/>',
    'paper-lantern': () => '<path d="M200 0v54"/><ellipse cx="200" cy="70" rx="13" ry="16" class="fill"/><path d="M188 64h24M188 76h24"/>',
  },
  chair: {
    stool: () => '<path d="M146 146h30M150 146l-4 26M172 146l4 26M148 160h26"/>',
    'office-chair': () => '<rect x="144" y="120" width="34" height="22" rx="4" class="fill"/><path d="M142 146h38M161 146v16M146 170l15-8 15 8"/>',
    armchair: () => '<rect x="136" y="128" width="50" height="30" rx="6" class="fill"/><path d="M136 140v26M186 140v26M146 158h30"/>',
    'floor-cushion': () => '<ellipse cx="161" cy="166" rx="24" ry="7" class="fill"/>',
  },
  plant: {
    none: () => '',
    'small-cactus': () => '<path d="M276 172h20l-3-16h-14z" class="fill"/><path d="M286 156v-26M286 142h-6v-8M286 136h6v-6"/>',
    monstera: () => '<path d="M274 172h24l-3-18h-18z" class="fill"/><path d="M286 154v-14M286 140c-14-2-18-14-12-22 8 2 12 10 12 22zM286 140c14-2 18-14 12-22-8 2-12 10-12 22z" class="fill"/>',
    bonsai: () => '<rect x="272" y="160" width="30" height="12" class="fill"/><path d="M287 160c0-10-6-12-4-20M283 140c-10 0-12-8-6-10 4 0 6 6 6 10zM283 140c10-2 14-10 8-12-6 0-8 6-8 12z"/>',
  },
  rug: {
    none: () => '',
    'round-rug': () => '<ellipse cx="160" cy="192" rx="66" ry="14" class="fill"/><ellipse cx="160" cy="192" rx="48" ry="9"/>',
    'striped-rug': () => '<path d="M92 184h136l10 20H82z" class="fill"/><path d="M90 190h140M86 197h148"/>',
    'tatami-mat': () => '<rect x="96" y="180" width="128" height="26" class="fill"/><path d="M160 180v26M96 193h64"/>',
  },
};

/** The shelf on the right wall with the newest 6 placed keepsakes (rank letters, "★n" after S). */
function shelf(labels) {
  const plaques = labels.slice(-6).map((l, i) => {
    const x = 230 + i * 13;
    return `<rect x="${x}" y="40" width="11" height="16" class="fill"/><text x="${x + 5.5}" y="51.5" text-anchor="middle" class="plaque">${l}</text>`;
  }).join('');
  return `<path d="M226 58h86"/>${plaques}`;
}

/**
 * The room as an SVG element. room: { position: code }; keepsakes: labels of placed keepsakes,
 * oldest first; day: true for 06:00-18:00.
 */
export function roomSvg(room, keepsakes, day) {
  const parts = [
    `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" class="frame"/>`,
    `<path d="M1 ${FLOOR}h${W - 2}"/>`,
    ART.rug[room.rug] ? ART.rug[room.rug](day) : '',
    ART.window[room.window] ? ART.window[room.window](day) : '',
    ART.wall[room.wall] ? ART.wall[room.wall](day) : '',
    shelf(keepsakes),
    ART.desk[room.desk] ? ART.desk[room.desk](day) : '',
    ART.chair[room.chair] ? ART.chair[room.chair](day) : '',
    ART.lamp[room.lamp] ? ART.lamp[room.lamp](day) : '',
    ART.plant[room.plant] ? ART.plant[room.plant](day) : '',
  ];
  const node = svg(parts.join(''), `0 0 ${W} ${H}`);
  node.classList.add('room-art');
  node.setAttribute('role', 'img');
  return node;
}

/** One item alone, cropped to its position (furniture previews). */
export function itemSvg(position, code, day = true) {
  const draw = ART[position] && ART[position][code];
  const [x, y, w, h] = BOXES[position];
  const node = svg(draw ? draw(day) : '', `${x} ${y} ${w} ${h}`);
  node.classList.add('room-art', 'item-art');
  return node;
}

export const isDay = (now = new Date()) => now.getHours() >= 6 && now.getHours() < 18;
export { POSITIONS };
