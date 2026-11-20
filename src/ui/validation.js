// Me -> Settings -> About your data -> Validation data (spec 10).
// Top: Check (last full week against the goals, in words). Bottom: Details (every table),
// with a button that copies them as plain text. Nothing leaves the phone.

import { el, mount } from '../dom.js';
import { text, raw } from '../text.js';
import { fromDateKey } from '../time.js';
import { getAll } from '../db.js';
import { state } from '../store.js';
import { CONFIG } from '../config.js';
import { formatValue, metricName } from '../model/trials.js';
import {
  weeklyRows, addTalentTimes, toggles, trialResults, checkRows,
} from '../model/validation.js';
import { backButton } from './widgets.js';
import { app } from './app.js';

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const NONE = '—';
const pct = (x) => (x === null || x === undefined ? NONE : `${Math.round(x * 100)}%`);
const secs = (n) => (n === null || n === undefined ? NONE : `${n} ${raw('L71')}`);
const dayOf = (ms) => monthDay.format(new Date(ms));
const weekOf = (wk) => monthDay.format(fromDateKey(wk));

// ---- Check (10.1) ----

function renderCheck(metrics, now) {
  const L79 = raw('L79');
  const check = checkRows(state, metrics, now, CONFIG.check);
  if (!check) return el('div', { class: 'section section-first' }, el('p', { class: 'muted' }, L79[2]));
  const statusLabel = { onTrack: L79[0], worth: L79[1], none: L79[2] };
  const rows = check.rows.map((r) => {
    let vars = r.vars;
    if (r.key === 'S81') {
      const t = r.vars.talent;
      vars = {
        talent: t.name, metric: metricName(t.trialMetric), old: formatValue(t, r.vars.old), new: formatValue(t, r.vars.new),
      };
    }
    return el('div', { class: 'check-row' },
      el('div', { class: 'check-line' },
        el('span', { class: 'num' }, text(r.key, vars)),
        r.status ? el('span', { class: 'check-status small' }, statusLabel[r.status]) : null),
      r.status === 'worth' && r.tip ? el('p', { class: 'muted small' }, text(r.tip)) : null);
  });
  return el('div', { class: 'section section-first' },
    el('p', { class: 'muted small' }, text('S73', { date: weekOf(check.lastWk) })),
    el('div', { class: 'check-table' }, rows));
}

// ---- Details (10.2): the same tables on screen and as copied text ----

function detailBlocks(metrics, now) {
  const L70 = raw('L70');
  const L69 = raw('L69');
  const onOff = raw('L39');
  const weeks = weeklyRows(state, metrics, now);
  const perWeek = (fn) => weeks.map((w) => [weekOf(w.wk), fn(w)]);
  const blocks = [
    { title: L70[0], rows: perWeek((w) => `${w.done}/${w.planned}`) },
    { title: L70[1], rows: perWeek((w) => pct(w.onTime)) },
    { title: L70[2], rows: perWeek((w) => pct(w.offSlot)) },
    { title: L70[3], rows: perWeek((w) => secs(w.secondsToStart)) },
    { title: L70[4], rows: addTalentTimes(metrics).map((m) => [dayOf(m.at), secs(m.seconds)]) },
    { title: L70[5], rows: perWeek((w) => String(w.materialEdits)) },
    { title: L70[6], rows: perWeek((w) => (w.feedback ? [w.feedback.tooEasy, w.feedback.justRight, w.feedback.tooHard].map(pct).join(' / ') : NONE)) },
    { title: L70[7], rows: perWeek((w) => String(w.opensWithoutPractice)) },
    { title: L70[8], rows: perWeek((w) => (w.stress === null ? NONE : String(w.stress))) },
    { title: L70[9], rows: toggles(metrics).map((t) => [dayOf(t.at), `${L69[t.what === 'vault' ? 1 : 0]} ${onOff[t.on ? 0 : 1]}`]) },
  ];
  // Trial results: one group per talent.
  const trials = trialResults(state).map(({ talent, records }) => ({
    name: talent.name,
    rows: records.map((r) => [monthDay.format(fromDateKey(r.date)), formatValue(talent, r.value)]),
  }));
  blocks.push({ title: L70[10], groups: trials });
  return blocks;
}

function tableNode(rows) {
  if (!rows.length) return el('p', { class: 'muted small' }, NONE);
  return el('div', { class: 'data-table num small' }, rows.map(([a, b]) => el('div', { class: 'data-row' },
    el('span', { class: 'muted' }, a), el('span', {}, b))));
}

function blockNode(b) {
  const body = b.groups
    ? (b.groups.length ? b.groups.map((g) => el('div', { class: 'attr-block' }, el('span', {}, g.name), tableNode(g.rows))) : [tableNode([])])
    : [tableNode(b.rows)];
  return el('div', { class: 'section' }, el('h3', { class: 'item-head muted small' }, b.title), ...body);
}

/** Plain text: one paragraph per metric, one line per week (spec 10.2). */
function blocksText(blocks) {
  const lines = (rows) => (rows.length ? rows.map(([a, b]) => `${a}: ${b}`) : [NONE]);
  return blocks.map((b) => {
    if (!b.groups) return [b.title, ...lines(b.rows)].join('\n');
    const groups = b.groups.length ? b.groups.flatMap((g) => [g.name, ...lines(g.rows)]) : [NONE];
    return [b.title, ...groups].join('\n');
  }).join('\n\n');
}

async function copyText(s) {
  try {
    await navigator.clipboard.writeText(s);
    return true;
  } catch {
    // Older Safari: select a hidden text box and copy.
    const area = el('textarea', { readonly: true, class: 'offscreen' });
    area.value = s;
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

export async function renderValidation(root) {
  let metrics = [];
  try {
    metrics = await getAll(state.db, 'metrics');
  } catch {
    metrics = [];
  }
  const now = new Date();
  const blocks = detailBlocks(metrics, now);
  const copied = el('p', { class: 'muted small', hidden: true }, text('S90'));
  const copy = el('button', {
    type: 'button',
    class: 'btn',
    onclick: async () => {
      if (await copyText(blocksText(blocks))) copied.hidden = false;
    },
  }, raw('L78'));

  mount(root, el('section', { class: 'page fade-in' },
    el('div', { class: 'page-top' }, backButton(() => app.settings())),
    el('h1', { class: 'page-title' }, raw('L69')[5]),
    renderCheck(metrics, now),
    el('div', { class: 'section' },
      el('h2', { class: 'section-title' }, raw('L80')),
      copy,
      copied),
    ...blocks.map(blockNode)));
}
