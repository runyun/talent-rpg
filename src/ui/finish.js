// Saving a practice and the finish screen (spec 5.3.2, 6.5, 6.17).
// The practice is saved first; the finish screen only shows what happened.
// About 2 s later (or on a tap) Today comes back with "Saved · Undo" for 3 s.

import { el, mount, svg } from '../dom.js';
import { text, raw } from '../text.js';
import { CONFIG } from '../config.js';
import { fmtValue } from '../format.js';
import {
  state, talentById, newId, commitRecord, undoRecord, updateOpenMetric,
} from '../store.js';
import { finishRecord, levelProgress } from '../model/record.js';
import { instanceForTalent } from '../model/schedule.js';
import { congratsBlock, companionsOn } from './companions.js';
import { showNote, hideNote } from './widgets.js';
import { clearExtra } from './today.js';
import { app } from './app.js';

const CHECK_ICON = '<path class="check-path" d="M5 12.5l4.5 4.5L19 7.5"/>';

/**
 * Save one practice and show the finish screen.
 * Returns false when it cannot be saved (Find your start: S243).
 */
export async function completePractice({
  kind, talentId, inst = null, result = null, value = null, checksMissed = [],
}) {
  const now = new Date();
  const talent = talentById(talentId);
  if (!talent) return false;
  // The card may be older than the data: use the instance only while it is still open.
  let slot = inst;
  if (slot && state.sessions.some((r) => r.slotInstance === slot.key)) slot = instanceForTalent(state, talentId, now);
  const out = finishRecord({
    state, id: newId(), kind, talent, inst: slot, result, value, checksMissed, now,
  });
  if (out.error) return false;
  const snapshot = await commitRecord(out);
  updateOpenMetric({ practiced: true });
  clearExtra(talentId);
  app.finish({ view: out.view, snapshot, talent: out.talent });
  return true;
}

let leaveTimer = null;

function leave(snapshot) {
  clearTimeout(leaveTimer);
  leaveTimer = null;
  app.home();
  const undo = el('button', {
    type: 'button',
    class: 'note-btn',
    onclick: async () => {
      hideNote();
      await undoRecord(snapshot);
      app.refresh({ force: true });
    },
  }, raw('L116'));
  showNote(el('span', { class: 'note-row' }, el('span', {}, raw('L115')), el('span', { class: 'muted' }, ' · '), undo), CONFIG.undoMs);
}

function row(label, value, extra = null) {
  return el('div', { class: 'result-row' },
    el('span', { class: 'result-label muted small' }, label || ''),
    el('span', { class: 'result-value' }, value, extra));
}

function expBar(view) {
  const before = levelProgress(view.expBefore);
  const after = levelProgress(view.expAfter);
  const fill = el('span', { class: 'bar-fill' });
  // Grows from the old place to the new one; with a level up it fills first, then starts from 0.
  fill.style.width = `${Math.round((before.into / before.need) * 100)}%`;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (after.lv > before.lv) {
      fill.style.width = '100%';
      setTimeout(() => {
        fill.style.transition = 'none';
        fill.style.width = '0%';
        requestAnimationFrame(() => {
          fill.style.transition = '';
          fill.style.width = `${Math.round((after.into / after.need) * 100)}%`;
        });
      }, 300);
    } else {
      fill.style.width = `${Math.round((after.into / after.need) * 100)}%`;
    }
  }));
  return el('span', { class: 'bar' }, fill);
}

export function renderFinish(root, { view, snapshot, talent }) {
  clearTimeout(leaveTimer);
  const L117 = raw('L117');
  const t = talent || talentById(view.talentId);
  const passed = view.kind === 'practice' && view.passed;
  const parts = [];

  if (view.kind === 'practice') {
    if (passed) parts.push(el('span', { class: 'check-icon' }, svg(CHECK_ICON)));
    parts.push(el('p', { class: 'finish-big' }, raw(passed ? 'L111' : 'L118')));
    parts.push(el('p', { class: 'finish-target num' }, view.changed
      ? text('S170', { old: fmtValue(t, view.old), new: fmtValue(t, view.new) })
      : text('S171', { value: fmtValue(t, view.new) })));
    if (!passed) parts.push(el('p', { class: 'muted small' }, text('S177')));
  } else if (view.kind === 'findStart') {
    parts.push(el('span', { class: 'check-icon' }, svg(CHECK_ICON)));
    parts.push(el('p', { class: 'finish-target num' }, text('S156', { value: fmtValue(t, view.startSet.value), n: view.startSet.n })));
  }

  const rows = [];
  rows.push(row(L117[0], text('S172', { exp: view.exp }), view.gate ? el('span', { class: 'muted small' }, ` ${text('S173')}`) : null));
  rows.push(el('div', { class: 'result-bar' }, expBar(view)));
  if (view.firstExp) rows.push(el('p', { class: 'muted small' }, text('S60')));
  rows.push(view.winNow
    ? el('p', { class: 'result-line' }, text('S18', { done: view.weekDone, planned: view.weekPlanned, count: view.winCount }))
    : row(L117[1], view.weekPlanned > 0 ? text('S174', { done: view.weekDone, planned: view.weekPlanned }) : String(view.weekDone)));
  if (view.lvNew > view.lvOld) rows.push(el('p', { class: 'result-line' }, text('S17', { old: view.lvOld, new: view.lvNew })));
  if (view.crit) rows.push(el('p', { class: 'result-line' }, text(view.crit)));
  if (view.joined && companionsOn()) rows.push(el('p', { class: 'result-line' }, text('S135', { count: view.joined })));
  if (view.manaGained > 0) rows.push(row(L117[2], text('S176', { m: view.manaGained, n: view.manaTotal })));
  for (const line of view.vaultLines || []) rows.push(row(L117[3], text(line.key, line.vars || {})));
  parts.push(el('div', { class: 'result-rows' }, rows));

  for (const c of view.congrats || []) {
    const node = congratsBlock(c.kind, snapshot.recordId, c.vars);
    if (node) parts.push(node);
  }

  if (view.kind !== 'quick' && view.next !== null && view.next !== undefined) {
    parts.push(el('div', { class: 'finish-next' },
      el('p', { class: 'num' }, text('S178', { value: fmtValue(t, view.next) })),
      view.preview ? el('p', { class: 'muted small' }, text(view.preview.key, view.preview.vars)) : null));
  }

  const screen = el('section', { class: `finish fade-in${passed ? ' inverse' : ''}` }, el('div', { class: 'finish-body' }, parts));
  screen.addEventListener('click', () => leave(snapshot));
  mount(root, screen);
  leaveTimer = setTimeout(function tick() {
    // Not while a text field is in use (spec 3.3).
    const a = document.activeElement;
    if (a && ['INPUT', 'TEXTAREA'].includes(a.tagName)) {
      leaveTimer = setTimeout(tick, 500);
      return;
    }
    leave(snapshot);
  }, CONFIG.finishStayMs);
}

export function stopFinish() {
  clearTimeout(leaveTimer);
  leaveTimer = null;
}
