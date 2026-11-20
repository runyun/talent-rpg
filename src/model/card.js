// Home card choice (spec 6.2) and attribute order (spec 6.4).
// Stage 2 covers cards 3-6. Return card and trial card come in stage 3.

import { CONFIG } from '../config.js';
import { dateKey, isoWeekday, weekKey } from '../time.js';
import { instanceStatus, instancesForWeek, upcomingInstances, weekStats } from './schedule.js';

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
 * Returns one of:
 *  { type: 'slot', mode: 'in' | 'past', inst }
 *  { type: 'sunday' }
 *  { type: 'next', inst, todayDone }
 *  { type: 'free', talent }
 *  { type: 'empty' }
 * plus { week } (weekStats of this week).
 */
export function decideCard(state, now) {
  const wk = weekKey(now);
  const week = weekStats(wk, state, now);
  const usable = week.instances.filter((i) => hasTask(state, i.talent.id));

  const inSlot = usable.filter((i) => instanceStatus(i, now) === 'in').sort(byMainThenStart);
  if (inSlot.length) return { type: 'slot', mode: 'in', inst: inSlot[0], week };

  const past = usable.filter((i) => instanceStatus(i, now) === 'past').sort(byMainThenStart);
  if (past.length) return { type: 'slot', mode: 'past', inst: past[0], week };

  const weekRec = state.weeks.get(wk);
  if (isoWeekday(now) === 7 && now.getHours() >= CONFIG.sundayCardHour && !(weekRec && weekRec.nextWeekConfirmed)) {
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
