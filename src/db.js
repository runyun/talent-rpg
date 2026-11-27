// IndexedDB storage with versioned schema and step-by-step migrations.
//
// Conventions:
// - Times are stored as epoch milliseconds (numbers). Calendar dates are local 'YYYY-MM-DD' strings.
// - Stored values use codes (e.g. role: 'main'); labels come from strings.js at display time.
//
// Migrations:
// - MIGRATIONS[i] upgrades schema version i to i + 1. They run in order inside the single
//   IndexedDB upgrade transaction, so v1 -> v2 -> v3 -> v4 -> v5 can chain.
// - If any step throws or a request fails, the whole upgrade transaction aborts and IndexedDB
//   rolls back to the old version with the old data untouched. Never "drop and rebuild".
// - A migration may only use the given `db` / `tx` (no other async work, or the transaction closes).

import { migrateV4toV5 } from './migrateV5.js';
import { migrateV5toV6, playerToV6, ROOM_DEFAULTS } from './migrateV6.js';

export const DB_NAME = 'talent-rpg';

function createStores_v1(db) {
  db.createObjectStore('meta', { keyPath: 'key' });
  db.createObjectStore('player', { keyPath: 'id' });
  db.createObjectStore('settings', { keyPath: 'id' });

  const talents = db.createObjectStore('talents', { keyPath: 'id' });
  talents.createIndex('role', 'role');

  const attributes = db.createObjectStore('attributes', { keyPath: ['talentId', 'index'] });
  attributes.createIndex('talentId', 'talentId');

  const slots = db.createObjectStore('slots', { keyPath: 'id' });
  slots.createIndex('talentId', 'talentId');

  const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
  sessions.createIndex('talentId', 'talentId');
  sessions.createIndex('startedAt', 'startedAt');

  const trials = db.createObjectStore('trials', { keyPath: 'id' });
  trials.createIndex('talentId', 'talentId');

  const media = db.createObjectStore('media', { keyPath: 'id' });
  media.createIndex('talentId', 'talentId');

  db.createObjectStore('weeks', { keyPath: 'weekStart' });

  db.createObjectStore('companionState', { keyPath: 'id' });
  const feed = db.createObjectStore('feed', { keyPath: 'id', autoIncrement: true });
  feed.createIndex('date', 'date');

  const tickets = db.createObjectStore('tickets', { keyPath: 'id', autoIncrement: true });
  tickets.createIndex('draw', 'draw');
  db.createObjectStore('draws', { keyPath: 'draw' });
  db.createObjectStore('vault', { keyPath: 'id' });

  const metrics = db.createObjectStore('metrics', { keyPath: 'id', autoIncrement: true });
  metrics.createIndex('type', 'type');
}

/**
 * Update every record of a store inside the upgrade transaction.
 * fn(record) returns the new record. Any error aborts the whole upgrade (full rollback).
 */
function updateAll(tx, storeName, fn) {
  const store = tx.objectStore(storeName);
  store.openCursor().onsuccess = (event) => {
    const cursor = event.target.result;
    if (!cursor) return;
    try {
      cursor.update(fn(cursor.value));
      cursor.continue();
    } catch (err) {
      console.error('Migration failed', err);
      tx.abort();
    }
  };
}

// 1 -> 2 (stage 3): fields for trial cycles, plateau and the return card.
function migrate_v1_v2(db, tx) {
  updateAll(tx, 'talents', (t) => ({
    ...t,
    cycleStart: t.cycleStart || t.roleSince, // trial cycle counts from here (spec 7.1)
    retryPending: t.retryPending || false, // one retry allowed after a failed trial
    failStreak: t.failStreak || 0, // failed trials in a row (plateau trigger)
    baselineNeeded: t.baselineNeeded || false, // new trial piece needs a new baseline
  }));
  updateAll(tx, 'attributes', (a) => ({
    ...a,
    plateau: a.plateau || null, // { method: 5|6|7, start, end } while in the Plateau Dungeon
    plateauCount: a.plateauCount || 0, // rotates the method 5 -> 6 -> 7
    plateauEndedAt: a.plateauEndedAt || null,
    plateauEndShown: a.plateauEndShown || false,
  }));
  updateAll(tx, 'player', (p) => ({
    ...p,
    returnHandledFor: p.returnHandledFor || null, // lastPracticedAt the return card was handled for
    returnActive: p.returnActive || false,
    plateauCheckedWeek: p.plateauCheckedWeek || null,
  }));
}

// 2 -> 3 (stage 4): companions.
function migrate_v2_v3(db, tx) {
  updateAll(tx, 'attributes', (a) => ({
    ...a,
    breakthroughShown: a.breakthroughShown || false, // C4 congratulation given for the last plateau
  }));
  updateAll(tx, 'player', (p) => ({
    ...p,
    companionsGreeted: p.companionsGreeted || false, // C5 first meeting shown
  }));
  updateAll(tx, 'settings', (s) => ({
    ...s,
    companionsOn: s.companionsOn !== false,
  }));
}

/** MIGRATIONS[i]: (db, tx) => void, upgrades version i to i + 1. */
export const MIGRATIONS = [
  // 0 -> 1: first schema
  (db) => createStores_v1(db),
  // 1 -> 2: trial / plateau / return fields
  migrate_v1_v2,
  // 2 -> 3: companion fields
  migrate_v2_v3,
  // 3 -> 4: spec version 17 (data v4) was never shipped; nothing changes.
  () => {},
  // 4 -> 5: version 19 practice model (migrateV5.js)
  // When the same upgrade goes on to v6, the v5 player is finished as v6 right away
  // (its request runs after the v6 step's own read; see migrateV6.js).
  (db, tx, ctx) => migrateV4toV5(db, tx, updateAll, Date.now(), ctx && ctx.to >= 6 ? playerToV6 : null),
  // 5 -> 6: version 20, badges retired, finish effects, room, stories (migrateV6.js)
  migrateV5toV6,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

/**
 * Open the database and run any pending migrations.
 * name / migrations are parameters so tests can use a separate database.
 */
export function openDb({ name = DB_NAME, migrations = MIGRATIONS } = {}) {
  const version = migrations.length;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    let migrationError = null;
    let upgradingDb = null;

    req.onupgradeneeded = (event) => {
      const db = req.result;
      upgradingDb = db;
      const tx = req.transaction;
      const from = event.oldVersion;
      try {
        for (let v = from; v < version; v += 1) {
          migrations[v](db, tx, { from, to: version });
        }
        if (db.objectStoreNames.contains('meta')) {
          tx.objectStore('meta').put({ key: 'schemaVersion', value: version, migratedAt: Date.now() });
        }
      } catch (err) {
        // Abort the upgrade transaction: everything rolls back to the old version and data.
        migrationError = err;
        tx.abort();
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      // Another copy of the app wants a newer schema: let it upgrade.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = (event) => {
      if (event && event.preventDefault) event.preventDefault();
      // Close the connection from the failed upgrade so a later open is not blocked by it.
      try {
        if (upgradingDb) upgradingDb.close();
      } catch {
        // already closed
      }
      reject(migrationError || req.error || new Error('IndexedDB open failed'));
    };
    req.onblocked = () => reject(new Error('IndexedDB upgrade blocked'));
  });
}

// ---- Small promise helpers ----

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function get(db, store, key) {
  return promisify(db.transaction(store).objectStore(store).get(key));
}

export function getAll(db, store, indexName, query) {
  const os = db.transaction(store).objectStore(store);
  const src = indexName ? os.index(indexName) : os;
  return promisify(src.getAll(query));
}

export function put(db, store, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

/** Run fn(tx) in one readwrite transaction over several stores; resolves when committed. */
export function transact(db, stores, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite');
    let result;
    try {
      result = fn(tx);
    } catch (err) {
      tx.abort();
      reject(err);
      return;
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

/** Ask the browser to keep our data (spec section 2). Ignored where unsupported. */
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch {
    // ignore
  }
  return false;
}

// ---- Startup records ----

export const PLAYER_ID = 'me';
export const SETTINGS_ID = 'main';

export function defaultPlayer(now) {
  return {
    id: PLAYER_ID,
    schema: 6,
    firstOpenedAt: now,
    lastOpenedAt: now,
    lastPracticedAt: null,
    totalExp: 0,
    mana: 0,
    vaultUnlocked: false,
    pendingPrize: { total: 0, remaining: 0 },
    owned: {
      themes: ['mono'], titleFrames: ['none'], legendaryTitles: [], keepsakes: [], finishEffects: ['check'],
      room: Object.values(ROOM_DEFAULTS).filter((c) => c !== 'none'), stories: [],
    },
    equipped: {
      theme: 'mono', titleFrame: 'none', title: null, finishEffect: 'check', room: { ...ROOM_DEFAULTS },
    },
    weeklyWins: 0,
    practiceDays: 0,
    talentSlots: 2,
    badgeRefund: 0,
    keepsakes: [],
    gate: [],
    onboardingDone: false,
    seenExplanations: [],
    freeLogbookUsed: false,
    companionsGreeted: false,
  };
}

export function defaultSettings() {
  return { id: SETTINGS_ID, companionsOn: true, vaultOn: true, luckyNumbers: null };
}

/** Create player/settings on first open, update lastOpenedAt otherwise. Returns { player, settings }. */
export async function touchOpen(db, now = Date.now()) {
  let player = await get(db, 'player', PLAYER_ID);
  let settings = await get(db, 'settings', SETTINGS_ID);
  await transact(db, ['player', 'settings'], (tx) => {
    player = player ? { ...player, lastOpenedAt: now } : defaultPlayer(now);
    tx.objectStore('player').put(player);
    if (!settings) {
      settings = defaultSettings();
      tx.objectStore('settings').put(settings);
    }
  });
  return { player, settings };
}
