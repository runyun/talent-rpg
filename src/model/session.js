// Starting and finishing a practice session (spec 5.3, 5.4, 6.5-6.7, 6.11, 6.12).

import { CONFIG } from '../config.js';
import { MINUTE, dateKey, weekKey, hm } from '../time.js';

const hmOf = (ms) => hm(new Date(ms));
import { applyFeedback, formatKnob, knobKind } from './knobs.js';
import { easierCopy, expFor, sizeMinutes, taskSentence } from './tasks.js';
import { orderAttributes } from './card.js';
import { weekStats } from './schedule.js';
import { makeRng } from '../rng.js';
import {
  autoNumbers, drawFor, releasePending, revealDraws,
} from './vault.js';

/** EXP needed to go from Lv L to L+1 (spec 6.11). */
export function expForLevel(lv) {
  const { base, growth } = CONFIG.levelCurve;
  return Math.round(base * growth ** (lv - 1));
}

export function levelFromExp(totalExp) {
  let lv = 1;
  let left = totalExp;
  while (left >= expForLevel(lv)) {
    left -= expForLevel(lv);
    lv += 1;
  }
  return lv;
}

/**
 * Build the running-session object.
 * attrs: the talent's 4 attributes. attr: the chosen attribute.
 */
export function buildActive({ id, talent, attrs, attr, size, inst, onTime, now }) {
  const phases = [];
  if (size === 'deep') {
    const d = CONFIG.sizes.deep;
    // Warm-up: the attribute practiced last time, one step easier (spec 5.3).
    const practiced = orderAttributes(attrs).filter((a) => a.lastPracticedAt);
    const last = practiced.length ? practiced[practiced.length - 1] : attr;
    phases.push({ phase: 0, minutes: d.warmUp, attributeIndex: last.index, task: taskSentence(easierCopy(last), 'standard'), speedOf: easierCopy(last) });
    phases.push({ phase: 1, minutes: d.main, attributeIndex: attr.index, task: taskSentence(attr, 'standard'), speedOf: attr });
    phases.push({ phase: 2, minutes: d.coolDown, attributeIndex: attr.index, task: null, speedOf: null });
  } else {
    phases.push({ phase: null, minutes: sizeMinutes(size), attributeIndex: attr.index, task: taskSentence(attr, size), speedOf: attr });
  }
  const startedAt = now.getTime();
  return {
    id,
    talentId: talent.id,
    attributeIndex: attr.index,
    size,
    slotInstance: inst ? inst.key : null,
    onTime: inst ? onTime : null,
    startedAt,
    endsAt: startedAt + sizeMinutes(size) * MINUTE,
    phases: phases.map((p) => ({
      phase: p.phase,
      minutes: p.minutes,
      attributeIndex: p.attributeIndex,
      task: p.task,
      bpm: p.speedOf && p.speedOf.index === 0 && p.speedOf.speedUnit === 'bpm' ? p.speedOf.speedCurrent : null,
    })),
    knobSnapshot: { material: attr.material, n: attr.nCurrent, speed: attr.speedCurrent },
    status: 'running',
    endedAt: null,
  };
}

/** Which phase is running at time t: { index, phase, remainingMs }. */
export function currentPhase(active, t) {
  let start = active.startedAt;
  for (let i = 0; i < active.phases.length; i += 1) {
    const end = start + active.phases[i].minutes * MINUTE;
    if (t < end || i === active.phases.length - 1) {
      return { index: i, phase: active.phases[i], phaseEnd: end };
    }
    start = end;
  }
  return { index: 0, phase: active.phases[0], phaseEnd: active.endsAt };
}

/**
 * Compute everything a finished session changes. Nothing is saved here.
 * feedback: 'tooEasy' | 'justRight' | 'tooHard' | null (mini)
 * Returns { session, attr, player, week, results }.
 * results: ordered list of { key, vars } plus { materialPrompt: attr } when S16 applies.
 */
export function finishSession({ active, feedback, state, attr, now }) {
  const exp = expFor(active.size);
  const endedAt = active.endedAt || now.getTime();
  const results = [];

  // Attribute: last practiced + feedback knob turn (not for mini).
  let nextAttr = { ...attr, lastPracticedAt: endedAt };
  let change = null;
  let reachedTarget = false;
  if (active.size !== 'mini' && feedback) {
    const r = applyFeedback(nextAttr, feedback, endedAt);
    nextAttr = r.attr;
    change = r.change;
    reachedTarget = r.reachedTarget;
  }

  const session = {
    id: active.id,
    talentId: active.talentId,
    attributeIndex: active.attributeIndex,
    size: active.size,
    slotInstance: active.slotInstance,
    startedAt: active.startedAt,
    endedAt,
    onTime: active.onTime,
    knobSnapshot: active.knobSnapshot,
    feedback: active.size === 'mini' ? null : feedback,
    expGained: exp,
    crit: null,
    evidenceId: active.evidenceId || null,
  };

  // Player: EXP, level, practice days.
  const p = state.player;
  const lvBefore = levelFromExp(p.totalExp);
  const seen = new Set(p.seenExplanations || []);
  const firstExp = !seen.has('S60');
  seen.add('S60');
  const newDay = !p.lastPracticedAt || dateKey(new Date(p.lastPracticedAt)) !== dateKey(new Date(endedAt));
  const player = {
    ...p,
    totalExp: p.totalExp + exp,
    lastPracticedAt: endedAt,
    practiceDays: p.practiceDays + (newDay ? 1 : 0),
    seenExplanations: [...seen],
    returnActive: false, // the return card disappears after one finished session
  };
  const lvAfter = levelFromExp(player.totalExp);

  // Critical hit (spec 7.5): Standard/Deep answered "Just right" or "Too hard", 1 in 5.
  const vaultActive = !!p.vaultUnlocked && !(state.settings && state.settings.vaultOn === false);
  let critLine = null;
  if (active.size !== 'mini' && (feedback === 'justRight' || feedback === 'tooHard')) {
    const r = makeRng(`${active.id}|${active.startedAt}`);
    if (r() < CONFIG.crit.chance) {
      const ticket = p.vaultUnlocked && r() >= CONFIG.crit.stoneShareAfterUnlock && vaultActive;
      if (ticket) {
        session.crit = { type: 'ticket', n: CONFIG.crit.ticketAmount };
        critLine = { key: 'S15' };
      } else {
        session.crit = { type: 'stones', n: CONFIG.crit.stoneAmount };
        player.magicStones = (player.magicStones || 0) + CONFIG.crit.stoneAmount;
        critLine = { key: 'S14' };
      }
    }
  }

  // Your vault tickets (spec 7.7): 1 per Standard/Deep session, plus a critical-hit ticket.
  const tickets = [];
  if (vaultActive && active.size !== 'mini') {
    const lucky = state.settings && state.settings.luckyNumbers;
    const numbers = (seq) => (lucky && lucky.length === 3 ? lucky.slice().sort((a, b) => a - b) : autoNumbers(`ticket|${active.id}|${seq}`));
    tickets.push({ draw: drawFor(endedAt), owner: 0, numbers: numbers(0), createdAt: endedAt, seq: 0 });
    if (session.crit && session.crit.type === 'ticket') tickets.push({ draw: drawFor(endedAt), owner: 0, numbers: numbers(1), createdAt: endedAt, seq: 1 });
  }

  // Pending jackpot release (Standard/Deep), then draws revealed at this session (spec 7.8).
  const vaultLines = [];
  let releaseLine = null;
  if (active.size !== 'mini') {
    const rel = releasePending(player);
    if (rel) {
      Object.assign(player, rel.player);
      releaseLine = rel.line;
    }
  }
  let revealed = [];
  const unrevealed = (state.draws || []).filter((d) => !d.revealed).sort((a, b) => a.draw - b.draw);
  if (unrevealed.length) {
    const rv = revealDraws(player, unrevealed);
    Object.assign(player, rv.player);
    vaultLines.push(...rv.lines);
    revealed = unrevealed.map((d) => ({ ...d, revealed: true }));
  }
  if (releaseLine) vaultLines.push(releaseLine);

  // Week: the win counts at the moment it happens.
  const wk = weekKey(new Date(active.startedAt));
  const before = weekStats(wk, state, now);
  const after = weekStats(wk, { ...state, sessions: [...state.sessions, session] }, now);
  const prevRec = state.weeks.get(wk) || { weekStart: wk, nextWeekConfirmed: false, anxiety: null, sameSlotsNoticeShown: false };
  const week = { ...prevRec, planned: after.planned, done: after.done, won: prevRec.won || after.won };
  let winNow = false;
  if (after.won && !before.won && !prevRec.won) {
    winNow = true;
    player.weeklyWins = (p.weeklyWins || 0) + 1;
  }

  // Result lines in spec order (5.4 step 3).
  if (active.size === 'mini') results.push({ key: 'S11' });
  else results.push({ key: 'S10', vars: { exp } });
  if (firstExp) results.push({ key: 'S60' });
  if (change) {
    results.push({
      key: change.dir > 0 ? 'S12' : 'S13',
      vars: {
        attribute: nextAttr.name,
        old: formatKnob(nextAttr, change.kind, change.old),
        new: formatKnob(nextAttr, change.kind, change.new),
      },
    });
  }
  if (reachedTarget) results.push({ key: 'S16', vars: { material: nextAttr.material }, materialPrompt: true });
  if (critLine) results.push(critLine);
  if (lvAfter > lvBefore) results.push({ key: 'S17', vars: { old: lvBefore, new: lvAfter } });
  if (winNow) results.push({ key: 'S18', vars: { done: after.done, planned: after.planned, count: player.weeklyWins } });

  // Companion congratulations (spec 7.10), after S18 and before S19.
  const talentName = (state.talents.find((t) => t.id === active.talentId) || {}).name;
  if (winNow) results.push({ congrats: 'C1', vars: { done: after.done, count: player.weeklyWins } });
  if (p.returnActive) results.push({ congrats: 'C3', vars: { talent: talentName } });
  // Plateau breakthrough: the knob went up within 4 weeks after the Plateau Dungeon ended.
  const windowMs = CONFIG.plateau.breakthroughWeeks * 7 * 24 * 60 * 60 * 1000;
  if (change && change.dir > 0 && nextAttr.plateauEndedAt && !nextAttr.breakthroughShown
    && endedAt - nextAttr.plateauEndedAt <= windowMs) {
    nextAttr.breakthroughShown = true;
    results.push({ congrats: 'C4', vars: { talent: talentName } });
  }

  // Vault results (S41-S45) after the congratulations.
  results.push(...vaultLines);

  // Offer a 30-sec record on a weekly win, unless one was already saved in this session (Deep cool-down).
  if (winNow && !active.evidenceId) results.push({ key: 'S19', evidencePrompt: true });

  // Your milestone for the feed.
  const feedItem = winNow
    ? { date: dateKey(new Date(endedAt)), time: hmOf(endedAt), type: 'you', companionId: null, key: 'S18', vars: { done: after.done, planned: after.planned, count: player.weeklyWins } }
    : null;

  return {
    session, attr: nextAttr, player, week, results, feedItem, tickets, revealed, knob: knobKind(nextAttr),
  };
}
