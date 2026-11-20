// System Vault (spec 7.7, 7.8): draws, tickets, pool, prizes, reveal.
//
// Draw k opens at 00:00 local time on 2026-01-01 + 3k days (draw 1 = 2026-01-04).
// A ticket belongs to the first draw after the moment it was made.
// Pool of draw k = pool left after draw k-1 + number of tickets of draw k (each ticket adds 1 stone).
// Everything is reproducible: numbers come from SHA-256 of the draw date and its tickets.

import { CONFIG } from '../config.js';
import { ITEMS } from '../strings.js';
import { text } from '../text.js';
import { makeRng } from '../rng.js';
import { at, dateKey, fromDateKey, addDays } from '../time.js';

const V = CONFIG.vault;
const EPOCH = V.epoch.split('T')[0];

export function drawDate(k) {
  return dateKey(addDays(fromDateKey(EPOCH), V.everyDays * k));
}

export function drawTime(k) {
  return at(drawDate(k), '00:00').getTime();
}

/** The draw a ticket made at time t (ms) belongs to: the first draw strictly after t. */
export function drawFor(t) {
  let k = Math.max(1, Math.floor((t - drawTime(0)) / (V.everyDays * 86400000)));
  while (drawTime(k) <= t) k += 1;
  while (k > 1 && drawTime(k - 1) > t) k -= 1;
  return k;
}

/** 3 different numbers from 1-14, sorted, picked by a seeded generator. */
export function autoNumbers(seedText) {
  const r = makeRng(seedText);
  const out = [];
  while (out.length < V.numbersPerTicket) {
    const n = 1 + Math.floor(r() * V.numberMax);
    if (!out.includes(n)) out.push(n);
  }
  return out.sort((a, b) => a - b);
}

/** Tickets in the order used for the draw text: owner (you = 0, companions 1-30), then time. */
export function sortTickets(tickets) {
  return tickets.slice().sort((a, b) => a.owner - b.owner || a.createdAt - b.createdAt || (a.seq || 0) - (b.seq || 0));
}

/** The exact text that is hashed for draw k (shown on the verification page). */
export function drawText(k, tickets) {
  return [drawDate(k), ...sortTickets(tickets).map((t) => `${t.owner}-${t.createdAt}-${t.seq || 0}-${t.numbers.join('.')}`)].join('|');
}

async function sha256(bytes) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

/**
 * Winning numbers (spec 7.8): SHA-256 of the draw text; read bytes in order, skip bytes >= 252,
 * take (byte mod 14) + 1, skip repeats, stop at 3. If the bytes run out, hash the hash again.
 */
export async function drawNumbers(k, tickets) {
  let bytes = await sha256(new TextEncoder().encode(drawText(k, tickets)));
  const out = [];
  for (;;) {
    for (const b of bytes) {
      if (b >= 252) continue;
      const n = (b % V.numberMax) + 1;
      if (!out.includes(n)) out.push(n);
      if (out.length === V.numbersPerTicket) return out;
    }
    bytes = await sha256(bytes);
  }
}

export function matches(ticket, numbers) {
  return ticket.numbers.filter((n) => numbers.includes(n)).length;
}

const FRAME_CODES = ['singleLine', 'doubleLine', 'dashed', 'bold', 'rounded', 'squareBrackets', 'doubleBrackets', 'none'];
export { FRAME_CODES };

/** A prize ticket gives 10 stones or a title frame (by seed); the frame is checked again at reveal. */
function prizeFor(k, ticket) {
  const r = makeRng(`prize|${k}|${ticket.createdAt}|${ticket.seq || 0}`);
  if (r() < 0.5) return { type: 'stones', n: V.prizeStones };
  return { type: 'frame', pick: r() }; // which frame is decided at reveal, among frames not owned then
}

/**
 * Compute one draw. tickets: all tickets of draw k. carry: pool left after the previous draw.
 * Returns the draw record and the pool left after it.
 */
export async function computeDraw(k, tickets, carry) {
  const numbers = await drawNumbers(k, tickets);
  const poolBefore = carry + tickets.length;
  const winners = tickets.filter((t) => matches(t, numbers) === 3);
  const share = winners.length ? Math.floor(poolBefore / winners.length) : 0;
  const poolAfter = winners.length ? poolBefore - share * winners.length : poolBefore;
  const mine = tickets.filter((t) => t.owner === 0);
  const record = {
    draw: k,
    date: drawDate(k),
    numbers,
    poolBefore,
    poolAfter,
    ticketCount: tickets.length,
    jackpotOwners: winners.map((t) => t.owner),
    share,
    you: {
      tickets: mine.length,
      jackpots: winners.filter((t) => t.owner === 0).length,
      prizes: mine.filter((t) => matches(t, numbers) === 2).map((t) => prizeFor(k, t)),
    },
    revealed: mine.length === 0, // nothing to tell when you had no ticket
  };
  return { record, carry: poolAfter };
}

/** The legendary title for your next jackpot (in order, starting over after the last). */
export function nextLegendary(owned) {
  const list = ITEMS.legendaryTitles;
  return list[(owned || []).length % list.length];
}

/**
 * Apply unrevealed draws to the player at reveal time (spec 7.8): prizes and jackpots.
 * Returns { player, lines: [{ key, vars }], drawKeys }.
 */
export function revealDraws(player, draws) {
  const p = {
    ...player,
    owned: { ...player.owned, titleFrames: [...(player.owned.titleFrames || [])], legendaryTitles: [...(player.owned.legendaryTitles || [])] },
    pendingPrize: { ...(player.pendingPrize || { total: 0, remaining: 0 }) },
  };
  const lines = [];
  let prizeCount = 0;
  let jackpotCount = 0;
  const detail = [];
  for (const d of draws) {
    const dLines = [];
    for (let j = 0; j < d.you.jackpots; j += 1) {
      const title = nextLegendary(p.owned.legendaryTitles);
      p.owned.legendaryTitles.push(title);
      p.pendingPrize.total += d.share;
      p.pendingPrize.remaining += d.share;
      jackpotCount += 1;
      dLines.push({ key: 'S43', vars: { draw: d.draw, pool: d.share, title } });
    }
    for (const prize of d.you.prizes) {
      let label;
      const notOwned = FRAME_CODES.filter((c) => !p.owned.titleFrames.includes(c));
      if (prize.type === 'frame' && notOwned.length) {
        const code = notOwned[Math.floor(prize.pick * notOwned.length)];
        p.owned.titleFrames.push(code);
        label = ITEMS.titleFrames[FRAME_CODES.indexOf(code)];
      } else {
        p.magicStones += V.prizeStones;
        label = text('L73', { n: V.prizeStones });
      }
      prizeCount += 1;
      dLines.push({ key: 'S42', vars: { draw: d.draw, prize: label } });
    }
    if (!dLines.length) {
      const [a, b, c] = d.numbers;
      dLines.push({ key: 'S41', vars: { draw: d.draw, a, b, c, k: d.you.tickets } });
    }
    detail.push(...dLines);
  }
  // One draw: its own lines. Two or more: one summary line (spec 7.8). Never "almost".
  if (draws.length === 1) lines.push(...detail);
  else if (draws.length > 1) lines.push({ key: 'S44', vars: { count: draws.length, x: prizeCount, y: jackpotCount } });
  return { player: p, lines, drawKeys: draws.map((d) => d.draw) };
}

/**
 * Catch up the vault (spec 7.8 "every open"): turn companion practices into tickets, then compute
 * every draw that is due. Draw k is computed only after the companions are simulated through the
 * day before it, so no ticket of draw k can arrive later.
 * vault: { id: 'state', startDraw, lastDraw, carry, ticketedThrough } or null.
 * Returns { vault, newTickets, draws, feedItems }.
 */
export async function vaultCatchUp({ vault, world, practices, tickets, firstOpenedAt, now }) {
  const v = vault ? { ...vault } : {
    id: 'state',
    startDraw: drawFor(firstOpenedAt),
    lastDraw: drawFor(firstOpenedAt) - 1,
    carry: 0,
    ticketedThrough: dateKey(addDays(new Date(firstOpenedAt), -1)),
  };
  const newTickets = [];
  if (world) {
    const through = world.global.simulatedThrough;
    const fresh = practices
      .filter((x) => x.date > v.ticketedThrough && x.date <= through)
      .sort((a, b) => a.date.localeCompare(b.date) || a.companionId - b.companionId);
    for (const x of fresh) {
      const createdAt = at(x.date, x.time).getTime();
      const draw = drawFor(createdAt);
      if (draw < v.startDraw) continue;
      newTickets.push({ draw, owner: x.companionId, numbers: autoNumbers(`ticket|${x.date}|${x.companionId}`), createdAt, seq: 0 });
    }
    v.ticketedThrough = through > v.ticketedThrough ? through : v.ticketedThrough;
  }

  const all = tickets.concat(newTickets);
  const draws = [];
  const feedItems = [];
  for (let k = v.lastDraw + 1; drawTime(k) <= now.getTime(); k += 1) {
    const dayBefore = dateKey(addDays(fromDateKey(drawDate(k)), -1));
    if (!world || world.global.simulatedThrough < dayBefore) break;
    // eslint-disable-next-line no-await-in-loop
    const { record, carry } = await computeDraw(k, all.filter((t) => t.draw === k), v.carry);
    draws.push(record);
    v.carry = carry;
    v.lastDraw = k;
    for (const owner of record.jackpotOwners.filter((o) => o > 0)) {
      feedItems.push({ date: record.date, time: '00:00', type: 'jackpot', companionId: owner, key: 'S46', vars: { draw: k, pool: record.share } });
    }
  }
  return { vault: v, newTickets, draws, feedItems };
}

/** Pool shown now: left after the last draw + tickets of the next draw made so far. */
export function currentPool(vault, tickets, now) {
  if (!vault) return 0;
  const next = vault.lastDraw + 1;
  return vault.carry + tickets.filter((t) => t.draw === next && t.createdAt <= now.getTime()).length;
}

/** Release 1/5 of the pending jackpot after a Standard or Deep session (spec 7.8). */
export function releasePending(player) {
  const pend = player.pendingPrize || { total: 0, remaining: 0 };
  if (!pend.remaining) return null;
  const m = Math.min(pend.remaining, Math.ceil(pend.total * V.pendingReleaseRatio));
  const remaining = pend.remaining - m;
  return {
    player: {
      ...player,
      magicStones: player.magicStones + m,
      pendingPrize: { total: remaining ? pend.total : 0, remaining },
    },
    line: { key: 'S45', vars: { m, r: remaining } },
  };
}
