// Plateau Dungeon (spec 7.4) and the return card's one-step-easier reset (spec 6.2 item 1).

import { CONFIG } from '../config.js';
import { DAY, addDays, dateKey, weekKey } from '../time.js';
import { knobKind, stepValue } from './knobs.js';

/** Methods rotate P5 -> P6 -> P7. */
function startPlateau(attr, now) {
  const count = attr.plateauCount || 0;
  return {
    ...attr,
    plateau: { method: 5 + (count % 3), start: dateKey(now), end: dateKey(addDays(now, CONFIG.plateau.methodDays)) },
    plateauCount: count + 1,
    plateauEndShown: false,
  };
}

/**
 * Daily: end finished plateaus. Weekly (first open on/after Monday): check triggers.
 * Returns { attrs: [changed attributes], talents: [changed talents], player | null }.
 */
export function plateauUpdates(state, now) {
  const today = dateKey(now);
  const changedAttrs = new Map();
  const changedTalents = [];
  const keyOf = (a) => `${a.talentId}|${a.index}`;
  const current = (a) => changedAttrs.get(keyOf(a)) || a;

  // End plateaus whose 7 days are over.
  for (const attrs of state.attrs.values()) {
    for (const a of attrs) {
      if (a && a.plateau && today >= a.plateau.end) {
        changedAttrs.set(keyOf(a), { ...a, plateau: null, plateauEndedAt: now.getTime(), plateauEndShown: false });
      }
    }
  }

  let player = null;
  const wk = weekKey(now);
  if (state.player.plateauCheckedWeek !== wk) {
    player = { ...state.player, plateauCheckedWeek: wk };
    const windowMs = CONFIG.plateau.knobIdleWeeks * 7 * DAY;
    for (const talent of state.talents) {
      if (talent.role === 'dormant') continue;
      const attrs = (state.attrs.get(talent.id) || []).filter((a) => a && a.material).map(current);
      const free = attrs.filter((a) => !a.plateau);
      if (!free.length) continue;

      // (a) Two failed trials in a row: the attribute whose knob moved longest ago.
      if ((talent.failStreak || 0) >= CONFIG.plateau.failedTrialsInRow) {
        const target = free.slice().sort((x, y) => (x.knobLastChangedAt || 0) - (y.knobLastChangedAt || 0))[0];
        changedAttrs.set(keyOf(target), startPlateau(target, now));
        changedTalents.push({ ...talent, failStreak: 0 });
        continue;
      }

      // (b) Knob unchanged for 4 weeks while practiced at least 4 times in that time.
      for (const a of free) {
        const since = Math.max(a.knobLastChangedAt || talent.createdAt, a.plateauEndedAt || 0);
        if (now.getTime() - since < windowMs) continue;
        const from = now.getTime() - windowMs;
        const count = state.sessions.filter((s) => s.talentId === talent.id && s.attributeIndex === a.index && s.startedAt >= from).length;
        if (count >= CONFIG.plateau.minSessions) changedAttrs.set(keyOf(a), startPlateau(a, now));
      }
    }
  }
  return { attrs: [...changedAttrs.values()], talents: changedTalents, player };
}

/**
 * Return after 7+ days without practice: every attribute of non-dormant talents one step easier, once.
 * Returns { attrs, player } or null when nothing to do.
 */
export function returnUpdates(state, now) {
  const p = state.player;
  if (!p.lastPracticedAt) return null;
  if (now.getTime() - p.lastPracticedAt < CONFIG.returnAfterDays * DAY) return null;
  if (p.returnHandledFor === p.lastPracticedAt) return null;
  const attrs = [];
  for (const talent of state.talents) {
    if (talent.role === 'dormant') continue;
    for (const a of state.attrs.get(talent.id) || []) {
      if (!a || !a.material) continue;
      const kind = knobKind(a);
      const key = kind === 'speed' ? 'speedCurrent' : 'nCurrent';
      const next = stepValue(a, kind, a[key], -1);
      if (next !== a[key]) attrs.push({ ...a, [key]: next, knobLastChangedAt: now.getTime() });
    }
  }
  return { attrs, player: { ...p, returnHandledFor: p.lastPracticedAt, returnActive: true } };
}
