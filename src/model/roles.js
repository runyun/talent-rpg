// Main / Maintain / Dormant (spec 6.10).

import { CONFIG } from '../config.js';
import { DAY, dateKey } from '../time.js';
import { nextDue } from './trials.js';

export function maintainLimit(player, now) {
  const early = now.getTime() - player.firstOpenedAt < CONFIG.roles.earlyWeeks * 7 * DAY;
  return early ? CONFIG.roles.maintainMaxEarly : CONFIG.roles.maintainMax;
}

function withRole(talent, role, today) {
  const t = { ...talent, role, roleSince: today, cycleStart: today, retryPending: false, retryAvailableAt: null };
  t.nextTrialDue = nextDue(t);
  return t;
}

/**
 * Change one talent's role. When it becomes Main, the old Main becomes Maintain if there is room,
 * otherwise Dormant; with moveSlots, the old Main's slots move to the new Main (S55).
 * Returns { talents: [...changed], slots: [...changed] }.
 */
export function roleChange(state, talentId, role, { moveSlots = false, now = new Date() } = {}) {
  const today = dateKey(now);
  const target = state.talents.find((t) => t.id === talentId);
  const talents = [withRole(target, role, today)];
  const slots = [];
  if (role === 'main') {
    const oldMain = state.talents.find((t) => t.role === 'main' && t.id !== talentId);
    if (oldMain) {
      const maintainCount = state.talents.filter((t) => t.role === 'maintain' && t.id !== talentId && t.id !== oldMain.id).length;
      const oldRole = maintainCount < maintainLimit(state.player, now) ? 'maintain' : 'dormant';
      talents.push(withRole(oldMain, oldRole, today));
      if (moveSlots) {
        for (const s of state.slots.filter((x) => x.talentId === oldMain.id)) slots.push({ ...s, talentId, overrides: {} });
      }
    }
  }
  return { talents, slots };
}

/** Can this talent take the role now? (Maintain has a limit; Main can always replace the old Main.) */
export function roleAllowed(state, talentId, role, now = new Date()) {
  if (role !== 'maintain') return true;
  const count = state.talents.filter((t) => t.role === 'maintain' && t.id !== talentId).length;
  return count < maintainLimit(state.player, now);
}

/** Awaken: each attribute's N and speed reset to the lower of start and last value (spec 6.10). */
export function awakenAttributes(attrs, now) {
  return attrs.filter(Boolean).map((a) => ({
    ...a,
    nCurrent: Math.min(a.nStart, a.nCurrent),
    speedCurrent: a.speedStart ? Math.min(a.speedStart, a.speedCurrent) : a.speedCurrent,
    feedbackStreak: { dir: null, count: 0 },
    knobLastChangedAt: now.getTime(),
  }));
}
