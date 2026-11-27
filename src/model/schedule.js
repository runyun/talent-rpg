// Training slots, slot windows, weekly goal and rescheduling (spec 4.4, 6.7-6.10, 6.12).
//
// A slot instance is computed, not stored: key = '<weekKey>|<slotId>'.
// A practice record stores the key in slotInstance; that marks the instance as done.

import { CONFIG } from '../config.js';
import {
  MINUTE, addDays, at, dateKey, fromDateKey, fromLocalStamp, hm, weekKey,
} from '../time.js';

export function instanceKey(wk, slotId) {
  return `${wk}|${slotId}`;
}

export function parseInstanceKey(key) {
  const [wk, slotId] = key.split('|');
  return { wk, slotId };
}

/** Time of a practice record (v5 records have `at`; older ones started and ended). */
export function recordAt(r) {
  return r.at || r.endedAt || r.startedAt || 0;
}

export function doneInstanceKeys(records) {
  const set = new Set();
  for (const r of records) if (r.slotInstance) set.add(r.slotInstance);
  return set;
}

/** Window of an instance: 15 min before the start to 60 min after it (spec 6.8). */
function windowOf(start) {
  return {
    opens: new Date(start.getTime() - CONFIG.slots.windowBeforeMin * MINUTE),
    closes: new Date(start.getTime() + CONFIG.slots.windowAfterMin * MINUTE),
  };
}

/**
 * Every instance of one week for non-dormant talents.
 * nextWeekOnly: added this week after its time had passed (listed as "Starts next week", not counted).
 */
export function allInstancesForWeek(wk, state) {
  const talentsById = new Map(state.talents.map((t) => [t.id, t]));
  const done = doneInstanceKeys(state.sessions);
  const out = [];
  for (const slot of state.slots) {
    const talent = talentsById.get(slot.talentId);
    if (!talent || talent.role === 'dormant') continue;
    const day = dateKey(addDays(fromDateKey(wk), slot.weekday - 1));
    const original = at(day, slot.time);
    const key = instanceKey(wk, slot.id);
    const override = slot.overrides && slot.overrides[key];
    const start = override ? fromLocalStamp(override) : original;
    const nextWeekOnly = Boolean(slot.createdAt && slot.createdAt > original.getTime());
    out.push({
      key, wk, slot, talent, start, ...windowOf(start), done: done.has(key), nextWeekOnly,
    });
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

/** Instances that count this week (spec 6.8, 6.12). */
export function instancesForWeek(wk, state) {
  return allInstancesForWeek(wk, state).filter((i) => !i.nextWeekOnly);
}

/** 'in' (window open), 'past' (window over, not done), 'upcoming', or 'done'. */
export function instanceStatus(inst, now) {
  if (inst.done) return 'done';
  if (now.getTime() < inst.opens.getTime()) return 'upcoming';
  if (now.getTime() < inst.closes.getTime()) return 'in';
  return 'past';
}

/** Sessions needed for a weekly win; null when the week does not count (spec 6.12). */
export function requiredForWin(planned) {
  if (planned <= 0) return null;
  return planned >= 3 ? planned - 1 : planned;
}

/** Every practice record of a week (practice, Quick, challenge, Checkpoint, Find your start). */
export function recordsInWeek(wk, records) {
  return records.filter((r) => weekKey(new Date(recordAt(r))) === wk);
}

/** { planned, done, passes, required, won, remaining, atRisk, instances } for a week at time now. */
export function weekStats(wk, state, now) {
  const instances = instancesForWeek(wk, state);
  const planned = instances.length;
  const records = recordsInWeek(wk, state.sessions);
  const done = records.length;
  const passes = records.filter((r) => r.result === 'passed').length;
  const required = requiredForWin(planned);
  const won = required !== null && done >= required;
  const remaining = instances.filter((i) => !i.done && i.closes.getTime() > now.getTime()).length;
  const atRisk = required !== null && !won && remaining < required - done;
  return {
    planned, done, passes, required, won, remaining, atRisk, instances,
  };
}

/** Instances not started yet (this week and the next two weeks), earliest first. */
export function upcomingInstances(state, now) {
  const wk = weekKey(now);
  const all = [0, 1, 2].flatMap((n) => instancesForWeek(dateKey(addDays(fromDateKey(wk), 7 * n)), state));
  return all.filter((i) => !i.done && i.start.getTime() > now.getTime()).sort((a, b) => a.start - b.start);
}

/**
 * The instance a practice of this talent counts for (spec 6.7): this week's earliest undone
 * instance, in its window first, then past ones, then later ones. Null = extra practice.
 */
export function instanceForTalent(state, talentId, now) {
  const mine = instancesForWeek(weekKey(now), state).filter((i) => i.talent.id === talentId && !i.done);
  for (const mode of ['in', 'past', 'upcoming']) {
    const found = mine.filter((i) => instanceStatus(i, now) === mode).sort((a, b) => a.start - b.start)[0];
    if (found) return found;
  }
  return null;
}

// ---- Rescheduling (spec 6.10) ----

/** Options available now: 'inHour', 'tonight' (hidden from 20:00), 'tomorrow'. */
export function rescheduleOptions(now) {
  const opts = ['inHour'];
  if (now.getHours() < CONFIG.rescheduleTonightCutoffHour) opts.push('tonight');
  opts.push('tomorrow');
  return opts;
}

export function rescheduleTarget(option, inst, now) {
  if (option === 'inHour') {
    const t = new Date(now.getTime() + 60 * MINUTE);
    const m = t.getMinutes();
    const up = (5 - (m % 5)) % 5; // round up to 5 minutes
    t.setMinutes(m + up, 0, 0);
    return t;
  }
  if (option === 'tonight') {
    return at(dateKey(now), `${String(CONFIG.rescheduleTonightHour).padStart(2, '0')}:00`);
  }
  return at(dateKey(addDays(now, 1)), hm(inst.start));
}

/** Move to the first free time (windows must not overlap): +15 min steps; after 23:00, the next day. */
export function resolveCollision(target, inst, state) {
  const before = CONFIG.slots.windowBeforeMin * MINUTE;
  const after = CONFIG.slots.windowAfterMin * MINUTE;
  const others = [-1, 0, 1, 2]
    .flatMap((n) => allInstancesForWeek(dateKey(addDays(fromDateKey(weekKey(target)), 7 * n)), state))
    .filter((o) => o.key !== inst.key);
  const collides = (t) => others.some((o) => t.getTime() - before < o.closes.getTime() && o.opens.getTime() < t.getTime() + after);

  let t = new Date(target);
  const requested = hm(target);
  for (let guard = 0; guard < 400 && collides(t); guard += 1) {
    const next = new Date(t.getTime() + CONFIG.rescheduleStepMin * MINUTE);
    const last = at(dateKey(t), `${CONFIG.rescheduleLastHour}:00`);
    t = next.getTime() > last.getTime() || dateKey(next) !== dateKey(t)
      ? at(dateKey(addDays(t, 1)), requested)
      : next;
  }
  return t;
}
