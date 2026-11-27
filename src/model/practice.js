// The practice model of version 19 (spec 6.1-6.4, 6.17, 6.19).
// A talent has one focus, a goal (= Rank S), a fixed step and today's target.
// Direction comes from the numbers: goal above the start = more is better (dir +1).

import { CONFIG } from '../config.js';
import { fmtValue } from '../format.js';

const RANKS = CONFIG.ranks;
const EPS = 1e-9;

export function rankIndex(rank) {
  return RANKS.indexOf(rank);
}

/** Whole numbers: integers; otherwise 1 decimal (spec 6.2). */
export function roundValue(wholeNumbers, v) {
  return wholeNumbers ? Math.round(v) : Math.round(v * 10) / 10;
}

/** A step size: positive; whole numbers at least 1, otherwise at least 0.1. */
export function normalizeStep(step, wholeNumbers) {
  if (wholeNumbers) return Math.max(1, Math.round(step));
  return Math.max(0.1, Math.round(step * 10) / 10);
}

/** +1 (more is better) or -1 (less is better), from goal and start (or the estimate before a start). */
export function dirOf(t) {
  const base = t.start !== null && t.start !== undefined ? t.start : t.estimate;
  if (t.goal === null || t.goal === undefined || base === null || base === undefined) return 1;
  return t.goal >= base ? 1 : -1;
}

/** Steps from start to goal: ceil(|goal - start| / step). */
export function totalSteps(start, goal, step) {
  if (!step) return 0;
  return Math.max(0, Math.ceil(Math.abs(goal - start) / step - EPS));
}

/** Which step each rank sits on (spec 6.3): E 0, D N/12, C 3N/12, B 6N/12, A 9N/12, S N. */
export function rankSteps(n) {
  const out = [];
  CONFIG.rankShares.forEach((share, i) => {
    if (i === 0) {
      out.push(0);
      return;
    }
    if (i === RANKS.length - 1) {
      out.push(n);
      return;
    }
    // Each rank at least one step above the one before it (pushed later when needed).
    out.push(Math.min(Math.max(Math.round(n * share), out[i - 1] + 1), n));
  });
  return out;
}

/** { E, D, C, B, A, S } values for start, goal and step. S is always the goal. */
export function computeRankValues({ start, goal, step, wholeNumbers }) {
  const dir = goal >= start ? 1 : -1;
  const n = totalSteps(start, goal, step);
  const steps = rankSteps(n);
  const values = {};
  RANKS.forEach((rank, i) => {
    values[rank] = i === RANKS.length - 1 ? goal : roundValue(wholeNumbers, start + dir * steps[i] * step);
  });
  return values;
}

/** One step toward the goal (never past it). */
export function stepToward(t, v) {
  const dir = dirOf(t);
  const n = roundValue(t.wholeNumbers, v + dir * t.step);
  return dir > 0 ? Math.min(n, t.goal) : Math.max(n, t.goal);
}

/** One step back (never worse than the start). */
export function stepBack(t, v) {
  const dir = dirOf(t);
  const n = roundValue(t.wholeNumbers, v - dir * t.step);
  return dir > 0 ? Math.max(n, t.start) : Math.min(n, t.start);
}

/** Is a at least as good as b for this talent? */
export function atLeast(t, a, b) {
  return dirOf(t) > 0 ? a >= b - EPS : a <= b + EPS;
}

// ---- What the card needs ----

/** A talent from data v5 that still needs a goal (Set up card, 6.19). */
export function needsSetup(t) {
  return Boolean(t.needsSetup);
}

/** The first practice after adding (no start yet) or after awakening (spec 6.17). */
export function needsFindStart(t) {
  if (t.needsSetup) return false;
  return t.start === null || t.start === undefined || t.findStart === 'awaken';
}

/** The number Quick and the card show: today's target, or the estimate before a start. */
export function shownTarget(t) {
  if (t.target !== null && t.target !== undefined && !needsFindStart(t)) return t.target;
  if (t.findStart === 'awaken' && t.target !== null && t.target !== undefined) return t.target;
  if (t.estimate !== null && t.estimate !== undefined) return t.estimate;
  return t.start !== undefined ? t.start : null;
}

// ---- Results ----

/**
 * Apply a practice (Passed / Not yet) to today's target (spec 6.4).
 * Returns { talent, old, new, changed, eased }.
 */
export function applyPractice(t, passed, at) {
  const out = { ...t, bounces: { ...(t.bounces || {}) } };
  const old = t.target;
  if (passed) {
    out.passStreak = (t.passStreak || 0) + 1;
    out.missStreak = 0;
    out.lastPass = { value: t.target, at };
    if (out.passStreak >= CONFIG.target.passesToStepUp) {
      out.passStreak = 0;
      if (t.target !== t.goal) out.target = stepToward(t, t.target);
    }
  } else {
    out.missStreak = (t.missStreak || 0) + 1;
    out.passStreak = 0;
    if (out.missStreak >= CONFIG.target.missesToStepDown) {
      out.missStreak = 0;
      const next = stepBack(t, t.target);
      if (next !== t.target) {
        // A "bounce" at the value it came down from (plateau, spec 7.4).
        const key = String(t.target);
        out.bounces[key] = (out.bounces[key] || 0) + 1;
        out.target = next;
      }
    }
  }
  return {
    talent: out, old, new: out.target, changed: out.target !== old, eased: passed ? false : out.target !== old,
  };
}

/** The measured start is too close to the goal for 5 ranks (gap < 5, or < 0.5 with decimals; 6.17). */
export function tooCloseToGoal(t, value) {
  if (value === null || value === undefined || t.goal === null || t.goal === undefined || t.findStart === 'awaken') return false;
  const gap = Math.abs(t.goal - roundValue(t.wholeNumbers, value));
  return gap > EPS && gap < (t.wholeNumbers ? 1 : 0.1) * CONFIG.stepSlider.minSteps - EPS;
}

/**
 * Set my start (spec 6.17). value: the number typed in.
 * Returns { talent, n } or { error: 'S243' } when the start equals or passes the goal.
 */
export function applyFindStart(t, value) {
  const v = roundValue(t.wholeNumbers, value);
  if (t.findStart === 'awaken' && t.start !== null && t.start !== undefined) {
    // Awakened: the easier of the old target and the measured value; start and ranks stay.
    const dir = dirOf(t);
    const prev = t.target === null || t.target === undefined ? v : t.target;
    const target = dir > 0 ? Math.min(prev, v) : Math.max(prev, v);
    const out = {
      ...t, target, findStart: null, passStreak: 0, missStreak: 0,
    };
    return { talent: out, n: totalSteps(target, t.goal, t.step) };
  }
  const estDir = t.goal >= (t.estimate === null || t.estimate === undefined ? v : t.estimate) ? 1 : -1;
  if (v === t.goal || estDir * (t.goal - v) < 0) return { error: 'S243' };
  if (tooCloseToGoal(t, v)) return { error: 'S297' };
  let { step } = t;
  let n = totalSteps(v, t.goal, step);
  if (n < CONFIG.stepSlider.minSteps) {
    // Too few steps for 5 ranks: step = gap / 5, rounded down to the talent's precision.
    const raw = Math.abs(t.goal - v) / CONFIG.stepSlider.minSteps;
    step = t.wholeNumbers ? Math.max(1, Math.floor(raw)) : Math.max(0.1, Math.floor(raw * 10 + EPS) / 10);
    n = totalSteps(v, t.goal, step);
  }
  const out = {
    ...t,
    start: v,
    step,
    target: v,
    findStart: null,
    passStreak: 0,
    missStreak: 0,
    rankValues: computeRankValues({
      start: v, goal: t.goal, step, wholeNumbers: t.wholeNumbers,
    }),
  };
  return { talent: out, n };
}

/** Save Set up (spec 6.19): fields from Add talent pages 2-4. Rank stays. */
export function applySetup(t, {
  focus, unit, now, goal, step, wholeNumbers, checks,
}) {
  const start = roundValue(wholeNumbers, now);
  return {
    ...t,
    focus,
    unit,
    wholeNumbers,
    estimate: start,
    start,
    goal: roundValue(wholeNumbers, goal),
    step,
    target: start,
    checks,
    needsSetup: false,
    findStart: null,
    passStreak: 0,
    missStreak: 0,
    rankValues: computeRankValues({
      start, goal: roundValue(wholeNumbers, goal), step, wholeNumbers,
    }),
  };
}

/**
 * Second line of the "Next time" preview on the finish screen (spec 5.3.2, 7.2):
 * S179 (the pass that opens the next challenge) or S182 at Rank S.
 * Challenges themselves come in stage 10B; until then nothing is shown once the pass is made.
 */
export function rankPreview(t) {
  if (!t.rankValues || t.goal === null || t.goal === undefined) return null;
  const i = rankIndex(t.rank);
  if (i >= RANKS.length - 1) return { key: 'S182', vars: { value: fmtValue(t, t.goal) } };
  const next = RANKS[i + 1];
  const at = next === 'S' ? t.goal : stepToward(t, t.rankValues[next]);
  if (t.lastPass && atLeast(t, t.lastPass.value, at)) return null;
  return { key: 'S179', vars: { rank: next, value: fmtValue(t, at) } };
}
