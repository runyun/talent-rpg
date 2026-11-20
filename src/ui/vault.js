// System Vault screens (spec 5.2 item 5, 5.10 item 3, 5.11).
// A draw where you had tickets stays hidden until it is revealed on the finish screen.

import { el, mount } from '../dom.js';
import { text, raw } from '../text.js';
import { fromDateKey } from '../time.js';
import { state, saveSettings } from '../store.js';
import {
  currentPool, drawDate, drawNumbers, sortTickets,
} from '../model/vault.js';
import {
  backButton, openSheet, closeSheet,
} from './widgets.js';
import { app } from './app.js';

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const fmtDate = (key) => monthDay.format(fromDateKey(key));

export function vaultVisible() {
  return state.player.vaultUnlocked && !(state.settings && state.settings.vaultOn === false);
}

/** Draws that can be shown: computed, and not waiting to be revealed to you. */
function visibleDraws() {
  return state.draws.filter((d) => d.revealed).sort((a, b) => b.draw - a.draw);
}

function resultLabel(d) {
  const L67 = raw('L67');
  if (!d.you || !d.you.tickets) return null;
  if (d.you.jackpots) return L67[6];
  if (d.you.prizes.length) return L67[5];
  return L67[4];
}

export function renderVaultSection() {
  if (!vaultVisible() || !state.vault) return null;
  const L67 = raw('L67');
  const now = new Date();
  const next = state.vault.lastDraw + 1;
  const mine = state.tickets.filter((t) => t.draw === next && t.owner === 0);
  const row = (label, value) => el('div', { class: 'item-row' }, el('span', { class: 'muted' }, label), el('span', { class: 'num' }, value));
  const recent = visibleDraws().slice(0, 10).map((d) => el('div', { class: 'item-row' },
    el('span', { class: 'num' }, `#${d.draw} · ${fmtDate(d.date)} · ${d.numbers.join(' · ')}`),
    el('span', { class: 'muted small' }, resultLabel(d) || '')));

  return el('section', { class: 'section' },
    el('h2', { class: 'section-title' }, raw('L60')[4]),
    row(L67[0], `${fmtDate(drawDate(next))} 00:00`),
    row(L67[1], String(currentPool(state.vault, state.tickets, now))),
    row(L67[2], String(mine.length)),
    ...mine.map((t) => el('p', { class: 'num small muted ticket-line' }, t.numbers.join(' · '))),
    recent.length ? el('h3', { class: 'item-head muted small' }, L67[3]) : null,
    ...recent,
    el('button', { type: 'button', class: 'btn', onclick: () => app.vaultRules() }, raw('L37')));
}

// ---- Rules & verification (spec 5.11) ----

export function renderVaultRules(root, selected = null) {
  const draws = visibleDraws().slice(0, 10);
  const current = draws.find((d) => d.draw === selected) || draws[0] || null;

  const parts = [
    el('div', { class: 'page-top' }, backButton(() => app.home())),
    el('h1', { class: 'page-title' }, raw('L37')),
    ...['S66', 'S67', 'S68', 'S69', 'S70'].map((k) => el('p', {}, text(k))),
  ];

  if (current) {
    parts.push(el('div', { class: 'seg' }, draws.map((d) => el('button', {
      type: 'button',
      class: `seg-btn num${d.draw === current.draw ? ' on' : ''}`,
      onclick: () => renderVaultRules(root, d.draw),
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
  openSheet(el('div', { class: 'stack' },
    el('p', { class: 'muted small' }, raw('L69')[2]),
    el('div', { class: 'lucky-grid' }, buttons),
    el('button', {
      type: 'button',
      class: 'btn btn-primary',
      onclick: () => {
        if (picked.length === 3) save(picked.slice().sort((x, y) => x - y));
      },
    }, raw('L21')),
    el('button', { type: 'button', class: 'btn', onclick: () => save(null) }, raw('L69')[3]),
    el('button', { type: 'button', class: 'btn-text', onclick: closeSheet }, raw('L03'))));
}
