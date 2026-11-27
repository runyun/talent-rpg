// Finishing a practice (spec 5.3, 6.5, 6.12, 6.15, 6.17, 7.5-7.8).
// finishRecord() computes everything a finished practice changes. Nothing is saved here.

import { CONFIG } from '../config.js';
import { dateKey, hm, weekKey } from '../time.js';
import { makeRng } from '../rng.js';
import { weekStats } from './schedule.js';
import {
  applyFindStart, applyPractice, rankPreview,
} from './practice.js';
import {
  autoNumbers, drawFor, releasePending, revealDraws,
} from './vault.js';

/** EXP needed to go from Lv L to L+1 (spec 6.15). */
export function expForLevel(lv) {
  const { base, growth } = CONFIG.levelCurve;
  return Math.round(base * growth ** (lv - 1));
}

export function levelFromExp(totalExp) {
  return levelProgress(totalExp).lv;
}

/** { lv, into, need }: EXP gained inside the current level and EXP needed for the next. */
export function levelProgress(totalExp) {
  let lv = 1;
  let left = totalExp || 0;
  while (left >= expForLevel(lv)) {
    left -= expForLevel(lv);
    lv += 1;
  }
  return { lv, into: left, need: expForLevel(lv) };
}

export function vaultActive(state) {
  return Boolean(state.player.vaultUnlocked) && !(state.settings && state.settings.vaultOn === false);
}

/**
 * kind: 'practice' | 'quick' | 'findStart'
 * result: 'passed' | 'notYet' (practice only). value: the measured start (findStart only).
 * inst: the slot instance it counts for, or null (extra practice).
 * Returns { error } or { record, talent, player, week, tickets, revealed, feedItem, view }.
 */
export function finishRecord({
  state, id, kind, talent, inst, result = null, value = null, checksMissed = [], now,
}) {
  const at = now.getTime();
  const p = state.player;

  // Talent changes.
  let nextTalent = talent;
  const view = {
    kind, talentId: talent.id, passed: result === 'passed',
  };
  let recordValue = talent.target;
  if (kind === 'practice') {
    const r = applyPractice(talent, result === 'passed', at);
    nextTalent = r.talent;
    Object.assign(view, {
      old: r.old, new: r.new, changed: r.changed, eased: r.eased,
    });
  } else if (kind === 'findStart') {
    const r = applyFindStart(talent, value);
    if (r.error) return { error: r.error };
    nextTalent = r.talent;
    recordValue = r.talent.target;
    view.startSet = { value: r.talent.target, n: r.n };
  } else {
    recordValue = talent.target !== null && talent.target !== undefined ? talent.target : talent.estimate;
  }
  view.next = nextTalent.target;
  view.preview = kind === 'quick' ? null : rankPreview(nextTalent);

  // EXP and Lv (spec 6.15). The Gate (x1.5) comes in stage 10B.
  const exp = CONFIG.exp[kind];
  const record = {
    id,
    talentId: talent.id,
    kind,
    slotInstance: inst ? inst.key : null,
    at,
    afterSlotEnd: inst ? at > inst.closes.getTime() : true,
    value: recordValue,
    result: kind === 'practice' ? result : null,
    checksMissed,
    gate: false,
    expGained: exp,
    crit: null,
  };
  const seen = new Set(p.seenExplanations || []);
  view.firstExp = !seen.has('S60');
  seen.add('S60');
  const newDay = !p.lastPracticedAt || dateKey(new Date(p.lastPracticedAt)) !== dateKey(now);
  const player = {
    ...p,
    totalExp: (p.totalExp || 0) + exp,
    lastPracticedAt: at,
    practiceDays: (p.practiceDays || 0) + (newDay ? 1 : 0),
    seenExplanations: [...seen],
  };
  view.exp = exp;
  view.expBefore = p.totalExp || 0;
  view.expAfter = player.totalExp;
  view.lvOld = levelFromExp(p.totalExp || 0);
  view.lvNew = levelFromExp(player.totalExp);

  const vault = vaultActive(state);
  const counted = kind !== 'quick'; // Quick: no ticket, no critical hit, no release (spec 6.5)

  // Critical hit (spec 7.5): 1 in 5, seeded by the record.
  if (counted) {
    const r = makeRng(`${id}|${at}`);
    if (r() < CONFIG.crit.chance) {
      const ticket = p.vaultUnlocked && vault && r() >= CONFIG.crit.manaShareAfterUnlock;
      if (ticket) {
        record.crit = { type: 'ticket', n: CONFIG.crit.ticketAmount };
        view.crit = 'S15';
      } else {
        record.crit = { type: 'mana', n: CONFIG.crit.manaAmount };
        player.mana = (player.mana || 0) + CONFIG.crit.manaAmount;
        view.crit = 'S14';
      }
    }
  }

  // Your vault tickets (spec 7.7): 1 per practice (not Quick), plus a critical-hit ticket.
  const tickets = [];
  if (vault && counted) {
    const lucky = state.settings && state.settings.luckyNumbers;
    const numbers = (seq) => (lucky && lucky.length === 3 ? lucky.slice().sort((a, b) => a - b) : autoNumbers(`ticket|${id}|${seq}`));
    tickets.push({
      draw: drawFor(at), owner: 0, numbers: numbers(0), createdAt: at, seq: 0,
    });
    if (record.crit && record.crit.type === 'ticket') {
      tickets.push({
        draw: drawFor(at), owner: 0, numbers: numbers(1), createdAt: at, seq: 1,
      });
    }
  }

  // Pending jackpot release (practice only here), then draws revealed now (spec 7.8).
  view.vaultLines = [];
  let releaseLine = null;
  if (kind === 'practice') {
    const rel = releasePending(player);
    if (rel) {
      Object.assign(player, rel.player);
      releaseLine = rel.line;
    }
  }
  let revealed = [];
  if (counted) {
    const unrevealed = (state.draws || []).filter((d) => !d.revealed).sort((a, b) => a.draw - b.draw);
    if (unrevealed.length) {
      const rv = revealDraws(player, unrevealed);
      Object.assign(player, rv.player);
      view.vaultLines.push(...rv.lines);
      revealed = unrevealed.map((d) => ({ ...d, revealed: true }));
    }
  }
  if (releaseLine) view.vaultLines.push(releaseLine);

  // Week (spec 6.12): the win counts at the moment it happens, with Mana 5.
  const wk = weekKey(now);
  const before = weekStats(wk, state, now);
  const after = weekStats(wk, { ...state, sessions: [...state.sessions, record] }, now);
  const prevRec = state.weeks.get(wk) || {
    weekStart: wk, nextWeekConfirmed: false, anxiety: null,
  };
  const week = {
    ...prevRec, planned: after.planned, done: after.done, passes: after.passes, won: Boolean(prevRec.won || after.won),
  };
  view.weekDone = after.done;
  view.weekPlanned = after.planned;
  view.winNow = after.won && !before.won && !prevRec.won;
  if (view.winNow) {
    player.weeklyWins = (p.weeklyWins || 0) + 1;
    player.mana = (player.mana || 0) + CONFIG.mana.weeklyWin;
    view.winCount = player.weeklyWins;
  }
  view.manaGained = (player.mana || 0) - (p.mana || 0);
  view.manaTotal = player.mana || 0;

  // Companion congratulations (spec 7.10): the weekly win here; others come with their features.
  view.congrats = [];
  if (view.winNow) view.congrats.push({ kind: 'C1', vars: { done: after.done, count: player.weeklyWins } });

  const feedItem = view.winNow
    ? {
      date: dateKey(now), time: hm(now), type: 'you', companionId: null, key: 'S18', vars: { done: after.done, planned: after.planned, count: player.weeklyWins },
    }
    : null;

  return {
    record, talent: nextTalent, player, week, tickets, revealed, feedItem, view,
  };
}
