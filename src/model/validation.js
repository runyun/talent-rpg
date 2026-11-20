// Validation data (spec 10): numbers computed from what the app already stores.
// Only shown to the user; nothing leaves the phone.

import {
  MINUTE, addDays, at, dateKey, fromDateKey, fromLocalStamp, weekKey,
} from '../time.js';
import { parseInstanceKey, sessionsInWeek, weekStats } from './schedule.js';

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
