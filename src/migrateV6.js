// Data v5 -> v6 (spec version 20, 4.14). Same rules as v5: nothing is lost, and any error
// aborts the upgrade transaction so the old data stays as it was.
// Badges are retired: each bought badge (not the free Circle) returns 30 Mana (badgeRefund).
// The free finish effect (Check) and the free room items are owned and in use. No stories read yet.

export const BADGE_REFUND = 30;
export const ROOM_DEFAULTS = Object.freeze({
  window: 'small-window', wall: 'none', desk: 'folding-table', lamp: 'none', chair: 'stool', plant: 'none', rug: 'none',
});

export function playerToV6(p) {
  if (p.schema === 6) return p;
  const owned = { ...(p.owned || {}) };
  const equipped = { ...(p.equipped || {}) };
  const badges = (owned.badges || []).filter((b) => b !== 'circle');
  const refund = badges.length * BADGE_REFUND;
  const legacy = { ...(p.legacy || {}), badges: owned.badges || [], badge: equipped.badge || null };
  delete owned.badges;
  delete equipped.badge;
  return {
    ...p,
    schema: 6,
    mana: (p.mana || 0) + refund,
    badgeRefund: refund,
    legacy,
    owned: {
      ...owned,
      finishEffects: owned.finishEffects || ['check'],
      room: owned.room || Object.values(ROOM_DEFAULTS).filter((c) => c !== 'none'),
      stories: owned.stories || [],
    },
    equipped: {
      ...equipped,
      finishEffect: equipped.finishEffect || 'check',
      room: equipped.room || { ...ROOM_DEFAULTS },
    },
  };
}

/** The upgrade step: only uses the given tx. */
export function migrateV5toV6(db, tx) {
  tx.objectStore('player').getAll().onsuccess = (event) => {
    try {
      // Only a v5 player here; an older one is finished by the v5 step of the same upgrade.
      for (const p of event.target.result) if (p.schema === 5) tx.objectStore('player').put(playerToV6(p));
    } catch (err) {
      console.error('Migration to v6 failed', err);
      tx.abort();
    }
  };
}
