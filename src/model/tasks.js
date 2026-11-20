// Task sentences (S02 from the P patterns) and session sizes (spec 6.5).

import { CONFIG } from '../config.js';
import { text, raw } from '../text.js';
import { ATTR, formatN, formatSpeed, knobKind, miniN, stepValue } from './knobs.js';

export const SIZES = ['mini', 'standard', 'deep'];

export function sizeMinutes(size) {
  return CONFIG.sizes[size].minutes;
}

export function sizeFromMinutes(min) {
  return SIZES.find((s) => sizeMinutes(s) === min) || 'standard';
}

export function sizeLabel(size) {
  return raw({ mini: 'L40', standard: 'L41', deep: 'L42' }[size]);
}

export function expFor(size) {
  return CONFIG.exp[size];
}

/** Attribute values for a warm-up: the knob one step easier (not saved). */
export function easierCopy(attr) {
  const kind = knobKind(attr);
  const key = kind === 'speed' ? 'speedCurrent' : 'nCurrent';
  return { ...attr, [key]: stepValue(attr, kind, attr[key], -1) };
}

/** Plateau Dungeon methods P5-P7 (spec 7.4). */
function plateauSentence(attr, size) {
  const material = attr.material;
  const n = size === 'mini' ? miniN(attr.nCurrent) : attr.nCurrent;
  const nText = attr.nUnit === 'sec' ? formatN(attr, n) : n;
  switch (attr.plateau.method) {
    case 5: {
      const half = attr.speedCurrent ? formatSpeed(attr, Math.max(1, Math.round(attr.speedCurrent / 2))) : raw('P5_NO_SPEED');
      return text('P5', { material, speed: half, n: nText });
    }
    case 6:
      return text('P6', { material, n: nText });
    case 7:
    default:
      return text('P7', { material, min: sizeMinutes(size) });
  }
}

/** S02: the task sentence for an attribute and size. */
export function taskSentence(attr, size) {
  if (attr.plateau) return plateauSentence(attr, size);
  const mini = size === 'mini';
  const material = attr.material;
  switch (attr.index) {
    case ATTR.FUNDAMENTALS:
      return text('P1', {
        material,
        n: mini ? miniN(attr.nCurrent) : attr.nCurrent,
        speed: formatSpeed(attr),
      });
    case ATTR.PERFORMANCE:
      return mini ? text('P2_MINI', { material }) : text('P2', { material, n: formatN(attr) });
    case ATTR.PERCEPTION:
      return mini ? text('P3_MINI', { material }) : text('P3', { material, n: attr.nCurrent });
    case ATTR.KNOWLEDGE:
    default:
      return text('P4', { material, n: mini ? miniN(attr.nCurrent) : attr.nCurrent });
  }
}

/** S03: '{size} · {min} min · +{exp} EXP' */
export function sizeLine(size) {
  return text('S03', { size: sizeLabel(size), min: sizeMinutes(size), exp: expFor(size) });
}
