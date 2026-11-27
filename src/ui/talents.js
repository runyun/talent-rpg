// Talents tab (spec 5.2): the week calendar, the active talents, Dormant.

import { el, mount } from '../dom.js';
import { text, raw } from '../text.js';
import {
  addDays, dateKey, fromDateKey, hm, isoWeekday, weekKey, weekdayLetter, weekdayLabel,
} from '../time.js';
import { fmtStep, fmtValue, shortNameOf } from '../format.js';
import { state } from '../store.js';
import {
  allInstancesForWeek, recordAt, recordsInWeek, weekStats,
} from '../model/schedule.js';
import { dirOf, shownTarget } from '../model/practice.js';
import { slotUse } from '../model/roles.js';
import {
  challengeEntry, stepsToNextChallenge, nextRank, STAR,
} from '../model/challenge.js';
import { rescheduleSheet } from './sheets.js';
import { rankLadder, roleTag, onLongPress } from './widgets.js';
import { rankText } from './today.js';
import { talentMenu } from './talent.js';
import { app } from './app.js';

let dormantOpen = false;

/**
 * Cells of the week calendar, one list per weekday (spec 5.2 item 2), earliest first:
 * practices (filled), undone slot instances (outlined, tap to reschedule), instances done on
 * another day (gray "✓ {day}"), and slots that start next week (gray time).
 */
export function weekColumns(st, now) {
  const wk = weekKey(now);
  const running = new Set(st.talents.filter((t) => t.role !== 'dormant').map((t) => t.id));
  const cols = [1, 2, 3, 4, 5, 6, 7].map(() => []);
  const instances = allInstancesForWeek(wk, st);
  const byKey = new Map(instances.map((i) => [i.key, i]));
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => dateKey(addDays(fromDateKey(wk), i)));
  const dayOf = (d) => {
    const i = days.indexOf(dateKey(d));
    return i === -1 ? null : i;
  };
  const minutes = (d) => d.getHours() * 60 + d.getMinutes();
  const records = recordsInWeek(wk, st.sessions).filter((r) => running.has(r.talentId));
  const doneSameDay = new Set();
  for (const r of records) {
    const when = new Date(recordAt(r));
    const col = dayOf(when);
    if (col === null) continue;
    const inst = r.slotInstance ? byKey.get(r.slotInstance) : null;
    if (inst && dayOf(inst.start) === col) doneSameDay.add(inst.key);
    const t = st.talents.find((x) => x.id === r.talentId);
    cols[col].push({
      type: 'practice', talent: t, sort: inst ? minutes(inst.start) : minutes(when), order: recordAt(r),
    });
  }
  for (const i of instances) {
    const col = dayOf(i.start);
    if (col === null || doneSameDay.has(i.key)) continue;
    const base = { talent: i.talent, sort: minutes(i.start), order: i.start.getTime() };
    if (i.nextWeekOnly) {
      cols[col].push({ ...base, type: 'nextWeek', time: hm(i.start) });
    } else if (i.done) {
      const r = st.sessions.find((x) => x.slotInstance === i.key);
      const d = r ? new Date(recordAt(r)) : i.start;
      cols[col].push({ ...base, type: 'doneElsewhere', day: weekdayLabel(isoWeekday(d)) });
    } else {
      cols[col].push({
        ...base, type: 'slot', time: hm(i.start), inst: i,
      });
    }
  }
  for (const c of cols) c.sort((a, b) => a.sort - b.sort || a.order - b.order);
  return { cols, hasNextWeek: instances.some((i) => i.nextWeekOnly), any: cols.some((c) => c.length) };
}

function weekCalendar(now) {
  const wk = weekKey(now);
  const week = weekStats(wk, state, now);
  const { cols, hasNextWeek, any } = weekColumns(state, now);
  const today = dateKey(now);
  const count = week.planned > 0 ? text('S139', { done: week.done, planned: week.planned }) : String(week.done);
  const dates = [1, 2, 3, 4, 5, 6, 7].map((d) => {
    const day = addDays(fromDateKey(wk), d - 1);
    return el('span', { class: `cal-date${dateKey(day) === today ? ' is-today' : ''}` },
      el('span', {}, weekdayLetter(d)), el('span', { class: 'num' }, String(day.getDate())));
  });
  const cell = (c) => {
    const name = el('span', { class: 'cal-name' }, shortNameOf(c.talent));
    if (c.type === 'practice') return el('span', { class: 'cal-cell filled' }, name, el('span', { class: 'num' }, '✓'));
    if (c.type === 'doneElsewhere') return el('span', { class: 'cal-cell gray' }, name, el('span', { class: 'num' }, text('S301', { day: c.day })));
    if (c.type === 'nextWeek') return el('span', { class: 'cal-cell gray' }, name, el('span', { class: 'num' }, c.time));
    return el('button', {
      type: 'button', class: 'cal-cell outlined', onclick: () => rescheduleSheet(c.inst, () => app.refresh()),
    }, name, el('span', { class: 'num' }, c.time));
  };
  const foot = [];
  if (week.planned > 0) {
    foot.push(el('p', { class: 'muted small' }, week.won ? text('S175') : text('S298', { n: Math.max(0, week.required - week.done) })));
  }
  foot.push(el('p', { class: 'muted small' }, text('S299')));
  if (hasNextWeek) foot.push(el('p', { class: 'muted small' }, text('S300')));
  return el('section', { class: 'card cal' },
    el('div', { class: 'week-head' }, el('span', { class: 'small muted' }, raw('L95')), el('span', { class: 'num small' }, count)),
    el('div', { class: 'cal-grid' }, dates),
    any ? el('div', { class: 'cal-grid cal-cols' }, cols.map((c) => el('div', { class: 'cal-col' }, c.map(cell))))
      : el('p', { class: 'muted small' }, text('S315')),
    el('hr', { class: 'rule' }),
    ...foot);
}

/** Third line of a talent row (5.2 item 3). */
function statusLine(t) {
  if (t.needsSetup) return text('S157', { talent: t.name });
  const value = fmtValue(t, shownTarget(t));
  const parts = [];
  if (value && t.goal !== null && t.goal !== undefined) parts.push(text('S215', { value, goal: fmtValue(t, t.goal) }));
  const entry = challengeEntry(state, t, new Date());
  if (entry) parts.push(entry.rank === STAR ? text('S211') : text('S144', { rank: entry.rank }));
  else if (t.plateau && t.plateau.active) parts.push(text('S147', { step: fmtStep(t, t.step, dirOf(t)) }));
  else {
    const n = stepsToNextChallenge(t);
    const r = nextRank(t);
    if (n !== null && r && r !== STAR) parts.push(text('S216', { rank: r, n }));
  }
  return parts.join(' · ');
}

export function renderTalentsTab(root) {
  const now = new Date();
  const rerender = () => app.refresh();
  const running = state.talents
    .filter((t) => t.role !== 'dormant')
    .sort((a, b) => (a.role === 'main' ? 0 : 1) - (b.role === 'main' ? 0 : 1) || a.createdAt - b.createdAt);
  const rows = running.map((t) => {
    const third = statusLine(t);
    const row = el('div', { class: 'row row-tap row-talent', role: 'button', tabindex: '0' },
      el('span', { class: 'row-main' },
        el('span', { class: 'row-label' }, el('span', { class: 'talent-name' }, t.name), ' ', roleTag(t.role)),
        rankLadder(t.rank),
        third ? el('span', { class: 'row-sub muted small num' }, third) : null),
      el('span', { class: 'chev muted', 'aria-hidden': 'true' }, '›'));
    onLongPress(row, () => talentMenu(t, rerender), () => app.talent(t.id));
    return row;
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
    weekCalendar(now),
    el('section', { class: 'group' },
      el('h2', { class: 'group-title' }, text('S212', { used: use.used, slots: use.slots })),
      rows.length ? el('div', { class: 'group-card' }, rows) : null,
      use.used >= use.slots ? el('p', { class: 'muted small' }, text('S213')) : null),
    dormantRows.length ? el('section', { class: 'group' }, el('div', { class: 'group-card' }, dormantRows)) : null));
}
