// Bottom sheets shared by several screens: reschedule, slot editing, rename.

import { el } from '../dom.js';
import { text, raw } from '../text.js';
import { CONFIG } from '../config.js';
import {
  DAY, dayLabel, hm, localStamp, weekKey,
} from '../time.js';
import {
  state, saveSlot, deleteSlot, applyUpdates, newId,
} from '../store.js';
import {
  instancesForWeek, rescheduleOptions, rescheduleTarget, resolveCollision,
} from '../model/schedule.js';
import {
  openSheet, closeSheet, segmented, timePicker, field, textInput, confirmDeleteButton, showNote,
} from './widgets.js';

/** Reschedule one instance, this time only (spec 6.10). onMoved() runs after the S09 note. */
export function rescheduleSheet(inst, onMoved) {
  const now = new Date();
  const labels = raw('L54');
  const index = { inHour: 0, tonight: 1, tomorrow: 2 };
  const rows = rescheduleOptions(now).map((opt) => {
    const target = resolveCollision(rescheduleTarget(opt, inst, now), inst, state);
    return el('button', {
      type: 'button',
      class: 'row row-tap',
      onclick: async () => {
        const slot = { ...inst.slot, overrides: { ...(inst.slot.overrides || {}), [inst.key]: localStamp(target) } };
        await saveSlot(slot);
        closeSheet();
        showNote(text('S09', { day: dayLabel(target, new Date()), time: hm(target) }));
        onMoved();
      },
    },
    el('span', { class: 'row-label' }, labels[index[opt]]),
    el('span', { class: 'row-value muted num' }, `${dayLabel(target, now)} ${hm(target)}`));
  });
  openSheet([
    el('h2', { class: 'sheet-title' }, raw('L07')),
    el('p', { class: 'muted small' }, text('S193')),
    el('div', { class: 'group-card' }, rows),
    el('button', { type: 'button', class: 'btn btn-text-wide', onclick: () => closeSheet() }, raw('L03')),
  ]);
}

export function weekdayOptions() {
  return [1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: d, label: raw('L55')[d + 2] }));
}

/** This week's slots would go over 5 in the first 4 weeks (S52, spec 5.6 page 6). */
export function overWeeklyLimit(extraDays) {
  const early = Date.now() - state.player.firstOpenedAt < CONFIG.slots.warnWeeks * 7 * DAY;
  if (!early) return false;
  const existing = instancesForWeek(weekKey(new Date()), state).length;
  return existing + extraDays > CONFIG.slots.weeklyWarnLimit;
}

/**
 * Days (several), anchor and time: Add talent page 6 and "+ Add slot".
 * Returns { node, days(), anchor(), time(), build(talentId, now) }.
 */
export function slotFields({ days = [], anchor = '', time = '21:00', labels = raw('L139'), withHelp = true } = {}) {
  const warn = el('p', { class: 'muted small', hidden: true }, text('S52'));
  const daySeg = segmented(weekdayOptions(), days, (v) => { warn.hidden = !overWeeklyLimit(v.length); }, { multi: true });
  const anchorInput = textInput(anchor, { maxlength: 40 });
  const timeInput = timePicker(time);
  warn.hidden = !overWeeklyLimit(days.length);
  const node = el('div', { class: 'stack' },
    daySeg.node,
    warn,
    field(labels[0], anchorInput, withHelp ? el('p', { class: 'help muted small' }, text('S123')) : null),
    field(labels[1], timeInput.node));
  return {
    node,
    days: () => daySeg.value.slice().sort(),
    anchor: () => anchorInput.value.trim(),
    time: () => timeInput.value,
    build: (talentId, now) => daySeg.value.slice().sort().map((weekday) => ({
      id: newId(),
      talentId,
      weekday,
      anchor: anchorInput.value.trim(),
      time: timeInput.value,
      createdAt: now,
      overrides: {},
      schema: 5,
    })),
  };
}

/** Slots of a talent grouped by anchor and time ("Mon, Wed · after dinner  20:00"). */
export function slotGroups(talentId) {
  const groups = new Map();
  for (const s of state.slots.filter((x) => x.talentId === talentId)) {
    const key = `${s.anchor || ''}|${s.time}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  return [...groups.values()].map((slots) => slots.sort((a, b) => a.weekday - b.weekday));
}

/** Edit a group of slots permanently (days, anchor, time) or delete them (spec 5.8 item 6). */
export function slotGroupSheet(slots, onSaved) {
  const L62 = raw('L62');
  const first = slots[0];
  const form = slotFields({
    days: slots.map((s) => s.weekday), anchor: first.anchor || '', time: first.time, labels: [L62[1], L62[2]], withHelp: false,
  });
  const save = el('button', {
    type: 'button',
    class: 'btn btn-primary',
    onclick: async () => {
      const days = form.days();
      if (!days.length) return;
      save.disabled = true;
      const now = Date.now();
      const keep = slots.filter((s) => days.includes(s.weekday));
      const drop = slots.filter((s) => !days.includes(s.weekday));
      const added = days.filter((d) => !slots.some((s) => s.weekday === d));
      const changed = keep.map((s) => ({ ...s, anchor: form.anchor(), time: form.time() }));
      const fresh = form.build(first.talentId, now).filter((s) => added.includes(s.weekday));
      await applyUpdates({ slots: [...changed, ...fresh] });
      for (const s of drop) await deleteSlot(s.id); // eslint-disable-line no-await-in-loop
      closeSheet();
      onSaved();
    },
  }, raw('L21'));
  const del = confirmDeleteButton(async () => {
    for (const s of slots) await deleteSlot(s.id); // eslint-disable-line no-await-in-loop
    closeSheet();
    onSaved();
  });
  openSheet([
    field(L62[0], form.node),
    save,
    del,
    el('button', { type: 'button', class: 'btn btn-text-wide', onclick: () => closeSheet() }, raw('L03')),
  ]);
}

/** "+ Add slot" (spec 5.8 item 6): the same fields. Dormant talents can get slots too. */
export function addSlotsSheet(talent, onSaved) {
  const L62 = raw('L62');
  const last = state.slots[state.slots.length - 1];
  const form = slotFields({ time: last ? last.time : '21:00', labels: [L62[1], L62[2]] });
  const save = el('button', {
    type: 'button',
    class: 'btn btn-primary',
    onclick: async () => {
      const slots = form.build(talent.id, Date.now());
      if (!slots.length) return;
      save.disabled = true;
      await applyUpdates({ slots });
      closeSheet();
      onSaved();
    },
  }, raw('L21'));
  openSheet([
    field(L62[0], form.node),
    save,
    el('button', { type: 'button', class: 'btn btn-text-wide', onclick: () => closeSheet() }, raw('L03')),
  ]);
}

/** One line of text (Rename, Focus, Needs work): input, Save, Cancel. */
export function textSheet({
  title, value = '', maxlength = 120, onSave,
}) {
  const input = textInput(value, { maxlength });
  const save = el('button', {
    type: 'button',
    class: 'btn btn-primary',
    onclick: async () => {
      const v = input.value.trim();
      if (!v) {
        input.focus();
        return;
      }
      save.disabled = true;
      await onSave(v);
      closeSheet();
    },
  }, raw('L21'));
  openSheet([
    title ? el('h2', { class: 'sheet-title' }, title) : null,
    input,
    save,
    el('button', { type: 'button', class: 'btn btn-text-wide', onclick: () => closeSheet() }, raw('L03')),
  ].filter(Boolean));
  setTimeout(() => input.focus(), 50);
}
