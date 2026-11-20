// Trials: cycle, eligibility, pass rule and rank (spec 7.1-7.3).

import { CONFIG } from '../config.js';
import { raw } from '../text.js';
import { addDays, dateKey, fromDateKey } from '../time.js';

export const METRICS = ['speed', 'mistakes', 'lengthOrCount', 'time'];

/** Lowercase metric name for {metric} in copy (from L51). */
export function metricName(metric) {
  return raw('L51')[METRICS.indexOf(metric)].toLowerCase();
}

export function formatValue(talent, v) {
  if (v === null || v === undefined || v === '') return null;
  const unit = talent.trialMetricUnit;
  return unit ? `${v} ${unit}` : `${v}`;
}

export function cycleWeeks(talent) {
  if (talent.role === 'main') return CONFIG.trial.cycleWeeks.main;
  if (talent.role === 'maintain') return CONFIG.trial.cycleWeeks.maintain;
  return null;
}

/** Date key of the next trial, or null for dormant talents. */
export function nextDue(talent) {
  const weeks = cycleWeeks(talent);
  const start = talent.cycleStart || talent.roleSince;
  if (!weeks || !start) return null;
  return dateKey(addDays(fromDateKey(start), weeks * 7));
}

/** { done, need, eligible }: Standard/Deep sessions since the cycle start vs 3/4 of planned slots. */
export function eligibility(talent, state) {
  const weeks = cycleWeeks(talent);
  if (!weeks || !(talent.cycleStart || talent.roleSince)) return { done: 0, need: 0, eligible: false };
  const perWeek = state.slots.filter((s) => s.talentId === talent.id).length;
  const need = Math.ceil(perWeek * weeks * CONFIG.trial.eligibilityRatio);
  const since = fromDateKey(talent.cycleStart || talent.roleSince).getTime();
  const done = state.sessions.filter((s) => s.talentId === talent.id && s.size !== 'mini' && s.endedAt && s.startedAt >= since).length;
  return { done, need, eligible: done >= need };
}

/** True until the talent has its first baseline (spec 6.2: replaces slot cards before the first Standard session). */
export function needsFirstBaseline(talent, state) {
  if (talent.baselineDone) return false;
  return !state.sessions.some((s) => s.talentId === talent.id && s.size !== 'mini');
}

/** What trial step is open today: 'baseline' | 'retry' | 'trial' | null. */
export function trialOpen(talent, state, now) {
  if (talent.role === 'dormant') return null;
  const today = dateKey(now);
  const due = nextDue(talent);
  const { eligible } = eligibility(talent, state);
  if (talent.retryPending && talent.retryAvailableAt && today >= talent.retryAvailableAt) return 'retry';
  if (due && today >= due && eligible) return talent.baselineNeeded ? 'baseline' : 'trial';
  return null;
}

/** The record the next trial is compared with: latest baseline / trial / retry. */
export function previousRecord(talentId, trials) {
  const list = trials
    .filter((t) => t.talentId === talentId && ['baseline', 'trial', 'retry'].includes(t.kind))
    .sort((a, b) => a.at - b.at);
  return list.length ? list[list.length - 1] : null;
}

/** Value needed to pass, one step better than prev (spec 7.2). */
export function passTarget(talent, prev) {
  const s = CONFIG.trial.steps;
  const p = Number(prev);
  switch (talent.trialMetric) {
    case 'speed':
      return /^bpm$/i.test((talent.trialMetricUnit || '').trim())
        ? p + s.speedBpm
        : p + Math.max(1, Math.round(p * s.speedPercent));
    case 'mistakes':
      return p <= 0 ? 0 : Math.max(0, p - Math.max(s.mistakesMin, Math.round(p * s.mistakesPercent)));
    case 'time':
      return Math.max(0, p - Math.max(s.timeMinSec, Math.round(p * s.timePercent)));
    case 'lengthOrCount':
    default:
      return p + Math.max(s.lengthMin, Math.round(p * s.lengthPercent));
  }
}

export function lowerIsBetter(metric) {
  return metric === 'mistakes' || metric === 'time';
}

export function meetsTarget(talent, value, target) {
  return lowerIsBetter(talent.trialMetric) ? Number(value) <= target : Number(value) >= target;
}

export function gap(talent, value, target) {
  return Math.abs(Math.round((target - Number(value)) * 100) / 100);
}

export function rankIndex(rank) {
  return CONFIG.ranks.indexOf(rank);
}

/** Passes needed in the current rank, or null at S (stars). */
export function passesNeeded(rank) {
  const i = rankIndex(rank);
  return i < CONFIG.rankPasses.length ? CONFIG.rankPasses[i] : null;
}

/**
 * Apply a trial result to a talent (not saved).
 * kind: 'trial' | 'retry'. Returns { talent, rankUp, oldRank, k, need, star }.
 */
export function applyResult(talentIn, { kind, passed, now }) {
  const t = { ...talentIn };
  const today = dateKey(now);
  const out = { talent: t, rankUp: false, oldRank: t.rank, k: 0, need: 0, star: false };

  if (kind === 'trial') {
    t.cycleStart = today; // next trial counts from the day of this one
    t.retryPending = !passed;
    t.retryAvailableAt = passed ? null : dateKey(addDays(now, CONFIG.trial.retryAfterWeeks * 7));
  } else {
    t.retryPending = false;
    t.retryAvailableAt = null;
    if (passed) t.cycleStart = today; // a passed retry restarts the cycle; a failed one keeps it
  }
  t.failStreak = passed ? 0 : (t.failStreak || 0) + 1;

  if (passed) {
    const need = passesNeeded(t.rank);
    if (need === null) {
      t.stars = (t.stars || 0) + 1;
      out.star = true;
    } else {
      t.passesInRank = (t.passesInRank || 0) + 1;
      if (t.passesInRank >= need) {
        t.rank = CONFIG.ranks[rankIndex(t.rank) + 1];
        t.passesInRank = 0;
        out.rankUp = true;
        if (t.rank === 'C' && !t.reachedCAt) t.reachedCAt = today;
      } else {
        out.k = t.passesInRank;
        out.need = need;
      }
    }
  }
  t.nextTrialDue = nextDue(t);
  return out;
}
