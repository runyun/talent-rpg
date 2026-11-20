// Attributes and difficulty knobs (spec 4.4, 6.5, 6.6, section 9).

import { CONFIG } from '../config.js';
import { raw } from '../text.js';

export const ATTR = { FUNDAMENTALS: 0, PERFORMANCE: 1, PERCEPTION: 2, KNOWLEDGE: 3 };

/** Prefilled starting values for a level code: beginner | basic | intermediate. */
export function startValues(level) {
  const s = CONFIG.startDifficulty;
  return {
    count: s.count[level],
    performanceSec: s.performanceLengthSec[level],
    bpm: s.speedBpm[level],
  };
}

/** Default N and its unit code for an attribute index. */
export function defaultN(index, level) {
  const v = startValues(level);
  return index === ATTR.PERFORMANCE ? { n: v.performanceSec, unit: 'sec' } : { n: v.count, unit: 'count' };
}

/**
 * Build a new attribute record.
 * input: { name?, material, n, speed (number|null), speedUnit ('bpm'|'custom'), speedUnitText }
 */
export function newAttribute(talentId, index, level, input) {
  const def = defaultN(index, level);
  const n = positiveInt(input.n) || def.n;
  const hasSpeed = index === ATTR.FUNDAMENTALS && positiveNum(input.speed);
  const speed = hasSpeed ? positiveNum(input.speed) : null;
  return {
    talentId,
    index,
    name: input.name || raw('L49')[index],
    material: (input.material || '').trim(),
    nStart: n,
    nCurrent: n,
    nTarget: Math.round(n * CONFIG.targetMultiplier),
    nUnit: def.unit,
    speedStart: speed,
    speedCurrent: speed,
    speedTarget: speed === null ? null : Math.round(speed * CONFIG.targetMultiplier),
    speedUnit: speed === null ? null : (input.speedUnit || 'bpm'),
    speedUnitText: speed === null ? '' : (input.speedUnitText || '').trim(),
    lastPracticedAt: null,
    feedbackStreak: { dir: null, count: 0 },
    knobLastChangedAt: null,
    plateau: null,
    plateauCount: 0,
    plateauEndedAt: null,
    plateauEndShown: false,
    tooHardStreakBonus: false,
    materialHistory: [],
    targetPromptOff: false,
  };
}

export function positiveInt(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function positiveNum(v) {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Which knob feedback turns: 'speed' for Fundamentals with a speed, otherwise 'n'. */
export function knobKind(attr) {
  return attr.index === ATTR.FUNDAMENTALS && attr.speedStart ? 'speed' : 'n';
}

/** One step up (dir = 1) or down (dir = -1) from value. */
export function stepValue(attr, kind, value, dir) {
  const k = CONFIG.knob;
  const start = kind === 'speed' ? attr.speedStart : attr.nStart;
  const floor = Math.max(1, Math.ceil(start * k.floorRatio));
  let next;
  if (kind === 'speed' && attr.speedUnit === 'bpm') {
    next = value + dir * k.speedBpmStep;
  } else {
    const factor = kind === 'speed' ? 1 + k.speedPercent : k.countFactor;
    next = dir > 0 ? Math.round(value * factor) : Math.round(value / factor);
    if (dir > 0) next = Math.max(next, value + k.countMinStep);
    else next = Math.min(next, value - k.countMinStep);
  }
  return Math.max(floor, next);
}

/** Display value with unit, e.g. '8', '30 sec', '70 BPM'. */
export function formatN(attr, value = attr.nCurrent) {
  return attr.nUnit === 'sec' ? `${value} ${raw('L71')}` : `${value}`;
}

export function speedUnitLabel(attr) {
  if (attr.speedUnit === 'bpm') return raw('L52')[0];
  return attr.speedUnitText || '';
}

export function formatSpeed(attr, value = attr.speedCurrent) {
  if (value === null || value === undefined) return null;
  const unit = speedUnitLabel(attr);
  return unit ? `${value} ${unit}` : `${value}`;
}

export function formatKnob(attr, kind, value) {
  return kind === 'speed' ? formatSpeed(attr, value) : formatN(attr, value);
}

/** Progress of the main knob toward its target, 0..1 (for bars). */
export function knobProgress(attr) {
  if (!attr.material) return 0;
  const kind = knobKind(attr);
  const cur = kind === 'speed' ? attr.speedCurrent : attr.nCurrent;
  const target = kind === 'speed' ? attr.speedTarget : attr.nTarget;
  if (!target) return 0;
  return Math.max(0, Math.min(1, cur / target));
}

/** Mini scaling of N (spec 6.5). */
export function miniN(value) {
  return Math.max(CONFIG.mini.countMin, Math.ceil(value * CONFIG.mini.countFactor));
}

/** True when the metronome should run for this attribute. */
export function usesMetronome(attr) {
  return attr.index === ATTR.FUNDAMENTALS && attr.speedStart && attr.speedUnit === 'bpm';
}

/**
 * Apply one feedback answer to an attribute (not saved). Returns
 * { attr, change: null | { kind, dir, old, new }, reachedTarget }.
 */
export function applyFeedback(attrIn, answer, now) {
  const attr = { ...attrIn, feedbackStreak: { ...(attrIn.feedbackStreak || { dir: null, count: 0 }) } };
  const need = CONFIG.knob.streakToChange;
  let change = null;
  let reachedTarget = false;

  if (answer === 'justRight') {
    attr.feedbackStreak = { dir: null, count: 0 };
    attr.tooHardStreakBonus = false;
    return { attr, change, reachedTarget };
  }

  const dir = answer === 'tooEasy' ? 1 : -1;
  const s = attr.feedbackStreak;
  attr.feedbackStreak = s.dir === dir ? { dir, count: s.count + 1 } : { dir, count: 1 };
  attr.tooHardStreakBonus = false;

  if (attr.feedbackStreak.count >= need) {
    attr.feedbackStreak = { dir: null, count: 0 };
    const kind = knobKind(attr);
    const key = kind === 'speed' ? 'speedCurrent' : 'nCurrent';
    const old = attr[key];
    const next = stepValue(attr, kind, old, dir);
    if (next !== old) {
      attr[key] = next;
      attr.knobLastChangedAt = now;
      change = { kind, dir, old, new: next };
      const target = kind === 'speed' ? attr.speedTarget : attr.nTarget;
      if (dir > 0 && target && next >= target && !attr.targetPromptOff) reachedTarget = true;
    }
    if (dir < 0) attr.tooHardStreakBonus = true;
  }
  return { attr, change, reachedTarget };
}

/** New material after the target is reached: history + knobs back to start (spec 6.6). */
export function replaceMaterial(attr, material, now) {
  return {
    ...attr,
    materialHistory: [...(attr.materialHistory || []), { material: attr.material, reachedAt: now }],
    material: material.trim(),
    nCurrent: attr.nStart,
    speedCurrent: attr.speedStart,
    feedbackStreak: { dir: null, count: 0 },
    knobLastChangedAt: now,
  };
}
