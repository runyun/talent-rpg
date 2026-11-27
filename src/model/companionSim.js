// Companion world simulation (spec 7.9), feed selection (7.11) and congratulations (7.10).
//
// Each day is computed from the state at the end of the previous day plus random numbers seeded by
// the date (and companion id). Catching up 30 days at once therefore gives exactly the same result
// as opening the app every day (acceptance 7). Companions never react to what you do.

import { CONFIG } from '../config.js';
import { COMPANIONS, EVENTS } from '../data/companions.js';
import { makeRng, pick, randInt, sample } from '../rng.js';
import { addDays, dateKey, fromDateKey } from '../time.js';

const RANKS = CONFIG.ranks;
const RANDOM_EVENTS = ['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08', 'E09', 'E10'];
const PRACTICE_MINUTES = [15, 15, 30, 45];

const nextDay = (key) => dateKey(addDays(fromDateKey(key), 1));
const plusDays = (key, n) => dateKey(addDays(fromDateKey(key), n));
const isDown = (key) => EVENTS[key] && EVENTS[key].kind === 'down';

// ---- Joining in batches (spec 7.9.1) ----

/** The order companions join: the first 3 always, then the rest shuffled by the first-open day. */
export function joinOrder(startDay) {
  const rest = COMPANIONS.map((c) => c.id).filter((id) => id > 3);
  return [1, 2, 3, ...sample(makeRng(`join|${startDay}`), rest, rest.length)];
}

const firstBatch = () => CONFIG.companions.joinFirst;

/** Fresh world state, starting the day the app was first opened: 10 companions join. */
export function initialWorld(startDay) {
  const joined = new Set(joinOrder(startDay).slice(0, firstBatch()));
  const companions = COMPANIONS.map((c) => ({
    id: c.id, rank: c.startRank, rankSince: startDay, rankDays: 0, event: null, joinedAt: joined.has(c.id) ? startDay : null, rankLog: [],
  }));
  return {
    global: { id: 'global', simulatedThrough: plusDays(startDay, -1), longWeekendEnd: null, startDay },
    companions,
  };
}

/**
 * Worlds from before batches: the first 10, plus 5 for each weekly win so far, count as joined
 * from the first-open day. Changes the world in place; returns true when something changed.
 */
export function ensureJoined(world, startDay, weeklyWins) {
  if (world.companions.every((s) => s.joinedAt !== undefined)) return false;
  const n = Math.min(COMPANIONS.length, firstBatch() + CONFIG.companions.joinPerWin * (weeklyWins || 0));
  const joined = new Set(joinOrder(startDay).slice(0, n));
  for (const s of world.companions) {
    if (s.joinedAt === undefined) s.joinedAt = joined.has(s.id) ? startDay : null;
    if (!s.rankLog) s.rankLog = [];
  }
  world.global.startDay = world.global.startDay || startDay;
  return true;
}

/** After a weekly win: the next 5 join today. Returns their ids (changes the world in place). */
export function joinNext(world, startDay, day) {
  const waiting = joinOrder(startDay).filter((id) => !world.companions[id - 1].joinedAt);
  const ids = waiting.slice(0, CONFIG.companions.joinPerWin);
  for (const id of ids) world.companions[id - 1].joinedAt = day;
  return ids;
}

export const isJoined = (s, day) => Boolean(s && s.joinedAt && s.joinedAt <= day);

/** Simulate one day in place. Returns the feed items of that day. */
export function simulateDay(day, world) {
  const items = [];
  const cfg = CONFIG.companions;
  const g = world.global;

  // Whole-world events: long weekend (3 days) and typhoon day (July-September).
  const gr = makeRng(`${day}|global`);
  let globalMult = 1;
  const longWeekendActive = g.longWeekendEnd && day < g.longWeekendEnd;
  if (!longWeekendActive && gr() < cfg.longWeekendChancePerDay) {
    g.longWeekendEnd = plusDays(day, EVENTS.E14.days[0]);
    items.push({ date: day, time: '00:00', type: 'event', companionId: null, key: 'E14', variant: gr() < 0.5 ? 0 : 1 });
  }
  if (g.longWeekendEnd && day < g.longWeekendEnd) globalMult *= EVENTS.E14.multiplier;
  const month = fromDateKey(day).getMonth() + 1;
  if (cfg.typhoonMonths.includes(month) && gr() < cfg.typhoonChancePerDay) {
    globalMult *= EVENTS.E15.multiplier;
    items.push({ date: day, time: '00:00', type: 'event', companionId: null, key: 'E15', variant: gr() < 0.5 ? 0 : 1 });
  }

  // End events whose time is over (return / breakthrough on that day).
  for (const s of world.companions) {
    if (s.event && day >= s.event.end) {
      if (isDown(s.event.key)) items.push({ date: day, time: '00:00', type: 'return', companionId: s.id, key: 'E13', variant: makeRng(`${day}|${s.id}|back`)() < 0.5 ? 0 : 1 });
      if (s.event.key === 'E10') items.push({ date: day, time: '00:00', type: 'breakthrough', companionId: s.id, key: 'E11', variant: makeRng(`${day}|${s.id}|back`)() < 0.5 ? 0 : 1 });
      s.event = null;
    }
  }
  let downCount = world.companions.filter((s) => s.event && isDown(s.event.key)).length;

  for (const c of COMPANIONS) {
    const s = world.companions[c.id - 1];
    if (s.joinedAt !== undefined && !isJoined(s, day)) continue; // not joined yet: not simulated
    const r = makeRng(`${day}|${c.id}`);

    // New event?
    if (!s.event && r() < cfg.eventChancePerDay) {
      const key = pick(r, RANDOM_EVENTS);
      const def = EVENTS[key];
      const days = randInt(r, def.days[0], def.days[1]);
      const variant = r() < 0.5 ? 0 : 1;
      if (!(isDown(key) && downCount >= cfg.maxDownEventsAtOnce)) {
        s.event = { key, start: day, end: plusDays(day, days) };
        if (isDown(key)) downCount += 1;
        items.push({ date: day, time: '00:00', type: 'event', companionId: c.id, key, variant });
      }
    }

    // Practiced today?
    const ev = s.event ? EVENTS[s.event.key] : null;
    const chance = Math.min(cfg.attendanceCap, c.attendance * (ev ? ev.multiplier : 1) * globalMult);
    const practiced = r() < chance;
    const minutes = pick(r, PRACTICE_MINUTES);
    const variant = r() < 0.5 ? 0 : 1;
    if (!practiced) continue;
    items.push({ date: day, time: c.preferredTime, type: 'practice', companionId: c.id, key: 'E16', variant, vars: { min: minutes } });

    // Growth (paused during a plateau; faster with a new teacher; capped at Rank B).
    if (ev && ev.growthPaused) continue;
    // Fast growers can reach S, each rank from B on taking twice as long; others stop at B.
    const cap = c.growth === 'fast' ? 'S' : cfg.maxRank;
    if (RANKS.indexOf(s.rank) >= RANKS.indexOf(cap)) continue;
    s.rankDays += ev && ev.growthBoost ? cfg.newTeacherGrowthBoost : 1;
    const slow = RANKS.indexOf(s.rank) >= RANKS.indexOf('B') ? cfg.highRankWeeksFactor : 1;
    const need = cfg.growthWeeks[c.growth] * 7 * c.attendance * slow;
    if (s.rankDays >= need) {
      s.rank = RANKS[RANKS.indexOf(s.rank) + 1];
      s.rankDays = 0;
      s.rankSince = day;
      s.rankLog = [...(s.rankLog || []), { date: day, rank: s.rank }].slice(-CONFIG.companions.rankLogMax);
      items.push({ date: day, time: c.preferredTime, type: 'rankUp', companionId: c.id, key: 'E12', variant, vars: { rank: s.rank } });
    }
  }
  g.simulatedThrough = day;
  return items;
}

/** Simulate from the day after simulatedThrough up to and including today. Returns new feed items. */
export function catchUp(world, today) {
  const items = [];
  for (let day = nextDay(world.global.simulatedThrough); day <= today; day = nextDay(day)) {
    items.push(...simulateDay(day, world));
  }
  return items;
}

// ---- Feed (spec 7.11) ----

const ORDER = ['you', 'event', 'jackpot', 'rankUp', 'breakthrough', 'return'];

/** Up to 10 items for one day: your milestones, events, rank-ups, returns, then random practices. */
export function selectFeed(items, day) {
  const limit = CONFIG.feed.perDay;
  const out = [];
  for (const type of ORDER) {
    for (const it of items.filter((x) => x.type === type)) if (out.length < limit) out.push(it);
  }
  const practices = items.filter((x) => x.type === 'practice');
  out.push(...sample(makeRng(`${day}|feed`), practices, limit - out.length));
  return out.sort((a, b) => b.time.localeCompare(a.time) || (a.companionId || 0) - (b.companionId || 0));
}

// ---- Congratulations (spec 7.10) ----

/**
 * 1-3 companions who practiced today and are not in a down event, chosen by seed.
 * todayItems: feed items of today; world: current state.
 */
export function congratulators(seedText, todayItems, world) {
  const practiced = new Set(todayItems.filter((x) => x.type === 'practice').map((x) => x.companionId));
  const eligible = COMPANIONS.filter((c) => {
    const s = world.companions[c.id - 1];
    return practiced.has(c.id) && !(s.event && isDown(s.event.key));
  });
  if (!eligible.length) return [];
  const r = makeRng(seedText);
  const n = randInt(r, CONFIG.companions.congratsMin, CONFIG.companions.congratsMax);
  return sample(r, eligible, n);
}

/** Days practiced in the last 7 days (oldest first), from practice items. */
export function lastSevenDays(companionId, items, today) {
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = plusDays(today, -i);
    days.push({ day, practiced: items.some((x) => x.date === day && x.companionId === companionId && x.type === 'practice') });
  }
  return days;
}
