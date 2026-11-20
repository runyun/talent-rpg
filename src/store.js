// In-memory app state loaded from IndexedDB, plus write-through save helpers.
// The data set is small (a few talents, slots and sessions), so everything is kept in memory.

import { getAll, get, put, transact, PLAYER_ID } from './db.js';

export const state = {
  db: null,
  player: null,
  settings: null,
  talents: [],
  attrs: new Map(), // talentId -> [4 attributes]
  slots: [],
  sessions: [],
  weeks: new Map(), // weekStart -> week record
  openMetricId: null,
  startPressedThisOpen: false,
};

export async function loadState(db) {
  state.db = db;
  const [player, settings, talents, attributes, slots, sessions, weeks] = await Promise.all([
    get(db, 'player', PLAYER_ID),
    get(db, 'settings', 'main'),
    getAll(db, 'talents'),
    getAll(db, 'attributes'),
    getAll(db, 'slots'),
    getAll(db, 'sessions'),
    getAll(db, 'weeks'),
  ]);
  state.player = player;
  state.settings = settings;
  state.talents = talents.sort((a, b) => a.createdAt - b.createdAt);
  state.attrs = new Map();
  for (const a of attributes) {
    if (!state.attrs.has(a.talentId)) state.attrs.set(a.talentId, []);
    state.attrs.get(a.talentId)[a.index] = a;
  }
  state.slots = slots.sort((a, b) => a.createdAt - b.createdAt);
  state.sessions = sessions.sort((a, b) => a.startedAt - b.startedAt);
  state.weeks = new Map(weeks.map((w) => [w.weekStart, w]));
}

export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function talentById(id) {
  return state.talents.find((t) => t.id === id);
}

export function attrsOf(talentId) {
  return state.attrs.get(talentId) || [];
}

export function slotsOf(talentId) {
  return state.slots.filter((s) => s.talentId === talentId);
}

// ---- Writes ----

export async function savePlayer(player) {
  state.player = player;
  await put(state.db, 'player', player);
}

export async function saveAttribute(attr) {
  await put(state.db, 'attributes', attr);
  state.attrs.get(attr.talentId)[attr.index] = attr;
}

export async function saveTalent(talent) {
  await put(state.db, 'talents', talent);
  const i = state.talents.findIndex((t) => t.id === talent.id);
  if (i === -1) state.talents.push(talent);
  else state.talents[i] = talent;
}

export async function saveSlot(slot) {
  await put(state.db, 'slots', slot);
  const i = state.slots.findIndex((s) => s.id === slot.id);
  if (i === -1) state.slots.push(slot);
  else state.slots[i] = slot;
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
    weekStart: wk, planned: 0, done: 0, won: false, nextWeekConfirmed: false, anxiety: null, sameSlotsNoticeShown: false,
  };
}

/** Add a talent with its 4 attributes and slots in one transaction. */
export async function addTalent(talent, attributes, slots) {
  await transact(state.db, ['talents', 'attributes', 'slots'], (tx) => {
    tx.objectStore('talents').put(talent);
    for (const a of attributes) tx.objectStore('attributes').put(a);
    for (const s of slots) tx.objectStore('slots').put(s);
  });
  state.talents.push(talent);
  state.attrs.set(talent.id, attributes.slice());
  state.slots.push(...slots);
}

/** Delete a talent and everything that belongs to it (records and recordings). */
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
  state.attrs.delete(talentId);
  state.slots = state.slots.filter((s) => s.talentId !== talentId);
  state.sessions = state.sessions.filter((s) => s.talentId !== talentId);
}

/** Commit a finished session with all its effects in one transaction. */
export async function commitSession({ session, attr, player, week }) {
  await transact(state.db, ['sessions', 'attributes', 'player', 'weeks', 'meta'], (tx) => {
    tx.objectStore('sessions').put(session);
    if (attr) tx.objectStore('attributes').put(attr);
    tx.objectStore('player').put(player);
    if (week) tx.objectStore('weeks').put(week);
    tx.objectStore('meta').delete('activeSession');
  });
  state.sessions.push(session);
  if (attr) state.attrs.get(attr.talentId)[attr.index] = attr;
  state.player = player;
  if (week) state.weeks.set(week.weekStart, week);
}

// ---- Running session (survives the app being closed) ----

export async function saveActive(active) {
  await put(state.db, 'meta', { key: 'activeSession', value: active });
}

export async function loadActive() {
  const rec = await get(state.db, 'meta', 'activeSession');
  return rec ? rec.value : null;
}

export async function clearActive() {
  await transact(state.db, ['meta'], (tx) => tx.objectStore('meta').delete('activeSession'));
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
