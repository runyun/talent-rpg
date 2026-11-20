// Settings -> About your data -> Validation data (spec 5.10 item 5, spec 10).

import { el, mount } from '../dom.js';
import { raw } from '../text.js';
import { fromDateKey } from '../time.js';
import { getAll } from '../db.js';
import { state } from '../store.js';
import { formatValue } from '../model/trials.js';
import {
  weeklyRows, addTalentTimes, toggles, trialResults,
} from '../model/validation.js';
import { backButton } from './widgets.js';
import { app } from './app.js';

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const NONE = '—';
const pct = (x) => (x === null || x === undefined ? NONE : `${Math.round(x * 100)}%`);
const secs = (n) => (n === null || n === undefined ? NONE : `${n} ${raw('L71')}`);
const dayOf = (ms) => monthDay.format(new Date(ms));
const weekOf = (wk) => monthDay.format(fromDateKey(wk));

function block(title, rows) {
  return el('div', { class: 'section' },
    el('h2', { class: 'section-title' }, title),
    rows.length
      ? el('div', { class: 'data-table num small' }, rows.map(([a, b]) => el('div', { class: 'data-row' },
        el('span', { class: 'muted' }, a), el('span', {}, b))))
      : el('p', { class: 'muted small' }, NONE));
}

export async function renderValidation(root) {
  let metrics = [];
  try {
    metrics = await getAll(state.db, 'metrics');
  } catch {
    metrics = [];
  }
  const L70 = raw('L70');
  const L69 = raw('L69');
  const onOff = raw('L39');
  const weeks = weeklyRows(state, metrics, new Date());
  const perWeek = (fn) => weeks.map((w) => [weekOf(w.wk), fn(w)]);

  const parts = [
    el('div', { class: 'page-top' }, backButton(() => app.home())),
    el('h1', { class: 'page-title' }, L69[6]),
    block(L70[0], perWeek((w) => `${w.done}/${w.planned}`)),
    block(L70[1], perWeek((w) => pct(w.onTime))),
    block(L70[2], perWeek((w) => pct(w.offSlot))),
    block(L70[3], perWeek((w) => secs(w.secondsToStart))),
    block(L70[4], addTalentTimes(metrics).map((m) => [dayOf(m.at), secs(m.seconds)])),
    block(L70[5], perWeek((w) => String(w.materialEdits))),
    block(L70[6], perWeek((w) => (w.feedback ? [w.feedback.tooEasy, w.feedback.justRight, w.feedback.tooHard].map(pct).join(' / ') : NONE))),
    block(L70[7], perWeek((w) => String(w.opensWithoutPractice))),
    block(L70[8], perWeek((w) => (w.stress === null ? NONE : String(w.stress)))),
    block(L70[9], toggles(metrics).map((t) => [dayOf(t.at), `${L69[t.what === 'vault' ? 1 : 0]} ${onOff[t.on ? 0 : 1]}`])),
  ];

  const trials = trialResults(state);
  parts.push(el('div', { class: 'section' },
    el('h2', { class: 'section-title' }, L70[10]),
    trials.length
      ? trials.map(({ talent, records }) => el('div', { class: 'attr-block' },
        el('span', {}, talent.name),
        el('div', { class: 'data-table num small' }, records.map((r) => el('div', { class: 'data-row' },
          el('span', { class: 'muted' }, monthDay.format(fromDateKey(r.date))),
          el('span', {}, formatValue(talent, r.value)))))))
      : el('p', { class: 'muted small' }, NONE)));

  mount(root, el('section', { class: 'page fade-in' }, ...parts));
}
