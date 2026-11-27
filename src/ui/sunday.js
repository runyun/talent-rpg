// Sunday "Next week" card (spec 6.11): last week, next week's slots, the Gate, the stress score.
// Shown on Today from Sunday 18:00 until OK. Left alone, next week keeps the slots and Main is the Gate.

import { el } from '../dom.js';
import { text, raw } from '../text.js';
import { CONFIG } from '../config.js';
import {
  DAY, addDays, at, dateKey, fromDateKey, hm, isoWeekday, weekKey, weekdayLabel,
} from '../time.js';
import {
  state, saveWeek, weekRecord, savePlayer,
} from '../store.js';
import { instancesForWeek, weekStats } from '../model/schedule.js';
import { gateFor } from '../model/challenge.js';
import { segmented, showNote } from './widgets.js';
import { slotGroupSheet } from './sheets.js';
import { app } from './app.js';

export function sundayCardDue(st, now) {
  if (isoWeekday(now) !== 7 || now.getHours() < CONFIG.sundayCardHour) return false;
  if (!st.talents.some((t) => t.role !== 'dormant')) return false;
  return !weekRecord(weekKey(now)).nextWeekConfirmed;
}

/** S38 once, on the first open of a week when last week's Sunday card was left alone. */
export function sameSlotsNotice(now) {
  const wk = weekKey(now);
  const rec = weekRecord(wk);
  if (rec.sameSlotsNoticeShown) return;
  const prevWk = dateKey(addDays(fromDateKey(wk), -7));
  const prev = state.weeks.get(prevWk);
  const prevSunday = at(dateKey(addDays(fromDateKey(prevWk), 6)), `${CONFIG.sundayCardHour}:00`);
  if (state.player.firstOpenedAt >= prevSunday.getTime() || (prev && prev.nextWeekConfirmed) || !state.slots.length) return;
  saveWeek({ ...rec, sameSlotsNoticeShown: true });
  setTimeout(() => showNote(text('S38')), 300);
}

let pickedGate = null;
let pickedStress = null;

export function renderSundayCard(now) {
  const wk = weekKey(now);
  const nextWk = dateKey(addDays(fromDateKey(wk), 7));
  const stats = weekStats(wk, state, now);
  const main = state.talents.find((t) => t.role === 'main');
  const running = state.talents.filter((t) => t.role !== 'dormant');
  const rec = weekRecord(wk);
  if (!pickedGate || !running.some((t) => t.id === pickedGate)) pickedGate = gateFor(state, nextWk) || (running[0] && running[0].id);
  if (pickedStress === null && typeof rec.anxiety === 'number') pickedStress = rec.anxiety;

  const rows = instancesForWeek(nextWk, { ...state, sessions: [] }).map((i) => el('button', {
    type: 'button',
    class: 'row row-tap',
    // Changing a slot here changes it for good (spec 6.11).
    onclick: () => slotGroupSheet([i.slot], () => app.refresh({ force: true })),
  },
  el('span', { class: 'row-label num' }, `${weekdayLabel(isoWeekday(i.start))} ${hm(i.start)}`),
  el('span', { class: 'row-value muted' }, i.talent.name),
  el('span', { class: 'chev muted', 'aria-hidden': 'true' }, '›')));

  const gate = segmented(running.map((t) => ({ value: t.id, label: t.name })), pickedGate, (v) => { pickedGate = v; });
  const trial = now.getTime() - state.player.firstOpenedAt < CONFIG.trialPeriodWeeks * 7 * DAY;
  const stress = trial ? segmented([1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) })), pickedStress, (v) => { pickedStress = v; }) : null;

  const ok = el('button', {
    type: 'button',
    class: 'btn btn-primary btn-main',
    onclick: async () => {
      const keep = (state.player.gate || []).filter((g) => g.weekStart >= wk && g.weekStart !== nextWk);
      await savePlayer({ ...state.player, gate: [...keep, { weekStart: nextWk, talentId: pickedGate }] });
      await saveWeek({ ...weekRecord(wk), nextWeekConfirmed: true, anxiety: pickedStress });
      pickedGate = null;
      pickedStress = null;
      app.refresh({ force: true });
    },
  }, raw('L14'));

  return el('section', { class: 'today sunday fade-in' },
    el('div', { class: 'sunday-body' },
      el('h1', { class: 'big-title' }, raw('L147')),
      el('p', { class: 'muted num' }, text('S274', {
        done: stats.done, planned: stats.planned, passes: stats.passes, rank: main ? main.rank : null,
      })),
      el('section', { class: 'group' }, el('h2', { class: 'group-title' }, raw('L148')), rows.length ? el('div', { class: 'group-card' }, rows) : null),
      el('section', { class: 'group' }, el('h2', { class: 'group-title' }, raw('L149')), gate.node),
      stress ? el('section', { class: 'group' }, el('p', { class: 'small' }, text('S39')), stress.node) : null),
    el('div', { class: 'today-bottom' }, ok));
}
