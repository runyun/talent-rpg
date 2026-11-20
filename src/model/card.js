// Home card choice (spec 6.2) and attribute order (spec 6.4).

import { CONFIG } from '../config.js';
import { dateKey, isoWeekday, weekKey } from '../time.js';
import { instanceStatus, instancesForWeek, upcomingInstances, weekStats } from './schedule.js';
import { needsFirstBaseline, trialOpen } from './trials.js';

/** Attributes in practice order: extra turn after 2x too hard, then least recently practiced. */
export function orderAttributes(attrs) {
  return attrs
    .filter((a) => a && a.material)
    .sort((a, b) => {
      if (a.tooHardStreakBonus !== b.tooHardStreakBonus) return a.tooHardStreakBonus ? -1 : 1;
      const ta = a.lastPracticedAt || 0;
      const tb = b.lastPracticedAt || 0;
      if (ta !== tb) return ta - tb;
      return a.index - b.index;
    });
}

function hasTask(state, talentId) {
  return orderAttributes(state.attrs.get(talentId) || []).length > 0;
}

const roleOrder = (t) => (t.role === 'main' ? 0 : 1);
const byMainThenStart = (a, b) => roleOrder(a.talent) - roleOrder(b.talent) || a.start - b.start;

/**
 * Returns one of (priority order, spec 6.2):
 *  { type: 'return', base }            base is the task card underneath (slot / next / free)
 *  { type: 'trial', talent, kind }     kind: 'trial' | 'retry' | 'baseline' (new trial piece)
 *  { type: 'slot', mode: 'in' | 'past', inst, baseline }   baseline: S08 replaces the task
 *  { type: 'sunday' }
 *  { type: 'next', inst, todayDone }
 *  { type: 'free', talent }
 *  { type: 'empty' }
 * plus { week } (weekStats of this week).
 */
export function decideCard(state, now) {
  const wk = weekKey(now);
  const week = weekStats(wk, state, now);

  if (state.player.returnActive) {
    const base = decideTaskCard(state, now, week, { skipSunday: true });
    if (base.type === 'slot' || base.type === 'next' || base.type === 'free') return { type: 'return', base, week };
  }

  const trials = state.talents
    .map((t) => ({ talent: t, kind: trialOpen(t, state, now) }))
    .filter((x) => x.kind)
    .sort((a, b) => roleOrder(a.talent) - roleOrder(b.talent));
  if (trials.length) return { type: 'trial', talent: trials[0].talent, kind: trials[0].kind, week };

  return decideTaskCard(state, now, week);
}

function decideTaskCard(state, now, week, { skipSunday = false } = {}) {
  const wk = weekKey(now);
  const usable = week.instances.filter((i) => hasTask(state, i.talent.id));

  const inSlot = usable.filter((i) => instanceStatus(i, now) === 'in').sort(byMainThenStart);
  if (inSlot.length) return { type: 'slot', mode: 'in', inst: inSlot[0], baseline: needsFirstBaseline(inSlot[0].talent, state), week };

  const past = usable.filter((i) => instanceStatus(i, now) === 'past').sort(byMainThenStart);
  if (past.length) return { type: 'slot', mode: 'past', inst: past[0], baseline: needsFirstBaseline(past[0].talent, state), week };

  const weekRec = state.weeks.get(wk);
  if (!skipSunday && isoWeekday(now) === 7 && now.getHours() >= CONFIG.sundayCardHour && !(weekRec && weekRec.nextWeekConfirmed)) {
    return { type: 'sunday', week };
  }

  const next = upcomingInstances(state, now).filter((i) => hasTask(state, i.talent.id));
  if (next.length) {
    const today = dateKey(now);
    const todays = usable.filter((i) => dateKey(i.start) === today);
    const todayDone = todays.length > 0 && todays.every((i) => i.done);
    return { type: 'next', inst: next[0], todayDone, week };
  }

  const active = state.talents
    .filter((t) => t.role !== 'dormant' && hasTask(state, t.id))
    .sort((a, b) => roleOrder(a) - roleOrder(b) || a.createdAt - b.createdAt);
  if (active.length) return { type: 'free', talent: active[0], week };
  return { type: 'empty', week };
}

export { instancesForWeek };
