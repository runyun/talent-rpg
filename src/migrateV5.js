// Data v4 (or v3) -> v5 (spec version 19, 4.13). Used by the upgrade in db.js.
// Rules: never lose user data. Fields that version 19 no longer uses are kept under `legacy`
// or left in place; nothing is deleted. Any error aborts the upgrade transaction, and IndexedDB
// keeps the old version with the old data.

import { mapOldTheme } from './themes.js';

const isNum = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'];
const atLeastC = (rank) => RANKS.indexOf(rank) >= RANKS.indexOf('C');

// Talent fields that version 19 no longer uses (spec 4.3).
const LEGACY_TALENT_FIELDS = [
  'startLevel', 'passesInRank', 'trialWork', 'trialMetric', 'trialMetricUnit', 'nextTrialDue',
  'retryAvailableAt', 'baselineDone', 'cycleStart', 'retryPending', 'failStreak', 'baselineNeeded',
];

function dateKeyOf(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** One talent (spec 4.13 item 1). */
export function talentToV5(t, trials, attributes, now) {
  if (t.schema === 5) return t;
  const legacy = {};
  const rest = {};
  for (const [k, v] of Object.entries(t)) {
    if (LEGACY_TALENT_FIELDS.includes(k)) legacy[k] = v;
    else rest[k] = v;
  }
  // Start and estimate: the latest trial value (baseline, trial, retry or awaken retest).
  const values = trials
    .filter((r) => r.talentId === t.id && isNum(r.value))
    .sort((a, b) => (a.at || 0) - (b.at || 0));
  const last = values.length ? Number(values[values.length - 1].value) : null;
  // Each attribute's current material becomes one Needs work item, e.g. "Fundamentals: G to C change".
  const needsWork = attributes
    .filter((a) => a && a.talentId === t.id && typeof a.material === 'string' && a.material.trim())
    .sort((a, b) => a.index - b.index)
    .map((a, i) => ({ id: `v5-${t.id}-${a.index}`, text: `${a.name}: ${a.material.trim()}`, createdAt: now + i }));
  const rank = RANKS.includes(t.rank) ? t.rank : 'E';
  return {
    ...rest,
    schema: 5,
    rank,
    stars: t.stars || 0,
    reachedCAt: t.reachedCAt || (atLeastC(rank) ? dateKeyOf(now) : null),
    focus: (t.trialWork && String(t.trialWork).trim()) || t.name,
    unit: (t.trialMetricUnit && String(t.trialMetricUnit).trim()) || '',
    wholeNumbers: true,
    estimate: last,
    start: last,
    goal: null,
    step: null,
    target: null,
    rankValues: null,
    passStreak: 0,
    missStreak: 0,
    lastPass: null,
    bounces: {},
    plateau: { active: false, since: null, checkpointOffered: false },
    challenge: {
      openRank: null, lastAttemptDate: null, failedAt: null, practicedSinceFail: false, askedFirst: [],
    },
    starPassesAtGoal: 0,
    checks: [],
    needsWork,
    fixed: [],
    needsSetup: true,
    findStart: null,
    legacy,
  };
}

/** The player (spec 4.13 items 7 and 9). talents: the talents after migration. */
export function playerToV5(p, talents) {
  if (p.schema === 5) return p;
  const { magicStones, ...rest } = p;
  const reachedC = talents.filter((t) => t.reachedCAt || atLeastC(t.rank)).length;
  const running = talents.filter((t) => t.role === 'main' || t.role === 'maintain').length;
  const owned = p.owned || {};
  const equipped = p.equipped || {};
  const themes = ['mono'];
  for (const code of owned.themes || []) {
    const id = mapOldTheme(code);
    if (id && !themes.includes(id)) themes.push(id);
  }
  return {
    ...rest,
    schema: 5,
    mana: (p.mana || 0) + (magicStones || 0),
    talentSlots: Math.max(2 + reachedC, running),
    gate: [],
    freeLogbookUsed: false,
    owned: { ...owned, themes, keepsakes: owned.keepsakes || [] },
    equipped: { ...equipped, theme: mapOldTheme(equipped.theme) || 'mono' },
  };
}

/** A practice record (spec 4.13 item 4): old fields stay; Mini becomes Quick. */
export function sessionToV5(s) {
  if (s.kind) return s;
  return {
    ...s,
    kind: s.size === 'mini' ? 'quick' : 'practice',
    at: s.endedAt || s.startedAt,
    value: null,
    result: null,
    afterSlotEnd: s.afterSlot === undefined ? null : s.afterSlot,
    checksMissed: [],
    gate: false,
  };
}

/** A slot (spec 4.13 item 3): no length; createdAt = migration time - 7 days. */
export function slotToV5(s, now) {
  if (s.schema === 5) return s;
  const { length, ...rest } = s;
  return {
    ...rest, schema: 5, createdAt: now - 7 * 86400000, legacy: { length, createdAt: s.createdAt },
  };
}

/**
 * The upgrade step. Only uses the given db / tx (no other async work, or the transaction closes).
 * updateAll(tx, store, fn) rewrites every record of a store.
 */
export function migrateV4toV5(db, tx, updateAll, now = Date.now(), finishPlayer = null) {
  db.createObjectStore('logbooks', { keyPath: 'id' });

  const step = (fn) => (event) => {
    try {
      fn(event.target.result);
    } catch (err) {
      console.error('Migration to v5 failed', err);
      tx.abort();
    }
  };

  tx.objectStore('trials').getAll().onsuccess = step((trials) => {
    tx.objectStore('attributes').getAll().onsuccess = step((attributes) => {
      tx.objectStore('talents').getAll().onsuccess = step((talents) => {
        const next = talents.map((t) => talentToV5(t, trials, attributes, now));
        for (const t of next) tx.objectStore('talents').put(t);
        tx.objectStore('player').getAll().onsuccess = step((players) => {
          for (const p of players) {
            const v5 = playerToV5(p, next);
            tx.objectStore('player').put(finishPlayer ? finishPlayer(v5) : v5);
          }
        });
      });
    });
  });
  updateAll(tx, 'slots', (s) => slotToV5(s, now));
  updateAll(tx, 'sessions', sessionToV5);
  // Attributes, trials, recordings, feed and companion records stay as they are (4.13 items 2, 5, 6, 8).
}
