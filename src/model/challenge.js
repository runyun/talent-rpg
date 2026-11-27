// Rank challenges, Checkpoint, plateau, return and Gate (spec 6.13, 6.14, 6.16, 7.1-7.4).

import { CONFIG } from '../config.js';
import { DAY, dateKey } from '../time.js';
import {
  atLeast, dirOf, rankIndex, roundValue, stepBack, stepToward,
} from './practice.js';
import { recordAt } from './schedule.js';

const RANKS = CONFIG.ranks;
export const STAR = 'STAR'; // openRank of a star challenge after Rank S

export function emptyChallenge() {
  return {
    openRank: null, lastAttemptDate: null, failedAt: null, practicedSinceFail: false, askedFirst: [],
  };
}

const ch = (t) => ({ ...emptyChallenge(), ...(t.challenge || {}) });

/** The pass that opens a rank's challenge: that rank's value plus one step (S: the goal). */
export function openingValue(t, rank) {
  if (rank === 'S' || rank === STAR) return t.goal;
  return stepToward(t, t.rankValues[rank]);
}

/** The value of a challenge: the rank's value (S and stars: the goal). */
export function challengeValue(t, rank) {
  if (rank === 'S' || rank === STAR) return t.goal;
  return t.rankValues[rank];
}

/** The next rank to open (or STAR after S); null without rank values. */
export function nextRank(t) {
  if (!t.rankValues) return null;
  const i = rankIndex(t.rank);
  return i >= RANKS.length - 1 ? STAR : RANKS[i + 1];
}

/**
 * After a Passed practice at `value` (spec 7.2): open the highest challenge it reaches.
 * goalPasses: passes in a row at the goal (for S and stars). Returns the new challenge state.
 */
export function openAfterPass(t, value, goalPasses) {
  const c = ch(t);
  if (!t.rankValues) return c;
  const order = [...RANKS.slice(1), STAR];
  const now = c.openRank ? order.indexOf(c.openRank) : -1;
  const from = rankIndex(t.rank);
  for (let i = order.length - 1; i > now; i -= 1) {
    const r = order[i];
    if (r !== STAR && rankIndex(r) <= from) continue;
    if (r === STAR && t.rank !== 'S') continue;
    if (r === 'S' || r === STAR) {
      if (atLeast(t, value, t.goal) && goalPasses >= CONFIG.target.passesToStepUp) return { ...c, openRank: r };
      continue;
    }
    if (atLeast(t, value, openingValue(t, r))) return { ...c, openRank: r };
  }
  return c;
}

/** Records of this talent today. */
export function practicedTodayTalent(state, talentId, now) {
  const today = dateKey(now);
  return state.sessions.some((r) => r.talentId === talentId && dateKey(new Date(recordAt(r))) === today);
}

/**
 * The challenge entry of a talent: null, or { rank, value, ready } where ready = it can be done
 * now (today's first try; after a failure, another day and one practice or Quick in between).
 */
export function challengeEntry(state, t, now) {
  const c = ch(t);
  if (!c.openRank || t.role === 'dormant' || !t.rankValues) return null;
  let ready = !practicedTodayTalent(state, t.id, now);
  if (c.failedAt && (c.failedAt >= dateKey(now) || !c.practicedSinceFail)) ready = false;
  return { rank: c.openRank, value: challengeValue(t, c.openRank), ready };
}

/** S216 {n}: steps until the next challenge opens (null when it is open or unknown). */
export function stepsToNextChallenge(t) {
  const r = nextRank(t);
  if (!r || !t.step || t.target === null || t.target === undefined || (t.challenge && t.challenge.openRank)) return null;
  const at = openingValue(t, r);
  const n = Math.ceil((dirOf(t) * (at - t.target)) / t.step - 1e-9);
  return Math.max(1, n);
}

/** Ranks reached by passing a challenge of `rank` (all ranks in between). */
export function ranksGained(t, rank) {
  if (rank === STAR) return [STAR];
  const from = rankIndex(t.rank);
  return RANKS.slice(from + 1, rankIndex(rank) + 1);
}

// ---- Plateau (7.4) ----

/** Halve the step (whole numbers at least 1; a whole step of 1 stays). */
export function halvedStep(t) {
  if (t.wholeNumbers) return t.step <= 1 ? t.step : Math.max(1, Math.round(t.step / 2));
  return Math.max(0.1, roundValue(false, t.step / 2));
}

/** Start a plateau when a value has bounced 3 times (call after a step back). */
export function maybeStartPlateau(t, bouncedValue, today) {
  if (t.plateau && t.plateau.active) return t;
  if (((t.bounces || {})[String(bouncedValue)] || 0) < CONFIG.plateau.bounces) return t;
  return {
    ...t,
    step: halvedStep(t),
    plateau: {
      active: true, since: today, value: bouncedValue, checkpointOffered: false, noteShown: false,
    },
  };
}

/** End the plateau when the target goes up (C4). Returns { talent, ended }. */
export function maybeEndPlateau(t) {
  if (!t.plateau || !t.plateau.active) return { talent: t, ended: false };
  const bounces = { ...(t.bounces || {}) };
  delete bounces[String(t.plateau.value)];
  return { talent: { ...t, bounces, plateau: { ...t.plateau, active: false } }, ended: true };
}

// ---- Return after 7 days (6.16) ----

/** At open: every running talent's target one step easier, once per absence. */
export function returnUpdates(state, now) {
  const p = state.player;
  if (!p.lastPracticedAt || now.getTime() - p.lastPracticedAt < CONFIG.returnAfterDays * DAY) return null;
  if (p.returnHandledFor === p.lastPracticedAt) return null;
  const talents = state.talents
    .filter((t) => t.role !== 'dormant' && t.target !== null && t.target !== undefined && t.start !== null && t.start !== undefined)
    .map((t) => ({
      ...t, target: stepBack(t, t.target), passStreak: 0, missStreak: 0,
    }));
  return { talents, player: { ...p, returnHandledFor: p.lastPracticedAt, returnActive: true } };
}

// ---- Gate (6.14) ----

/** The Gate talent id of a week: the one picked on the Sunday card, else the Main talent. */
export function gateFor(state, weekStart) {
  const picked = (state.player.gate || []).find((g) => g.weekStart === weekStart);
  const ok = (id) => state.talents.some((t) => t.id === id && t.role !== 'dormant');
  if (picked && ok(picked.talentId)) return picked.talentId;
  const main = state.talents.find((t) => t.role === 'main');
  return main ? main.id : null;
}

export function gateExp(exp) {
  return Math.round(exp * CONFIG.gateMultiplier);
}
