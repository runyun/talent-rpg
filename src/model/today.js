// Which cards Today shows and in what order (spec 5.1.2, 5.1.3).

import { dateKey, weekKey } from '../time.js';
import {
  instanceForTalent, instanceStatus, recordAt, upcomingInstances, weekStats,
} from './schedule.js';
import { needsFindStart, needsSetup } from './practice.js';

/** 'setup' | 'findStart' | 'task' */
export function cardKind(talent) {
  if (needsSetup(talent)) return 'setup';
  if (needsFindStart(talent)) return 'findStart';
  return 'task';
}

const roleOrder = (t) => (t.role === 'main' ? 0 : 1);

/**
 * Task cards: one per non-dormant talent with an undone instance of this week whose window is
 * open or over; talents that need Find your start or Set up (always, when they have no slots);
 * plus a talent picked with More -> Other talent (extraTalentId), until it is practiced.
 * Order: in its window, Main, instance start, then the order talents were added.
 * Returns { cards: [{ talent, inst, mode, kind, extra }], week }.
 */
export function todayCards(state, now, extraTalentId = null) {
  const week = weekStats(weekKey(now), state, now);
  const cards = [];
  for (const talent of state.talents) {
    if (talent.role === 'dormant') continue;
    const kind = cardKind(talent);
    const open = week.instances
      .filter((i) => i.talent.id === talent.id && !i.done && ['in', 'past'].includes(instanceStatus(i, now)))
      .sort((a, b) => a.start - b.start)[0];
    if (open) {
      cards.push({
        talent, inst: open, mode: instanceStatus(open, now), kind, extra: false,
      });
    } else if (kind !== 'task' && !state.slots.some((s) => s.talentId === talent.id)) {
      cards.push({
        talent, inst: null, mode: null, kind, extra: false,
      });
    }
  }
  const extra = extraTalentId && state.talents.find((t) => t.id === extraTalentId && t.role !== 'dormant');
  if (extra && !cards.some((c) => c.talent.id === extra.id)) {
    const inst = instanceForTalent(state, extra.id, now);
    cards.push({
      talent: extra, inst, mode: inst ? instanceStatus(inst, now) : null, kind: cardKind(extra), extra: true,
    });
  }
  const startOf = (c) => (c.inst ? c.inst.start.getTime() : Infinity);
  cards.sort((a, b) => (a.mode === 'in' ? 0 : 1) - (b.mode === 'in' ? 0 : 1)
    || roleOrder(a.talent) - roleOrder(b.talent)
    || startOf(a) - startOf(b)
    || a.talent.createdAt - b.talent.createdAt);
  return { cards, week };
}

export function practicedToday(state, now, talentId = null) {
  const today = dateKey(now);
  return state.sessions.some((r) => (!talentId || r.talentId === talentId) && dateKey(new Date(recordAt(r))) === today);
}

/** The next slot instance that has not started yet (5.1.3), or null. */
export function nextSlot(state, now) {
  return upcomingInstances(state, now)[0] || null;
}

/**
 * The state card when there is no task card (5.1.3):
 * 'allDone' | 'noSlot' | 'empty' (no talents) | 'allDormant'.
 */
export function stateCard(state, now) {
  if (!state.talents.length) return 'empty';
  if (state.talents.every((t) => t.role === 'dormant')) return 'allDormant';
  return practicedToday(state, now) ? 'allDone' : 'noSlot';
}

/** Today's latest record of each talent, in the order they were done (S258-S261 lines). */
export function todaysRecords(state, now) {
  const today = dateKey(now);
  const latest = new Map();
  for (const r of state.sessions) {
    if (dateKey(new Date(recordAt(r))) === today) latest.set(r.talentId, r);
  }
  return [...latest.values()].sort((a, b) => recordAt(a) - recordAt(b));
}
