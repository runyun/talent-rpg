// Training slots, weekly instances, weekly goal and rescheduling (spec 4.5, 6.1, 6.3, 6.7, 6.8).
//
// A slot instance is computed, not stored: key = '<weekKey>|<slotId>'.
// A finished session stores the key in session.slotInstance; that marks the instance as done.

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

/** All instances of one week for active (non-dormant) talents. */
export function instancesForWeek(wk, state) {
  const talentsById = new Map(state.talents.map((t) => [t.id, t]));
  const done = doneInstanceKeys(state.sessions);
  const out = [];
  for (const slot of state.slots) {
    const talent = talentsById.get(slot.talentId);
    if (!talent || talent.role === 'dormant') continue;
    const day = dateKey(addDays(fromDateKey(wk), slot.weekday - 1));
    const original = at(day, slot.time);
    // A slot added mid-week only counts from the time it was added (spec 6.7).
    if (slot.createdAt && original.getTime() + slot.length * MINUTE <= slot.createdAt) continue;
    const key = instanceKey(wk, slot.id);
    const override = slot.overrides && slot.overrides[key];
    const start = override ? fromLocalStamp(override) : original;
    const end = new Date(start.getTime() + slot.length * MINUTE);
    out.push({ key, wk, slot, talent, start, end, done: done.has(key) });
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

export function doneInstanceKeys(sessions) {
  const set = new Set();
  for (const s of sessions) if (s.slotInstance) set.add(s.slotInstance);
  return set;
}

/** 'in' (window open), 'past' (ended, not done), 'upcoming', or 'done'. */
export function instanceStatus(inst, now) {
  if (inst.done) return 'done';
  const opens = inst.start.getTime() - CONFIG.slots.beforeStartMin * MINUTE;
  if (now.getTime() < opens) return 'upcoming';
  if (now.getTime() < inst.end.getTime()) return 'in';
  return 'past';
}

/** Sessions needed for a weekly win; null when the week does not count. */
export function requiredForWin(planned) {
  if (planned <= 0) return null;
  return planned >= 3 ? planned - 1 : planned;
}

export function sessionsInWeek(wk, sessions) {
  return sessions.filter((s) => s.endedAt && weekKey(new Date(s.startedAt)) === wk);
}

/** { planned, done, required, won, remaining, atRisk } for a week at time now. */
export function weekStats(wk, state, now) {
  const instances = instancesForWeek(wk, state);
  const planned = instances.length;
  const done = sessionsInWeek(wk, state.sessions).length;
  const required = requiredForWin(planned);
  const won = required !== null && done >= required;
  const remaining = instances.filter((i) => !i.done && i.end.getTime() > now.getTime()).length;
  const atRisk = required !== null && !won && remaining < required - done;
  return { planned, done, required, won, remaining, atRisk, instances };
}

/** Upcoming instances from now on (this week and the next two weeks). */
export function upcomingInstances(state, now) {
  const wk = weekKey(now);
  const all = [0, 1, 2].flatMap((n) => instancesForWeek(dateKey(addDays(fromDateKey(wk), 7 * n)), state));
  return all.filter((i) => instanceStatus(i, now) === 'upcoming');
}

/** Was a start at time t "on time" for this instance? (within 15 min after its start) */
export function isOnTime(inst, t) {
  return t.getTime() <= inst.start.getTime() + CONFIG.slots.onTimeMin * MINUTE;
}

// ---- Rescheduling (spec 6.8) ----

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

/** Move to the first free time: +15 min steps; after 23:00, the next day at the same time. */
export function resolveCollision(target, inst, state) {
  const lengthMs = inst.slot.length * MINUTE;
  const others = [-1, 0, 1, 2]
    .flatMap((n) => instancesForWeek(dateKey(addDays(fromDateKey(weekKey(target)), 7 * n)), state))
    .filter((o) => o.key !== inst.key);
  const collides = (t) => others.some((o) => t.getTime() < o.end.getTime() && o.start.getTime() < t.getTime() + lengthMs);

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
