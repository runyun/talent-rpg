// Me -> Records: History (spec 5.16) and Logbooks (5.15).

import { el, mount } from '../dom.js';
import { text, raw } from '../text.js';
import { CONFIG } from '../config.js';
import {
  addDays, dateKey, fromDateKey, isoWeekday, monthDay, monthName, weekKey, weekdayLetter,
} from '../time.js';
import { fmtValue } from '../format.js';
import {
  state, saveLogbook, deleteLogbook, newId, talentById,
} from '../store.js';
import { recordAt, weekStats } from '../model/schedule.js';
import {
  backButton, group, navRow, openSheet, closeSheet, textInput, segmented, field, confirmDeleteButton, copyText,
} from './widgets.js';
import { textSheet } from './sheets.js';
import { app } from './app.js';

// ---- History (5.16) ----

let monthShown = null; // 'YYYY-MM'
let dayShown = null;

/** One line for a record (S258-S261, S287, S288). */
export function historyLine(r) {
  const t = talentById(r.talentId);
  if (!t) return null;
  const value = fmtValue(t, r.value);
  const result = r.result ? raw(r.result === 'passed' ? 'L111' : 'L112') : null;
  switch (r.kind) {
    case 'quick': return text('S260', { talent: t.name });
    case 'findStart': return text('S288', { talent: t.name, value });
    case 'challenge': return text('S261', { talent: t.name, rank: r.star ? 'S' : r.challengeRank, result });
    case 'checkpoint': return text('S287', { talent: t.name, value, result });
    default:
      if (r.result === 'passed') return text('S258', { talent: t.name, value });
      if (r.result === 'notYet') return text('S259', { talent: t.name, value });
      return t.name; // records from before version 0.8 have no result
  }
}

export function renderHistory(root) {
  const now = new Date();
  if (!monthShown) monthShown = dateKey(now).slice(0, 7);
  const [y, m] = monthShown.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const days = new Map();
  for (const r of state.sessions) {
    const k = dateKey(new Date(recordAt(r)));
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(r);
  }
  const monthDays = [...days.keys()].filter((k) => k.startsWith(monthShown)).length;
  const go = (delta) => {
    const d = new Date(y, m - 1 + delta, 1);
    monthShown = dateKey(d).slice(0, 7);
    dayShown = null;
    app.refresh();
  };
  const cells = [];
  for (let i = 1; i < isoWeekday(first); i += 1) cells.push(el('span'));
  for (let d = first; d.getMonth() === m - 1; d = addDays(d, 1)) {
    const k = dateKey(d);
    cells.push(el('button', {
      type: 'button',
      class: `day-cell num${days.has(k) ? ' done' : ''}${k === dateKey(now) ? ' is-today' : ''}${k === dayShown ? ' on' : ''}`,
      onclick: () => { dayShown = k; app.refresh(); },
    }, String(d.getDate())));
  }
  const picked = dayShown && days.has(dayShown)
    ? group(monthDay(fromDateKey(dayShown)), days.get(dayShown).map((r) => {
      const line = historyLine(r);
      return line ? el('div', { class: 'row' }, el('span', { class: 'row-label' }, line)) : null;
    }))
    : null;
  // Last week (L145): S262, with "Week won" when it was won.
  const lastWk = dateKey(addDays(fromDateKey(weekKey(now)), -7));
  const rec = state.weeks.get(lastWk);
  const live = weekStats(lastWk, state, now);
  const planned = rec && typeof rec.planned === 'number' ? rec.planned : live.planned;
  let last = text('S262', { done: live.done, planned, passes: live.passes });
  if ((rec && rec.won) || live.won) last += ` · ${text('S175')}`;
  mount(root, el('section', { class: 'page fade-in' },
    el('div', { class: 'page-top' }, backButton(() => app.back())),
    el('div', { class: 'page-head page-head-split' },
      el('h1', { class: 'page-title' }, monthName(first)),
      el('span', { class: 'month-nav' },
        el('button', { type: 'button', class: 'icon-btn', onclick: () => go(-1) }, '‹'),
        el('button', { type: 'button', class: 'icon-btn', onclick: () => go(1) }, '›'))),
    el('p', { class: 'muted small' }, text('S59', { count: monthDays })),
    el('div', { class: 'month-grid' }, [1, 2, 3, 4, 5, 6, 7].map((d) => el('span', { class: 'muted small month-head' }, weekdayLetter(d))), cells),
    picked,
    group(raw('L145'), [el('div', { class: 'row' }, el('span', { class: 'row-label num' }, last))])));
}

// ---- Logbooks (5.15) ----

const L146 = () => raw('L146');

export function renderLogbooks(root) {
  const rows = state.logbooks.map((b) => {
    const t = b.talentId ? talentById(b.talentId) : null;
    return navRow(b.name, String((b.entries || []).length), () => app.logbook(b.id), { sub: t ? t.name : null });
  });
  rows.push(el('button', { type: 'button', class: 'row row-tap', onclick: () => newLogbookSheet() }, el('span', { class: 'row-label' }, L146()[1])));
  mount(root, el('section', { class: 'page fade-in' },
    el('div', { class: 'page-top' }, backButton(() => app.back())),
    el('h1', { class: 'page-title' }, L146()[0]),
    group(null, rows)));
}

function newLogbookSheet() {
  const name = textInput('', { maxlength: 40 });
  const fieldsBox = el('div', { class: 'stack' });
  const fields = [];
  const addField = () => {
    const i = textInput('', { maxlength: 20 });
    i.addEventListener('input', () => {
      if (i.value.trim() && fields[fields.length - 1] === i && fields.length < 3) addField();
    });
    fields.push(i);
    fieldsBox.append(i);
  };
  addField();
  const options = [...state.talents.filter((t) => t.role !== 'dormant').map((t) => ({ value: t.id, label: t.name })), { value: null, label: L146()[5] }];
  const link = segmented(options, null);
  const free = !state.player.freeLogbookUsed;
  const price = free ? 0 : CONFIG.prices.logbook;
  const mana = state.player.mana || 0;
  const save = el('button', {
    type: 'button',
    class: 'btn btn-primary',
    disabled: mana < price || undefined,
    onclick: async () => {
      const n = name.value.trim();
      const f = fields.map((x) => x.value.trim()).filter(Boolean).slice(0, 3);
      if (!n || !f.length || mana < price) return;
      save.disabled = true;
      const p = state.player;
      await saveLogbook({
        id: newId(), name: n, fields: f, talentId: link.value, entries: [], createdAt: Date.now(),
      }, { ...p, mana: (p.mana || 0) - price, freeLogbookUsed: true });
      closeSheet();
      app.refresh();
    },
  }, raw('L21'));
  openSheet([
    el('h2', { class: 'sheet-title' }, L146()[1]),
    name,
    fieldsBox,
    field(L146()[4], link.node),
    el('p', { class: 'muted small' }, text('S263')),
    el('p', { class: 'small' }, free ? text('S265') : text('S264', { price, n: mana })),
    save,
    mana < price ? el('p', { class: 'muted small' }, text('S285', { n: price - mana })) : null,
    el('button', { type: 'button', class: 'btn btn-text-wide', onclick: () => closeSheet() }, raw('L03')),
  ]);
}

/** New entry: date (today by default) and one box per field. onSaved runs after saving. */
export function newEntrySheet(book, onSaved) {
  const date = el('input', { type: 'date', value: dateKey(new Date()) });
  const inputs = book.fields.map(() => textInput('', { maxlength: 40 }));
  openSheet([
    el('h2', { class: 'sheet-title' }, book.name),
    date,
    ...book.fields.map((f, i) => field(f, inputs[i])),
    el('button', {
      type: 'button',
      class: 'btn btn-primary',
      onclick: async () => {
        const cur = state.logbooks.find((b) => b.id === book.id);
        const entry = { date: date.value || dateKey(new Date()), values: inputs.map((x) => x.value.trim()) };
        await saveLogbook({ ...cur, entries: [...(cur.entries || []), entry] });
        closeSheet({ instant: true });
        if (onSaved) onSaved();
      },
    }, raw('L21')),
    el('button', { type: 'button', class: 'btn btn-text-wide', onclick: () => closeSheet() }, raw('L03')),
  ]);
}

const entryLine = (e) => [monthDay(fromDateKey(e.date)), ...e.values.map((v) => v || '—')].join(' · ');

export function renderLogbook(root, id) {
  const book = state.logbooks.find((b) => b.id === id);
  if (!book) {
    app.back();
    return;
  }
  const entries = (book.entries || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const copied = el('p', { class: 'muted small', hidden: true }, text('S90'));
  mount(root, el('section', { class: 'page fade-in' },
    el('div', { class: 'page-top' }, backButton(() => app.back())),
    el('h1', { class: 'page-title' }, book.name),
    // The copy sheet has no label for the date column yet (docs question); only the fields are listed.
    el('p', { class: 'muted small' }, book.fields.join(' · ')),
    group(null, entries.map((e) => el('div', { class: 'row' }, el('span', { class: 'row-label num' }, entryLine(e))))),
    el('div', { class: 'stack page-end' },
      el('button', { type: 'button', class: 'btn btn-primary btn-main', onclick: () => newEntrySheet(book, () => app.refresh()) }, L146()[2]),
      el('button', {
        type: 'button',
        class: 'btn',
        onclick: async () => { if (await copyText(entries.map(entryLine).join('\n'))) copied.hidden = false; },
      }, L146()[3]),
      copied,
      el('button', {
        type: 'button',
        class: 'btn',
        onclick: () => textSheet({
          title: raw('L18'),
          value: book.name,
          maxlength: 40,
          onSave: async (v) => { await saveLogbook({ ...state.logbooks.find((b) => b.id === id), name: v }); app.refresh(); },
        }),
      }, raw('L18')),
      confirmDeleteButton(async () => {
        await deleteLogbook(id);
        app.back();
      }))));
}
