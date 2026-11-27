// Validation data (spec 10): numbers from what the app already stores. Only on the phone.

import { CONFIG } from '../config.js';
import {
  addDays, dateKey, fromDateKey, weekKey,
} from '../time.js';
import { recordAt, recordsInWeek, requiredForWin, weekStats } from './schedule.js';

const ratio = (n, d) => (d ? n / d : null);

/** Week keys from the first open to now, newest first. */
export function weeksSince(firstOpenedAt, now) {
  const out = [];
  const first = weekKey(new Date(firstOpenedAt));
  for (let wk = weekKey(now); wk >= first; wk = dateKey(addDays(fromDateKey(wk), -7))) out.push(wk);
  return out;
}

/** One row per week (newest first) with every weekly metric of 10.2. */
export function weeklyRows(state, metrics, now) {
  const thisWeek = weekKey(now);
  const inWeek = (ms, wk) => weekKey(new Date(ms)) === wk;
  return weeksSince(state.player.firstOpenedAt, now).map((wk) => {
    const records = recordsInWeek(wk, state.sessions);
    const rec = state.weeks.get(wk);
    const live = weekStats(wk, state, now);
    const planned = wk !== thisWeek && rec && typeof rec.planned === 'number' ? rec.planned : live.planned;
    const practice = records.filter((r) => r.kind === 'practice' && r.result);
    const opens = metrics.filter((m) => m.type === 'open' && inWeek(m.openedAt, wk));
    const byTalent = {};
    for (const r of records) byTalent[r.talentId] = (byTalent[r.talentId] || 0) + 1;
    return {
      wk,
      planned,
      done: records.length,
      offSlot: ratio(records.filter((r) => r.afterSlotEnd === true || (!r.slotInstance && r.afterSlotEnd !== false)).length, records.length),
      passRate: ratio(practice.filter((r) => r.result === 'passed').length, practice.length),
      quickShare: ratio(records.filter((r) => r.kind === 'quick').length, records.length),
      edits: metrics.filter((m) => (m.type === 'focusEdit' || m.type === 'stepEdit') && inWeek(m.at, wk)).length,
      opensWithoutPractice: opens.filter((m) => !m.practiced).length,
      stress: rec && typeof rec.anxiety === 'number' ? rec.anxiety : null,
      byTalent,
    };
  });
}

export function addTalentTimes(metrics) {
  return metrics.filter((m) => m.type === 'addTalent').sort((a, b) => a.at - b.at).map((m) => ({ at: m.at, seconds: m.seconds }));
}

export function toggles(metrics) {
  return metrics.filter((m) => m.type === 'toggle').sort((a, b) => a.at - b.at);
}

/** Challenges, Checkpoints and old trials per talent, oldest first. */
export function challengeResults(state) {
  return state.talents.map((t) => ({
    talent: t,
    items: [
      ...state.trials.filter((r) => r.talentId === t.id && r.value !== null && r.value !== undefined && r.value !== '')
        .map((r) => ({ at: r.at || 0, kind: 'trial', value: Number(r.value) })),
      ...state.sessions.filter((r) => r.talentId === t.id && (r.kind === 'challenge' || r.kind === 'checkpoint'))
        .map((r) => ({
          at: recordAt(r), kind: r.kind, rank: r.star ? 'S' : r.challengeRank, value: r.value, result: r.result,
        })),
    ].sort((a, b) => a.at - b.at),
  })).filter((x) => x.items.length);
}

/**
 * Check (10.1): null before the first full week. Otherwise { weekNo, rows: [{ key, vars, status, tip }] },
 * status 'onTrack' | 'worth' | 'none' | 'done' | null (facts only).
 */
export function checkRows(state, metrics, now) {
  const thisWk = weekKey(now);
  const firstWk = weekKey(new Date(state.player.firstOpenedAt));
  if (thisWk <= firstWk) return null;
  const lastWk = dateKey(addDays(fromDateKey(thisWk), -7));
  const weeks = weeklyRows(state, metrics, now);
  const last = weeks.find((w) => w.wk === lastWk);
  const weekNo = Math.round((fromDateKey(lastWk) - fromDateKey(firstWk)) / (7 * 86400000)) + 1;
  const judge = (ok) => (ok ? 'onTrack' : 'worth');
  const rows = [];

  const goal = requiredForWin(last.planned);
  rows.push({
    key: 'S74', vars: { done: last.done, planned: last.planned, goal }, status: goal === null ? 'none' : judge(last.done >= goal), tip: 'S82',
  });

  if (last.passRate === null) rows.push({ key: 'S269', vars: {}, status: 'none' });
  else {
    const x = Math.round(last.passRate * 100);
    const lo = CONFIG.check.passRate.min * 100;
    const hi = CONFIG.check.passRate.max * 100;
    rows.push({
      key: 'S269', vars: { x }, status: judge(x >= lo && x <= hi), tip: x < lo ? 'S271' : 'S272',
    });
  }

  const main = state.talents.find((t) => t.role === 'main');
  const reached = main && CONFIG.ranks.indexOf(main.rank) >= CONFIG.ranks.indexOf('D');
  let mainStatus = null;
  if (reached) mainStatus = 'done';
  else if (weekNo >= CONFIG.check.mainRankDByWeek) mainStatus = 'worth';
  rows.push({
    key: 'S270', vars: {}, status: mainStatus, tip: 'S273',
  });

  const scores = weeks.filter((w) => w.wk <= lastWk && w.stress !== null).map((w) => w.stress);
  const avg = scores.length ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10 : null;
  rows.push({
    key: 'S78', vars: { x: avg }, status: avg === null ? 'none' : judge(avg <= CONFIG.check.stress), tip: 'S87',
  });

  rows.push({
    key: 'S79',
    vars: { count: last.edits },
    status: weekNo < CONFIG.check.editsFromWeek ? 'onTrack' : judge(last.edits <= CONFIG.check.edits),
    tip: 'S88',
  });

  const adds = addTalentTimes(metrics);
  const latest = adds.length ? adds[adds.length - 1].seconds : null;
  rows.push({
    key: 'S80', vars: { x: latest }, status: latest === null ? 'none' : judge(latest <= CONFIG.check.addTalentSec), tip: 'S89',
  });

  const challenges = state.sessions.filter((r) => r.kind === 'challenge').sort((a, b) => recordAt(a) - recordAt(b));
  const lastC = challenges[challenges.length - 1];
  if (lastC) rows.push({ key: 'S81', record: lastC, status: null });

  return { weekNo, rows };
}
