// Finishing a practice (spec 5.3, 5.7, 6.4-6.17, 7.2-7.8).
// finishRecord() computes everything a finished practice changes. Nothing is saved here.

import { CONFIG } from '../config.js';
import { dateKey, hm, weekKey } from '../time.js';
import { makeRng } from '../rng.js';
import { fmtValue } from '../format.js';
import { joinNext } from './companionSim.js';
import { weekStats } from './schedule.js';
import {
  applyFindStart, applyPractice, rankIndex, rankPreview,
} from './practice.js';
import {
  STAR, challengeValue, emptyChallenge, gateExp, gateFor, maybeEndPlateau, maybeStartPlateau,
  openAfterPass, ranksGained,
} from './challenge.js';
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

/** The rank text of a challenge result: "C", or "S ★2" for a star (C2, S25). */
export function rankLabel(talent) {
  return talent.rank === 'S' && talent.stars ? `S ★${talent.stars}` : talent.rank;
}

/**
 * kind: 'practice' | 'quick' | 'findStart' | 'challenge' | 'checkpoint'
 * result: 'passed' | 'notYet' (practice, challenge, checkpoint). value: the measured start (findStart).
 * inst: the slot instance it counts for, or null (extra practice).
 * Returns { error } or { record, talent, player, week, tickets, revealed, feedItems, view }.
 */
export function finishRecord({
  state, id, kind, talent, inst, result = null, value = null, checksMissed = [], now,
}) {
  const at = now.getTime();
  const today = dateKey(now);
  const p = state.player;
  const player = { ...p };
  const view = {
    kind, talentId: talent.id, passed: result === 'passed', congrats: [],
  };
  const feedItems = [];
  let companions = [];
  let t = { ...talent, challenge: { ...emptyChallenge(), ...(talent.challenge || {}) } };
  let recordValue = talent.target;
  let challengeRank = null;
  let gained = null;

  if (kind === 'practice') {
    const passed = result === 'passed';
    const r = applyPractice(t, passed, at);
    t = r.talent;
    Object.assign(view, {
      old: r.old, new: r.new, changed: r.changed, eased: r.eased,
    });
    if (passed) {
      const atGoal = talent.target === talent.goal;
      t.starPassesAtGoal = atGoal ? (talent.starPassesAtGoal || 0) + 1 : 0;
      const before = t.challenge.openRank;
      t.challenge = openAfterPass(t, talent.target, t.starPassesAtGoal);
      if (t.challenge.openRank === STAR && before !== STAR) t.starPassesAtGoal = 0;
      if (r.changed) {
        const e = maybeEndPlateau(t);
        t = e.talent;
        if (e.ended) view.congrats.push({ kind: 'C4', vars: { talent: t.name } });
      }
    } else {
      t.starPassesAtGoal = 0;
      if (r.eased) {
        const started = maybeStartPlateau(t, r.old, today);
        if (started !== t) view.plateauStarted = true;
        t = started;
      }
    }
    if (t.challenge.failedAt) t.challenge.practicedSinceFail = true;
  } else if (kind === 'quick') {
    recordValue = t.target !== null && t.target !== undefined ? t.target : t.estimate;
    if (t.challenge.failedAt) t.challenge = { ...t.challenge, practicedSinceFail: true };
  } else if (kind === 'findStart') {
    const r = applyFindStart(t, value);
    if (r.error) return { error: r.error };
    t = r.talent;
    recordValue = r.talent.target;
    view.startSet = { value: r.talent.target, n: r.n };
  } else if (kind === 'challenge') {
    challengeRank = t.challenge.openRank;
    recordValue = challengeValue(t, challengeRank);
    view.rankOld = rankLabel(talent);
    view.challengeValue = recordValue;
    if (result === 'passed') {
      gained = ranksGained(t, challengeRank);
      if (challengeRank === STAR) {
        t.stars = (t.stars || 0) + 1;
        view.star = t.stars;
      } else {
        t.rank = challengeRank;
      }
      view.gained = gained.filter((x) => x !== STAR);
      t.challenge = emptyChallenge();
      t.starPassesAtGoal = 0;
      player.mana = (player.mana || 0) + CONFIG.mana.perRank * gained.length;
      // A keepsake for each rank or star (spec 7.3, 5.14).
      player.keepsakes = [...(p.keepsakes || []), ...gained.map((r) => ({
        id: `${id}-${r}`, talentId: t.id, rank: r === STAR ? 'S' : r, stars: r === STAR ? t.stars : 0, date: today, placed: false,
      }))];
      if (rankIndex(t.rank) >= rankIndex('C') && !t.reachedCAt) {
        t.reachedCAt = today;
        player.talentSlots = (p.talentSlots || CONFIG.talentSlotsStart) + 1;
        view.slots = { old: p.talentSlots || CONFIG.talentSlotsStart, new: player.talentSlots };
      }
      if (!p.vaultUnlocked && rankIndex(t.rank) >= rankIndex('D')) {
        player.vaultUnlocked = true;
        view.vaultUnlocked = true;
      }
      view.rankNew = rankLabel(t);
      view.congrats.push({ kind: 'C2', vars: { talent: t.name, rank: rankLabel(t) } });
    } else {
      t.challenge = {
        ...t.challenge, failedAt: today, practicedSinceFail: false, lastAttemptDate: today,
      };
    }
    if (result === 'passed') t.challenge.lastAttemptDate = today;
  } else if (kind === 'checkpoint') {
    recordValue = t.target;
    t.plateau = { ...(t.plateau || {}), checkpointOffered: true };
  }
  view.talentAfter = t;
  view.next = t.target;
  view.preview = ['quick', 'checkpoint'].includes(kind) ? null : rankPreview(t);
  if (t.challenge && t.challenge.openRank && kind !== 'challenge') {
    view.preview = { key: t.challenge.openRank === STAR ? 'S211' : 'S180', vars: { rank: t.challenge.openRank } };
  }

  // EXP and Lv (spec 6.15), Gate x1.5 (6.14).
  const wk = weekKey(now);
  const gate = gateFor(state, wk) === talent.id;
  const exp = gate ? gateExp(CONFIG.exp[kind]) : CONFIG.exp[kind];
  view.gate = gate;
  const record = {
    id,
    talentId: talent.id,
    kind,
    slotInstance: inst ? inst.key : null,
    at,
    afterSlotEnd: inst ? at > inst.closes.getTime() : true,
    value: recordValue,
    result: ['practice', 'challenge', 'checkpoint'].includes(kind) ? result : null,
    checksMissed,
    gate,
    expGained: exp,
    crit: null,
  };
  if (kind === 'challenge') {
    record.challengeRank = challengeRank === STAR ? 'S' : challengeRank;
    record.star = challengeRank === STAR;
    record.ranksGained = gained ? gained.map((r) => (r === STAR ? 'S' : r)) : [];
  }
  const seen = new Set(p.seenExplanations || []);
  view.firstExp = !seen.has('S60');
  seen.add('S60');
  const newDay = !p.lastPracticedAt || dateKey(new Date(p.lastPracticedAt)) !== today;
  Object.assign(player, {
    totalExp: (p.totalExp || 0) + exp,
    lastPracticedAt: at,
    practiceDays: (p.practiceDays || 0) + (newDay ? 1 : 0),
    seenExplanations: [...seen],
  });
  view.exp = exp;
  view.expBefore = p.totalExp || 0;
  view.expAfter = player.totalExp;
  view.lvOld = levelFromExp(p.totalExp || 0);
  view.lvNew = levelFromExp(player.totalExp);

  // The first practice after a return ends it (C3, spec 6.16).
  if (p.returnActive) {
    player.returnActive = false;
    view.congrats.push({ kind: 'C3', vars: { talent: talent.name } });
  }

  const vault = Boolean(player.vaultUnlocked) && !(state.settings && state.settings.vaultOn === false);
  const counted = kind !== 'quick'; // Quick: no ticket, no critical hit, no release (spec 6.5)

  // Critical hit (spec 7.5): 1 in 5, seeded by the record.
  if (counted) {
    const r = makeRng(`${id}|${at}`);
    if (r() < CONFIG.crit.chance) {
      const ticket = player.vaultUnlocked && vault && r() >= CONFIG.crit.manaShareAfterUnlock;
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

  // Pending jackpot release (practice, challenge, Checkpoint), then draws revealed now (spec 7.8).
  view.vaultLines = [];
  let releaseLine = null;
  if (['practice', 'challenge', 'checkpoint'].includes(kind)) {
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
    view.congrats.unshift({ kind: 'C1', vars: { done: after.done, count: player.weeklyWins } });
    feedItems.push({
      date: today, time: hm(now), type: 'you', companionId: null, key: 'S18', vars: { done: after.done, planned: after.planned, count: player.weeklyWins },
    });
    // 5 more companions join with each weekly win (spec 7.9.1), even when companions are off.
    if (state.world) {
      const world = structuredClone(state.world);
      const start = world.global.startDay || dateKey(new Date(p.firstOpenedAt || at));
      const ids = joinNext(world, start, today);
      if (ids.length) {
        view.joined = ids.length;
        companions = world.companions.filter((c) => ids.includes(c.id));
        feedItems.push({
          date: today, time: hm(now), type: 'you', companionId: null, key: 'S135', vars: { count: ids.length },
        });
      }
    }
  }
  if (gained && gained.length) {
    feedItems.push({
      date: today, time: hm(now), type: 'you', companionId: null, key: 'S25', vars: { talent: t.name, rank: rankLabel(t), value: fmtValue(t, recordValue) },
    });
  }
  view.manaGained = (player.mana || 0) - (p.mana || 0);
  view.manaTotal = player.mana || 0;

  return {
    record, talent: t, player, week, tickets, revealed, feedItems, companions, view,
  };
}
