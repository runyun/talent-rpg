// In-memory app state loaded from IndexedDB, plus write-through save helpers.
// The data set is small (a few talents, slots and records), so everything is kept in memory.

import {
  getAll, get, put, transact, PLAYER_ID,
} from './db.js';
import { dateKey } from './time.js';
import { recordAt } from './model/schedule.js';

export const state = {
  db: null,
  player: null,
  settings: null,
  talents: [],
  slots: [],
  sessions: [], // practice records (spec 4.5), oldest first
  weeks: new Map(), // weekStart -> week record
  trials: [], // trial records from before data v5 (read only, spec 4.6)
  media: [], // recordings from before data v5 (play or delete only, spec 4.8)
  world: null, // companions: { global, companions: [30 states] }
  feed: [], // feed items of the last days
  vault: null, // { id: 'state', startDraw, lastDraw, carry, ticketedThrough }
  tickets: [],
  draws: [],
  openMetricId: null,
  openedAt: 0,
};

export async function loadState(db) {
  state.db = db;
  const [player, settings, talents, slots, sessions, weeks, trials, media] = await Promise.all([
    get(db, 'player', PLAYER_ID),
    get(db, 'settings', 'main'),
    getAll(db, 'talents'),
    getAll(db, 'slots'),
    getAll(db, 'sessions'),
    getAll(db, 'weeks'),
    getAll(db, 'trials'),
    getAll(db, 'media'),
  ]);
  state.player = player;
  state.settings = settings;
  state.talents = talents.sort((a, b) => a.createdAt - b.createdAt);
  state.slots = slots.sort((a, b) => a.createdAt - b.createdAt);
  state.sessions = sessions.sort((a, b) => recordAt(a) - recordAt(b));
  state.weeks = new Map(weeks.map((w) => [w.weekStart, w]));
  state.trials = trials.sort((a, b) => (a.at || 0) - (b.at || 0));
  state.media = media.sort((a, b) => a.createdAt - b.createdAt);
  await loadWorld();
  const [vaultRecs, tickets, draws] = await Promise.all([getAll(db, 'vault'), getAll(db, 'tickets'), getAll(db, 'draws')]);
  state.vault = vaultRecs.find((r) => r.id === 'state') || null;
  state.tickets = tickets;
  state.draws = draws.sort((a, b) => a.draw - b.draw);
}

export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function talentById(id) {
  return state.talents.find((t) => t.id === id);
}

export function slotsOf(talentId) {
  return state.slots.filter((s) => s.talentId === talentId);
}

export function recordsOf(talentId) {
  return state.sessions.filter((s) => s.talentId === talentId);
}

// ---- Writes ----

function replaceIn(list, item, key = 'id') {
  const i = list.findIndex((x) => x[key] === item[key]);
  if (i === -1) list.push(item);
  else list[i] = item;
}

export async function savePlayer(player) {
  await put(state.db, 'player', player);
  state.player = player;
}

export async function saveTalent(talent) {
  await put(state.db, 'talents', talent);
  replaceIn(state.talents, talent);
}

export async function saveSlot(slot) {
  await put(state.db, 'slots', slot);
  replaceIn(state.slots, slot);
}

export async function deleteSlot(slotId) {
  await transact(state.db, ['slots'], (tx) => tx.objectStore('slots').delete(slotId));
  state.slots = state.slots.filter((s) => s.id !== slotId);
}

export async function saveWeek(week) {
  await put(state.db, 'weeks', week);
  state.weeks.set(week.weekStart, week);
}

export function weekRecord(wk) {
  return state.weeks.get(wk) || {
    weekStart: wk, planned: 0, done: 0, passes: 0, won: false, nextWeekConfirmed: false, anxiety: null,
  };
}

/** Add a talent with its slots in one transaction. */
export async function addTalent(talent, slots) {
  await transact(state.db, ['talents', 'slots'], (tx) => {
    tx.objectStore('talents').put(talent);
    for (const s of slots) tx.objectStore('slots').put(s);
  });
  state.talents.push(talent);
  state.slots.push(...slots);
}

/** Delete a talent and everything that belongs to it (records, trials, recordings, slots). */
export async function deleteTalent(talentId) {
  const byTalent = ['sessions', 'trials', 'media', 'attributes', 'slots'];
  const keys = {};
  for (const store of byTalent) {
    // eslint-disable-next-line no-await-in-loop
    keys[store] = (await getAll(state.db, store, 'talentId', talentId)).map((r) => (store === 'attributes' ? [r.talentId, r.index] : r.id));
  }
  await transact(state.db, ['talents', ...byTalent], (tx) => {
    tx.objectStore('talents').delete(talentId);
    for (const store of byTalent) for (const k of keys[store]) tx.objectStore(store).delete(k);
  });
  state.talents = state.talents.filter((t) => t.id !== talentId);
  state.slots = state.slots.filter((s) => s.talentId !== talentId);
  state.sessions = state.sessions.filter((s) => s.talentId !== talentId);
  state.trials = state.trials.filter((t) => t.talentId !== talentId);
  state.media = state.media.filter((m) => m.talentId !== talentId);
}

/** Save changed talents, slots and the player together. */
export async function applyUpdates({ talents = [], slots = [], player = null }) {
  if (!talents.length && !slots.length && !player) return;
  await transact(state.db, ['talents', 'slots', 'player'], (tx) => {
    for (const t of talents) tx.objectStore('talents').put(t);
    for (const s of slots) tx.objectStore('slots').put(s);
    if (player) tx.objectStore('player').put(player);
  });
  for (const t of talents) replaceIn(state.talents, t);
  for (const s of slots) replaceIn(state.slots, s);
  if (player) state.player = player;
}

// ---- Practice records and Undo (spec 5.3.2) ----

/**
 * Commit a finished practice with all its effects in one transaction.
 * Returns an undo snapshot: everything needed to put the data back as it was.
 */
export async function commitRecord({
  record, talent, player, week, tickets = [], revealed = [], feedItems = [],
}) {
  const snapshot = {
    recordId: record.id,
    talent: talent ? structuredClone(talentById(talent.id)) : null,
    player: structuredClone(state.player),
    week: week && state.weeks.has(week.weekStart) ? structuredClone(state.weeks.get(week.weekStart)) : null,
    weekStart: week ? week.weekStart : null,
    draws: revealed.map((d) => structuredClone(state.draws.find((x) => x.draw === d.draw))).filter(Boolean),
    ticketIds: [],
    feedIds: [],
  };
  await transact(state.db, ['sessions', 'talents', 'player', 'weeks', 'tickets', 'draws', 'feed'], (tx) => {
    tx.objectStore('sessions').put(record);
    if (talent) tx.objectStore('talents').put(talent);
    tx.objectStore('player').put(player);
    if (week) tx.objectStore('weeks').put(week);
    for (const t of tickets) {
      const req = tx.objectStore('tickets').add(t);
      req.onsuccess = () => snapshot.ticketIds.push(req.result);
    }
    for (const d of revealed) tx.objectStore('draws').put(d);
    for (const f of feedItems) {
      const req = tx.objectStore('feed').add(f);
      req.onsuccess = () => { snapshot.feedIds.push(req.result); };
    }
  });
  tickets.forEach((t, i) => state.tickets.push({ ...t, id: snapshot.ticketIds[i] }));
  for (const d of revealed) replaceIn(state.draws, d, 'draw');
  state.sessions.push(record);
  if (talent) replaceIn(state.talents, talent);
  state.player = player;
  if (week) state.weeks.set(week.weekStart, week);
  feedItems.forEach((f, i) => state.feed.push({ ...f, id: snapshot.feedIds[i] }));
  return snapshot;
}

/** Undo a committed practice: everything goes back; revealed draws become unrevealed again. */
export async function undoRecord(snapshot) {
  await transact(state.db, ['sessions', 'talents', 'player', 'weeks', 'tickets', 'draws', 'feed'], (tx) => {
    tx.objectStore('sessions').delete(snapshot.recordId);
    if (snapshot.talent) tx.objectStore('talents').put(snapshot.talent);
    tx.objectStore('player').put(snapshot.player);
    if (snapshot.week) tx.objectStore('weeks').put(snapshot.week);
    else if (snapshot.weekStart) tx.objectStore('weeks').delete(snapshot.weekStart);
    for (const id of snapshot.ticketIds) tx.objectStore('tickets').delete(id);
    for (const d of snapshot.draws) tx.objectStore('draws').put(d);
    for (const fid of snapshot.feedIds) tx.objectStore('feed').delete(fid);
  });
  state.sessions = state.sessions.filter((s) => s.id !== snapshot.recordId);
  if (snapshot.talent) replaceIn(state.talents, snapshot.talent);
  state.player = snapshot.player;
  if (snapshot.week) state.weeks.set(snapshot.weekStart, snapshot.week);
  else if (snapshot.weekStart) state.weeks.delete(snapshot.weekStart);
  const dropped = new Set(snapshot.ticketIds);
  state.tickets = state.tickets.filter((t) => !dropped.has(t.id));
  for (const d of snapshot.draws) replaceIn(state.draws, d, 'draw');
  const feedGone = new Set(snapshot.feedIds);
  state.feed = state.feed.filter((x) => !feedGone.has(x.id));
}

// ---- Old recordings (spec 4.8) ----

export async function deleteMedia(id) {
  await transact(state.db, ['media'], (tx) => tx.objectStore('media').delete(id));
  state.media = state.media.filter((m) => m.id !== id);
}

// ---- Companions ----

const FEED_DAYS = 8;

export async function loadWorld() {
  const records = await getAll(state.db, 'companionState');
  const global = records.find((r) => r.id === 'global');
  state.world = global
    ? { global, companions: records.filter((r) => r.id !== 'global').sort((a, b) => a.id - b.id) }
    : null;
  await loadFeed();
}

export async function loadFeed() {
  const from = new Date();
  from.setDate(from.getDate() - FEED_DAYS);
  state.feed = await getAll(state.db, 'feed', 'date', IDBKeyRange.lowerBound(dateKey(from)));
}

/** Save the simulated world and the new feed items in one transaction. */
export async function saveWorld(world, items) {
  await transact(state.db, ['companionState', 'feed'], (tx) => {
    const cs = tx.objectStore('companionState');
    cs.put(world.global);
    for (const c of world.companions) cs.put(c);
    const feed = tx.objectStore('feed');
    for (const it of items) feed.add(it);
  });
  state.world = world;
  await loadFeed();
}

/** All companion practice items since a date (for vault tickets; the in-memory feed only keeps 8 days). */
export async function practicesSince(dateKeyExclusive) {
  const items = await getAll(state.db, 'feed', 'date', IDBKeyRange.lowerBound(dateKeyExclusive, true));
  return items.filter((x) => x.type === 'practice');
}

/** Save the vault catch-up: new companion tickets, computed draws, vault state, feed items. */
export async function saveVaultCatchUp({
  vault, newTickets, draws, feedItems,
}) {
  const ids = [];
  await transact(state.db, ['vault', 'tickets', 'draws', 'feed'], (tx) => {
    tx.objectStore('vault').put(vault);
    for (const t of newTickets) {
      const req = tx.objectStore('tickets').add(t);
      req.onsuccess = () => ids.push(req.result);
    }
    for (const d of draws) tx.objectStore('draws').put(d);
    for (const f of feedItems) tx.objectStore('feed').add(f);
  });
  newTickets.forEach((t, i) => state.tickets.push({ ...t, id: ids[i] }));
  state.draws.push(...draws);
  state.vault = vault;
  if (feedItems.length) await loadFeed();
}

export async function saveSettings(settings) {
  await put(state.db, 'settings', settings);
  state.settings = settings;
}

// ---- Reset all data (spec 5.10.1) ----

/**
 * Delete every record in one transaction (all or nothing). The schema version stays, so the
 * next start is a first open. Throws when it did not finish; then nothing was deleted.
 */
export async function resetAllData() {
  const db = state.db;
  const stores = [...db.objectStoreNames];
  await transact(db, stores, (tx) => {
    for (const name of stores) tx.objectStore(name).clear();
    if (stores.includes('meta')) tx.objectStore('meta').put({ key: 'schemaVersion', value: db.version, migratedAt: Date.now() });
  });
}

// ---- Validation metrics (spec 4.12) ----

export async function addMetric(record) {
  try {
    return await put(state.db, 'metrics', record);
  } catch {
    return null;
  }
}

export async function updateOpenMetric(patch) {
  if (!state.openMetricId) return;
  try {
    const rec = await get(state.db, 'metrics', state.openMetricId);
    if (rec) await put(state.db, 'metrics', { ...rec, ...patch });
  } catch {
    // metrics must never break the app
  }
}
