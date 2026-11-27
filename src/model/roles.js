// Main / Maintain / Dormant and talent slots (spec 6.13).
// Main + Maintain together may not exceed player.talentSlots; at most one Main.

import { CONFIG } from '../config.js';
import { dateKey } from '../time.js';

export const isRunning = (t) => t.role === 'main' || t.role === 'maintain';

export function talentSlots(player) {
  return player.talentSlots || CONFIG.talentSlotsStart;
}

/** { used, slots } of running talents, leaving out one talent (the one being changed). */
export function slotUse(state, exceptId = null) {
  return {
    used: state.talents.filter((t) => t.id !== exceptId && isRunning(t)).length,
    slots: talentSlots(state.player),
  };
}

/**
 * Can this talent take the role? Main may replace the old Main (it becomes Maintain,
 * so the count stays the same); otherwise a running role needs a free slot.
 */
export function roleAllowed(state, talentId, role) {
  if (role === 'dormant') return true;
  const talent = state.talents.find((t) => t.id === talentId);
  if (talent && isRunning(talent)) return true; // switching between Main and Maintain
  const { used, slots } = slotUse(state, talentId);
  return used < slots;
}

/** Change one talent's role. Becoming Main turns the old Main into Maintain. Returns changed talents. */
export function roleChange(state, talentId, role, now = new Date()) {
  const today = dateKey(now);
  const target = state.talents.find((t) => t.id === talentId);
  const out = [{ ...target, role, roleSince: today }];
  if (role === 'main') {
    const oldMain = state.talents.find((t) => t.role === 'main' && t.id !== talentId);
    if (oldMain) out.push({ ...oldMain, role: 'maintain', roleSince: today });
  }
  return out;
}

/** Role options for Add talent page 5 (spec 5.6): disabled when the slots are full or a Main exists. */
export function newTalentRoleOptions(state) {
  const { used, slots } = slotUse(state);
  const full = used >= slots;
  const hasMain = state.talents.some((t) => t.role === 'main');
  return {
    full,
    used,
    slots,
    main: { disabled: full || hasMain, limit: full ? slots : CONFIG.mainMax },
    maintain: { disabled: full, limit: slots },
  };
}
