// Settings -> Check (spec 10.1) and Validation data (10.2). Nothing leaves the phone except what
// the user copies.

import { el, mount } from '../dom.js';
import { text, raw } from '../text.js';
import { fromDateKey, monthDay } from '../time.js';
import { fmtValue } from '../format.js';
import { getAll } from '../db.js';
import { state, talentById } from '../store.js';
import {
  weeklyRows, addTalentTimes, toggles, challengeResults, checkRows,
} from '../model/validation.js';
import { backButton, copyText } from './widgets.js';
import { app } from './app.js';

const NONE = '—';
const pct = (x) => (x === null || x === undefined ? NONE : `${Math.round(x * 100)}%`);
const weekOf = (wk) => monthDay(fromDateKey(wk));

export async function loadMetrics() {
  try {
    return await getAll(state.db, 'metrics');
  } catch {
    return [];
  }
}

/** The Check rows for the Settings group: [{ fact, status, tip }] or null (first week). */
export function checkList(metrics, now = new Date()) {
  const L79 = raw('L79');
  const check = checkRows(state, metrics, now);
  if (!check) return null;
  const label = {
    onTrack: L79[0], worth: L79[1], none: L79[2], done: L79[3],
  };
  return {
    weekNo: check.weekNo,
    rows: check.rows.map((r) => {
      let fact;
      if (r.key === 'S81') {
        const t = talentById(r.record.talentId);
        fact = text('S81', {
          talent: t && t.name, rank: r.record.star ? 'S' : r.record.challengeRank, value: t && fmtValue(t, r.record.value), result: raw(r.record.result === 'passed' ? 'L111' : 'L112'),
        });
      } else {
        // Without data the number shows as a dash, so the row still names what it measures.
        const vars = { ...r.vars };
        if (r.key !== 'S74' && (vars.x === null || vars.x === undefined)) vars.x = NONE;
        fact = text(r.key, vars);
      }
      return { fact, status: r.status ? label[r.status] : null, tip: r.status === 'worth' && r.tip ? text(r.tip) : null };
    }),
  };
}

/** Every table of 10.2: [{ title, rows: [[left, right]] } | { title, groups: [{ name, rows }] }]. */
function blocks(metrics, now) {
  const L70 = raw('L70');
  const L69 = raw('L69');
  const L83 = raw('L83');
  const weeks = weeklyRows(state, metrics, now);
  const per = (fn) => weeks.map((w) => [weekOf(w.wk), fn(w)]);
  const nameOf = (id) => (talentById(id) || {}).name || NONE;
  return [
    { title: L70[0], rows: per((w) => `${w.done}/${w.planned}`) },
    { title: L70[1], rows: per((w) => pct(w.offSlot)) },
    { title: L70[2], rows: per((w) => pct(w.passRate)) },
    { title: L70[3], rows: per((w) => pct(w.quickShare)) },
    { title: L70[4], rows: addTalentTimes(metrics).map((m) => [monthDay(new Date(m.at)), String(m.seconds)]) },
    { title: L70[5], rows: per((w) => String(w.edits)) },
    { title: L70[6], rows: per((w) => String(w.opensWithoutPractice)) },
    { title: L70[7], rows: per((w) => (w.stress === null ? NONE : String(w.stress))) },
    { title: L70[8], rows: toggles(metrics).map((m) => [monthDay(new Date(m.at)), `${L69[m.what === 'vault' ? 1 : 0]} ${m.on ? L83[0] : L83[2]}`]) },
    {
      title: L70[9],
      groups: challengeResults(state).map(({ talent, items }) => ({
        name: talent.name,
        rows: items.map((x) => [monthDay(new Date(x.at)), [x.kind === 'checkpoint' ? raw('L131') : x.rank, fmtValue(talent, x.value), x.result ? raw(x.result === 'passed' ? 'L111' : 'L112') : null].filter(Boolean).join(' · ')]),
      })),
    },
    { title: L70[10], rows: per((w) => Object.entries(w.byTalent).map(([id, n]) => `${nameOf(id)} ${n}`).join(' · ') || NONE) },
  ];
}

/** Plain text: one paragraph per metric, "Nov 16: 3/4" per line (10.2). */
export async function copyValidation() {
  const metrics = await loadMetrics();
  const lines = (rows) => (rows.length ? rows.map(([a, b]) => `${a}: ${b}`) : [NONE]);
  const s = blocks(metrics, new Date()).map((b) => {
    if (!b.groups) return [b.title, ...lines(b.rows)].join('\n');
    return [b.title, ...(b.groups.length ? b.groups.flatMap((g) => [g.name, ...lines(g.rows)]) : [NONE])].join('\n');
  }).join('\n\n');
  return copyText(s);
}

function table(rows) {
  if (!rows.length) return el('p', { class: 'muted small' }, NONE);
  return el('div', { class: 'group-card' }, rows.map(([a, b]) => el('div', { class: 'row' },
    el('span', { class: 'row-label muted small num' }, a), el('span', { class: 'row-value small num' }, b))));
}

export async function renderValidation(root) {
  const metrics = await loadMetrics();
  const parts = blocks(metrics, new Date()).map((b) => el('section', { class: 'group' },
    el('h2', { class: 'group-title' }, b.title),
    ...(b.groups ? (b.groups.length ? b.groups.map((g) => el('div', { class: 'stack' }, el('p', { class: 'small' }, g.name), table(g.rows))) : [table([])]) : [table(b.rows)])));
  mount(root, el('section', { class: 'page fade-in' },
    el('div', { class: 'page-top' }, backButton(() => app.back())),
    el('h1', { class: 'page-title' }, raw('L69')[5]),
    ...parts));
}
