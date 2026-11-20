// Validation data (spec 10): numbers computed from what the app already stores.
// Only shown to the user; nothing leaves the phone.

import {
  MINUTE, addDays, at, dateKey, fromDateKey, fromLocalStamp, weekKey,
} from '../time.js';
import {
  parseInstanceKey, requiredForWin, sessionsInWeek, weekStats,
} from './schedule.js';

export function median(values) {
  if (!values.length) return null;
  const v = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2);
}

const ratio = (n, d) => (d ? n / d : null);

/** Week keys from the first open to now, newest first. */
export function weeksSince(firstOpenedAt, now) {
  const out = [];
  const first = weekKey(new Date(firstOpenedAt));
  for (let wk = weekKey(now); wk >= first; wk = dateKey(addDays(fromDateKey(wk), -7))) out.push(wk);
  return out;
}

/**
 * Was the session started after its slot instance had ended?
 * Newer sessions store it (afterSlot); older ones are computed from the slot if it still exists.
 */
export function startedAfterSlot(session, slots) {
  if (!session.slotInstance) return false;
  if (session.afterSlot !== undefined && session.afterSlot !== null) return session.afterSlot;
  const { wk, slotId } = parseInstanceKey(session.slotInstance);
  const slot = slots.find((s) => s.id === slotId);
  if (!slot) return false;
  const override = slot.overrides && slot.overrides[session.slotInstance];
  const start = override ? fromLocalStamp(override) : at(dateKey(addDays(fromDateKey(wk), slot.weekday - 1)), slot.time);
  return session.startedAt >= start.getTime() + slot.length * MINUTE;
}

/**
 * One row per week: { wk, planned, done, onTime, offSlot, secondsToStart, materialEdits,
 * feedback: { tooEasy, justRight, tooHard }, opensWithoutPractice, stress }.
 * Ratios are 0-1 or null when there is nothing to count.
 */
export function weeklyRows(state, metrics, now) {
  const weeks = state.player ? weeksSince(state.player.firstOpenedAt, now) : [];
  const thisWeek = weekKey(now);
  const metricWeek = (m, field) => weekKey(new Date(m[field]));
  return weeks.map((wk) => {
    const sessions = sessionsInWeek(wk, state.sessions);
    const rec = state.weeks.get(wk);
    // The current week is live; past weeks use what was saved at the time, when there is a record.
    const live = weekStats(wk, state, now);
    const planned = wk !== thisWeek && rec && rec.planned !== undefined && rec.planned !== null ? rec.planned : live.planned;
    const slotted = sessions.filter((s) => s.slotInstance);
    const rated = sessions.filter((s) => s.feedback);
    const opens = metrics.filter((m) => m.type === 'open' && metricWeek(m, 'openedAt') === wk);
    const share = (key) => ratio(rated.filter((s) => s.feedback === key).length, rated.length);
    return {
      wk,
      planned,
      done: sessions.length,
      onTime: ratio(slotted.filter((s) => s.onTime).length, slotted.length),
      offSlot: ratio(sessions.filter((s) => !s.slotInstance || startedAfterSlot(s, state.slots)).length, sessions.length),
      secondsToStart: median(opens.map((m) => m.secondsToStart).filter((x) => typeof x === 'number')),
      materialEdits: metrics.filter((m) => m.type === 'materialEdit' && metricWeek(m, 'at') === wk).length,
      feedback: rated.length ? { tooEasy: share('tooEasy'), justRight: share('justRight'), tooHard: share('tooHard') } : null,
      opensWithoutPractice: opens.filter((m) => !m.practiced).length,
      stress: rec && typeof rec.anxiety === 'number' ? rec.anxiety : null,
    };
  });
}

/** Seconds spent on each Add talent, oldest first: [{ at, seconds }]. */
export function addTalentTimes(metrics) {
  return metrics.filter((m) => m.type === 'addTalent').sort((a, b) => a.at - b.at).map((m) => ({ at: m.at, seconds: m.seconds }));
}

/** Companions / System Vault switches, oldest first: [{ at, what, on }]. */
export function toggles(metrics) {
  return metrics.filter((m) => m.type === 'toggle').sort((a, b) => a.at - b.at).map((m) => ({ at: m.at, what: m.what, on: m.on }));
}

/** Trial values per talent, oldest first: [{ talent, records: [{ date, value, kind, passed }] }]. */
export function trialResults(state) {
  return state.talents.map((talent) => ({
    talent,
    records: state.trials
      .filter((t) => t.talentId === talent.id && t.value !== null && t.value !== undefined)
      .sort((a, b) => (a.at || 0) - (b.at || 0) || a.date.localeCompare(b.date))
      .map((t) => ({ date: t.date, value: t.value, kind: t.kind, passed: t.passed })),
  })).filter((x) => x.records.length);
}

// ---- Check (spec 10.1): last full week against the goals ----

const pctInt = (x) => Math.round(x * 100);

/**
 * null while the first week is not over yet. Otherwise
 * { lastWk, rows: [{ key, vars, status, tip }] } where status is
 * 'onTrack' | 'worth' | 'none' (not enough data) | null (facts only, S81) and tip is the
 * suggestion code shown under a 'worth' row.
 */
export function checkRows(state, metrics, now, goals) {
  const thisWk = weekKey(now);
  const firstWk = weekKey(new Date(state.player.firstOpenedAt));
  if (thisWk <= firstWk) return null;
  const lastWk = dateKey(addDays(fromDateKey(thisWk), -7));
  const weeks = weeklyRows(state, metrics, now);
  const last = weeks.find((w) => w.wk === lastWk);
  const weekNo = Math.round((fromDateKey(lastWk) - fromDateKey(firstWk)) / (7 * 86400000)) + 1;
  const rows = [];
  const judge = (ok) => (ok ? 'onTrack' : 'worth');

  // S74 sessions vs planned (goal = weekly win threshold)
  const goal = requiredForWin(last.planned);
  rows.push({
    key: 'S74',
    vars: { done: last.done, planned: last.planned, goal },
    status: goal === null ? 'none' : judge(last.done >= goal),
    tip: 'S82',
  });

  // S75 on-time start rate
  rows.push({
    key: 'S75',
    vars: { x: last.onTime === null ? null : pctInt(last.onTime) },
    status: last.onTime === null ? 'none' : judge(last.onTime >= goals.onTimeRate),
    tip: 'S83',
  });

  // S76 open to Start (median seconds)
  rows.push({
    key: 'S76',
    vars: { x: last.secondsToStart },
    status: last.secondsToStart === null ? 'none' : judge(last.secondsToStart <= goals.secondsToStart),
    tip: 'S84',
  });

  // S77 Just right share (too easy / too hard next to it)
  if (!last.feedback) {
    rows.push({ key: 'S77', vars: {}, status: 'none', tip: null });
  } else {
    const x = pctInt(last.feedback.justRight);
    const a = pctInt(last.feedback.tooEasy);
    const b = pctInt(last.feedback.tooHard);
    const ok = x >= goals.justRight.min * 100 && x <= goals.justRight.max * 100;
    let tip = null;
    if (x < goals.justRight.min * 100) tip = a > b ? 'S85' : 'S86';
    rows.push({
      key: 'S77', vars: { x, a, b }, status: judge(ok), tip,
    });
  }

  // S78 stress: average of every week up to last week
  const scores = weeks.filter((w) => w.wk <= lastWk && w.stress !== null).map((w) => w.stress);
  const avg = scores.length ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10 : null;
  rows.push({
    key: 'S78',
    vars: { x: avg },
    status: avg === null ? 'none' : judge(avg <= goals.stress),
    tip: 'S87',
  });

  // S79 material edits last week (weeks 1-2: always On track)
  rows.push({
    key: 'S79',
    vars: { count: last.materialEdits },
    status: weekNo < goals.materialEditsFromWeek ? 'onTrack' : judge(last.materialEdits <= goals.materialEdits),
    tip: 'S88',
  });

  // S80 the latest Add talent
  const adds = addTalentTimes(metrics);
  const latest = adds.length ? adds[adds.length - 1].seconds : null;
  rows.push({
    key: 'S80',
    vars: { x: latest },
    status: latest === null ? 'none' : judge(latest <= goals.addTalentSec),
    tip: 'S89',
  });

  // S81 the latest trial value against the one before it (facts only; hidden without one)
  const records = state.trials
    .filter((t) => t.value !== null && t.value !== undefined && t.value !== '')
    .sort((p, q) => (p.at || 0) - (q.at || 0) || p.date.localeCompare(q.date));
  const newest = records[records.length - 1];
  if (newest) {
    const before = records.filter((t) => t.talentId === newest.talentId && t !== newest).pop();
    const talent = state.talents.find((t) => t.id === newest.talentId);
    if (before && talent) {
      rows.push({
        key: 'S81',
        vars: {
          talent, old: before.value, new: newest.value,
        },
        status: null,
        tip: null,
      });
    }
  }

  return { lastWk, rows };
}
