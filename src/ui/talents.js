// Talents tab (spec 5.2): this week's slots, the active talents, Dormant.
// Stage 10A shows the target line; challenge progress (S216) and the long-press menu come in 10B.

import { el, mount } from '../dom.js';
import { text, raw } from '../text.js';
import { hm, isoWeekday, weekKey, weekdayLabel } from '../time.js';
import { fmtValue } from '../format.js';
import { state } from '../store.js';
import { allInstancesForWeek, weekStats } from '../model/schedule.js';
import { shownTarget } from '../model/practice.js';
import { slotUse } from '../model/roles.js';
import { rescheduleSheet } from './sheets.js';
import { rankLadder, roleTag } from './widgets.js';
import { weekCells, weekHeader, rankText } from './today.js';
import { app } from './app.js';

let dormantOpen = false;

export function renderTalentsTab(root) {
  const now = new Date();
  const wk = weekKey(now);
  const week = weekStats(wk, state, now);
  const rerender = () => app.refresh();

  // This week: one line per instance, done ones with a check (spec 5.2 item 2).
  const lines = allInstancesForWeek(wk, state).map((i) => el('button', {
    type: 'button',
    class: 'row row-tap',
    onclick: i.done || i.nextWeekOnly ? undefined : () => rescheduleSheet(i, rerender),
  },
  el('span', { class: 'row-label num' }, `${weekdayLabel(isoWeekday(i.start))} ${hm(i.start)}  ${i.talent.name}`),
  i.nextWeekOnly ? el('span', { class: 'row-value muted small' }, raw('L110')) : el('span', { class: 'row-value' }, i.done ? '✓' : '')));

  const running = state.talents
    .filter((t) => t.role !== 'dormant')
    .sort((a, b) => (a.role === 'main' ? 0 : 1) - (b.role === 'main' ? 0 : 1) || a.createdAt - b.createdAt);
  const rows = running.map((t) => {
    const value = fmtValue(t, shownTarget(t));
    const third = t.needsSetup
      ? text('S157', { talent: t.name })
      : value && t.goal !== null && t.goal !== undefined ? text('S215', { value, goal: fmtValue(t, t.goal) }) : value;
    return el('button', { type: 'button', class: 'row row-tap row-talent', onclick: () => app.talent(t.id) },
      el('span', { class: 'row-main' },
        el('span', { class: 'row-label' }, el('span', { class: 'talent-name' }, t.name), ' ', roleTag(t.role)),
        rankLadder(t.rank),
        third ? el('span', { class: 'row-sub muted small num' }, third) : null),
      el('span', { class: 'chev muted', 'aria-hidden': 'true' }, '›'));
  });
  const use = slotUse(state);

  const dormant = state.talents.filter((t) => t.role === 'dormant');
  const dormantRows = [];
  if (dormant.length) {
    dormantRows.push(el('button', {
      type: 'button',
      class: 'row row-tap',
      onclick: () => {
        dormantOpen = !dormantOpen;
        rerender();
      },
    }, el('span', { class: 'row-label' }, raw('L91')), el('span', { class: 'row-value muted' }, String(dormant.length)), el('span', { class: 'chev muted' }, '›')));
    if (dormantOpen) {
      for (const t of dormant) {
        dormantRows.push(el('button', { type: 'button', class: 'row row-tap', onclick: () => app.talent(t.id) },
          el('span', { class: 'row-label' }, `${t.name} · ${rankText(t)}`)));
      }
    }
  }

  mount(root, el('div', { class: 'tab-page fade-in' },
    el('header', { class: 'page-head-tab' },
      el('h1', { class: 'big-title' }, raw('L81')[1]),
      el('button', {
        type: 'button', class: 'icon-btn plus', 'aria-label': raw('L20'), onclick: () => app.addTalent(),
      }, '+')),
    el('section', { class: 'group' },
      weekHeader(week),
      weekCells(week, now),
      lines.length ? el('div', { class: 'group-card' }, lines) : null),
    el('section', { class: 'group' },
      el('h2', { class: 'group-title' }, text('S212', { used: use.used, slots: use.slots })),
      rows.length ? el('div', { class: 'group-card' }, rows) : null,
      use.used >= use.slots ? el('p', { class: 'muted small' }, text('S213')) : null),
    dormantRows.length ? el('section', { class: 'group' }, el('div', { class: 'group-card' }, dormantRows)) : null));
}
