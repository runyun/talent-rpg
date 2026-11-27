// System Vault screens (spec 5.2 item 5, 5.10 item 3, 5.11).
// A draw where you had tickets stays hidden until it is revealed on the finish screen.

import { el, mount } from '../dom.js';
import { text, raw } from '../text.js';
import { fromDateKey, monthDay } from '../time.js';
import { state, saveSettings } from '../store.js';
import {
  currentPool, drawDate, drawNumbers, sortTickets,
} from '../model/vault.js';
import {
  backButton, openSheet, closeSheet,
} from './widgets.js';
import { app } from './app.js';

const fmtDate = (key) => monthDay(fromDateKey(key));

export function vaultVisible() {
  return state.player.vaultUnlocked && !(state.settings && state.settings.vaultOn === false);
}

/** Draws that can be shown: computed, and not waiting to be revealed to you. */
function visibleDraws() {
  return state.draws.filter((d) => d.revealed).sort((a, b) => b.draw - a.draw);
}

// L67: Pool, Next draw, Lucky, No jackpot, Jackpot, Prize, No prize
function resultLabel(d) {
  const L67 = raw('L67');
  if (!d.you || !d.you.tickets) return null;
  if (d.you.jackpots) return L67[4];
  if (d.you.prizes.length) return L67[5];
  return L67[6];
}

export function renderVaultSection() {
  if (!vaultVisible() || !state.vault) return null;
  const L67 = raw('L67');
  const now = new Date();
  const next = state.vault.lastDraw + 1;
  const mine = state.tickets.filter((t) => t.draw === next && t.owner === 0);
  const lucky = state.settings && state.settings.luckyNumbers;
  const isLucky = (t) => lucky && lucky.length === 3 && lucky.slice().sort((a, b) => a - b).join() === t.numbers.join();
  const draws = visibleDraws();
  const last = draws[0];
  const drawRow = (d) => {
    const [a, b, c] = d.numbers;
    return el('div', { class: 'row' },
      el('span', { class: 'row-label num small' }, text('S71', {
        draw: d.draw, date: fmtDate(d.date), a, b, c, count: d.ticketCount, pool: d.poolBefore,
      })),
      el('span', { class: 'row-value muted small' }, resultLabel(d) || ''));
  };
  return el('div', { class: 'vault' },
    el('section', { class: 'card vault-card' },
      el('div', { class: 'mana-line' }, el('span', { class: 'small muted' }, L67[0]), el('span', { class: 'small muted' }, L67[1])),
      el('div', { class: 'mana-line' },
        el('span', { class: 'level-big num' }, String(currentPool(state.vault, state.tickets, now))),
        el('span', { class: 'num' }, `${fmtDate(drawDate(next))} 00:00`))),
    el('section', { class: 'group' },
      el('h2', { class: 'group-title' }, text('S281', { count: mine.length })),
      mine.length ? el('div', { class: 'group-card' }, mine.map((t) => el('div', { class: 'row' },
        el('span', { class: 'row-label num' }, t.numbers.join(' · ')),
        isLucky(t) ? el('span', { class: 'row-value muted small' }, L67[2]) : null))) : null,
      el('p', { class: 'muted small' }, text('S253'))),
    last ? el('section', { class: 'group' },
      el('h2', { class: 'group-title' }, text('S282', { draw: last.draw })),
      el('div', { class: 'group-card' }, draws.slice(0, 10).map(drawRow))) : null,
    el('section', { class: 'group' }, el('div', { class: 'group-card' },
      el('button', { type: 'button', class: 'row row-tap', onclick: () => app.vaultRules() },
        el('span', { class: 'row-label' }, raw('L37')), el('span', { class: 'chev muted' }, '›')))));
}

// ---- Rules & verification (spec 5.11) ----

export function renderVaultRules(root, selected = null) {
  const draws = visibleDraws().slice(0, 10);
  const current = draws.find((d) => d.draw === selected) || draws[0] || null;

  const parts = [
    el('div', { class: 'page-top' }, backButton(() => app.back())),
    el('h1', { class: 'page-title' }, raw('L37')),
    ...['S66', 'S67', 'S68', 'S69', 'S70'].map((k) => el('p', {}, text(k))),
  ];

  if (current) {
    parts.push(el('div', { class: 'seg' }, draws.map((d) => el('button', {
      type: 'button',
      class: `seg-btn num${d.draw === current.draw ? ' on' : ''}`,
      onclick: () => app.vaultRules(d.draw),
    }, `#${d.draw}`))));
    const [a, b, c] = current.numbers;
    parts.push(el('p', { class: 'num' }, text('S71', {
      draw: current.draw, date: fmtDate(current.date), a, b, c, count: current.ticketCount, pool: current.poolBefore,
    })));
    const tickets = sortTickets(state.tickets.filter((t) => t.draw === current.draw));
    parts.push(el('div', { class: 'ticket-table num small' }, tickets.map((t) => el('div', { class: 'ticket-row' },
      el('span', {}, `#${t.owner}`),
      el('span', {}, t.numbers.join(' · ')),
      el('span', { class: 'muted' }, String(t.createdAt))))));

    const verdict = el('p', { class: 'small' });
    parts.push(el('button', {
      type: 'button',
      class: 'btn',
      onclick: async () => {
        const again = await drawNumbers(current.draw, tickets);
        verdict.textContent = raw(JSON.stringify(again) === JSON.stringify(current.numbers) ? 'L35' : 'L36');
      },
    }, raw('L34')), verdict);
  }

  mount(root, el('section', { class: 'page fade-in' }, ...parts));
}

// ---- Lucky numbers (spec 5.10 item 3) ----

export function luckyLabel() {
  const lucky = state.settings && state.settings.luckyNumbers;
  return lucky && lucky.length === 3 ? lucky.join(' · ') : raw('L69')[3];
}

export function luckyNumbersSheet(onSaved) {
  let picked = ((state.settings && state.settings.luckyNumbers) || []).slice();
  const buttons = [];
  const paint = () => buttons.forEach((b, i) => b.classList.toggle('on', picked.includes(i + 1)));
  for (let n = 1; n <= 14; n += 1) {
    const b = el('button', {
      type: 'button',
      class: 'seg-btn num',
      onclick: () => {
        if (picked.includes(n)) picked = picked.filter((x) => x !== n);
        else if (picked.length < 3) picked.push(n);
        paint();
      },
    }, String(n));
    buttons.push(b);
  }
  paint();
  const save = async (value) => {
    await saveSettings({ ...state.settings, luckyNumbers: value });
    closeSheet();
    onSaved();
  };
  openSheet([
    el('h2', { class: 'sheet-title' }, raw('L69')[2]),
    el('div', { class: 'lucky-grid' }, buttons),
    el('button', {
      type: 'button',
      class: 'btn btn-primary',
      onclick: () => {
        if (picked.length === 3) save(picked.slice().sort((x, y) => x - y));
      },
    }, raw('L21')),
    el('button', { type: 'button', class: 'btn', onclick: () => save(null) }, raw('L69')[3]),
    el('button', { type: 'button', class: 'btn btn-text-wide', onclick: () => closeSheet() }, raw('L03')),
  ]);
}
