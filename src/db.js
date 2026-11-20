// IndexedDB storage with versioned schema and step-by-step migrations.
//
// Conventions:
// - Times are stored as epoch milliseconds (numbers). Calendar dates are local 'YYYY-MM-DD' strings.
// - Stored values use codes (e.g. role: 'main'); labels come from strings.js at display time.
//
// Migrations:
// - MIGRATIONS[i] upgrades schema version i to i + 1. They run in order inside the single
//   IndexedDB upgrade transaction, so v1 -> v2 -> v3 can chain.
// - If any step throws or a request fails, the whole upgrade transaction aborts and IndexedDB
//   rolls back to the old version with the old data untouched. Never "drop and rebuild".
// - A migration may only use the given `db` / `tx` (no other async work, or the transaction closes).

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

/** MIGRATIONS[i]: (db, tx) => void, upgrades version i to i + 1. */
export const MIGRATIONS = [
  // 0 -> 1: first schema
  (db) => createStores_v1(db),
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

    req.onupgradeneeded = (event) => {
      const db = req.result;
      const tx = req.transaction;
      const from = event.oldVersion;
      try {
        for (let v = from; v < version; v += 1) {
          migrations[v](db, tx);
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
    firstOpenedAt: now,
    lastOpenedAt: now,
    lastPracticedAt: null,
    totalExp: 0,
    magicStones: 0,
    vaultUnlocked: false,
    pendingPrize: { total: 0, remaining: 0 },
    owned: { themes: ['pureBlack'], badges: ['circle'], titleFrames: ['none'], legendaryTitles: [] },
    equipped: { theme: 'pureBlack', badge: 'circle', titleFrame: 'none', title: null },
    weeklyWins: 0,
    practiceDays: 0,
    onboardingDone: false,
    seenExplanations: [],
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
